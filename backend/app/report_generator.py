import os
import json
from .db import get_session_local, SESSIONS_DIR
from .models import Session, FileEvent, FileChurn, PromptNote, Review
from .redaction import redact_dict
import datetime
from jinja2 import Template

def generate_reports(session_id: str):
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    db = get_session_local(session_id)
    
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        file_churns = db.query(FileChurn).filter(FileChurn.session_id == session_id).all()
        events_count = db.query(FileEvent).filter(FileEvent.session_id == session_id).count()
        notes = db.query(PromptNote).filter(PromptNote.session_id == session_id).all()
        review = db.query(Review).filter(Review.session_id == session_id).first()
        
        # Calculate metrics
        files_touched = len(file_churns)
        total_written = sum(c.total_lines_written for c in file_churns)
        total_deleted = sum(c.total_lines_deleted for c in file_churns)
        current_lines = sum(c.current_lines for c in file_churns)
        overall_wa = total_written / max(current_lines, 1) if current_lines > 0 else 0
        
        # Prepare data for templates
        data = {
            "session_id": session_id,
            "duration": str(datetime.timedelta(seconds=session.duration_seconds)),
            "project_path": session.project_path,
            "prompt_notes_count": len(notes),
            "files_touched": files_touched,
            "file_events": events_count,
            "total_lines_written": total_written,
            "total_lines_deleted": total_deleted,
            "write_amplification": f"{overall_wa:.2f}x",
            "quality_score": review.quality_score if review else "N/A",
            "churn_details": [
                {
                    "path": c.path,
                    "written": c.total_lines_written,
                    "deleted": c.total_lines_deleted,
                    "recreated": c.recreated_count,
                    "rewritten": c.rewrite_count,
                    "wa": f"{c.write_amplification:.2f}x"
                } for c in file_churns
            ],
            "notes": [n.text for n in notes]
        }
        
        # Generate Markdown
        md_template = """# codex-blackbox Session Report

## Summary
Session ID: {{ session_id }}
Session duration: {{ duration }}
Project: {{ project_path }}
Prompt notes: {{ prompt_notes_count }}
Files touched: {{ files_touched }}
File events: {{ file_events }}
Total lines written: +{{ total_lines_written }}
Total lines deleted: -{{ total_lines_deleted }}
Write amplification: {{ write_amplification }}
User quality score: {{ quality_score }}/10

## Prompt Notes
{% for note in notes %}
- {{ note }}
{% endfor %}

## File Churn Summary
| File Path | Lines Written | Lines Deleted | Recreated | Rewrites | Write Amplification |
|-----------|---------------|---------------|-----------|----------|---------------------|
{% for churn in churn_details %}
| {{ churn.path }} | +{{ churn.written }} | -{{ churn.deleted }} | {{ churn.recreated }} | {{ churn.rewritten }} | {{ churn.wa }} |
{% endfor %}
"""
        template = Template(md_template)
        md_content = template.render(**data)
        
        md_path = os.path.join(session_dir, "report.md")
        with open(md_path, "w") as f:
            f.write(md_content)
            
        # Generate HTML (Simple for MVP)
        html_template = """<!DOCTYPE html>
<html>
<head>
<title>codex-blackbox Report</title>
<style>
body { font-family: sans-serif; margin: 40px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #f2f2f2; }
</style>
</head>
<body>
<h1>codex-blackbox Session Report</h1>
<h2>Summary</h2>
<ul>
<li><b>Session ID:</b> {{ session_id }}</li>
<li><b>Duration:</b> {{ duration }}</li>
<li><b>Project:</b> {{ project_path }}</li>
<li><b>Files touched:</b> {{ files_touched }}</li>
<li><b>Total lines written:</b> +{{ total_lines_written }}</li>
<li><b>Total lines deleted:</b> -{{ total_lines_deleted }}</li>
<li><b>Write amplification:</b> {{ write_amplification }}</li>
<li><b>Quality score:</b> {{ quality_score }}/10</li>
</ul>
<h2>File Churn Summary</h2>
<table>
<tr><th>File Path</th><th>Written</th><th>Deleted</th><th>Recreated</th><th>Rewrites</th><th>WA</th></tr>
{% for churn in churn_details %}
<tr>
<td>{{ churn.path }}</td><td>+{{ churn.written }}</td><td>-{{ churn.deleted }}</td>
<td>{{ churn.recreated }}</td><td>{{ churn.rewritten }}</td><td>{{ churn.wa }}</td>
</tr>
{% endfor %}
</table>
</body>
</html>"""
        html_content = Template(html_template).render(**data)
        html_path = os.path.join(session_dir, "report.html")
        with open(html_path, "w") as f:
            f.write(html_content)
            
        # Generate JSON Audit Bundle
        audit_bundle = {
            "metadata": {
                "session_id": session_id,
                "duration_seconds": session.duration_seconds,
                "project_path": session.project_path,
            },
            "summary": {
                "files_touched": files_touched,
                "total_lines_written": total_written,
                "total_lines_deleted": total_deleted,
                "write_amplification": overall_wa,
            },
            "prompt_notes": [n.text for n in notes],
            "file_churn": [
                {
                    "path": c.path,
                    "created": c.created,
                    "deleted": c.deleted,
                    "recreated_count": c.recreated_count,
                    "modify_count": c.modify_count,
                    "rewrite_count": c.rewrite_count,
                    "total_lines_written": c.total_lines_written,
                    "total_lines_deleted": c.total_lines_deleted,
                    "current_lines": c.current_lines,
                    "write_amplification": c.write_amplification
                } for c in file_churns
            ],
            "review": {
                "quality_score": review.quality_score,
                "followed_instruction": review.followed_instruction,
                "code_worked": review.code_worked,
                "seemed_confused": review.seemed_confused,
                "overused_tools": review.overused_tools,
                "notes": review.notes
            } if review else None,
            "analysis_prompt": "Analyze this codex-blackbox audit bundle. Identify where the coding agent wasted context or tool calls, whether compaction may have caused repeated work or lower quality, and recommend concrete changes to config, global AGENTS.md, project AGENTS.md, and prompting workflow. Be specific and evidence-based."
        }
        
        redacted_audit_bundle = redact_dict(audit_bundle)
        
        json_path = os.path.join(session_dir, "llm_audit_bundle.json")
        with open(json_path, "w") as f:
            json.dump(redacted_audit_bundle, f, indent=2)
            
        # Write file_churn.json as per spec
        file_churn_path = os.path.join(session_dir, "file_churn.json")
        with open(file_churn_path, "w") as f:
            json.dump(redacted_audit_bundle["file_churn"], f, indent=2)
            
        return md_path, html_path, json_path
    finally:
        db.close()
