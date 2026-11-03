const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null,
});

const wahaQueue = new Queue('waha-events', {
  connection,
});

module.exports = {
  connection,
  wahaQueue,
};
