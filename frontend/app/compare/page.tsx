"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listSessions, compareSessions } from "@/lib/api";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function Compare() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [data1, setData1] = useState<any>(null);
  const [data2, setData2] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);

  useEffect(() => {
    listSessions().then(setSessions).catch(console.error);
  }, []);

  const handleCompare = async () => {
    if (!s1 || !s2) return;
    try {
      const result = await compareSessions(s1, s2);
      setData1(result.session1);
      setData2(result.session2);
      setComparison(result.comparison);
    } catch (e) {
      console.error(e);
      alert("Failed to load metrics for one or both sessions");
    }
  };

  const renderComparisonRow = (label: string, val1: any, val2: any, lowerIsBetter: boolean = true) => {
    const v1 = parseFloat(val1);
    const v2 = parseFloat(val2);
    let diff = 0;
    
    if (!isNaN(v1) && !isNaN(v2) && v1 !== v2) {
      diff = v2 - v1; 
    }

    let better = null;
    if (diff !== 0) {
      better = (diff < 0) === lowerIsBetter ? 2 : 1;
    }

    return (
      <div className="grid grid-cols-12 gap-4 py-2 border-b border-hairline-soft last:border-0 hover:bg-surface-hover transition-colors items-center px-4">
        <div className="col-span-4 caption-bold text-steel">
          {label}
        </div>
        <div className={`col-span-4 font-mono text-[13px] flex items-center justify-end gap-2 ${better === 1 ? 'text-[#32d74b]' : 'text-ink'}`}>
          {better === 1 && <CheckCircle2 className="w-3.5 h-3.5" />} {val1}
        </div>
        <div className={`col-span-4 font-mono text-[13px] flex items-center justify-end gap-2 ${better === 2 ? 'text-[#32d74b]' : 'text-ink'}`}>
          {better === 2 && <CheckCircle2 className="w-3.5 h-3.5" />} {val2}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full p-4 overflow-hidden">
      
      {/* Top Header / Controls (Fixed Height) */}
      <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-end gap-4 p-4 bg-surface-soft backdrop-blur-md rounded-[16px] border border-hairline-soft mb-4">
        <div>
          <Link href="/" className="inline-flex items-center text-steel hover:text-ink transition-colors mb-2 caption-bold tracking-widest uppercase">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Link>
          <h1 className="heading-sm text-ink mb-1">Compare Sessions</h1>
          <p className="caption text-steel">Select two recorded sessions to compare their churn metrics.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-1">
            <label className="caption-bold text-steel text-[10px]">SESSION A (BASELINE)</label>
            <select 
              className="text-input h-9 px-3 appearance-none bg-canvas w-48 text-[13px]" 
              value={s1} 
              onChange={(e) => setS1(e.target.value)}
            >
              <option value="">Select session...</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="caption-bold text-steel text-[10px]">SESSION B (COMPARISON)</label>
            <select 
              className="text-input h-9 px-3 appearance-none bg-canvas w-48 text-[13px]" 
              value={s2} 
              onChange={(e) => setS2(e.target.value)}
            >
              <option value="">Select session...</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
            </select>
          </div>

          <button 
            onClick={handleCompare}
            disabled={!s1 || !s2}
            className="btn-primary h-9 px-6 py-0 text-[13px] whitespace-nowrap"
          >
            Run Comparison
          </button>
        </div>
      </div>

      {/* Main Content Area (Fills remaining height) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        
        {/* Left Area: Table (Scrollable inside) */}
        <div className="flex-1 lg:w-2/3 flex flex-col bg-surface-soft backdrop-blur-md rounded-[16px] border border-hairline-soft overflow-hidden">
          <div className="flex-none grid grid-cols-12 gap-4 px-4 py-3 bg-surface/50 border-b border-hairline-soft items-center">
            <div className="col-span-4 uppercase tracking-widest text-[10px] font-semibold text-steel">Metric</div>
            <div className="col-span-4 text-ink font-medium text-[12px] truncate text-right" title={data1?.session_id || "Session A"}>
              {data1?.session_id ? (data1.session_id.split('_')[0] || "Session A") : "Session A"}
            </div>
            <div className="col-span-4 text-ink font-medium text-[12px] truncate text-right" title={data2?.session_id || "Session B"}>
              {data2?.session_id ? (data2.session_id.split('_')[0] || "Session B") : "Session B"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!data1 || !data2 ? (
              <div className="h-full flex items-center justify-center text-center">
                <p className="body-sm text-steel">Select two sessions and run comparison to view metrics.</p>
              </div>
            ) : (
              <div className="pb-4">
                {renderComparisonRow("Duration (seconds)", data1.duration_seconds, data2.duration_seconds, true)}
                {renderComparisonRow("Files Touched", data1.files_touched, data2.files_touched, true)}
                {renderComparisonRow("Write Amp", (data1.write_amplification || 0).toFixed(2), (data2.write_amplification || 0).toFixed(2), true)}
                {renderComparisonRow("Total Events", data1.file_events_count, data2.file_events_count, true)}
                {renderComparisonRow("Lines Added", data1.total_lines_written, data2.total_lines_written, true)}
                {renderComparisonRow("Lines Deleted", data1.total_lines_deleted, data2.total_lines_deleted, true)}
                {renderComparisonRow("Anomalies", data1.suspicious_patterns || 0, data2.suspicious_patterns || 0, true)}
                {renderComparisonRow("Quality Score", data1.quality_score || 0, data2.quality_score || 0, false)}
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Insights */}
        <div className="flex-none lg:w-1/3 flex flex-col gap-4">
          <div className="card-base h-full bg-surface-soft border border-hairline-soft flex flex-col">
            <h3 className="heading-sm text-ink mb-4 flex items-center gap-2 border-b border-hairline-soft pb-4">
              <AlertCircle className="w-4 h-4 text-steel" />
              Insights
            </h3>
            
            {!comparison ? (
               <p className="body-sm text-steel">Awaiting comparison...</p>
            ) : (
              <div className="space-y-4">
                <div className="bg-surface/50 p-4 rounded-lg border border-hairline">
                  <p className="caption-bold text-steel mb-1">Efficiency Trend</p>
                  <p className="body-sm text-ink leading-relaxed">
                    {comparison?.more_efficient === data2.session_id ? (
                      <>Session B was <strong>more direct</strong>, touching fewer files repeatedly compared to Session A.</>
                    ) : (
                      <>Session A showed <strong>more efficient</strong> file modification patterns with less write amplification.</>
                    )}
                  </p>
                </div>
                
                <div className="bg-surface/50 p-4 rounded-lg border border-hairline">
                  <p className="caption-bold text-steel mb-1">Subjective Quality</p>
                  <p className="body-sm text-ink leading-relaxed">
                    {comparison?.quality_trend === "improved" ? (
                      <>The subjective <strong>quality score improved</strong> in Session B.</>
                    ) : comparison?.quality_trend === "declined" ? (
                      <>The subjective <strong>quality score was higher</strong> in Session A.</>
                    ) : (
                      <>Both sessions have similar or identical subjective quality scores.</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
