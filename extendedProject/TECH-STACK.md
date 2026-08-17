# Financial Copilot — Tech Stack

**Companion to:** `ARCHITECTURE.md`
**Date:** 2026-08-14

> **Archived.** This is the *extended* project stack. The active MVP has been reduced to the
> nine-item subset — see `../TECH-STACK.md`, which drops several entries below.
> Known defects in this document are listed in `README.md` in this folder.

Every choice below is recorded with what it was chosen over and what it costs, so a future reversal is an informed decision rather than a rediscovery.

---

## Summary

| Concern | Choice | Confidence |
|---|---|---|
| Runtime | Node.js 22 LTS | High |
| Language | TypeScript 5.x, `strict` | High |
| Framework | Next.js 15, App Router | High (your call) |
| Deployment | Local web app on `127.0.0.1:3000` | High (your call) |
| Database | SQLite via `better-sqlite3` | Medium — see §3 |
| Data layer | Drizzle ORM + drizzle-kit | High |
| Auth | Auth.js v5 (Credentials provider) | Medium — see §5 |
| Validation | Zod | High |
| UI | Tailwind CSS + shadcn/ui (Radix) | High |
| Table | TanStack Table + TanStack Virtual | High |
| Charts | Recharts | Medium |
| Forms | React Hook Form + zod resolver | High |
| CSV parsing | Papaparse | High |
| XML (CAMT.053) | `fast-xml-parser` | Medium |
| Encoding detection | `chardet` + `iconv-lite` | High |
| Dates | `date-fns` + `date-fns-tz` | High |
| Money | Hand-written `domain/money.ts` | High |
| Hashing | Node `crypto` (built-in) | High |
| Password hashing | `@node-rs/argon2` | High |
| Tests | Vitest + Playwright | High |
| Lint / format | ESLint 9 flat config + Prettier | High |
| Errors / logging | `pino` to a local file; no Sentry | High |
| Package manager | pnpm | High |

---

## 1. Runtime and language

**Node.js 22 LTS.** Required by `better-sqlite3` prebuilds and Next.js 15. Pinned in `.nvmrc` and `package.json#engines` — a Node minor-version mismatch is the most common cause of native-module rebuild failures.

**TypeScript with `strict: true`**, plus:

```jsonc
{
  "noUncheckedIndexedAccess": true,   // catches array access returning undefined
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true
}
```

`noUncheckedIndexedAccess` is the one people turn off. Keep it on: CSV parsing is nothing but indexed access into arrays of unknown width, and this flag turns a class of runtime crash into a compile error.

---

## 2. Framework — Next.js 15 App Router

**Chosen.** One repo, one process, Server Actions instead of hand-written API routes, and Server Components mean the heavy ledger and report queries run next to the database and ship HTML.

**What it costs, honestly:**

- The caching model is the hardest part of modern Next.js. Mitigation: this app is single-user and local, so opt out globally. `export const dynamic = 'force-dynamic'` on every data-bearing route, `revalidatePath` after every mutation, no `unstable_cache`, no ISR. You are giving up performance you do not need in exchange for never debugging a stale report.
- Server Actions blur the domain boundary if you let them. `ARCHITECTURE.md` §2.2 constrains them to four lines each, enforced by the ESLint import rule.
- Version churn. Pin exact versions, upgrade deliberately.

**Rejected:** Vite SPA + Fastify (two deploys and hand-written plumbing for no benefit in a single-user app); TanStack Start (young, fewer answers when stuck); Django/Rails (loses the shared typed domain between the rules engine and the UI, and the interactive ledger needs a JS layer anyway).

---

## 3. Database — SQLite via better-sqlite3

**This is the choice most worth understanding, because your feature list originally assumed Postgres with RLS.**

Why SQLite fits a local single-user bookkeeping app:

- One file. Backup is a file copy; `VACUUM INTO` gives a consistent snapshot without stopping the app.
- No daemon, no port, no Docker, no connection pool. `pnpm dev` and the database is there.
- `better-sqlite3` is **synchronous and in-process** — no network hop, no async overhead. A 10k-row ledger query is sub-millisecond.
- `:memory:` databases make integration tests as fast as unit tests. This meaningfully changes how much you test.

What it costs:

| Cost | Severity | Mitigation |
|---|---|---|
| **No row-level security.** The defence-in-depth layer your feature list wanted is gone | Real but acceptable | Tenancy enforced in the repository layer; `user_id` on every table from migration 0001 (`ARCHITECTURE.md` §1.1). RLS becomes an *additional* layer when you promote to Postgres, not a replacement for anything |
| **No native decimal type** | None — a benefit | Forces integer minor units, which is what you want regardless |
| **Single writer** | None at one user | WAL mode; large imports in one transaction |
| **Weak type affinity** — SQLite will store `"abc"` in an INTEGER column | Moderate | `CHECK` constraints in migrations; zod validation at every boundary; Drizzle's typed schema |
| **No native `DATE`** | Low | Store `TEXT` as `'YYYY-MM-DD'`, which sorts and compares correctly lexicographically. Never store local timestamps for booking dates |
| **`ALTER TABLE` is limited** | Low | drizzle-kit generates the table-rebuild dance. Review generated migrations before running them |
| **Native module** — needs prebuilds or a compiler | Low | Prebuilt binaries exist for Node 22 on all three platforms; `pnpm rebuild better-sqlite3` after a Node upgrade |

**Rejected:** Postgres in Docker (correct if you were deploying to a server today; today it is a daemon, a compose file, and a connection pool in exchange for RLS you do not yet need). PGlite (Postgres semantics in-process, genuinely appealing, but younger and with a smaller ecosystem than better-sqlite3 — revisit if the promotion path to Postgres becomes near-term).

Pragmas:

```sql
PRAGMA journal_mode = WAL;      -- set ONCE; persisted in the DB header
-- per-connection, every connection:
PRAGMA foreign_keys = ON;       -- OFF by default in SQLite
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;    -- safe with WAL
```

`foreign_keys = ON` is not the default. Forgetting it means your FK constraints silently do nothing.

**Migration caveat:** SQLite's 12-step `ALTER TABLE` procedure — which drizzle-kit generates for column changes — requires FK enforcement to be **off** during the rebuild, or child rows get dropped or repointed. Migrations therefore run inside an explicit `PRAGMA foreign_keys = OFF` … `PRAGMA foreign_key_check` wrapper. This is exactly the kind of generated SQL you must read before running.

---

## 4. Data layer — Drizzle ORM

You left this to me. Drizzle, for three reasons specific to this product:

1. **The queries here are aggregates, not CRUD.** Monthly reports, category breakdowns with 6-month averages, balance-over-time series — these are `GROUP BY` with window functions. Drizzle's API is SQL-shaped, so those queries stay readable and you can see exactly what runs. Prisma pushes you to `$queryRaw` for the same work, at which point you have a heavy ORM and raw SQL.
2. **Migrations are plain `.sql` files** generated by drizzle-kit, committed to git, reviewable in a diff. That matters a great deal on SQLite, where a column change becomes a table rebuild you want to read before running.
3. **The same schema DSL targets SQLite and Postgres.** This is what makes the ADR-1 promotion path cheap: the schema definitions, types, and most queries carry over.

Costs: smaller community than Prisma, so unusual problems have fewer StackOverflow answers. Deeply nested relational queries are less ergonomic than Prisma's `include` — not a concern here, where the deep read is one join-and-aggregate. No built-in seeding, so seeds are a hand-written script (~50 lines for the German taxonomy).

**Rejected:** Prisma (best DX overall, but its aggregation escape hatch is the main path for this app, and its generated client adds weight for no gain); Kysely (thinnest and most SQL-honest, but you maintain types against the DB by hand, and Drizzle already gives you SQL-shaped queries *plus* schema-derived types); raw SQL (report queries would be fine; 40 CRUD operations would not).

The dialect-swap caveat: Drizzle makes the promotion mechanical, not free. `sqliteTable` → `pgTable`, `INTEGER` booleans → real `boolean`, `TEXT` dates → `date`, and any SQLite-specific SQL fragment needs review. Budget a day, not an hour.

---

## 5. Auth — Auth.js v5, Credentials provider

**Your call, with one adaptation.** Auth.js v5 (`next-auth@5`) with a Credentials provider over an argon2id-hashed passphrase. JWT session strategy in an httpOnly, `SameSite=Lax` cookie.

Adaptation from the feature list: magic link on `localhost` needs SMTP credentials to email yourself, which is real setup friction and buys nothing when the threat model is "someone with filesystem access to my laptop." The Auth.js provider abstraction means adding `Email` or `Passkey` later is a config change plus a migration.

**Note on the adapter:** with the Credentials provider the JWT strategy is mandatory and the database adapter is not consulted at sign-in, so `auth_sessions`, `auth_verification_tokens` and `auth_accounts` will never hold a row. Only `auth_users` is load-bearing. Create the other three anyway if and when you add an email or passkey provider — creating them in migration 0001 is provisioning for a provider you have explicitly rejected.

Costs, stated plainly: v5's docs and API have been unstable across betas, and the session-to-`user_id` wiring is manual. That wiring is one function (`requireUserId()`), so the blast radius is small.

Password hashing via **`@node-rs/argon2`**, not bcrypt: argon2id is the current recommendation, and the Rust binding avoids the native-build friction of `argon2`'s C bindings.

**Also considered:** Better Auth (arguably a better library — self-hostable, passkeys and magic link built in, owns its schema cleanly — and the one I would revisit if v5 fights you); rolling it yourself (~200 lines, entirely reasonable for one user, but you own security-sensitive code for no gain over a maintained library).

`AUTH_SECRET` lives in `.env.local`, generated at setup, git-ignored. The app refuses to start without it rather than falling back to a default.

---

## 6. UI

**Tailwind CSS v4 + shadcn/ui.** shadcn copies component source into your repo rather than adding a dependency, which suits an app with unusual UI needs — the import mapper and the keyboard-driven inbox are not off-the-shelf components, and you will be editing them. Radix underneath gives correct focus management and keyboard semantics, which the uncategorized inbox depends on.

**TanStack Table + TanStack Virtual** for the ledger. Headless, so it composes with shadcn styling, and virtualization is what makes 10k+ rows scroll at 60fps.

**Sorting and filtering are both server-side, both in the URL.** TanStack owns column visibility and row virtualization only. This is a correctness requirement, not a preference: if the server returns a filtered or paginated slice, client-side sorting reorders that slice and silently shows you the wrong "top 10". One rule — the server decides which rows and in what order — removes the whole class of bug.

**React Hook Form + `@hookform/resolvers/zod`.** The same zod schema validates the form in the browser and the Server Action on the server. One definition, two enforcement points.

**Recharts** for six chart types: category bars, 12-month income/expense, balance-over-time line, cumulative spend curve, savings-rate sparkline, fixed/variable split. Chosen for React-idiomatic composition and adequate docs. It is not the fastest or the prettiest — Visx is more flexible, Chart.js more performant — but at six charts, familiarity beats both. Kept in leaf client components so it never enters a server bundle.

**`lucide-react`** for icons (shadcn's default, already a transitive dep).

**Formatting: `Intl` only.** `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })` is the standard-library answer, with no dependency. Never hand-roll currency formatting; never parse formatted output back into a number.

One trap worth knowing before you write a test: the output is `1.234,56` + **U+00A0** (non-breaking space) + `€`, not an ASCII space. Any assertion written with a normal space will fail and look like a bug in your money code. Normalize whitespace in test helpers, or assert against `Intl` output rather than a literal.

---

## 7. Parsing

**CSV: Papaparse.** Battle-tested, streams, handles quoted fields with embedded delimiters and newlines correctly. Run it with `header: false` (the default) and map columns by index through the mapping profile — German exports frequently have duplicate or blank header cells, which breaks header-keyed parsing. Note that this also means you strip the preamble junk yourself: the mapping profile stores a `skipLines` count, because many exports put account number, date range and blank rows above the real table.

**Encoding: `chardet` + `iconv-lite`.** Detect bytes → decode to UTF-8 → hand a string to Papaparse. German bank exports are routinely `ISO-8859-1` or `windows-1252`; decoding them as UTF-8 turns `Müller` into `MÃ¼ller` throughout your ledger. Detection is always overridable in the mapping UI.

**CAMT.053: `fast-xml-parser`.** Chosen over `xml2js` (unmaintained-ish, slower) and `libxmljs` (native module, XSD validation you do not need). Configured to preserve the `<Ntry>` subtree structure so it can be stored as JSON verbatim in `import_raw_rows`.

Four things to pin down before writing this parser, each of which is a sign or data error if you guess:

- **Which schema version.** German banks commonly ship `camt.053.001.02` (the DK profile). The creditor name is at `RltdPties/Cdtr/Nm` there but moves to `RltdPties/Cdtr/Pty/Nm` in `.001.08` and later. Record the version you target.
- **`EndToEndId`, `MndtId` and `RmtInf/Ustrd` are not entry-level fields** — they live under `NtryDtls/TxDtls/…`. A single `<Ntry>` can contain several `<TxDtls>` (a batched collection), so "one entry = one transaction" is an assumption to verify against your own files, not a given.
- **`<Amt>` is always unsigned.** Direction lives in `CdtDbtInd` (`CRDT`/`DBIT`). Applying the sign convention is your job.
- **`RvslInd` marks a reversal**, which inverts the effective sign. Ignoring it produces wrong-signed transactions — the R1 category of bug.

Realistic caveat: CAMT.053 is a large ISO 20022 schema and German banks populate it inconsistently. Target the ~12 fields you need and treat everything else as opaque JSON. Get real exports from your actual banks before writing this parser; do not build against the specification alone. This is why CSV ships first.

**Dates: `date-fns` + `date-fns-tz`.** Tree-shakeable, immutable, no monkey-patching. Booking dates are `'YYYY-MM-DD'` strings and are never converted to `Date` for storage or comparison — only for display and arithmetic. Timezone conversion of a booking date is a bug: a transaction booked on the 1st must not become the 31st.

**Hashing: Node's built-in `crypto`.** `createHash('sha256')` for dedup keys and file checksums. No dependency needed.

---

## 8. Testing and tooling

**Vitest.** Fast, native ESM and TypeScript, Jest-compatible API. Three projects in one config: `domain` (pure, no setup, milliseconds), `integration` (`:memory:` SQLite with migrations applied per suite), `components` (Testing Library, only for the ledger and inbox interaction).

**Playwright** for exactly one test: the full import flow, upload → map → preview → review → commit → assert ledger. E2E tests are expensive to maintain; spend the budget on the one path where a regression is both likely and silently destructive.

**ESLint 9 flat config**, with the layer boundaries enforced mechanically. Every "must not" cell in the `ARCHITECTURE.md` §2 table needs a rule, or the table is decoration:

```js
// domain/ imports nothing
{ files: ['src/domain/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: [
    '@/db/*', '@/services/*', '@/app/*', '@/parsers/*', 'next/*', 'fs', 'node:*' ] }] } }

// services/ may not reach up into app/
{ files: ['src/services/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['@/app/*', 'react', 'next/*'] }] } }

// db/ may not contain business logic or reach up
{ files: ['src/db/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['@/services/*', '@/app/*'] }] } }

// app/ goes through services/, never straight to the DB or a parser
{ files: ['src/app/**'],
  rules: { 'no-restricted-imports': ['error', { patterns: ['@/db/*', '@/parsers/*'] }] } }
```

An architecture document that is not enforced by a linter is a suggestion.

**Prettier**, default config, no debates.

**pnpm.** Strict node_modules prevents accidental reliance on transitive dependencies — worth having when a native module is in the tree.

**Logging: `pino`** to `~/.financial-copilot/logs/`, pretty-printed in dev.

**No Sentry.** The feature list lists it as P1, correctly for a hosted app. For a local single-user app, sending your own stack traces to a third party adds a dependency, a network call, and a data-egress question to solve a problem you can solve by reading a local log file — you are the only user and you are sitting at the machine. Add it if and when the app is deployed to a server.

---

## 9. Explicitly not in the stack

| Not using | Why |
|---|---|
| Docker | Nothing to containerize; `pnpm dev` is the whole runtime |
| Redis / any cache | Reports are derived on read and take milliseconds |
| An **in-app** job queue (BullMQ, node-cron) | No in-app scheduled work. Recurring detection runs on demand and after import commit. The nightly backup is an **OS-level** scheduled task (cron / launchd / Task Scheduler) calling `pnpm backup` — outside the app, by design |
| tRPC | Server Actions already provide typed server calls; a second RPC layer is redundant |
| A state manager (Redux, Zustand) | Server state lives on the server; filter and sort state live in the URL; form state lives in RHF. There is very little client state left |
| `decimal.js` / `dinero.js` | `domain/money.ts` is ~100 lines, does exactly what this app needs, and has no version-upgrade surface. Money is the one place worth owning outright |
| An email service | No magic link, no notifications |
| S3 / object storage | Attachments are files in `~/.financial-copilot/files/` |
| Sentry, PostHog, any telemetry | Single local user. A log file answers every question these would |

---

## 10. Setup

```bash
pnpm install
pnpm db:migrate          # drizzle-kit migrate
pnpm db:seed             # German category taxonomy with is_fixed / is_essential set
pnpm auth:init           # generate AUTH_SECRET, set the passphrase
pnpm dev                 # http://127.0.0.1:3000
```

Production-local:

```bash
pnpm build && pnpm start   # → next start -H 127.0.0.1 -p 3000
pnpm backup                # VACUUM INTO + rotate + verify restore
```

`.env.local`:

```
AUTH_SECRET=<generated>
DATABASE_PATH=~/.financial-copilot/app.db
BASE_CURRENCY=EUR
LOCALE=de-DE
TZ=Europe/Berlin
```

**The bind address is the entire network security model, so make it explicit.** Next.js binds `0.0.0.0` by default, which exposes your financial data to everyone on the coffee-shop wifi. Use the CLI flag — `next start -H 127.0.0.1` and `next dev -H 127.0.0.1` — in the npm scripts, not the `HOSTNAME` env var (only honoured by the standalone output server). Then assert it at boot: the app logs the resolved bind address on startup and refuses to start if it is not a loopback address unless `ALLOW_PUBLIC_BIND=1` is set deliberately.

**The nightly backup is an OS-level scheduled task**, not an in-app job: a cron entry, launchd plist, or Windows Task Scheduler entry that runs `pnpm backup`. Setting it up is part of first-week setup, since P0 says *automated* backups and a script nobody invokes is not automated.

---

## 11. Where this stack would need to change

Honest boundaries, so a future need is recognized as a stack change rather than a surprise.

| Future need | Stack change required |
|---|---|
| Phone access | Deploy to a VPS; swap Drizzle SQLite driver → `node-postgres`; add RLS policies; add real TLS. ~1 day |
| A second user / household | The above, plus an invitation and permission model. Not a stack change so much as a product one |
| Bank sync (PSD2) | Add a job runner, encrypted token storage, a webhook receiver. Meaningful new surface |
| AI categorization | An API client and a queue for batched calls. Attaches at `import_staged_rows.proposed_category_id` — no other change |
| Data volume beyond ~500k rows | Postgres, and materialized monthly aggregates. Roughly 50 years of personal transactions away |
