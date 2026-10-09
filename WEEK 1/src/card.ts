import type { RankedResult } from './rank';
import { sanitizeGemmaContent } from './safety';

export type GemmaCard = {
  readonly what: string;
  readonly lookalikes: string;
  readonly action: string;
};

export const cardJsonSchema = {
  type: 'object',
  properties: {
    what: {
      type: 'string',
      description: 'One short sentence describing what this organism is and key visual traits',
    },
    lookalikes: {
      type: 'string',
      description: 'One short sentence on notable lookalikes or distinguishing traits',
    },
    action: {
      type: 'string',
      description: 'One short sentence on practical hiker precautions',
    },
  },
  required: ['what', 'lookalikes', 'action'],
  additionalProperties: false,
};

/**
 * Pure prompt builder: prompts Gemma with only the top species BioCLIP identified.
 * On confident results, Gemma describes only the top-1 species.
 */
export function buildGemmaPrompt(
  candidates: readonly { readonly label: string; readonly scientific_name?: string }[],
): string {
  const top = candidates[0];
  if (!top) {
    throw new Error('Cannot build Gemma prompt without at least one candidate species');
  }
  const topSpecies = `${top.label}${top.scientific_name ? ` (${top.scientific_name})` : ''}`;

  return (
    `You are a field biology guide for wilderness hikers. BioCLIP identified the following species from a trail photograph:\n` +
    `- ${topSpecies}\n\n` +
    `Provide concise field notes for this identified species in JSON format with exactly three fields:\n` +
    `- "what": one short sentence describing what this organism is and key visual traits.\n` +
    `- "lookalikes": one short sentence on distinguishing traits from notable lookalikes.\n` +
    `- "action": one short sentence on practical hiker precautions.\n` +
    `CRITICAL SAFETY RULE: You may ONLY describe the candidate species listed above. Do NOT claim any wild plant, berry or mushroom is edible or safe to eat.`
  );
}

/**
 * Pure parser and validator for Gemma's JSON output.
 * Ensures all required fields are valid non-empty strings and enforces
 * the safety filter (drops text if safe eating/edibility is claimed).
 */
export function parseGemmaCard(rawOutput: string): GemmaCard | null {
  if (!rawOutput || !rawOutput.trim()) {
    return null;
  }

  try {
    // Strip potential markdown code blocks if the model wrapped them
    const trimmed = rawOutput.trim();
    let jsonStr = trimmed.startsWith('```')
      ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      : trimmed;

    // Slice up to the last closing brace in case of trailing tokens
    const lastBraceIdx = jsonStr.lastIndexOf('}');
    if (lastBraceIdx !== -1 && lastBraceIdx < jsonStr.length - 1) {
      jsonStr = jsonStr.substring(0, lastBraceIdx + 1);
    }

    const parsed = JSON.parse(jsonStr);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.what !== 'string' ||
      typeof parsed.lookalikes !== 'string' ||
      typeof parsed.action !== 'string'
    ) {
      return null;
    }

    const what = parsed.what.trim();
    const lookalikes = parsed.lookalikes.trim();
    const action = parsed.action.trim();

    if (!what || !lookalikes || !action) {
      return null;
    }

    const rawCard: GemmaCard = { what, lookalikes, action };

    // Safety layer check: drops Gemma text if it mentions eating as safe
    return sanitizeGemmaContent(rawCard);
  } catch {
    return null;
  }
}
