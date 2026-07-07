import { AlertCircle, Zap, ShieldAlert, ShieldCheck } from "lucide-react";

export function AnalysisSection({ metrics }: any) {
  const hasPatterns = metrics.suspicious_patterns && metrics.suspicious_patterns.length > 0;
  const hasRecommendations = metrics.recommendations && metrics.recommendations.length > 0;

  if (!hasPatterns && !hasRecommendations) {
    return (
      <div className="card-base text-center py-16 bg-surface-soft/50 border-dashed">
        <ShieldCheck className="w-8 h-8 text-[#32d74b] mx-auto mb-4 opacity-80" />
        <h4 className="card-title text-ink mb-1">No Anomalies Detected</h4>
        <p className="body-sm text-steel">Session appears clean and efficient.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hasPatterns && (
        <div className="card-base bg-danger-bg border-danger-text/20">
          <div className="flex items-center gap-2 mb-4 text-danger-text">
            <ShieldAlert className="w-4 h-4" />
            <h4 className="caption-bold uppercase tracking-widest">Suspicious Patterns ({metrics.suspicious_patterns.length})</h4>
          </div>
          <div className="space-y-4">
            {metrics.suspicious_patterns.map((p: any, i: number) => (
              <div key={i} className="bg-canvas/50 rounded-xl p-4 border border-danger-text/10">
                <h5 className="body-md font-semibold text-ink mb-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger-text"></span>
                  {p.title}
                </h5>
                <p className="caption text-steel mb-3">{p.evidence}</p>
                
                <div className="bg-danger-bg/50 px-3 py-2 rounded-lg border border-danger-text/10">
                  <p className="caption-bold text-danger-text mb-1">Why it matters:</p>
                  <p className="caption text-ink leading-relaxed">{p.why_it_matters}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasRecommendations && (
        <div className="card-base bg-info-bg border-info-text/20">
          <div className="flex items-center gap-2 mb-4 text-info-text">
            <Zap className="w-4 h-4" />
            <h4 className="caption-bold uppercase tracking-widest">Recommendations ({metrics.recommendations.length})</h4>
          </div>
          <div className="space-y-4">
            {metrics.recommendations.map((r: any, i: number) => (
              <div key={i} className="bg-canvas/50 rounded-xl p-4 border border-info-text/10">
                <h5 className="body-md font-semibold text-ink mb-2">{r.issue}</h5>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="micro text-steel uppercase tracking-widest mb-1">Evidence</p>
                    <p className="caption text-ink bg-info-bg/30 px-2 py-1.5 rounded border border-info-text/10">{r.evidence}</p>
                  </div>
                  <div className="flex-1">
                    <p className="micro text-steel uppercase tracking-widest mb-1">Action</p>
                    <p className="caption font-medium text-info-text bg-info-bg px-2 py-1.5 rounded border border-info-text/20">{r.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
