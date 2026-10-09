import { commonName, dayLabel, matchLabel, seconds } from '../src/format';

describe('format', () => {
  it('strips the trailing scientific name, keeping names without one', () => {
    expect(commonName('Crown Flower / Madar (Calotropis gigantea)')).toBe('Crown Flower / Madar');
    expect(commonName('Bamboo')).toBe('Bamboo');
  });

  it('words the match strength at the 0.6 and 0.9 boundaries', () => {
    expect(matchLabel(0.9)).toBe('Strong match');
    expect(matchLabel(0.6)).toBe('Likely match');
    expect(matchLabel(0.59)).toBe('Weak match');
  });

  it('formats milliseconds as one-decimal seconds', () => {
    expect(seconds(2139)).toBe('2.1 s');
  });

  it('labels days relative to now, across midnight', () => {
    const now = new Date(2026, 9, 8, 0, 30).getTime();
    expect(dayLabel(new Date(2026, 9, 8, 0, 5).getTime(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 9, 7, 23, 50).getTime(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 6, 9, 0).getTime(), now)).toBe('Tue 6 Oct');
  });
});
