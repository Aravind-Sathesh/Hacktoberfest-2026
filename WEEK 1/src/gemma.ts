import { totalMemory } from 'expo-device';
import { File, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';

export const GEMMA_MODEL_URL =
  'https://huggingface.co/unsloth/gemma-4-E2B-it-qat-GGUF/resolve/main/gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf';
export const GEMMA_MMPROJ_URL =
  'https://huggingface.co/unsloth/gemma-4-E2B-it-qat-GGUF/resolve/main/mmproj-F16.gguf';

export const GEMMA_MODEL_FILENAME = 'gemma-4-e2b.gguf';
export const GEMMA_MMPROJ_FILENAME = 'mmproj-f16.gguf';

export const gemmaModelFile = new File(Paths.document, GEMMA_MODEL_FILENAME);
export const gemmaMmprojFile = new File(Paths.document, GEMMA_MMPROJ_FILENAME);

// Phones sold as 6 GB RAM report around 5.5 GB in totalMemory
const MIN_MEMORY_BYTES = 5 * 1024 ** 3;

export const canRunGemma = () => totalMemory === null || totalMemory >= MIN_MEMORY_BYTES;

export const isGemmaDownloaded = () => {
  try {
    return gemmaModelFile.exists;
  } catch {
    return false;
  }
};

export const isMmprojDownloaded = () => {
  try {
    return gemmaMmprojFile.exists;
  } catch {
    return false;
  }
};

export type GemmaInferenceResult = {
  readonly text: string;
  readonly loadTimeMs: number;
  readonly multimodalInitTimeMs?: number;
  readonly inferenceTimeMs: number;
  readonly tokensPerSecond?: number;
  readonly isMultimodal: boolean;
};

let contextPromise: Promise<LlamaContext> | null = null;
let isContextLoaded = false;
let multimodalInitialized = false;

let currentThreadCount = 4;

export function setGemmaThreadCount(threads: number): void {
  if (currentThreadCount !== threads) {
    currentThreadCount = threads;
    if (contextPromise) {
      contextPromise.then((ctx) => ctx.release()).catch(() => undefined);
      contextPromise = null;
      isContextLoaded = false;
    }
  }
}

export function getGemmaThreadCount(): number {
  return currentThreadCount;
}

async function loadContext(): Promise<{
  readonly context: LlamaContext;
  readonly loadDurationMs: number;
}> {
  if (!canRunGemma()) {
    const memoryDisplay =
      totalMemory !== null ? `${(totalMemory / 1024 ** 3).toFixed(1)} GB` : 'insufficient';
    throw new Error(
      `Insufficient device memory to run Gemma. Device has ${memoryDisplay} RAM, minimum required is 5.0 GB.`,
    );
  }

  if (!gemmaModelFile.exists) {
    throw new Error(`Gemma GGUF model file not found at ${gemmaModelFile.uri}. Sideload via adb push first.`);
  }

  if (contextPromise && isContextLoaded) {
    const context = await contextPromise;
    return { context, loadDurationMs: 0 }; // Warm run reports 0ms
  }

  const startTime = Date.now();
  contextPromise = initLlama({
    model: gemmaModelFile.uri,
    n_ctx: 2048,
    n_threads: currentThreadCount,
    use_mmap: true,
    use_mlock: false,
  });

  try {
    const context = await contextPromise;
    isContextLoaded = true;
    const loadDurationMs = Date.now() - startTime;
    return { context, loadDurationMs };
  } catch (err) {
    contextPromise = null;
    isContextLoaded = false;
    throw new Error(`Failed to initialize Gemma llama.rn context: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Single-completion queue: llama context can only run one completion at a time
let completionQueue: Promise<unknown> = Promise.resolve();

function enqueueCompletion<T>(task: () => Promise<T>): Promise<T> {
  const next = completionQueue.then(task, task);
  completionQueue = next.catch(() => undefined);
  return next;
}

/** Run a text prompt completion on Gemma. */
export async function completeText(prompt: string, maxTokens = 120): Promise<GemmaInferenceResult> {
  return enqueueCompletion(async () => {
    const { context, loadDurationMs } = await loadContext();

    const inferStart = Date.now();
    const result = await context.completion({
      messages: [{ role: 'user', content: prompt }],
      n_predict: maxTokens,
      temperature: 0.3,
      enable_thinking: false,
    });
    const inferenceTimeMs = Date.now() - inferStart;

    const timings = result.timings;
    const tokensPerSecond =
      timings && timings.predicted_per_second ? Math.round(timings.predicted_per_second * 10) / 10 : undefined;

    return {
      text: result.content.trim(),
      loadTimeMs: loadDurationMs,
      inferenceTimeMs,
      tokensPerSecond,
      isMultimodal: false,
    };
  });
}

/** Run a JSON-constrained text completion on Gemma. */
export async function completeJson(
  prompt: string,
  schema?: object,
  maxTokens = 100,
): Promise<{ readonly rawText: string; readonly durationMs: number }> {
  return enqueueCompletion(async () => {
    const { context } = await loadContext();
    const start = Date.now();
    const result = await context.completion({
      messages: [{ role: 'user', content: prompt }],
      n_predict: maxTokens,
      temperature: 0.2,
      enable_thinking: false,
      response_format: schema ? { type: 'json_schema', json_schema: { schema } } : undefined,
    });
    const rawText = result.content.trim();
    console.log('[Gemma JSON raw]:', rawText);
    return {
      rawText,
      durationMs: Date.now() - start,
    };
  });
}

/** Run an image + text multimodal prompt on Gemma via mmproj. */
export async function completeVision(
  imageUri: string,
  prompt: string,
  maxTokens = 120,
): Promise<GemmaInferenceResult> {
  return enqueueCompletion(async () => {
    const { context, loadDurationMs } = await loadContext();

    if (!gemmaMmprojFile.exists) {
      throw new Error(`mmproj projector file not found at ${gemmaMmprojFile.uri}. Sideload via adb push first.`);
    }

    let multimodalInitTimeMs = 0;
    // Initialize multimodal projector once on the loaded context and time it separately
    if (!multimodalInitialized) {
      const mmStart = Date.now();
      try {
        const mmInitOk = await context.initMultimodal({
          path: gemmaMmprojFile.uri,
          use_gpu: true,
          image_min_tokens: 256,
          image_max_tokens: 512,
        });
        if (!mmInitOk) {
          throw new Error('initMultimodal returned false (unsupported projector or model backend)');
        }
        multimodalInitialized = true;
        multimodalInitTimeMs = Date.now() - mmStart;
      } catch (err) {
        multimodalInitialized = false;
        throw new Error(`Multimodal projector initialization failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    let normalizedPath = imageUri;
    if (normalizedPath.startsWith('file://')) {
      normalizedPath = normalizedPath.slice(7);
    }

    const inferStart = Date.now();
    const result = await context.completion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: normalizedPath } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      n_predict: maxTokens,
      temperature: 0.3,
      enable_thinking: false,
    });
    const inferenceTimeMs = Date.now() - inferStart;

    const timings = result.timings;
    const tokensPerSecond =
      timings && timings.predicted_per_second ? Math.round(timings.predicted_per_second * 10) / 10 : undefined;

    return {
      text: result.content.trim(),
      loadTimeMs: loadDurationMs,
      multimodalInitTimeMs: multimodalInitTimeMs > 0 ? multimodalInitTimeMs : undefined,
      inferenceTimeMs,
      tokensPerSecond,
      isMultimodal: true,
    };
  });
}
