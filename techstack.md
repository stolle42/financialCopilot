# Tech stack

> **Status:** Draft · **Owner:** simon · **Last updated:** 2026-09-15
>
> This document decides *which technologies are used, and which were rejected*. It is a decision log:
> one record per decision, appended as decisions are made, never rewritten silently.
> Document roles and precedence: [README.md](./README.md).
>
> **This document may not force a change in vision, features, or architecture.** Where a technology
> collided with a principle, the technology was rejected — see ADR-003 and ADR-005.

Every dependency below is open source, as required by [*No lock-in*](./vision.md#p-no-lock-in).

---

## 1. Summary

| Concern | Choice |
| --- | --- |
| Runtime | Node 24 LTS, official full-ICU build · npm |
| Language | TypeScript, `strict` |
| UI + server | Next.js (App Router, Node runtime only) |
| Styling / components | Tailwind + shadcn/ui |
| Charts | Recharts |
| Store | SQLite — one file on the user's machine |
| DB access | `better-sqlite3` + hand-written SQL |
| Tests | `node:test`, one script per layer |
| Layer enforcement | `eslint-plugin-boundaries` |
| Migrations | Numbered files on `PRAGMA user_version`, backup first |
| CSV | `csv-parse`, decoded via built-in `TextDecoder` |
| Dates | `YYYY-MM-DD` value objects, no library |
| Distribution | `next build` + `next start`, run locally. No hosting. |

---

## 2. Decision records

<a id="adr-001"></a>
### ADR-001 — Next.js for both UI and server

**Accepted** · 2026-09-15

One process serves the UI and reaches the database, started with one command — which is exactly the
shape [*The user can run a local application*](./vision.md#a-local-application) asks for. No separate
API server to keep alive, matching [*KISS*](./vision.md#p-kiss).

*Rejected:* Vite + React SPA with a thin Node server — simpler mental model and faster tests, but two
processes to start and packaging built by hand.

*Costs accepted, and their mitigations:*

- **Next.js has no composition root.** The framework instantiates route handlers itself, so the
  startup injection required by [architecture.md §1](./architecture.md#layers) has nowhere natural to
  live. One deliberate module-level container owns the DB path, port, and clock; route files receive
  them and construct nothing.
- **Folder collision.** Next.js wants `src/app/`; the layer tree wants `src/application/`. Next.js
  routing therefore lives in **`app/` at the repository root**, holding thin route files only, leaving
  `src/domain|application|infrastructure|ui` as the pure layer tree of
  [architecture.md](./architecture.md#layout).
- **CLI telemetry is on by default.** Disabled via `NEXT_TELEMETRY_DISABLED=1`, committed to the repo.
  Required by the no-telemetry rule in [features.md](./features.md#out-of-scope), which admits no
  exceptions even for build-time developer data.
- **Edge runtime is forbidden.** It has no filesystem, so it cannot reach the database. Node runtime
  is pinned everywhere.
- Fonts and all other assets are self-hosted — no runtime CDN call, per
  [*Local-first*](./vision.md#p-local-first).

<a id="adr-002"></a>
### ADR-002 — Tailwind + shadcn/ui, charts via Recharts

**Accepted** · 2026-09-15

shadcn/ui components are copied into the repository rather than installed, so it is the rare
dependency that *reduces* lock-in. Tailwind is mandatory with it. Its chart component wraps Recharts,
which is the charting decision by consequence — and charting is core, not decoration, under
[*The answer is a picture*](./vision.md#p-answer-is-a-picture).

Copied components are UI-layer files and obey the import rules like any other.

<a id="adr-003"></a>
### ADR-003 — SQLite, one file on the user's machine

**Accepted** · 2026-09-15

A single file, no server, no network, zero install, and fast enough for the thousands of transactions
assumed by [*Historical data starts where the user starts*](./vision.md#a-history-starts-where-user-starts).
It is *literally* the "plain, portable file" promised by [*No lock-in*](./vision.md#p-no-lock-in), and
it supports the check constraint that
[architecture.md §2](./architecture.md#domain-model) needs for "exactly one category column, matching
`kind`".

*Rejected — Supabase*, on four counts:

1. Hosted Postgres by default puts the data on a third party's machine, contradicting
   [*Local-first*](./vision.md#p-local-first), where the local DB is the **sole** source of truth.
2. Auth and row-level security solve multi-tenancy — a problem removed by
   [*Single user, single machine, no sync*](./vision.md#a-single-user).
3. Rows in a hosted database are not a portable file.
4. Self-hosting it means roughly seven Docker containers, missing the *under 10 minutes to first
   chart* criterion and the one-command launch of ADR-001.

*Rejected — local PostgreSQL:* also fails the 10-minute criterion; the user would install and run a
database server.

*Costs accepted:*

- **No decimal type.** Amounts are stored as **integer minor units** and wrapped in a `Money` value
  object in the domain. Floats never touch money.
- `STRICT` tables everywhere, because SQLite's default typing does not enforce columns.
- `PRAGMA foreign_keys = ON` on every connection — off by default.
- **Migrations are ours to own.** No ops team exists, so the app migrates the user's file at startup
  and must never corrupt it. Approach still open — see §3.

<a id="adr-004"></a>
### ADR-004 — `better-sqlite3` with hand-written SQL

**Accepted** · 2026-09-15

Zero abstraction, fewest dependencies, and nothing generated that could drift into `src/domain/` —
the leak that [architecture.md](./architecture.md#layout) names as a symptom worth watching for.
Synchronous API, which is a non-issue with one user and simplifies the code considerably.

*Rejected:* Kysely and Drizzle (type-safe, but their inferred types invite use as domain types);
Prisma (generated models become de facto domain types, its engine binary complicates the later
packaging that [features.md](./features.md#out-of-scope) keeps open, and SQLite is its weakest
target).

*Costs accepted:*

- **No type safety on query results.** Each repository owns one explicit row→entity mapping function,
  covered by tests. This is the whole price of the decision and it is paid in one place per table.
- **Native module.** Needs a prebuilt binary per platform and Node ABI, which is real friction for the
  Docker and desktop packaging held open in [features.md](./features.md#out-of-scope).
- Must be declared a server-external package in `next.config` so Next.js does not attempt to bundle
  the native binary.

<a id="adr-005"></a>
### ADR-005 — No hosting; the app is run, not deployed

**Accepted** · 2026-09-15

v1 is `next build` + `next start` with Next.js standalone output, so it runs with no network at all.
Docker and desktop packaging are later delivery options, not v1.

*Rejected — Vercel*, on two counts. Practically, serverless has no persistent writable filesystem, so
the SQLite file of ADR-003 cannot live there. More fundamentally, deploying the ledger anywhere would
recreate the third row of the [problem table](./vision.md#2-the-problem) — the commercial app that
treats a user's financial history as a product input. **There is no server-side component of this
product.**

<a id="adr-006"></a>
### ADR-006 — `node:test` as the test runner

**Accepted** · 2026-09-15

Node's built-in runner, for unit and integration tests. Zero dependencies, which is the closest fit
to [*KISS*](./vision.md#p-kiss) and [*No lock-in*](./vision.md#p-no-lock-in) available. Coverage comes
from Node's own instrumentation; no third-party tool.

*Rejected:* Vitest (best watch-mode speed, but a second build toolchain beside Next.js and path
aliases declared twice); Jest (most mature, but slower feedback and `next/jest` couples test setup to
the framework the domain layer must not know about).

*Why the usual objection barely applies here:* `node:test`'s weak mocking costs little in this
codebase, because [architecture.md §1](./architecture.md#layers) already requires every outside
dependency to sit behind a **port**. Tests substitute hand-written in-memory fakes of those
interfaces — they never need to monkey-patch a module. Module-level mocking is in fact the thing to
avoid: it is how a leaked boundary gets tested *around* instead of fixed.

*Costs accepted:*

- **`node:assert` is more verbose than `expect`.** `deepStrictEqual` covers most cases; no assertion
  library is added.
- **No test-project concept.** Per-layer isolation — so a domain test cannot reach
  `src/infrastructure` — is done with separate npm scripts globbing separate directories, not runner
  config.
- **TypeScript support is version-dependent**, which promotes the Node version from housekeeping to a
  hard pin — see [§3](#open-questions).
- Sparser examples than either alternative; more of the setup is ours.

<a id="adr-007"></a>
### ADR-007 — `eslint-plugin-boundaries` enforces the layer rule

**Accepted** · 2026-09-15

The import check that [architecture.md §1](./architecture.md#layout) requires. Layer membership is
already folder location, which is exactly the input this plugin takes, so the rule stays one sentence
in one config file. ESLint is present in a Next.js project regardless, so this adds a plugin rather
than a toolchain. It runs in CI as part of the normal lint step.

Chosen over stricter options because a forbidden import raises an **editor error as it is typed** —
the boundary gets fixed while the design is still in the developer's head, rather than after code has
been built on top of it.

*Rejected:* `dependency-cruiser` (clearer messages and free dependency graphs, but CI-only, so no
feedback while typing); ESLint `no-restricted-paths` (no new dependency, but clunkier config per layer
and vaguer errors).

*Rejected for now — TypeScript project references.* The one option that makes a violation fail the
*build*, which architecture.md states as its preference, so this is a real gap. It was rejected
because `next build` type-checks against the single root `tsconfig.json` that Next.js manages itself
rather than running `tsc -b`, so composite projects fight the framework and the guarantee still
arrives as a separate CI step. ADR-006 compounds it: type-stripped tests are not type-checked at all.
Revisit if a boundary violation ever reaches `main`.

*Costs accepted:*

- **The rule is silenceable** with an inline ESLint disable comment. Accepted deliberately: an
  intentional, visible, reviewable escape hatch is preferable to one invented under deadline. A
  disable comment on a boundary rule is a review blocker.
- Only statically resolvable imports are seen; a dynamic `require` slips through.
- Element-type configuration takes a pass or two to get right.

<a id="adr-008"></a>
### ADR-008 — Hand-rolled migrations on `PRAGMA user_version`, with a pre-migration backup

**Accepted** · 2026-09-15

Numbered migration files, applied at startup: read `PRAGMA user_version`, apply everything numbered
higher inside a transaction, bump the version. SQLite supports transactional DDL, so a failed
migration leaves no partial schema. The version lives in the file header, so there is no metadata
table to bootstrap.

Roughly forty lines, fully owned — worth more than a library when a migration goes wrong two years
from now. `.sql` files by default, with a TypeScript migration permitted where a change needs logic
rather than statements; the split of one category table into two, decided during planning, is exactly
that case.

**The file is copied to a single rolling `.backup` before any migration runs**, overwritten on each
subsequent migration. This matters more than the choice of runner: there is no ops team, no staging
copy, and the user has no backup of their own. Transactional DDL protects against a migration that
*fails*; nothing else protects against one that *succeeds and is wrong*, which is the likelier
failure. Bounded disk use, one obvious file to restore from.

*Rejected:* a migration library such as umzug (a dependency for forty lines, built for operator-run
CLIs against managed databases rather than silent startup migration of a user's file, and needing a
`better-sqlite3` storage adapter regardless); declarative diffing such as Atlas (SQLite's limited
`ALTER TABLE` means auto-generated create-copy-drop-rename rebuilds against irreplaceable data —
cleverness that [*Trustworthy before clever*](./vision.md#p-trustworthy-before-clever) sequences last
— plus a Go binary to ship).

*Costs accepted:*

- **Downgrade must fail loudly.** A `user_version` *higher* than the build understands means the user
  ran a newer version before. The app refuses to start and says so. It never operates on a schema it
  does not know — that is how data gets corrupted silently.
- **No checksums on applied migrations**, so editing an already-shipped migration diverges between
  machines without warning. *A shipped migration is immutable* — a discipline rule, not an enforced
  one.
- No down migrations unless written by hand. None are planned.
- Partial-failure and ordering edge cases are ours to test.

<a id="adr-009"></a>
### ADR-009 — `csv-parse` for parsing, `TextDecoder` for encoding

**Accepted** · 2026-09-15

**Decoding and parsing are two steps.** Bytes are decoded to a string with Node's built-in
`TextDecoder`, which covers `windows-1252`, the ISO-8859 family and UTF-16LE, and strips BOMs by
default. No dependency is needed for this — `iconv-lite` was considered and is unnecessary. This
assumes an official full-ICU Node build, which the pin in [§3](#open-questions) must guarantee.

The decoded string is parsed by **`csv-parse`**, chosen for the options that match real bank exports:
`from_line` to skip multi-line preambles, `bom`, and `relax_*` for ragged rows. Its synchronous API
matches the style of ADR-004, and its per-row error codes are what lets the review step in
[features.md](./features.md#transactions) explain *why* a row failed rather than only that it did.

**Encoding is a mapping-profile field**, beside column order, date format and decimal separator. The
assumption [*Bank CSV formats vary unpredictably*](./vision.md#a-csv-formats-vary) applies to encoding
exactly as it does to everything else: chosen once per bank, then remembered, never guessed. Detail
belongs in [csvImport.md](./csvImport.md).

*Rejected:* PapaParse (most widely used and correct, but browser-first, coarser error reporting, and
types from DefinitelyTyped rather than the package); hand-rolling (zero dependencies, but escaped
quotes, quoted delimiters and quoted newlines are easy to get subtly wrong — and the
zero-dependency budget is better spent where the actual risk is, in mapping and duplicate detection,
which no library solves).

*Costs accepted:*

- Large API surface to learn.
- **No delimiter sniffing.** A brand-new profile cannot guess `;` from `,` — the one real advantage
  PapaParse had. Mitigated, if wanted, by counting candidates in the header line.

<a id="adr-010"></a>
### ADR-010 — Dates as ISO strings, no date library

**Accepted** · 2026-09-15

A date in this product is a **calendar date with no time and no timezone**: a transaction happened on
the 15th in every timezone. Storing a timestamp instead produces the off-by-one-day bug where
`2026-03-15` displays as the 14th.

Forced by [architecture.md](./architecture.md#layout), which forbids `src/domain/` from importing any
third-party library. A transaction's date is a domain concept, so no date library can serve it.

- **Domain:** a `LocalDate` value object over `YYYY-MM-DD`, plus `YearMonth` for budget periods —
  consistent with the `Money` object of ADR-003, and the seam that keeps monthly as *one* period rule
  rather than the only one ([features.md](./features.md#budgets)).
- **Storage:** SQLite TEXT. `YYYY-MM-DD` sorts lexicographically *and* chronologically, so ordering
  is free and `BETWEEN` answers period queries. It also stays readable when the user opens the file in
  another tool — a small [*No lock-in*](./vision.md#p-no-lock-in) win.
- **Display:** the built-in `Intl.DateTimeFormat`.
- **Bank date formats:** a **fixed list** offered in the mapping profile (`dd.MM.yyyy`, `dd/MM/yyyy`,
  `MM/dd/yyyy`, …), each a small parser — not a free-form format string. A dropdown is also better UX
  than a format field. Detail belongs in [csvImport.md](./csvImport.md).

*Rejected:* `date-fns` at the edges (gains arbitrary format-string parsing, but that advantage
disappears against the fixed list above, and it leaves two date vocabularies — ISO strings inside,
`Date` timestamps outside — with drift possible at every crossing).

*Rejected for now — `Temporal`.* `Temporal.PlainDate` is exactly this domain concept, and as a
language builtin would not even breach domain purity. Verified unavailable on 2026-09-15: absent from
Node 22, and MDN still lists it as *Limited availability, not Baseline* in browsers. Using it today
means `temporal-polyfill` — a third-party dependency in the one layer that forbids them. **Revisit
when Node ships it**; a `LocalDate` value object is a far easier thing to reimplement on top of
`Temporal` than `Date` objects scattered through the UI would be.

*Costs accepted:*

- **Month arithmetic is ours** — start of month, add a month, days in month, iterate a range. Roughly
  fifty lines, needing deliberate tests around leap years and month lengths.
- Each supported bank date format is a small parser to write and test; an unlisted format needs a code
  change rather than user configuration.

<a id="adr-011"></a>
### ADR-011 — Node 24 LTS (official build), npm

**Accepted** · 2026-09-15

**Node 24 "Krypton", the latest LTS** as of this date, supported to roughly April 2028. Even-numbered,
so the `better-sqlite3` prebuilds that ADR-004 depends on are reliably published. Native TypeScript
stripping is mature, which ADR-006 needs.

**The pin must specify an official full-ICU build.** A small-ICU or some distribution builds would
break the `TextDecoder` legacy-encoding decoding in ADR-009 — the CSV importer would silently mangle
every umlaut. Pinned in two places, `engines` and `.nvmrc`, so CI and developers cannot disagree.

**npm**, because every other decision in this document favours fewer moving parts, and it needs no
installation.

*Rejected:* Node 22 LTS (verified working for `node:test`, `TextDecoder` and native TypeScript, but
maintenance-only with EOL in April 2027 — a forced migration during v1's life); Node 26 Current
(Node's own guidance is that production uses LTS, and native-module prebuilds lag Current releases —
the wrong risk to take with a native SQLite driver); pnpm (its strict resolution would usefully block
undeclared transitive imports, a dependency-level echo of ADR-007, but that gain is smaller than the
added toolchain friction on a single-developer project); yarn (no advantage here).

*Verified on 2026-09-15, not assumed:* a `.ts` file runs unflagged, `node --test` is present, and
`new TextDecoder('windows-1252')` decodes correctly.

---

<a id="open-questions"></a>
## 3. Open questions

**None open.** Every question raised so far has been decided.
