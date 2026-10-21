import { describe, expect, it } from 'vitest';
import {
  autoSelectInterval,
  calculatePercentageDelta,
  DEFAULT_STORE_TIMEZONE,
  getTimezoneOffsetMs,
  resolveDateRange,
} from '../../src/analytics/infrastructure/utils/analytics-date.helper.js';

describe('Analytics Date & Timezone Helper Unit Tests', () => {
  it('correctly calculates UTC+6 timezone offset for Asia/Dhaka', () => {
    const offsetMs = getTimezoneOffsetMs('Asia/Dhaka');
    const offsetHours = offsetMs / (1000 * 60 * 60);
    expect(offsetHours).toBe(6);
  });

  it('resolves 30d range with exact 30-day comparison window', () => {
    const res = resolveDateRange(
      '30d',
      undefined,
      undefined,
      DEFAULT_STORE_TIMEZONE,
    );
    expect(res.period).toBe('30d');
    expect(res.timezone).toBe('Asia/Dhaka');

    const currDuration =
      res.current.end.getTime() - res.current.start.getTime();
    const compDuration =
      res.comparison.end.getTime() - res.comparison.start.getTime();

    expect(currDuration).toBe(30 * 24 * 60 * 60 * 1000);
    expect(compDuration).toBe(30 * 24 * 60 * 60 * 1000);
    expect(res.comparison.end.getTime()).toBe(res.current.start.getTime());
  });

  it('resolves today with exact elapsed hours for fair comparison against yesterday', () => {
    const res = resolveDateRange(
      'today',
      undefined,
      undefined,
      DEFAULT_STORE_TIMEZONE,
    );
    expect(res.period).toBe('today');

    const currDuration =
      res.current.end.getTime() - res.current.start.getTime();
    const compDuration =
      res.comparison.end.getTime() - res.comparison.start.getTime();

    // Elapsed duration today must exactly match comparison duration yesterday
    expect(compDuration).toBe(currDuration);
    // Comparison start is exactly 24 hours prior to current start
    expect(res.current.start.getTime() - res.comparison.start.getTime()).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it('validates custom date ranges properly', () => {
    const start = '2026-01-01T00:00:00.000Z';
    const end = '2026-01-15T00:00:00.000Z';
    const res = resolveDateRange('custom', start, end);

    expect(res.current.start.toISOString()).toBe(start);
    expect(res.current.end.toISOString()).toBe(end);

    // Throws on missing dates
    expect(() => resolveDateRange('custom')).toThrow(
      'Both startDate and endDate are required',
    );

    // Throws when start > end
    expect(() => resolveDateRange('custom', end, start)).toThrow(
      'startDate must be earlier than or equal to endDate',
    );

    // Throws when span > 366 days
    const pastYear = '2024-01-01T00:00:00.000Z';
    expect(() => resolveDateRange('custom', pastYear, end)).toThrow(
      'Custom date range cannot exceed 366 days',
    );
  });

  it('auto-selects interval correctly based on range duration', () => {
    const base = new Date('2026-01-01T00:00:00.000Z');

    // 1 day span -> 'hour'
    const oneDayLater = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    expect(autoSelectInterval(base, oneDayLater)).toBe('hour');

    // 30 days span -> 'day'
    const thirtyDaysLater = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(autoSelectInterval(base, thirtyDaysLater)).toBe('day');

    // 120 days span -> 'week'
    const oneTwentyDaysLater = new Date(
      base.getTime() + 120 * 24 * 60 * 60 * 1000,
    );
    expect(autoSelectInterval(base, oneTwentyDaysLater)).toBe('week');

    // 250 days span -> 'month'
    const twoFiftyDaysLater = new Date(
      base.getTime() + 250 * 24 * 60 * 60 * 1000,
    );
    expect(autoSelectInterval(base, twoFiftyDaysLater)).toBe('month');
  });

  it('enforces maximum points caps on requested intervals', () => {
    const base = new Date('2026-01-01T00:00:00.000Z');
    const tenDaysLater = new Date(base.getTime() + 10 * 24 * 60 * 60 * 1000);

    // 'hour' on 10 days exceeds 7 days limit
    expect(() => autoSelectInterval(base, tenDaysLater, 'hour')).toThrow(
      "Interval 'hour' cannot be used for spans greater than 7 days",
    );

    // 'hour' on 3 days is acceptable
    const threeDaysLater = new Date(base.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(autoSelectInterval(base, threeDaysLater, 'hour')).toBe('hour');
  });

  it('handles percentage delta math cleanly and returns null for zero/null previous periods', () => {
    // Standard growth: 100 -> 150 = +50%
    expect(calculatePercentageDelta(150, 100)).toBe(50);

    // Standard decline: 100 -> 80 = -20%
    expect(calculatePercentageDelta(80, 100)).toBe(-20);

    // Previous is 0: must return null so UI can render "n/a"
    expect(calculatePercentageDelta(100, 0)).toBeNull();

    // Previous is null or undefined
    expect(calculatePercentageDelta(100, null)).toBeNull();
    expect(calculatePercentageDelta(100, undefined)).toBeNull();
  });
});
