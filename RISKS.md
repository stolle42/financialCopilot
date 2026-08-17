# Financial Copilot — Risks and Blockers

**Scope:** the eight-feature MVP in `FEATURES.md`
**Companion to:** `ARCHITECTURE.md` and `TECH-STACK.md`
**Extended risk register (R1–R14):** `extendedProject/RISKS.md`

Ordered by expected damage. Each risk has an **early warning sign** — the thing you can notice before it has already cost you — because in a bookkeeping tool the risks that hurt are the quiet ones.

**What the scope decisions did to this register.** Dropping the rules engine created R2: every transaction is categorized by hand. Dropping transfer handling created R3, the only accepted inaccuracy left. The import review queue substantially reduces both R2 and R4 — it catches a bad mapping profile before anything is written, and it makes categorization happen while the rows are still recognizable.

---

## The three that decide the outcome

**R1 — silently wrong numbers.** A financial tool you cannot trust is worthless, and the failure is invisible by construction.
**R2 — manual categorization, forever.** Volume, not memory: the review queue fixed the memory half.
**R3 — transfers inflate income, by design.** A limitation to manage, not a bug to prevent.

---

## R1 · Silently wrong numbers 🔴

**Likelihood: high · Impact: total**

The characteristic failure is not a crash. It is a monthly overview that reads €2,340 when the truth is €2,690, looks entirely plausible, and goes unnoticed for four months. Sources live in this scope:

- An unlabelled internal transfer inflating income and expenses (R3, the largest single source).
- A wrong mapping profile committed past the review queue's summary header without being read (R4).
- Rows clicked through into Unklar or a plausible-looking wrong category, which is invisible in a way that a blank is not.
- `is_fixed` or `is_essential` set carelessly at seed time, quietly falsifying two of the three health metrics.
- A row-level exclude toggle set in the wrong direction.

**Why it is likely:** there is no feedback loop. Wrong output looks exactly like right output.

**Early warning signs**

- You write the exclusion predicate — or any part of it — in a second query file.
- A total on one screen disagrees with the same total on another, and you fix the screen.
- You cannot state from memory whether `is_excluded = 0` on a row overrides its category's exclusion flag. *(It does. That is the point of the nullable three-state column.)*
- You cannot explain why runway came out at 8 months.

**Mitigations**

- **One exclusion predicate, in one file, imported by every aggregate**, with a static test asserting no aggregate is written without it. The highest-value test in the codebase.
- Golden-file report tests over committed `MonthlyFacts` fixtures — every aggregate change becomes a reviewable JSON diff.
- `domain/money.ts` and its tests written **before** anything else.
- **The data-quality banner, built properly** (`ARCHITECTURE.md` §5.3). The review queue means it no longer reports hundreds of blanks after every import, so what it now surfaces — a growing Unklar pile — is signal rather than noise. Watch it.
- **A monthly reconciliation habit.** Compare each account's computed balance against the real bank balance on the statement's closing date. Ten seconds per account, and the only thing that catches silently dropped rows.

---

## R2 · Manual categorization is a permanent monthly tax 🔴

**Likelihood: high · Impact: the import becomes a chore you postpone, then skip**

**The cost of cutting the rules engine.** Nothing proposes a category. Every row is categorized by hand, in the review queue, every import, forever — the same forty merchants from scratch each month.

Arithmetic: 100–150 transactions a month at 5–8 seconds a row is **15–20 minutes if the review queue is well built, 45–60 if it is not.** Twelve times a year.

**What the review queue already fixed.** An earlier design imported rows uncategorized and left cleanup to the ledger, which stacked a second failure on top of this one: the information needed to identify a row decays, and the rows you postpone are exactly the uninformative ones — cash withdrawals, transfers to people, generic `KARTENZAHLUNG` descriptors. Deferral was selection-biased toward the rows that rot fastest. Categorizing at import, with commit blocked until every row is resolved, removes that. What remains is volume.

**Why it still matters:** nobody abandons an app because a build took a week longer. People abandon apps when the recurring chore becomes something they postpone, then skip — at which point the ledger is stale and the reports are wrong.

**Early warning signs**

- An unimported statement in your downloads folder for more than a week.
- Unklar climbing month over month — you are clicking through the queue rather than reading it.
- You catch yourself picking the first plausible category to get past a row.
- You start batching imports quarterly "to do them all at once."

**Mitigations**

- **Build the review queue's three affordances properly** (`ARCHITECTURE.md` §4.2): counterparty sort so identical merchants cluster, "same as previous row" on one keystroke, type-ahead picker. Done well these turn most of a batch into one keypress per row. Done badly, this risk fires. Build the same component for the ledger and share it.
- **Import monthly.** 120 rows is a coffee; 400 is a Saturday you will not spend. Cadence also protects the memory that the queue depends on.
- **First real import covers three months, not two years.** Prove the loop is tolerable before committing to a backlog of statements — and note the batch is resumable, so a large one can be split across evenings.
- **Know the exit in advance.** The learned counterparty→category map (`FEATURES.md` §10 item 2) is about a day: one table keyed on normalized counterparty, upserted whenever you categorize, applied at staging so review-queue rows arrive pre-filled. It turns the queue from typing into confirming. If the second import feels worse than the first, build it rather than pushing through a third.

---

## R3 · Internal transfers inflate income and savings rate — accepted, not prevented 🔴

**Likelihood: certain if you own more than one account · Impact: one of the eight features reads wrong**

With no transfer model, moving €1,000 from checking to savings produces a `-1,000` row and a `+1,000` row. The monthly overview counts the first as an expense and the second as income.

| | Effect |
|---|---|
| Account balances | Correct, always |
| Income, expenses, net, savings rate | **Inflated** in any month containing an internal move |
| Credit-card payment | Same problem, every month |
| Savings rate specifically | The most distorted, because both numerator and denominator move |

The workaround (`FEATURES.md` §3.1) is real and free: categorize **both** legs into the seeded Umbuchung category (`kind = 'transfer'`) and the predicate excludes them. But it is unenforced — categorize one leg and forget the other and income is silently wrong, which is exactly what the cut invariant check existed to catch. The review queue helps, since counterparty sorting puts both legs of a transfer near each other in the same batch, but only when both legs arrive in the same import. When they land in different statements a month apart, nothing connects them.

**Early warning signs**

- Your monthly income is higher than your salary. The giveaway, worth checking every month.
- Savings rate above ~60% when it should not be.
- Expenses jumped with no memorable large purchase.

**Mitigations**

- **Check income against your actual salary every month.** One glance, catches nearly every instance. Make it the first thing you look at.
- Umbuchung is seeded at setup, so the workaround exists from row one.
- Categorize both legs in the same sitting — splitting across days is how one gets forgotten.
- **The cheap guard, if this bites twice:** one query summing every `kind = 'transfer'` transaction in the month, flagged in the banner when the total is not roughly zero. About an hour, and it restores most of what the invariant check provided.
- **The real fix is first in the backlog** (`FEATURES.md` §10 item 1). Re-add proper transfer handling on the second miss, not the fifth.

---

## R4 · A bad mapping profile gets past the review queue 🟡

**Likelihood: low-medium on the first import from each bank · Impact: an hour, and a scare**

A mapping profile is you asserting "column 3 is the amount, dates are `DD.MM.YYYY`, negative means expense." Until rows are parsed you cannot know that is right. The realistic mistakes: `DD.MM` read as `MM.DD` (03.07 becomes 7 March), sign convention inverted (every expense becomes income), amount column off by one, wrong decimal separator (everything 100× out), wrong `skipLines` (header row imported as a transaction).

**The review queue is what keeps this at 🟡 rather than 🟠.** Nothing is written until you commit, and the summary header shows the date range and the in/out totals — every mistake above is visible in it. The residual risk is entirely that you *do not read it*, which is a real failure mode for a screen you see monthly and mostly find boring.

**Early warning signs**

- You clicked commit without reading the summary header.
- Your ledger contains a transaction dated in a month you did not import.
- Income for the period looks impossibly high — also R3's warning sign, so check both causes.

**Mitigations**

- **Read the summary header** (`ARCHITECTURE.md` §4.2) before scrolling to the rows. Ten seconds. Build it prominent, at the top, not collapsed.
- **First import from a new bank: use a small file.** One month, not three years. A wrong profile then costs you one review pass, not four thousand rows of judgment.
- **Undo covers what gets through** (`ARCHITECTURE.md` §4.5), reachable from the recent-imports list days later, with a test rather than a hope.
- Verify the first import from each bank by checking that account's balance against the bank immediately, rather than at month end.
- Undo skips rows you have since edited. Since categorization now happens *before* commit rather than after, this matters less than it did — but a later edit still pins a row.

---

## R5 · CSV import is harder and larger than it looks 🟠

**Likelihood: very high · Impact: schedule**

Features 3, 4 and 5 are one piece of work — import, its dedup rule, and its review queue — and they are the clear majority of what remains. German bank CSV is a minefield:

- `;` delimiters, `ISO-8859-1` / `windows-1252`, `1.234,56` decimals, `DD.MM.YYYY` dates
- One signed amount column at some banks, separate `Soll`/`Haben` at others, unsigned amount plus a direction indicator at others again
- Preamble junk above the header — account number, date range, blank rows
- Duplicate or blank header cells
- Counterparty buried in a 140-character `Buchungstext` blob, laid out differently for SEPA direct debits than for card payments
- Description split across numbered columns (`VWZ1`…`VWZ14`)
- The format changing silently when the bank redesigns its online banking

**Early warning signs**

- You are writing parser code against a format you have not opened.
- Your mapping profile config has grown a bank-specific `if` branch.
- You edit a CSV by hand "just to get this one import through."

**Mitigations**

- **Download real exports from every account you own before writing any parser code.** Redact, commit as fixtures. The single most effective thing you can do for the schedule.
- Immutable raw-row storage **preserves** the source so a later parser discovery does not mean re-downloading two years of statements. Be honest about the limit: re-parsing a batch is cut (`FEATURES.md` §10 item 3), so this is insurance rather than a button you can press this month.
- Mapping profiles with live preview mean an unknown format is *configured*, not coded.
- Per-row parse errors counted in the summary, so one malformed row never fails a batch of 400 — and you see the count before committing.
- **Do not chase counterparty extraction.** With rules gone there is no `renameCounterparty`, so the ledger shows near-raw bank descriptors. Ugly and survivable; hand-edit the rows you care about. The cheap normalization pass defined in `ARCHITECTURE.md` §4.1 — trim, collapse whitespace, strip trailing reference digits — is worth it because the review queue clusters by counterparty. Regex-parsing the whole `Buchungstext` is not.

---

## R6 · Dedup correctness, in both directions 🟠

**Likelihood: medium-high · Impact: data integrity**

- **Too loose** → duplicates inflate your expenses. Annoying, visible, fixable.
- **Too strict** → real transactions silently dropped. Your ledger is quietly incomplete and nothing tells you.

Three traps, all in `ARCHITECTURE.md` §4.3, all of which the obvious implementation gets wrong:

1. **Genuine same-day repeats** — two identical €4.50 coffees. Survives only if the ordinal is computed **from the source file**, never from the database. Compute it from the database and re-importing that same file commits duplicates, while still passing a naive idempotency test on any file *without* repeats.
2. **Useless bank references** — `EndToEndId` = `NOTPROVIDED` is common. Trusted blindly, every row after the first collapses onto one key and vanishes with no error.
3. **Normalization drift** — change `normalizeDescription` after real data exists and every stored key changes, so re-importing an old statement produces a full set of duplicates.

Near-duplicates are flagged on the staged row and resolved in the review queue before anything is written, so declining one is a decision rather than a deletion. That is the review queue paying for itself a second time.

**Early warning signs**

- An import's row count does not match the file's, and you accept it without checking.
- You want to "improve" `normalizeDescription` after the first import.
- You skip near-duplicate flags reflexively without looking at the twin.

**Mitigations**

- The `UNIQUE (user_id, account_id, dedup_key)` index is the guarantee; application checks only preview what will happen.
- Unit tests per input variation, plus an idempotency fixture that **contains genuine same-day repeats**.
- Treat `normalizeDescription` as frozen once real data exists. If it must change, that is a migration recomputing every key in one transaction.
- R1's monthly reconciliation is the only thing that catches silently dropped rows.

---

## R7 · Motivation collapse 🟠

**Likelihood: medium · Impact: total**

Cutting from 53 P0 items to eight features is the main mitigation, and it is why this is no longer top-three. But there are two distinct paths to the same outcome: the project dies before launch, or — via R2 — it dies months after launch when the monthly import becomes a chore you postpone. Restoring the review queue improved the second path (categorization now happens once, at import, rather than as an open-ended cleanup task) at the cost of ~35–50h on the first.

**Early warning signs**

- Two weeks in and you have entered no real transaction of your own.
- You are styling the category picker while the ledger cannot filter by date.
- You are reading about a different framework.

**Mitigations**

- **`ARCHITECTURE.md` §9 step 5: enter a week of your own real spending by hand before continuing.** Tedious, and that is the point — you use your own tool on real numbers inside the first fortnight.
- Timebox each of the eight. Overrun triggers a re-scope conversation, not a longer evening.
- Build steps 6 and 7 (ledger, categories) before step 8, as the build order says. The review queue is a category picker over a table; both need to exist and both should share components with it.
- Resist re-adding backlog items before the month of real use — with one exception: if R2 fires, build the learned map immediately. That is not scope creep, it is keeping the project alive.
- The honest alternative, stated once: a spreadsheet with a VLOOKUP against a merchant list does the categorization part *better* than v1 will. You are building this for the other 70%. Worth accepting as a tradeoff early rather than discovering late.

---

## R8 · The category taxonomy is wrong for you 🟡

**Likelihood: high · Impact: rework, friction, two wrong metrics**

The seeded German taxonomy is a guess about someone else's spending. You will find out around transaction 300, by which point three months of reports sit on the wrong buckets.

Two of the three health metrics read category flags, so careless seeding falsifies them quietly. `is_fixed` and `is_essential` are different questions: rent is both, a gym membership is fixed but not essential, groceries are essential but not fixed. And with all categorization manual, a badly shaped taxonomy directly worsens R2 — every ambiguous category is a decision you re-make on every row.

**Early warning signs**

- You hesitate over a category more than once a week.
- Sonstiges or Unklar in your top three by amount.

**Mitigations**

- Merge and delete-with-reassignment are **in v1** for this reason. You will want them in week two.
- Never hard-delete a category that has transactions.
- Set `is_fixed` and `is_essential` deliberately at seed time, then **review both after the first month of real data**.
- Keep it two levels. Every extra level multiplies the per-row decision cost.

---

## R9 · Data loss 🟠

**Likelihood: low · Impact: severe**

One SQLite file, one disk, your entire financial history. Failure modes: disk failure, an unlucky `rm`, a migration that drops a column, corruption on an ungraceful shutdown.

The real risk is **untested** backups — a script dutifully writing corrupt files for three months. Second-order: a backup script never wired into a scheduler.

The interaction with R2 makes this worse than it looks: hand-categorizing every transaction means the database holds many hours of irreplaceable manual work. In a version with rules, re-import would reconstruct most categorizations automatically. Here it would not.

**Early warning signs**

- You have never opened a backup file.
- Your backups directory is on the same disk as the database.
- You ran a generated migration without reading it.

**Mitigations**

- WAL mode; `VACUUM INTO` nightly and before every migration.
- `scripts/verify-backup.ts` in the nightly job: restore to a temp path, `PRAGMA integrity_check`, assert the transaction count matches live. Fail loudly.
- **Wire `pnpm backup` into cron / launchd / Task Scheduler in week one.**
- Backups land in a synced folder or a `restic` job. Off-machine is the requirement.
- **Read every generated migration.** On SQLite a column change is a table rebuild, and the rebuild needs FK enforcement disabled.
- The CSV + JSON export is your format-independent escape hatch. Run it monthly.
- **Do the restore test in week one.**

---

## R10 · No auth is a real exposure 🟡

**Likelihood: low · Impact: severe if it happens**

Dropping auth is defensible for a loopback-only app, but it removes the last defence if the bind address is ever wrong: Next.js defaults to `0.0.0.0`; a `-H` flag dropped in a refactor; a tunnel added for convenience; `ALLOW_PUBLIC_BIND=1` set once and never unset. Any of those publishes your complete financial history to the local network with no password.

**Early warning signs**

- You add `-H 0.0.0.0`, ngrok, Tailscale Funnel, or a reverse proxy "just to check something from my phone."
- The boot log does not show a loopback address and you do not notice.

**Mitigations**

- The boot assertion: the app logs its resolved bind address and refuses to start on a non-loopback address unless the escape hatch is explicit.
- Test it once by hand from your phone on the same wifi. `http://<laptop-ip>:3000` must fail to connect.
- Full-disk encryption, protecting `app.db` at the layer that can.
- **Adding auth is a hard prerequisite for any deployment.** First step, not a recommendation.

---

## R11 · Localhost-only will chafe 🟡

**Likelihood: medium-high · Impact: a change of plan, not a rework**

Logging cash spending happens in a shop, not at a desk, and loopback-only makes that impossible. Expect this to annoy you within a month or two — and note it feeds R2, since cash is exactly the category that decays fastest from memory.

**Early warning sign:** you have a mental list of cash expenses you meant to enter, and it has more than three items.

**Mitigations**

- `user_id` everywhere from migration 0001 — the whole reason it is there.
- The promotion path is ~2 days: add auth, VPS, swap driver to `node-postgres`, RLS, TLS.
- Interim: note cash spending in your phone's notes app and enter it weekly.

---

## R12 · Next.js caching serves a stale report 🟡

**Likelihood: low · Impact: trust**

A cached financial report is a wrong number with a plausible face — R1 through the back door. Low likelihood only because the mitigation is a blanket opt-out.

**Early warning sign:** you categorize a row and the monthly overview does not change until a hard refresh.

**Mitigations:** `export const dynamic = 'force-dynamic'` on every data-bearing route; `revalidatePath` in every mutating Server Action; no `unstable_cache`, no ISR. If a number looks stale, hard-refresh — if it changes it is a cache bug, if not it is arithmetic.

---

## R13 · Performance 🟢

**Likelihood: very low · Impact: minor**

10k transactions/year against indexed integer columns in an in-process SQLite database is nothing. The only plausible v1 hot spot is `LIKE '%x%'` substring search, mitigated by anchoring autocomplete to `LIKE 'x%'` on the indexed `counterparty` column. The partial index on uncategorized rows keeps the cleanup workflow fast regardless of ledger size.

Do not optimize until a query exceeds 200ms.

---

## Blockers

| Blocker | Status | Unblock |
|---|---|---|
| **You have no real bank exports yet** | Live, right now | Download CSV from every account today, redact, commit as fixtures. Blocks meaningful parser work, and blocks it *silently* — you can write a lot of plausible code against a format you have never seen |
| **A bank offers no usable CSV export** | Unknown | Check every account before writing the importer. Fallback is manual entry. Worth knowing on day one |
| **`better-sqlite3` fails to build** | Low | Node 22 LTS pinned in `.nvmrc`; prebuilds exist for all platforms. Fallback: PGlite. (`node:sqlite` is experimental in Node 22 and not a drop-in) |
| **Sign convention** | Resolved | Expenses negative, income positive, enforced in the domain layer |
| **Row-level vs category-level exclusion** | Resolved | `is_excluded` nullable: NULL inherits, 0 forces inclusion, 1 forces exclusion. Written by the three-state toggle on the edit form and in the ledger |
| **`is_fixed` vs `is_essential`** | Resolved | Two separate flags. Using one as a proxy makes runway wrong |
| **Transfers** | Resolved, with a known cost | Not modelled. Manual `kind = 'transfer'` categorization on both legs. R3 |
| **Where categorization happens** | Resolved | In the review queue, at import, with commit blocked until every row is resolved. The ledger is for fixing things afterwards. Manual entry is categorized in the quick-add form and is never staged |
| **Rows you cannot identify** | Resolved | Seeded `Unklar` category — an honest expense line rather than a guess. The commit button shows the Unklar total as friction. A growing pile is the R2 warning sign |

---

## What to do this week

1. **Download real CSV exports from every account you own.** Redact, commit as fixtures. *(R5, the only live blocker.)*
2. Write `domain/money.ts` and its tests. Nothing else. *(R1.)*
3. Write the sign convention and the exclusion-override rule as a comment at the top of the report query file, before writing the query. *(R1.)*
4. Migration 0001, all eight tables, `user_id` on every one, Umbuchung and Unklar seeded. *(R3, R11.)*
5. Wire `pnpm backup` into your OS scheduler and restore a backup once. *(R9.)*

---

## The uncomfortable summary

Three things are true.

**Import is the clear majority of the project, and you are designing it against files you have not opened.** Features 3, 4 and 5 are one piece of work and roughly half the budget. Nothing else has a better return than downloading those exports today.

**The main remaining risk is running cost, not build cost.** Cutting the rules engine means no rule ever proposes a category — every row of every import is a human decision, twelve times a year, forever. The review queue makes those decisions happen at the right moment and makes them resumable, which is most of the problem solved; what it cannot do is make them fewer. The three affordances in `ARCHITECTURE.md` §4.2 are therefore not polish, they are the feature, and the learned counterparty→category map is a day's work away when the queue starts feeling like typing rather than confirming.

**One of the eight features reports wrong numbers under conditions that will occur.** Savings rate is inflated in any month containing an unlabelled internal transfer. The workaround is free and unenforced, so the defence is a habit: both legs go to Umbuchung — they sit next to each other in the review queue, sorted by counterparty, which is the easiest place to catch them — and you check income against your salary before believing anything else on the screen.
