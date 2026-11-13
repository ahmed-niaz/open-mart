import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ProductMediaDetacherPort } from '../../application/ports/product-media-detacher.port.js';
import { DRIZZLE } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import type { DrizzleDB } from '../../../shared/infrastructure/database/postgres/drizzle.provider.js';
import { productsSchema } from '../../../shared/infrastructure/database/postgres/schema/product.schema.js';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service.js';

@Injectable()
export class DrizzleProductMediaDetacherAdapter implements ProductMediaDetacherPort {
  private readonly logger = new Logger(DrizzleProductMediaDetacherAdapter.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  async detachMediaUrlsFromAllProducts(mediaUrls: string[]): Promise<number> {
    if (!mediaUrls || mediaUrls.length === 0) return 0;

    const urlSet = new Set(mediaUrls.filter(Boolean));
    if (urlSet.size === 0) return 0;

    // 1. Fetch all products to inspect media and variant imageUrls
    const products = await this.db
      .select({
        id: productsSchema.id,
        sku: productsSchema.sku,
        media: productsSchema.media,
        variants: productsSchema.variants,
      })
      .from(productsSchema);

    let updatedCount = 0;

    for (const prod of products) {
      let isModified = false;

      // 1. Filter out deleted URLs from product gallery media array
      let updatedMedia = prod.media;
      if (Array.isArray(prod.media) && prod.media.length > 0) {
        const filtered = prod.media.filter(
          (m) => m && m.url && !urlSet.has(m.url),
        );
        if (filtered.length !== prod.media.length) {
          // If the primary thumbnail was deleted, ensure the first remaining image becomes thumbnail
          if (filtered.length > 0 && !filtered.some((m) => m.isThumbnail)) {
            filtered[0] = { ...filtered[0], isThumbnail: true };
          }
          updatedMedia = filtered;
          isModified = true;
        }
      }

      // 2. Remove matching imageUrl from variants if attached
      let updatedVariants = prod.variants;
      if (Array.isArray(prod.variants) && prod.variants.length > 0) {
        const newVariants = prod.variants.map((v) => {
          if (
            v &&
            typeof v === 'object' &&
            'imageUrl' in v &&
            typeof (v as Record<string, unknown>).imageUrl === 'string' &&
            urlSet.has((v as Record<string, unknown>).imageUrl as string)
          ) {
            isModified = true;
            const copy = { ...v };
            delete (copy as Record<string, unknown>).imageUrl;
            return copy;
          }
          return v;
        });

        if (isModified) {
          updatedVariants = newVariants;
        }
      }

      // 3. Persist update and clear product caches
      if (isModified) {
        await this.db
          .update(productsSchema)
          .set({
            media: updatedMedia,
            variants: updatedVariants,
            updatedAt: new Date(),
          })
          .where(eq(productsSchema.id, prod.id));

        updatedCount++;
        this.logger.log(
          `Detached deleted media URL(s) from product '${prod.id}' (SKU: ${prod.sku}).`,
        );

        if (this.cacheService) {
          try {
            await this.cacheService.del(`product:id:${prod.id}`);
            if (prod.sku) {
              await this.cacheService.del(`product:sku:${prod.sku}`);
            }
            if (Array.isArray(prod.variants)) {
              for (const variant of prod.variants) {
                if (variant?.sku) {
                  await this.cacheService.del(`product:sku:${variant.sku}`);
                }
              }
            }
          } catch {
            // Fail-open: cache eviction errors must not block database update
          }
        }
      }
    }

    if (updatedCount > 0 && this.cacheService) {
      try {
        await this.cacheService.delPattern('product:list:*');
        await this.cacheService.delPattern('category:*');
      } catch {
        // Fail-open
      }
    }

    return updatedCount;
  }
}
