jest.mock('react-native-android-widget', () => ({}));

import { gridSvg, ringSvg, widgetToday } from '../src/TodayWidget';

const strokes = (svg: string) => [...svg.matchAll(/stroke="(#[0-9a-f]+)"/g)].map((m) => m[1]);

describe('ringSvg', () => {
  it('draws one segment per target problem, green when solved and gold past the target', () => {
    expect(strokes(ringSvg(3, 1))).toEqual(['#3fb950', '#30363d', '#30363d']);
    expect(strokes(ringSvg(2, 3))).toEqual(['#3fb950', '#3fb950', '#e3b341']);
  });

  it('draws a whole circle for a single segment', () => {
    expect(ringSvg(1, 0)).toContain('<circle');
  });
});

describe('gridSvg', () => {
  it('leaves out days that have not happened yet', () => {
    const svg = gridSvg([[0, 2, -1, -1, -1, -1, -1]], '#38bdf8');
    expect(svg.match(/<rect/g)).toHaveLength(2);
  });
});

describe('widgetToday', () => {
  const targets = { weekday: { problems: 4, minutes: 150 }, weekend: { problems: 6, minutes: 240 } };
  const friday = new Date(2026, 9, 2, 9);
  const saturday = new Date(2026, 9, 3, 9);
  const data = { day: friday.toDateString(), target: 2, targets, accent: '#38bdf8', solves: [[friday.toDateString(), 1]] as [string, number][] };

  it('uses the saved target and count on the day they were saved', () => {
    expect(widgetToday(data, friday)).toEqual({ done: 1, target: 2 });
  });

  it('starts the next day at zero with that day’s plain target', () => {
    expect(widgetToday(data, saturday)).toEqual({ done: 0, target: 6 });
  });
});
