import type { LeaderboardEntry } from '@eduvision/shared-types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
}

export default function Leaderboard({ entries }: LeaderboardProps) {
  const maxScore = Math.max(...entries.map(e => e.score), 1);
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Leaderboard</h2>
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div
            key={entry.playerName}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <span className="text-lg font-bold text-muted-foreground w-6">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{entry.playerName}</p>
              <div className="h-2 rounded-full bg-muted mt-1 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(entry.score / maxScore) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
