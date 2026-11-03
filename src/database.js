const { Pool } = require('pg');

const poolMaxValue = process.env.PG_POOL_MAX || '5';
const poolMax = Number(poolMaxValue);

if (!Number.isInteger(poolMax) || poolMax < 1) {
  throw new Error(
    `Invalid PG_POOL_MAX "${poolMaxValue}". Set it to a positive integer.`
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
