import mysql, {
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { env } from "../config/env.js";

export const pool = mysql.createPool({
  host: env.DB_HOST,
  ...(env.DB_PORT ? { port: env.DB_PORT } : {}),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: 100,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  decimalNumbers: true,
  namedPlaceholders: true,
  timezone: "Z",
});

export type DatabaseConnection = Pick<
  PoolConnection,
  "execute" | "query"
>;

export async function withTransaction<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type { ResultSetHeader, RowDataPacket };

export function isDuplicateEntry(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY",
  );
}
