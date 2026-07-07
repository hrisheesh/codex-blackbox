"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startSession, listSessions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Activity, Folder, Play } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="md:col-span-2">
          <Card className="shadow-lg border-slate-200">
            <CardHeader className="bg-slate-900 text-white rounded-t-xl">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Activity className="h-6 w-6 text-emerald-400" />
                codex-blackbox
              </CardTitle>
              <CardDescription className="text-slate-300">
                Local real-time observability for AI coding agents
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleStart} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="projectPath">Project Folder Path *</Label>
                  <div className="flex gap-2">
                    <Folder className="h-10 w-10 p-2 bg-slate-100 text-slate-500 rounded-md border border-slate-200" />
                    <Input 
                      id="projectPath" 
                      placeholder="/Users/name/projects/my-app" 
                      value={projectPath}
                      onChange={(e) => setProjectPath(e.target.value)}
                      required
                      className="h-10 text-base"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sessionName">Session Name (Optional)</Label>
                    <Input 
                      id="sessionName" 
                      placeholder="e.g. Add dark mode" 
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codexLogPath">Agent Log Path (Optional)</Label>
                    <Input 
                      id="codexLogPath" 
                      placeholder="~/.codex" 
                      value={codexLogPath}
                      onChange={(e) => setCodexLogPath(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="promptNote">Initial Prompt Note (Optional)</Label>
                  <Input 
                    id="promptNote" 
                    placeholder="What are you asking the agent to do?" 
                    value={promptNote}
                    onChange={(e) => setPromptNote(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-lg">
                  {isLoading ? "Starting..." : (
                    <>
                      <Play className="mr-2 h-5 w-5" /> Start Recording
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <p className="text-sm text-slate-500">No recent sessions found.</p>
              ) : (
                <div className="space-y-3">
                  {recentSessions.slice(0, 8).map((s: any) => {
                    const isSelected = selectedSessions.includes(s.id);
                    return (
                      <div key={s.id} className={`p-3 bg-slate-50 rounded border ${isSelected ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:border-emerald-300'} cursor-pointer transition-colors flex items-center gap-3`}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSessions(prev => prev.filter(id => id !== s.id));
                          } else {
                            if (selectedSessions.length < 2) {
                              setSelectedSessions(prev => [...prev, s.id]);
                            } else {
                              // Replace the second one
                              setSelectedSessions([selectedSessions[0], s.id]);
                            }
                          }
                        }}>
                        <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <p className="text-sm font-medium font-mono text-slate-700 truncate">{s.id}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            {selectedSessions.length > 0 && (
              <CardFooter className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={selectedSessions.length !== 1}
                  onClick={() => router.push(`/dashboard?session_id=${selectedSessions[0]}`)}
                >
                  Open Session
                </Button>
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={selectedSessions.length !== 2}
                  onClick={() => router.push(`/compare?s1=${selectedSessions[0]}&s2=${selectedSessions[1]}`)}
                >
                  Compare ({selectedSessions.length}/2)
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
