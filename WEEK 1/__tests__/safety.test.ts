import {
  claimsSafeToEat,
  evaluateSafety,
  sanitizeGemmaContent,
  DEFAULT_COSINE_FLOOR,
} from '../src/safety';
import type { RankedResult } from '../src/rank';

describe('safety layer', () => {
  const calotropis: RankedResult = {
    label: 'Crown Flower / Madar (Calotropis gigantea)',
    scientific_name: 'Calotropis gigantea',
    category: 'plant',
    danger: 'dangerous',
    score: 0.98,
    rawCosine: 0.38,
  };

  const cobra: RankedResult = {
    label: 'Spectacled Cobra (Naja naja)',
    scientific_name: 'Naja naja',
    category: 'snake',
    danger: 'dangerous',
    score: 0.95,
    rawCosine: 0.35,
  };

  const spider: RankedResult = {
    label: 'Signature Spider (Argiope anasuja)',
    scientific_name: 'Argiope anasuja',
    category: 'arachnid',
    danger: 'harmless',
    score: 0.92,
    rawCosine: 0.34,
  };

  const harmlessPlant: RankedResult = {
    label: 'Tulsi / Holy Basil (Ocimum tenuiflorum)',
    scientific_name: 'Ocimum tenuiflorum',
    category: 'plant',
    danger: 'harmless',
    score: 0.91,
    rawCosine: 0.36,
  };

  const candidateB: RankedResult = {
    label: 'Candidate B',
    score: 0.05,
    rawCosine: 0.22,
  };

  const candidateC: RankedResult = {
    label: 'Candidate C',
    score: 0.02,
    rawCosine: 0.20,
  };

  describe('uncertainty rules', () => {
    it('marks result as Uncertain when top score < 0.6', () => {
      const lowConfidenceCandidate: RankedResult = {
        ...calotropis,
        score: 0.55,
      };

      const card = evaluateSafety([lowConfidenceCandidate, candidateB, candidateC]);
      expect(card.isUncertain).toBe(true);
      expect(card.title).toBe('Uncertain');
      expect(card.dangerLevel).toBe('caution');
      expect(card.topCandidates).toHaveLength(3);
    });

    it('marks result as Uncertain when top cosine < COSINE_FLOOR even if score is high', () => {
      const lowCosineCandidate: RankedResult = {
        ...calotropis,
        score: 0.99,
        rawCosine: 0.24, // below floor 0.28
      };

      const card = evaluateSafety([lowCosineCandidate, candidateB, candidateC], 0.28);
      expect(card.isUncertain).toBe(true);
      expect(card.title).toBe('Uncertain');
      expect(card.dangerLevel).toBe('caution');
      expect(card.topCandidates).toHaveLength(3);
    });

    it('returns Uncertain on empty candidate list', () => {
      const card = evaluateSafety([]);
      expect(card.isUncertain).toBe(true);
      expect(card.title).toBe('Uncertain');
      expect(card.dangerLevel).toBe('caution');
      expect(card.topCandidates).toEqual([]);
    });
  });

  describe('danger source rule', () => {
    it('always derives danger level from label data', () => {
      const cardDangerous = evaluateSafety([calotropis, candidateB]);
      expect(cardDangerous.dangerLevel).toBe('dangerous');

      const cardHarmless = evaluateSafety([harmlessPlant, candidateB]);
      expect(cardHarmless.dangerLevel).toBe('harmless');
    });

    it('uses the worst plausible danger among top 3 scoring >= 10%', () => {
      const ratSnake: RankedResult = {
        label: 'Indian Rat Snake (Ptyas mucosa)',
        scientific_name: 'Ptyas mucosa',
        category: 'snake',
        danger: 'harmless',
        score: 0.65,
        rawCosine: 0.35,
      };

      const cobraCandidate: RankedResult = {
        label: 'Spectacled Cobra (Naja naja)',
        scientific_name: 'Naja naja',
        category: 'snake',
        danger: 'dangerous',
        score: 0.30,
        rawCosine: 0.32,
      };

      const otherCandidate: RankedResult = {
        label: 'Candidate Other',
        category: 'animal',
        danger: 'harmless',
        score: 0.05,
        rawCosine: 0.20,
      };

      const card = evaluateSafety([ratSnake, cobraCandidate, otherCandidate]);
      // Rat snake is 65% harmless, but cobra is 30% dangerous -> worst plausible danger is dangerous
      expect(card.dangerLevel).toBe('dangerous');
    });

    it('ignores danger of candidates scoring below 10%', () => {
      const ratSnake: RankedResult = {
        label: 'Indian Rat Snake (Ptyas mucosa)',
        scientific_name: 'Ptyas mucosa',
        category: 'snake',
        danger: 'harmless',
        score: 0.92,
        rawCosine: 0.36,
      };

      const cobraLow: RankedResult = {
        label: 'Spectacled Cobra (Naja naja)',
        scientific_name: 'Naja naja',
        category: 'snake',
        danger: 'dangerous',
        score: 0.05, // < 10%
        rawCosine: 0.20,
      };

      const card = evaluateSafety([ratSnake, cobraLow, candidateC]);
      expect(card.dangerLevel).toBe('harmless');
    });
  });

  describe('category-specific safety rules', () => {
    it('includes edibility warning and disclaimer on all plants', () => {
      const card = evaluateSafety([calotropis]);
      expect(card.edibilityWarning).toBe('Do not eat without expert confirmation');
      expect(card.plantDisclaimer).toContain('never says a wild plant is safe to eat');
    });

    it('includes distance rule, if-bitten first aid and 112 on snakes', () => {
      const card = evaluateSafety([cobra]);
      expect(card.snakeArachnidSafety).toBeDefined();
      expect(card.snakeArachnidSafety?.distanceRule).toContain('2 m');
      expect(card.snakeArachnidSafety?.ifBitten.join(' ')).toContain('limb still');
      expect(card.snakeArachnidSafety?.ifBitten.join(' ')).toContain('Do not cut');
      expect(card.snakeArachnidSafety?.emergencyNumber).toBe('112');
    });

    it('includes distance rule and 112 on arachnids', () => {
      const card = evaluateSafety([spider]);
      expect(card.snakeArachnidSafety).toBeDefined();
      expect(card.snakeArachnidSafety?.emergencyNumber).toBe('112');
    });

    it('shows wildlife protocol and plant warning if any of top 3 matches when uncertain', () => {
      const insectCandidate: RankedResult = {
        label: 'Red Weaver Ant (Oecophylla smaragdina)',
        category: 'insect',
        danger: 'harmless',
        score: 0.45,
        rawCosine: 0.30,
      };

      const snakeCandidate: RankedResult = {
        label: 'Spectacled Cobra (Naja naja)',
        category: 'snake',
        danger: 'dangerous',
        score: 0.30,
        rawCosine: 0.29,
      };

      const plantCandidate: RankedResult = {
        label: 'Crown Flower (Calotropis gigantea)',
        category: 'plant',
        danger: 'dangerous',
        score: 0.15,
        rawCosine: 0.28,
      };

      const card = evaluateSafety([insectCandidate, snakeCandidate, plantCandidate]);
      expect(card.isUncertain).toBe(true);
      expect(card.snakeArachnidSafety).toBeDefined();
      expect(card.snakeArachnidSafety?.emergencyNumber).toBe('112');
      expect(card.edibilityWarning).toBe('Do not eat without expert confirmation');
      expect(card.plantDisclaimer).toBeDefined();
    });
  });

  describe('edibility claim filter', () => {
    it('detects unsafe edibility claims', () => {
      expect(claimsSafeToEat('The berries are edible and sweet.')).toBe(true);
      expect(claimsSafeToEat('This plant is safe to eat when cooked.')).toBe(true);
      expect(claimsSafeToEat('Suitable for consumption in emergencies.')).toBe(true);
      expect(claimsSafeToEat('Leaves are good to eat.')).toBe(true);
    });

    it('does not trigger on warnings or negative statements', () => {
      expect(claimsSafeToEat('This plant is inedible.')).toBe(false);
      expect(claimsSafeToEat('The fruit is not edible.')).toBe(false);
      expect(claimsSafeToEat('Do not eat without expert confirmation.')).toBe(false);
      expect(claimsSafeToEat('Avoid skin contact and do not ingest.')).toBe(false);
    });

    it('drops Gemma content completely if any field claims edibility', () => {
      const unsafeContent = {
        what: 'A wild flower',
        lookalikes: 'None',
        action: 'Safe to eat in small amounts.',
      };
      expect(sanitizeGemmaContent(unsafeContent)).toBeNull();

      const safeContent = {
        what: 'A toxic milkweed shrub with pale crown-shaped flowers.',
        lookalikes: 'Calotropis procera',
        action: 'Avoid touching milky sap; do not ingest.',
      };
      expect(sanitizeGemmaContent(safeContent)).toEqual(safeContent);
    });
  });
});
