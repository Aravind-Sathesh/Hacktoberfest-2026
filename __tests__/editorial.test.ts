import { editorialSection } from '../src/editorial';

const filler = (word: string) => Array(20).fill(word).join(' ');

const text = [
  'Thanks for participating!',
  '2000A - Primary Task',
  '2000B - Seating in a Bus',
  '2000A - Primary Task',
  filler('alpha'),
  'Code',
  '2000B - Seating in a Bus',
  filler('beta'),
].join('\n');

describe('editorialSection', () => {
  it('skips the table of contents and stops at the next problem', () => {
    expect(editorialSection(text, 'Primary Task', ['Seating in a Bus'])).toBe(`${filler('alpha')}\nCode`);
    expect(editorialSection(text, 'Seating in a Bus', ['Primary Task'])).toBe(filler('beta'));
  });

  it('returns null when the problem is not in the editorial', () => {
    expect(editorialSection(text, 'Turtle and Paths', ['Primary Task'])).toBeNull();
  });
});
