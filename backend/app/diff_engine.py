import os
import difflib
import datetime
import json
from sqlalchemy.orm import Session as SQLAlchemySession
from .models import FileEvent, FileChurn

class DiffEngine:
    def __init__(self, session_dir: str):
        self.session_dir = session_dir
        self.snapshots_dir = os.path.join(session_dir, "snapshots")
        os.makedirs(self.snapshots_dir, exist_ok=True)
        self.max_snapshot_size = 1 * 1024 * 1024 # 1 MB
        
        # In-memory cache for fast lookups
        self.files_cache = {}

    def get_snapshot_path(self, relative_path: str) -> str:
        safe_path = relative_path.replace("/", "_").replace("\\", "_")
        return os.path.join(self.snapshots_dir, safe_path)

    def load_snapshot(self, relative_path: str) -> list[str]:
        snapshot_path = self.get_snapshot_path(relative_path)
        if os.path.exists(snapshot_path):
            try:
                with open(snapshot_path, 'r', encoding='utf-8') as f:
                    return f.readlines()
            except Exception:
                pass
        return []

    def save_snapshot(self, relative_path: str, content: str):
        snapshot_path = self.get_snapshot_path(relative_path)
        if len(content.encode('utf-8')) <= self.max_snapshot_size:
            with open(snapshot_path, 'w', encoding='utf-8') as f:
                f.write(content)

    def process_file_change(self, db: SQLAlchemySession, session_id: str, event_type: str, absolute_path: str, project_path: str):
        if not absolute_path.startswith(project_path):
            return None, None
            
        relative_path = os.path.relpath(absolute_path, project_path)
        
        # Check size before reading
        if event_type != "file_deleted":
            try:
                if os.path.getsize(absolute_path) > self.max_snapshot_size:
                    return None, None # Skip huge files for MVP
            except OSError:
                return None, None
                
        old_lines = self.load_snapshot(relative_path)
        new_lines = []
        new_content = ""
        
        if event_type != "file_deleted":
            try:
                with open(absolute_path, 'r', encoding='utf-8') as f:
                    new_content = f.read()
                    new_lines = new_content.splitlines(keepends=True)
            except Exception:
                # Might be binary or unreadable
                return None, None
                
        lines_before = len(old_lines)
        lines_after = len(new_lines)
        
        delta_added = 0
        delta_deleted = 0
        
        if event_type == "file_created":
            delta_added = lines_after
        elif event_type == "file_deleted":
            delta_deleted = lines_before
            if os.path.exists(self.get_snapshot_path(relative_path)):
                os.remove(self.get_snapshot_path(relative_path))
        else: # modified
            # Compute diff
            diff = difflib.unified_diff(old_lines, new_lines, n=0)
            for line in diff:
                if line.startswith('---') or line.startswith('+++') or line.startswith('@@'):
                    continue
                if line.startswith('+'):
                    delta_added += 1
                elif line.startswith('-'):
                    delta_deleted += 1
                    
            if delta_added == 0 and delta_deleted == 0:
                return None, None # No real change
                
        # Save new snapshot
        if event_type != "file_deleted":
            self.save_snapshot(relative_path, new_content)
            
        change_kind = "modification"
        # Large rewrite heuristic
        if lines_after > 0 and (delta_added + delta_deleted) > (0.6 * lines_after):
            change_kind = "large_write"
        
        # Update db file event
        file_event = FileEvent(
            session_id=session_id,
            type=event_type,
            path=relative_path,
            lines_before=lines_before,
            lines_after=lines_after,
            delta_added=delta_added,
            delta_deleted=delta_deleted,
            change_kind=change_kind,
            time=datetime.datetime.utcnow()
        )
        db.add(file_event)
        
        # Update file churn
        file_churn = db.query(FileChurn).filter(FileChurn.session_id == session_id, FileChurn.path == relative_path).first()
        if not file_churn:
            file_churn = FileChurn(
                session_id=session_id,
                path=relative_path,
                created=(event_type == "file_created"),
                first_seen=datetime.datetime.utcnow()
            )
            db.add(file_churn)
            
        file_churn.last_seen = datetime.datetime.utcnow()
        
        if event_type == "file_deleted":
            file_churn.deleted = True
            file_churn.current_lines = 0
        elif event_type == "file_created" and file_churn.deleted:
            file_churn.recreated_count += 1
            file_churn.deleted = False
            file_churn.current_lines = lines_after
            file_churn.total_lines_written += delta_added
        else:
            file_churn.modify_count += 1
            file_churn.current_lines = lines_after
            file_churn.total_lines_written += delta_added
            file_churn.total_lines_deleted += delta_deleted
            
            if change_kind == "large_write":
                file_churn.rewrite_count += 1
                
        if file_churn.current_lines > 0:
            file_churn.write_amplification = file_churn.total_lines_written / max(file_churn.current_lines, 1)
        
        db.commit()
        db.refresh(file_event)
        db.refresh(file_churn)
        
        # Append to file_events.jsonl
        event_dict = {
            "type": file_event.type,
            "time": file_event.time.isoformat() + "Z",
            "path": file_event.path,
            "lines_before": file_event.lines_before,
            "lines_after": file_event.lines_after,
            "delta_added": file_event.delta_added,
            "delta_deleted": file_event.delta_deleted,
            "change_kind": file_event.change_kind
        }
        jsonl_path = os.path.join(self.session_dir, "file_events.jsonl")
        with open(jsonl_path, "a") as f:
            f.write(json.dumps(event_dict) + "\n")
            
        return file_event, file_churn
