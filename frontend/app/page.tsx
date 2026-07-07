"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startSession, listSessions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Folder, Play, CheckSquare, Square, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const router = useRouter();
  const [projectPath, setProjectPath] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [codexLogPath, setCodexLogPath] = useState("~/.codex");
  const [promptNote, setPromptNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);

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

  const toggleSession = (id: string) => {
    if (selectedSessions.includes(id)) {
      setSelectedSessions(selectedSessions.filter(s => s !== id));
    } else {
      if (selectedSessions.length < 2) {
        setSelectedSessions([...selectedSessions, id]);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-[1200px] flex gap-12 flex-col lg:flex-row">
      
      {/* Main Start Form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1"
      >
        <div className="glass-card rounded-2xl border border-border/40 overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-chart-4 to-chart-2" />
          <div className="p-8 pb-6 border-b border-white/5 bg-white/5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              Start Session
            </h1>
            <p className="text-muted-foreground mt-2 text-sm ml-13">
              Configure your environment to begin real-time agent observability.
            </p>
          </div>
          
          <div className="p-8">
            <form onSubmit={handleStart} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="projectPath" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Folder Path *</Label>
                <div className="flex gap-3">
                  <div className="h-12 w-12 shrink-0 bg-white/5 flex items-center justify-center rounded-lg border border-border/50">
                    <Folder className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Input 
                    id="projectPath" 
                    placeholder="/Users/name/projects/my-app" 
                    value={projectPath}
                    onChange={(e) => setProjectPath(e.target.value)}
                    required
                    className="h-12 text-base bg-black/20 border-border/50 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Name (Optional)</Label>
                  <Input 
                    id="sessionName" 
                    placeholder="e.g. Add dark mode" 
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    className="h-12 bg-black/20 border-border/50 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codexLogPath" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent Log Path (Optional)</Label>
                  <Input 
                    id="codexLogPath" 
                    placeholder="~/.codex" 
                    value={codexLogPath}
                    onChange={(e) => setCodexLogPath(e.target.value)}
                    className="h-12 bg-black/20 border-border/50 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promptNote" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Initial Prompt Note (Optional)</Label>
                <Input 
                  id="promptNote" 
                  placeholder="What are you asking the agent to do?" 
                  value={promptNote}
                  onChange={(e) => setPromptNote(e.target.value)}
                  className="h-12 bg-black/20 border-border/50 focus:ring-primary/50"
                />
              </div>

              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all"
                >
                  <Play className="mr-2 h-5 w-5" fill="currentColor" />
                  {isLoading ? "Starting..." : "Start Recording"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>

      {/* Sidebar - Recent Sessions */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full lg:w-80 flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Recent Sessions</h3>
          {selectedSessions.length === 2 && (
            <Button 
              size="sm" 
              onClick={() => router.push(`/compare?s1=${selectedSessions[0]}&s2=${selectedSessions[1]}`)}
              className="h-8 bg-chart-4 hover:bg-chart-4/80 text-white text-xs"
            >
              Compare <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 max-h-[600px]">
          {recentSessions.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground bg-white/5 rounded-xl border border-white/5 text-sm">
              No sessions recorded yet.
            </div>
          ) : (
            recentSessions.map((s, i) => {
              const isSelected = selectedSessions.includes(s.id);
              const isSelectable = selectedSessions.length < 2 || isSelected;

              return (
                <div key={i} className={`group flex flex-col glass-card rounded-xl border transition-all ${isSelected ? 'border-chart-4 bg-chart-4/5' : 'border-border/30 hover:border-white/20'}`}>
                  <div className="p-4 flex items-start gap-3">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleSession(s.id); }}
                      disabled={!isSelectable}
                      className={`mt-1 shrink-0 transition-colors ${isSelected ? 'text-chart-4' : 'text-muted-foreground group-hover:text-foreground'} ${!isSelectable && 'opacity-50 cursor-not-allowed'}`}
                    >
                      {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => router.push(`/dashboard?session_id=${s.id}`)}
                    >
                      <p className="font-semibold text-sm text-foreground truncate">{s.name || s.id}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.project_path ? s.project_path.split('/').pop() : 'Unknown Project'}</p>
                      <div className="flex gap-2 mt-2">
                        {s.status === "recording" && (
                          <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Recording</span>
                        )}
                        {s.quality_score && (
                          <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">Score: {s.quality_score}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

    </div>
  );
}
