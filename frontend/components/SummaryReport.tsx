import { useMemo } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, Home, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Session {
  code?: string;
  courseName: string;
  duration: number;
  taName?: string;
  startTime?: number;
}

interface ConfusionEvent {
  timestamp: number;
  note?: string;
  studentId: string;
}

interface SummaryReportProps {
  session: Session | null;
  confusionEvents: ConfusionEvent[];
  onBack: () => void;
  onHome: () => void;
}

export function SummaryReport({ session, confusionEvents, onBack, onHome }: SummaryReportProps) {
  // Generate mock data if no real session exists
  const mockEvents = useMemo(() => {
    if (!session || confusionEvents.length === 0) {
      const events: ConfusionEvent[] = [];
      const now = Date.now();
      for (let i = 0; i < 45; i++) {
        const timestamp = now - (60 - Math.random() * 50) * 60 * 1000;
        events.push({
          timestamp,
          studentId: `student-${Math.floor(Math.random() * 20)}`,
          note: Math.random() > 0.7 ? 'Confused about this part' : undefined
        });
      }
      return events;
    }
    return confusionEvents;
  }, [session, confusionEvents]);

  const summaryData = useMemo(() => {
    const binSize = 5; // 5-minute bins
    const bins: { [key: number]: { count: number; students: Set<string> } } = {};
    const startTime = session?.startTime || Date.now() - 60 * 60 * 1000;
    const totalStudents = new Set(mockEvents.map(e => e.studentId)).size;
    
    // Initialize bins
    const numBins = Math.ceil((session?.duration || 60) / binSize);
    for (let i = 0; i < numBins; i++) {
      bins[i * binSize] = { count: 0, students: new Set() };
    }

    // Count events in each bin
    mockEvents.forEach(event => {
      const minutesElapsed = (event.timestamp - startTime) / (1000 * 60);
      const binIndex = Math.floor(minutesElapsed / binSize) * binSize;
      if (bins[binIndex]) {
        bins[binIndex].count++;
        bins[binIndex].students.add(event.studentId);
      }
    });

    // Convert to array with percentage
    const data = Object.entries(bins).map(([minute, data]) => {
      const percentage = totalStudents > 0 ? (data.students.size / totalStudents) * 100 : 0;
      return {
        minute: parseInt(minute),
        count: data.count,
        percentage,
        label: `${minute}-${parseInt(minute) + binSize}`,
        uniqueStudents: data.students.size
      };
    });

    // Calculate threshold for highlighting
    const counts = data.map(d => d.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const threshold = mean + 1.2 * stdDev;

    return { data, threshold, totalStudents };
  }, [mockEvents, session]);

  const handleExport = () => {
    // In a real app, this would generate a PDF or CSV
    alert('Export functionality would download a detailed report');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={onHome}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Title */}
        <Card className="p-6">
          <h1 className="mb-2">Post-Session Summary Report</h1>
          <p className="text-muted-foreground">
            {session?.courseName || 'Demo Session'}
          </p>
          {session?.taName && (
            <p className="text-sm text-muted-foreground mt-1">
              Instructor: {session.taName}
            </p>
          )}
        </Card>

        {/* Overall Stats */}
        <Card className="p-6">
          <h2 className="mb-4">Session Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Events</p>
              <p className="text-3xl">{mockEvents.length}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Students</p>
              <p className="text-3xl">{summaryData.totalStudents}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Avg per Student</p>
              <p className="text-3xl">
                {summaryData.totalStudents > 0 
                  ? (mockEvents.length / summaryData.totalStudents).toFixed(1)
                  : 0}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Peak Confusion</p>
              <p className="text-3xl">
                {Math.max(...summaryData.data.map(d => d.percentage)).toFixed(0)}%
              </p>
            </div>
          </div>
        </Card>

        {/* Bar Chart */}
        <Card className="p-6">
          <h2 className="mb-4">Confusion Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData.data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label" 
                  label={{ value: 'Time Interval (minutes)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Confusion Events', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'count') return [value, 'Events'];
                    return [value, name];
                  }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {summaryData.data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count >= summaryData.threshold ? '#ef4444' : '#3b82f6'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Detailed Table */}
        <Card className="p-6">
          <h2 className="mb-4">Interval Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Time Interval</th>
                  <th className="text-right p-3">Events</th>
                  <th className="text-right p-3">Students Affected</th>
                  <th className="text-right p-3">% of Class</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.data.map((row, idx) => {
                  const isHighConfusion = row.count >= summaryData.threshold;
                  return (
                    <tr 
                      key={idx}
                      className={`border-b ${isHighConfusion ? 'bg-red-50' : ''}`}
                    >
                      <td className="p-3">{row.label} min</td>
                      <td className="text-right p-3">{row.count}</td>
                      <td className="text-right p-3">{row.uniqueStudents}</td>
                      <td className="text-right p-3">{row.percentage.toFixed(1)}%</td>
                      <td className="text-center p-3">
                        {isHighConfusion ? (
                          <Badge variant="destructive">High Confusion</Badge>
                        ) : row.count > 0 ? (
                          <Badge variant="secondary">Normal</Badge>
                        ) : (
                          <Badge variant="outline">Clear</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Insights */}
        <Card className="p-6">
          <h2 className="mb-4">Key Insights</h2>
          <div className="space-y-3">
            {summaryData.data
              .filter(d => d.count >= summaryData.threshold)
              .map((peak, idx) => (
                <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                  <p>
                    <span className="font-semibold">Peak confusion at {peak.label} minutes:</span> {peak.count} events from {peak.uniqueStudents} students ({peak.percentage.toFixed(1)}% of class)
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Consider revisiting this material or providing additional examples
                  </p>
                </div>
              ))}
            {summaryData.data.filter(d => d.count >= summaryData.threshold).length === 0 && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <p>No significant confusion peaks detected. Students appeared to follow along well!</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
