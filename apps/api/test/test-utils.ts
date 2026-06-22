import { Test, TestingModule } from "@nestjs/testing";

class InMemoryMulti {
  private commands: Array<{ cmd: string; args: string[] }> = [];
  private redis: InMemoryRedis;

  constructor(redis: InMemoryRedis) {
    this.redis = redis;
  }

  lpush(key: string, value: string): this {
    this.commands.push({ cmd: "lpush", args: [key, value] });
    return this;
  }

  ltrim(key: string, start: number, end: number): this {
    this.commands.push({ cmd: "ltrim", args: [key, String(start), String(end)] });
    return this;
  }

  setex(key: string, seconds: number, value: string): this {
    this.commands.push({ cmd: "setex", args: [key, String(seconds), value] });
    return this;
  }

  async exec(): Promise<[Error | null, any][]> {
    const results: [Error | null, any][] = [];
    for (const { cmd, args } of this.commands) {
      try {
        const result = await (this.redis as any)[cmd](...args);
        results.push([null, result]);
      } catch (err) {
        results.push([err instanceof Error ? err : new Error(String(err)), null]);
      }
    }
    return results;
  }
}

export class InMemoryRedis {
  private store = new Map<string, string>();
  private ttlMap = new Map<string, number>();

  multi(): InMemoryMulti {
    return new InMemoryMulti(this);
  }

  get(key: string): Promise<string | null> {
    this.evictExpired();
    return Promise.resolve(this.store.get(key) ?? null);
  }

  set(key: string, value: string, ...args: string[]): Promise<"OK" | null> {
    let pxMode = false;
    let nxMode = false;
    let ttlMs = 0;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "EX" && args[i + 1]) {
        this.ttlMap.set(key, Date.now() + parseInt(args[i + 1]) * 1000);
        i++;
      } else if (args[i] === "PX" && args[i + 1]) {
        pxMode = true;
        ttlMs = parseInt(args[i + 1]);
        i++;
      } else if (args[i] === "NX") {
        nxMode = true;
      }
    }

    if (nxMode && this.store.has(key)) {
      this.evictExpired();
      if (this.store.has(key)) return Promise.resolve(null);
    }

    this.store.set(key, value);
    if (pxMode && ttlMs > 0) {
      this.ttlMap.set(key, Date.now() + ttlMs);
    }
    return Promise.resolve("OK");
  }

  setex(key: string, seconds: number, value: string): Promise<"OK"> {
    this.store.set(key, value);
    this.ttlMap.set(key, Date.now() + seconds * 1000);
    return Promise.resolve("OK");
  }

  setnx(key: string, value: string): Promise<number> {
    this.evictExpired();
    if (this.store.has(key)) return Promise.resolve(0);
    this.store.set(key, value);
    return Promise.resolve(1);
  }

  del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        this.ttlMap.delete(key);
        count++;
      }
    }
    return Promise.resolve(count);
  }

  exists(...keys: string[]): Promise<number> {
    this.evictExpired();
    return Promise.resolve(keys.filter((k) => this.store.has(k)).length);
  }

  expire(key: string, seconds: number): Promise<number> {
    if (this.store.has(key)) {
      this.ttlMap.set(key, Date.now() + seconds * 1000);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }

  lpush(key: string, ...values: string[]): Promise<number> {
    const existing = this.store.get(key);
    const arr = existing ? JSON.parse(existing) : [];
    arr.unshift(...values);
    this.store.set(key, JSON.stringify(arr));
    return Promise.resolve(arr.length);
  }

  ltrim(key: string, start: number, end: number): Promise<"OK"> {
    const existing = this.store.get(key);
    if (!existing) return Promise.resolve("OK");
    const arr = JSON.parse(existing);
    this.store.set(
      key,
      JSON.stringify(arr.slice(start, end + 1 === 0 ? undefined : end + 1)),
    );
    return Promise.resolve("OK");
  }

  lrange(key: string, start: number, end: number): Promise<string[]> {
    const existing = this.store.get(key);
    if (!existing) return Promise.resolve([]);
    const arr = JSON.parse(existing);
    return Promise.resolve(arr.slice(start, end + 1 === 0 ? undefined : end + 1));
  }

  llen(key: string): Promise<number> {
    const existing = this.store.get(key);
    if (!existing) return Promise.resolve(0);
    return Promise.resolve(JSON.parse(existing).length);
  }

  lrem(key: string, count: number, value: string): Promise<number> {
    const existing = this.store.get(key);
    if (!existing) return Promise.resolve(0);
    let arr = JSON.parse(existing) as string[];
    const before = arr.length;
    if (count === 0) {
      arr = arr.filter((v) => v !== value);
    } else if (count > 0) {
      let removed = 0;
      arr = arr.filter((v) => {
        if (removed < count && v === value) {
          removed++;
          return false;
        }
        return true;
      });
    } else {
      let removed = 0;
      const abs = Math.abs(count);
      arr = arr.reverse().filter((v) => {
        if (removed < abs && v === value) {
          removed++;
          return false;
        }
        return true;
      }).reverse();
    }
    this.store.set(key, JSON.stringify(arr));
    return Promise.resolve(before - arr.length);
  }

  keys(pattern: string): Promise<string[]> {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return Promise.resolve(Array.from(this.store.keys()).filter((k) => regex.test(k)));
  }

  flushall(): Promise<"OK"> {
    this.store.clear();
    this.ttlMap.clear();
    return Promise.resolve("OK");
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, expiry] of this.ttlMap) {
      if (now >= expiry) {
        this.store.delete(key);
        this.ttlMap.delete(key);
      }
    }
  }
}

export function createMockRedisProvider() {
  const mockRedis = new InMemoryRedis();
  return {
    provide: "REDIS_CLIENT_TOKEN",
    useValue: mockRedis,
  };
}

export async function createTestModule(
  imports: any[],
  providers?: any[],
): Promise<TestingModule> {
  return Test.createTestingModule({
    imports,
    providers: [createMockRedisProvider(), ...(providers || [])],
  })
    .overrideProvider("REDIS_CLIENT_TOKEN")
    .useValue(new InMemoryRedis())
    .compile();
}

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
