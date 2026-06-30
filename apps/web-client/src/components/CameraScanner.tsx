'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { InferenceResult } from '@/lib/YOLOInferenceEngine';

interface CameraScannerProps {
  onDetection: (confidence: number) => void;
  disabled: boolean;
  isLoaded: boolean;
  loadingProgress: number;
  runInference: (canvas: HTMLCanvasElement) => Promise<InferenceResult[]>;
}

export default function CameraScanner({ onDetection, disabled, isLoaded, loadingProgress, runInference }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Kamera tidak tersedia. Pastikan akses via HTTPS (ngrok) atau localhost.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 320 }, height: { ideal: 320 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraReady(true);
      } catch (err) {
        console.error('Camera error:', err);
        setError('Camera access denied. Please allow camera permissions.');
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (isLoaded && cameraReady && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error('Video play error:', e));
      };
    }
  }, [isLoaded, cameraReady]);

  const handleScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || disabled) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Hitung crop untuk mengambil kotak tengah (center square) dari video frame
    // Ini mensimulasikan efek CSS `object-cover` agar AI melihat hal yang sama dengan user
    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.drawImage(
      video,
      startX, startY, size, size, // Koordinat crop dari source video
      0, 0, 320, 320              // Koordinat tujuan di canvas
    );
    setScanning(true);

    try {
      const results = await runInference(canvas);
      const plasticBottle = results.find(
        r => r.className === 'plastic_bottle' && r.confidence >= 0.65
      );
      if (plasticBottle) {
        onDetection(plasticBottle.confidence);
      } else {
        setError('No plastic bottle detected. Try again.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Inference failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [onDetection, disabled, runInference]);

  if (!isLoaded) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading AI model ({loadingProgress}%)...</p>
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${loadingProgress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-square max-w-sm mx-auto overflow-hidden rounded-lg bg-muted">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">Starting camera...</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button
        onClick={handleScan}
        disabled={!cameraReady || disabled || scanning}
        className="w-full"
        size="lg"
      >
        {scanning ? 'Scanning...' : disabled ? 'Already Scanned' : 'Scan Object'}
      </Button>
      {disabled && (
        <p className="text-xs text-muted-foreground text-center">
          You have already claimed a bottle. Great job!
        </p>
      )}
    </div>
  );
}
