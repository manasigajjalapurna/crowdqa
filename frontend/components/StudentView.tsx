import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { AlertCircle, LogOut } from 'lucide-react';

interface Session {
  code: string;
  courseName: string;
}

interface StudentViewProps {
  session: Session;
  clickCount: number;
  onConfusionClick: (note?: string) => void;
  onExit: () => void;
}

export function StudentView({ session, clickCount, onConfusionClick, onExit }: StudentViewProps) {
  const [note, setNote] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleConfusionClick = () => {
    onConfusionClick(note.trim() || undefined);
    setShowFeedback(true);
    setNote('');
    
    setTimeout(() => {
      setShowFeedback(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{session.courseName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm">Session Code:</span>
              <Badge variant="secondary" className="tracking-wider">
                {session.code}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onExit}>
            <LogOut className="h-4 w-4 mr-2" />
            Exit
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-6">
          {/* Confusion Button */}
          <Card className="p-12 text-center bg-white shadow-xl">
            <div className="space-y-6">
              <h2 className="text-muted-foreground">Feeling lost? Let your TA know.</h2>
              
              <Button
                onClick={handleConfusionClick}
                size="lg"
                className="h-40 w-40 rounded-full mx-auto"
                variant="destructive"
              >
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="h-12 w-12" />
                  <span className="text-xl">I'm Confused</span>
                </div>
              </Button>

              {/* Click Counter */}
              <div className="pt-4">
                <p className="text-muted-foreground">
                  You've indicated confusion <span className="font-semibold text-foreground">{clickCount}</span> {clickCount === 1 ? 'time' : 'times'}
                </p>
              </div>

              {/* Feedback Animation */}
              {showFeedback && (
                <div className="text-green-600 animate-in fade-in duration-300">
                  ✓ Feedback sent
                </div>
              )}
            </div>
          </Card>

          {/* Optional Note */}
          <Card className="p-6 bg-white shadow-md">
            <label htmlFor="note" className="block mb-3">
              Optional: Add a quick note (what's confusing?)
            </label>
            <Textarea
              id="note"
              placeholder="e.g., Didn't understand example 2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mb-3"
            />
            <p className="text-sm text-muted-foreground">
              Your feedback is anonymous and helps your TA improve the session
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
