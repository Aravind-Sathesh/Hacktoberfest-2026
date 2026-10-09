import { buildGemmaPrompt, parseGemmaCard } from '../src/card';

describe('Gemma card prompt and parser', () => {
  describe('buildGemmaPrompt', () => {
    it('builds prompt containing top-1 candidate only and safety warnings', () => {
      const candidates = [
        {
          label: 'Crown Flower / Madar (Calotropis gigantea)',
          scientific_name: 'Calotropis gigantea',
        },
        {
          label: 'Giant Milkweed (Calotropis procera)',
          scientific_name: 'Calotropis procera',
        },
      ];

      const prompt = buildGemmaPrompt(candidates);
      expect(prompt).toContain('Calotropis gigantea');
      expect(prompt).not.toContain('Calotropis procera');
      expect(prompt).toContain('"what"');
      expect(prompt).toContain('"lookalikes"');
      expect(prompt).toContain('"action"');
      expect(prompt).toContain('CRITICAL SAFETY RULE');
    });
  });

  describe('parseGemmaCard', () => {
    it('parses valid JSON response', () => {
      const json = JSON.stringify({
        what: 'A common roadside shrub with waxy, pale lilac flowers.',
        lookalikes: 'Calotropis procera, which has darker purple petals.',
        action: 'Wear gloves if handling; milky latex can irritate eyes.',
      });

      const parsed = parseGemmaCard(json);
      expect(parsed).toEqual({
        what: 'A common roadside shrub with waxy, pale lilac flowers.',
        lookalikes: 'Calotropis procera, which has darker purple petals.',
        action: 'Wear gloves if handling; milky latex can irritate eyes.',
      });
    });

    it('parses JSON wrapped in markdown code blocks', () => {
      const markdown = '```json\n{"what":"A snake","lookalikes":"None","action":"Keep distance"}\n```';
      const parsed = parseGemmaCard(markdown);
      expect(parsed).toEqual({
        what: 'A snake',
        lookalikes: 'None',
        action: 'Keep distance',
      });
    });

    it('returns null on invalid JSON or missing required fields', () => {
      expect(parseGemmaCard('not a json')).toBeNull();
      expect(parseGemmaCard('{"what":"Just what"}')).toBeNull();
      expect(parseGemmaCard('')).toBeNull();
      expect(parseGemmaCard('{"what":"","lookalikes":"x","action":"y"}')).toBeNull();
    });

    it('drops card text if edibility is claimed', () => {
      const unsafeJson = JSON.stringify({
        what: 'A shrub with purple flowers.',
        lookalikes: 'None',
        action: 'The flowers are edible and sweet.',
      });
      expect(parseGemmaCard(unsafeJson)).toBeNull();
    });
  });
});
