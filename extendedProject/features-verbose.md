# Financial Copilot — Complete MVP Feature List (No AI)

> **Archived.** This is the *extended* feature list. The active MVP has been reduced to the
> nine-item subset in §14 below — see `../FEATURES.md`.

Everything needed for a fully useful expense/income tracker with monthly overview and health statements, using only deterministic logic. This is the whole product without a single model call.

**Priority key:** `P0` = MVP does not work without it · `P1` = ship in MVP, but after P0 · `P2` = MVP-adjacent, cut if time is short.

---

## 1. Foundation & Setup

- [ ] `P0` **Sign-in** — email magic link or passkey. Single user, but a real session.
- [ ] `P0` **`user_id` on every table + Postgres RLS** — not a feature you can see, but it must exist from row one.
- [ ] `P0` **Onboarding flow** — pick base currency (EUR), locale (de-DE), create first account, optionally import first statement.
- [ ] `P0` **Settings** — base currency, locale & date format, decimal display, timezone, month start day, theme.
- [ ] `P1` **Dashboard / home** — account balances, this month's income/expenses/net, count of uncategorized transactions, 10 most recent transactions, links into the ledger.

---

## 2. Accounts

- [ ] `P0` **Create / edit account** — name, type (`checking` | `savings` | `credit_card` | `cash` | `loan`), currency, opening balance, opening date.
- [ ] `P0` **Computed current balance** — `opening_balance + Σ transactions`. Never a manually stored mutable number.
- [ ] `P0` **Account list** — all accounts with balances, grouped by type, total net across accounts.
- [ ] `P0` **Account detail** — filtered transaction list + balance-over-time line.
- [ ] `P1` **Archive / unarchive** — archived accounts hidden from pickers but keep their history. **Never hard-delete an account that has transactions.**
- [ ] `P1` **Mark account as liquid** — feeds the emergency-fund runway metric (checking + savings = liquid, credit card ≠ liquid).
- [ ] `P2` **Cosmetics** — icon, colour, IBAN last 4 for identification.

---

## 3. Categories

- [ ] `P0` **Seeded default taxonomy** — two levels, EU/German-flavoured: Wohnen (Miete, Nebenkosten, Strom), Lebensmittel, Transport (ÖPNV, Auto, Kraftstoff), Versicherungen, Gesundheit, Abos & Digitales, Restaurants & Ausgehen, Shopping, Bildung, Reisen, Gebühren & Zinsen, Steuern, Sonstiges — plus income categories (Gehalt, Nebeneinkünfte, Erstattungen, Zinsen).
- [ ] `P0` **Category CRUD** — name, parent, kind (`income` | `expense` | `transfer`).
- [ ] `P0` **`is_fixed` flag per category** — required input for the fixed-vs-variable health metric. Set it while seeding.
- [ ] `P0` **`exclude_from_reports` flag** — for reimbursed business spend, internal noise, or a partner's money passing through.
- [ ] `P1` **Delete with reassignment** — deleting a category forces you to pick a replacement for its transactions.
- [ ] `P1` **Merge two categories** — you will create duplicates; you will want to fix them.
- [ ] `P2` **Colour + icon + manual sort order** — makes charts and pickers usable.

---

## 4. Transactions

- [ ] `P0` **Manual create** — date, amount, currency, account, category, counterparty, description, notes.
- [ ] `P0` **Quick-add** — one compact form, defaults to today + last-used account, counterparty autocomplete from history, saves and stays open for the next entry.
- [ ] `P0` **Edit / delete** single transaction.
- [ ] `P0` **Signed amounts + integer minor units** — one documented convention (expenses negative), enforced in the domain layer.
- [ ] `P0` **Transfer between own accounts** — one form creates two linked legs sharing a `transfer_group_id`. Excluded from income and expense everywhere.
- [ ] `P0` **Pair two existing transactions as a transfer** — the import path produces both legs separately, so you need to marry them after the fact.
- [ ] `P0` **Uncategorized inbox** — a dedicated view of everything without a category, with fast keyboard categorization. This is the screen that keeps your data clean.
- [ ] `P1` **Bulk edit** — select many rows, set category / tags / mark as transfer / exclude, in one action.
- [ ] `P1` **Split transaction** — one €120 purchase across several categories; validated so splits sum exactly to the total.
- [ ] `P1` **Tags** — free-form, many per transaction, filterable. Cuts across categories (`urlaub-2026`, `reimbursable`).
- [ ] `P1` **Recurring templates** — define "Miete, €1,150, monthly on the 1st"; the app auto-creates it on the due date into a review state, never silently committed.
- [ ] `P1` **Foreign-currency transaction** — enter the original amount + currency, store the FX rate used **on the transaction** plus the converted base amount. Never re-derive historic rates later.
- [ ] `P2` **Attachments** — upload a receipt image or PDF onto a transaction. Storage and display only, no extraction.
- [ ] `P2` **Duplicate a transaction** — for repeated irregular entries.
- [ ] `P2` **Pending vs booked flag** — matters for credit cards; skip if your import only gives booked rows.

---

## 5. Ledger (the transaction table)

This is the screen you'll spend the most time in. Treat it as a first-class feature, not a list view.

- [ ] `P0` **Table** — date, counterparty, category, account, amount; sortable; virtualized or paginated for 10k+ rows.
- [ ] `P0` **Filters** — date range (with presets: this month, last month, YTD, last 12m), accounts, categories, direction, amount range, full-text search, uncategorized-only.
- [ ] `P0` **Filter summary bar** — count, total in, total out, net for the *current filter*. Turns the ledger into an ad-hoc analysis tool and removes half the reasons you'd want NL queries.
- [ ] `P0` **Inline category edit** — change a category without opening a modal.
- [ ] `P1` **Keyboard navigation** — `j`/`k` to move, `e` edit, `c` categorize, `t` tag, `/` search. Makes cleanup 5× faster.
- [ ] `P1` **Export current view to CSV.**
- [ ] `P2` **Saved views** — named filter presets.
- [ ] `P2` **Tag filter, attachment filter, similar-transaction lookup** ("show all other rows from this counterparty").

---

## 6. Import (the heart of the MVP)

- [ ] `P0` **File upload** — CSV first, **CAMT.053 XML** close behind (German banks commonly offer it and it's far richer and more stable than CSV).
- [ ] `P0` **Encoding / delimiter / decimal-separator detection with manual override** — German exports love `;`, `ISO-8859-1`, and `1.234,56`.
- [ ] `P0` **Mapping profile** — assign columns to fields, choose date format, handle single-signed-amount vs separate debit/credit columns, set sign convention. Saved per bank/account and reused on every future import.
- [ ] `P0` **Live preview during mapping** — show the first 10 rows as they'll be parsed, before committing to the profile.
- [ ] `P0` **Immutable raw-row storage** — persist every source row verbatim, linked to an `import_batch`. When you later discover a parsing quirk, you re-run the parser over stored rows instead of re-uploading two years of statements.
- [ ] `P0` **Deterministic dedup** — bank end-to-end ID when present, otherwise `hash(account, booking_date, amount, normalized_description, sequence_within_day)`, with a unique index. **Acceptance test: import the same statement twice; the second import commits zero rows.**
- [ ] `P0` **Near-duplicate flagging** — same amount and counterparty within a few days gets surfaced for human judgment rather than auto-dropped (two identical €4.50 coffees are real).
- [ ] `P0` **Review queue before commit** — staged rows with rule-proposed categories, inline editing, per-row exclude, "accept all", then one commit action.
- [ ] `P1` **Import history** — batch list with file name, date, row counts (imported / skipped / duplicate).
- [ ] `P1` **Undo a whole batch** — delete every transaction from one import in one action. You will need this in the first week.
- [ ] `P1` **Re-parse a batch** — after fixing a mapping profile, re-run it against stored raw rows.
- [ ] `P2` **Multi-file upload** and drag-and-drop.

---

## 7. Rules Engine

This is what replaces AI categorization in a no-AI MVP — and it's what makes AI cheap later, since the model only ever sees what the rules miss.

- [ ] `P0` **Rule model** — conditions on counterparty / description (`contains`, `starts with`, `regex`), amount range, direction, account; combined with AND.
- [ ] `P0` **Rule actions** — set category, set tags, rewrite counterparty to a clean name, mark as transfer, mark excluded.
- [ ] `P0` **Priority ordering, first match wins** — explicit, reorderable, no hidden precedence.
- [ ] `P0` **Rules applied during import** — every staged row arrives pre-categorized where possible.
- [ ] `P0` **"Create rule from this transaction"** — one click from any row, prefilled with a sensible condition. The single most-used button in the app.
- [ ] `P1` **Rule preview / dry-run** — "this rule matches 47 existing transactions" with the list, before you save it.
- [ ] `P1` **Apply rules retroactively** — to all transactions, a filtered set, or just the uncategorized ones.
- [ ] `P1` **Counterparty normalization table** — manual mapping of raw descriptors (`PAYPAL *SPOTIFYAB 3531…` → `Spotify`), so reports and recurring detection group correctly.
- [ ] `P2` **Hit counters + last-matched date per rule** — for finding dead or over-broad rules.

---

## 8. Recurring & Subscriptions (statistical, no AI)

- [ ] `P1` **Series detection** — group by normalized counterparty, look for ≥3 occurrences with similar amounts (±10%) at a regular cadence (weekly / monthly / quarterly / yearly).
- [ ] `P1` **Recurring list** — name, typical amount, cadence, last seen, next expected, annualized cost.
- [ ] `P1` **Confirm / dismiss a detected series** — the detector will guess wrong; let the user be the authority.
- [ ] `P1` **Total monthly commitment** — sum of all confirmed recurring outflows, normalized to monthly (a yearly €480 insurance counts as €40).
- [ ] `P1` **Price-change detection** — "Netflix went from €13.99 to €17.99 in June". Pure comparison, no model needed.
- [ ] `P2` **Missing / late detection** — expected on the 3rd, today is the 9th, nothing arrived.

---

## 9. Monthly Overview

- [ ] `P0` **Month selector** with previous/next navigation.
- [ ] `P0` **KPI row** — total income, total expenses, net, savings rate — each with the delta vs the previous month.
- [ ] `P0` **Category breakdown** — table and horizontal bar chart: amount, % of total spend, vs last month, vs 6-month average. Parent categories collapsible to children.
- [ ] `P0` **Drill-down** — click any category to see its transactions for that month.
- [ ] `P0` **Correct exclusions** — transfers, excluded categories, and both legs of internal moves never appear as income or expense. **Acceptance test: transfer €1,000 to savings; income and expenses both stay unchanged.**
- [ ] `P0` **Data-quality banner** — "€432 across 11 transactions is uncategorized" with a link to fix it. Without this, you'll trust a report that's silently 15% wrong.
- [ ] `P1` **12-month trend** — income vs expenses vs net, bar or line.
- [ ] `P1` **Top counterparties** for the month.
- [ ] `P1` **Cumulative spend curve** — this month vs the same day-of-month in previous months. The most intuitive "am I overspending" view there is.
- [ ] `P2` **Month-end projection** — actual to date + remaining expected recurring items.
- [ ] `P2` **Custom period reports** — arbitrary date ranges, quarters, year.

---

## 10. Financial Health Statement

All deterministic. Each metric: current value, trend vs its own history, and a one-line plain-language definition visible on hover.

- [ ] `P0` **Savings rate** — `(income − expenses) / income`, for the month plus 3/6/12-month averages.
- [ ] `P0` **Fixed vs variable split** — using the `is_fixed` category flag; shown as a ratio and as fixed-cost-as-%-of-income.
- [ ] `P0` **Emergency fund runway** — `liquid account balances / average monthly essential spend`, in months.
- [ ] `P0` **Recurring commitment load** — monthly-normalized recurring outflows as % of income.
- [ ] `P1` **Category concentration** — top 3 categories as % of total spend.
- [ ] `P1` **Deviation flags** — any category more than X% above its own 6-month median this month. Threshold-based, no model.
- [ ] `P1` **Net cashflow trend** — 6- or 12-month rolling net, with direction.
- [ ] `P1` **"Needs attention" list** — assembled from the flags above by fixed rules (deviations, price increases, negative savings rate, runway under 3 months). This is the deterministic stand-in for an AI narrative, and it's most of the value.
- [ ] `P2` **Print / PDF export of the statement.**
- [ ] `P2` **Income stability** — coefficient of variation of monthly income. Useful if income is irregular.

---

## 11. Data Management

- [ ] `P0` **Full export** — every transaction as CSV, plus a complete JSON dump including accounts, categories and rules.
- [ ] `P0` **Automated database backups** with a *tested* restore. This is your financial history.
- [ ] `P1` **Delete-everything / reset** — also your future GDPR erasure path.
- [ ] `P1` **FX rate handling** — a manual rate table or a scheduled rate fetch, plus per-transaction stored rates.
- [ ] `P2` **Audit log view** — what changed, when, by whom. Invaluable when a number looks wrong.

---

## 12. Technical foundations (invisible, non-negotiable)

- [ ] `P0` **`money.ts`** — Money type over integer minor units, safe add/subtract/allocate, currency-mismatch guards. Write this and its tests **first**; it's ~100 lines and it prevents the class of bug that destroys trust.
- [ ] `P0` **Golden-file report tests** — a fixed fixture ledger, an asserted monthly-report JSON output. Catches every silent aggregation regression forever.
- [ ] `P0` **Domain unit tests** — dedup keys, rule matching and priority, recurring detection, every health metric.
- [ ] `P0` **Idempotent import test** — same file twice, zero new rows.
- [ ] `P0` **Migrations** — versioned schema from day one.
- [ ] `P1` **Locale-correct formatting** — `1.234,56 €`, `10.08.2026`, correct week starts.
- [ ] `P1` **Responsive quick-add** — the phone browser is where cash spending gets logged. The full ledger can stay desktop-only.
- [ ] `P1` **Empty / loading / error states** on every screen.
- [ ] `P1` **Sentry + structured logging.**
- [ ] `P2` **Playwright test over the full import flow** — upload → map → review → commit.

---

## 13. Deliberately out of scope for this list

Budgets and envelopes · bank sync via PSD2 · investments and net worth · debt payoff planning · forecasting beyond simple recurring projection · multi-user or household sharing · native mobile app · tax exports · goals · and every AI feature (categorization, receipt extraction, Q&A, narratives, anomaly explanation).

---

## 14. The minimum viable subset, if you want to be brutal

If you cut everything down to what makes the app genuinely useful on day one, it's these nine:

1. Accounts with computed balances
2. Transaction CRUD + quick-add
3. CSV import with a saved mapping profile
4. Deterministic dedup
5. Import review queue
6. Categories with a rule engine and "create rule from transaction"
7. Transfer handling
8. Monthly overview with category breakdown
9. Savings rate + fixed/variable + runway

Ship those, use them on your own real statements for a month, and the rest of this list will reorder itself according to what actually annoys you.
