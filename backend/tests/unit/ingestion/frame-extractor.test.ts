import { describe, it, expect } from 'vitest';
import {
  buildFrameMessage,
  generateS3Key,
  validateFrameResolution,
} from '../../../src/ingestion/frame-extractor';

describe('Frame Extractor', () => {
  describe('buildFrameMessage', () => {
    it('crea un FrameMessage completo con UUID', () => {
      const msg = buildFrameMessage(
        'pilot-1',
        'session-abc',
        1700000000000,
        'raw-frames/session-abc/pilot-1/1700000000000.jpg',
        { width: 1920, height: 1080 },
        42,
        'kvs-stream-1'
      );

      expect(msg.frameId).toMatch(/^[0-9a-f-]{36}$/);
      expect(msg.pilotoId).toBe('pilot-1');
      expect(msg.sessionId).toBe('session-abc');
      expect(msg.timestamp).toBe(1700000000000);
      expect(msg.s3Key).toContain('raw-frames');
      expect(msg.resolution.width).toBe(1920);
      expect(msg.resolution.height).toBe(1080);
      expect(msg.sequenceNumber).toBe(42);
      expect(msg.streamName).toBe('kvs-stream-1');
    });

    it('genera frameIds únicos', () => {
      const msg1 = buildFrameMessage('p1', 's1', 1, 'k1', { width: 1920, height: 1080 }, 0, 'st');
      const msg2 = buildFrameMessage('p1', 's1', 2, 'k2', { width: 1920, height: 1080 }, 1, 'st');
      expect(msg1.frameId).not.toBe(msg2.frameId);
    });
  });

  describe('generateS3Key', () => {
    it('genera key con formato correcto', () => {
      const key = generateS3Key('session-123', 'pilot-1', 1700000000000);
      expect(key).toBe('raw-frames/session-123/pilot-1/1700000000000.jpg');
    });
  });

  describe('validateFrameResolution', () => {
    it('1920×1080 es válido (Full HD)', () => {
      expect(validateFrameResolution({ width: 1920, height: 1080 })).toBe(true);
    });

    it('1280×720 es válido (720p mínimo)', () => {
      expect(validateFrameResolution({ width: 1280, height: 720 })).toBe(true);
    });

    it('640×480 es inválido (menor a 720p)', () => {
      expect(validateFrameResolution({ width: 640, height: 480 })).toBe(false);
    });

    it('1280×600 es inválido (altura insuficiente)', () => {
      expect(validateFrameResolution({ width: 1280, height: 600 })).toBe(false);
    });
  });
});
