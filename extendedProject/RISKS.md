# Financial Copilot — Risks and Blockers

**Companion to:** `ARCHITECTURE.md` and `TECH-STACK.md`
**Date:** 2026-08-14

> **Archived.** This is the *extended* project risk register. The active MVP has been reduced to
> the nine-item subset — see `../RISKS.md`, which drops the risks that only apply to
> cut features (recurring detection, FX, CAMT.053).

Ordered by expected damage, not by category. Each entry has an early warning sign — the thing you can notice before the risk has already cost you — because the risks that hurt in a bookkeeping tool are the quiet ones.

**Severity key:** 🔴 project-threatening · 🟠 weeks of rework · 🟡 days of annoyance

---

## The three that actually matter

If you only mitigate three things, mitigate these.

1. **R1 — Silently wrong numbers.** A financial tool you cannot trust is worthless, and this failure is invisible by construction.
2. **R2 — The import parser is more than half the work and you have not seen your real bank exports yet.**
3. **R3 — Motivation collapse before first real use.** By far the most likely cause of death for a personal project of this size.

---

## R1 · Silently wrong numbers 🔴

**Likelihood: high · Impact: total**

The characteristic failure of this product is not a crash. It is a monthly overview that reads €2,340 when the truth is €2,690, looks entirely plausible, and goes unnoticed for four months. Every source: a transfer leaked into the expense total, an excluded category counted, one leg of a pairing missed, uncategorized rows quietly absent from a breakdown, a split ignored by the aggregate, a rounding error in an allocation.

**Why it is likely:** there is no feedback loop. Wrong output looks exactly like right output. In every other kind of app, bugs announce themselves.

**Early warning signs**

- You find yourself writing `WHERE transfer_group_id IS NULL` in a second query file.
- A total on one screen disagrees with the same total on another, and you fix the screen rather than the query.
- You cannot state, without looking, whether a row-level exclusion overrides its category's flag.

**Mitigations**

- One shared exclusion predicate, defined once (`ARCHITECTURE.md` §7.1), with a test asserting every aggregate query references it. This is the single highest-value test in the codebase.
- Golden-file report tests over a committed fixture ledger. Any change to an aggregate becomes a reviewable JSON diff.
- The data-quality banner is computed by the same query as the totals and renders unconditionally.
- `domain/money.ts` and its tests written **before** anything else.
- The two acceptance tests from the feature list, automated: transfer €1,000 → income and expenses unchanged; import the same file twice → zero new rows.
- **A monthly reconciliation habit:** compare each account's computed balance against the real bank balance on the statement's closing date. Ten seconds per account, catches everything. Consider building this as a small screen — it is not in the feature list and it is arguably the highest-value addition you could make to it.

---

## R2 · Import parsing is harder and larger than it looks 🔴

**Likelihood: very high · Impact: schedule**

Import is items 6 and 7 of the feature list and will be 50–60% of total MVP effort. German bank CSV exports are a genuine minefield:

- `;` delimiters, `ISO-8859-1` / `windows-1252` encodings, `1.234,56` decimals, `DD.MM.YYYY` dates
- Some banks: one signed amount column. Others: separate `Soll`/`Haben`. Others: unsigned amount plus a separate direction indicator.
- Preamble junk above the header (account number, date range, blank rows) before the real table starts
- Duplicate or blank header cells
- Counterparty buried inside a 140-character `Buchungstext` blob that needs regex extraction, with a different layout for SEPA direct debits than for card payments
- Multi-line description fields split across several columns (`VWZ1`…`VWZ14` on some exports)
- Export format changed silently when the bank redesigned its online banking

**Early warning signs**

- You are writing the parser against the CAMT.053 specification rather than against a file from your own bank.
- Your mapping profile config has grown a bank-specific `if` branch.
- You catch yourself editing a CSV by hand "just to get this one import through."

**Mitigations**

- **Download real exports from every account you own, today, before writing any parser code.** Commit them (redacted) as test fixtures. This is the single most effective thing you can do for the schedule.
- Immutable raw-row storage (`ARCHITECTURE.md` §5.2) converts every parser discovery from "re-download two years of statements" into "fix the parser, re-run the batch."
- Mapping profiles with live preview mean unknown formats are configured, not coded.
- A per-row `parse_status` + `parse_error` so one bad row never fails a batch of 400.
- Ship CSV before CAMT.053. CAMT is better data but a much larger schema; do not let it block first real use.
- Timebox the "smart" counterparty extraction. A `contains` rule plus the counterparty-normalization table handles the top 40 merchants in an afternoon and covers ~90% of your real volume. Regex-parsing `Buchungstext` is a rabbit hole with poor returns.

---

## R3 · Motivation collapse before first real use 🔴

**Likelihood: high · Impact: total**

This is the most common way personal projects of this exact size and shape die. The feature list contains 53 `P0` items; a realistic solo estimate for all of them is 200–350 hours. Around hour 80 you are deep in encoding detection, you have entered zero real transactions, you have seen zero real insight about your own money, and the enthusiasm that started the project has nothing to feed on.

**Early warning signs**

- Two weeks in and you have not yet entered a single real transaction of your own.
- You are polishing the category picker's colour palette while the ledger cannot filter by date.
- You are reading about a different framework.

**Mitigations**

- **Follow the build order in `ARCHITECTURE.md` §12, which reaches usable-but-crude at step 5.** Manual quick-add before import. Enter a week of real spending by hand.
- The brutal nine-item subset from feature list §14 is the real milestone. Treat it as the MVP and everything else as post-launch. *(This is the decision that was subsequently taken — see `../FEATURES.md`.)*
- Step 13 — use it on real statements for a month before building anything else — is not optional.
- Cut CAMT.053, splits, tags, bulk edit, recurring detection, and keyboard navigation from v1 without guilt.
- Accept the honest alternative: a well-structured spreadsheet does 70% of this. You are building it because you want to build it and because you want the last 30%. That is a fine reason, but it means "I could have used a spreadsheet" is a known tradeoff accepted early, not a failure discovered late.

---

## R4 · Scope creep from the feature list itself 🟠

**Likelihood: high · Impact: schedule**

`features-verbose.md` is a good document and a dangerous one. It is a comprehensive *wish* list presented with P0/P1/P2 rigour, which makes every item feel decided. Several things marked P0 are not actually needed for first use: CAMT.053 support, the full settings screen, the uncategorized inbox as a separate screen from the ledger.

**Early warning sign:** you are building something you have not yet personally missed.

**Mitigations**

- Freeze v1 as the nine items from §14. Write them on a single page and treat the verbose list as a backlog, not a plan.
- Add a "why I needed this" line to every item you promote out of the backlog. If you cannot write one from your own use, it stays.
- Timebox each of the nine. Overrun triggers a re-scope conversation, not a longer evening.

---

## R5 · Dedup correctness in both directions 🟠

**Likelihood: medium-high · Impact: data integrity**

Two symmetric failures, and the second is much worse than the first:

- **Too loose** → duplicate transactions inflate your expenses. Annoying, visible, fixable.
- **Too strict** → real transactions are silently dropped. Your ledger is quietly incomplete and you have no way to know.

Three specific traps, all addressed in `ARCHITECTURE.md` §5.3:

1. **Genuine same-day repeats.** Two identical €4.50 coffees. Handled by the within-source ordinal — which must be computed from the file, never from the database, or re-importing the same file produces duplicates.
2. **Useless bank references.** `EndToEndId` = `NOTPROVIDED` is common. Trusting it collapses every such row onto one key and drops the rest without a trace.
3. **Normalization drift.** If `normalizeDescription` changes, every dedup key changes, and re-importing an old statement produces a full set of duplicates.

**Early warning signs**

- A row count from an import does not match the row count in the file, and you accept it without checking why.
- You want to "improve" `normalizeDescription` after the first import.

**Mitigations**

- The `UNIQUE (user_id, account_id, dedup_key)` index is the guarantee; application checks are only for showing the user what will happen.
- Unit tests for every input variation, plus the idempotency test in CI — including a fixture file that contains genuine same-day repeats, since that is the case the naive implementation gets wrong.
- **Treat `normalizeDescription` as frozen once real data exists.** If it must change, that is a migration that recomputes every stored key in one transaction.
- Never auto-drop a near-duplicate. Always surface it.
- The monthly balance reconciliation from R1 catches dropped rows, which nothing else will.

---

## R6 · Next.js caching produces stale financial data 🟠

**Likelihood: medium · Impact: trust**

App Router caching is the most-complained-about part of modern Next.js. In a financial app, a cached report is not a performance quirk — it is a wrong number with a plausible face, which is R1 arriving through the back door.

**Early warning sign:** you edit a category and the monthly overview does not change until you hard-refresh.

**Mitigations**

- Opt out globally: `export const dynamic = 'force-dynamic'` on every data-bearing route.
- `revalidatePath` after every mutation, in the Server Action, as a matter of routine.
- No `unstable_cache`, no ISR, no `fetch` caching. There is no external API to cache.
- If a number ever looks stale, hard-refresh and check whether it changes. That reflex distinguishes a cache bug from an arithmetic bug in ten seconds.

---

## R7 · Data loss 🟠

**Likelihood: low · Impact: severe**

One SQLite file, on one disk, containing your entire financial history. Failure modes: disk failure, an unlucky `rm`, a migration that drops a column, `better-sqlite3` failing to rebuild after a Node upgrade, filesystem corruption during an ungraceful shutdown.

The real risk is not the absence of backups. It is **untested** backups — a rotation script that has been dutifully writing corrupt files for three months. Second-order risk: a backup script that exists but was never wired into an OS scheduler, so "automated backups" means "backups I remember to run."

**Early warning signs**

- You have never opened a backup file.
- Your backups directory is on the same disk as the database.
- You ran a generated migration without reading it.

**Mitigations**

- WAL mode; `VACUUM INTO` nightly and before every migration.
- **`scripts/verify-backup.ts` runs as part of the nightly job:** restore to a temp path, `PRAGMA integrity_check`, assert the transaction count matches live. Fail loudly.
- Wire `pnpm backup` into cron / launchd / Task Scheduler in week one. An unscheduled script is not automation.
- Backups land in a synced folder or a `restic` job to object storage. Off-machine is the requirement.
- Read every generated migration before running it. On SQLite, a column change is a table rebuild, and the rebuild needs FK enforcement disabled — which is exactly the kind of thing you want to have seen.
- The full CSV + JSON export is your format-independent escape hatch. Run it monthly and keep the files.
- Do the restore test in week one, not week twenty.

---

## R8 · The category taxonomy is wrong for you 🟡

**Likelihood: high · Impact: rework and friction**

The seeded German taxonomy is a reasonable guess about someone else's spending. Yours differs. You will discover this at transaction 300, and by then you have flags set, rules pointing at category IDs, and three months of reports built on the wrong buckets. Worse: if `is_fixed` or `is_essential` is set wrong at seed time, the fixed-vs-variable split and the runway denominator are quietly meaningless.

**Early warning signs**

- You hesitate over which category a transaction belongs in more than once a week.
- "Sonstiges" is in your top three by amount.

**Mitigations**

- Build "merge two categories" and "delete with reassignment" early. They are marked P1; treat them as P0. You will need them in week two, and they are cheap.
- Never hard-delete a category that has transactions.
- Review `is_fixed`, `is_essential` and `exclude_from_reports` deliberately after the first month of real data.
- Keep the taxonomy shallow. Two levels, and resist the third.

---

## R9 · Transfer pairing is a persistent manual chore 🟡

**Likelihood: high · Impact: ongoing friction**

Both legs of an internal transfer arrive in separate statements, often days apart, with different descriptions. Until they are paired, one shows as income and the other as an expense — which corrupts exactly the numbers the app exists to produce. Credit-card payments make this constant.

Worse in the other direction: because the report predicate excludes *every* row carrying a `transfer_group_id`, a **mis**-paired group silently deletes a real expense from every report.

**Early warning sign:** your monthly income is higher than your salary.

**Mitigations**

- A pairing-suggestion query: opposite signs, equal absolute amounts, different accounts, within ±5 days, neither already paired. Deterministic, no AI, and it will find nearly all of them.
- Rules can `markTransfer` on recognizable descriptors ("Kreditkartenabrechnung"), which pre-flags one leg.
- The transfer-group invariant check (`ARCHITECTURE.md` §4.4) catches malformed groups.
- Surface both unpaired transfer-flagged rows and unbalanced transfer groups in the data-quality banner. Anything that distorts income belongs where you already look.

---

## R10 · Recurring detection produces noise 🟡

**Likelihood: medium-high · Impact: a feature you stop trusting, plus one broken P0 metric**

±10% amount tolerance and cadence windows are heuristics. Real data breaks them: a monthly grocery run looks like a subscription; annual insurance never reaches three occurrences within your history; a subscription that switched billing dates looks like two series; variable utilities drift outside tolerance.

**There is also a dependency problem.** "Recurring commitment load" is a P0 health metric, but it is fed by detection, which is P1. If detection is cut or deferred, a P0 metric has no input.

**Early warning sign:** the recurring list has more entries you ignore than entries you use.

**Mitigations**

- **Make manual declaration the primary path and detection an accelerator.** A user-declared recurring item ("Miete, €1,150, monthly") satisfies the P0 metric with no statistics at all. Detection then only ever proposes candidates for confirmation. This breaks the P0-on-P1 dependency and is why `recurring_series.source` distinguishes `manual` from `detected`.
- Only user-**confirmed** series count toward commitment load.
- Dismissed series stay dismissed — never re-suggest what the user rejected.
- Tune against your own data after a month, not against intuition beforehand.

---

## R11 · SQLite constraints hit sooner than expected 🟡

**Likelihood: low-medium · Impact: a migration you did not plan**

Triggers for regretting SQLite: you want phone access; a second person wants in; you want scheduled bank sync. None are data-volume triggers — 10k rows/year is nothing.

**Early warning signs**

- You want to log a cash expense while standing in a shop, and you can't.
- You are writing SQLite-specific SQL in a report query without noticing.

**Mitigations**

- `user_id` on every table from migration 0001 — including child tables, since RLS policies need a local column on every table they protect.
- Drizzle's shared schema DSL across dialects.
- Keep report SQL portable; flag any SQLite-specific construct with a comment.
- Realistic budget for the swap: **one day**, not one hour.

**Note on the honest probability here:** "I want to log cash spending on my phone" is likely to arrive within the first month, because it is exactly the use case the feature list identifies as mobile-first. Localhost-only may prove more limiting than it currently sounds. That is not a reason to change now — it is a reason to keep the promotion path clean and to expect to use it.

---

## R12 · Auth.js v5 friction 🟡

**Likelihood: medium · Impact: hours**

v5's API and docs have shifted across betas; the Credentials provider is the least-documented path; the Drizzle adapter's table naming needs config to avoid colliding with your own `accounts` table.

**Early warning sign:** you are more than two hours into auth wiring.

**Mitigations**

- Prefix Auth.js tables `auth_*` in the adapter config from migration 0001. Renaming later is painful.
- Create only `auth_users` up front. With the Credentials provider the other three adapter tables never receive a row.
- `requireUserId()` is the only place session shape is read.
- Pin the exact version.
- **Escape hatch:** if it fights you for more than an afternoon, switch to Better Auth or hand-roll a signed-cookie session (~200 lines). Auth is not where the value of this project lives.

---

## R13 · Foreign currency and FX 🟡

**Likelihood: low-medium · Impact: wrong numbers in a corner**

If all your accounts are EUR, this is nearly free. The moment one is not, the questions multiply: which rate, from when, do historic reports change if the rate table is updated, what happens to an account whose currency differs from base.

**Early warning sign:** you consider adding a rate-fetch job.

**Mitigations**

- **Store the rate on the transaction.** Never re-derive a historical rate.
- Store both the base-currency amount (for reports) and the account-currency amount (for balances). Mixing them is a silently wrong balance.
- Manual rate entry with a small lookup table. No scheduled fetch in the MVP.
- `Money` operations throw on currency mismatch, so a missed conversion is a crash rather than a wrong total. Prefer the crash.

---

## R14 · Performance 🟢 (recorded for completeness)

**Likelihood: low · Impact: minor**

10k transactions/year against indexed integer columns in an in-process SQLite database is nothing. The only plausible hot spots are the virtualized ledger at 50k+ rows, `LIKE '%x%'` full-text search (which cannot use an index — hence FTS5), and the 12-month trend if implemented as twelve separate queries.

**Mitigations:** the indexes in `ARCHITECTURE.md` §4.1; FTS5 for search; TanStack Virtual; compute the 12-month trend in one grouped query. Do not optimize anything else until a report actually exceeds 200ms.

---

## Blockers — things that stop work outright

| Blocker | Likelihood | Unblock |
|---|---|---|
| **You do not have real bank exports yet** | Certain, right now | Download CSV (and CAMT.053 if offered) from every account today. This blocks meaningful parser work and it blocks it silently — you can write a lot of plausible parser code against a format you have never seen |
| **A bank offers no usable export** | Low-medium | Check every account before committing to the design. Fallback: manual entry. Worth knowing on day one |
| **`better-sqlite3` fails to build** | Low | Node 22 LTS pinned in `.nvmrc`; prebuilds exist for all major platforms. Fallback: PGlite, or `node:sqlite` — noting the latter is experimental in Node 22, needs `--experimental-sqlite`, and is not a better-sqlite3 drop-in |
| **Undecided sign convention** | Resolved | Expenses negative, enforced in the domain layer. Changing it after real data exists means migrating every row |
| **Row-level vs category-level exclusion** | Resolved | `transactions.is_excluded` is nullable: NULL inherits the category flag, 0 forces inclusion, 1 forces exclusion. The report predicate uses `COALESCE(t.is_excluded, c.exclude_from_reports, 0) = 0` |
| **CAMT.053 schema version** | Open | Determine which version your banks emit before writing the parser; field paths move between `.001.02` and `.001.08` |

---

## What to do this week

1. Download real CSV and CAMT.053 exports from every account you own. Redact and commit as fixtures. *(Unblocks R2.)*
2. Write `domain/money.ts` and its tests. Nothing else. *(R1.)*
3. Write down the sign convention and the exclusion-override rule as a comment at the top of the report query file. *(R1.)*
4. Migration 0001 with `user_id` on every table. *(R11.)*
5. Freeze v1 to the nine items from feature list §14, on one page. *(R3, R4.)*

---

## The uncomfortable summary

**The most likely outcome is not a bug — it is abandonment at 60% complete.** Every mitigation for R3 is more valuable than every mitigation for R6 through R14 combined. Reaching "I entered my own real transactions and saw a real number about my own money" as fast as possible is the primary engineering objective, not a nice side effect of good ordering.

**The second most likely outcome is a working tool with quietly wrong numbers.** The mitigation is unglamorous: one shared exclusion predicate, golden-file tests, and a monthly ten-second reconciliation against your actual bank balance. None of it is interesting to build. All of it is the difference between a tool you trust and a tool you eventually stop opening.
