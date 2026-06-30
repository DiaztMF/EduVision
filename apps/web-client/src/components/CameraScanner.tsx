'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Flashlight, FlashlightOff, Camera } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  
  // Flashlight state
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Kamera tidak tersedia. Pastikan akses via HTTPS (ngrok) atau localhost.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1280 }, 
            height: { ideal: 720 }
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraReady(true);

        // Check flashlight capability
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities && track.getCapabilities();
        // @ts-ignore - TS doesn't always know about torch in capabilities
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        }
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

  // 10-second timer to show fallback
  useEffect(() => {
    if (cameraReady && !disabled) {
      const timer = setTimeout(() => {
        setShowFallback(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [cameraReady, disabled]);

  useEffect(() => {
    if (isLoaded && cameraReady && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error('Video play error:', e));
      };
    }
  }, [isLoaded, cameraReady]);

  const toggleFlashlight = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !flashlightOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setFlashlightOn(nextState);
      } catch (err) {
        console.error('Failed to toggle flashlight', err);
      }
    }
  }, [flashlightOn]);

  const executeInference = useCallback(async (canvas: HTMLCanvasElement) => {
    setScanning(true);
    try {
      const results = await runInference(canvas);
      const plasticBottle = results.find(
        r => r.className === 'plastic_bottle' && r.confidence >= 0.15
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
  }, [onDetection, runInference]);

  const handleScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || disabled) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.drawImage(
      video,
      startX, startY, size, size,
      0, 0, 320, 320
    );
    
    await executeInference(canvas);
  }, [disabled, executeInference]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !canvasRef.current || disabled) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = canvasRef.current!;
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = Math.min(img.width, img.height);
      const startX = (img.width - size) / 2;
      const startY = (img.height - size) / 2;

      ctx.drawImage(
        img,
        startX, startY, size, size,
        0, 0, 320, 320
      );
      
      await executeInference(canvas);
    };
    img.src = URL.createObjectURL(file);
  }, [disabled, executeInference]);

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
        
        {/* Flashlight Button Overlay */}
        {torchSupported && cameraReady && !disabled && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute top-2 right-2 rounded-full opacity-80 hover:opacity-100"
            onClick={toggleFlashlight}
          >
            {flashlightOn ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
          </Button>
        )}

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
        {scanning ? 'Scanning...' : disabled ? 'Already Scanned' : 'Scan Live Camera'}
      </Button>

      {/* Fallback Static Photo Upload */}
      {showFallback && !disabled && (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Kamera lambat/buram? Gunakan foto statis:
          </p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning || disabled}
            className="w-full"
          >
            <Camera className="w-4 h-4 mr-2" />
            Ambil Foto & Kirim
          </Button>
        </div>
      )}

      {disabled && (
        <p className="text-xs text-muted-foreground text-center">
          You have already claimed a bottle. Great job!
        </p>
      )}
    </div>
  );
}
