# Financial Copilot — Tech Stack

**Scope:** the eight-feature MVP in `FEATURES.md`
**Companion to:** `ARCHITECTURE.md`
**Extended stack (all P0/P1/P2):** `extendedProject/TECH-STACK.md`
**Date:** 2026-08-14

---

## Summary

| Concern | Choice |
|---|---|
| Runtime | Node.js 22 LTS |
| Language | TypeScript 5.x, `strict` |
| Framework | Next.js 15, App Router |
| Deployment | Local, `next start -H 127.0.0.1` |
| Database | SQLite via `better-sqlite3` |
| Data layer | Drizzle ORM + drizzle-kit |
| Auth | **None in v1** — see `ARCHITECTURE.md` §7 |
| Validation | Zod |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) |
| Charts | Recharts (one chart) |
| Forms | React Hook Form + zod resolver |
| CSV | Papaparse |
| Encoding | `chardet` + `iconv-lite` |
| Dates | `date-fns` |
| Money | Hand-written `domain/money.ts` |
| Hashing | Node `crypto` (built-in) |
| Tests | Vitest + one Playwright test |
| Lint / format | ESLint 9 flat config + Prettier |
| Logging | `pino` to a local file |
| Package manager | pnpm |

**Fifteen runtime dependencies.** Everything the extended design added beyond this — Auth.js, argon2, `fast-xml-parser`, `date-fns-tz`, TanStack Table, TanStack Virtual — is deferred with the feature that needed it.

Dropping the rules engine and transfer handling removed no dependencies — both were plain TypeScript — so this table is unchanged by those cuts. What changed is **where the effort goes**: with nothing proposing a category, the review queue is the app's highest-traffic surface and the ledger is a lower-volume version of the same screen. That raises the bar on §6's UI choices and lowers it almost everywhere else.

---

## 1. Runtime and language

**Node.js 22 LTS.** Not a hard requirement of Next.js 15 (which needs ≥ 18.18), but the version `better-sqlite3` has current prebuilds for, and the one worth standardizing on. Pinned in `.nvmrc` and `package.json#engines` — a Node minor-version mismatch is the most common cause of native-module rebuild failures.

**TypeScript `strict`**, plus:

```jsonc
{
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

`noUncheckedIndexedAccess` is the flag people disable. Keep it: CSV parsing is nothing but indexed access into arrays of unknown width, and this converts a class of runtime crash into a compile error.

---

## 2. Next.js 15, App Router

One process, Server Actions instead of hand-written API routes, Server Components so the report queries run next to the database and ship HTML.

**The caching model is the one real cost, and in a financial app a stale report is a wrong number with a plausible face.** So opt out globally rather than reasoning about it per route:

- `export const dynamic = 'force-dynamic'` on every data-bearing route.
- `revalidatePath` after every mutation, inside the Server Action.
- No `unstable_cache`, no ISR, no `fetch` caching. There is no external API to cache.

You are trading away performance you demonstrably do not need at loopback latency for never debugging a stale aggregate.

Pin exact versions. Next.js minor releases have moved caching semantics before.

---

## 3. SQLite via better-sqlite3

- One file. Backup is `VACUUM INTO`; restore is a file copy.
- No daemon, no port, no Docker, no connection pool.
- **Synchronous, in-process.** No network hop, no async overhead. A 10k-row ledger query is sub-millisecond.
- `:memory:` databases make integration tests as fast as unit tests, which changes how much you actually test.

Costs, and what handles them:

| Cost | Handling |
|---|---|
| **No row-level security** | Tenancy in the repository layer; `user_id` on every table. RLS becomes an *extra* layer if you promote to Postgres, not a replacement |
| No decimal type | A benefit — it forces integer minor units |
| Single writer | Irrelevant at one user. WAL mode; imports in one transaction |
| Weak type affinity (will store `"abc"` in an INTEGER column) | `CHECK` constraints in migrations; zod at every boundary; Drizzle's typed schema |
| No `DATE` type | `TEXT` as `'YYYY-MM-DD'` — sorts and compares correctly, carries no timezone |
| Limited `ALTER TABLE` | drizzle-kit generates the 12-step rebuild. Read it before running it |
| Native module | Prebuilds exist for Node 22 on all platforms; `pnpm rebuild better-sqlite3` after a Node upgrade |

Pragmas:

```sql
PRAGMA journal_mode = WAL;    -- set ONCE, persisted in the DB header
-- per connection, every connection:
PRAGMA foreign_keys = ON;     -- OFF by default in SQLite
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;  -- safe under WAL
```

Two things worth knowing before your first migration:

1. **`foreign_keys` is OFF by default.** Forget the pragma and every FK constraint silently does nothing.
2. **The 12-step `ALTER TABLE` rebuild requires FK enforcement OFF**, or child rows get dropped or repointed. Migrations run inside an explicit `PRAGMA foreign_keys = OFF` … `PRAGMA foreign_key_check` wrapper. These two facts together are why "read the generated migration" is a rule, not advice.

**Rejected:** Postgres in Docker (a daemon, a compose file and a pool in exchange for RLS you do not need yet); PGlite (appealing, Postgres semantics in-process, but younger with a smaller ecosystem — revisit if promotion becomes near-term).

---

## 4. Drizzle ORM

Three reasons specific to this product:

1. **The hard queries are aggregates, not CRUD.** The monthly report and the category breakdown are `GROUP BY` with a couple of window functions. Drizzle's API is SQL-shaped, so they stay readable and you can see exactly what runs. Prisma pushes you to `$queryRaw` for the same work, leaving you with a heavy ORM *and* raw SQL.
2. **Migrations are plain `.sql` files**, committed and reviewable in a diff. On SQLite, where a column change is a table rebuild, reading the migration is not optional.
3. **One schema DSL targets SQLite and Postgres**, which is what makes the promotion path in `ARCHITECTURE.md` §11.4 a two-day job.

Costs: smaller community than Prisma, so unusual problems have fewer answers. No built-in seeding — the taxonomy seed is a hand-written script (~50 lines). Nested relational reads are less ergonomic than Prisma's `include`, irrelevant here.

The dialect swap is mechanical, not free: `sqliteTable` → `pgTable`, integer booleans → real `boolean`, text dates → `date`, and any SQLite-specific fragment needs review.

---

## 5. No auth — what replaces it

There is no auth library in v1. `ARCHITECTURE.md` §7 has the full reasoning; the stack consequences:

- No `next-auth`, no `@node-rs/argon2`, no session table, no login route.
- `currentUserId()` returns the seeded user's id and is the single chokepoint, sitting exactly where `requireUserId()` would.
- **The bind address is the entire security model, so it is asserted, not assumed.** Scripts use the CLI flag — `next start -H 127.0.0.1`, `next dev -H 127.0.0.1` — not the `HOSTNAME` env var, which only the standalone output server honours. The app logs its resolved bind address at boot and refuses to start on a non-loopback address unless `ALLOW_PUBLIC_BIND=1` is set deliberately. Next.js defaults to `0.0.0.0`.
- `app.db` is unencrypted; full-disk encryption is the right layer, and the README says so.

When you add auth later, **Better Auth** is the first thing to evaluate rather than Auth.js v5: self-hostable, passkeys and magic link built in, owns its own schema cleanly, and a more stable API than v5 has had across its betas.

---

## 6. UI

**Tailwind CSS v4 + shadcn/ui.** shadcn copies component source into the repo instead of adding a dependency, which suits this app — the import mapper is not an off-the-shelf component and you will be editing it. Radix underneath handles focus management and keyboard semantics correctly.

**That last point now carries real weight.** With no rules engine, every transaction is categorized by hand in the **review queue**, so that screen absorbs 15–60 minutes a month depending entirely on how well it is built (`RISKS.md` R2). Two shadcn/Radix pieces do most of the work: `Command` for a type-ahead category picker (never a nested `Select`), and correct `onKeyDown` handling for a "same as previous row" keystroke. Radix's focus management is what makes keyboard-only categorization feel fast rather than fought-with.

Build this as **one shared component**, used by the review queue and by the ledger's inline edit. They are the same interaction at different volumes, and the build order puts the ledger (step 6) before import (step 8) so the component exists before the screen that hammers it. If you cut UI corners anywhere, do not cut them here.

**No TanStack Table, no TanStack Virtual.** The v1 ledger is a paginated HTML table with server-side sort and filter. At 50 rows per page below ~50k transactions, virtualization solves a problem that does not exist yet, and a plain table is less code with fewer scroll bugs. Add both when the ledger genuinely feels slow.

**Sorting and filtering are both server-side, both in the URL.** A correctness requirement: if the server returns a paginated slice, client-side sorting reorders that page and confidently shows you the wrong "largest expense". One rule — the server decides which rows and in what order — removes the whole class of bug, and makes every view bookmarkable for free.

**React Hook Form + `@hookform/resolvers/zod`.** The same zod schema validates in the browser and again in the Server Action. One definition, two enforcement points.

**Recharts**, for one chart: the category breakdown bar chart. Kept in a leaf client component so it never enters a server bundle. Not the fastest or prettiest option; at one chart, that does not matter.

**Formatting: `Intl` only.** `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` and `Intl.DateTimeFormat('de-DE')`. No dependency, correct output.

One trap to know before writing a test: the output is `1.234,56` + **U+00A0** (non-breaking space) + `€`, not an ASCII space. An assertion written with a normal space fails and looks like a bug in your money code. Normalize whitespace in test helpers, or assert against `Intl` output rather than a string literal.

---

## 7. CSV parsing

**Papaparse.** Streams, and handles quoted fields containing delimiters and newlines correctly — which hand-rolled splitting does not.

Run it with `header: false` (the default) and map columns **by index** through the mapping profile. German exports frequently have duplicate or blank header cells, which breaks header-keyed parsing outright. This also means you strip the preamble yourself: the profile stores a `skipLines` count, because many exports put account number, date range and blank rows above the real header.

**`chardet` + `iconv-lite`.** Detect bytes → decode to UTF-8 → hand a string to Papaparse. German exports are routinely `ISO-8859-1` or `windows-1252`; decoding as UTF-8 turns `Müller` into `MÃ¼ller` throughout your ledger. Detection is always overridable in the mapping UI.

**No `fast-xml-parser`.** CAMT.053 is deferred, and it is a large ISO 20022 schema with real traps — `<Amt>` is unsigned with direction in `CdtDbtInd`, `EndToEndId` lives under `NtryDtls/TxDtls` rather than on the entry, `RvslInd` reversals invert the sign, and field paths move between schema versions `.001.02` and `.001.08`. Worth doing eventually; not worth doing before CSV works against your real files.

**`date-fns`** (not `date-fns-tz` — no timezone conversion happens anywhere). Booking dates are `'YYYY-MM-DD'` strings, converted to `Date` only for display. Timezone-converting a booking date is a bug: a transaction booked on the 1st must not become the 31st.

**Hashing: Node's built-in `crypto`.** `createHash('sha256')` for dedup keys and file checksums. No dependency.

---

## 8. Testing and tooling

**Vitest**, three projects in one config: `domain` (pure, milliseconds), `integration` (`:memory:` SQLite with migrations applied per suite), `components` (Testing Library, only for the ledger and the import mapper).

**Playwright**, for exactly one test: upload → map → preview → review queue → categorize → commit → assert ledger → undo → assert the ledger is back. E2E tests are expensive to maintain; spend the whole budget on the one path where a regression is both likely and silently destructive. Undo belongs inside the same test rather than being assumed, and the assertion that staging leaves `transactions` untouched is cheaper as a Vitest integration test than as a second E2E run.

**ESLint 9 flat config.** Every "must not" cell in the `ARCHITECTURE.md` §2.1 layer table needs a rule, or the table is decoration:

```js
// domain/ imports nothing
{ files: ['src/domain/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: [
    '@/db/*', '@/services/*', '@/app/*', '@/parsers/*', 'next/*', 'fs', 'node:*' ] }] } }

// services/ may not reach up
{ files: ['src/services/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['@/app/*', 'react', 'next/*'] }] } }

// db/ holds no business logic
{ files: ['src/db/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['@/services/*', '@/app/*'] }] } }

// app/ goes through services/
{ files: ['src/app/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['@/db/*', '@/parsers/*'] }] } }
```

**Prettier**, defaults, no debates. **pnpm**, whose strict `node_modules` prevents accidental reliance on transitive dependencies — worth having with a native module in the tree.

**`pino`** to `~/.financial-copilot/logs/`, pretty-printed in dev. **No Sentry:** you are the only user and you are sitting at the machine; a local log file answers every question it would, without a dependency, a network call, or a question about where your financial stack traces went.

---

## 9. Explicitly not in the stack

| Not using | Why |
|---|---|
| Docker | Nothing to containerize |
| Auth library | Not in scope. `ARCHITECTURE.md` §7 |
| Rules engine | Cut. Manual categorization in the review queue instead — `ARCHITECTURE.md` §11.3, `RISKS.md` R2 |
| Transfer model | Cut. Manual `kind = 'transfer'` categorization — `ARCHITECTURE.md` §3.2, `RISKS.md` R3 |
| Auto-categorization of any kind | Cut with the rules engine. Every category is chosen by a human in the review queue — `RISKS.md` R2 |
| Redis / any cache | Reports are derived on read in milliseconds |
| An **in-app** job queue | Nothing is scheduled in-app. The nightly backup is an **OS-level** task (cron / launchd / Task Scheduler) calling `pnpm backup` |
| tRPC | Server Actions are already typed server calls |
| State manager (Redux, Zustand) | Server state on the server, filter and sort state in the URL, form state in RHF. Almost no client state remains |
| TanStack Table / Virtual | Paginated table is enough at v1 volumes |
| `decimal.js` / `dinero.js` | `domain/money.ts` is ~100 lines, does exactly what is needed, and has no upgrade surface. Money is worth owning outright |
| FTS5 | `LIKE 'x%'` on the indexed `counterparty` column covers v1 search and autocomplete |
| Email, S3, telemetry | Nothing needs them |

---

## 10. Setup

```bash
pnpm install
pnpm db:migrate      # drizzle-kit migrate
pnpm db:seed         # single user + German taxonomy with is_fixed / is_essential,
                     #   including "Umbuchung" with kind = 'transfer'
pnpm dev             # → next dev -H 127.0.0.1 -p 3000
```

Local production:

```bash
pnpm build && pnpm start    # → next start -H 127.0.0.1 -p 3000
pnpm backup                 # VACUUM INTO + rotate + verify restore
```

`.env.local`:

```
DATABASE_PATH=~/.financial-copilot/app.db
BASE_CURRENCY=EUR
LOCALE=de-DE
TZ=Europe/Berlin
MANUAL_ENTRY_REVIEW=false   # true routes quick-add through the review queue
```

There is no settings screen (`FEATURES.md` §1), so this file *is* the settings. A deliberate trade: these are values you set once, and a UI for them would cost more than editing a line and restarting.

Two setup steps that are easy to skip and expensive to skip:

1. **Wire `pnpm backup` into your OS scheduler in week one.** A backup script nobody invokes is not automation, and this file is your financial history.
2. **Verify the bind address once, by hand.** From your phone on the same wifi, try `http://<your-laptop-ip>:3000`. It must fail to connect.

---

## 11. What would need to change later

| Need | Change |
|---|---|
| **Categorizing the same merchants every month grates** (most likely, see `RISKS.md` R2) | One table — normalized counterparty → category — upserted whenever you categorize, applied at staging so review-queue rows arrive pre-filled. No new dependency. ~1 day |
| **Transfers keep distorting income** (likely, see R3) | `transfer_group_id` column, two-leg form, pairing-suggestion query, invariant check. No new dependency. ~3 days. A one-hour interim step is the net-to-zero banner check |
| **AI categorization** | A `proposed_category_id` column on `import_staged_rows` plus an API client — the review queue is already the human check, so nothing else changes |
| Phone access | **Add auth first**, then deploy to a VPS, swap the Drizzle driver to `node-postgres`, add RLS, add TLS. ~2 days |
| A second currency | Add `account_amount_minor` + FX columns, migrate existing rows. `Money`'s guards make missed spots compile errors |
| Recurring / subscriptions | The deferred feature set; needs `recurring_series` tables and a detection module |
| CAMT.053 | `fast-xml-parser`, and real files from your banks to build against |
| Faster ledger past ~50k rows | TanStack Table + Virtual, FTS5 for search |
