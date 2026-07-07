import os
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from .db import get_session_local
from .diff_engine import DiffEngine

class ProjectEventHandler(FileSystemEventHandler):
    def __init__(self, session_id: str, project_path: str, diff_engine: DiffEngine, broadcast_callback):
        self.session_id = session_id
        self.project_path = project_path
        self.diff_engine = diff_engine
        self.broadcast_callback = broadcast_callback
        
        self.ignored_dirs = {
            ".git", "node_modules", ".DS_Store", "DerivedData", "build",
            "dist", ".next", ".swiftpm", "Pods", "Carthage", ".vendor",
            "coverage", "__pycache__", ".pytest_cache", ".idea"
        }
        
        self.tracked_extensions = {
            ".swift", ".md", ".txt", ".json", ".yaml", ".yml", ".toml",
            ".xml", ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".py",
            ".cs", ".java", ".kt", ".go", ".rs", ".sql"
        }
        
        # Debounce dictionary
        self.debounce_timers = {}

    def is_ignored(self, path: str) -> bool:
        parts = path.split(os.sep)
        for ignored in self.ignored_dirs:
            if ignored in parts:
                return True
        return False

    def is_tracked_extension(self, path: str) -> bool:
        _, ext = os.path.splitext(path)
        return ext.lower() in self.tracked_extensions

    def process_event_debounced(self, event_type: str, path: str):
        db = get_session_local(self.session_id)
        try:
            file_event, file_churn = self.diff_engine.process_file_change(
                db=db,
                session_id=self.session_id,
                event_type=event_type,
                absolute_path=path,
                project_path=self.project_path
            )
            
            if file_event:
                if self.broadcast_callback:
                    self.broadcast_callback(self.session_id)
        finally:
            db.close()
            
    def process_event(self, event_type: str, path: str):
        if self.is_ignored(path) or not self.is_tracked_extension(path):
            return
            
        # Debounce logic
        if path in self.debounce_timers:
            self.debounce_timers[path].cancel()
            
        timer = threading.Timer(0.3, self.process_event_debounced, args=(event_type, path))
        self.debounce_timers[path] = timer
        timer.start()

    def on_created(self, event):
        if not event.is_directory:
            self.process_event("file_created", event.src_path)

    def on_modified(self, event):
        if not event.is_directory:
            self.process_event("file_modified", event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self.process_event("file_deleted", event.src_path)
            
    def on_moved(self, event):
        if not event.is_directory:
            self.process_event("file_deleted", event.src_path)
            self.process_event("file_created", event.dest_path)

class FileWatcher:
    def __init__(self):
        self.observers = {}

    def start_watching(self, session_id: str, project_path: str, diff_engine: DiffEngine, broadcast_callback):
        if session_id in self.observers:
            return
            
        event_handler = ProjectEventHandler(session_id, project_path, diff_engine, broadcast_callback)
        observer = Observer()
        observer.schedule(event_handler, project_path, recursive=True)
        observer.start()
        self.observers[session_id] = observer

    def stop_watching(self, session_id: str):
        if session_id in self.observers:
            observer = self.observers[session_id]
            observer.stop()
            observer.join()
            del self.observers[session_id]
