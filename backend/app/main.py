from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict
import asyncio
import datetime
from .schemas import (
    StartSessionRequest, StartSessionResponse, StopSessionResponse,
    PromptNoteRequest, ReviewRequest, GenerateReportResponse,
    LiveMetricsResponse, FileChurnSchema
)
from .session_manager import session_manager
from .db import get_session_local
from .models import Session, FileEvent, FileChurn, PromptNote
from .report_generator import generate_reports
from .analytics import generate_compaction_analytics

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
            compaction_analytics=generate_compaction_analytics(db, session_id)
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
            compaction_analytics=generate_compaction_analytics(db, session_id)
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
