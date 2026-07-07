"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startSession, listSessions } from "@/lib/api";
import { Activity, Play, History, ArrowRight } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [projectPath, setProjectPath] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [codexLogPath, setCodexLogPath] = useState("~/.codex");
  const [promptNote, setPromptNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  useEffect(() => {
    listSessions().then(setRecentSessions).catch(console.error);
  }, []);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectPath) return;
    setIsLoading(true);
    try {
      const { session_id } = await startSession(projectPath, codexLogPath, sessionName, promptNote);
      router.push(`/dashboard?session_id=${session_id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to start session. Is the backend running?");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      
      {/* Left Pane: Start Session */}
      <div className="w-1/2 flex flex-col p-8 border-r border-hairline-soft bg-surface-soft/20 overflow-y-auto custom-scrollbar">
        <div className="max-w-[500px] w-full mx-auto my-auto">
          <div className="mb-8">
            <h1 className="heading-lg text-ink mb-2">New Session</h1>
            <p className="body-md text-steel">Configure your workspace to begin tracking the agent's activity.</p>
          </div>
          
          <form onSubmit={handleStart} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="projectPath" className="caption-bold text-steel">PROJECT FOLDER PATH *</label>
              <input 
                id="projectPath" 
                placeholder="/Users/name/projects/my-app" 
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                required
                className="text-input w-full h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="sessionName" className="caption-bold text-steel">SESSION NAME</label>
                <input 
                  id="sessionName" 
                  placeholder="e.g. Dark mode" 
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="text-input w-full h-11"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="codexLogPath" className="caption-bold text-steel">LOG PATH</label>
                <input 
                  id="codexLogPath" 
                  placeholder="~/.codex" 
                  value={codexLogPath}
                  onChange={(e) => setCodexLogPath(e.target.value)}
                  className="text-input w-full h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="promptNote" className="caption-bold text-steel">INITIAL PROMPT</label>
              <input 
                id="promptNote" 
                placeholder="What are you asking the agent to do?" 
                value={promptNote}
                onChange={(e) => setPromptNote(e.target.value)}
                className="text-input w-full h-11"
              />
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={isLoading} 
                className="btn-primary w-full group py-3"
              >
                <Play className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" fill="currentColor" />
                {isLoading ? "Starting..." : "Start Recording"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Pane: Recent Sessions */}
      <div className="w-1/2 flex flex-col p-8 overflow-y-auto custom-scrollbar">
        <div className="max-w-[600px] w-full mx-auto">
          <div className="flex items-center justify-between mb-6 border-b border-hairline-soft pb-4">
            <h2 className="heading-sm text-ink flex items-center gap-2">
              <History className="w-4 h-4 text-steel" />
              Recent Sessions
            </h2>
            <button 
              onClick={() => router.push('/compare')}
              className="btn-secondary text-[12px] px-3 py-1"
            >
              Compare <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {recentSessions.length === 0 ? (
              <div className="py-12 text-center rounded-[12px] bg-surface-soft border border-hairline-soft border-dashed">
                <p className="body-sm text-steel">No sessions recorded yet.</p>
              </div>
            ) : (
              recentSessions.map((s, i) => (
                <div 
                  key={i} 
                  onClick={() => router.push(`/dashboard?session_id=${s.id}`)}
                  className="card-base !p-4 cursor-pointer hover:border-white/30 hover:bg-surface-hover transition-all duration-300 group flex items-center justify-between"
                >
                  <div className="min-w-0 pr-4">
                    <h3 className="card-title text-ink truncate mb-0.5">{s.name || s.id}</h3>
                    <p className="caption text-steel font-mono truncate">
                      {s.project_path ? s.project_path.split('/').pop() : 'Unknown project'}
                    </p>
                  </div>
                  
                  <div className="flex gap-3 shrink-0 items-center">
                    {s.status === "recording" ? (
                      <span className="flex items-center gap-1.5 caption-bold text-[#32d74b]">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#32d74b] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#32d74b]"></span>
                        </span>
                        Live
                      </span>
                    ) : (
                      <span className="caption text-steel">Done</span>
                    )}
                    {s.quality_score && (
                      <span className="caption-bold text-ink bg-surface px-2 py-0.5 rounded border border-hairline-soft">
                        ★ {s.quality_score}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
