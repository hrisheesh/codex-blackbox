from typing import List, Dict
from sqlalchemy.orm import Session
from typing import List, Dict
from sqlalchemy.orm import Session
from .models import FileEvent, FileChurn, Review
from .schemas import CompactionAnalyticsSchema, SuspiciousPatternSchema, RecommendationSchema
from collections import defaultdict
import datetime

def generate_compaction_analytics(db: Session, session_id: str) -> List[CompactionAnalyticsSchema]:
    # Fetch all events ordered by time
    events = db.query(FileEvent).filter(FileEvent.session_id == session_id).order_by(FileEvent.time).all()
    
    compaction_events = []
    
    # Identify compaction indices
    compaction_indices = []
    for i, e in enumerate(events):
        if e.type == "codex_log_marker" and e.change_kind == "compaction":
            compaction_indices.append(i)
            
    if not compaction_indices:
        return []
        
    for idx_idx, comp_idx in enumerate(compaction_indices):
        comp_event = events[comp_idx]
        
        start_idx = 0 if idx_idx == 0 else compaction_indices[idx_idx - 1] + 1
        end_idx = len(events) if idx_idx == len(compaction_indices) - 1 else compaction_indices[idx_idx + 1]
        
        # Partition events
        before_events = events[start_idx:comp_idx]
        after_events = events[comp_idx + 1:end_idx]
        
        # Analytics data structures
        files_before = set()
        markers_before = set()
        churn_before = {"written": 0, "deleted": 0}
        
        files_after = set()
        markers_after = set()
        deleted_before = set()
        recreated_after = set()
        churn_after = {"written": 0, "deleted": 0}
        
        # Process before events
        for e in before_events:
            if e.type in ["file_modified", "file_created", "file_deleted"]:
                files_before.add(e.path)
                churn_before["written"] += e.delta_added
                churn_before["deleted"] += e.delta_deleted
                if e.type == "file_deleted":
                    deleted_before.add(e.path)
                elif e.type in ["file_created", "file_modified"]:
                    if e.path in deleted_before:
                        deleted_before.remove(e.path)
            elif e.type == "codex_log_marker":
                markers_before.add(e.change_kind)
                
        # Process after events
        for e in after_events:
            if e.type in ["file_modified", "file_created", "file_deleted"]:
                files_after.add(e.path)
                churn_after["written"] += e.delta_added
                churn_after["deleted"] += e.delta_deleted
                if e.type == "file_created" and e.path in deleted_before:
                    recreated_after.add(e.path)
            elif e.type == "codex_log_marker":
                markers_after.add(e.change_kind)
                
        # Intersections
        repeated_files = list(files_before.intersection(files_after))
        repeated_markers = list(markers_before.intersection(markers_after))
        
        compaction_events.append(
            CompactionAnalyticsSchema(
                timestamp=comp_event.time,
                files_before=list(files_before),
                events_after=len(after_events),
                repeated_files_after=repeated_files,
                recreated_files_after=list(recreated_after),
                repeated_markers_after=repeated_markers,
                churn_before=churn_before,
                churn_after=churn_after
            )
        )
        
    return compaction_events


def detect_suspicious_patterns(db: Session, session_id: str) -> List[SuspiciousPatternSchema]:
    patterns = []
    
    # 1. Analyze File Churns
    churns = db.query(FileChurn).filter(FileChurn.session_id == session_id).all()
    for churn in churns:
        # High Write Amplification
        if churn.write_amplification > 3.0 and churn.total_lines_written > 100:
            patterns.append(SuspiciousPatternSchema(
                title="High Write Amplification",
                severity="High" if churn.write_amplification > 5.0 else "Medium",
                evidence=f"Write Amplification is {churn.write_amplification:.2f}x (Written: {churn.total_lines_written}, Current: {churn.current_lines})",
                related_files_events=[churn.path],
                why_it_matters="The agent wrote many more lines than the file's current size, indicating it is struggling to get the code right, reverting changes, or thrashing."
            ))
            
        # Rapid Large Rewrites
        if churn.rewrite_count > 2 and churn.total_lines_written > 200:
            patterns.append(SuspiciousPatternSchema(
                title="Repeated Large Rewrites",
                severity="High",
                evidence=f"File was rewritten {churn.rewrite_count} times with {churn.total_lines_written} total lines written.",
                related_files_events=[churn.path],
                why_it_matters="Repeatedly rewriting large portions of a file often means the agent's context is degraded and it is stuck in a loop trying to apply a complex fix."
            ))
            
        # Deleted and Recreated
        if churn.recreated_count > 0:
            patterns.append(SuspiciousPatternSchema(
                title="File Deleted and Recreated",
                severity="Low" if churn.recreated_count == 1 else "Medium",
                evidence=f"File was recreated {churn.recreated_count} times.",
                related_files_events=[churn.path],
                why_it_matters="Agents sometimes delete and recreate files instead of cleanly patching them, which wastes tokens and can lose existing unmentioned code."
            ))
            
        # Large Output Deletion
        if churn.total_lines_written > 300 and churn.deleted:
            patterns.append(SuspiciousPatternSchema(
                title="Large Output Deleted",
                severity="High",
                evidence=f"Agent wrote {churn.total_lines_written} lines to {churn.path} and then deleted the file.",
                related_files_events=[churn.path],
                why_it_matters="This is a massive waste of output tokens. The agent likely hallucinated a file path or generated an enormous incorrect artifact and gave up."
            ))

    # 2. Analyze Event Stream (Time-window based)
    events = db.query(FileEvent).filter(FileEvent.session_id == session_id).order_by(FileEvent.time).all()
    
    # High Modifications Window
    file_mods = defaultdict(list)
    marker_events = defaultdict(list)
    
    for e in events:
        if e.type in ["file_modified", "file_created", "file_deleted"]:
            file_mods[e.path].append(e.time)
        elif e.type == "codex_log_marker":
            marker_events[e.change_kind].append(e.time)
            
    # Check for 5+ modifications in 120 seconds
    for path, times in file_mods.items():
        if len(times) >= 5:
            for i in range(len(times) - 4):
                window_start = times[i]
                window_end = times[i + 4]
                if (window_end - window_start).total_seconds() <= 120:
                    patterns.append(SuspiciousPatternSchema(
                        title="Rapid File Modifications",
                        severity="Medium",
                        evidence=f"File was modified 5 or more times within 2 minutes around {window_start.strftime('%H:%M:%S')}.",
                        related_files_events=[path],
                        why_it_matters="Fast, repeated edits to the same file indicate the agent is trying to fix cascading lint/type errors in a tight loop."
                    ))
                    break # Only report once per file to avoid spam

    # Check for 4+ identical markers in 180 seconds
    for marker, times in marker_events.items():
        if len(times) >= 4:
            for i in range(len(times) - 3):
                window_start = times[i]
                window_end = times[i + 3]
                if (window_end - window_start).total_seconds() <= 180:
                    patterns.append(SuspiciousPatternSchema(
                        title=f"Repeated Tool Usage: {marker}",
                        severity="Medium",
                        evidence=f"Marker '{marker}' appeared 4 or more times within 3 minutes around {window_start.strftime('%H:%M:%S')}.",
                        related_files_events=[marker],
                        why_it_matters="Repeatedly using the same search or build tool implies the agent isn't getting the result it wants and is brute-forcing the tool."
                    ))
                    break # Only report once per marker to avoid spam

    return patterns

def generate_recommendations(db: Session, session_id: str) -> List[RecommendationSchema]:
    recs = []
    
    suspicious = detect_suspicious_patterns(db, session_id)
    compactions = generate_compaction_analytics(db, session_id)
    churns = db.query(FileChurn).filter(FileChurn.session_id == session_id).all()
    review = db.query(Review).filter(Review.session_id == session_id).first()
    
    # 1. Repeated Searches
    search_spam = any(
        s.title.startswith("Repeated Tool Usage:") and 
        any(x in s.title.lower() for x in ["rg", "grep", "search", "find"])
        for s in suspicious
    )
    if search_spam:
        recs.append(RecommendationSchema(
            issue="Repeated Searches Detected",
            evidence="The agent repeatedly used search tools in a short time window.",
            recommendation="Provide more specific prompt scoping or improve project AGENTS.md search rules to help the agent find context faster."
        ))
        
    # 2. High Write Amplification
    high_wa = any(c.write_amplification > 3.0 and c.total_lines_written > 100 for c in churns)
    if high_wa:
        recs.append(RecommendationSchema(
            issue="High Write Amplification",
            evidence="Files were rewritten with high amplification (outputting much more than the file size).",
            recommendation="Ask for a short implementation plan before allowing large generation to ensure the agent understands the task before writing code."
        ))
        
    # 3. Compaction markers before repeated reads/rewrites
    compaction_thrashing = any(
        len(c.repeated_files_after) > 0 or len(c.repeated_markers_after) > 0
        for c in compactions
    )
    if compaction_thrashing:
        recs.append(RecommendationSchema(
            issue="Compaction Thrashing",
            evidence="Compaction events were followed by reading or writing the same files, or repeating the same tools.",
            recommendation="Split the task into smaller sub-tasks or increase the context compaction threshold so the agent doesn't lose context."
        ))
        
    # 4. Full builds/tests repeatedly
    test_spam = any(
        s.title.startswith("Repeated Tool Usage:") and 
        any(x in s.title.lower() for x in ["test", "xcodebuild", "build", "make"])
        for s in suspicious
    )
    if test_spam:
        recs.append(RecommendationSchema(
            issue="Repeated Expensive Validation",
            evidence="The agent repeatedly triggered tests or builds in a short window.",
            recommendation="Approval-gate expensive validation commands to prevent the agent from brute-forcing fixes."
        ))
        
    # 5. Many files touched + low quality score
    files_touched = len(churns)
    if files_touched > 5 and review and review.quality_score is not None and review.quality_score < 7:
        recs.append(RecommendationSchema(
            issue="Broad Scope / Low Quality",
            evidence=f"The agent touched {files_touched} files, but the session received a low quality score ({review.quality_score}/10).",
            recommendation="Enforce stricter scope boundaries. The agent may have wandered outside the intended scope."
        ))
        
    return recs
