import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Load .env from apps/api/.env
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
];

for (const p of envPaths) {
  if (existsSync(p)) {
    dotenv.config({ path: p });
  }
}

const dbUrl =
  process.env.POSTGRES_DB_URL ||
  'postgresql://openmart:pgmart@localhost:6432/open-mart';

console.log(
  `Connecting to Postgres at ${dbUrl.replace(/:[^:@]+@/, ':****@')}...`,
);

const sql = postgres(dbUrl, { max: 1 });

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'avif':
      return 'image/avif';
    default:
      return 'image/jpeg';
  }
}

function extractStorageKey(url: string, publicUrl: string): string {
  if (publicUrl && url.startsWith(publicUrl)) {
    return url.replace(publicUrl, '').replace(/^\/+/, '');
  }
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    return url.split('/').pop() || url;
  }
}

async function main() {
  try {
    // 1. Scan products table for existing images
    console.log('Scanning products table for catalog images...');
    const products = await sql<
      { id: string; title: string; media: unknown; variants: unknown }[]
    >`
      SELECT id, title, media, variants FROM products;
    `;

    console.log(`Found ${products.length} product(s) in catalog.`);

    const publicUrl = process.env.R2_PUBLIC_URL || '';
    const imageMap = new Map<
      string,
      {
        url: string;
        storageKey: string;
        fileName: string;
        originalName: string;
        mimeType: string;
        altText: string;
        usageCount: number;
      }
    >();

    for (const product of products) {
      if (Array.isArray(product.media)) {
        for (const m of product.media) {
          if (
            m &&
            typeof m === 'object' &&
            'url' in m &&
            typeof m.url === 'string'
          ) {
            const url = m.url.trim();
            if (!url) continue;

            const storageKey = extractStorageKey(url, publicUrl);
            const fileName = storageKey.split('/').pop() || 'image.jpg';
            const originalName = m.altText || fileName;
            const mimeType = getMimeType(fileName);

            const existing = imageMap.get(storageKey);
            if (existing) {
              existing.usageCount += 1;
            } else {
              imageMap.set(storageKey, {
                url,
                storageKey,
                fileName,
                originalName,
                mimeType,
                altText: m.altText || product.title || '',
                usageCount: 1,
              });
            }
          }
        }
      }

      // Also check variants for imageUrl
      if (Array.isArray(product.variants)) {
        for (const v of product.variants) {
          if (
            v &&
            typeof v === 'object' &&
            'imageUrl' in v &&
            typeof v.imageUrl === 'string'
          ) {
            const url = v.imageUrl.trim();
            if (!url) continue;

            const storageKey = extractStorageKey(url, publicUrl);
            const fileName = storageKey.split('/').pop() || 'image.jpg';
            const originalName = fileName;
            const mimeType = getMimeType(fileName);

            const existing = imageMap.get(storageKey);
            if (existing) {
              existing.usageCount += 1;
            } else {
              imageMap.set(storageKey, {
                url,
                storageKey,
                fileName,
                originalName,
                mimeType,
                altText: product.title || '',
                usageCount: 1,
              });
            }
          }
        }
      }
    }

    console.log(`Discovered ${imageMap.size} unique image(s) across products.`);

    // 2. Scan Cloudflare R2 bucket for all stored images
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2AccessKey = process.env.R2_ACCESS_KEY_ID;
    const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY;
    const r2Bucket = process.env.R2_BUCKET_NAME;

    if (r2AccountId && r2AccessKey && r2SecretKey && r2Bucket) {
      console.log(`Connecting to Cloudflare R2 bucket "${r2Bucket}"...`);
      try {
        const s3 = new S3Client({
          region: 'auto',
          endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: r2AccessKey,
            secretAccessKey: r2SecretKey,
          },
        });

        const listCmd = new ListObjectsV2Command({
          Bucket: r2Bucket,
        });

        const s3Res = await s3.send(listCmd);
        const contents = s3Res.Contents || [];
        console.log(`Found ${contents.length} object(s) in R2 storage.`);

        for (const item of contents) {
          if (!item.Key) continue;
          const storageKey = item.Key;
          const fileName = storageKey.split('/').pop() || 'asset';
          const mimeType = getMimeType(fileName);
          const url = publicUrl
            ? `${publicUrl.replace(/\/+$/, '')}/${storageKey}`
            : `https://${r2Bucket}.r2.dev/${storageKey}`;

          const existing = imageMap.get(storageKey);
          if (existing) {
            // Already tracked, keep usageCount
          } else {
            imageMap.set(storageKey, {
              url,
              storageKey,
              fileName,
              originalName: fileName,
              mimeType,
              altText: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
              usageCount: 0, // Unlinked asset in Media Library
            });
          }
        }
      } catch (r2Err) {
        console.warn(
          'Could not list objects directly from Cloudflare R2 (skipping bucket scan):',
          r2Err instanceof Error ? r2Err.message : r2Err,
        );
      }
    }

    // 3. Upsert discovered media assets into media_assets table
    console.log(
      `Syncing ${imageMap.size} asset(s) into "media_assets" table...`,
    );
    let inserted = 0;
    let updated = 0;

    for (const item of imageMap.values()) {
      const result = await sql`
        INSERT INTO "media_assets" (
          "file_name",
          "original_name",
          "mime_type",
          "file_size_bytes",
          "url",
          "storage_key",
          "alt_text",
          "usage_count",
          "is_archived",
          "version"
        ) VALUES (
          ${item.fileName},
          ${item.originalName},
          ${item.mimeType},
          102400,
          ${item.url},
          ${item.storageKey},
          ${item.altText},
          ${item.usageCount},
          false,
          1
        )
        ON CONFLICT ("storage_key") DO UPDATE SET
          "url" = EXCLUDED.url,
          "usage_count" = EXCLUDED.usage_count,
          "alt_text" = CASE WHEN media_assets.alt_text = '' THEN EXCLUDED.alt_text ELSE media_assets.alt_text END,
          "updated_at" = now()
        RETURNING (xmax = 0) AS is_inserted;
      `;

      if (result[0]?.is_inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    console.log(
      `✓ Media sync complete! Inserted: ${inserted}, Updated: ${updated}. Total: ${imageMap.size}`,
    );

    // Print quick count from media_assets
    const countRes = await sql`SELECT count(*) as total FROM media_assets;`;
    console.log(`Total rows now in media_assets table: ${countRes[0]?.total}`);
  } catch (err) {
    console.error('Migration & sync error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void main();
