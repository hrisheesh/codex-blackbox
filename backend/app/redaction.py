import re

# Basic regex patterns for MVP redaction
REDACTION_PATTERNS = [
    # Generic API Keys (e.g. sk-...)
    (re.compile(r'sk-[A-Za-z0-9]{32,}'), '<REDACTED_API_KEY>'),
    # Bearer tokens
    (re.compile(r'Bearer\s+[A-Za-z0-9\-\._~+/]+=*'), 'Bearer <REDACTED_TOKEN>'),
    # Generic password in URIs
    (re.compile(r'(?<=://)[^:]+:[^@]+(?=@)'), '<REDACTED_USER>:<REDACTED_PASSWORD>'),
]

def redact_text(text: str) -> str:
    if not text:
        return text
    redacted = text
    for pattern, replacement in REDACTION_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted

def redact_dict(data: dict) -> dict:
    if not isinstance(data, dict):
        return data
        
    redacted_data = {}
    for k, v in data.items():
        if isinstance(v, str):
            redacted_data[k] = redact_text(v)
        elif isinstance(v, dict):
            redacted_data[k] = redact_dict(v)
        elif isinstance(v, list):
            redacted_data[k] = [redact_text(item) if isinstance(item, str) else (redact_dict(item) if isinstance(item, dict) else item) for item in v]
        else:
            redacted_data[k] = v
            
    return redacted_data
