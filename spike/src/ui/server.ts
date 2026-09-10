import { Hono } from 'hono';

import type { TransactionRepository } from '../application/ports.ts';
import { recordExpense } from '../application/recordExpense.ts';
import { html, renderToString, formatMinor } from './html.ts';

/**
 * The UI layer imports the application layer directly — the `UI --> APP` arrow
 * in architecture.md. That arrow is only true because the UI renders on the
 * server. An SPA would replace it with `UI --HTTP--> APP` plus a JSON API.
 */
export function createServer(repository: TransactionRepository): Hono {
  const app = new Hono();

  app.get('/', (c) => {
    const transactions = repository.findAll();
    const totals = repository.totalSpentByCategory('2026-01-01', '2026-12-31');

    return c.html(
      renderToString(html`
        <!doctype html>
        <title>spike</title>
        <style>
          body { font: 14px system-ui; max-width: 40rem; margin: 2rem auto; }
          table { border-collapse: collapse; width: 100%; }
          td, th { text-align: left; padding: 0.25rem 0.5rem; border-bottom: 1px solid #ddd; }
          .bar { background: #2d7; height: 1rem; }
        </style>

        <h1>Walking skeleton</h1>

        <h2>Ledger</h2>
        <table>
          <tr><th>Date</th><th>Description</th><th>Kind</th><th>Amount</th></tr>
          ${transactions.map(
            (t) => html`
              <tr>
                <td>${t.date}</td>
                <td>${t.description}</td>
                <td>${t.kind}</td>
                <td>${formatMinor(t.amountMinor)}</td>
              </tr>
            `,
          )}
        </table>

        <h2>Spending by category</h2>
        ${[...totals].map(
          ([id, total]) => html`
            <p>${id} — ${formatMinor(total)}</p>
            <div class="bar" style="width: ${Math.min(100, total / 1000)}%"></div>
          `,
        )}

        <h2>Add an expense</h2>
        <form method="post" action="/expenses">
          <input name="description" placeholder="description" required />
          <input name="amount" type="number" step="0.01" min="0.01" required />
          <button type="submit">Save</button>
        </form>
      `),
    );
  });

  app.post('/expenses', async (c) => {
    // Hono reads form bodies through web-standard FormData — the same mechanism
    // that handles multipart file upload for CSV import, with no extra package.
    const form = await c.req.formData();

    recordExpense(repository, {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      amountMajor: Number(form.get('amount')),
      description: String(form.get('description') ?? ''),
      accountId: 'acc-current',
      expenseCategoryId: 'cat-groceries',
    });

    return c.redirect('/');
  });

  return app;
}
