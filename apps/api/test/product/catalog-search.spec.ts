import { describe, expect, it, vi } from 'vitest';
import { expandCatalogSearchTerms } from '../../src/product/application/search/catalog-search-expander.js';
import { ListProductHandler } from '../../src/product/application/queries/list-product/list-product.handler.js';
import { ListProductQuery } from '../../src/product/application/queries/list-product/list-product.query.js';

describe('Phase 5: PostgreSQL Trigram & Banglish Catalog Search', () => {
  describe('expandCatalogSearchTerms (Banglish, Bengali & Phonetic Expander)', () => {
    it('expands Banglish apparel queries into English and Bengali script synonyms', () => {
      const expanded = expandCatalogSearchTerms('panjabi');

      expect(expanded.primaryTerm).toBe('panjabi');
      expect(expanded.expandedTerms).toContain('panjabi');
      expect(expanded.expandedTerms).toContain('punjabi');
      expect(expanded.expandedTerms).toContain('পাঞ্জাবি');
      expect(expanded.trigramTerms).toContain('panjabi');
    });

    it('normalizes hyphenated Banglish spelling like t-shart across forms', () => {
      const expanded = expandCatalogSearchTerms('t-shart');

      expect(expanded.expandedTerms).toContain('t-shart');
      expect(expanded.expandedTerms).toContain('t-shirt');
      expect(expanded.expandedTerms).toContain('tshirt');
      expect(expanded.expandedTerms).toContain('টিশার্ট');
    });

    it('expands Banglish electronics & computer terms such as leptop and hedphone', () => {
      const laptop = expandCatalogSearchTerms('leptop');
      expect(laptop.expandedTerms).toContain('laptop');
      expect(laptop.expandedTerms).toContain('ল্যাপটপ');

      const headphone = expandCatalogSearchTerms('hedphone');
      expect(headphone.expandedTerms).toContain('headphone');
      expect(headphone.expandedTerms).toContain('হেডফোন');
    });

    it('expands Bengali script queries back to Romanized English / Banglish equivalents', () => {
      const expanded = expandCatalogSearchTerms('ল্যাপটপ');

      expect(expanded.expandedTerms).toContain('ল্যাপটপ');
      expect(expanded.expandedTerms).toContain('laptop');
    });

    it('supports multi-word phrases and keeps expansion bounded', () => {
      const expanded = expandCatalogSearchTerms('cotton   panjabi');

      expect(expanded.primaryTerm).toBe('cotton panjabi');
      expect(expanded.expandedTerms).toContain('cotton punjabi');
      expect(expanded.expandedTerms.length).toBeLessThanOrEqual(8);
    });

    it('excludes sub-3-character terms from trigramTerms while preserving them in expandedTerms', () => {
      const expanded = expandCatalogSearchTerms('tv');

      expect(expanded.expandedTerms).toContain('tv');
      expect(expanded.expandedTerms).toContain('television');
      expect(expanded.trigramTerms).not.toContain('tv');
      expect(expanded.trigramTerms).toContain('television');
    });

    it('returns empty arrays cleanly for blank input', () => {
      const expanded = expandCatalogSearchTerms('   ');

      expect(expanded.primaryTerm).toBe('');
      expect(expanded.expandedTerms).toEqual([]);
      expect(expanded.trigramTerms).toEqual([]);
    });
  });

  describe('ListProductHandler (pg_trgm Read Model + Graceful Fallback)', () => {
    function createMockCacheService() {
      return {
        getOrSet: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) =>
          fetcher(),
        ),
      };
    }

    it('queries with pg_trgm search and maps matching products cleanly', async () => {
      const now = new Date('2026-11-12T10:00:00Z');
      const mockRow = {
        product: {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Premium Cotton Punjabi',
          description: 'Traditional embroidered panjabi for festive wear',
          media: [
            { url: 'https://cdn.example.com/panjabi.jpg', isThumbnail: true },
          ],
          tags: ['panjabi', 'eid'],
          status: 'active',
          categoryId: '22222222-2222-2222-2222-222222222222',
          category: null,
          unitPriceAmount: 245000,
          unitPriceCurrency: 'BDT',
          basePriceAmount: null,
          basePriceCurrency: null,
          compareAtPriceAmount: null,
          compareAtPriceCurrency: null,
          sku: 'PNJ-001',
          inventoryQuantity: 15,
          trackQuantity: true,
          variants: [],
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
        category: {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Apparel',
          slug: 'apparel',
        },
      };

      const countChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 1 }]),
      };

      const rowsChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([mockRow]),
      };

      const mockDb = {
        select: vi
          .fn()
          .mockReturnValueOnce(countChain)
          .mockReturnValueOnce(rowsChain),
      };

      const handler = new ListProductHandler(
        mockDb as never,
        createMockCacheService() as never,
      );

      const result = await handler.execute(
        new ListProductQuery({ search: 'panjabi', page: 1, limit: 10 }),
      );

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Premium Cotton Punjabi');
      expect(result.data[0].category?.slug).toBe('apparel');
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it('falls back to Banglish-expanded ILIKE search if pg_trgm function/operator (42883) is unavailable', async () => {
      const undefinedFnError = Object.assign(
        new Error(
          'function word_similarity(unknown, character varying) does not exist',
        ),
        { code: '42883' },
      );

      const failingCountChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(undefinedFnError),
      };

      const fallbackCountChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      };

      const fallbackRowsChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      const mockDb = {
        select: vi
          .fn()
          .mockReturnValueOnce(failingCountChain)
          .mockReturnValueOnce(fallbackCountChain)
          .mockReturnValueOnce(fallbackRowsChain),
      };

      const handler = new ListProductHandler(
        mockDb as never,
        createMockCacheService() as never,
      );

      const result = await handler.execute(
        new ListProductQuery({ search: 'leptop', page: 1, limit: 10 }),
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockDb.select).toHaveBeenCalledTimes(3);
    });
  });
});
