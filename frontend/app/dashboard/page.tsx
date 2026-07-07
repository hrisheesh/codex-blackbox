"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getLiveMetrics, stopSession, addReview, generateReport } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Clock, FileCode2, Files, RefreshCw, Square, CheckCircle, Download, ListTree, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState("loading");
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState({ quality_score: 5, notes: "" });
  const [reportGenerated, setReportGenerated] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    // Initial fetch
    getLiveMetrics(sessionId).then(data => {
      setMetrics(data);
      setStatus(data.status);
    }).catch(console.error);

    // WebSocket connection
    const ws = new WebSocket(`ws://localhost:8000/ws/sessions/${sessionId}`);
    
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "metrics_updated") {
        setMetrics(msg.data);
        setStatus(msg.data.status);
      } else if (msg.type === "session_stopped") {
        setStatus("stopped");
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const handleStop = async () => {
    if (!sessionId) return;
    await stopSession(sessionId);
    setShowReview(true);
  };

  const handleSaveReview = async () => {
    if (!sessionId) return;
    await addReview(sessionId, review);
    await generateReport(sessionId);
    setShowReview(false);
    setReportGenerated(true);
  };

  if (!sessionId) return <div>No session ID provided.</div>;
  if (!metrics) return <div className="p-8">Loading session data...</div>;

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Activity className={status === "recording" ? "text-emerald-500 animate-pulse" : "text-slate-400"} />
              Session Dashboard
            </h1>
            <p className="text-slate-500 font-mono mt-1">{sessionId}</p>
          </div>
          <div className="flex gap-3">
            {status === "recording" ? (
              <Button onClick={handleStop} variant="destructive" className="flex items-center gap-2">
                <Square className="h-4 w-4" fill="currentColor" /> Stop Recording
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-sm font-medium">Stopped</span>
                {!reportGenerated && (
                  <Button onClick={() => setShowReview(true)} variant="outline">Complete Review</Button>
                )}
                {reportGenerated && (
                  <Button variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={() => alert('Reports are in the sessions directory.')}>
                    <Download className="mr-2 h-4 w-4" /> Reports Ready
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Duration</CardTitle>
              <Clock className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(metrics.duration_seconds)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Files Touched</CardTitle>
              <Files className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.files_touched}</div>
              <p className="text-xs text-slate-500 mt-1">
                {metrics.files_created} created, {metrics.files_deleted} deleted
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Lines Changed</CardTitle>
              <FileCode2 className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">+{metrics.total_lines_written}</div>
              <div className="text-xl font-semibold text-rose-500">-{metrics.total_lines_deleted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Write Amplification</CardTitle>
              <RefreshCw className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.write_amplification.toFixed(2)}x</div>
              <p className="text-xs text-slate-500 mt-1">Written vs Final lines</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts and Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Recharts Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart2 className="w-5 h-5" /> Churn by File</CardTitle>
                <CardDescription>Lines written vs deleted for the top 10 most churned files</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.file_churns.sort((a:any, b:any) => b.total_lines_written - a.total_lines_written).slice(0, 10).map((f:any) => ({
                        name: f.path.split('/').pop(),
                        Written: f.total_lines_written,
                        Deleted: f.total_lines_deleted
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 12}} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Written" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Deleted" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* File Churn Table */}
            <Card>
          <CardHeader>
            <CardTitle>File Churn Details</CardTitle>
            <CardDescription>Real-time operational history of files modified during the session.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Path</TableHead>
                  <TableHead className="text-right">Lines Written</TableHead>
                  <TableHead className="text-right">Lines Deleted</TableHead>
                  <TableHead className="text-right">Current Lines</TableHead>
                  <TableHead className="text-right">Modifications</TableHead>
                  <TableHead className="text-right">Rewrites</TableHead>
                  <TableHead className="text-right">Amplification</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.file_churns.sort((a:any, b:any) => b.total_lines_written - a.total_lines_written).map((file: any) => (
                  <TableRow key={file.path}>
                    <TableCell className="font-mono text-sm max-w-[300px] truncate" title={file.path}>
                      {file.path}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">+{file.total_lines_written}</TableCell>
                    <TableCell className="text-right text-rose-500 font-medium">-{file.total_lines_deleted}</TableCell>
                    <TableCell className="text-right font-medium">{file.current_lines}</TableCell>
                    <TableCell className="text-right">{file.modify_count}</TableCell>
                    <TableCell className="text-right">{file.rewrite_count}</TableCell>
                    <TableCell className="text-right">{file.write_amplification.toFixed(1)}x</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {file.created && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded-full">Created</span>}
                        {file.deleted && <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-xs rounded-full">Deleted</span>}
                        {file.recreated_count > 0 && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">Recreated</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {metrics.file_churns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                      No file events recorded yet. Waiting for agent activity...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Sidebar */}
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListTree className="w-5 h-5" /> Activity Timeline</CardTitle>
            <CardDescription>Chronological events for this session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
              {metrics.timeline && metrics.timeline.map((event: any, index: number) => (
                <div key={index} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5" />
                    {index !== metrics.timeline.length - 1 && <div className="w-px h-full bg-slate-200 my-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-slate-500 text-xs font-mono">{new Date(event.time).toLocaleTimeString()}</p>
                    <p className="font-medium text-slate-800 mt-0.5">{event.type}</p>
                    <p className="text-slate-600 mt-0.5 break-all">{event.detail}</p>
                  </div>
                </div>
              ))}
              {(!metrics.timeline || metrics.timeline.length === 0) && (
                <div className="text-center text-slate-500 py-4">No events yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

      {/* Review Modal */}
      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Session Review</DialogTitle>
            <DialogDescription>
              Optional feedback to include in the final audit report.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quality" className="text-right">Quality (1-10)</Label>
              <Input 
                id="quality" 
                type="number" 
                min="1" max="10" 
                value={review.quality_score}
                onChange={(e) => setReview({...review, quality_score: parseInt(e.target.value)})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="notes" className="text-right pt-2">Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Any observations about loops, tool usage, or confusion?" 
                value={review.notes}
                onChange={(e) => setReview({...review, notes: e.target.value})}
                className="col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveReview} className="bg-emerald-600 hover:bg-emerald-700">Save & Generate Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
