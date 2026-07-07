import { motion } from "framer-motion";
import { ShieldAlert, Lightbulb, AlertTriangle } from "lucide-react";

export function AnalysisSection({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  const hasPatterns = metrics.suspicious_patterns?.length > 0;
  const hasRecs = metrics.recommendations?.length > 0;

  if (!hasPatterns && !hasRecs) return null;

  return (
    <div className="space-y-8 mt-10 border-t border-border/30 pt-8">
      
      {/* Recommendations */}
      {hasRecs && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4 text-amber-500">
            <Lightbulb className="w-5 h-5" /> Agent Workflow Recommendations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.recommendations.map((rec: any, i: number) => (
              <div key={i} className="glass-card rounded-xl p-5 border-l-4 border-l-amber-500 relative overflow-hidden group">
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="font-bold text-amber-500 mb-2">{rec.issue}</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Evidence:</span> <br/>{rec.evidence}</p>
                  <p className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20 text-amber-100">
                    <span className="font-semibold uppercase text-xs tracking-wider block mb-1">Recommendation:</span>
                    {rec.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Suspicious Patterns */}
      {hasPatterns && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4 text-rose-500">
            <ShieldAlert className="w-5 h-5" /> Suspicious Patterns
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.suspicious_patterns.map((pattern: any, i: number) => {
              const isHigh = pattern.severity === "High";
              const isMedium = pattern.severity === "Medium";
              const borderColor = isHigh ? "border-l-rose-500" : isMedium ? "border-l-amber-500" : "border-l-blue-500";
              const titleColor = isHigh ? "text-rose-500" : isMedium ? "text-amber-500" : "text-blue-500";
              const badgeBg = isHigh ? "bg-rose-500/20 text-rose-300" : isMedium ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300";

              return (
                <div key={i} className={`glass-card rounded-xl p-5 border-l-4 ${borderColor}`}>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className={`font-bold ${titleColor}`}>{pattern.title}</h3>
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${badgeBg}`}>
                      {pattern.severity}
                    </span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="bg-black/20 p-2 rounded border border-white/5">{pattern.evidence}</p>
                    {pattern.related_files_events?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {pattern.related_files_events.map((rel: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 bg-white/5 rounded text-xs font-mono text-muted-foreground truncate max-w-full">
                            {rel.split('/').pop() || rel}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-muted-foreground">{pattern.why_it_matters}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
