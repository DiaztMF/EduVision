### Task 7: Edge AI Integration (YOLOv8 via onnxruntime-web)

**Files:**
- Create: `apps/web-client/src/lib/YOLOInferenceEngine.ts`
- Create: `apps/web-client/src/hooks/useYOLOInference.ts`
- Modify: `apps/web-client/src/components/CameraScanner.tsx`
- Copy: `best.onnx` to `apps/web-client/public/models/best.onnx`

**Step 1: Create `apps/web-client/src/lib/YOLOInferenceEngine.ts`**

Full YOLOv8 inference engine with onnxruntime-web, preprocessing, NMS post-processing.

```typescript
import * as ort from 'onnxruntime-web';

export interface InferenceResult {
  className: string;
  confidence: number;
  boundingBox: [number, number, number, number];
}

export class YOLOInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private readonly modelPath = '/models/best.onnx';
  private readonly targetDim = 320;
  private readonly labels = ['plastic_bottle'];
  private readonly confThreshold = 0.65;
  private readonly iouThreshold = 0.45;

  async initEngine(): Promise<void> {
    this.session = await ort.InferenceSession.create(this.modelPath, {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    });
  }

  async runInference(canvasElement: HTMLCanvasElement): Promise<InferenceResult[]> {
    if (!this.session) throw new Error('ONNX_SESSION_NOT_INITIALIZED');
    const ctx = canvasElement.getContext('2d');
    if (!ctx) throw new Error('CANVAS_CONTEXT_ERROR');
    const tensorInput = this.preprocessCanvasImageData(ctx);
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensorInput;
    const outputMap = await this.session.run(feeds);
    const outputTensor = outputMap[this.session.outputNames[0]];
    return this.postProcessYOLOv8(outputTensor);
  }

  private preprocessCanvasImageData(ctx: CanvasRenderingContext2D): ort.Tensor {
    const imgData = ctx.getImageData(0, 0, this.targetDim, this.targetDim);
    const float32Buffer = new Float32Array(1 * 3 * this.targetDim * this.targetDim);
    let rIdx = 0;
    let gIdx = this.targetDim * this.targetDim;
    let bIdx = this.targetDim * this.targetDim * 2;
    for (let i = 0; i < imgData.data.length; i += 4) {
      float32Buffer[rIdx++] = imgData.data[i] / 255.0;
      float32Buffer[gIdx++] = imgData.data[i + 1] / 255.0;
      float32Buffer[bIdx++] = imgData.data[i + 2] / 255.0;
    }
    return new ort.Tensor('float32', float32Buffer, [1, 3, this.targetDim, this.targetDim]);
  }

  private postProcessYOLOv8(outputTensor: ort.Tensor): InferenceResult[] {
    const data = outputTensor.data as Float32Array;
    const [, channels, numAnchors] = outputTensor.dims as number[];
    const numClasses = channels - 4;
    const candidates: InferenceResult[] = [];
    for (let a = 0; a < numAnchors; a++) {
      let bestScore = 0;
      let bestClass = -1;
      for (let c = 0; c < numClasses; c++) {
        const score = data[(4 + c) * numAnchors + a];
        if (score > bestScore) { bestScore = score; bestClass = c; }
      }
      if (bestScore < this.confThreshold) continue;
      const cx = data[0 * numAnchors + a];
      const cy = data[1 * numAnchors + a];
      const w = data[2 * numAnchors + a];
      const h = data[3 * numAnchors + a];
      candidates.push({
        className: this.labels[bestClass] ?? `class_${bestClass}`,
        confidence: bestScore,
        boundingBox: [cx - w / 2, cy - h / 2, w, h],
      });
    }
    return this.nonMaxSuppression(candidates);
  }

  private nonMaxSuppression(boxes: InferenceResult[]): InferenceResult[] {
    const sorted = boxes.sort((a, b) => b.confidence - a.confidence);
    const kept: InferenceResult[] = [];
    for (const box of sorted) {
      if (kept.every((k) => this.iou(k.boundingBox, box.boundingBox) < this.iouThreshold)) {
        kept.push(box);
      }
    }
    return kept;
  }

  private iou(a: number[], b: number[]): number {
    const [ax, ay, aw, ah] = a;
    const [bx, by, bw, bh] = b;
    const x1 = Math.max(ax, bx);
    const y1 = Math.max(ay, by);
    const x2 = Math.min(ax + aw, bx + bw);
    const y2 = Math.min(ay + ah, by + bh);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const union = aw * ah + bw * bh - inter;
    return union <= 0 ? 0 : inter / union;
  }
}
```

**Step 2: Create `apps/web-client/src/hooks/useYOLOInference.ts`**

```typescript
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
```

**Step 3: Replace CameraScanner.tsx with YOLO-wired version**

The CameraScanner needs to use `useYOLOInference` instead of simulated detection. Full code in the plan at docs/superpowers/plans/2026-06-29-eduvision-mvp.md lines 2110-2236. Key changes:
- Import `useYOLOInference` instead of just Button
- Show loading progress while model downloads
- Call `runInference(canvas)` in handleScan
- Filter results for `plastic_bottle` with C>=0.65
- Show error if no bottle detected

**Step 4: Copy model file**

```bash
copy D:\Project\Web Project\Enuma\EduVision\best.onnx apps\web-client\public\models\best.onnx
```

**Step 5: Verify build**

Run: `cd apps/web-client && pnpm exec next build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add apps/web-client/src/lib/YOLOInferenceEngine.ts apps/web-client/src/hooks/useYOLOInference.ts apps/web-client/src/components/CameraScanner.tsx apps/web-client/public/models/best.onnx
git commit -m "feat: integrate YOLOv8 inference with onnxruntime-web"
```
