import { File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import jpeg from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Image } from 'react-native';
import labelData from '../assets/bioclip_labels.json';
import { rankCandidates, type LabeledEmbedding, type RankedResult } from './rank';

export const BIOCLIP_MODEL_FILENAME = 'bioclip_vision.onnx';
export const bioclipModelFile = new File(Paths.document, BIOCLIP_MODEL_FILENAME);

export type BioClipResult = {
  readonly topCandidates: readonly RankedResult[];
  readonly preprocessTimeMs: number;
  readonly loadTimeMs: number;
  readonly inferenceTimeMs: number;
  readonly totalTimeMs: number;
};

// BioCLIP ViT-B/16 standard input dimensions and OpenAI CLIP normalization parameters
const IMAGE_SIZE = 224;
const OPENAI_CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073] as const;
const OPENAI_CLIP_STD = [0.26862954, 0.26130258, 0.27577711] as const;

/** Convert base64 string to Uint8Array using standard atob. */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Preprocess an image:
 * 1. Center-crop to 1:1 square to avoid stretching 4:3 or 16:9 photos.
 * 2. Resize to 224x224 via expo-image-manipulator.
 * 3. Decode JPEG buffer via jpeg-js.
 * 4. Convert RGBA to channel-first normalized Float32Array [1, 3, 224, 224].
 */
export async function preprocessImage(imageUri: string): Promise<{
  readonly tensor: Tensor;
  readonly durationMs: number;
}> {
  const startTime = Date.now();

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(imageUri, (width, height) => resolve({ width, height }), reject);
  }).catch(() => null);

  const actions: ImageManipulator.Action[] = [];
  if (dimensions && dimensions.width !== dimensions.height) {
    const minDim = Math.min(dimensions.width, dimensions.height);
    const originX = Math.round((dimensions.width - minDim) / 2);
    const originY = Math.round((dimensions.height - minDim) / 2);
    actions.push({ crop: { originX, originY, width: minDim, height: minDim } });
  }
  actions.push({ resize: { width: IMAGE_SIZE, height: IMAGE_SIZE } });

  const manipulated = await ImageManipulator.manipulateAsync(imageUri, actions, {
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!manipulated.base64) {
    throw new Error('Image manipulation failed to yield base64 output');
  }

  const rawBytes = base64ToUint8Array(manipulated.base64);
  const decoded = jpeg.decode(rawBytes, { useTArray: true });
  const pixelCount = IMAGE_SIZE * IMAGE_SIZE;
  const floatArray = new Float32Array(3 * pixelCount);

  // Channels are ordered R, G, B in NCHW format
  const rOffset = 0;
  const gOffset = pixelCount;
  const bOffset = 2 * pixelCount;

  for (let i = 0; i < pixelCount; i += 1) {
    const rgbaIdx = i * 4;
    const r = decoded.data[rgbaIdx] / 255.0;
    const g = decoded.data[rgbaIdx + 1] / 255.0;
    const b = decoded.data[rgbaIdx + 2] / 255.0;

    floatArray[rOffset + i] = (r - OPENAI_CLIP_MEAN[0]) / OPENAI_CLIP_STD[0];
    floatArray[gOffset + i] = (g - OPENAI_CLIP_MEAN[1]) / OPENAI_CLIP_STD[1];
    floatArray[bOffset + i] = (b - OPENAI_CLIP_MEAN[2]) / OPENAI_CLIP_STD[2];
  }

  const tensor = new Tensor('float32', floatArray, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
  const durationMs = Date.now() - startTime;

  return { tensor, durationMs };
}

let sessionPromise: Promise<InferenceSession> | null = null;
let isLoaded = false;

/** Load ONNX inference session from local storage. Reports 0ms on warm calls. */
export async function loadBioClipSession(): Promise<{
  readonly session: InferenceSession;
  readonly loadTimeMs: number;
}> {
  if (!bioclipModelFile.exists) {
    throw new Error(`BioCLIP ONNX model file not found at ${bioclipModelFile.uri}. Sideload via adb push first.`);
  }

  if (sessionPromise && isLoaded) {
    const session = await sessionPromise;
    return { session, loadTimeMs: 0 };
  }

  const start = Date.now();
  sessionPromise = InferenceSession.create(bioclipModelFile.uri);
  try {
    const session = await sessionPromise;
    isLoaded = true;
    const loadTimeMs = Date.now() - start;
    return { session, loadTimeMs };
  } catch (err) {
    sessionPromise = null;
    isLoaded = false;
    throw new Error(`Failed to load BioCLIP ONNX session: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Check if BioCLIP ONNX model is available on device. */
export function isBioClipModelDownloaded(): boolean {
  try {
    return bioclipModelFile.exists;
  } catch {
    return false;
  }
}

/**
 * Classify a photo using BioCLIP ONNX encoder and rank against common Indian species.
 */
export async function classifyWithBioClip(imageUri: string): Promise<BioClipResult> {
  const overallStart = Date.now();

  // 1. Preprocess image
  const { tensor: inputTensor, durationMs: preprocessTimeMs } = await preprocessImage(imageUri);

  // 2. Load model
  const { session, loadTimeMs } = await loadBioClipSession();

  // 3. Run inference
  const inferStart = Date.now();
  const feeds: Record<string, Tensor> = { image: inputTensor };
  const outputs = await session.run(feeds);
  const inferenceTimeMs = Date.now() - inferStart;

  // Extract embedding output
  const outputKey = outputs.embedding ? 'embedding' : Object.keys(outputs)[0];
  const outputTensor = outputs[outputKey];
  const embeddingData = Array.from(outputTensor.data as Float32Array);

  // 4. Rank against precomputed label embeddings
  const candidates: readonly LabeledEmbedding[] = labelData.labels;
  const logitScale = labelData.logit_scale ?? 100.0;
  const topCandidates = rankCandidates(embeddingData, candidates, 5, logitScale);

  const totalTimeMs = Date.now() - overallStart;

  return {
    topCandidates,
    preprocessTimeMs,
    loadTimeMs,
    inferenceTimeMs,
    totalTimeMs,
  };
}
