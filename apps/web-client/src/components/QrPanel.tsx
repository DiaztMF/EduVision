'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrPanelProps {
  joinUrl: string;
}

export default function QrPanel({ joinUrl }: QrPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, joinUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000', light: '#fff' },
    });
  }, [joinUrl]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} />
      <p className="text-sm text-muted-foreground break-all text-center max-w-xs">{joinUrl}</p>
    </div>
  );
}
