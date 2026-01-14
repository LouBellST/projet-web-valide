import { createClient } from "redis";

const redisHost = process.env.REDIS_HOST;

const redis = createClient({
  url: `redis://${redisHost}:6379`,
});

redis.on("error", (err) => console.error("Redis Client Error", err));

async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
  return redis;
}

export { redis, connectRedis };
