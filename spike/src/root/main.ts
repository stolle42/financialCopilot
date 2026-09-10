import { serve } from '@hono/node-server';

import { SqliteTransactionRepository, openDatabase } from '../infrastructure/sqliteTransactionRepository.ts';
import { createServer } from '../ui/server.ts';

/**
 * The composition root: the single place that may import everything, because
 * wiring is the one job that needs the concrete classes (architecture.md).
 *
 * Nothing here is hardcoded. The data file path and the port are injected from
 * the environment with defaults, so Docker and desktop packaging stay possible
 * without touching any other file (vision.md: "the user can run a local app").
 */
const databasePath = process.env['FC_DB'] ?? './spike.db';
const port = Number(process.env['FC_PORT'] ?? 8787);

const db = openDatabase(databasePath);

// Reference data, so the skeleton has something to show on first run.
db.exec(`
  INSERT OR IGNORE INTO accounts VALUES ('acc-current','Current'), ('acc-savings','Savings');
  INSERT OR IGNORE INTO expense_categories VALUES ('cat-groceries','Groceries'), ('cat-rent','Rent');
  INSERT OR IGNORE INTO income_categories VALUES ('inc-salary','Salary');
`);

const app = createServer(new SqliteTransactionRepository(db));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`spike running at http://localhost:${info.port}  (db: ${databasePath})`);
});
