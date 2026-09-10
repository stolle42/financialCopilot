import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { expense, income, transfer } from '../domain/transaction.ts';
import { SqliteTransactionRepository, openDatabase } from './sqliteTransactionRepository.ts';

/**
 * A real database with real constraints, in memory, created and destroyed per
 * test in milliseconds. No fixture files, no cleanup, no mock pretending to be
 * SQLite. This is the payoff mentioned in decision 2.
 */
function freshRepository() {
  const db = openDatabase(':memory:');
  db.exec(`
    INSERT INTO accounts VALUES ('acc-current','Current'), ('acc-savings','Savings');
    INSERT INTO expense_categories VALUES ('cat-groceries','Groceries'), ('cat-rent','Rent');
    INSERT INTO income_categories VALUES ('inc-salary','Salary');
  `);
  return { db, repository: new SqliteTransactionRepository(db) };
}

const draft = (id: string, amountMinor: number, date = '2026-09-10') => ({
  id,
  date,
  amountMinor,
  description: 'test',
  accountId: 'acc-current',
});

describe('SqliteTransactionRepository', () => {
  test('a saved transaction round-trips unchanged', () => {
    const { repository } = freshRepository();
    repository.save(expense(draft('t1', 1250), 'cat-groceries'));

    const all = repository.findAll();
    assert.equal(all.length, 1);
    assert.deepEqual(all[0], expense(draft('t1', 1250), 'cat-groceries'));
  });

  test('income and transfers round-trip too', () => {
    const { repository } = freshRepository();
    repository.save(income(draft('t2', 250000), 'inc-salary'));
    repository.save(transfer(draft('t3', 20000), 'acc-savings'));

    const kinds = repository.findAll().map((t) => t.kind);
    assert.deepEqual(kinds.sort(), ['income', 'transfer']);
  });

  test('aggregation groups and sums by category', () => {
    const { repository } = freshRepository();
    repository.save(expense(draft('t1', 1250, '2026-09-01'), 'cat-groceries'));
    repository.save(expense(draft('t2', 3000, '2026-09-15'), 'cat-groceries'));
    repository.save(expense(draft('t3', 90000, '2026-09-02'), 'cat-rent'));
    repository.save(expense(draft('t4', 999, '2026-08-31'), 'cat-groceries'));

    const totals = repository.totalSpentByCategory('2026-09-01', '2026-09-30');
    assert.equal(totals.get('cat-groceries'), 4250);
    assert.equal(totals.get('cat-rent'), 90000);
  });

  test('transfers are excluded from spending — the charts can be trusted', () => {
    const { repository } = freshRepository();
    repository.save(transfer(draft('t1', 50000), 'acc-savings'));

    const totals = repository.totalSpentByCategory('2026-09-01', '2026-09-30');
    assert.equal(totals.size, 0);
  });

  describe('the database refuses invalid rows even if the domain is bypassed', () => {
    test('an expense without a category violates the CHECK constraint', () => {
      const { db } = freshRepository();
      assert.throws(() =>
        db.exec(`INSERT INTO transactions VALUES
          ('bad','2026-09-10',100,'expense','x','acc-current',NULL,NULL,NULL)`),
      );
    });

    test('a transfer carrying a category violates the CHECK constraint', () => {
      const { db } = freshRepository();
      assert.throws(() =>
        db.exec(`INSERT INTO transactions VALUES
          ('bad','2026-09-10',100,'transfer','x','acc-current','acc-savings','cat-rent',NULL)`),
      );
    });

    test('an unknown account is refused — foreign keys are ON by default', () => {
      const { db } = freshRepository();
      assert.throws(() =>
        db.exec(`INSERT INTO transactions VALUES
          ('bad','2026-09-10',100,'expense','x','acc-nope',NULL,'cat-rent',NULL)`),
      );
    });
  });
});
