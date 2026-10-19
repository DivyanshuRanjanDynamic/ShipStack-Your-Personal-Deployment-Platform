import pg from "pg";
import { config } from "../config.js";
import { logger } from "../logger.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!pool) {
    const rawUrl = config.DATABASE_URL || process.env.DATABASE_URL || "";
    // Clean query parameters from connection string so pg doesn't misparse sslmode
    const cleanUrl = rawUrl.split("?")[0];

    pool = new Pool({
      connectionString: cleanUrl,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on("error", (err) => {
      logger.error("Unexpected error on idle PostgreSQL client", err);
    });
  }

  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(sql: string, params: any[] = []): Promise<pg.QueryResult<T>> {
  const p = getDbPool();
  return p.query<T>(sql, params);
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
