/**
 * The two-category-tables decision from architecture.md, expressed as SQL.
 *
 * The CHECK constraint is the point of this file: "exactly one category column,
 * matching kind" is enforced by the database, not by careful querying. No ORM
 * expresses this cleanly, which is one reason decision 2 went with plain SQL.
 */
export declare const SCHEMA = "\nCREATE TABLE accounts (\n  id   TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n);\n\nCREATE TABLE expense_categories (\n  id   TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n);\n\nCREATE TABLE income_categories (\n  id   TEXT PRIMARY KEY,\n  name TEXT NOT NULL\n);\n\nCREATE TABLE transactions (\n  id                  TEXT PRIMARY KEY,\n  date                TEXT NOT NULL,\n  amount_minor        INTEGER NOT NULL CHECK (amount_minor > 0),\n  kind                TEXT NOT NULL CHECK (kind IN ('expense','income','transfer')),\n  description         TEXT NOT NULL,\n  account_id          TEXT NOT NULL REFERENCES accounts(id),\n  counter_account_id  TEXT REFERENCES accounts(id),\n  expense_category_id TEXT REFERENCES expense_categories(id),\n  income_category_id  TEXT REFERENCES income_categories(id),\n\n  CHECK (\n    (kind = 'expense'  AND expense_category_id IS NOT NULL\n                       AND income_category_id  IS NULL\n                       AND counter_account_id  IS NULL)\n    OR\n    (kind = 'income'   AND income_category_id  IS NOT NULL\n                       AND expense_category_id IS NULL\n                       AND counter_account_id  IS NULL)\n    OR\n    (kind = 'transfer' AND expense_category_id IS NULL\n                       AND income_category_id  IS NULL\n                       AND counter_account_id  IS NOT NULL\n                       AND counter_account_id <> account_id)\n  )\n);\n\nCREATE INDEX transactions_by_date ON transactions(date);\n";
/** Migration mechanism: a version number stored inside the database file itself. */
export declare const SCHEMA_VERSION = 1;
