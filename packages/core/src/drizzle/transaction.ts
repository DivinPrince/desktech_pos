import { ExtractTablesWithRelations } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { db } from "./index";
import { createContext } from "../context";

export type Transaction = PgTransaction<
  NodePgQueryResultHKT,
  Record<string, never>,
  ExtractTablesWithRelations<Record<string, never>>
>;

type TxOrDb = Transaction | typeof db;

const TransactionContext = createContext<{
  tx: Transaction;
  effects: (() => void | Promise<void>)[];
}>();

export async function withTransaction<T>(callback: (trx: TxOrDb) => Promise<T>) {
  try {
    const { tx } = TransactionContext.get();
    return callback(tx);
  } catch {
    return callback(db);
  }
}

export async function afterTx(effect: () => void | Promise<void>) {
  try {
    const { effects } = TransactionContext.get();
    effects.push(effect);
  } catch {
    await effect();
  }
}

export async function createTransaction<T>(
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  try {
    const { tx } = TransactionContext.get();
    return callback(tx);
  } catch {
    const effects: (() => void | Promise<void>)[] = [];
    const result = await db.transaction(async (tx) => {
      return TransactionContext.provide(
        { tx: tx as unknown as Transaction, effects },
        () => callback(tx as unknown as Transaction),
      );
    });
    await Promise.all(effects.map((x) => x()));
    return result as T;
  }
}
