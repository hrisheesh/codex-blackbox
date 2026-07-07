import re

# Basic regex patterns for MVP redaction
REDACTION_PATTERNS = [
    # Generic API Keys (e.g. sk-...)
    (re.compile(r'\bsk-[a-zA-Z0-9]{20,}\b'), '<REDACTED_API_KEY>'),
    # Bearer tokens and JWTs
    (re.compile(r'(?i)Bearer\s+[A-Za-z0-9\-\._~+/]+=*'), 'Bearer <REDACTED_TOKEN>'),
    (re.compile(r'eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+'), '<REDACTED_JWT>'),
    # Generic password in URIs
    (re.compile(r'(?<=://)[^:]+:[^@]+(?=@)'), '<REDACTED_USER>:<REDACTED_PASSWORD>'),
    # Private Keys
    (re.compile(r'-----BEGIN.*?PRIVATE KEY-----.*?-----END.*?PRIVATE KEY-----', re.DOTALL), '<REDACTED_PRIVATE_KEY>'),
    # Certificates
    (re.compile(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----', re.DOTALL), '<REDACTED_CERTIFICATE>'),
    # .env values (secrets)
    (re.compile(r'(?i)\b(API_KEY|TOKEN|SECRET|PASSWORD|PASSWD|KEY|AUTH)\s*=\s*([^\n\r]+)'), r'\1=<REDACTED_SECRET>'),
    # Provisioning Profile / XML secrets
    (re.compile(r'<key>ProvisionedDevices</key>\s*<array>.*?</array>', re.DOTALL), '<key>ProvisionedDevices</key>\n<array>\n\t<string><REDACTED_DEVICE></string>\n</array>'),
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
