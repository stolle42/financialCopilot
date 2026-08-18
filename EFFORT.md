# Financial Copilot — Effort Estimates

Man-hour estimates for the eight-feature scope in `FEATURES.md`, plus the cost of everything deferred and why it was deferred.

---

## How to read these numbers

**Assumptions.** One developer, comfortable with TypeScript and React, new to none of the libraries but new to *this* schema. Hours are focused working hours — not elapsed evenings. Includes writing the tests named in `ARCHITECTURE.md` §8. Excludes learning a new framework, and excludes the time spent deciding anything (that already happened).

**Ranges are honest, not padded.** The low end is "everything behaves"; the high end is "normal amount of friction". Neither end includes the disaster case.

**Software estimates are systematically low, including these.** The reliable correction is empirical, not arithmetic: build feature 1 (accounts, estimated 6–10h), record what it actually took, and multiply everything below by your own ratio. Do that after the first feature, not at the end.

**One estimate is materially less trustworthy than the rest** — bank-fixture iteration, inside the import block. It is the widest range here and it dominates the total's uncertainty.

---

## The shape of v1

| Area | Hours | Share |
|---|---:|---:|
| Foundation (setup, money, schema, tenancy) | 18 – 29 | 8% |
| Feature 1 — Accounts | 6 – 10 | 3% |
| Feature 2 — Transactions + quick-add | 10 – 15 | 4% |
| Ledger (support; builds the shared categorization component) | 25 – 40 | 11% |
| Feature 6 — Categories | 11 – 17 | 5% |
| **Features 3 + 4 + 5 — CSV import, dedup, review queue** | **97 – 160** | **44%** |
| Feature 7 — Monthly overview | 32 – 46 | 13% |
| Feature 8 — Three health metrics | 7 – 10 | 3% |
| Cross-cutting (export, backups, states, E2E) | 19 – 31 | 9% |
| **Total** | **225 – 358** | |

At 10 focused hours a week that is **5–8 months**. At 20, **3–4 months**.

Two things this table should change about your plan:

**Import is over 40% of the project.** Features 3, 4 and 5 are one piece of work. Everything in `RISKS.md` R5 about downloading real exports before writing parser code is a claim about nearly half your budget.

**The ledger and the review queue are the same UI problem.** Both need counterparty sort, a type-ahead picker and a same-as-previous keystroke. Build that component once at step 6 and reuse it at step 8 — the ledger line above carries its full cost, which is why the review-queue line below is smaller than a screen of that importance would otherwise be.

---

## v1 breakdown

### Foundation — 18–29h

| Task | Hours |
|---|---:|
| Project setup: Next.js, Tailwind, shadcn, ESLint layer rules, Vitest, pnpm | 4 – 6 |
| `domain/money.ts` + tests, written first | 3 – 5 |
| Drizzle schema, migration 0001, 8 tables, indexes, pragmas, FK-off migration wrapper | 7 – 12 |
| Seed script — German taxonomy with `is_fixed` / `is_essential`, Umbuchung, Unklar | 2 – 3 |
| `currentUserId()` + repository tenancy pattern | 2 – 3 |

The ESLint layer rules and the FK-off migration wrapper are the two items people skip. Both are cheap now and expensive later — the first because retrofitting boundaries across 60 files is not a refactor you will do, the second because SQLite's table-rebuild silently drops child rows without it.

### Feature 1 — Accounts — 6–10h

CRUD form, list view, and the computed-balance query. The only subtlety is that the balance is a `SUM` over transactions rather than a column, which is one query, not an architecture.

### Feature 2 — Transactions + quick-add — 10–15h

| Task | Hours |
|---|---:|
| Quick-add form: RHF + zod, counterparty autocomplete, stays-open-after-save | 6 – 9 |
| Edit / delete, sharing the same form | 2 – 3 |
| Three-state exclude toggle + wiring | 2 – 3 |

### Ledger — 25–40h

| Task | Hours |
|---|---:|
| Table + pagination + server-side query | 5 – 8 |
| Filters serialized to URL params (6 filter types incl. date presets) | 6 – 10 |
| Server-side sort in URL, including counterparty sort | 3 – 4 |
| Filter summary bar (count, in, out, net for current filter) | 2 – 3 |
| **Categorization component**: type-ahead picker + same-as-previous keystroke + focus management | 8 – 13 |
| Inline exclude toggle | 1 – 2 |

The categorization component is the one worth protecting. Its full cost sits in this section, and it is **built once here and reused in the review queue** at step 8 — which is why the queue's own line item is smaller than it looks. Those ~8–13h determine whether a monthly import takes 15 minutes or an hour, forever (`RISKS.md` R2).

### Feature 6 — Categories — 11–17h

| Task | Hours |
|---|---:|
| CRUD + two-level tree UI | 5 – 8 |
| Merge two categories | 3 – 5 |
| Delete with reassignment | 3 – 4 |

Merge and delete-with-reassignment were P1 in the original list and were promoted into v1. Together they are ~7h and you will want them in week two, because the seeded taxonomy is a guess about someone else's spending.

### Features 3 + 4 + 5 — CSV import, dedup and the review queue — 97–160h

The monster. Broken down because a single number here is useless.

| Task | Hours |
|---|---:|
| File upload, storage, sha256 | 2 – 3 |
| Sniffing: encoding (`chardet`), delimiter, decimal separator, header offset | 8 – 14 |
| Mapping-profile model, zod config schema, 4 amount modes | 6 – 10 |
| Mapping UI + live 10-row preview | 10 – 16 |
| Parser: Papaparse wiring, per-row error capture, counterparty display normalization, canonical row | 6 – 10 |
| Dedup: key computation, ordinal-within-source, sentinel blacklist, `normalizeDescription`, tests | 8 – 12 |
| Near-duplicate detection + twin lookup | 3 – 5 |
| Staging: write batch + raw rows + staged rows, batch state machine, resume an abandoned batch | 8 – 12 |
| **Review queue screen**: summary header, counterparty-sorted rows, per-row skip, resolve-all gate, Unklar friction | 14 – 22 |
| Commit: one transaction, staging cleared, `ON CONFLICT DO NOTHING` | 5 – 8 |
| Undo batch + recent-imports list (committed and in-review) | 6 – 10 |
| `MANUAL_ENTRY_REVIEW` branch: staged-row producer, pending-entries list, `CHECK` constraint | 5 – 8 |
| Staging-isolation + idempotency + undo tests | 6 – 10 |
| **Iterating against real bank fixtures until they parse** | **10 – 20** |

The review-queue line assumes the categorization component already exists from the ledger. If you build it twice, add another 8–13h and feel appropriately annoyed.

The fixtures row is the least reliable estimate in this document and the most likely to blow up. It is not development work — it is discovering what your banks actually emit, one surprise at a time. Two banks with clean exports is 10 hours. One bank with a `Buchungstext` blob needing field extraction, plus a format that changed mid-year, is 20 and could be 40.

Dedup is only 8–12h but it holds four non-obvious rules (`ARCHITECTURE.md` §4.3), each a silent data-loss bug if guessed. It is the highest correctness-risk-per-hour in the project.

### Feature 7 — Monthly overview — 32–46h

| Task | Hours |
|---|---:|
| `MonthlyFacts` query + the shared exclusion predicate | 8 – 12 |
| Pure report functions + golden-file tests | 5 – 8 |
| KPI row with vs-last-month deltas | 3 – 4 |
| Category breakdown table, parents collapsible to children | 6 – 9 |
| Bar chart (Recharts) | 3 – 4 |
| Month selector | 2 |
| Category drill-down as deep links into the ledger | 2 – 3 |
| Data-quality banner | 3 – 4 |

Larger than it looks because the aggregate query and its correctness tests are the heart of the product.

### Feature 8 — Three health metrics — 7–10h

Cheap, because `MonthlyFacts` already carries every input. Three pure functions with tests (4–6h) plus presentation with hover definitions (3–4h). The lowest cost-to-value ratio in the project — and the reason `MonthlyFacts` is worth designing as a seam.

### Cross-cutting — 19–31h

| Task | Hours |
|---|---:|
| Full export: transactions CSV + accounts/categories JSON | 3 – 4 |
| Backup script, restore verification, OS scheduler entry | 4 – 6 |
| Empty / loading / error states across six screens | 6 – 10 |
| Playwright import test (upload → map → review → commit → verify → undo) | 4 – 8 |
| `pino` logging + bind-address boot assertion | 2 – 3 |

---

## Deferred features — cost and justification

Ordered by likelihood of being built. Full descriptions in `FEATURES.md` §10.

| Feature | Hours | Why it is deferred |
|---|---:|---|
| **Learned counterparty→category map** | 8 – 12 | Not needed until you have felt the chore. One table keyed on normalized counterparty, upserted whenever you categorize, applied at staging so review-queue rows arrive pre-filled — turning the queue from typing into confirming. Removes most of `RISKS.md` R2 for about a day. **Build this the moment the second import feels worse than the first** — the highest-value deferred item by a wide margin. |
| **Transfer model** | 20 – 28 | Cut to reach a working app sooner, accepting that savings rate reads high (`ARCHITECTURE.md` §3.2). The manual Umbuchung workaround is free, and the review queue's counterparty sort puts both legs of a transfer next to each other, which is the easiest place to catch them. A one-hour net-to-zero banner check is available as an interim guard, which is why the full 20–28h can wait. |
| **Re-parse a batch** | 6 – 10 | The raw rows are already stored for exactly this, so only the action is missing. Deferred because it has no value until a parser bug is actually found, and then it is cheap. |
| **Auth (Auth.js or Better Auth)** | 6 – 10 | Buys a lock screen and nothing else while the app is loopback-only, since anyone with filesystem access reads `app.db` directly. Kept cheap by the `user_id` discipline. **Mandatory before any deployment.** |
| **FTS5 search** | 5 – 8 | `LIKE 'x%'` on the indexed counterparty column covers real usage below ~50k rows. Pure optimization with no user-visible feature attached. |
| **Keyboard navigation (j/k/e/c)** | 8 – 12 | The affordances already in the review queue and ledger capture most of the benefit. This is the next increment, not the first one. |
| **Rules engine** | 40 – 60 | Conditions, actions, priority ordering, CRUD UI, create-rule-from-transaction, apply-retroactively. Only worth it if the learned map (8–12h) proves insufficient — and the map handles the top 40 merchants, which is ~90% of volume. Deferring this is the single largest cost saving in the whole re-scope. |
| **CAMT.053 import** | 25 – 40 | Richer and more stable than CSV, but a large ISO 20022 schema with real traps: unsigned `<Amt>` with direction in `CdtDbtInd`, reversals via `RvslInd`, field paths that move between schema versions, and `EndToEndId` nested under `TxDtls`. Every bank offers CSV; not every bank offers this. Wrong thing to build first. |
| **Recurring detection + subscriptions** | 30 – 45 | Statistical grouping, cadence detection, confirm/dismiss, price-change comparison. Deferred because the detector will guess wrong against real data and needs tuning you cannot do before you have real data. Its dependent P0 metric (commitment load) was cut with it. |
| **Splits** | 15 – 22 | Schema, largest-remainder allocation, sum-to-parent validation, and — the expensive part — teaching every aggregate to read splits instead of the parent category. Low frequency, high blast radius. |
| **Tags** | 12 – 18 | Two tables, a picker, a filter. Genuinely useful and genuinely not load-bearing; categories cover the reporting need. |
| **Multi-currency + FX** | 20 – 30 | Second amount column, per-transaction stored rates, a rate table, and re-testing every aggregate. Zero value while all accounts are EUR, and `Money`'s currency guard makes adding it later a compile error rather than a silent wrong balance. |
| **Extra report views** (12-month trend, top counterparties, cumulative curve) | 15 – 25 | All read the existing `MonthlyFacts`, so they are cheap and additive. Deferred because the ledger's filter summary bar already answers most ad-hoc questions, and you should find out which view you actually miss. |
| **Phone access** (promotion to a server) | 14 – 20 | Add auth, VPS, swap the Drizzle driver to `node-postgres`, RLS policies, TLS. Kept at 2 days rather than 2 weeks purely by the `user_id`-everywhere rule (`ARCHITECTURE.md` §2.3). Deferred because it needs auth first and v1 needs to work first. |

**Total deferred: roughly 224–340 hours** — about the same size as v1 itself. Half the original ambition is sitting in that table rather than in your evenings, which is the point of the re-scope, not an accident.

---

## What these numbers are most likely wrong about

**Too low, probably:** bank-fixture iteration (stated 10–20h — a single awkward bank can double it); the mapping UI (10–16h assumes the live preview is straightforward, and preview UIs rarely are); the review-queue screen (14–22h assumes the categorization component is inherited from the ledger and that the batch state machine behaves); empty/loading/error states (6–10h is the classic underestimate — six screens × three states × the ones you forget).

**Too high, possibly:** the health metrics (7–10h — genuinely trivial once `MonthlyFacts` exists); the categories CRUD (5–8h for a two-level tree with shadcn is comfortable).

**Lowest value per hour in v1:** the `MANUAL_ENTRY_REVIEW` branch (5–8h). It is a preference switch that is off by default, on a path — typing a row yourself — with no parsing error to catch. It is cheap because it reuses the queue wholesale, and it is the obvious first cut if the schedule slips. Nothing else in v1 depends on it.

**Not estimated at all:** anything you discover after using it for a month, which `ARCHITECTURE.md` §9 step 12 exists to surface. Budget a further 20–40h for the changes that month will demand, because it will demand some.

---

## What the review queue cost, and bought

It was cut, then restored, so the trade is worth recording rather than re-deriving later.

**Cost: ~30–45h net.** Roughly 35–50h of new work (staging, the review screen, the state machine, its tests), minus the ~5h of summary-confirm screen it replaced.

**Bought, in rough order of value:**

| | |
|---|---|
| Categorization happens while rows are recognizable | A €432 cash withdrawal is identifiable the week it happened, guesswork a month later |
| Nothing unreviewed ever reaches the ledger | A bad mapping profile is caught before the first write, not undone afterwards |
| Reports are never in an unreliable state | The earlier design left the overview wrong between import and cleanup |
| Near-duplicate decisions are non-destructive | Declining one is a decision, not a `DELETE` |
| Work is resumable | Staged rows persist, so a 400-row backfill can span several evenings |

The alternative considered was categorizing in memory at a confirm step (~12–18h): same freshness, no resumability, no protection for a large first import. The extra ~20h buys the resumability, which is what makes the initial multi-month backfill survivable rather than something you abandon halfway.
