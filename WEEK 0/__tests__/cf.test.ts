jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: {} }));

import { CfError, call } from '../src/cf';

describe('cf client', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn(async () => ({ json: async () => ({ status: 'OK', result: Date.now() }) })) as jest.Mock;
  });
  afterEach(() => jest.useRealTimers());

  it('spaces consecutive requests at least 2s apart', async () => {
    const results = [call<number>('a'), call<number>('b'), call<number>('c')];
    await jest.advanceTimersByTimeAsync(10_000);
    const [a, b, c] = await Promise.all(results);
    expect(b - a).toBeGreaterThanOrEqual(2000);
    expect(c - b).toBeGreaterThanOrEqual(2000);
  });

  it('throws CfError on a non-OK response and keeps serving later calls', async () => {
    (globalThis.fetch as jest.Mock).mockImplementationOnce(async () => ({
      json: async () => ({ status: 'FAILED', comment: 'handle: User not found' }),
    }));
    const failing = call('user.info');
    const after = call<number>('user.info');
    const failed = expect(failing).rejects.toEqual(new CfError('handle: User not found'));
    await jest.advanceTimersByTimeAsync(10_000);
    await failed;
    await expect(after).resolves.toEqual(expect.any(Number));
  });
});
