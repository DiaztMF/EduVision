'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useYOLOInference } from '@/hooks/useYOLOInference';
import { EVENTS } from '@eduvision/shared-types';
import CameraScanner from '@/components/CameraScanner';
import Countdown from '@/components/Countdown';
import { Button } from '@/components/ui/button';

type GamePhase = 'waiting' | 'active' | 'ended';

export default function PlayRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const playerName = searchParams.get('name') ?? '';
  const { socket, isConnected } = useSocket(roomId);
  const { isLoaded, loadingProgress, runInference } = useYOLOInference();
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [targetLabel, setTargetLabel] = useState('');
  const [hasClaimed, setHasClaimed] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');
  const [gameEndedData, setGameEndedData] = useState<{ leaderboard: Array<{ playerName: string; score: number }> } | null>(null);
  const hasClaimedRef = useRef(false);

  useEffect(() => {
    if (!playerName) {
      router.push(`/join/${roomId}`);
    }
  }, [playerName, roomId, router]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
  }, [socket]);

  useEffect(() => {
    const onGameStarted = (data: { endsAt: number; targetLabel: string }) => {
      setGamePhase('active');
      setEndsAt(data.endsAt);
      setTargetLabel(data.targetLabel);
    };
    const onLeaderboardSync = (data: Array<{ playerName: string; score: number; claimedAt: number | null }>) => {
      const me = data.find(e => e.playerName === playerName);
      if (me) {
        setScore(me.score);
        if (me.claimedAt !== null) {
          setHasClaimed(true);
          hasClaimedRef.current = true;
        }
      }
    };
    const onGameEnded = (data: { leaderboard: Array<{ playerName: string; score: number; claimedAt: number | null }> }) => {
      setGamePhase('ended');
      setGameEndedData({ leaderboard: data.leaderboard });
    };
    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
    };

    socket.on(EVENTS.GAME_STARTED, onGameStarted);
    socket.on(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
    socket.on(EVENTS.GAME_ENDED, onGameEnded);
    socket.on(EVENTS.ERROR_EVENT, onError);

    return () => {
      socket.off(EVENTS.GAME_STARTED, onGameStarted);
      socket.off(EVENTS.LEADERBOARD_SYNC, onLeaderboardSync);
      socket.off(EVENTS.GAME_ENDED, onGameEnded);
      socket.off(EVENTS.ERROR_EVENT, onError);
    };
  }, [socket, playerName]);

  const onDetection = useCallback((confidence: number) => {
    if (hasClaimedRef.current) return;
    hasClaimedRef.current = true;
    setHasClaimed(true);
    socket.emit(EVENTS.CLAIM_SCORE, {
      roomId,
      playerName,
      confidenceScore: confidence,
      timestamp: Date.now(),
    });
  }, [socket, roomId, playerName]);

  return (
    <main className="min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">EduVision</h1>
          <span className="text-sm text-muted-foreground">Player: {playerName}</span>
        </div>

        {gamePhase === 'waiting' && (
          <div className="text-center py-16 space-y-6">
            <p className="text-lg text-muted-foreground">Waiting for the teacher to start the game...</p>
            
            <div className="w-full max-w-xs mx-auto border rounded-lg p-4 bg-muted/50">
              {!isLoaded ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">Preloading AI model ({loadingProgress}%)...</p>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${loadingProgress}%` }} />
                  </div>
                </>
              ) : (
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">✅ AI Model Ready for Game</p>
              )}
            </div>

            {!isConnected && <p className="text-sm text-destructive mt-2">Connecting to server...</p>}
          </div>
        )}

        {gamePhase === 'active' && endsAt && (
          <>
            <Countdown endsAt={endsAt} />
            <p className="text-center text-sm text-muted-foreground">
              Find and scan: <span className="font-semibold text-foreground">{targetLabel}</span>
            </p>

            <CameraScanner 
              onDetection={onDetection} 
              disabled={hasClaimed} 
              isLoaded={isLoaded}
              loadingProgress={loadingProgress}
              runInference={runInference}
            />

            {hasClaimed && (
              <div className="rounded-lg border border-green-500 bg-green-50 dark:bg-green-950 p-4 text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-300">Bottle Scanned! +100</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  You have submitted your scan. Well done!
                </p>
              </div>
            )}

            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </>
        )}

        {gamePhase === 'ended' && (
          <div className="text-center py-8 space-y-4">
            <h2 className="text-2xl font-bold">Game Over</h2>
            <p className="text-lg">Your score: {score}</p>
            {gameEndedData && (
              <div className="space-y-1">
                <p className="font-semibold">Final Standings:</p>
                {gameEndedData.leaderboard.map((entry, i) => (
                  <p key={entry.playerName}>
                    {i + 1}. {entry.playerName} — {entry.score}
                  </p>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
