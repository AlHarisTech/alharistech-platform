import type { FactoryProvider } from '@nestjs/common';
import { RedisManager } from '../infrastructure/redis-manager';
import { REDIS_CLIENT_TOKEN } from '../infrastructure/queue.constants';

export const redisClientProvider: FactoryProvider = {
  provide: REDIS_CLIENT_TOKEN,
  useFactory: async (redisManager: RedisManager) => {
    try {
      return await redisManager.initialize();
    } catch {
      return null;
    }
  },
  inject: [RedisManager],
};
