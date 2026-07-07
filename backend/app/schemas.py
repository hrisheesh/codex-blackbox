from pydantic import BaseModel
from typing import Optional, List, Any
import datetime

class StartSessionRequest(BaseModel):
    project_path: str
    codex_log_path: Optional[str] = None
    session_name: Optional[str] = None
    prompt_note: Optional[str] = None

class StartSessionResponse(BaseModel):
    session_id: str
    status: str

class StopSessionResponse(BaseModel):
    session_id: str
    status: str

class PromptNoteRequest(BaseModel):
    text: str

class ReviewRequest(BaseModel):
    quality_score: Optional[int] = None
    followed_instruction: Optional[bool] = None
    code_worked: Optional[bool] = None
    seemed_confused: Optional[bool] = None
    overused_tools: Optional[bool] = None
    notes: Optional[str] = None

class GenerateReportResponse(BaseModel):
    report_md_path: str
    report_html_path: str
    audit_bundle_path: str

class FileChurnSchema(BaseModel):
    path: str
    created: bool
    deleted: bool
    recreated_count: int
    modify_count: int
    rewrite_count: int
    total_lines_written: int
    total_lines_deleted: int
    current_lines: int
    write_amplification: float
    first_seen: Optional[datetime.datetime] = None
    last_seen: Optional[datetime.datetime] = None

class TimelineEventSchema(BaseModel):
    time: datetime.datetime
    type: str
    detail: str

class LiveMetricsResponse(BaseModel):
    session_id: str
    status: str
    duration_seconds: int
    file_events_count: int
    files_touched: int
    files_created: int
    files_deleted: int
    files_rewritten: int
    total_lines_written: int
    total_lines_deleted: int
    write_amplification: float
    file_churns: List[FileChurnSchema]
    timeline: List[TimelineEventSchema]
