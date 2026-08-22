import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool } from "../../database/pool.js";
import type {
  DeliveryMethod,
  FulfilmentStatus,
  OrderDeliveryRecord,
  OrderRecord,
  OrderSourceType,
  OrderStatus,
  PaymentStatus,
  ProofOfDeliveryType,
} from "../../types/database.types.js";
import type { MarkDeliveredInput, ReadyForCollectionInput, ShipOrderInput } from "./delivery.schemas.js";

function mapDeliveryRow(row: RowDataPacket): OrderDeliveryRecord {
  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    deliveryMethod: row.delivery_method as DeliveryMethod,
    carrierName: row.carrier_name ? String(row.carrier_name) : null,
    trackingNumber: row.tracking_number ? String(row.tracking_number) : null,
    trackingUrl: row.tracking_url ? String(row.tracking_url) : null,
    dispatchNotes: row.dispatch_notes ? String(row.dispatch_notes) : null,
    dispatchedAt: row.dispatched_at ? new Date(row.dispatched_at as string | Date) : null,
    collectionLocation: row.collection_location ? String(row.collection_location) : null,
    collectionInstructions: row.collection_instructions ? String(row.collection_instructions) : null,
    collectionReadyAt: row.collection_ready_at ? new Date(row.collection_ready_at as string | Date) : null,
    collectedAt: row.collected_at ? new Date(row.collected_at as string | Date) : null,
    estimatedDeliveryAt: row.estimated_delivery_at
      ? new Date(row.estimated_delivery_at as string | Date)
      : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at as string | Date) : null,
    proofOfDeliveryType: (row.proof_of_delivery_type as ProofOfDeliveryType) ?? null,
    proofOfDeliveryRef: row.proof_of_delivery_ref ? String(row.proof_of_delivery_ref) : null,
    proofOfDeliveryNotes: row.proof_of_delivery_notes ? String(row.proof_of_delivery_notes) : null,
    buyerConfirmedAt: row.buyer_confirmed_at
      ? new Date(row.buyer_confirmed_at as string | Date)
      : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

function mapOrderRow(row: RowDataPacket): OrderRecord {
  return {
    id: Number(row.id),
    orderReference: String(row.order_reference),
    buyerId: Number(row.buyer_id),
    sellerId: Number(row.seller_id),
    listingId: Number(row.listing_id),
    sourceType: row.source_type as OrderSourceType,
    sourceOfferId: row.source_offer_id ? Number(row.source_offer_id) : null,
    sourceAllocationId: row.source_allocation_id ? Number(row.source_allocation_id) : null,
    sourceReference: String(row.source_reference),
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    currency: String(row.currency),
    orderStatus: row.order_status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    fulfilmentStatus: row.fulfilment_status as FulfilmentStatus,
    deliveryMethod: row.delivery_method as DeliveryMethod,
    buyerConfirmationDeadline: row.buyer_confirmation_deadline
      ? new Date(row.buyer_confirmation_deadline as string | Date)
      : null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
  };
}

export class DeliveryRepository {
  async findByOrderId(orderId: number): Promise<OrderDeliveryRecord | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM order_deliveries WHERE order_id = ? LIMIT 1",
      [orderId],
    );
    if (!rows[0]) return null;
    return mapDeliveryRow(rows[0]);
  }

  async updateShipping(orderId: number, data: ShipOrderInput, connection?: PoolConnection): Promise<void> {
    await (connection ?? pool).execute(
      `UPDATE order_deliveries SET
        carrier_name = ?,
        tracking_number = ?,
        tracking_url = ?,
        dispatch_notes = ?,
        dispatched_at = CURRENT_TIMESTAMP,
        estimated_delivery_at = ?
      WHERE order_id = ?`,
      [
        data.carrierName,
        data.trackingNumber,
        data.trackingUrl || null,
        data.dispatchNotes || null,
        data.estimatedDeliveryAt || null,
        orderId,
      ],
    );
  }

  async updateCollection(orderId: number, data: ReadyForCollectionInput, connection?: PoolConnection): Promise<void> {
    await (connection ?? pool).execute(
      `UPDATE order_deliveries SET
        collection_location = ?,
        collection_instructions = ?,
        collection_ready_at = COALESCE(?, CURRENT_TIMESTAMP)
      WHERE order_id = ?`,
      [
        data.collectionLocation,
        data.collectionInstructions,
        data.collectionReadyAt || null,
        orderId,
      ],
    );
  }

  async updateDelivered(orderId: number, data: MarkDeliveredInput, connection?: PoolConnection): Promise<void> {
    await (connection ?? pool).execute(
      `UPDATE order_deliveries SET
        delivered_at = CURRENT_TIMESTAMP,
        proof_of_delivery_type = ?,
        proof_of_delivery_ref = ?,
        proof_of_delivery_notes = ?
      WHERE order_id = ?`,
      [
        data.proofOfDeliveryType,
        data.proofOfDeliveryRef || null,
        data.proofOfDeliveryNotes || null,
        orderId,
      ],
    );
  }

  async updateBuyerConfirmed(orderId: number, connection?: PoolConnection): Promise<void> {
    await (connection ?? pool).execute(
      `UPDATE order_deliveries SET
        buyer_confirmed_at = CURRENT_TIMESTAMP,
        collected_at = COALESCE(collected_at, CURRENT_TIMESTAMP)
      WHERE order_id = ?`,
      [orderId],
    );
  }

  async setBuyerConfirmationDeadline(orderId: number, deadline: Date, connection?: PoolConnection): Promise<void> {
    await (connection ?? pool).execute(
      "UPDATE orders SET buyer_confirmation_deadline = ? WHERE id = ?",
      [deadline, orderId],
    );
  }

  async findOrdersExpiredForConfirmation(now: Date = new Date()): Promise<OrderRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM orders
       WHERE order_status IN ('delivered', 'buyer_confirmation')
         AND buyer_confirmation_deadline IS NOT NULL
         AND buyer_confirmation_deadline <= ?
         AND id NOT IN (SELECT order_id FROM disputes WHERE status IN ('opened', 'under_review'))`,
      [now],
    );
    return rows.map(mapOrderRow);
  }
}

export const deliveryRepository = new DeliveryRepository();
