import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type {
  PaymentEventProcessedStatus,
  PaymentEventRecord,
  PaymentEventRecordInput,
} from "./payment.types.js";

function mapPaymentEventRow(row: RowDataPacket): PaymentEventRecord {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    provider: String(row.provider),
    providerEventId: String(row.provider_event_id),
    providerTransactionRef: row.provider_transaction_ref
      ? String(row.provider_transaction_ref)
      : null,
    eventType: String(row.event_type),
    rawPayload:
      typeof row.raw_payload === "string"
        ? (JSON.parse(row.raw_payload) as Record<string, unknown>)
        : (row.raw_payload as Record<string, unknown>),
    processedStatus: row.processed_status as PaymentEventProcessedStatus,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: new Date(row.created_at as string | Date),
  };
}

export class PaymentEventsRepository {
  async create(event: PaymentEventRecordInput, connection?: PoolConnection): Promise<number> {
    const executor = connection ?? pool;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO payment_events (
        order_id, provider, provider_event_id, provider_transaction_ref,
        event_type, raw_payload, processed_status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.orderId,
        event.provider,
        event.providerEventId,
        event.providerTransactionRef ?? null,
        event.eventType,
        JSON.stringify(event.rawPayload),
        event.processedStatus ?? "received",
        event.errorMessage ?? null,
      ],
    );
    return Number(result.insertId);
  }

  async findByEventId(provider: string, providerEventId: string, connection?: PoolConnection): Promise<PaymentEventRecord | null> {
    const executor = connection ?? pool;
    const [rows] = await executor.execute<RowDataPacket[]>(
      "SELECT * FROM payment_events WHERE provider = ? AND provider_event_id = ? LIMIT 1",
      [provider, providerEventId],
    );
    if (!rows[0]) return null;
    return mapPaymentEventRow(rows[0]);
  }

  async listByOrderId(orderId: number): Promise<PaymentEventRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM payment_events WHERE order_id = ? ORDER BY created_at ASC, id ASC",
      [orderId],
    );
    return rows.map(mapPaymentEventRow);
  }

  async updateProcessedStatus(
    id: number,
    status: PaymentEventProcessedStatus,
    errorMessage?: string | null,
    connection?: PoolConnection,
  ): Promise<void> {
    const executor = connection ?? pool;
    await executor.execute(
      "UPDATE payment_events SET processed_status = ?, error_message = ? WHERE id = ?",
      [status, errorMessage ?? null, id],
    );
  }
}

export const paymentEventsRepository = new PaymentEventsRepository();
