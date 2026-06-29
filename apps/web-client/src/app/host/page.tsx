'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const MODULES = [
  {
    id: 1,
    title: 'Plastic Bottle Hunt',
    targetLabel: 'plastic_bottle',
    description: 'Find and scan plastic bottles around campus to score points and clean up litter.',
  },
];

export default function HostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createRoom = async (moduleId: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'}/api/v1/rooms/create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleId }),
        }
      );
      const data = await res.json();
      if (data.success) {
        router.push(`/host/${data.roomId}`);
      } else {
        setError('Failed to create room');
      }
    } catch {
      setError('Could not connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
      <p className="text-muted-foreground mb-8">Select a learning module to start a game session</p>
      {error && <p className="text-destructive mb-4">{error}</p>}
      <div className="grid gap-4">
        {MODULES.map((mod) => (
          <Card key={mod.id}>
            <CardHeader>
              <CardTitle>{mod.title}</CardTitle>
              <CardDescription>{mod.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => createRoom(mod.id)} disabled={loading}>
                {loading ? 'Creating...' : 'Create Room'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
