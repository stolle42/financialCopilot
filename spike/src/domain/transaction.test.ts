import { test } from 'node:test';
import assert from 'node:assert/strict';

import { expense, income, transfer, InvariantViolation } from './transaction.ts';
import { fromMajor } from './money.ts';

/**
 * Note what is absent: no database, no fixture, no mock, no setup.
 * architecture.md names "a domain test that needs a database fixture" as the
 * symptom of a leaked boundary. With this design that test cannot be written.
 */

const draft = {
  id: 't1',
  date: '2026-09-10',
  amountMinor: fromMajor(12.5),
  description: 'REWE SAGT DANKE',
  accountId: 'acc-current',
};

test('money avoids floating point entirely', () => {
  assert.equal(fromMajor(12.5), 1250);
  assert.equal(fromMajor(0.1) + fromMajor(0.2), fromMajor(0.3));
});

test('an expense carries exactly one category, on the expense side', () => {
  const t = expense(draft, 'cat-groceries');
  assert.equal(t.kind, 'expense');
  assert.equal(t.expenseCategoryId, 'cat-groceries');
  assert.equal(t.incomeCategoryId, null);
  assert.equal(t.counterAccountId, null);
});

test('income carries exactly one category, on the income side', () => {
  const t = income(draft, 'inc-salary');
  assert.equal(t.incomeCategoryId, 'inc-salary');
  assert.equal(t.expenseCategoryId, null);
});

test('a transfer carries no category at all — invariant 2', () => {
  const t = transfer(draft, 'acc-savings');
  assert.equal(t.expenseCategoryId, null);
  assert.equal(t.incomeCategoryId, null);
  assert.equal(t.counterAccountId, 'acc-savings');
});

test('a transfer to the same account is rejected', () => {
  assert.throws(() => transfer(draft, 'acc-current'), InvariantViolation);
});

test('a non-positive amount is rejected', () => {
  assert.throws(() => expense({ ...draft, amountMinor: 0 }, 'cat-x'), InvariantViolation);
});
