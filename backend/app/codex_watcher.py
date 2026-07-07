import os
import shutil
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from .db import get_session_local, SESSIONS_DIR
from .models import FileEvent
import datetime

MARKERS = [
    "compact", "compaction", "context compact",
    "tool_call", "tool", "shell", "command", "exec", 
    "xcodebuild", "test", "rg", "grep", "read", "write", "edit", "apply_patch"
]

class CodexLogEventHandler(FileSystemEventHandler):
    def __init__(self, session_id: str, raw_logs_dir: str, broadcast_callback=None):
        self.session_id = session_id
        self.raw_logs_dir = raw_logs_dir
        self.broadcast_callback = broadcast_callback
        self.cursors = {}
        self.lock = threading.Lock()
        
    def _scan_line(self, line: str, file_name: str):
        line_lower = line.lower()
        found_marker = None
        for marker in MARKERS:
            if marker in line_lower:
                found_marker = marker
                # Prioritize compactions as they are important
                if "compact" in marker:
                    found_marker = "compaction"
                    break
                    
        if found_marker:
            db = get_session_local(self.session_id)
            try:
                event = FileEvent(
                    session_id=self.session_id,
                    type="codex_log_marker",
                    path=file_name,
                    change_kind=found_marker
                )
                db.add(event)
                db.commit()
                if self.broadcast_callback:
                    self.broadcast_callback(self.session_id)
            except Exception:
                pass
            finally:
                db.close()

    def process_file(self, file_path: str):
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            return
            
        file_name = os.path.basename(file_path)
        dest_path = os.path.join(self.raw_logs_dir, file_name)
        
        with self.lock:
            try:
                # Copy the file to raw_logs
                shutil.copy2(file_path, dest_path)
                
                # Scan for new lines
                cursor = self.cursors.get(file_path, 0)
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    f.seek(cursor)
                    for line in f:
                        self._scan_line(line, file_name)
                    self.cursors[file_path] = f.tell()
            except Exception:
                # Defensive: do not crash on I/O or decode errors
                pass

    def on_created(self, event):
        if not event.is_directory:
            self.process_file(event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self.process_file(event.src_path)


class CodexLogWatcher:
    def __init__(self):
        self.observers = {}

    def start_watching(self, session_id: str, codex_log_path: str, broadcast_callback=None):
        if session_id in self.observers:
            return
            
        if not codex_log_path:
            # Expand ~ if provided
            codex_log_path = os.path.expanduser("~/.codex")
        else:
            codex_log_path = os.path.expanduser(codex_log_path)
            
        if not os.path.exists(codex_log_path) or not os.path.isdir(codex_log_path):
            return # Silent fail if log dir doesn't exist
            
        session_dir = os.path.join(SESSIONS_DIR, session_id)
        raw_logs_dir = os.path.join(session_dir, "raw_logs")
        os.makedirs(raw_logs_dir, exist_ok=True)
            
        event_handler = CodexLogEventHandler(session_id, raw_logs_dir, broadcast_callback)
        observer = Observer()
        observer.schedule(event_handler, codex_log_path, recursive=True)
        observer.start()
        
        self.observers[session_id] = observer
        
        # Initial scan of existing files
        try:
            for root, _, files in os.walk(codex_log_path):
                for f in files:
                    event_handler.process_file(os.path.join(root, f))
        except Exception:
            pass

    def stop_watching(self, session_id: str):
        if session_id in self.observers:
            observer = self.observers[session_id]
            observer.stop()
            observer.join()
            del self.observers[session_id]
