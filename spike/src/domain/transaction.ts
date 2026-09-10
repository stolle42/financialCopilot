import type { Minor } from './money.ts';
import { isPositive } from './money.ts';

/**
 * A string union, not an enum. `erasableSyntaxOnly` forbids enums because Node's
 * type stripping cannot generate the runtime object an enum needs.
 * architecture.md already writes it this way.
 */
export type TransactionKind = 'expense' | 'income' | 'transfer';

export type Transaction = {
  readonly id: string;
  readonly date: string;
  readonly amountMinor: Minor;
  readonly kind: TransactionKind;
  readonly description: string;
  readonly accountId: string;
  readonly counterAccountId: string | null;
  readonly expenseCategoryId: string | null;
  readonly incomeCategoryId: string | null;
};

export class InvariantViolation extends Error {}

type Draft = {
  id: string;
  date: string;
  amountMinor: Minor;
  description: string;
  accountId: string;
};

/**
 * Invariant 2 (architecture.md): every expense and income transaction carries
 * exactly one category, from its own side's table. Transfers carry none.
 * Enforced here so it cannot be bypassed by any write path (invariant 5).
 */
export function expense(draft: Draft, expenseCategoryId: string): Transaction {
  requirePositive(draft.amountMinor);
  return {
    ...draft,
    kind: 'expense',
    counterAccountId: null,
    expenseCategoryId,
    incomeCategoryId: null,
  };
}

export function income(draft: Draft, incomeCategoryId: string): Transaction {
  requirePositive(draft.amountMinor);
  return {
    ...draft,
    kind: 'income',
    counterAccountId: null,
    expenseCategoryId: null,
    incomeCategoryId,
  };
}

export function transfer(draft: Draft, counterAccountId: string): Transaction {
  requirePositive(draft.amountMinor);
  if (counterAccountId === draft.accountId) {
    throw new InvariantViolation('a transfer needs two different accounts');
  }
  return {
    ...draft,
    kind: 'transfer',
    counterAccountId,
    expenseCategoryId: null,
    incomeCategoryId: null,
  };
}

function requirePositive(amount: Minor): void {
  if (!isPositive(amount)) {
    throw new InvariantViolation('amount must be positive');
  }
}
