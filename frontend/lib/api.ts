const API_BASE = "http://localhost:8000/api";

export async function startSession(projectPath: string, codexLogPath?: string, sessionName?: string, promptNote?: string) {
  const res = await fetch(`${API_BASE}/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_path: projectPath,
      codex_log_path: codexLogPath,
      session_name: sessionName,
      prompt_note: promptNote
    })
  });
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function stopSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to stop session");
  return res.json();
}

export async function addReview(sessionId: string, review: any) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(review)
  });
  if (!res.ok) throw new Error("Failed to add review");
  return res.json();
}

export async function addPromptNote(sessionId: string, text: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error("Failed to add prompt note");
  return res.json();
}

export async function exportSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/export`, {
    method: "GET",
  });
  if (!res.ok) throw new Error("Failed to export session");
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit_bundle_${sessionId}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function generateReport(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/report`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate report");
  return res.json();
}

export async function getLiveMetrics(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to get live metrics");
  return res.json();
}

export async function listSessions() {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) return [];
  return res.json();
}

export async function compareSessions(s1: string, s2: string) {
  const res = await fetch(`${API_BASE}/compare?s1=${s1}&s2=${s2}`);
  if (!res.ok) throw new Error("Failed to fetch comparison");
  return res.json();
}

export async function exportComparison(s1: string, s2: string) {
  const res = await fetch(`${API_BASE}/compare/export?s1=${s1}&s2=${s2}`);
  if (!res.ok) throw new Error("Failed to export comparison");
  
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `comparison_${s1}_${s2}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
