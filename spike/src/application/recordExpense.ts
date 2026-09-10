import type { TransactionRepository } from './ports.ts';
import { expense } from '../domain/transaction.ts';
import { fromMajor } from '../domain/money.ts';

export type RecordExpenseCommand = {
  id: string;
  date: string;
  amountMajor: number;
  description: string;
  accountId: string;
  expenseCategoryId: string;
};

export function recordExpense(
  repository: TransactionRepository,
  command: RecordExpenseCommand,
): void {
  const transaction = expense(
    {
      id: command.id,
      date: command.date,
      amountMinor: fromMajor(command.amountMajor),
      description: command.description,
      accountId: command.accountId,
    },
    command.expenseCategoryId,
  );
  repository.save(transaction);
}
