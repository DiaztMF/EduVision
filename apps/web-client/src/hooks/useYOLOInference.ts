'use client';
import { useEffect, useRef, useState } from 'react';
import { YOLOInferenceEngine, type InferenceResult } from '@/lib/YOLOInferenceEngine';

export function useYOLOInference() {
  const engineRef = useRef<YOLOInferenceEngine | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const engine = new YOLOInferenceEngine();
      try {
        setLoadingProgress(10);
        await engine.initEngine();
        if (cancelled) return;
        setLoadingProgress(100);
        engineRef.current = engine;
        setIsLoaded(true);
      } catch (err) {
        console.error('Failed to load YOLO model:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const runInference = async (canvas: HTMLCanvasElement): Promise<InferenceResult[]> => {
    if (!engineRef.current) throw new Error('Engine not loaded');
    return engineRef.current.runInference(canvas);
  };

  return { isLoaded, loadingProgress, runInference };
}
