import { useState } from 'react';
import { JoinSession } from '../components/JoinSession';
import { StudentView } from '../components/StudentView';
import { SessionCreator } from '../components/SessionCreator';
import { TADashboard } from '../components/TADashboard';
import { SummaryReport } from '../components/SummaryReport';
import { Button } from '../components/ui/button';

type View = 'home' | 'student-join' | 'student-active' | 'ta-create' | 'ta-dashboard' | 'ta-summary';

interface Session {
  code: string;
  courseName: string;
  date: string;
  duration: number;
  taName: string;
  startTime?: number;
}

interface ConfusionEvent {
  timestamp: number;
  note?: string;
  studentId: string;
}

export default function App() {
  const [view, setView] = useState<View>('home');
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [confusionEvents, setConfusionEvents] = useState<ConfusionEvent[]>([]);
  const [studentClickCount, setStudentClickCount] = useState(0);
  const [studentId] = useState(() => `student-${Math.random().toString(36).substr(2, 9)}`);

  const handleCreateSession = (session: Session) => {
    const newSession = {
      ...session,
      startTime: Date.now()
    };
    setCurrentSession(newSession);
    setConfusionEvents([]);
    setView('ta-dashboard');
  };

  const handleJoinSession = (code: string) => {
    // In a real app, this would validate against the backend
    // For demo, accept any 4-digit code
    if (code.length === 4) {
      const mockSession: Session = {
        code,
        courseName: 'CS 101 - Intro to Programming',
        date: new Date().toLocaleDateString(),
        duration: 60,
        taName: 'Demo TA'
      };
      setCurrentSession(mockSession);
      setStudentClickCount(0);
      setView('student-active');
      return true;
    }
    return false;
  };

  const handleConfusionClick = (note?: string) => {
    const event: ConfusionEvent = {
      timestamp: Date.now(),
      note,
      studentId
    };
    setConfusionEvents(prev => [...prev, event]);
    setStudentClickCount(prev => prev + 1);
  };

  const renderView = () => {
    switch (view) {
      case 'home':
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
              <h1 className="text-center mb-8">Confusion Tracker</h1>
              <div className="space-y-4">
                <div>
                  <h2 className="mb-4">Student</h2>
                  <Button 
                    onClick={() => setView('student-join')} 
                    className="w-full"
                    size="lg"
                  >
                    Join Session
                  </Button>
                </div>
                <div className="pt-4 border-t">
                  <h2 className="mb-4">TA / Professor</h2>
                  <div className="space-y-2">
                    <Button 
                      onClick={() => setView('ta-create')} 
                      className="w-full"
                      variant="outline"
                      size="lg"
                    >
                      Create New Session
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'student-join':
        return (
          <JoinSession 
            onJoin={handleJoinSession}
            onBack={() => setView('home')}
          />
        );

      case 'student-active':
        return (
          <StudentView
            session={currentSession!}
            clickCount={studentClickCount}
            onConfusionClick={handleConfusionClick}
            onExit={() => setView('home')}
          />
        );

      case 'ta-create':
        return (
          <SessionCreator
            onCreateSession={handleCreateSession}
            onBack={() => setView('home')}
          />
        );

      case 'ta-dashboard':
        return (
          <TADashboard
            session={currentSession}
            confusionEvents={confusionEvents}
            onBack={() => setView('home')}
            onViewSummary={() => setView('ta-summary')}
          />
        );

      case 'ta-summary':
        return (
          <SummaryReport
            session={currentSession}
            confusionEvents={confusionEvents}
            onBack={() => setView('ta-dashboard')}
            onHome={() => setView('home')}
          />
        );
    }
  };

  return renderView();
}