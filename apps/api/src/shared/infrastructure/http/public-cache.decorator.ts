import { SetMetadata } from '@nestjs/common';

export const PUBLIC_CACHE_KEY = 'PUBLIC_CACHE_OPTIONS';
export const NO_CACHE_KEY = 'NO_CACHE';

export interface PublicCacheOptions {
  /**
   * Time in seconds that the response may be cached by shared caches (e.g., CDNs, reverse proxies).
   * @default 60
   */
  sMaxAge?: number;

  /**
   * Time in seconds that a stale response may be served by CDNs while revalidating in the background.
   * @default 120
   */
  staleWhileRevalidate?: number;

  /**
   * Time in seconds that the response may be cached in private browser caches.
   * Omitted or 0 by default to ensure clients revalidate with edge CDN.
   */
  maxAge?: number;

  /**
   * Tells caches they must strictly obey the freshness information.
   * @default false
   */
  mustRevalidate?: boolean;

  /**
   * Additional custom cache directives (e.g. 'immutable').
   */
  directives?: string[];
}

/**
 * Builds standard Cache-Control header string from options.
 */
export function buildCacheControlHeader(
  options: PublicCacheOptions = {},
): string {
  const parts: string[] = ['public'];

  const sMaxAge = options.sMaxAge ?? 60;
  parts.push(`s-maxage=${sMaxAge}`);

  const staleWhileRevalidate =
    options.staleWhileRevalidate !== undefined
      ? options.staleWhileRevalidate
      : sMaxAge * 2;
  parts.push(`stale-while-revalidate=${staleWhileRevalidate}`);

  if (options.maxAge !== undefined) {
    parts.push(`max-age=${options.maxAge}`);
  }

  if (options.mustRevalidate) {
    parts.push('must-revalidate');
  }

  if (options.directives && options.directives.length > 0) {
    parts.push(...options.directives);
  }

  return parts.join(', ');
}

/**
 * Marks a controller or route handler for public CDN and Edge caching.
 * Emits standard `Cache-Control: public, s-maxage=..., stale-while-revalidate=...` headers.
 */
export const PublicCache = (options: PublicCacheOptions = {}) =>
  SetMetadata(PUBLIC_CACHE_KEY, options);

/**
 * Explicitly forces `Cache-Control: no-store, private` on a specific handler,
 * even if applied within a controller decorated with `@PublicCache`.
 */
export const NoCache = () => SetMetadata(NO_CACHE_KEY, true);
