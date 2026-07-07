from typing import List, Dict
from sqlalchemy.orm import Session
from .models import FileEvent
from .schemas import CompactionAnalyticsSchema

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
