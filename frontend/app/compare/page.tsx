"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { compareSessions, exportComparison } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Activity, Download, ArrowLeft, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const s1 = searchParams.get("s1");
  const s2 = searchParams.get("s2");

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (s1 && s2) {
      compareSessions(s1, s2).then(setData).catch(err => {
        console.error(err);
        setError("Failed to fetch comparison data.");
      });
    }
  }, [s1, s2]);

  if (!s1 || !s2) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Compare Sessions</h2>
            <p className="text-muted-foreground text-sm">Please select two sessions from the home page to compare their performance.</p>
          </div>
          <Button onClick={() => router.push('/')} className="w-full">Return Home</Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-center">
        <div className="space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={() => router.push('/')}>Go Back</Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-muted-foreground font-medium animate-pulse">Analyzing sessions...</p>
        </div>
      </div>
    );
  }

  const { session1, session2, comparison } = data;

  const handleExport = async () => {
    try {
      await exportComparison(s1, s2);
    } catch (e) {
      alert("Failed to export comparison");
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const getQualityIcon = (trend: string) => {
    if (trend === "improved") return <TrendingUp className="w-6 h-6 text-emerald-500" />;
    if (trend === "worsened") return <TrendingDown className="w-6 h-6 text-destructive" />;
    return <Minus className="w-6 h-6 text-muted-foreground" />;
  };

  const MetricRow = ({ label, v1, v2, suffix1="", suffix2="", delay=0 }: any) => {
    const highlight = v1 !== v2;
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay }}
        className="grid grid-cols-3 gap-4 py-4 border-b border-border/30 items-center hover:bg-white/5 transition-colors px-6 -mx-6"
      >
        <div className="font-medium text-muted-foreground text-sm">{label}</div>
        <div className={`font-mono text-center ${highlight && v1 > v2 ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{v1}{suffix1}</div>
        <div className={`font-mono text-center ${highlight && v2 > v1 ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{v2}{suffix2}</div>
      </motion.div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1000px]">
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/40">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/')} className="rounded-full bg-transparent hover:bg-white/10 border-border/50">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Session Comparison</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">{s1} <span className="text-primary mx-2">vs</span> {s2}</p>
            </div>
          </div>
          <Button onClick={handleExport} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6">
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* Conclusions Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 border-t-4 border-t-emerald-500">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-emerald-500/20 text-emerald-500 rounded-lg"><CheckCircle className="w-6 h-6" /></div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">More Efficient</p>
                <p className="text-lg font-mono font-bold text-foreground mt-1">{comparison.more_efficient === 'tie' ? 'Tie' : comparison.more_efficient}</p>
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5 border-t-4 border-t-amber-500">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg"><Activity className="w-6 h-6" /></div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Higher Churn</p>
                <p className="text-lg font-mono font-bold text-foreground mt-1">{comparison.more_churn === 'tie' ? 'Tie' : comparison.more_churn}</p>
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-5 border-t-4 border-t-primary">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-primary/20 rounded-lg">{getQualityIcon(comparison.quality_trend)}</div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quality Trend</p>
                <p className="text-lg font-bold text-foreground mt-1 capitalize">{comparison.quality_trend}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Comparison Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="glass-card rounded-xl border border-border/40 overflow-hidden">
          <div className="bg-black/20 border-b border-border/30 px-8 py-4">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="font-semibold text-muted-foreground uppercase tracking-wider text-sm">Metric</div>
              <div className="text-center font-mono font-bold text-foreground bg-white/5 py-2 rounded-md border border-white/5 truncate px-2">{s1}</div>
              <div className="text-center font-mono font-bold text-foreground bg-white/5 py-2 rounded-md border border-white/5 truncate px-2">{s2}</div>
            </div>
          </div>
          <div className="p-4 px-8 overflow-x-hidden">
            <div className="space-y-1">
              <MetricRow label="Duration" v1={formatDuration(session1.duration_seconds)} v2={formatDuration(session2.duration_seconds)} delay={0.45} />
              <MetricRow label="Quality Score" v1={session1.quality_score ?? 'N/A'} v2={session2.quality_score ?? 'N/A'} suffix1={session1.quality_score ? "/10" : ""} suffix2={session2.quality_score ? "/10" : ""} delay={0.5} />
              
              <div className="pt-6 pb-2 text-xs font-bold text-primary uppercase tracking-wider">Activity</div>
              <MetricRow label="File Events" v1={session1.file_events_count} v2={session2.file_events_count} delay={0.55} />
              <MetricRow label="Files Touched" v1={session1.files_touched} v2={session2.files_touched} delay={0.6} />
              <MetricRow label="Write Amplification" v1={session1.write_amplification.toFixed(1)} v2={session2.write_amplification.toFixed(1)} suffix1="x" suffix2="x" delay={0.65} />
              <MetricRow label="Total Lines Written" v1={session1.total_lines_written} v2={session2.total_lines_written} suffix1=" lines" suffix2=" lines" delay={0.7} />
              <MetricRow label="Total Lines Deleted" v1={session1.total_lines_deleted} v2={session2.total_lines_deleted} suffix1=" lines" suffix2=" lines" delay={0.75} />
              
              <div className="pt-6 pb-2 text-xs font-bold text-primary uppercase tracking-wider">File Lifecycle</div>
              <MetricRow label="Files Created" v1={session1.files_created} v2={session2.files_created} delay={0.8} />
              <MetricRow label="Files Deleted" v1={session1.files_deleted} v2={session2.files_deleted} delay={0.85} />
              <MetricRow label="Deleted & Recreated" v1={session1.files_recreated} v2={session2.files_recreated} delay={0.9} />
              
              <div className="pt-6 pb-2 text-xs font-bold text-primary uppercase tracking-wider">Agent Behavior</div>
              <MetricRow label="Possible Compactions" v1={session1.possible_compactions} v2={session2.possible_compactions} delay={0.95} />
              <MetricRow label="Possible Tool Calls" v1={session1.possible_tool_calls} v2={session2.possible_tool_calls} delay={1.0} />
              <MetricRow label="Suspicious Patterns" v1={session1.suspicious_patterns_count} v2={session2.suspicious_patterns_count} delay={1.05} />
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default function Compare() {
  return (
    <Suspense fallback={<div className="flex h-[80vh] items-center justify-center">Loading...</div>}>
      <CompareContent />
    </Suspense>
  );
}
