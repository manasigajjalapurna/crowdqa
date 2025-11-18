import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowLeft, RefreshCw, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface Session {
  code: string;
  courseName: string;
  duration: number;
  taName: string;
  startTime?: number;
}

interface ConfusionEvent {
  timestamp: number;
  note?: string;
  studentId: string;
}

interface TADashboardProps {
  session: Session | null;
  confusionEvents: ConfusionEvent[];
  onBack: () => void;
  onViewSummary: () => void;
}

export function TADashboard({ session, confusionEvents, onBack, onViewSummary }: TADashboardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Generate mock data if no real session exists (for demo purposes)
  const mockEvents = useMemo(() => {
    if (!session) {
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
  }, [session, confusionEvents, refreshKey]);

  const chartData = useMemo(() => {
    const binSize = 5; // 5-minute bins
    const bins: { [key: number]: number } = {};
    const startTime = session?.startTime || Date.now() - 60 * 60 * 1000;
    
    // Initialize bins
    const numBins = Math.ceil((session?.duration || 60) / binSize);
    for (let i = 0; i < numBins; i++) {
      bins[i * binSize] = 0;
    }

    // Count events in each bin
    mockEvents.forEach(event => {
      const minutesElapsed = (event.timestamp - startTime) / (1000 * 60);
      const binIndex = Math.floor(minutesElapsed / binSize) * binSize;
      if (bins[binIndex] !== undefined) {
        bins[binIndex]++;
      }
    });

    // Convert to array
    return Object.entries(bins).map(([minute, count]) => ({
      minute: parseInt(minute),
      count,
      label: `${minute}-${parseInt(minute) + binSize} min`
    }));
  }, [mockEvents, session]);

  // Calculate statistics
  const stats = useMemo(() => {
    const counts = chartData.map(d => d.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const threshold = mean + 1.2 * stdDev;
    
    const uniqueStudents = new Set(mockEvents.map(e => e.studentId)).size;
    
    return {
      totalClicks: mockEvents.length,
      uniqueStudents,
      mean,
      stdDev,
      threshold,
      peakBins: chartData.filter(d => d.count >= threshold)
    };
  }, [chartData, mockEvents]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const notesWithTimestamps = useMemo(() => {
    return mockEvents
      .filter(e => e.note)
      .map(e => ({
        ...e,
        minutesElapsed: session?.startTime 
          ? Math.floor((e.timestamp - session.startTime) / (1000 * 60))
          : Math.floor(Math.random() * 60)
      }))
      .sort((a, b) => a.minutesElapsed - b.minutesElapsed);
  }, [mockEvents, session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={onViewSummary} variant="destructive">
              End Session & View Summary
            </Button>
          </div>
        </div>

        {/* Session Info */}
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="mb-2">Live Dashboard</h1>
              <p className="text-muted-foreground">
                {session?.courseName || 'Demo Session'}
              </p>
            </div>
            {session?.code && (
              <Badge variant="secondary" className="text-lg py-2 px-4 tracking-wider">
                {session.code}
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Total Clicks</p>
              <p className="text-3xl">{stats.totalClicks}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Active Students</p>
              <p className="text-3xl">{stats.uniqueStudents}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Peak Intervals</p>
              <p className="text-3xl">{stats.peakBins.length}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Avg per Interval</p>
              <p className="text-3xl">{stats.mean.toFixed(1)}</p>
            </div>
          </div>
        </Card>

        {/* Chart */}
        <Card className="p-6">
          <div className="mb-4">
            <h2>Confusion Heat Map</h2>
            <p className="text-sm text-muted-foreground">
              Red line indicates confusion threshold (mean + 1.2σ)
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="minute" 
                  label={{ value: 'Time (minutes)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Confusion Events', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  labelFormatter={(value) => `${value}-${value + 5} min`}
                  formatter={(value: number) => [value, 'Events']}
                />
                <ReferenceLine 
                  y={stats.threshold} 
                  stroke="red" 
                  strokeDasharray="3 3"
                  label="Threshold"
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={(props) => {
                    const { cx, cy, payload } = props;
                    const isHigh = payload.count >= stats.threshold;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHigh ? 6 : 4}
                        fill={isHigh ? '#ef4444' : '#3b82f6'}
                        stroke="white"
                        strokeWidth={2}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Peak Confusion Bins */}
        {stats.peakBins.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-4">Peak Confusion Intervals</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.peakBins.map(bin => (
                <div 
                  key={bin.minute}
                  className="bg-red-50 border-2 border-red-200 rounded-lg p-4"
                >
                  <p className="text-sm text-muted-foreground">Minutes {bin.label}</p>
                  <p className="text-2xl">{bin.count} events</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Student Notes */}
        {notesWithTimestamps.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2>Student Feedback Notes</h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes ? 'Hide' : 'Show'} Notes ({notesWithTimestamps.length})
              </Button>
            </div>
            {showNotes && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notesWithTimestamps.map((event, idx) => (
                  <div 
                    key={idx}
                    className="bg-gray-50 rounded p-3 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {event.minutesElapsed} min
                      </Badge>
                    </div>
                    <p>{event.note}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}