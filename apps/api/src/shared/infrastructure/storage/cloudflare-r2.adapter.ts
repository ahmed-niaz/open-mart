import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { extname, basename } from 'node:path';
import type {
  StoragePort,
  UploadFileInput,
  UploadFileOutput,
} from '../../application/ports/storage.port.js';

@Injectable()
export class CloudflareR2StorageAdapter implements StoragePort {
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly logger = new Logger(CloudflareR2StorageAdapter.name);

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.getOrThrow<string>('R2_ACCOUNT_ID');
    const accessKeyId =
      this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.getOrThrow<string>(
      'R2_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicUrl = this.configService
      .getOrThrow<string>('R2_PUBLIC_URL')
      .replace(/\/+$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async upload(input: UploadFileInput): Promise<UploadFileOutput> {
    const ext = extname(input.originalName).toLowerCase() || '.jpg';
    const rawBase = basename(input.originalName, ext);
    const sanitizedBase = rawBase
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const folder = input.folder
      ? input.folder.replace(/^\/+|\/+$/g, '')
      : 'products';
    const uniqueId = randomUUID();
    const fileName = `${uniqueId}-${sanitizedBase}${ext}`;
    const key = `${folder}/${year}/${month}/${fileName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    const url = `${this.publicUrl}/${key}`;
    this.logger.log(`Uploaded file to Cloudflare R2: ${key}`);

    return {
      url,
      key,
      fileName,
    };
  }

  async uploadMany(inputs: UploadFileInput[]): Promise<UploadFileOutput[]> {
    return Promise.all(inputs.map((input) => this.upload(input)));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
    this.logger.log(`Deleted file from Cloudflare R2: ${key}`);
  }
}
