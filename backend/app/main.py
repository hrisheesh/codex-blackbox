from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
import asyncio
import datetime
from .schemas import (
    StartSessionRequest, StartSessionResponse, StopSessionResponse,
    PromptNoteRequest, ReviewRequest, GenerateReportResponse,
    LiveMetricsResponse, FileChurnSchema, SessionSummarySchema,
    CompareSessionsResponse, ComparisonResultSchema
)
from fastapi.responses import StreamingResponse
import io
import os
import json
import zipfile
from .redaction import redact_text, redact_dict
from .db import get_session_local, SESSIONS_DIR
from .models import Session, FileEvent, FileChurn, PromptNote
from .report_generator import generate_reports
from .analytics import generate_compaction_analytics, detect_suspicious_patterns, generate_recommendations

app = FastAPI(title="codex-blackbox API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For MVP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def broadcast(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

async def broadcast_metrics(session_id: str):
    db = get_session_local(session_id)
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return
            
        events_count = db.query(FileEvent).filter(FileEvent.session_id == session_id).count()
        file_churns = db.query(FileChurn).filter(FileChurn.session_id == session_id).all()
        
        duration = session.duration_seconds
        if session.status == "recording":
            duration = int((datetime.datetime.utcnow() - session.created_at).total_seconds())
            
        files_touched = len(file_churns)
        files_created = sum(1 for c in file_churns if c.created)
        files_deleted = sum(1 for c in file_churns if c.deleted)
        files_rewritten = sum(1 for c in file_churns if c.rewrite_count > 0)
        
        total_written = sum(c.total_lines_written for c in file_churns)
        total_deleted = sum(c.total_lines_deleted for c in file_churns)
        
        current_lines = sum(c.current_lines for c in file_churns)
        overall_wa = total_written / max(current_lines, 1) if current_lines > 0 else 0
        
        timeline = []
        # Add session start
        timeline.append({
            "time": session.created_at,
            "type": "session_start",
            "detail": f"Session started for {session.project_path}"
        })
        
        # Add prompt notes
        notes = db.query(PromptNote).filter(PromptNote.session_id == session_id).all()
        for n in notes:
            timeline.append({
                "time": n.time,
                "type": "prompt_note",
                "detail": n.text
            })
            
        # Add file events (limit to last 50 for performance on UI)
        file_events = db.query(FileEvent).filter(FileEvent.session_id == session_id).order_by(FileEvent.time.desc()).limit(50).all()
        for e in file_events:
            if e.type == "codex_log_marker":
                detail = f"Codex marker: {e.change_kind} in {e.path}"
            else:
                detail = f"{e.path}"
                if e.type == "file_modified":
                    detail += f" (+{e.delta_added} -{e.delta_deleted})"
            timeline.append({
                "time": e.time,
                "type": e.type,
                "detail": detail
            })
            
        if session.status == "stopped":
            timeline.append({
                "time": session.end_time,
                "type": "session_stop",
                "detail": "Session stopped"
            })
            
        timeline.sort(key=lambda x: x["time"], reverse=True)
        
        metrics = LiveMetricsResponse(
            session_id=session_id,
            status=session.status,
            duration_seconds=duration,
            file_events_count=events_count,
            files_touched=files_touched,
            files_created=files_created,
            files_deleted=files_deleted,
            files_rewritten=files_rewritten,
            total_lines_written=total_written,
            total_lines_deleted=total_deleted,
            write_amplification=overall_wa,
            file_churns=[FileChurnSchema(
                path=c.path, created=c.created, deleted=c.deleted,
                recreated_count=c.recreated_count, modify_count=c.modify_count,
                rewrite_count=c.rewrite_count, total_lines_written=c.total_lines_written,
                total_lines_deleted=c.total_lines_deleted, current_lines=c.current_lines,
                write_amplification=c.write_amplification, first_seen=c.first_seen, last_seen=c.last_seen
            ) for c in file_churns],
            timeline=timeline[:100], # keep the last 100 events
            compaction_analytics=generate_compaction_analytics(db, session_id),
            suspicious_patterns=detect_suspicious_patterns(db, session_id)
        )
        
        await manager.broadcast(session_id, {"type": "metrics_updated", "data": metrics.model_dump()})
    finally:
        db.close()


def broadcast_metrics_sync(session_id: str, loop: asyncio.AbstractEventLoop):
    asyncio.run_coroutine_threadsafe(broadcast_metrics(session_id), loop)

@app.post("/api/sessions/start", response_model=StartSessionResponse)
async def start_session(req: StartSessionRequest):
    loop = asyncio.get_running_loop()
    
    def broadcast_callback(sid: str):
        broadcast_metrics_sync(sid, loop)
        
    session_id = session_manager.start_session(
        project_path=req.project_path,
        codex_log_path=req.codex_log_path,
        session_name=req.session_name,
        prompt_note=req.prompt_note,
        broadcast_callback=broadcast_callback
    )
    return {"session_id": session_id, "status": "recording"}

@app.post("/api/sessions/{session_id}/stop", response_model=StopSessionResponse)
async def stop_session(session_id: str):
    session_manager.stop_session(session_id)
    await broadcast_metrics(session_id)
    await manager.broadcast(session_id, {"type": "session_stopped"})
    return {"session_id": session_id, "status": "stopped"}

@app.post("/api/sessions/{session_id}/notes")
async def add_prompt_note(session_id: str, req: PromptNoteRequest):
    session_manager.add_prompt_note(session_id, req.text)
    await broadcast_metrics(session_id)
    return {"status": "ok"}

@app.post("/api/sessions/{session_id}/review")
async def add_review(session_id: str, req: ReviewRequest):
    session_manager.add_review(session_id, req.model_dump(exclude_unset=True))
    return {"status": "ok"}

@app.get("/api/sessions/{session_id}", response_model=LiveMetricsResponse)
async def get_live_metrics(session_id: str):
    db = get_session_local(session_id)
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        events_count = db.query(FileEvent).filter(FileEvent.session_id == session_id).count()
        file_churns = db.query(FileChurn).filter(FileChurn.session_id == session_id).all()
        
        duration = session.duration_seconds
        if session.status == "recording":
            duration = int((datetime.datetime.utcnow() - session.created_at).total_seconds())
            
        files_touched = len(file_churns)
        files_created = sum(1 for c in file_churns if c.created)
        files_deleted = sum(1 for c in file_churns if c.deleted)
        files_rewritten = sum(1 for c in file_churns if c.rewrite_count > 0)
        
        total_written = sum(c.total_lines_written for c in file_churns)
        total_deleted = sum(c.total_lines_deleted for c in file_churns)
        
        current_lines = sum(c.current_lines for c in file_churns)
        overall_wa = total_written / max(current_lines, 1) if current_lines > 0 else 0
        
        timeline = []
        timeline.append({
            "time": session.created_at,
            "type": "session_start",
            "detail": f"Session started for {session.project_path}"
        })
        notes = db.query(PromptNote).filter(PromptNote.session_id == session_id).all()
        for n in notes:
            timeline.append({
                "time": n.time,
                "type": "prompt_note",
                "detail": n.text
            })
        file_events = db.query(FileEvent).filter(FileEvent.session_id == session_id).order_by(FileEvent.time.desc()).limit(50).all()
        for e in file_events:
            if e.type == "codex_log_marker":
                detail = f"Codex marker: {e.change_kind} in {e.path}"
            else:
                detail = f"{e.path}"
                if e.type == "file_modified":
                    detail += f" (+{e.delta_added} -{e.delta_deleted})"
            timeline.append({
                "time": e.time,
                "type": e.type,
                "detail": detail
            })
        if session.status == "stopped":
            timeline.append({
                "time": session.end_time,
                "type": "session_stop",
                "detail": "Session stopped"
            })
        timeline.sort(key=lambda x: x["time"], reverse=True)

        return LiveMetricsResponse(
            session_id=session_id,
            status=session.status,
            duration_seconds=duration,
            file_events_count=events_count,
            files_touched=files_touched,
            files_created=files_created,
            files_deleted=files_deleted,
            files_rewritten=files_rewritten,
            total_lines_written=total_written,
            total_lines_deleted=total_deleted,
            write_amplification=overall_wa,
            file_churns=[FileChurnSchema(
                path=c.path, created=c.created, deleted=c.deleted,
                recreated_count=c.recreated_count, modify_count=c.modify_count,
                rewrite_count=c.rewrite_count, total_lines_written=c.total_lines_written,
                total_lines_deleted=c.total_lines_deleted, current_lines=c.current_lines,
                write_amplification=c.write_amplification, first_seen=c.first_seen, last_seen=c.last_seen
            ) for c in file_churns],
            timeline=timeline[:100],
            compaction_analytics=generate_compaction_analytics(db, session_id),
            suspicious_patterns=detect_suspicious_patterns(db, session_id),
            recommendations=generate_recommendations(db, session_id)
        )
    finally:
        db.close()

@app.post("/api/sessions/{session_id}/report", response_model=GenerateReportResponse)
async def generate_report_api(session_id: str):
    report_md, report_html, audit_json = generate_reports(session_id)
    return {
        "report_md_path": report_md,
        "report_html_path": report_html,
        "audit_bundle_path": audit_json
    }

@app.get("/api/sessions/{session_id}/export")
async def export_session(session_id: str):
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Ensure reports exist
    generate_reports(session_id)
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        # Load the LLM Audit Bundle to extract components
        audit_path = os.path.join(session_dir, "llm_audit_bundle.json")
        if os.path.exists(audit_path):
            with open(audit_path, "r") as f:
                audit_data = json.load(f)
                
            # Create metrics.json
            metrics_data = {
                "metadata": audit_data.get("metadata", {}),
                "summary": audit_data.get("summary", {})
            }
            zip_file.writestr("metrics.json", json.dumps(metrics_data, indent=2))
            
            # Create summary.md
            summary_md = f"# LLM Audit Summary\n\n## Metrics\n```json\n{json.dumps(metrics_data['summary'], indent=2)}\n```\n\n"
            summary_md += f"## Prompt Notes\n" + "\n".join(audit_data.get("prompt_notes", [])) + "\n\n"
            summary_md += f"## LLM Analysis Prompt\n\n```text\n{audit_data.get('analysis_prompt', '')}\n```\n"
            zip_file.writestr("summary.md", summary_md)
            
            # Extract specific components
            if "compaction_analytics" in audit_data:
                zip_file.writestr("compact_analysis.json", json.dumps(audit_data["compaction_analytics"], indent=2))
            if "suspicious_patterns" in audit_data:
                zip_file.writestr("suspicious_patterns.json", json.dumps(audit_data["suspicious_patterns"], indent=2))
                
        # Helper to redact and add file
        def add_file_to_zip(filename, arcname):
            filepath = os.path.join(session_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, "r") as f:
                    content = f.read()
                redacted_content = redact_text(content)
                zip_file.writestr(arcname, redacted_content)
                
        add_file_to_zip("file_churn.json", "file_churn.json")
        add_file_to_zip("file_events.jsonl", "events.jsonl")
        
        # Split events into file_events and codex_log_events
        events_path = os.path.join(session_dir, "file_events.jsonl")
        if os.path.exists(events_path):
            file_events = []
            log_events = []
            with open(events_path, "r") as f:
                for line in f:
                    if line.strip():
                        try:
                            event = json.loads(line)
                            if event.get("type") == "codex_log_marker":
                                log_events.append(redact_text(line))
                            else:
                                file_events.append(redact_text(line))
                        except:
                            file_events.append(redact_text(line))
            
            zip_file.writestr("file_events.jsonl", "".join(file_events))
            if log_events:
                zip_file.writestr("codex_log_events.jsonl", "".join(log_events))
                
        add_file_to_zip("review.json", "review.json")
        add_file_to_zip("report.md", "report.md")
        add_file_to_zip("diffs/final.patch", "final_diff.patch")
        
        # Generate timeline.md
        db = get_session_local(session_id)
        try:
            timeline_events = db.query(FileEvent).filter(FileEvent.session_id == session_id).order_by(FileEvent.time).all()
            timeline_md = "# Timeline\n\n"
            for e in timeline_events:
                detail = f"{e.path}"
                if e.type == "file_modified":
                    detail += f" (+{e.delta_added} -{e.delta_deleted})"
                elif e.type == "codex_log_marker":
                    detail = f"Codex marker: {e.change_kind} in {e.path}"
                timeline_md += f"- `{e.time.strftime('%H:%M:%S')}` **{e.type}** {redact_text(detail)}\n"
            zip_file.writestr("timeline.md", timeline_md)
        finally:
            db.close()
            
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=audit_bundle_{session_id}.zip"}
    )

@app.websocket("/ws/sessions/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)

@app.get("/api/sessions")
async def list_sessions():
    from .db import SESSIONS_DIR
    import os
    sessions = []
    if os.path.exists(SESSIONS_DIR):
        for s in os.listdir(SESSIONS_DIR):
            if os.path.isdir(os.path.join(SESSIONS_DIR, s)):
                sessions.append({"id": s})
    return sorted(sessions, key=lambda x: x["id"], reverse=True)

def get_session_summary(session_id: str) -> SessionSummarySchema:
    db = get_session_local(session_id)
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        file_churns = db.query(FileChurn).filter(FileChurn.session_id == session_id).all()
        events_count = db.query(FileEvent).filter(FileEvent.session_id == session_id).count()
        
        # Calculate metrics
        duration = session.duration_seconds
        if session.status == "recording":
            duration = int((datetime.datetime.utcnow() - session.created_at).total_seconds())
            
        files_touched = len(file_churns)
        total_written = sum(c.total_lines_written for c in file_churns)
        total_deleted = sum(c.total_lines_deleted for c in file_churns)
        current_lines = sum(c.current_lines for c in file_churns)
        overall_wa = total_written / max(current_lines, 1) if current_lines > 0 else 0
        
        files_created = sum(1 for c in file_churns if c.created)
        files_deleted = sum(1 for c in file_churns if c.deleted)
        files_recreated = sum(1 for c in file_churns if c.recreated_count > 0)
        
        compaction_analytics = generate_compaction_analytics(db, session_id)
        suspicious_patterns = detect_suspicious_patterns(db, session_id)
        
        # We also need quality score, try to read from review
        from .models import Review
        review = db.query(Review).filter(Review.session_id == session_id).first()
        quality_score = review.quality_score if review else None
        
        # Count tool calls (codex_log_marker where type not compact)
        tool_calls = db.query(FileEvent).filter(
            FileEvent.session_id == session_id,
            FileEvent.type == "codex_log_marker",
            FileEvent.change_kind != "compact"
        ).count()
        
        recs = generate_recommendations(db, session_id)
        
        return SessionSummarySchema(
            session_id=session_id,
            duration_seconds=duration,
            file_events_count=events_count,
            files_touched=files_touched,
            total_lines_written=total_written,
            total_lines_deleted=total_deleted,
            write_amplification=overall_wa,
            files_created=files_created,
            files_deleted=files_deleted,
            files_recreated=files_recreated,
            possible_compactions=len(compaction_analytics),
            possible_tool_calls=tool_calls,
            suspicious_patterns=len(suspicious_patterns),
            quality_score=quality_score,
            recommendations=len(recs)
        )
    finally:
        db.close()

def _compare_summaries(s1: SessionSummarySchema, s2: SessionSummarySchema) -> ComparisonResultSchema:
    # Heuristics
    # more efficient: lower WA, lower duration.
    eff1 = 0
    eff2 = 0
    if s1.write_amplification < s2.write_amplification: eff1 += 1
    elif s2.write_amplification < s1.write_amplification: eff2 += 1
    if s1.duration_seconds < s2.duration_seconds: eff1 += 1
    elif s2.duration_seconds < s1.duration_seconds: eff2 += 1
    
    more_efficient = s1.session_id if eff1 > eff2 else s2.session_id if eff2 > eff1 else "tie"
    
    # more churn: higher lines written + deleted, higher WA
    churn1 = s1.total_lines_written + s1.total_lines_deleted
    churn2 = s2.total_lines_written + s2.total_lines_deleted
    more_churn = s1.session_id if churn1 > churn2 else s2.session_id if churn2 > churn1 else "tie"
    
    # quality trend
    quality_trend = "unknown"
    if s1.quality_score is not None and s2.quality_score is not None:
        if s2.quality_score > s1.quality_score:
            quality_trend = "improved"
        elif s2.quality_score < s1.quality_score:
            quality_trend = "worsened"
        else:
            quality_trend = "unchanged"
            
    return ComparisonResultSchema(
        more_efficient=more_efficient,
        more_churn=more_churn,
        quality_trend=quality_trend
    )

@app.get("/api/compare", response_model=CompareSessionsResponse)
async def compare_sessions(s1: str, s2: str):
    summary1 = get_session_summary(s1)
    summary2 = get_session_summary(s2)
    comp = _compare_summaries(summary1, summary2)
    return CompareSessionsResponse(session1=summary1, session2=summary2, comparison=comp)

@app.get("/api/compare/export")
async def export_comparison(s1: str, s2: str):
    summary1 = get_session_summary(s1)
    summary2 = get_session_summary(s2)
    comp = _compare_summaries(summary1, summary2)
    
    md = f"# Session Comparison Report\n\n"
    md += f"**Session 1**: `{s1}`\n"
    md += f"**Session 2**: `{s2}`\n\n"
    
    md += f"## Conclusions\n"
    md += f"- **More Efficient**: `{comp.more_efficient}`\n"
    md += f"- **More Churn**: `{comp.more_churn}`\n"
    md += f"- **Quality Trend**: {comp.quality_trend}\n\n"
    
    md += f"## Metrics Side-by-Side\n\n"
    md += f"| Metric | Session 1 | Session 2 |\n"
    md += f"|---|---|---|\n"
    
    def fmttime(s):
        m = s // 60
        sec = s % 60
        return f"{m}m {sec}s"
        
    md += f"| Duration | {fmttime(summary1.duration_seconds)} | {fmttime(summary2.duration_seconds)} |\n"
    md += f"| Quality Score | {summary1.quality_score or 'N/A'} | {summary2.quality_score or 'N/A'} |\n"
    md += f"| File Events | {summary1.file_events_count} | {summary2.file_events_count} |\n"
    md += f"| Files Touched | {summary1.files_touched} | {summary2.files_touched} |\n"
    md += f"| Lines Written | {summary1.total_lines_written} | {summary2.total_lines_written} |\n"
    md += f"| Lines Deleted | {summary1.total_lines_deleted} | {summary2.total_lines_deleted} |\n"
    md += f"| Write Amplification | {summary1.write_amplification:.2f}x | {summary2.write_amplification:.2f}x |\n"
    md += f"| Files Created | {summary1.files_created} | {summary2.files_created} |\n"
    md += f"| Files Deleted | {summary1.files_deleted} | {summary2.files_deleted} |\n"
    md += f"| Files Recreated | {summary1.files_recreated} | {summary2.files_recreated} |\n"
    md += f"| Possible Compactions | {summary1.possible_compactions} | {summary2.possible_compactions} |\n"
    md += f"| Possible Tool Calls | {summary1.possible_tool_calls} | {summary2.possible_tool_calls} |\n"
    md += f"| Suspicious Patterns | {summary1.suspicious_patterns} | {summary2.suspicious_patterns} |\n"
    
    buffer = io.BytesIO(md.encode('utf-8'))
    return StreamingResponse(
        buffer,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=comparison_{s1}_{s2}.md"}
    )
