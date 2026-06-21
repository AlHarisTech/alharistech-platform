import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import type { EventRuntimeConfig } from './queue.constants';

@Injectable()
export class RedisManager implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisManager.name);
  private client: Redis | null = null;
  private startupTime = 0;
  private errorState = false;

  constructor(private readonly config: EventRuntimeConfig) {}

  async initialize(): Promise<Redis> {
    if (this.client) return this.client;

    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      db: this.config.db,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.warn(`Redis connection failed after ${times} retries — degrading`);
          this.errorState = true;
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.client.on('connect', () => {
      this.logger.log(`Redis connected to ${this.config.host}:${this.config.port}/${this.config.db}`);
    });

    this.client.on('error', (err) => {
      this.errorState = true;
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });

    try {
      await this.client.connect();
      this.errorState = false;
      this.startupTime = Date.now();
    } catch (err) {
      this.errorState = true;
      this.client = null;
      throw err;
    }

    return this.client;
  }

  getClient(): Redis | null {
    return this.client;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      this.errorState = true;
      return false;
    }
  }

  isConnected(): boolean {
    return this.client?.status === 'ready';
  }

  isInErrorState(): boolean {
    return this.errorState;
  }

  getUptime(): number {
    if (!this.startupTime) return 0;
    return Math.floor((Date.now() - this.startupTime) / 1000);
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client) return;
    this.logger.log('Disconnecting Redis...');
    try {
      await this.client.quit();
    } catch (err) {
      this.logger.error(`Redis disconnect error: ${(err as Error).message}`);
      this.client.disconnect();
    }
    this.client = null;
    this.logger.log('Redis disconnected');
  }
}
