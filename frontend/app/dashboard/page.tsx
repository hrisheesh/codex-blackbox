"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getLiveMetrics, stopSession, addPromptNote, exportSession } from "@/lib/api";
import { Clock, Code, FileText, Download, StopCircle, ArrowLeft, Star, Edit3, Activity } from "lucide-react";
import Link from "next/link";
import { MetricWidget } from "@/components/dashboard/MetricWidget";
import { TimelinePanel } from "@/components/dashboard/TimelinePanel";
import { AnalysisSection } from "@/components/dashboard/AnalysisSection";
import { ReviewModal } from "@/components/dashboard/ReviewModal";

export default function Dashboard() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [promptNote, setPromptNote] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    const fetchMetrics = async () => {
      try {
        const data = await getLiveMetrics(sessionId);
        setMetrics(data);
        if (data.status === "recording") {
          setTimeout(fetchMetrics, 3000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [sessionId]);

  const handleStop = async () => {
    if (!sessionId) return;
    if (confirm("Stop recording and finalize session?")) {
      await stopSession(sessionId);
      setShowReview(true);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !promptNote) return;
    try {
      await addPromptNote(sessionId, promptNote);
      setPromptNote("");
    } catch (e) {
      console.error(e);
      alert("Failed to add note");
    }
  };

  const handleExport = async () => {
    if (!sessionId) return;
    try {
      await exportSession(sessionId);
    } catch (err) {
      console.error(err);
      alert("Failed to export bundle");
    }
  };

  if (!sessionId) return <div className="flex items-center justify-center h-full text-ink body-md">No session ID provided.</div>;
  if (loading) return <div className="flex items-center justify-center h-full text-steel body-md animate-pulse">Loading live metrics...</div>;
  if (!metrics) return <div className="flex items-center justify-center h-full text-danger-text body-md">Failed to load metrics.</div>;

  return (
    <div className="flex flex-col h-full w-full p-4 gap-4 overflow-hidden">
      
      {/* Top Navigation & Actions Bar (Fixed Height) */}
      <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-center px-4 py-3 bg-surface-soft backdrop-blur-md rounded-[16px] border border-hairline-soft">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-steel hover:text-ink transition-colors flex items-center justify-center w-8 h-8 rounded-full bg-surface hover:bg-surface-hover">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="heading-sm text-ink font-mono tracking-tight">{sessionId}</h1>
            {metrics.status === "recording" ? (
              <span className="flex items-center gap-1.5 caption-bold text-[#32d74b] bg-[#32d74b]/10 px-2 py-0.5 rounded border border-[#32d74b]/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#32d74b] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#32d74b]"></span>
                </span>
                Live
              </span>
            ) : (
              <span className="caption-bold text-steel bg-surface px-2 py-0.5 rounded border border-hairline-soft">Completed</span>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4 md:mt-0">
          {metrics.status === "recording" ? (
            <button onClick={handleStop} className="btn-primary h-8 px-4 py-0 text-[13px] bg-white text-black hover:bg-white/90">
              <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Stop
            </button>
          ) : (
            <>
              <button onClick={() => setShowReview(true)} className="btn-secondary h-8 px-3 py-0 text-[13px]">
                <Star className="w-3.5 h-3.5 mr-1.5" /> Rate
              </button>
              <button onClick={handleExport} className="btn-primary h-8 px-3 py-0 text-[13px]">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Row (Fixed Height) */}
      <div className="flex-none grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricWidget 
          title="Duration" 
          value={`${metrics.duration_seconds}s`}
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricWidget 
          title="Net Code Change" 
          value={`${metrics.total_lines_written > 0 ? '+' : ''}${metrics.total_lines_written - metrics.total_lines_deleted}`}
          description={`+${metrics.total_lines_written} / -${metrics.total_lines_deleted}`}
          icon={<Code className="w-4 h-4" />}
          trend={metrics.total_lines_written > metrics.total_lines_deleted ? "up" : "down"}
        />
        <MetricWidget 
          title="Files Touched" 
          value={metrics.files_touched}
          description={`Write Amp: ${(metrics.write_amplification || 0).toFixed(1)}x`}
          icon={<FileText className="w-4 h-4" />}
        />
        {metrics.quality_score !== null ? (
          <MetricWidget 
            title="Quality Score" 
            value={`${metrics.quality_score}/10`}
            icon={<Star className="w-4 h-4" />}
          />
        ) : (
          <MetricWidget 
            title="Total Events" 
            value={metrics.file_events_count}
            icon={<Activity className="w-4 h-4" />}
          />
        )}
      </div>

      {/* 3-Column Bottom Area (Fills remaining height) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        
        {/* Column 1: Churn (Scrollable) */}
        <div className="lg:col-span-4 flex flex-col bg-surface-soft backdrop-blur-md rounded-[16px] border border-hairline-soft overflow-hidden">
          <div className="flex-none p-4 border-b border-hairline-soft bg-surface/30">
            <h3 className="caption-bold text-steel">TOP CHURNED FILES</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {!metrics.file_churns || metrics.file_churns.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center border-dashed border border-hairline-soft rounded-lg">
                <p className="body-sm text-steel">No files modified yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...metrics.file_churns]
                  .sort((a: any, b: any) => b.modify_count - a.modify_count)
                  .map((fc: any, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-hover transition-colors border border-transparent hover:border-hairline-soft">
                      <div className="min-w-0 pr-2 flex-1">
                        <p className="caption font-mono text-ink truncate" title={fc.path}>
                          {fc.path.split('/').pop()}
                        </p>
                      </div>
                      <div className="shrink-0 bg-surface px-2 py-0.5 rounded text-[12px] font-mono text-ink border border-hairline">
                        {fc.modify_count}
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Diagnostics (Scrollable) */}
        <div className="lg:col-span-4 flex flex-col bg-surface-soft backdrop-blur-md rounded-[16px] border border-hairline-soft overflow-hidden">
          <div className="flex-none p-4 border-b border-hairline-soft bg-surface/30">
            <h3 className="caption-bold text-steel">DIAGNOSTICS & ANOMALIES</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            <AnalysisSection metrics={metrics} />
          </div>
        </div>

        {/* Column 3: Timeline (Scrollable) */}
        <div className="lg:col-span-4 flex flex-col bg-surface-soft backdrop-blur-md rounded-[16px] border border-hairline-soft overflow-hidden">
          <div className="flex-none p-4 border-b border-hairline-soft bg-surface/30 flex items-center justify-between">
            <h3 className="caption-bold text-steel">ACTIVITY TIMELINE</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            <TimelinePanel events={metrics.timeline} />
          </div>

          {/* Quick Note Input at the very bottom of the timeline column */}
          <div className="flex-none p-3 border-t border-hairline-soft bg-surface">
            <form onSubmit={handleNoteSubmit} className="flex gap-2">
              <input 
                value={promptNote}
                onChange={(e) => setPromptNote(e.target.value)}
                placeholder="Log a prompt note..."
                className="text-input flex-1 h-8 text-[12px] px-3 bg-canvas border-hairline-soft"
              />
              <button type="submit" className="btn-secondary h-8 px-3 text-[12px] py-0 bg-surface-hover">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

      </div>

      {showReview && <ReviewModal sessionId={sessionId} onClose={() => setShowReview(false)} />}
    </div>
  );
}
