"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getLiveMetrics, stopSession, addReview, generateReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Clock, FileCode2, Files, RefreshCw, Square, Download, ListTree, BarChart2, FileText, FilePlus, FileMinus, FileEdit } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState("loading");
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState({ 
    quality_score: 5, 
    followed_instruction: "unknown",
    code_worked: "unknown",
    seemed_confused: "unknown",
    overused_tools: "unknown",
    notes: "" 
  });
  const [reportGenerated, setReportGenerated] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    getLiveMetrics(sessionId).then(data => {
      setMetrics(data);
      setStatus(data.status);
    }).catch(console.error);

    // WebSocket connection
    const ws = new WebSocket(`ws://localhost:8000/ws/sessions/${sessionId}`);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "metrics_updated") {
        setMetrics(msg.data);
        setStatus(msg.data.status);
      } else if (msg.type === "session_stopped") {
        setStatus("stopped");
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const handleStop = async () => {
    if (!sessionId) return;
    await stopSession(sessionId);
    setShowReview(true);
  };

  const handleSaveReview = async () => {
    if (!sessionId) return;
    await addReview(sessionId, review);
    await generateReport(sessionId);
    setShowReview(false);
    setReportGenerated(true);
  };

  if (!sessionId) return <div className="flex h-screen items-center justify-center font-mono text-slate-500">No session ID provided.</div>;
  if (!metrics) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Activity className="h-8 w-8 text-blue-500 animate-bounce" />
        <p className="text-slate-500 font-medium">Loading session telemetry...</p>
      </div>
    </div>
  );

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6 lg:p-10 font-sans selection:bg-blue-100">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200/60">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl ${status === "recording" ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
                <Activity className={`w-6 h-6 ${status === "recording" ? "animate-pulse" : ""}`} />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session Observability</h1>
            </div>
            <div className="flex items-center gap-3 ml-1">
              <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border shadow-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status === "recording" ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                {status === "recording" ? "Live Recording" : "Session Stopped"}
              </span>
              <span className="text-sm font-mono text-slate-400">{sessionId}</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            {status === "recording" ? (
              <Button onClick={handleStop} variant="destructive" className="shadow-lg shadow-red-500/20 rounded-full px-6 transition-transform hover:scale-105 active:scale-95">
                <Square className="h-4 w-4 mr-2" fill="currentColor" /> Stop Session
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                {!reportGenerated && (
                  <Button onClick={() => setShowReview(true)} variant="outline" className="rounded-full shadow-sm">
                    Complete Audit Review
                  </Button>
                )}
                {reportGenerated && (
                  <Button className="bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg shadow-blue-500/20" onClick={() => alert('Reports are in the sessions directory.')}>
                    <Download className="mr-2 h-4 w-4" /> Download Report
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-80" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</p>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{formatDuration(metrics.duration_seconds)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-2xl text-blue-500 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-violet-500 opacity-80" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Files Touched</p>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{metrics.files_touched}</p>
                </div>
                <div className="p-3 bg-violet-50 rounded-2xl text-violet-500 group-hover:scale-110 transition-transform">
                  <Files className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-sm font-medium">
                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md"><FilePlus className="w-3 h-3"/> {metrics.files_created} created</span>
                <span className="flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md"><FileMinus className="w-3 h-3"/> {metrics.files_deleted} deleted</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-80" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Code Volatility</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-emerald-600 tracking-tight">+{metrics.total_lines_written}</span>
                    <span className="text-xl font-semibold text-rose-500">-{metrics.total_lines_deleted}</span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                  <FileCode2 className="w-5 h-5" />
                </div>
              </div>
              <p className="mt-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Total Lines Mutated</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 bg-white/60 backdrop-blur-xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 opacity-80" />
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Write Amplification</p>
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{metrics.write_amplification.toFixed(2)}x</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-2xl text-amber-500 group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full" 
                  style={{ width: `${Math.min((metrics.write_amplification / 5) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main Content Area */}
          <div className="xl:col-span-2 space-y-8">
            
            {/* Visual Charts */}
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 overflow-hidden bg-white">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                      <BarChart2 className="w-5 h-5 text-indigo-500" /> Top Churned Files
                    </CardTitle>
                    <CardDescription className="mt-1">Volume of lines written vs deleted across files</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[320px] w-full">
                  {metrics.file_churns.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={metrics.file_churns.sort((a:any, b:any) => b.total_lines_written - a.total_lines_written).slice(0, 10).map((f:any) => ({
                          name: f.path.split('/').pop(),
                          Written: f.total_lines_written,
                          Deleted: f.total_lines_deleted
                        }))}
                        margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                        barSize={32}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} dy={10} />
                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Legend wrapperStyle={{paddingTop: '20px'}} iconType="circle" />
                        <Bar dataKey="Written" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                        <Bar dataKey="Deleted" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      No churn data available yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* List of Files instead of dense table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Active Files</h2>
                <span className="text-sm font-medium text-slate-500">{metrics.file_churns.length} files tracked</span>
              </div>
              
              {metrics.file_churns.length === 0 ? (
                <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 bg-white">
                  <FileEdit className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Waiting for file modifications...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {metrics.file_churns.sort((a:any, b:any) => b.total_lines_written - a.total_lines_written).map((file: any) => (
                    <div key={file.path} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-blue-100 hover:shadow-md transition-all group gap-4">
                      
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-mono text-sm text-slate-700 font-semibold mb-1 truncate max-w-[250px] sm:max-w-[400px]" title={file.path}>
                            {file.path}
                          </p>
                          <div className="flex gap-2">
                            {file.created && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-md">Created</span>}
                            {file.deleted && <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider rounded-md">Deleted</span>}
                            {file.recreated_count > 0 && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-md">Recreated ×{file.recreated_count}</span>}
                            {file.rewrite_count > 0 && <span className="px-2 py-0.5 bg-violet-50 text-violet-700 text-[10px] font-bold uppercase tracking-wider rounded-md">Rewrite ×{file.rewrite_count}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-6 sm:gap-8 ml-12 sm:ml-0">
                        <div className="text-center sm:text-right">
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Mods</p>
                          <p className="text-sm font-medium text-slate-700">{file.modify_count}</p>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Current</p>
                          <p className="text-sm font-medium text-slate-700">{file.current_lines}</p>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Churn</p>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="text-emerald-600">+{file.total_lines_written}</span>
                            <span className="text-rose-500">-{file.total_lines_deleted}</span>
                          </div>
                        </div>
                        <div className="text-center sm:text-right">
                          <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">WA</p>
                          <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md min-w-[3rem]">
                            {file.write_amplification.toFixed(1)}x
                          </span>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timeline Sidebar */}
          <div className="xl:col-span-1">
            <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 bg-white sticky top-6">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <ListTree className="w-5 h-5 text-slate-500" /> Event Stream
                </CardTitle>
                <CardDescription>Real-time operational logs</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[800px] overflow-y-auto p-6 space-y-5 custom-scrollbar">
                  {metrics.timeline && metrics.timeline.map((event: any, index: number) => {
                    // Determine event color
                    let dotColor = "bg-slate-300";
                    if (event.type === "file_created") dotColor = "bg-emerald-500";
                    else if (event.type === "file_deleted") dotColor = "bg-rose-500";
                    else if (event.type === "file_modified") dotColor = "bg-blue-500";
                    else if (event.type.includes("started") || event.type.includes("stopped")) dotColor = "bg-violet-500";

                    return (
                      <div key={index} className="flex gap-4 group">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mt-1.5 ring-4 ring-white group-hover:scale-125 transition-transform z-10`} />
                          {index !== metrics.timeline.length - 1 && <div className="w-[2px] h-full bg-slate-100 my-1 -z-0" />}
                        </div>
                        <div className="pb-1 w-full">
                          <div className="flex justify-between items-start mb-0.5">
                            <p className="font-semibold text-sm text-slate-700">{event.type}</p>
                            <p className="text-slate-400 text-[11px] font-mono whitespace-nowrap ml-2">
                              {new Date(event.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                            </p>
                          </div>
                          <p className="text-slate-500 text-sm break-words leading-snug">
                            {event.detail}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  {(!metrics.timeline || metrics.timeline.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <Clock className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">Listening for events...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="sm:max-w-[500px] border-0 shadow-2xl rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
          <DialogHeader className="pt-4">
            <DialogTitle className="text-2xl font-bold text-slate-800">Audit Session Review</DialogTitle>
            <DialogDescription className="text-base text-slate-500 mt-2">
              Log qualitative feedback on the agent's performance. Why did it waste tokens or rewrite files?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label htmlFor="quality" className="text-sm font-semibold text-slate-700">Code Quality Score</Label>
                <span className="text-sm font-bold text-blue-600">{review.quality_score} / 10</span>
              </div>
              <input 
                id="quality" 
                type="range" 
                min="1" max="10" 
                value={review.quality_score}
                onChange={(e) => setReview({...review, quality_score: parseInt(e.target.value)})}
                className="w-full accent-blue-600 cursor-pointer" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Followed Instructions</Label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  value={review.followed_instruction}
                  onChange={(e) => setReview({...review, followed_instruction: e.target.value})}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Code Worked</Label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  value={review.code_worked}
                  onChange={(e) => setReview({...review, code_worked: e.target.value})}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Seemed Confused</Label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  value={review.seemed_confused}
                  onChange={(e) => setReview({...review, seemed_confused: e.target.value})}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overused Tools</Label>
                <select 
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  value={review.overused_tools}
                  onChange={(e) => setReview({...review, overused_tools: e.target.value})}
                >
                  <option value="unknown">Unknown</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="notes" className="text-sm font-semibold text-slate-700">Audit Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="e.g. Agent got stuck in a loop trying to parse the JSON file, rewrote the parser 4 times..." 
                value={review.notes}
                onChange={(e) => setReview({...review, notes: e.target.value})}
                className="resize-none h-32 focus-visible:ring-blue-500 rounded-xl" 
              />
            </div>
          </div>
          <DialogFooter className="sm:justify-between border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={() => setShowReview(false)} className="text-slate-500">Cancel</Button>
            <Button onClick={handleSaveReview} className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6">Save Audit & Generate Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Custom styles for scrollbar in timeline */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e2e8f0;
          border-radius: 20px;
        }
      `}} />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Activity className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
