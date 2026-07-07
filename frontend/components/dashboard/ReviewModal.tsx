import { useState } from "react";
import { addReview } from "@/lib/api";
import { X } from "lucide-react";

export function ReviewModal({ sessionId, onClose }: any) {
  const [score, setScore] = useState(5);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addReview(sessionId, { quality_score: score, notes });
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save review");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-hairline-soft">
          <h2 className="heading-sm text-ink">Rate Session Quality</h2>
          <button onClick={onClose} className="text-steel hover:text-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-steel">
              <span className="caption-bold">Horrible (1)</span>
              <span className="heading-sm text-ink">{score}</span>
              <span className="caption-bold">Perfect (10)</span>
            </div>
            <input 
              type="range" 
              min="1" max="10" 
              value={score} 
              onChange={(e) => setScore(parseInt(e.target.value))}
              className="w-full accent-white"
            />
          </div>
          
          <div className="space-y-2">
            <label className="caption-bold text-steel">NOTES (OPTIONAL)</label>
            <textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              className="text-input w-full h-24 py-3 resize-none"
              placeholder="Any subjective notes on agent behavior?"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Saving..." : "Save Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
