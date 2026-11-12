import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import {
  buildCacheControlHeader,
  NO_CACHE_KEY,
  PUBLIC_CACHE_KEY,
} from '../../src/shared/infrastructure/http/public-cache.decorator.js';
import {
  DEFAULT_NO_CACHE_HEADER,
  HttpCacheInterceptor,
} from '../../src/shared/infrastructure/http/public-cache.interceptor.js';

describe('Public Cache & CDN Edge Infrastructure', () => {
  describe('buildCacheControlHeader helper', () => {
    it('generates standard default public caching directives (s-maxage=60, stale-while-revalidate=120)', () => {
      const header = buildCacheControlHeader();
      expect(header).toBe('public, s-maxage=60, stale-while-revalidate=120');
    });

    it('generates customized s-maxage and defaults stale-while-revalidate to 2x s-maxage', () => {
      const header = buildCacheControlHeader({ sMaxAge: 300 });
      expect(header).toBe('public, s-maxage=300, stale-while-revalidate=600');
    });

    it('honors explicitly specified staleWhileRevalidate', () => {
      const header = buildCacheControlHeader({
        sMaxAge: 60,
        staleWhileRevalidate: 300,
      });
      expect(header).toBe('public, s-maxage=60, stale-while-revalidate=300');
    });

    it('includes browser maxAge and mustRevalidate when configured', () => {
      const header = buildCacheControlHeader({
        sMaxAge: 60,
        staleWhileRevalidate: 120,
        maxAge: 10,
        mustRevalidate: true,
      });
      expect(header).toBe(
        'public, s-maxage=60, stale-while-revalidate=120, max-age=10, must-revalidate',
      );
    });

    it('appends custom cache directives if provided', () => {
      const header = buildCacheControlHeader({
        sMaxAge: 3600,
        directives: ['immutable'],
      });
      expect(header).toBe(
        'public, s-maxage=3600, stale-while-revalidate=7200, immutable',
      );
    });
  });

  describe('HttpCacheInterceptor', () => {
    function createMockContext(
      method = 'GET',
      query: Record<string, string> = {},
      initialHeaders: Record<string, string> = {},
    ) {
      const headersMap = new Map<string, string>(
        Object.entries(initialHeaders),
      );
      let statusCode = 200;

      const mockReq = {
        method,
        query,
      };

      const mockRes = {
        headersSent: false,
        statusCode,
        status(code: number) {
          statusCode = code;
          this.statusCode = code;
          return this;
        },
        setHeader: vi.fn((key: string, val: string) => {
          headersMap.set(key.toLowerCase(), val);
        }),
        getHeader: vi.fn((key: string) => headersMap.get(key.toLowerCase())),
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => mockRes,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      return { mockContext, mockReq, mockRes, headersMap };
    }

    it('enforces secure-by-default (Cache-Control: no-store, private) on all mutating methods (POST, PUT, PATCH, DELETE)', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 60, staleWhileRevalidate: 120 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);

      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const { mockContext, mockRes, headersMap } = createMockContext(method);
        const next: CallHandler = {
          handle: () => of({ success: true }),
        };

        await firstValueFrom(interceptor.intercept(mockContext, next));

        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          DEFAULT_NO_CACHE_HEADER,
        );
        expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
      }
    });

    it('enforces no-store, private on GET requests without @PublicCache metadata', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, headersMap } = createMockContext('GET');
      const next: CallHandler = {
        handle: () => of({ data: 'private-cart-data' }),
      };

      await firstValueFrom(interceptor.intercept(mockContext, next));

      expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
    });

    it('sets public Edge/CDN Cache-Control and Vary on successful 200 GET with @PublicCache', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 60, staleWhileRevalidate: 120 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, headersMap } = createMockContext('GET');
      const next: CallHandler = {
        handle: () => of({ products: [] }),
      };

      await firstValueFrom(interceptor.intercept(mockContext, next));

      expect(headersMap.get('cache-control')).toBe(
        'public, s-maxage=60, stale-while-revalidate=120',
      );
      expect(headersMap.get('vary')).toBe('Accept-Encoding');
    });

    it('appends Accept-Encoding to existing Vary headers', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 300, staleWhileRevalidate: 600 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, headersMap } = createMockContext(
        'GET',
        {},
        {
          vary: 'Origin',
        },
      );
      const next: CallHandler = {
        handle: () => of({ categories: [] }),
      };

      await firstValueFrom(interceptor.intercept(mockContext, next));

      expect(headersMap.get('cache-control')).toBe(
        'public, s-maxage=300, stale-while-revalidate=600',
      );
      expect(headersMap.get('vary')).toBe('Origin, Accept-Encoding');
    });

    it('bypasses public cache when query specifies non-active status (e.g. status=draft or status=all)', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 60, staleWhileRevalidate: 120 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);

      for (const status of ['draft', 'all', 'archived']) {
        const { mockContext, headersMap } = createMockContext('GET', {
          status,
        });
        const next: CallHandler = {
          handle: () => of({ products: [] }),
        };

        await firstValueFrom(interceptor.intercept(mockContext, next));

        expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
      }
    });

    it('bypasses public cache when query requests inactive items (includeInactive=true)', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 300, staleWhileRevalidate: 600 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, headersMap } = createMockContext('GET', {
        includeInactive: 'true',
      });
      const next: CallHandler = {
        handle: () => of({ tree: [] }),
      };

      await firstValueFrom(interceptor.intercept(mockContext, next));

      expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
    });

    it('honors explicit @NoCache() even if @PublicCache is present on class or handler', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === NO_CACHE_KEY) return true;
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 60, staleWhileRevalidate: 120 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, headersMap } = createMockContext('GET');
      const next: CallHandler = {
        handle: () => of({ sensitive: 'internal' }),
      };

      await firstValueFrom(interceptor.intercept(mockContext, next));

      expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
    });

    it('does NOT apply public caching headers when downstream handler throws an error', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 60, staleWhileRevalidate: 120 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, headersMap } = createMockContext('GET');
      const next: CallHandler = {
        handle: () => throwError(() => new Error('Internal error')),
      };

      await expect(
        firstValueFrom(interceptor.intercept(mockContext, next)),
      ).rejects.toThrow('Internal error');

      expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
    });

    it('does NOT apply public caching headers when status code indicates error (4xx/5xx)', async () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
        (key: any) => {
          if (key === PUBLIC_CACHE_KEY) {
            return { sMaxAge: 60, staleWhileRevalidate: 120 };
          }
          return undefined;
        },
      );

      const interceptor = new HttpCacheInterceptor(reflector);
      const { mockContext, mockRes, headersMap } = createMockContext('GET');
      mockRes.statusCode = 404;

      const next: CallHandler = {
        handle: () => of({ message: 'Product not found' }),
      };

      await firstValueFrom(interceptor.intercept(mockContext, next));

      expect(headersMap.get('cache-control')).toBe(DEFAULT_NO_CACHE_HEADER);
    });
  });
});
