import { DatabaseSync } from 'node:sqlite';

import type { Transaction, TransactionKind } from '../domain/transaction.ts';
import type { TransactionRepository } from '../application/ports.ts';
import { SCHEMA, SCHEMA_VERSION } from './schema.ts';

type Row = {
  id: string;
  date: string;
  amount_minor: number;
  kind: string;
  description: string;
  account_id: string;
  counter_account_id: string | null;
  expense_category_id: string | null;
  income_category_id: string | null;
};

/**
 * Migrations without a framework: SQLite keeps a 32-bit integer inside the file
 * header (PRAGMA user_version) for exactly this. Newer versions get applied in
 * order; already-migrated files are left alone.
 */
export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number })
    .user_version;

  if (current < 1) {
    db.exec(SCHEMA);
  }
  if (current !== SCHEMA_VERSION) {
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
  return db;
}

export class SqliteTransactionRepository implements TransactionRepository {
  #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  save(t: Transaction): void {
    this.#db
      .prepare(
        `INSERT INTO transactions
           (id, date, amount_minor, kind, description,
            account_id, counter_account_id, expense_category_id, income_category_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        t.id,
        t.date,
        t.amountMinor,
        t.kind,
        t.description,
        t.accountId,
        t.counterAccountId,
        t.expenseCategoryId,
        t.incomeCategoryId,
      );
  }

  findAll(): readonly Transaction[] {
    const rows = this.#db
      .prepare('SELECT * FROM transactions ORDER BY date, id')
      .all() as unknown as Row[];
    return rows.map(toDomain);
  }

  /** The shape every Insights query has: group, sum, filter by period. */
  totalSpentByCategory(from: string, to: string): ReadonlyMap<string, number> {
    const rows = this.#db
      .prepare(
        `SELECT expense_category_id AS id, SUM(amount_minor) AS total
           FROM transactions
          WHERE kind = 'expense' AND date BETWEEN ? AND ?
       GROUP BY expense_category_id`,
      )
      .all(from, to) as unknown as { id: string; total: number }[];

    return new Map(rows.map((r) => [r.id, r.total]));
  }
}

/** The mapper is the boundary. An ORM would not remove this — see decision 2. */
function toDomain(row: Row): Transaction {
  return {
    id: row.id,
    date: row.date,
    amountMinor: row.amount_minor,
    kind: row.kind as TransactionKind,
    description: row.description,
    accountId: row.account_id,
    counterAccountId: row.counter_account_id,
    expenseCategoryId: row.expense_category_id,
    incomeCategoryId: row.income_category_id,
  };
}
