import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return {
    sql,
    db: drizzle(sql, { schema }),
  };
}

export type Database = ReturnType<typeof createDb>['db'];
