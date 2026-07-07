"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getLiveMetrics, stopSession, addReview, generateReport, addPromptNote, exportSession } from "@/lib/api";
import { MetricWidget } from "@/components/dashboard/MetricWidget";
import { TimelinePanel } from "@/components/dashboard/TimelinePanel";
import { AnalysisSection } from "@/components/dashboard/AnalysisSection";
import { ReviewModal } from "@/components/dashboard/ReviewModal";
import { Activity, Clock, FileCode2, Files, RefreshCw, Square, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState<string | null>(null);
  
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
  const [isAddingNote, setIsAddingNote] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    getLiveMetrics(sessionId).then(data => {
      if (data.error === "not_found") {
        setError("not_found");
        return;
      }
      setMetrics(data);
      setStatus(data.status);
    }).catch(err => {
      console.error(err);
      setError("unknown_error");
    });

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

  const handleExport = async () => {
    if (!sessionId) return;
    try {
      await exportSession(sessionId);
    } catch (err) {
      console.error(err);
      alert("Failed to export session.");
    }
  };

  const handleAddNote = async (note: string) => {
    if (!sessionId) return;
    setIsAddingNote(true);
    try {
      await addPromptNote(sessionId, note);
    } finally {
      setIsAddingNote(false);
    }
  };

  if (!sessionId) return <div className="flex h-[80vh] items-center justify-center text-muted-foreground">No session ID provided.</div>;
  
  if (error === "not_found") {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center text-center space-y-6 max-w-md mx-auto">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Session Not Found</h2>
          <p className="text-muted-foreground">The session ID "{sessionId}" does not exist in the database or has been deleted.</p>
        </div>
        <Button onClick={() => router.push("/")} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          Return Home
        </Button>
      </div>
    );
  }

  if (error) return <div className="flex h-[80vh] items-center justify-center text-destructive">An error occurred loading the session.</div>;
  if (!metrics) return <div className="flex h-[80vh] items-center justify-center text-muted-foreground">Loading session data...</div>;

  const getStatusColor = () => status === "recording" ? "bg-emerald-500" : "bg-slate-500";

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1600px]">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{sessionId}</h1>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-white ${getStatusColor()}`}>
              {status}
            </span>
          </div>
          <p className="text-muted-foreground font-mono text-sm">{metrics.project_path}</p>
        </div>
        <div className="flex items-center gap-3">
          {status === "recording" && (
            <Button onClick={handleStop} variant="destructive" className="shadow-lg shadow-rose-500/20">
              <Square className="w-4 h-4 mr-2" fill="currentColor" /> Stop Recording
            </Button>
          )}
          {status === "stopped" && !reportGenerated && (
            <Button onClick={() => setShowReview(true)} variant="secondary" className="shadow-lg">
              Review Session
            </Button>
          )}
          {status === "stopped" && reportGenerated && (
            <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
              <Download className="w-4 h-4 mr-2" /> Export Audit Bundle
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Main Content Area */}
        <div className="xl:col-span-3 space-y-8">
          
          {/* Top Level Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricWidget 
              title="Duration" 
              value={`${Math.floor(metrics.duration / 60)}m ${metrics.duration % 60}s`} 
              icon={<Clock />} 
              delay={0.1} 
            />
            <MetricWidget 
              title="Files Touched" 
              value={metrics.files_touched} 
              icon={<Files />} 
              delay={0.2} 
            />
            <MetricWidget 
              title="Write Amplification" 
              value={`${metrics.write_amplification.toFixed(1)}x`} 
              icon={<RefreshCw />} 
              description="Lines written vs final file size"
              delay={0.3} 
              trend={metrics.write_amplification > 2 ? "up" : "neutral"}
            />
            <MetricWidget 
              title="Net Code" 
              value={`+${metrics.total_lines_written} / -${metrics.total_lines_deleted}`} 
              icon={<FileCode2 />} 
              delay={0.4} 
            />
          </div>

          {/* Top Churned Files */}
          <div className="glass-card rounded-xl border border-border/40 overflow-hidden mt-8">
            <div className="p-5 border-b border-border/30 bg-white/5">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Top Churned Files
              </h3>
            </div>
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-black/20 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">File Path</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-center">Rewrites</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Written</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">WA</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.top_churned_files?.map((f: any, i: number) => (
                    <tr key={i} className="border-b border-border/10 hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-muted-foreground truncate max-w-[300px]" title={f.path}>{f.path}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-primary/20 text-primary-foreground px-2 py-1 rounded text-xs font-bold">{f.rewritten}</span>
                      </td>
                      <td className="px-6 py-4 text-emerald-500 font-medium text-right">+{f.written}</td>
                      <td className={`px-6 py-4 font-bold text-right ${f.wa > 2 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {f.wa}x
                      </td>
                    </tr>
                  ))}
                  {!metrics.top_churned_files?.length && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground italic">No file churn recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnalysisSection metrics={metrics} />
          
        </div>

        {/* Sidebar / Timeline Area */}
        <div className="xl:col-span-1">
          <TimelinePanel 
            timeline={metrics.timeline} 
            status={status} 
            onAddNote={handleAddNote} 
            isAddingNote={isAddingNote} 
          />
        </div>
      </div>

      <ReviewModal 
        show={showReview} 
        setShow={setShowReview} 
        review={review} 
        setReview={setReview} 
        onSave={handleSaveReview} 
      />
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex h-[80vh] items-center justify-center">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
