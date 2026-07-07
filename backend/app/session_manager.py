import os
import json
import datetime
import subprocess
from .models import Session, PromptNote, Review
from .db import get_session_local, SESSIONS_DIR
from .diff_engine import DiffEngine
from .file_watcher import FileWatcher

class SessionManager:
    def __init__(self):
        self.active_sessions = {}
        self.file_watcher = FileWatcher()
        
    def _generate_session_id(self):
        now = datetime.datetime.now()
        return now.strftime("%Y-%m-%d_%H-%M-%S")

    def start_session(self, project_path: str, codex_log_path: str = None, session_name: str = None, prompt_note: str = None, broadcast_callback=None):
        session_id = self._generate_session_id()
        db = get_session_local(session_id)
        
        try:
            db_session = Session(
                id=session_id,
                project_path=project_path,
                codex_log_path=codex_log_path,
                session_name=session_name
            )
            db.add(db_session)
            
            if prompt_note:
                note = PromptNote(session_id=session_id, text=prompt_note)
                db.add(note)
                
            db.commit()
            
            # Initialize diff engine and start watching
            session_dir = os.path.join(SESSIONS_DIR, session_id)
            diff_engine = DiffEngine(session_dir)
            
            self.active_sessions[session_id] = {
                "diff_engine": diff_engine,
                "project_path": project_path
            }
            
            # Initial git status capture
            diffs_dir = os.path.join(session_dir, "diffs")
            os.makedirs(diffs_dir, exist_ok=True)
            try:
                subprocess.run(["git", "status"], cwd=project_path, stdout=open(os.path.join(diffs_dir, "initial_status.txt"), "w"), stderr=subprocess.STDOUT, timeout=5)
            except Exception:
                pass
            
            self.file_watcher.start_watching(session_id, project_path, diff_engine, broadcast_callback)
            
            return session_id
        finally:
            db.close()

    def stop_session(self, session_id: str):
        if session_id in self.active_sessions:
            self.file_watcher.stop_watching(session_id)
            del self.active_sessions[session_id]
            
        db = get_session_local(session_id)
        try:
            db_session = db.query(Session).filter(Session.id == session_id).first()
            if db_session and db_session.status != "stopped":
                db_session.status = "stopped"
                db_session.end_time = datetime.datetime.utcnow()
                db_session.duration_seconds = int((db_session.end_time - db_session.created_at).total_seconds())
                db.commit()
                
                # Capture final git state
                session_dir = os.path.join(SESSIONS_DIR, session_id)
                diffs_dir = os.path.join(session_dir, "diffs")
                project_path = db_session.project_path
                try:
                    subprocess.run(["git", "diff", "--numstat"], cwd=project_path, stdout=open(os.path.join(diffs_dir, "final_numstat.txt"), "w"), stderr=subprocess.STDOUT, timeout=5)
                    subprocess.run(["git", "diff"], cwd=project_path, stdout=open(os.path.join(diffs_dir, "final.patch"), "w"), stderr=subprocess.STDOUT, timeout=5)
                except Exception:
                    pass
        finally:
            db.close()
            
    def add_prompt_note(self, session_id: str, text: str):
        db = get_session_local(session_id)
        try:
            note = PromptNote(session_id=session_id, text=text)
            db.add(note)
            db.commit()
            
            session_dir = os.path.join(SESSIONS_DIR, session_id)
            with open(os.path.join(session_dir, "prompt_notes.jsonl"), "a") as f:
                f.write(json.dumps({"type": "prompt_note", "time": datetime.datetime.utcnow().isoformat() + "Z", "text": text}) + "\n")
        finally:
            db.close()

    def add_review(self, session_id: str, review_data: dict):
        db = get_session_local(session_id)
        try:
            review = db.query(Review).filter(Review.session_id == session_id).first()
            if not review:
                review = Review(session_id=session_id, **review_data)
                db.add(review)
            else:
                for k, v in review_data.items():
                    setattr(review, k, v)
            db.commit()
            
            session_dir = os.path.join(SESSIONS_DIR, session_id)
            with open(os.path.join(session_dir, "review.json"), "w") as f:
                json.dump(review_data, f, indent=2)
        finally:
            db.close()
            
session_manager = SessionManager()
