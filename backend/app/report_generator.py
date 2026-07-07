import os
import json
from .db import get_session_local, SESSIONS_DIR
from .models import Session, FileEvent, FileChurn, PromptNote, Review
from .redaction import redact_dict
import datetime
from jinja2 import Template
from .analytics import generate_compaction_analytics, detect_suspicious_patterns

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
        
        # Git diff metrics
        git_added = 0
        git_deleted = 0
        git_available = False
        diffs_dir = os.path.join(session_dir, "diffs")
        final_numstat_path = os.path.join(diffs_dir, "final_numstat.txt")
        if os.path.exists(final_numstat_path):
            git_available = True
            with open(final_numstat_path, "r") as f:
                for line in f:
                    parts = line.split()
                    if len(parts) >= 2:
                        try:
                            git_added += int(parts[0])
                            git_deleted += int(parts[1])
                        except ValueError:
                            pass
                            
        # Top churned files
        top_churned = sorted(file_churns, key=lambda c: c.total_lines_written, reverse=True)[:10]
        
        # Timeline events
        file_events = db.query(FileEvent).filter(FileEvent.session_id == session_id).order_by(FileEvent.time).all()
        
        # Compaction analytics
        compaction_analytics = generate_compaction_analytics(db, session_id)
        
        # Suspicious patterns
        suspicious_patterns = detect_suspicious_patterns(db, session_id)
        
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
            "git_available": git_available,
            "git_added": git_added,
            "git_deleted": git_deleted,
            "review": {
                "quality_score": review.quality_score if review else "N/A",
                "followed_instruction": review.followed_instruction if review else "unknown",
                "code_worked": review.code_worked if review else "unknown",
                "seemed_confused": review.seemed_confused if review else "unknown",
                "overused_tools": review.overused_tools if review else "unknown",
                "notes": review.notes if review else "N/A"
            },
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
            "top_churned": [
                {
                    "path": c.path,
                    "written": c.total_lines_written,
                    "wa": f"{c.write_amplification:.2f}x"
                } for c in top_churned
            ],
            "timeline": [
                {
                    "time": e.time.strftime("%H:%M:%S"),
                    "type": e.type,
                    "path": e.path,
                    "delta": f"+{e.delta_added} -{e.delta_deleted}" if e.type == "file_modified" else (f"Codex marker: {e.change_kind}" if e.type == "codex_log_marker" else "")
                } for e in file_events
            ],
            "notes": [n.text for n in notes],
            "compaction_analytics": [
                {
                    "time": c.timestamp.strftime("%H:%M:%S"),
                    "files_before": c.files_before,
                    "events_after": c.events_after,
                    "repeated_files_after": c.repeated_files_after,
                    "recreated_files_after": c.recreated_files_after,
                    "repeated_markers_after": c.repeated_markers_after,
                    "churn_before": c.churn_before,
                    "churn_after": c.churn_after
                } for c in compaction_analytics
            ],
            "suspicious_patterns": [
                {
                    "title": p.title,
                    "severity": p.severity,
                    "evidence": p.evidence,
                    "related_files_events": p.related_files_events,
                    "why_it_matters": p.why_it_matters
                } for p in suspicious_patterns
            ],
            "analysis_prompt": "Analyze this codex-blackbox audit bundle. Identify where the coding agent wasted context or tool calls, whether compaction may have caused repeated work or lower quality, and recommend concrete changes to config, global AGENTS.md, project AGENTS.md, and prompting workflow. Be specific and evidence-based."
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
{% if git_available %}
Final Git Added: +{{ git_added }}
Final Git Deleted: -{{ git_deleted }}
{% endif %}

## Quality Review
- **Quality Score**: {{ review.quality_score }}/10
- **Followed Instructions**: {{ review.followed_instruction }}
- **Code Worked**: {{ review.code_worked }}
- **Seemed Confused**: {{ review.seemed_confused }}
- **Overused Tools**: {{ review.overused_tools }}
- **Notes**: {{ review.notes }}

## Prompt Notes
{% for note in notes %}
- {{ note }}
{% else %}
None recorded.
{% endfor %}

## Top Churned Files
{% for f in top_churned %}
1. {{ f.path }} (+{{ f.written }}, WA: {{ f.wa }})
{% endfor %}

## File Churn Summary
| File Path | Lines Written | Lines Deleted | Recreated | Rewrites | Write Amplification |
|-----------|---------------|---------------|-----------|----------|---------------------|
{% for churn in churn_details %}
| {{ churn.path }} | +{{ churn.written }} | -{{ churn.deleted }} | {{ churn.recreated }} | {{ churn.rewritten }} | {{ churn.wa }} |
{% endfor %}

## Suspicious Patterns & Loop Detection
{% for pattern in suspicious_patterns %}
### [{{ pattern.severity | upper }}] {{ pattern.title }}
- **Evidence:** {{ pattern.evidence }}
- **Related:** {{ pattern.related_files_events | join(', ') }}
- **Why it matters:** {{ pattern.why_it_matters }}
{% else %}
No suspicious patterns detected.
{% endfor %}

## Compaction Observable Behavior
{% for comp in compaction_analytics %}
### Compaction at {{ comp.time }}
- **Files touched before:** {{ comp.files_before | join(', ') if comp.files_before else 'None' }}
- **Events after:** {{ comp.events_after }}
- **Repeated files after:** {{ comp.repeated_files_after | join(', ') if comp.repeated_files_after else 'None' }}
- **Recreated files after:** {{ comp.recreated_files_after | join(', ') if comp.recreated_files_after else 'None' }}
- **Repeated markers after:** {{ comp.repeated_markers_after | join(', ') if comp.repeated_markers_after else 'None' }}
- **Churn Before:** +{{ comp.churn_before.written }} / -{{ comp.churn_before.deleted }}
- **Churn After:** +{{ comp.churn_after.written }} / -{{ comp.churn_after.deleted }}
{% else %}
No compactions detected.
{% endfor %}

## Timeline
{% for event in timeline %}
- `{{ event.time }}` **{{ event.type }}** {{ event.path }} {{ event.delta }}
{% endfor %}

## LLM Analysis Prompt
```text
{{ analysis_prompt }}
```
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
{% if git_available %}
<li><b>Final Git Added:</b> +{{ git_added }}</li>
<li><b>Final Git Deleted:</b> -{{ git_deleted }}</li>
{% endif %}
</ul>

<h2>Quality Review</h2>
<ul>
<li><b>Quality score:</b> {{ review.quality_score }}/10</li>
<li><b>Followed Instructions:</b> {{ review.followed_instruction }}</li>
<li><b>Code Worked:</b> {{ review.code_worked }}</li>
<li><b>Seemed Confused:</b> {{ review.seemed_confused }}</li>
<li><b>Overused Tools:</b> {{ review.overused_tools }}</li>
<li><b>Notes:</b> {{ review.notes }}</li>
</ul>

<h2>Top Churned Files</h2>
<ol>
{% for f in top_churned %}
<li>{{ f.path }} (+{{ f.written }}, WA: {{ f.wa }})</li>
{% endfor %}
</ol>

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

<h2>Suspicious Patterns & Loop Detection</h2>
{% for pattern in suspicious_patterns %}
<h3>[{{ pattern.severity | upper }}] {{ pattern.title }}</h3>
<ul>
<li><b>Evidence:</b> {{ pattern.evidence }}</li>
<li><b>Related:</b> {{ pattern.related_files_events | join(', ') }}</li>
<li><b>Why it matters:</b> {{ pattern.why_it_matters }}</li>
</ul>
{% else %}
<p>No suspicious patterns detected.</p>
{% endfor %}

<h2>Compaction Observable Behavior</h2>
{% for comp in compaction_analytics %}
<h3>Compaction at {{ comp.time }}</h3>
<ul>
<li><b>Files touched before:</b> {{ comp.files_before | join(', ') if comp.files_before else 'None' }}</li>
<li><b>Events after:</b> {{ comp.events_after }}</li>
<li><b>Repeated files after:</b> {{ comp.repeated_files_after | join(', ') if comp.repeated_files_after else 'None' }}</li>
<li><b>Recreated files after:</b> {{ comp.recreated_files_after | join(', ') if comp.recreated_files_after else 'None' }}</li>
<li><b>Repeated markers after:</b> {{ comp.repeated_markers_after | join(', ') if comp.repeated_markers_after else 'None' }}</li>
<li><b>Churn Before:</b> +{{ comp.churn_before.written }} / -{{ comp.churn_before.deleted }}</li>
<li><b>Churn After:</b> +{{ comp.churn_after.written }} / -{{ comp.churn_after.deleted }}</li>
</ul>
{% else %}
<p>No compactions detected.</p>
{% endfor %}

<h2>Timeline</h2>
<ul>
{% for event in timeline %}
<li><code>{{ event.time }}</code> <b>{{ event.type }}</b> {{ event.path }} {{ event.delta }}</li>
{% endfor %}
</ul>

<h2>LLM Analysis Prompt</h2>
<pre><code>{{ analysis_prompt }}</code></pre>
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
                "git_available": git_available,
                "git_added": git_added,
                "git_deleted": git_deleted
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
            "compaction_analytics": [
                {
                    "timestamp": c.timestamp.isoformat() + "Z",
                    "files_before": c.files_before,
                    "events_after": c.events_after,
                    "repeated_files_after": c.repeated_files_after,
                    "recreated_files_after": c.recreated_files_after,
                    "repeated_markers_after": c.repeated_markers_after,
                    "churn_before": c.churn_before,
                    "churn_after": c.churn_after
                } for c in compaction_analytics
            ],
            "suspicious_patterns": [
                {
                    "title": p.title,
                    "severity": p.severity,
                    "evidence": p.evidence,
                    "related_files_events": p.related_files_events,
                    "why_it_matters": p.why_it_matters
                } for p in suspicious_patterns
            ],
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
