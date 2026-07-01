'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function JoinIndexPage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const [checking, setChecking] = useState(false);

  const handleNext = async () => {
    const trimmed = roomId.trim();
    if (!trimmed) {
      setError('Please enter a Room ID');
      return;
    }
    
    setChecking(true);
    setError('');
    
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
      const res = await fetch(`${socketUrl}/api/v1/rooms/${trimmed}/verify`);
      
      if (!res.ok) {
        setError('Room not found. Check the ID again.');
        setChecking(false);
        return;
      }
      
      router.push(`/join/${trimmed}`);
    } catch (err) {
      setError('Failed to contact server.');
      setChecking(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join a Class</CardTitle>
          <CardDescription>Enter the Room ID from your Teacher</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roomId">Room ID</Label>
            <Input
              id="roomId"
              placeholder="Example: 4892"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              maxLength={10}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleNext} disabled={checking} className="w-full">
            {checking ? 'Checking...' : 'Next'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
