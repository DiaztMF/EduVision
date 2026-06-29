'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS } from '@eduvision/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const { socket, isConnected } = useSocket(roomId);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('Please enter a nickname');
      return;
    }
    setJoining(true);
    setError('');

    if (!socket.connected) socket.connect();

    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
      setJoining(false);
      socket.off(EVENTS.ERROR_EVENT, onError);
    };

    const onPlayersUpdate = () => {
      socket.off(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
      socket.off(EVENTS.ERROR_EVENT, onError);
      router.push(`/play/${roomId}?name=${encodeURIComponent(trimmed)}`);
    };

    socket.on(EVENTS.ERROR_EVENT, onError);
    socket.on(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
    socket.emit(EVENTS.JOIN_ROOM, { roomId, playerName: trimmed });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join Room</CardTitle>
          <CardDescription>Enter a nickname to join the game</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={20}
              disabled={joining}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining ? 'Joining...' : 'Join Game'}
          </Button>
          {!isConnected && <p className="text-xs text-muted-foreground text-center">Connecting to server...</p>}
        </CardContent>
      </Card>
    </main>
  );
}
