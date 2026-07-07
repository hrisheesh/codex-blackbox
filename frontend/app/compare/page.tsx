"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { compareSessions, exportComparison } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Download, ArrowLeft, TrendingUp, TrendingDown, Minus, CheckCircle, AlertTriangle } from "lucide-react";

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
    return <div className="p-10 flex flex-col items-center gap-4">
      <p className="text-slate-500">Please select two sessions to compare.</p>
      <Button variant="outline" onClick={() => router.push('/')}>Go Back</Button>
    </div>;
  }

  if (error) {
    return <div className="p-10 text-red-500">{error}</div>;
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Activity className="h-8 w-8 text-blue-500 animate-bounce" />
          <p className="text-slate-500 font-medium">Analyzing sessions...</p>
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
    if (trend === "improved") return <TrendingUp className="w-5 h-5 text-emerald-500" />;
    if (trend === "worsened") return <TrendingDown className="w-5 h-5 text-red-500" />;
    return <Minus className="w-5 h-5 text-slate-400" />;
  };

  const MetricRow = ({ label, v1, v2, suffix1="", suffix2="" }: any) => {
    const highlight = v1 !== v2;
    return (
      <div className={`grid grid-cols-3 gap-4 py-3 border-b border-slate-100 items-center hover:bg-slate-50 transition-colors px-4 -mx-4`}>
        <div className="font-medium text-slate-500 text-sm">{label}</div>
        <div className={`font-mono text-center ${highlight && v1 > v2 ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{v1}{suffix1}</div>
        <div className={`font-mono text-center ${highlight && v2 > v1 ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{v2}{suffix2}</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-6 lg:p-10 font-sans">
      <div className="max-w-[1000px] mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/60">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/')} className="rounded-full shadow-sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Session Comparison</h1>
              <p className="text-slate-500 font-mono text-sm mt-1">{s1} <span className="text-slate-300 mx-2">vs</span> {s2}</p>
            </div>
          </div>
          <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg shadow-blue-500/20">
            <Download className="mr-2 h-4 w-4" /> Export Report
          </Button>
        </div>

        {/* Conclusions Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100 shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CheckCircle className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">More Efficient</p>
                <p className="text-xs font-mono text-emerald-700 mt-1">{comparison.more_efficient === 'tie' ? 'Tie' : comparison.more_efficient}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100 shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Activity className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Higher Churn</p>
                <p className="text-xs font-mono text-amber-700 mt-1">{comparison.more_churn === 'tie' ? 'Tie' : comparison.more_churn}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-100 shadow-sm">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">{getQualityIcon(comparison.quality_trend)}</div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Quality Trend</p>
                <p className="text-xs font-medium text-blue-700 mt-1 capitalize">{comparison.quality_trend}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison Table */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl px-8">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="font-semibold text-slate-700">Metric</div>
              <div className="text-center font-mono font-bold text-slate-800 bg-white py-2 rounded-md shadow-sm border border-slate-200 truncate px-2">{s1}</div>
              <div className="text-center font-mono font-bold text-slate-800 bg-white py-2 rounded-md shadow-sm border border-slate-200 truncate px-2">{s2}</div>
            </div>
          </CardHeader>
          <CardContent className="p-4 px-8">
            <div className="space-y-1">
              <MetricRow label="Duration" v1={formatDuration(session1.duration_seconds)} v2={formatDuration(session2.duration_seconds)} />
              <MetricRow label="Quality Score" v1={session1.quality_score ?? 'N/A'} v2={session2.quality_score ?? 'N/A'} suffix1={session1.quality_score ? "/10" : ""} suffix2={session2.quality_score ? "/10" : ""} />
              
              <div className="pt-4 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Activity</div>
              <MetricRow label="File Events" v1={session1.file_events_count} v2={session2.file_events_count} />
              <MetricRow label="Files Touched" v1={session1.files_touched} v2={session2.files_touched} />
              <MetricRow label="Lines Written" v1={session1.total_lines_written} v2={session2.total_lines_written} />
              <MetricRow label="Lines Deleted" v1={session1.total_lines_deleted} v2={session2.total_lines_deleted} />
              <MetricRow label="Write Amplification" v1={session1.write_amplification.toFixed(2)} v2={session2.write_amplification.toFixed(2)} suffix1="x" suffix2="x" />
              
              <div className="pt-4 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">File Lifecycle</div>
              <MetricRow label="Files Created" v1={session1.files_created} v2={session2.files_created} />
              <MetricRow label="Files Deleted" v1={session1.files_deleted} v2={session2.files_deleted} />
              <MetricRow label="Files Recreated" v1={session1.files_recreated} v2={session2.files_recreated} />
              
              <div className="pt-4 pb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis</div>
              <MetricRow label="Possible Compactions" v1={session1.possible_compactions} v2={session2.possible_compactions} />
              <MetricRow label="Possible Tool Calls" v1={session1.possible_tool_calls} v2={session2.possible_tool_calls} />
              <MetricRow label="Suspicious Patterns" v1={session1.suspicious_patterns} v2={session2.suspicious_patterns} />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Activity className="h-8 w-8 text-blue-500 animate-bounce" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
