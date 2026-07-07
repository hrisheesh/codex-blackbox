import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus } from "lucide-react";
import { useState } from "react";

export function TimelinePanel({ timeline, status, onAddNote, isAddingNote }: any) {
  const [note, setNote] = useState("");

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (note.trim()) {
      onAddNote(note);
      setNote("");
    }
  };

  return (
    <div className="glass-card rounded-xl border border-border/40 sticky top-20 flex flex-col max-h-[85vh]">
      <div className="p-4 border-b border-border/30 bg-white/5 backdrop-blur-md rounded-t-xl">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Live Timeline
        </h3>
        {status === "recording" && (
          <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder="Add a prompt note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 h-9 rounded-md border border-border/50 bg-background/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              type="submit"
              disabled={isAddingNote || !note.trim()}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {timeline?.map((event: any, i: number) => {
            let dotColor = "bg-muted";
            if (event.type === "file_created") dotColor = "bg-chart-2";
            else if (event.type === "file_deleted") dotColor = "bg-destructive";
            else if (event.type === "file_modified") dotColor = "bg-chart-1";
            else if (event.type === "codex_log_marker") dotColor = "bg-chart-3";
            else if (event.type.includes("started") || event.type.includes("stopped")) dotColor = "bg-chart-4";
            else if (event.type === "prompt_note") dotColor = "bg-chart-5";

            return (
              <motion.div
                key={event.time + i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-4 relative"
              >
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${dotColor} mt-1.5 shadow-[0_0_10px_rgba(255,255,255,0.2)] z-10`} />
                  {i !== timeline.length - 1 && <div className="w-[1px] h-full bg-border mt-2" />}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm capitalize">{event.type.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(event.time).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground/80 leading-snug break-words">
                    {event.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!timeline?.length && (
          <div className="flex flex-col items-center justify-center py-10 opacity-50">
            <Clock className="w-8 h-8 mb-2" />
            <p className="text-sm">Listening for events...</p>
          </div>
        )}
      </div>
    </div>
  );
}
