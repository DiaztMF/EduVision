'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { EVENTS, type LeaderboardEntry } from '@eduvision/shared-types';
import QrPanel from '@/components/QrPanel';
import Lobby from '@/components/Lobby';
import Leaderboard from '@/components/Leaderboard';
import Countdown from '@/components/Countdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Phase = 'lobby' | 'active' | 'ended';

export default function HostRoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { socket, isConnected } = useSocket(roomId);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<Array<{ name: string; score: number; claimedAt: number | null }>>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [durationSec, setDurationSec] = useState(600);

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${roomId}`
    : '';

  useEffect(() => {
    if (!socket.connected) socket.connect();
  }, [socket]);

  useEffect(() => {
    const onPlayersUpdate = (data: { players: Array<{ name: string; score: number; claimedAt: number | null }> }) => {
      setPlayers(data.players);
    };
    const onGameStarted = (data: { endsAt: number; targetLabel: string }) => {
      setPhase('active');
      setEndsAt(data.endsAt);
    };
    const onLeaderboardSync = (data: LeaderboardEntry[]) => {
      setLeaderboard(data);
    };
    const onGameEnded = (data: { leaderboard: LeaderboardEntry[] }) => {
      setPhase('ended');
      setLeaderboard(data.leaderboard);
    };

    socket.on(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
    socket.on(EVENTS.GAME_STARTED, onGameStarted);
    socket.on(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
    socket.on(EVENTS.GAME_ENDED, onGameEnded);

    socket.emit(EVENTS.HOST_JOIN, { roomId });

    return () => {
      socket.off(EVENTS.ROOM_PLAYERS_UPDATE, onPlayersUpdate);
      socket.off(EVENTS.GAME_STARTED, onGameStarted);
      socket.off(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
      socket.off(EVENTS.GAME_ENDED, onGameEnded);
    };
  }, [socket, roomId]);

  const startGame = useCallback(() => {
    socket.emit(EVENTS.START_GAME_SESSION, { roomId, durationSec });
  }, [socket, roomId, durationSec]);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">EduVision</h1>
        <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </div>
      <p className="text-muted-foreground mb-6">Room: <span className="font-mono text-lg">{roomId}</span></p>

      {phase === 'lobby' && (
        <div className="space-y-6">
          <QrPanel joinUrl={joinUrl} />
          <Lobby players={players} />
          <div className="space-y-2">
            <Label htmlFor="duration">Game Duration</Label>
            <Input
              id="duration"
              type="number"
              min={60}
              max={900}
              step={60}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">{durationSec / 60} minutes</p>
          </div>
          <Button onClick={startGame} disabled={players.length === 0} className="w-full">
            Start Game
          </Button>
        </div>
      )}

      {phase === 'active' && endsAt && (
        <div className="space-y-6">
          <Countdown endsAt={endsAt} />
          <Leaderboard entries={leaderboard} />
        </div>
      )}

      {phase === 'ended' && (
        <div className="space-y-6">
          <div className="rounded-lg border-2 border-primary bg-card p-6 text-center">
            <h2 className="text-3xl font-bold">Game Over</h2>
          </div>
          <Leaderboard entries={leaderboard} />
        </div>
      )}
    </main>
  );
}
