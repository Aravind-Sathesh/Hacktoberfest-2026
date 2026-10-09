import {
  cosineSimilarity,
  dotProduct,
  l2Normalize,
  rankCandidates,
  softmax,
  type LabeledEmbedding,
} from '../src/rank';

describe('rank math', () => {
  describe('l2Normalize', () => {
    it('normalizes a 3D vector to unit length', () => {
      const vec = [3, 4, 0];
      const normalized = l2Normalize(vec);
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
      expect(normalized[2]).toBeCloseTo(0.0, 5);
      const length = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0));
      expect(length).toBeCloseTo(1.0, 5);
    });

    it('handles zero vector without NaN', () => {
      const zero = [0, 0, 0];
      const result = l2Normalize(zero);
      expect(result).toEqual([0, 0, 0]);
    });
  });

  describe('dotProduct', () => {
    it('computes dot product of matching length vectors', () => {
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
    });

    it('throws error on mismatched lengths', () => {
      expect(() => dotProduct([1, 2], [1, 2, 3])).toThrow('Vector length mismatch');
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical direction and 0 for orthogonal vectors', () => {
      expect(cosineSimilarity([2, 0], [5, 0])).toBeCloseTo(1.0, 5);
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5);
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5);
    });
  });

  describe('softmax', () => {
    it('produces probabilities that sum to 1', () => {
      const logits = [2.0, 1.0, 0.1, -1.0];
      const probs = softmax(logits);
      const sum = probs.reduce((acc, v) => acc + v, 0);
      expect(sum).toBeCloseTo(1.0, 5);
      expect(probs[0]).toBeGreaterThan(probs[1]);
      expect(probs[1]).toBeGreaterThan(probs[2]);
      expect(probs[2]).toBeGreaterThan(probs[3]);
    });

    it('returns empty array for empty input', () => {
      expect(softmax([])).toEqual([]);
    });
  });

  describe('rankCandidates', () => {
    it('ranks known embeddings in expected top-5 order with calibrated logit_scale', () => {
      // Query vector along the X axis
      const imageEmbedding = [1.0, 0.0, 0.0];

      // 7 candidates with decreasing alignment to the X axis
      const candidates: LabeledEmbedding[] = [
        { label: 'Candidate F (distant)', embedding: [0.1, 0.9, 0.0] },
        { label: 'Candidate A (closest)', embedding: [0.99, 0.1, 0.0] },
        { label: 'Candidate G (orthogonal)', embedding: [0.0, 1.0, 0.0] },
        { label: 'Candidate C (3rd)', embedding: [0.8, 0.5, 0.0] },
        { label: 'Candidate B (2nd)', embedding: [0.9, 0.3, 0.0] },
        { label: 'Candidate E (5th)', embedding: [0.6, 0.7, 0.0] },
        { label: 'Candidate D (4th)', embedding: [0.7, 0.6, 0.0] },
      ];

      // Using logitScale = 10.0
      const ranked = rankCandidates(imageEmbedding, candidates, 5, 10.0);

      // Verify exactly top 5 returned
      expect(ranked).toHaveLength(5);

      // Verify expected ordering: A > B > C > D > E
      expect(ranked[0].label).toBe('Candidate A (closest)');
      expect(ranked[1].label).toBe('Candidate B (2nd)');
      expect(ranked[2].label).toBe('Candidate C (3rd)');
      expect(ranked[3].label).toBe('Candidate D (4th)');
      expect(ranked[4].label).toBe('Candidate E (5th)');

      // Verify monotonic score decay
      for (let i = 0; i < ranked.length - 1; i += 1) {
        expect(ranked[i].score).toBeGreaterThan(ranked[i + 1].score);
      }

      // Ranking all 7 candidates should sum to 1 across the full label distribution
      const allRanked = rankCandidates(imageEmbedding, candidates, 7, 10.0);
      const totalScore = allRanked.reduce((acc, item) => acc + item.score, 0);
      expect(totalScore).toBeCloseTo(1.0, 5);
    });

    it('scores a clear match above the 0.6 confidence threshold with logit_scale 100', () => {
      const query = [1, 0, 0];
      const candidates: LabeledEmbedding[] = [
        { label: 'Clear Match', embedding: [0.95, 0.31, 0] },
        { label: 'Distant 1', embedding: [0.5, 0.86, 0] },
        { label: 'Distant 2', embedding: [0.2, 0.98, 0] },
      ];

      const ranked = rankCandidates(query, candidates, 5, 100.0);
      expect(ranked[0].label).toBe('Clear Match');
      expect(ranked[0].score).toBeGreaterThan(0.6);
    });

    it('handles empty candidates list gracefully', () => {
      const ranked = rankCandidates([1, 0], [], 5);
      expect(ranked).toEqual([]);
    });

    it('handles candidate count fewer than topK', () => {
      const candidates: LabeledEmbedding[] = [
        { label: 'Alpha', embedding: [1, 0] },
        { label: 'Beta', embedding: [0, 1] },
      ];
      const ranked = rankCandidates([1, 0], candidates, 5);
      expect(ranked).toHaveLength(2);
      const totalScore = ranked.reduce((acc, item) => acc + item.score, 0);
      expect(totalScore).toBeCloseTo(1.0, 5);
    });
  });
});
