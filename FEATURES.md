# Financial Copilot — MVP Feature List

**Scope:** eight features. The nine-item subset in `extendedProject/features-verbose.md` §14, minus transfer handling, with the rules engine stripped out of the categories item.
**No AI. No model calls. Deterministic logic only.**

The rule for this document: **if it is not on this page, it is not in v1.** Everything cut is in §10.

---

## The eight

| # | Feature | Section |
|---|---|---|
| 1 | Accounts with computed balances | §2 |
| 2 | Transaction CRUD + quick-add | §3 |
| 3 | CSV import with a saved mapping profile | §5 |
| 4 | Deterministic dedup | §5.1 |
| 5 | Import review queue | §5.2 |
| 6 | Categories | §4 |
| 7 | Monthly overview with category breakdown | §6 |
| 8 | Savings rate + fixed/variable + runway | §7 |

Two things not on that list are built anyway, because the eight are unusable without them: a **ledger** (§8) and **`money.ts` with its tests** (§9).

### What changed from nine

- **Transfer handling cut** (was item 7). See §3.1 — has a correctness consequence worth reading before you start.
- **Rules engine cut** from what was item 6. Every transaction is categorized by hand — but in the review queue, at import time, not afterwards.

---

## 1. Foundation

- [ ] **Single hardcoded user, no sign-in.** One seeded row in `users`. Every table still carries `user_id` and every query still filters it — the discipline is kept, the login screen is not built. `ARCHITECTURE.md` §7 covers why.
- [ ] **Config from `.env`, no settings screen.** `EUR`, `de-DE`, `Europe/Berlin`, all accounts EUR.
- [ ] **Versioned migrations** from day one.
- [ ] **Seed script** — the German taxonomy with `is_fixed` and `is_essential` set, plus Umbuchung (§3.1) and Unklar (§5.2).

No onboarding, no dashboard, no theme switcher. The monthly overview is the home page.

---

## 2. Accounts

- [ ] **Create / edit account** — name, type (`checking` | `savings` | `credit_card` | `cash`), opening balance, opening date.
- [ ] **`is_liquid` flag** — checking and savings yes, credit card no. The runway metric needs it.
- [ ] **Computed current balance** — `opening_balance + Σ transactions`. Never a stored mutable number.
- [ ] **Account list** with balances and a total.
- [ ] **Never hard-delete an account that has transactions.**

Cut: account detail page, balance-over-time chart, `loan` type, archive, icons, colours, IBAN last 4, non-EUR accounts.

---

## 3. Transactions

- [ ] **Quick-add** — one compact form: date (defaults to today), amount, account (defaults to last used), category, counterparty, description. Saves and stays open for the next entry. Counterparty autocomplete from history via prefix match.
- [ ] **Edit / delete** a single transaction. Same form as quick-add.
- [ ] **Signed amounts, integer minor units** — expenses negative, income positive. One convention, enforced in the domain layer, asserted at every write.
- [ ] **Row-level exclude toggle** — three states: inherit the category's flag (default), force-include, force-exclude. On the edit form and inline in the ledger. The only thing that writes `is_excluded`.

Cut: splits, tags, recurring templates, foreign currency, attachments, duplicate-a-transaction, pending-vs-booked, bulk edit, free-form notes, a separate uncategorized inbox screen (the ledger's uncategorized filter is it).

### 3.1 Transfers between your own accounts — not supported

No `transfer_group_id`, no two-leg form, no pairing, no invariant check.

**The consequence:** moving €1,000 from checking to savings creates a `-1,000` row and a `+1,000` row. The monthly overview counts the first as an expense and the second as income. So in any month you move money between your own accounts — including every credit-card payment — **income, expenses, net and savings rate are inflated and wrong.** Account balances are unaffected; both rows are real and correct on their own accounts.

**The zero-build workaround.** `categories.kind` includes `'transfer'`, and the report predicate excludes any transaction whose category has that kind. So: categorize **both** legs into the seeded **Umbuchung** category and the numbers come out right. Nothing was built for this; it falls out of the category model.

**Its weakness:** categorize only one leg and income is silently wrong, with no warning. The cheap substitute for the cut invariant check is one query — sum every `kind = 'transfer'` transaction in the month, flag it in the data-quality banner when the total is not roughly zero. About an hour of work, and worth doing pre-emptively if you own more than two accounts.

Proper transfer support is the first item in §10.

---

## 4. Categories

- [ ] **Seeded two-level taxonomy** — Wohnen (Miete, Nebenkosten, Strom), Lebensmittel, Transport (ÖPNV, Auto, Kraftstoff), Versicherungen, Gesundheit, Abos & Digitales, Restaurants & Ausgehen, Shopping, Bildung, Reisen, Gebühren & Zinsen, Steuern, Sonstiges; income: Gehalt, Nebeneinkünfte, Erstattungen, Zinsen; plus **Umbuchung** (`kind = 'transfer'`, §3.1) and **Unklar** (§5.2).
- [ ] **Category CRUD** — name, parent, kind (`income` | `expense` | `transfer`).
- [ ] **`is_fixed` flag** — input to the fixed-vs-variable metric.
- [ ] **`is_essential` flag** — the runway denominator. A different question from fixed: rent is both, a gym membership is fixed but not essential, groceries are essential but not fixed. Conflating them makes runway wrong.
- [ ] **`exclude_from_reports` flag** — reimbursed spend, money passing through.
- [ ] **Delete with reassignment** and **merge two categories.** Promoted from P1: the seeded taxonomy will be wrong for you and you will want these in week two.

Cut: colours, icons, sort order, more than two levels.

---

## 5. CSV import

**CSV only.** Parsed rows are staged, reviewed, and only then written to `transactions`. **Manual entry is not staged** — quick-add writes one categorized row directly, because there is no error to catch in a row you typed yourself.

- [ ] **File upload**, one file at a time.
- [ ] **Encoding / delimiter / decimal-separator / header-offset detection, always overridable.** German exports use `;`, `ISO-8859-1` or `windows-1252`, `1.234,56`, `DD.MM.YYYY`, and often put junk rows above the real header.
- [ ] **Mapping profile** — columns to fields, date format, amount mode (single signed column / inverted / separate `Soll`/`Haben` / unsigned + direction indicator), `skipLines`, and **the end-to-end reference column if the export has one** (§5.1 — the dedup fast path needs a mapped source or it can never fire). Saved per account, reused on every future import from that bank.
- [ ] **Live preview** — the first 10 rows as they will be parsed, before you commit to the profile.
- [ ] **Counterparty display normalization** — keep the bank's text verbatim in `counterparty_raw`, and store a lightly cleaned `counterparty` (trim, collapse whitespace, strip trailing reference digits). Cosmetic and freely changeable, unlike the dedup normalizer. Needed because the review queue clusters rows by counterparty and reference numbers break the clustering.
- [ ] **Immutable raw-row storage** — every source row persisted verbatim against an `import_batch`, and kept after commit. **Preserves** the data so a future "re-parse this batch" feature can fix a parsing quirk without re-downloading two years of statements. Re-parse itself is cut (§10), so today the payoff is insurance, not a button.
- [ ] **Recent imports list** — the last ten batches with filename, date, row counts, an **undo** action for committed ones, and a resume link for batches still in review.

### 5.1 Deterministic dedup

- [ ] **Bank end-to-end reference when usable**, otherwise `hash(account, booking_date, amount, normalized_description, ordinal_within_source)`, behind a unique index.
- [ ] **The reference must be mapped and stored to be usable.** It is a column in the mapping profile and a column on `transactions`. If a bank's export has no such column, the profile leaves it unmapped and every row takes the hash path — fine, and the common case.
- [ ] Sentinel values (`NOTPROVIDED`, `NOTAVAILABLE`, empty, low-entropy) must fall through to the hash, or every row after the first is silently dropped.
- [ ] The ordinal is computed **from the source file only**, never from the database — otherwise re-importing a file containing two identical same-day coffees commits duplicates.
- [ ] **Acceptance test:** import the same statement twice; the second commits zero rows. Include a fixture with genuine same-day repeats.
- [ ] **Near-duplicates are flagged for judgment, never auto-dropped.** Same amount and counterparty within a few days, different dedup key: the staged row is flagged and shown beside its suspected twin in the review queue. You accept or skip; nothing is written either way, so declining a duplicate is not a deletion.

### 5.2 Import review queue

Nothing reaches `transactions` until you commit here. This is where categorization happens, while the rows are still recognizable.

- [ ] **Summary header** — row count, date range, total in, total out, exact duplicates skipped, near-duplicates flagged, parse errors. This is where a wrong mapping profile is caught: an inverted sign convention shows as income and expenses swapped, a misread date format as an absurd date range, an off-by-one column as a wrong total.
- [ ] **Rows sorted by counterparty, not date**, so identical merchants cluster and you categorize twelve supermarket rows consecutively.
- [ ] **"Same as previous row" on one keystroke.** With counterparty sorting this handles most of a batch at one key per row.
- [ ] **Type-ahead category picker**, never a nested dropdown.
- [ ] **Per-row skip**, and a per-row parse error so one malformed row never blocks a batch of 400.
- [ ] **Commit is blocked until every row is resolved** — categorized or explicitly skipped. No silent blank-to-uncategorized path.
- [ ] **Unklar as a seeded category** — the honest escape for rows you genuinely cannot identify. It counts as spending, stays visible in the breakdown, and is filterable later, which a wrong-but-plausible guess is not. The commit button shows how much went to Unklar, as friction rather than a silent success. If it grows month over month, see `RISKS.md` R2.
- [ ] **The batch is resumable.** Staged rows are persisted, so closing the tab at row 180 of 400 loses nothing — the batch reappears in the recent-imports list. This is why staging is a table rather than an in-memory array, and it is what makes the initial multi-month backfill survivable.
- [ ] **One SQL transaction on commit** — accepted rows become transactions, staging is cleared, the batch is marked committed. If anything throws, nothing is written and you retry from the queue.
- [ ] **Undo a whole batch** afterwards, from the recent-imports list.

The three ergonomics bullets are not polish. They are what makes cutting the rules engine survivable, and they decide whether a monthly import takes 15 minutes or an hour.

Cut: "accept all" (defeats the point of the gate), CAMT.053, re-parse a batch, full import history, multi-file upload, drag-and-drop.

---

## 6. Monthly overview

The home page.

- [ ] **Month selector** with previous / next.
- [ ] **KPI row** — income, expenses, net, savings rate, each with the delta vs the previous month.
- [ ] **Category breakdown** — table plus horizontal bar chart: amount, % of total spend, vs last month. Parents collapsible to children.
- [ ] **Drill-down** — click a category to see its transactions for that month, as a deep link into the ledger with filters pre-set.
- [ ] **Correct exclusions** — excluded categories, row-level excluded transactions, and `kind = 'transfer'` categories never appear as income or expense. One shared predicate, used by every aggregate.
- [ ] **Data-quality banner** — uncategorized count and amount, plus the Unklar total, with links to fix each. Computed by the same query as the totals. The review queue means imported rows arrive categorized, so this now catches the residue: manual entries left blank, and a growing Unklar pile.

Cut: 12-month trend, top counterparties, cumulative spend curve, vs-6-month-average, month-end projection, custom periods.

---

## 7. Financial health — three metrics

Each shows a value and a one-line definition on hover.

- [ ] **Savings rate** — `(income − expenses) / income`, selected month plus a 3-month average. **Read §3.1: this is wrong in any month containing an unlabelled internal transfer.**
- [ ] **Fixed vs variable split** — from `is_fixed`; a ratio and fixed-cost-as-%-of-income.
- [ ] **Emergency fund runway** — `liquid balances / average monthly essential spend` (from `is_essential`), in months.

Cut: recurring commitment load, category concentration, deviation flags, net cashflow trend, "needs attention" list, income stability, PDF export.

---

## 8. Ledger

Not one of the eight, but the eight are unusable without it. Categorization now happens in the review queue (§5.2); the ledger is where you fix things afterwards — a category you got wrong, a row filed under Unklar and later identified, a transfer leg you forgot to mark.

- [ ] **Table** — date, counterparty, category, account, amount. Paginated.
- [ ] **Filters, in the URL** — date range (this month / last month / YTD), account, category, direction, **uncategorized-only**, counterparty/description substring search.
- [ ] **Sorting server-side**, also in the URL. Client-side sorting over a paginated slice shows you the wrong rows.
- [ ] **Sort by counterparty**, **"same as previous row"** and a **type-ahead picker** — the same three affordances as the review queue, since it is the same work at lower volume. Build them once and share the component.
- [ ] **Filter summary bar** — count, total in, total out, net for the current filter.
- [ ] **Inline category edit** and **inline exclude toggle**.

Cut: FTS5 index, full keyboard navigation, CSV export of the view, saved views, virtualization, amount-range filter.

---

## 9. Non-negotiable technical foundations

- [ ] **`money.ts`** — Money over integer minor units, safe add/subtract, currency guards. Written **first**, with tests, before any schema.
- [ ] **Golden-file report test** — a fixture ledger, an asserted monthly-report JSON output.
- [ ] **Domain unit tests** — dedup keys, the three health metrics.
- [ ] **Idempotent import test** — same file twice, zero new rows, including a same-day-repeats fixture.
- [ ] **Exclusion tests** — a `kind = 'transfer'` category's rows never reach income or expenses; row-level force-include overrides an excluded category; force-exclude overrides an included one.
- [ ] **Undo test** — import a batch, undo it, assert the ledger is identical to before.
- [ ] **Staging isolation test** — stage a batch, assert `transactions` and every report are unchanged, and that an abandoned batch resumes with its categorization intact.
- [ ] **Backups with a tested restore** — `VACUUM INTO` on an OS schedule, plus a script that restores the newest backup and verifies it.
- [ ] **Full export** — transactions as CSV plus a JSON dump of accounts and categories.
- [ ] **Locale-correct formatting** via `Intl` — `1.234,56 €`, `10.08.2026`.
- [ ] **Empty / loading / error states** on the six screens listed in `ARCHITECTURE.md` §6.

---

## 10. Cut from v1 — the backlog, in priority order

The first three are the most likely to come back.

1. **Proper transfer handling** — `transfer_group_id`, two-leg form, pairing suggestions, invariant check. Restores correctness to savings rate. ~3 days, with a one-hour interim step (the net-to-zero banner check) available first.
2. **Learned counterparty→category map** — one table keyed on normalized counterparty, upserted whenever you categorize, applied when staging so review-queue rows arrive pre-filled. About a day, and it turns the review queue from typing into confirming. The cheapest answer to `RISKS.md` R2.
3. **Re-parse a batch** — run a corrected mapping profile back over stored raw rows. The rows are already persisted for exactly this; only the action is missing.

Then, unordered: full rules engine · sign-in and sessions · onboarding · settings screen · dashboard · account detail with balance chart · archive accounts · CAMT.053 · full import history · multi-file upload · splits · tags · notes field · recurring detection and subscriptions · recurring commitment load · foreign currency and FX · attachments · pending-vs-booked · bulk edit · keyboard navigation · FTS5 search · CSV export of a view · saved views · 12-month trend · top counterparties · cumulative spend curve · month-end projection · custom periods · category concentration · deviation flags · net cashflow trend · "needs attention" list · income stability · PDF export · audit log · reset · Sentry.

**Never in scope:** budgets and envelopes · PSD2 bank sync · investments and net worth · debt payoff · multi-user or household · native mobile app · tax exports · goals · every AI feature.

**Promoted *into* v1** from P1, because the eight do not work without them: delete-with-reassignment, merge categories, undo import batch, recent-imports list, `is_essential` flag, row-level exclude toggle.

---

## 11. Definition of done

v1 ships when all of these are true:

1. Your real accounts exist with correct opening balances.
2. At least three months of real statements are imported from every account, via saved mapping profiles.
3. Re-importing any of those files commits zero rows.
4. Every account's computed balance matches the real bank balance on the statement's closing date.
5. Less than 5% of spend sits in Unklar, and the banner tells you the figure.
6. Every internal transfer in those months is categorized as Umbuchung on **both** legs — checked by hand, since nothing checks it for you.
7. The monthly overview's income equals your actual income for that month.
8. Savings rate, fixed/variable and runway all show numbers you can explain.
9. A backup has been restored and verified at least once.
10. You have undone one import batch on purpose, to confirm it works before you need it.

**Then adopt a monthly import cadence and hold to it.** The review queue makes you categorize, but it cannot make you remember: a row you first look at 90 days after it happened goes to Unklar whether or not something prompted you. Cadence is the defence, and it is a habit rather than a feature.
