/**
 * The two-category-tables decision from architecture.md, expressed as SQL.
 *
 * The CHECK constraint is the point of this file: "exactly one category column,
 * matching kind" is enforced by the database, not by careful querying. No ORM
 * expresses this cleanly, which is one reason decision 2 went with plain SQL.
 */
export const SCHEMA = `
CREATE TABLE accounts (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE expense_categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE income_categories (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE transactions (
  id                  TEXT PRIMARY KEY,
  date                TEXT NOT NULL,
  amount_minor        INTEGER NOT NULL CHECK (amount_minor > 0),
  kind                TEXT NOT NULL CHECK (kind IN ('expense','income','transfer')),
  description         TEXT NOT NULL,
  account_id          TEXT NOT NULL REFERENCES accounts(id),
  counter_account_id  TEXT REFERENCES accounts(id),
  expense_category_id TEXT REFERENCES expense_categories(id),
  income_category_id  TEXT REFERENCES income_categories(id),

  CHECK (
    (kind = 'expense'  AND expense_category_id IS NOT NULL
                       AND income_category_id  IS NULL
                       AND counter_account_id  IS NULL)
    OR
    (kind = 'income'   AND income_category_id  IS NOT NULL
                       AND expense_category_id IS NULL
                       AND counter_account_id  IS NULL)
    OR
    (kind = 'transfer' AND expense_category_id IS NULL
                       AND income_category_id  IS NULL
                       AND counter_account_id  IS NOT NULL
                       AND counter_account_id <> account_id)
  )
);

CREATE INDEX transactions_by_date ON transactions(date);
`;

/** Migration mechanism: a version number stored inside the database file itself. */
export const SCHEMA_VERSION = 1;
