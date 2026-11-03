const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPortValue = process.env.REDIS_PORT || '6379';
const redisPort = Number(redisPortValue);

if (!Number.isInteger(redisPort) || redisPort < 1 || redisPort > 65535) {
  throw new Error(
    `Invalid REDIS_PORT "${redisPortValue}". Set it to an integer between 1 and 65535.`
  );
}

const connection = new IORedis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null,
});

const wahaQueue = new Queue('waha-events', {
  connection,
});

module.exports = {
  connection,
  wahaQueue,
};
