import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Force l'acceptation du certificat SSL de Neon
  }
});
