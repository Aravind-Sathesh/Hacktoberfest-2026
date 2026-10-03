import { FULL_GROWTH_MINUTES, stageFor } from '../src/Tree';

describe('stageFor', () => {
  const at = (minutes: number) => stageFor(minutes / FULL_GROWTH_MINUTES);

  it('moves to a new stage every 10 minutes of the 80', () => {
    expect([0, 9, 10, 39, 40, 79].map(at)).toEqual([0, 0, 1, 3, 4, 7]);
  });

  it('stays on the full tree once grown, even past 80 minutes', () => {
    expect([80, 200].map(at)).toEqual([7, 7]);
  });
});
