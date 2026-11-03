const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Configure it in the worker environment.');
}

let databaseCredentials;
try {
  databaseCredentials = new URL(databaseUrl);
} catch {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
}

if (
  !['postgres:', 'postgresql:'].includes(databaseCredentials.protocol) ||
  !databaseCredentials.username ||
  !databaseCredentials.password
) {
  throw new Error(
    'DATABASE_URL must be a PostgreSQL URL with a database username and password.'
  );
}

const poolMaxValue = process.env.PG_POOL_MAX || '5';
const poolMax = Number(poolMaxValue);

if (!Number.isInteger(poolMax) || poolMax < 1) {
  throw new Error(
    `Invalid PG_POOL_MAX "${poolMaxValue}". Set it to a positive integer.`
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
