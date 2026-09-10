import type { Transaction } from '../domain/transaction.ts';

/**
 * Synchronous — no Promise. Decision 2: local-first means the local database is
 * the sole source of truth permanently, so this port is local by definition and
 * will never become a network call. Async ports (AI features) get their own
 * interfaces later, where the asynchrony is real rather than speculative.
 */
export interface TransactionRepository {
  save(transaction: Transaction): void;
  findAll(): readonly Transaction[];
  totalSpentByCategory(from: string, to: string): ReadonlyMap<string, number>;
}
