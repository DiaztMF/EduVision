import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">EduVision</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-md">
        Outdoor Educational Gamification with Edge AI
      </p>
      <div className="flex gap-4">
        <Link
          href="/host"
          className="rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Teacher / Host
        </Link>
        <Link
          href="/join"
          className="rounded-lg border border-input bg-background px-6 py-3 font-medium hover:bg-accent transition-colors"
        >
          Student / Join
        </Link>
      </div>
    </main>
  );
}
