import pg from "pg";

declare global {
  var __hrmPgPool: pg.Pool | undefined;
}

let pool: pg.Pool | null = globalThis.__hrmPgPool ?? null;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      min: 2,
      max: 10,
      idleTimeoutMillis: 60_000,
    });

    if (process.env.NODE_ENV !== "production") {
      globalThis.__hrmPgPool = pool;
    }
  }

  return pool;
}

const db = new Proxy({} as pg.Pool, {
  get(_target, prop, receiver) {
    const activePool = getPool();
    const value = Reflect.get(activePool, prop, receiver);
    return typeof value === "function" ? value.bind(activePool) : value;
  },
});

export { getPool };
export default db;
