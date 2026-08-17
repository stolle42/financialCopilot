# Financial Copilot

A local-first bookkeeping and expense tracker for one person. Imports bank CSV exports, categorizes transactions, and produces a monthly overview plus three financial-health metrics.

---

## What it is

A single Next.js app running on `127.0.0.1`, storing everything in one SQLite file on your own machine. No cloud service, no account, no telemetry, no network exposure. Your financial history never leaves the laptop.

Built for EUR / `de-DE` and the quirks of German bank exports — `;` delimiters, `ISO-8859-1`, `1.234,56`, `DD.MM.YYYY`.

**No AI in v1.** Every categorization is a deterministic human decision. That's a deliberate constraint, not a limitation to work around: it forces the arithmetic to be correct and testable first, which is the part that actually has to be trustworthy.

---

## Scope

Seven features, cut down from a much larger list (preserved in [`extendedProject/`](extendedProject/)):

1. Accounts with computed balances
2. Transaction CRUD + quick-add
3. CSV import with a saved per-bank mapping profile
4. Deterministic deduplication
5. Categories (two levels, seeded German taxonomy)
6. Monthly overview with category breakdown
7. Savings rate · fixed-vs-variable · emergency-fund runway

Plus a ledger, which is where all categorization happens.

Explicitly **not** in v1: rules engine, transfer pairing, import review queue, recurring detection, multi-currency, sign-in, phone access. Each is listed in [`FEATURES.md`](FEATURES.md) §10 with what it would cost to add back.

---

## Stack

TypeScript · Next.js 15 (App Router) · SQLite via better-sqlite3 · Drizzle ORM · Tailwind + shadcn/ui · Zod · Vitest + Playwright. Fifteen runtime dependencies, no Docker, no auth library. Rationale and rejected alternatives in [`TECH-STACK.md`](TECH-STACK.md).

---

## Known limitations

Two places where v1 reports wrong numbers by design. Both have free manual workarounds; neither is enforced by the app.

- **Internal transfers inflate income.** Moving money between your own accounts (or paying a credit card) counts as income on one side and expense on the other, so savings rate reads high. Workaround: categorize both legs as `Umbuchung`. Check income against your salary each month — that single glance catches it.
- **Reports are unreliable until cleanup is done.** Imported rows arrive uncategorized and count toward totals while appearing in no category line. Nothing prompts you to fix them except a banner. Workaround: import monthly and categorize in the same sitting.

---

## Documents

| File | Contents |
|---|---|
| [`FEATURES.md`](FEATURES.md) | The seven features in detail, and the full backlog |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Data flow, schema, import pipeline, build order |
| [`TECH-STACK.md`](TECH-STACK.md) | Stack choices with costs and rejected alternatives |
| [`RISKS.md`](RISKS.md) | Risk register with early warning signs and mitigations |
| [`EFFORT.md`](EFFORT.md) | Man-hour estimates per feature, and the cost of deferred ones |
| [`extendedProject/`](extendedProject/) | The original full-scope design, archived as a backlog |

Start with `ARCHITECTURE.md` §1 — the diagram there is the map for everything else.

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

Keep redacted CSV exports from every bank account in `fixtures/`. Import is over half the work in this project and the one part that cannot be built correctly against a file format nobody has opened — every parser change is validated against real files, not against the specification.
