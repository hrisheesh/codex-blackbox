import { Clock, Play, FileText, CheckCircle2 } from "lucide-react";

export function TimelinePanel({ events }: any) {
  if (!events || events.length === 0) {
    return (
      <div className="card-base text-center py-16 bg-surface-soft/50 border-dashed">
        <Clock className="w-8 h-8 text-surface-hover mx-auto mb-4" />
        <p className="body-md text-steel">No events recorded yet.</p>
        <p className="caption text-stone mt-1">Waiting for agent activity...</p>
      </div>
    );
  }

  const getTypeStyle = (type: string) => {
    switch(type) {
      case 'start': return 'bg-surface border-white/20 text-white';
      case 'file_created': return 'bg-[#32d74b]/10 border-[#32d74b]/20 text-[#32d74b]';
      case 'file_modified': return 'bg-[#0a84ff]/10 border-[#0a84ff]/20 text-[#0a84ff]';
      case 'file_deleted': return 'bg-[#ff453a]/10 border-[#ff453a]/20 text-[#ff453a]';
      case 'compaction': return 'bg-[#ff9f0a]/10 border-[#ff9f0a]/20 text-[#ff9f0a]';
      case 'stop': return 'bg-white text-black border-white';
      default: return 'bg-surface border-hairline text-steel';
    }
  };

  const getIcon = (type: string) => {
    if (type === 'start' || type === 'stop') return <Play className="w-3.5 h-3.5" />;
    if (type === 'compaction') return <CheckCircle2 className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-4 bottom-4 w-[1px] bg-hairline-soft" />
      <div className="space-y-6">
        {events.map((ev: any, idx: number) => {
          const style = getTypeStyle(ev.type);
          return (
            <div key={idx} className="relative flex gap-4 items-start group">
              <div className={`relative z-10 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 bg-canvas transition-colors ${style} group-hover:scale-110 duration-300`}>
                {getIcon(ev.type)}
              </div>
              <div className="flex-1 pt-0.5 min-w-0">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="caption-bold text-ink truncate">{ev.detail}</p>
                  <span className="micro text-steel shrink-0 bg-surface-soft px-1.5 rounded border border-hairline-soft">
                    {new Date(ev.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                  </span>
                </div>
                <p className="caption text-steel mt-1 uppercase tracking-wider">{ev.type.replace('_', ' ')}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
