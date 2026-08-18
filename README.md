# Financial Copilot

A local-first bookkeeping and expense tracker for one person. Imports bank CSV exports, categorizes transactions, and produces a monthly overview plus several financial-health metrics.

---

## What it is

A single Next.js app running on `127.0.0.1`, storing everything in one SQLite file on your own machine. No cloud service, no account, no telemetry, no network exposure. Your financial history never leaves the laptop.

Built for EUR / `de-DE` and the quirks of German bank exports — `;` delimiters, `ISO-8859-1`, `1.234,56`, `DD.MM.YYYY`.

**No AI in v1.** Every categorization is a deterministic human decision. That's a deliberate constraint, not a limitation to work around: it forces the arithmetic to be correct and testable first, which is the part that actually has to be trustworthy.

---

## Scope

Eight features:

1. Accounts with computed balances
2. Transaction CRUD + quick-add
3. CSV import with a saved per-bank mapping profile
4. Deterministic deduplication
5. Import review queue — categorize before anything is committed
6. Categories (two levels, seeded German taxonomy)
7. Monthly overview with category breakdown
8. Savings rate · fixed-vs-variable · emergency-fund runway

Plus a ledger for fixing things after the fact.

Explicitly **not** in v1: rules engine, transfer pairing, recurring detection, multi-currency, sign-in, phone access. [`FEATURES.md`](FEATURES.md) §10 has the full backlog in priority order; [`EFFORT.md`](EFFORT.md) costs each one and says what should trigger building it. A much larger feature list is preserved in [`extendedProject/`](extendedProject/) as a long-term reference.

---

## How data gets in

Two paths, deliberately asymmetric:

- **CSV import** parses into a staging table, and you categorize every row in the review queue before committing. Nothing reaches the ledger unreviewed, a bad mapping profile is caught before the first write, and an interrupted batch resumes where you left it.
- **Manual entry** writes one categorized row directly, so logging a single cash expense is type-and-save with nothing in between.

Manual entries can optionally be routed through the same review queue by setting `MANUAL_ENTRY_REVIEW=true`. Off by default, because a row you typed yourself has no parsing to verify — the switch exists for anyone who wants a second look before their own entries count.

---

## Stack

TypeScript · Next.js 15 (App Router) · SQLite via better-sqlite3 · Drizzle ORM · Tailwind + shadcn/ui · Zod · Vitest + Playwright. Fifteen runtime dependencies, no Docker, no auth library. Rationale and rejected alternatives in [`TECH-STACK.md`](TECH-STACK.md).

---

## Known limitations

Two, both deliberate.

**Internal transfers inflate income.** Moving money between your own accounts — or paying a credit card — counts as income on one side and an expense on the other, so savings rate reads high. This is the one place v1 reports a wrong number by design. Workaround: categorize both legs as `Umbuchung`, a seeded `kind = 'transfer'` category that every report excludes. When both legs arrive in the same import the review queue puts them next to each other, since it sorts by counterparty — but when they land in statements a month apart, nothing connects them. So the real defence is a habit: check income against your salary each month.

**No automatic categorization of any kind** — no rules engine, no learned mapping. Every category is a human decision, taken in the review queue at import time. Not a wrong number, just a recurring cost: budget 10–20 minutes a month. [`EFFORT.md`](EFFORT.md) costs the two ways out of it.

---

## Documents

| File | Contents |
|---|---|
| [`FEATURES.md`](FEATURES.md) | The eight features in detail, and the full backlog |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Data flow, schema, import pipeline, build order |
| [`TECH-STACK.md`](TECH-STACK.md) | Stack choices with costs and rejected alternatives |
| [`RISKS.md`](RISKS.md) | Risk register with early warning signs and mitigations |
| [`EFFORT.md`](EFFORT.md) | Man-hour estimates per feature, and the cost of deferred ones |
| [`extendedProject/`](extendedProject/) | The original full-scope design, archived as a backlog |

Start with `ARCHITECTURE.md` §1 — the diagram there shows the whole dataflow in three stages, and is the map for everything else.

---

## Running it

```bash
pnpm install
pnpm db:migrate
pnpm db:seed          # single user + German category taxonomy
pnpm dev              # → http://127.0.0.1:3000
```

The bind address is the entire security model: the app refuses to start on a non-loopback address unless `ALLOW_PUBLIC_BIND=1` is set deliberately. The SQLite file is not encrypted — use full-disk encryption.

Backups are an OS-level scheduled task calling `pnpm backup`, which snapshots the database with `VACUUM INTO`, rotates old copies, and verifies that the newest one restores. Point it at a directory that syncs off-machine.

---

## Working on the import parser

Keep redacted CSV exports from every bank account in `fixtures/`. Import is roughly half the work in this project and the one part that cannot be built correctly against a file format nobody has opened — every parser change is validated against real files, not against the specification.
