import { totalMemory } from 'expo-device';
import { File, Paths } from 'expo-file-system';
import { initLlama, type LlamaContext } from 'llama.rn';
import type { Problem } from './cf';
import {
  FALLBACK_ROASTS,
  hintsPrompt,
  hintsSchema,
  type Message,
  type RoastEvent,
  cleanLine,
  parseHints,
  roastPrompt,
} from './prompts';

export const MODEL_URL =
  'https://huggingface.co/unsloth/gemma-4-E2B-it-qat-GGUF/resolve/main/gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf';
export const MODEL_SIZE_LABEL = '2.6 GB';

const modelFile = new File(Paths.document, 'gemma-4-e2b.gguf');
// Downloads land here first so an interrupted download never looks like a model.
const partialFile = new File(Paths.document, 'gemma-4-e2b.gguf.part');

// Below this the OS kills the app while the model loads; phones sold as 6 GB report about 5.5.
const MIN_MEMORY_BYTES = 5 * 1024 ** 3;

/** Unknown memory counts as enough, so a missing reading never hides Gemma. */
export const canRunGemma = () => totalMemory === null || totalMemory >= MIN_MEMORY_BYTES;

export const isModelDownloaded = () => modelFile.exists;

let download: Promise<void> | null = null;
let reportProgress: (fraction: number) => void = () => {};

export const isDownloading = () => download !== null;

/** Survives screen changes: calling again while a download runs just reattaches the progress callback. */
export function downloadModel(onProgress: (fraction: number) => void): Promise<void> {
  reportProgress = onProgress;
  download ??= (async () => {
    if (partialFile.exists) partialFile.delete();
    const task = File.createDownloadTask(MODEL_URL, partialFile, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        if (totalBytes > 0) reportProgress(bytesWritten / totalBytes);
      },
    });
    await task.downloadAsync();
    partialFile.move(modelFile);
  })().finally(() => {
    download = null;
  });
  return download;
}

let contextPromise: Promise<LlamaContext | null> | null = null;

function loadContext(): Promise<LlamaContext | null> {
  if (!canRunGemma() || !modelFile.exists) return Promise.resolve(null);
  // mmap keeps the weights in page cache instead of app memory. The hint prompt carries an editorial excerpt.
  contextPromise ??= initLlama({ model: modelFile.uri, n_ctx: 4096, use_mmap: true, use_mlock: false }).catch(() => {
    contextPromise = null;
    return null;
  });
  return contextPromise;
}

// One llama context can only run one completion at a time.
let queue: Promise<unknown> = Promise.resolve();

/** The model's reply, or null when the model is missing or fails; callers fall back. */
function complete(messages: Message[], maxTokens: number, schema?: object, temperature = 0.7): Promise<string | null> {
  const run = async () => {
    const context = await loadContext();
    if (!context) return null;
    try {
      const result = await context.completion({
        messages,
        n_predict: maxTokens,
        temperature,
        enable_thinking: false,
        response_format: schema ? { type: 'json_schema', json_schema: { schema } } : undefined,
      });
      return result.content;
    } catch {
      return null;
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

export async function roast(event: RoastEvent): Promise<string> {
  const text = await complete(roastPrompt(event), 60);
  return (text && cleanLine(text)) ?? FALLBACK_ROASTS[event.kind];
}

/** The hint ladder for one problem, vaguest first; empty when the model is missing or fails. */
export async function hints(problem: Problem, editorial: string): Promise<string[]> {
  // Cooler than chat-style lines: hints should follow the editorial, not riff on it.
  const text = await complete(hintsPrompt(problem, editorial), 300, hintsSchema, 0.4);
  return text ? parseHints(text, problem.tags, editorial) : [];
}
