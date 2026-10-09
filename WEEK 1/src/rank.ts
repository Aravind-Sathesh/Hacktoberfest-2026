/**
 * Pure functions for vector normalization, cosine similarity, softmax and top-k ranking.
 */

export type LabeledEmbedding = {
  readonly label: string;
  readonly embedding: readonly number[];
  readonly scientific_name?: string;
  readonly category?: string;
  readonly danger?: string;
};

export type RankedResult = {
  readonly label: string;
  readonly score: number;
  readonly rawCosine: number;
  readonly scientific_name?: string;
  readonly category?: string;
  readonly danger?: string;
};

/** L2 normalize a vector to unit length. */
export function l2Normalize(vector: readonly number[]): number[] {
  let sumSquares = 0;
  for (let i = 0; i < vector.length; i += 1) {
    sumSquares += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) {
    return new Array(vector.length).fill(0);
  }
  const normalized = new Array<number>(vector.length);
  for (let i = 0; i < vector.length; i += 1) {
    normalized[i] = vector[i] / norm;
  }
  return normalized;
}

/** Compute dot product of two vectors of equal length. */
export function dotProduct(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** Cosine similarity between two vectors. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const normA = l2Normalize(a);
  const normB = l2Normalize(b);
  return dotProduct(normA, normB);
}

/** Numerically stable softmax converting raw scores/logits to probabilities summing to 1. */
export function softmax(logits: readonly number[], temperature = 1.0): number[] {
  if (logits.length === 0) {
    return [];
  }
  const temp = temperature <= 0 ? 1.0 : temperature;
  let maxLogit = -Infinity;
  for (let i = 0; i < logits.length; i += 1) {
    if (logits[i] > maxLogit) {
      maxLogit = logits[i];
    }
  }

  const expValues = new Array<number>(logits.length);
  let expSum = 0;
  for (let i = 0; i < logits.length; i += 1) {
    const exp = Math.exp((logits[i] - maxLogit) / temp);
    expValues[i] = exp;
    expSum += exp;
  }

  if (expSum === 0) {
    const uniform = 1 / logits.length;
    return new Array(logits.length).fill(uniform);
  }

  return expValues.map((val) => val / expSum);
}

/**
 * Rank candidate label embeddings against an image embedding.
 * Applies BioCLIP logit_scale, computes softmax over ALL candidate labels,
 * and returns the top-k highest scoring candidates with raw cosine similarities.
 */
export function rankCandidates(
  imageEmbedding: readonly number[],
  candidates: readonly LabeledEmbedding[],
  topK = 5,
  logitScale = 100.0,
): RankedResult[] {
  if (candidates.length === 0 || topK <= 0) {
    return [];
  }

  const normalizedImage = l2Normalize(imageEmbedding);

  // 1. Calculate cosine similarity for all candidates
  const similarities = candidates.map((candidate) =>
    dotProduct(normalizedImage, l2Normalize(candidate.embedding)),
  );

  // 2. Scale by BioCLIP logit_scale
  const logits = similarities.map((sim) => sim * logitScale);

  // 3. Softmax across ALL candidates so probabilities are globally calibrated
  const probabilities = softmax(logits);

  // 4. Pair with labels and sort descending by score
  const scored: RankedResult[] = candidates.map((candidate, index) => ({
    label: candidate.label,
    score: probabilities[index],
    rawCosine: similarities[index],
    scientific_name: candidate.scientific_name,
    category: candidate.category,
    danger: candidate.danger,
  }));

  scored.sort((a, b) => b.score - a.score);

  // 5. Return top-k
  return scored.slice(0, Math.min(topK, scored.length));
}
