import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { ArrowLeft, LogIn } from 'lucide-react';

interface JoinSessionProps {
  onJoin: (code: string) => boolean;
  onBack: () => void;
}

export function JoinSession({ onJoin, onBack }: JoinSessionProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 4) {
      setError('Session code must be 4 digits');
      return;
    }

    const success = onJoin(code);
    if (!success) {
      setError('Invalid or expired session code');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCode(value);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-center">Join Session</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block mb-2">
              Enter 4-digit session code
            </label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              placeholder="1234"
              value={code}
              onChange={handleInputChange}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            disabled={code.length !== 4}
          >
            <LogIn className="mr-2 h-5 w-5" />
            Join Session
          </Button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-center text-muted-foreground">
            Your TA will provide the session code at the start of class
          </p>
        </div>
      </Card>
    </div>
  );
}
