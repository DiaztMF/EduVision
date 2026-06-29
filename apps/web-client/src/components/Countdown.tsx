'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  endsAt: number;
}

export default function Countdown({ endsAt }: CountdownProps) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="text-center">
      <p className="text-5xl font-bold tabular-nums">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </p>
      <p className="text-sm text-muted-foreground">Time Remaining</p>
    </div>
  );
}
