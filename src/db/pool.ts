import { Pool } from 'pg';
import { requireDb } from '@/lib/env';

let _pool: Pool | null = null;

function create(): Pool {
  const url = requireDb();
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: true },
  });
  pool.on('error', (err) => {
    console.error('[pg] idle client error:', err.message);
  });
  return pool;
}

export function getPool(): Pool {
  if (!_pool) _pool = create();
  return _pool;
}

// Compat : `import { pool } from '@/db/pool'` continue de fonctionner.
export const pool = new Proxy({} as Pool, {
  get(_t, prop) {
    const real = getPool() as any;
    const v = real[prop];
    return typeof v === 'function' ? v.bind(real) : v;
  },
});
