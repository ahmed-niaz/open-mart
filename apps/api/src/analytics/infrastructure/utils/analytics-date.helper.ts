/**
 * Default market operational timezone for Open-Mart: Asia/Dhaka (UTC+6).
 */
export const DEFAULT_STORE_TIMEZONE = 'Asia/Dhaka';

export type AnalyticsPeriod =
  'today' | 'yesterday' | '7d' | '30d' | '90d' | '12m' | 'custom';

export type ChartInterval = 'hour' | 'day' | 'week' | 'month';

export interface DateWindow {
  start: Date;
  end: Date;
}

export interface ResolvedDateRange {
  current: DateWindow;
  comparison: DateWindow;
  period: AnalyticsPeriod;
  timezone: string;
}

/**
 * Gets UTC offset in milliseconds for a specific IANA timezone at a reference date.
 */
export function getTimezoneOffsetMs(
  timeZone: string,
  date: Date = new Date(),
): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone }));
  return tzDate.getTime() - utcDate.getTime();
}

/**
 * Resolves standard analytical periods and exact comparison windows
 * aligned with the merchant's operational timezone.
 */
export function resolveDateRange(
  period: AnalyticsPeriod = '30d',
  customStart?: string,
  customEnd?: string,
  timeZone: string = DEFAULT_STORE_TIMEZONE,
): ResolvedDateRange {
  const now = new Date();
  const tzOffset = getTimezoneOffsetMs(timeZone, now);

  // Current time in the merchant's local timezone
  const localNow = new Date(now.getTime() + tzOffset);

  let currentStart: Date;
  let currentEnd: Date;
  let compStart: Date;
  let compEnd: Date;

  switch (period) {
    case 'today': {
      // Midnight today in local timezone
      const localMidnightToday = new Date(localNow);
      localMidnightToday.setUTCHours(0, 0, 0, 0);

      // Translate back to UTC
      currentStart = new Date(localMidnightToday.getTime() - tzOffset);
      currentEnd = now;

      // Elapsed duration so far today in milliseconds
      const elapsedTodayMs = currentEnd.getTime() - currentStart.getTime();

      // Midnight yesterday in local timezone
      const localMidnightYesterday = new Date(localMidnightToday);
      localMidnightYesterday.setUTCDate(
        localMidnightYesterday.getUTCDate() - 1,
      );

      compStart = new Date(localMidnightYesterday.getTime() - tzOffset);
      // Compare to the exact same elapsed time yesterday
      compEnd = new Date(compStart.getTime() + elapsedTodayMs);
      break;
    }

    case 'yesterday': {
      const localMidnightToday = new Date(localNow);
      localMidnightToday.setUTCHours(0, 0, 0, 0);

      const localMidnightYesterday = new Date(localMidnightToday);
      localMidnightYesterday.setUTCDate(
        localMidnightYesterday.getUTCDate() - 1,
      );

      const localEndOfYesterday = new Date(localMidnightToday.getTime() - 1);

      currentStart = new Date(localMidnightYesterday.getTime() - tzOffset);
      currentEnd = new Date(localEndOfYesterday.getTime() - tzOffset);

      // Comparison is the full day before yesterday
      const localDayBefore = new Date(localMidnightYesterday);
      localDayBefore.setUTCDate(localDayBefore.getUTCDate() - 1);

      compStart = new Date(localDayBefore.getTime() - tzOffset);
      compEnd = new Date(localMidnightYesterday.getTime() - 1 - tzOffset);
      break;
    }

    case '7d': {
      const durationMs = 7 * 24 * 60 * 60 * 1000;
      currentEnd = now;
      currentStart = new Date(now.getTime() - durationMs);
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - durationMs);
      break;
    }

    case '90d': {
      const durationMs = 90 * 24 * 60 * 60 * 1000;
      currentEnd = now;
      currentStart = new Date(now.getTime() - durationMs);
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - durationMs);
      break;
    }

    case '12m': {
      const durationMs = 365 * 24 * 60 * 60 * 1000;
      currentEnd = now;
      currentStart = new Date(now.getTime() - durationMs);
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - durationMs);
      break;
    }

    case 'custom': {
      if (!customStart || !customEnd) {
        throw new Error(
          'Both startDate and endDate are required for custom period.',
        );
      }
      currentStart = new Date(customStart);
      currentEnd = new Date(customEnd);

      if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) {
        throw new Error('Invalid ISO date string provided for custom period.');
      }
      if (currentStart > currentEnd) {
        throw new Error('startDate must be earlier than or equal to endDate.');
      }

      const diffMs = currentEnd.getTime() - currentStart.getTime();
      const maxSpanMs = 366 * 24 * 60 * 60 * 1000;
      if (diffMs > maxSpanMs) {
        throw new Error('Custom date range cannot exceed 366 days.');
      }

      compEnd = new Date(currentStart.getTime() - 1);
      compStart = new Date(compEnd.getTime() - diffMs);
      break;
    }

    case '30d':
    default: {
      const durationMs = 30 * 24 * 60 * 60 * 1000;
      currentEnd = now;
      currentStart = new Date(now.getTime() - durationMs);
      compEnd = currentStart;
      compStart = new Date(currentStart.getTime() - durationMs);
      break;
    }
  }

  return {
    current: { start: currentStart, end: currentEnd },
    comparison: { start: compStart, end: compEnd },
    period,
    timezone: timeZone,
  };
}

/**
 * Auto-selects the optimal time-bucket interval for a given date span
 * and validates that the requested interval will not return an excessive number of points.
 */
export function autoSelectInterval(
  start: Date,
  end: Date,
  requestedInterval?: ChartInterval,
): ChartInterval {
  const spanMs = end.getTime() - start.getTime();
  const spanDays = spanMs / (24 * 60 * 60 * 1000);

  if (requestedInterval) {
    if (requestedInterval === 'hour' && spanDays > 7) {
      throw new Error(
        "Interval 'hour' cannot be used for spans greater than 7 days (maximum 168 points).",
      );
    }
    if (requestedInterval === 'day' && spanDays > 366) {
      throw new Error(
        "Interval 'day' cannot be used for spans greater than 366 days.",
      );
    }
    return requestedInterval;
  }

  if (spanDays <= 2) {
    return 'hour';
  }
  if (spanDays <= 90) {
    return 'day';
  }
  if (spanDays <= 180) {
    return 'week';
  }
  return 'month';
}

/**
 * Calculates percentage delta between current and previous periods.
 * Returns null if previous period is 0 or null (so UI can cleanly render "n/a").
 */
export function calculatePercentageDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current === null || current === undefined) {
    return null;
  }
  if (previous === null || previous === undefined || previous === 0) {
    return null;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta * 10) / 10;
}
