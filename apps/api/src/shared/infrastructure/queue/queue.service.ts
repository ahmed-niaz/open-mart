import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Queue,
  Worker,
  type JobsOptions,
  type Processor,
  type WorkerOptions,
} from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';
import { FORCE_WORKERS_ENABLED } from './queue.constants.js';

@Injectable()
export class QueueConnectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueConnectionService.name);
  private readonly producerConnection: Redis;
  private readonly workerConnections: Redis[] = [];
  private readonly queues = new Map<string, Queue<any, any, string>>();
  private readonly workers: Worker<any, any, string>[] = [];
  private readonly prefix: string;
  private readonly host: string;
  private readonly port: number;
  private readonly password?: string;
  private readonly embeddedWorkerEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(FORCE_WORKERS_ENABLED)
    private readonly forceWorkersEnabled = false,
  ) {
    this.host = this.configService.get<string>('REDIS_QUEUE_HOST', '127.0.0.1');
    this.port = Number(
      this.configService.get<number>('REDIS_QUEUE_PORT', 6380),
    );
    const rawPassword = this.configService.get<string>('REDIS_QUEUE_PASSWORD');
    this.password =
      rawPassword && rawPassword.trim() !== '' ? rawPassword : undefined;
    this.prefix = this.configService.get<string>(
      'REDIS_QUEUE_PREFIX',
      'om:bull',
    );

    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const embeddedFlag = this.configService.get<string>(
      'QUEUE_EMBEDDED_WORKER',
    );
    this.embeddedWorkerEnabled =
      embeddedFlag !== undefined
        ? embeddedFlag.trim().toLowerCase() === 'true'
        : nodeEnv !== 'production';

    this.producerConnection = new Redis(this.buildProducerOptions());

    this.producerConnection.on('ready', () => {
      this.logger.log(
        `Connected and authenticated to BullMQ Redis Queue at ${this.host}:${this.port} (prefix=${this.prefix})`,
      );
    });

    this.producerConnection.on('error', (err: Error) => {
      const hint = err.message.includes('NOAUTH')
        ? ' Verify REDIS_QUEUE_PASSWORD in apps/api/.env matches the redis-queue container.'
        : '';
      this.logger.warn(
        `BullMQ Queue Redis error (${err.message}).${hint} Producers will fail open to inline execution.`,
      );
    });
  }

  private buildProducerOptions(): RedisOptions {
    return {
      host: this.host,
      port: this.port,
      password: this.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      commandTimeout: 1000,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => Math.min(times * 1000, 15000),
    };
  }

  private buildWorkerOptions(): RedisOptions {
    return {
      host: this.host,
      port: this.port,
      password: this.password,
      lazyConnect: true,
      // Required by BullMQ Worker for blocking commands (BZPOPMIN / XREADGROUP)
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      retryStrategy: (times: number) => Math.min(times * 1000, 15000),
    };
  }

  async onModuleInit(): Promise<void> {
    if (process.env.VITEST) {
      return;
    }

    try {
      await this.producerConnection.connect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Initial BullMQ Queue Redis connection failed (${msg}). Failing open until Redis Queue becomes available.`,
      );
    }
  }

  /**
   * Returns true if this process should host BullMQ Workers
   * (always true in dedicated WorkerModule, or in API when QUEUE_EMBEDDED_WORKER=true).
   */
  shouldRunWorkers(): boolean {
    if (process.env.VITEST) {
      return false;
    }
    return this.forceWorkersEnabled || this.embeddedWorkerEnabled;
  }

  isProducerReady(): boolean {
    return this.producerConnection.status === 'ready';
  }

  getPrefix(): string {
    return this.prefix;
  }

  async ping(timeoutMs = 100): Promise<boolean> {
    if (!this.isProducerReady()) {
      return false;
    }
    try {
      const pong = await Promise.race([
        this.producerConnection.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), timeoutMs),
        ),
      ]);
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  getOrCreateQueue<T = any>(
    name: string,
    defaultJobOptions?: JobsOptions,
  ): Queue<T, any, string> {
    const existing = this.queues.get(name);
    if (existing) {
      return existing as Queue<T, any, string>;
    }

    const queue = new Queue<T, any, string>(name, {
      connection: this.producerConnection,
      prefix: this.prefix,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 1000,
          age: 86400,
        },
        removeOnFail: {
          count: 5000,
        },
        ...defaultJobOptions,
      },
    });

    queue.on('error', (err: Error) => {
      this.logger.warn(`BullMQ Queue '${name}' error: ${err.message}`);
    });

    this.queues.set(name, queue);
    return queue;
  }

  createWorker<T = any>(
    name: string,
    processor: Processor<T, any, string>,
    options?: Omit<WorkerOptions, 'connection' | 'prefix'>,
  ): Worker<T, any, string> {
    const workerRedis = new Redis(this.buildWorkerOptions());
    workerRedis.on('error', (err: Error) => {
      this.logger.warn(
        `BullMQ Worker '${name}' Redis connection error: ${err.message}`,
      );
    });
    this.workerConnections.push(workerRedis);

    const worker = new Worker<T, any, string>(name, processor, {
      connection: workerRedis,
      prefix: this.prefix,
      concurrency: 5,
      ...options,
    });

    worker.on('completed', (job) => {
      this.logger.debug(
        `Completed BullMQ job '${name}:${job.name}' (id=${job.id})`,
      );
    });

    worker.on('failed', (job, err) => {
      const attempt = job?.attemptsMade ?? 0;
      const maxAttempts = job?.opts?.attempts ?? 1;
      const suffix =
        attempt >= maxAttempts
          ? ' [EXHAUSTED ALL RETRIES -> DEAD-LETTERED]'
          : ` [attempt ${attempt}/${maxAttempts}, will retry]`;
      this.logger.error(
        `BullMQ job '${name}:${job?.name ?? 'unknown'}' (id=${job?.id ?? 'unknown'}) failed: ${err.message}${suffix}`,
      );
    });

    worker.on('error', (err: Error) => {
      this.logger.warn(`BullMQ Worker '${name}' error: ${err.message}`);
    });

    this.workers.push(worker);
    this.logger.log(
      `Registered BullMQ Worker for queue '${name}' (concurrency=${options?.concurrency ?? 5})`,
    );
    return worker;
  }

  async onModuleDestroy(): Promise<void> {
    // 1. Drain workers first so active jobs finish before shutdown
    await Promise.allSettled(this.workers.map((worker) => worker.close()));

    // 2. Close queue producers
    await Promise.allSettled(
      Array.from(this.queues.values()).map((queue) => queue.close()),
    );

    // 3. Disconnect underlying Redis clients
    await Promise.allSettled(
      this.workerConnections.map((conn) => conn.quit().catch(() => undefined)),
    );

    try {
      if (this.producerConnection.status !== 'end') {
        await this.producerConnection.quit();
      }
    } catch {
      this.producerConnection.disconnect();
    }
  }
}
