import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Transaction } from '../domain/transaction.ts';
import type { TransactionRepository } from './ports.ts';
import { recordExpense } from './recordExpense.ts';

/**
 * A hand-written fake, not a mocking library. Roughly 20 lines, type-checked
 * against the real interface, and readable without knowing a mock DSL.
 * Because the port is synchronous, there is no promise plumbing anywhere.
 */
class FakeTransactionRepository implements TransactionRepository {
  readonly saved: Transaction[] = [];

  save(transaction: Transaction): void {
    this.saved.push(transaction);
  }

  findAll(): readonly Transaction[] {
    return this.saved;
  }

  totalSpentByCategory(): ReadonlyMap<string, number> {
    const totals = new Map<string, number>();
    for (const t of this.saved) {
      if (t.kind !== 'expense' || t.expenseCategoryId === null) continue;
      totals.set(t.expenseCategoryId, (totals.get(t.expenseCategoryId) ?? 0) + t.amountMinor);
    }
    return totals;
  }
}

test('recording an expense converts to minor units and saves once', () => {
  const repository = new FakeTransactionRepository();

  recordExpense(repository, {
    id: 't1',
    date: '2026-09-10',
    amountMajor: 12.5,
    description: 'REWE',
    accountId: 'acc-current',
    expenseCategoryId: 'cat-groceries',
  });

  assert.equal(repository.saved.length, 1);
  assert.equal(repository.saved[0]?.amountMinor, 1250);
  assert.equal(repository.saved[0]?.kind, 'expense');
});

test('an invalid command never reaches the repository', () => {
  const repository = new FakeTransactionRepository();

  assert.throws(() =>
    recordExpense(repository, {
      id: 't2',
      date: '2026-09-10',
      amountMajor: 0,
      description: 'nope',
      accountId: 'acc-current',
      expenseCategoryId: 'cat-groceries',
    }),
  );

  assert.equal(repository.saved.length, 0);
});
