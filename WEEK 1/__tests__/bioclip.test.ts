jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: { create: jest.fn() },
  Tensor: jest.fn(),
}));

import { base64ToUint8Array } from '../src/bioclip';

describe('bioclip preprocessing helpers', () => {
  describe('base64ToUint8Array', () => {
    it('decodes base64 string to correct Uint8Array bytes', () => {
      const base64 = 'aGVsbG8gd29ybGQ=';
      const bytes = base64ToUint8Array(base64);
      const decodedString = String.fromCharCode(...bytes);
      expect(decodedString).toBe('hello world');
      expect(bytes.length).toBe(11);
    });

    it('handles empty base64 string', () => {
      const bytes = base64ToUint8Array('');
      expect(bytes.length).toBe(0);
    });

    it('preserves binary byte values 0-255', () => {
      const originalBytes = new Uint8Array([0, 127, 255, 42, 199]);
      let binaryStr = '';
      for (let i = 0; i < originalBytes.length; i += 1) {
        binaryStr += String.fromCharCode(originalBytes[i]);
      }
      const b64 = btoa(binaryStr);
      const recovered = base64ToUint8Array(b64);
      expect(Array.from(recovered)).toEqual([0, 127, 255, 42, 199]);
    });
  });
});
