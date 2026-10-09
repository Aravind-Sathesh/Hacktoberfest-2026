import type { RankedResult } from './rank';

export type DangerLevel = 'harmless' | 'caution' | 'dangerous';

/**
 * Calibrated cosine similarity floor separating known in-distribution species
 * from out-of-distribution organisms and non-organism objects.
 */
export const DEFAULT_COSINE_FLOOR = 0.28;

export type SnakeArachnidSafety = {
  readonly distanceRule: string;
  readonly ifBitten: readonly string[];
  readonly emergencyNumber: string;
};

export type SafetyCardModel = {
  readonly isUncertain: boolean;
  readonly title: string;
  readonly scientificName?: string;
  readonly category?: string;
  readonly dangerLevel: DangerLevel;
  readonly confidenceScore: number;
  readonly rawCosine: number;
  readonly topCandidates: readonly RankedResult[];
  readonly edibilityWarning?: string;
  readonly plantDisclaimer?: string;
  readonly snakeArachnidSafety?: SnakeArachnidSafety;
};

const SAFE_EATING_WARNING = 'Do not eat without expert confirmation';
const PLANT_DISCLAIMER =
  'Many wild plants have poisonous look-alikes. TrailKit never says a wild plant is safe to eat.';
// Source: National Snakebite Management Protocol, Government of India ("Do it R.I.G.H.T." first-aid protocol)
const SNAKE_DISTANCE_RULE = 'Stay at least 2 m away. Do not corner, touch or provoke it.';
const SNAKE_IF_BITTEN: readonly string[] = [
  'Stay calm and keep the person calm.',
  'Keep the bitten limb still, and move as little as possible.',
  'Get to the nearest hospital straight away.',
  'Tell the doctor when the bite happened and what the animal looked like.',
  'Do not cut the wound, suck the venom or tie a tourniquet.',
];
const EMERGENCY_NUMBER = '112';

/**
 * Pattern matching claims that a wild specimen is safe to eat or consume.
 * Explicitly excludes warnings like "not edible", "inedible", "never eat".
 */
const UNSAFE_EDIBILITY_REGEX =
  /(?:^|[^\w-])(?:(?<!not\s+|never\s+|in-)edible|safe\s+to\s+eat|good\s+to\s+eat|can\s+(?:safely\s+)?be\s+eaten|suitable\s+for\s+consumption|safe\s+for\s+consumption)(?:$|[^\w-])/i;

/**
 * Checks if a string contains claims that an organism is edible or safe to eat.
 */
export function claimsSafeToEat(text: string): boolean {
  return UNSAFE_EDIBILITY_REGEX.test(text);
}

/**
 * Sanitizes Gemma card output: drops all Gemma text if any field claims
 * edibility or safety to eat. Returns null if unsafe.
 */
export function sanitizeGemmaContent<T extends { what: string; lookalikes: string; action: string }>(
  content: T | null,
): T | null {
  if (!content) return null;
  if (
    claimsSafeToEat(content.what) ||
    claimsSafeToEat(content.lookalikes) ||
    claimsSafeToEat(content.action)
  ) {
    return null;
  }
  return content;
}

/**
 * Resolves the worst (highest) danger level among the top 3 candidates
 * with score >= 10% (0.10). Falls back to top candidate's danger or 'caution'.
 */
export function resolvePlausibleDanger(candidates: readonly RankedResult[]): DangerLevel {
  const plausible = candidates.slice(0, 3).filter((c) => c.score >= 0.10);
  if (plausible.length === 0) {
    const topDanger = candidates[0]?.danger;
    return topDanger === 'dangerous' || topDanger === 'caution' || topDanger === 'harmless'
      ? topDanger
      : 'caution';
  }
  if (plausible.some((c) => c.danger === 'dangerous')) return 'dangerous';
  if (plausible.some((c) => c.danger === 'caution')) return 'caution';
  return 'harmless';
}

/**
 * Pure safety evaluation mapping BioCLIP ranked candidates to the final card model.
 * Enforces:
 * 1. Uncertain if top score < 0.6 OR top cosine < cosineFloor.
 * 2. Danger level uses the worst plausible match (highest danger among top 3 scoring >= 10%).
 * 3. Uncertain checks all of the top 3 candidates for plant edibility warnings and wildlife protocols.
 * 4. Mandatory edibility warning + disclaimer on plants.
 * 5. Distance rule + if-bitten first aid + emergency 112 on snakes and arachnids.
 */
export function evaluateSafety(
  candidates: readonly RankedResult[],
  cosineFloor = DEFAULT_COSINE_FLOOR,
): SafetyCardModel {
  if (candidates.length === 0) {
    return {
      isUncertain: true,
      title: 'Uncertain',
      dangerLevel: 'caution',
      confidenceScore: 0,
      rawCosine: 0,
      topCandidates: [],
    };
  }

  const top = candidates[0];
  const isScoreBelowThreshold = top.score < 0.6;
  const isCosineBelowFloor = top.rawCosine < cosineFloor;
  const isUncertain = isScoreBelowThreshold || isCosineBelowFloor;

  const top3 = candidates.slice(0, 3);
  const hasPlantInTop3 = top3.some((c) => c.category === 'plant');
  const hasSnakeOrArachnidInTop3 = top3.some((c) => c.category === 'snake' || c.category === 'arachnid');

  if (isUncertain) {
    return {
      isUncertain: true,
      title: 'Uncertain',
      category: top.category,
      dangerLevel: 'caution',
      confidenceScore: top.score,
      rawCosine: top.rawCosine,
      topCandidates: top3,
      edibilityWarning: hasPlantInTop3 ? SAFE_EATING_WARNING : undefined,
      plantDisclaimer: hasPlantInTop3 ? PLANT_DISCLAIMER : undefined,
      snakeArachnidSafety: hasSnakeOrArachnidInTop3
        ? {
            distanceRule: SNAKE_DISTANCE_RULE,
            ifBitten: SNAKE_IF_BITTEN,
            emergencyNumber: EMERGENCY_NUMBER,
          }
        : undefined,
    };
  }

  const worstDanger = resolvePlausibleDanger(candidates);
  const isPlant =
    top.category === 'plant' || top3.some((c) => c.score >= 0.10 && c.category === 'plant');
  const isSnakeOrArachnid =
    top.category === 'snake' ||
    top.category === 'arachnid' ||
    top3.some((c) => c.score >= 0.10 && (c.category === 'snake' || c.category === 'arachnid'));

  return {
    isUncertain: false,
    title: top.label,
    scientificName: top.scientific_name,
    category: top.category,
    dangerLevel: worstDanger,
    confidenceScore: top.score,
    rawCosine: top.rawCosine,
    topCandidates: candidates.slice(0, 5),
    edibilityWarning: isPlant ? SAFE_EATING_WARNING : undefined,
    plantDisclaimer: isPlant ? PLANT_DISCLAIMER : undefined,
    snakeArachnidSafety: isSnakeOrArachnid
      ? {
          distanceRule: SNAKE_DISTANCE_RULE,
          ifBitten: SNAKE_IF_BITTEN,
          emergencyNumber: EMERGENCY_NUMBER,
        }
      : undefined,
  };
}
