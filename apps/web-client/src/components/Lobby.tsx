interface LobbyProps {
  players: Array<{ name: string; score: number; claimedAt: number | null }>;
}

export default function Lobby({ players }: LobbyProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Players Joined ({players.length})</h2>
      <ul className="grid gap-1">
        {players.map((p) => (
          <li
            key={p.name}
            className="rounded-lg border bg-card px-4 py-2 text-card-foreground"
          >
            {p.name}
          </li>
        ))}
      </ul>
      {players.length === 0 && (
        <p className="text-muted-foreground">Waiting for students to join...</p>
      )}
    </div>
  );
}
