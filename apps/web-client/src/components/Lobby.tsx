interface LobbyProps {
  players: Array<{ name: string; score: number; claimedAt: number | null; aiProgress?: number }>;
}

export default function Lobby({ players }: LobbyProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Players Joined ({players.length})</h2>
      <ul className="grid gap-2">
        {players.map((p) => (
          <li
            key={p.name}
            className="flex flex-col rounded-lg border bg-card px-4 py-3 text-card-foreground shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.name}</span>
              {(p.aiProgress ?? 0) >= 100 ? (
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">✅ Ready</span>
              ) : (
                <span className="text-sm text-muted-foreground animate-pulse">
                  ⏳ Loading AI ({p.aiProgress ?? 0}%)
                </span>
              )}
            </div>
            {(p.aiProgress ?? 0) < 100 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${p.aiProgress ?? 0}%` }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {players.length === 0 && (
        <p className="text-muted-foreground">Waiting for students to join...</p>
      )}
    </div>
  );
}
