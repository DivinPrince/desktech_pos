import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CompletedSaleReceipt } from "@/lib/counter-checkout/types";
import { getDesktechSqlite } from "@/lib/data/sqlite-db";

import type { LocalCounterSaleRow } from "./types";

const ASYNC_STORAGE_KEY = "desktech:local-counter-sales:v1";

let sqliteTableReady = false;

function localDayBoundsMs(day: Date): { startMs: number; endMs: number } {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

async function ensureSqliteTable(): Promise<void> {
  if (sqliteTableReady) return;
  const db = getDesktechSqlite();
  if (!db) return;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_counter_sale (
      id TEXT PRIMARY KEY NOT NULL,
      business_id TEXT NOT NULL,
      completed_at_iso TEXT NOT NULL,
      completed_at_ms INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_local_counter_sale_business_time
      ON local_counter_sale (business_id, completed_at_ms);
  `);
  sqliteTableReady = true;
}

function rowFromReceipt(
  businessId: string,
  receipt: CompletedSaleReceipt,
): LocalCounterSaleRow {
  const completedAtMs = new Date(receipt.completedAtIso).getTime();
  return {
    id: receipt.saleId,
    businessId,
    completedAtIso: receipt.completedAtIso,
    completedAtMs: Number.isFinite(completedAtMs) ? completedAtMs : Date.now(),
    receipt,
  };
}

async function readWebRows(): Promise<LocalCounterSaleRow[]> {
  const raw = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as LocalCounterSaleRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeWebRows(rows: LocalCounterSaleRow[]): Promise<void> {
  await AsyncStorage.setItem(ASYNC_STORAGE_KEY, JSON.stringify(rows));
}

export async function appendLocalCounterSale(args: {
  businessId: string;
  receipt: CompletedSaleReceipt;
}): Promise<void> {
  const row = rowFromReceipt(args.businessId, args.receipt);
  const db = getDesktechSqlite();
  if (db) {
    await ensureSqliteTable();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_counter_sale
        (id, business_id, completed_at_iso, completed_at_ms, payload_json)
        VALUES (?, ?, ?, ?, ?)`,
      [
        row.id,
        row.businessId,
        row.completedAtIso,
        row.completedAtMs,
        JSON.stringify(row.receipt),
      ],
    );
    return;
  }

  const all = await readWebRows();
  const next = all.filter((r) => !(r.id === row.id && r.businessId === row.businessId));
  next.push(row);
  await writeWebRows(next);
}

export async function listLocalSalesForLocalCalendarDay(
  businessId: string,
  day: Date,
): Promise<LocalCounterSaleRow[]> {
  const { startMs, endMs } = localDayBoundsMs(day);
  const db = getDesktechSqlite();
  if (db) {
    await ensureSqliteTable();
    const result = await db.getAllAsync<{
      id: string;
      business_id: string;
      completed_at_iso: string;
      completed_at_ms: number;
      payload_json: string;
    }>(
      `SELECT id, business_id, completed_at_iso, completed_at_ms, payload_json
       FROM local_counter_sale
       WHERE business_id = ?
         AND completed_at_ms >= ? AND completed_at_ms < ?
       ORDER BY completed_at_ms DESC`,
      [businessId, startMs, endMs],
    );
    return result.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      completedAtIso: r.completed_at_iso,
      completedAtMs: r.completed_at_ms,
      receipt: JSON.parse(r.payload_json) as CompletedSaleReceipt,
    }));
  }

  const all = await readWebRows();
  return all
    .filter(
      (r) =>
        r.businessId === businessId &&
        r.completedAtMs >= startMs &&
        r.completedAtMs < endMs,
    )
    .sort((a, b) => b.completedAtMs - a.completedAtMs);
}

export async function patchSaleIdIfPending(args: {
  businessId: string;
  pendingSaleId: string;
  finalSaleId: string;
}): Promise<void> {
  if (args.pendingSaleId === args.finalSaleId) return;
  const db = getDesktechSqlite();
  if (db) {
    await ensureSqliteTable();
    const rows = await db.getAllAsync<{
      completed_at_iso: string;
      completed_at_ms: number;
      payload_json: string;
    }>(
      `SELECT completed_at_iso, completed_at_ms, payload_json FROM local_counter_sale WHERE id = ? AND business_id = ?`,
      [args.pendingSaleId, args.businessId],
    );
    const first = rows[0];
    if (!first) return;
    const receipt = JSON.parse(first.payload_json) as CompletedSaleReceipt;
    const nextReceipt: CompletedSaleReceipt = {
      ...receipt,
      saleId: args.finalSaleId,
    };
    await db.runAsync(`DELETE FROM local_counter_sale WHERE id = ? AND business_id = ?`, [
      args.pendingSaleId,
      args.businessId,
    ]);
    await db.runAsync(
      `INSERT OR REPLACE INTO local_counter_sale
        (id, business_id, completed_at_iso, completed_at_ms, payload_json)
        VALUES (?, ?, ?, ?, ?)`,
      [
        args.finalSaleId,
        args.businessId,
        first.completed_at_iso,
        first.completed_at_ms,
        JSON.stringify(nextReceipt),
      ],
    );
    return;
  }

  const all = await readWebRows();
  const idx = all.findIndex(
    (r) => r.id === args.pendingSaleId && r.businessId === args.businessId,
  );
  if (idx < 0) return;
  const prev = all[idx]!;
  const nextReceipt: CompletedSaleReceipt = {
    ...prev.receipt,
    saleId: args.finalSaleId,
  };
  const nextRow: LocalCounterSaleRow = {
    ...prev,
    id: args.finalSaleId,
    receipt: nextReceipt,
  };
  const others = all.filter((_, i) => i !== idx);
  others.push(nextRow);
  await writeWebRows(others);
}
