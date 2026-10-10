import { echoes, parseHints } from '../src/prompts';

describe('parseHints', () => {
  const editorial = 'Note that the answer never decreases when we sort the array, so we only check adjacent pairs.';

  it('drops pointing hints that name a tag or recite the editorial, but lets the last ones state it', () => {
    const text = JSON.stringify({
      hints: [
        'try dp over prefixes?',
        'the answer never decreases when we sort, right?',
        'what happens to the answer if you sort first?',
        'the answer never decreases when we sort the array.',
      ],
    });
    expect(parseHints(text, ['dp'], editorial)).toEqual([
      'what happens to the answer if you sort first?',
      'the answer never decreases when we sort the array.',
    ]);
  });

  it('returns nothing for broken json', () => {
    expect(parseHints('not json', [], editorial)).toEqual([]);
  });
});

describe('echoes', () => {
  const editorial = 'Note that the answer never decreases when we sort the array, so we only check adjacent pairs.';

  it('catches six words in a row lifted from the editorial', () => {
    expect(echoes('hm, the answer never decreases when we sort. why?', editorial)).toBe(true);
  });

  it('allows a reply that only shares a few words', () => {
    expect(echoes('what happens to the answer if you sort first?', editorial)).toBe(false);
  });
});
