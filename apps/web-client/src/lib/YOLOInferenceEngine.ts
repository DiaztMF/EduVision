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
  private readonly confThreshold = 0.15;
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
