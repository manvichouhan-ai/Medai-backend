import { describe, it, expect } from '@jest/globals';
import { computeAdherenceRate, computeStreak, computeDelayMean } from '../../src/utils/adherence.utils.js';

describe('Adherence Utils', () => {
  describe('computeAdherenceRate', () => {
    it('returns 0 for empty logs', () => {
      expect(computeAdherenceRate([])).toBe(0);
    });

    it('calculates 100% for all taken', () => {
      const logs = [{ status: 'taken' }, { status: 'taken' }, { status: 'taken' }];
      expect(computeAdherenceRate(logs)).toBe(100);
    });

    it('counts delayed as taken for adherence', () => {
      const logs = [{ status: 'taken' }, { status: 'delayed' }, { status: 'missed' }];
      expect(computeAdherenceRate(logs)).toBe(67);
    });

    it('returns 0 for all missed', () => {
      const logs = [{ status: 'missed' }, { status: 'missed' }];
      expect(computeAdherenceRate(logs)).toBe(0);
    });
  });

  describe('computeStreak', () => {
    it('returns 0 for empty logs', () => {
      expect(computeStreak([])).toBe(0);
    });

    it('counts consecutive taken/delayed from most recent', () => {
      const now = new Date();
      const logs = [
        { status: 'taken', scheduledTime: new Date(now - 1000) },
        { status: 'taken', scheduledTime: new Date(now - 2000) },
        { status: 'missed', scheduledTime: new Date(now - 3000) },
        { status: 'taken', scheduledTime: new Date(now - 4000) },
      ];
      expect(computeStreak(logs)).toBe(2);
    });
  });

  describe('computeDelayMean', () => {
    it('returns 0 for no delayed logs', () => {
      const logs = [{ status: 'taken', delayMinutes: 0 }];
      expect(computeDelayMean(logs)).toBe(0);
    });

    it('averages delay minutes', () => {
      const logs = [
        { status: 'delayed', delayMinutes: 10 },
        { status: 'delayed', delayMinutes: 20 },
        { status: 'taken', delayMinutes: 0 },
      ];
      expect(computeDelayMean(logs)).toBe(15);
    });
  });
});
