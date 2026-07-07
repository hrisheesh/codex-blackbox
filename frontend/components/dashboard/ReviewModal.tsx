import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ReviewModal({ show, setShow, review, setReview, onSave }: any) {
  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="sm:max-w-[550px] border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-chart-4 to-chart-2" />
        <DialogHeader className="pt-4 px-2">
          <DialogTitle className="text-2xl font-bold tracking-tight">Audit Session Review</DialogTitle>
          <DialogDescription className="text-muted-foreground mt-2">
            Log qualitative feedback on the agent's performance to correlate with the quantitative data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4 px-2">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="font-semibold text-sm">Code Quality Score</Label>
              <span className="text-lg font-bold text-primary">{review.quality_score} / 10</span>
            </div>
            <input 
              type="range" 
              min="1" max="10" 
              value={review.quality_score}
              onChange={(e) => setReview({...review, quality_score: parseInt(e.target.value)})}
              className="w-full accent-primary cursor-pointer" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Followed Instructions</Label>
              <select 
                className="w-full h-9 rounded-md border border-border/50 bg-black/20 px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                value={review.followed_instruction}
                onChange={(e) => setReview({...review, followed_instruction: e.target.value})}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Code Worked</Label>
              <select 
                className="w-full h-9 rounded-md border border-border/50 bg-black/20 px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                value={review.code_worked}
                onChange={(e) => setReview({...review, code_worked: e.target.value})}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Seemed Confused</Label>
              <select 
                className="w-full h-9 rounded-md border border-border/50 bg-black/20 px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                value={review.seemed_confused}
                onChange={(e) => setReview({...review, seemed_confused: e.target.value})}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Overused Tools</Label>
              <select 
                className="w-full h-9 rounded-md border border-border/50 bg-black/20 px-3 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                value={review.overused_tools}
                onChange={(e) => setReview({...review, overused_tools: e.target.value})}
              >
                <option value="unknown">Unknown</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Additional Notes</Label>
            <Textarea 
              placeholder="e.g. Agent got stuck looping on a type error..."
              value={review.notes}
              onChange={(e) => setReview({...review, notes: e.target.value})}
              className="resize-none h-24 bg-black/20 border-border/50 focus:ring-primary/50"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-4 px-2 pb-2">
          <Button variant="ghost" onClick={() => setShow(false)}>Cancel</Button>
          <Button onClick={onSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Save Review & Generate Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
