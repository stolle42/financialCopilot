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
| Tests | `node:test`, one script per layer · no UI tests ([ADR-012](#adr-012)) |
| Module paths | package.json `imports` (`#domain/*`), not tsconfig `paths` |
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

*Rejected — Supabase.* Hosted Postgres puts the data on a third party's machine, contradicting
[*Local-first*](./vision.md#p-local-first); its auth and row-level security solve a multi-tenancy
problem removed by [*Single user, single machine*](./vision.md#a-single-user); hosted rows are not a
portable file; and self-hosting means ~seven Docker containers, missing both the 10-minute criterion
and the one-command launch. *Local PostgreSQL* fails that same criterion — the user would install and
run a database server.

*Costs accepted:*

- **No decimal type.** Amounts are stored as **integer minor units** and wrapped in a `Money` value
  object in the domain. Floats never touch money.
- `STRICT` tables everywhere, because SQLite's default typing does not enforce columns.
- `PRAGMA foreign_keys = ON` on every connection — off by default.
- **Migrations are ours to own** — no ops team, and the file must never corrupt ([ADR-008](#adr-008)).

<a id="adr-004"></a>
### ADR-004 — `better-sqlite3` with hand-written SQL

**Accepted** · 2026-09-15

Zero abstraction, fewest dependencies, and nothing generated that could drift into `src/domain/` —
the leak that [architecture.md](./architecture.md#layout) names as a symptom worth watching for.
Synchronous API, which is a non-issue with one user and simplifies the code considerably.

*Rejected:* Kysely and Drizzle (inferred types invite use as domain types); Prisma (same, plus an
engine binary complicating the later packaging [features.md](./features.md#out-of-scope) keeps open,
and SQLite is its weakest target).

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

*Rejected — Vercel.* Serverless has no persistent writable filesystem, so the SQLite file cannot live
there. More fundamentally, deploying the ledger would recreate the third row of the
[problem table](./vision.md#2-the-problem) — the app that treats a user's financial history as a
product input. **There is no server-side component of this product.**

<a id="adr-006"></a>
### ADR-006 — `node:test` as the test runner

**Accepted** · 2026-09-15

Node's built-in runner, for unit and integration tests. Zero dependencies, which is the closest fit
to [*KISS*](./vision.md#p-kiss) and [*No lock-in*](./vision.md#p-no-lock-in) available. Coverage comes
from Node's own instrumentation; no third-party tool.

*Rejected:* Vitest (best watch speed, but a second build toolchain beside Next.js); Jest (mature, but
slower, and `next/jest` couples test setup to the framework the domain must not know about).

*Why the usual objection barely applies:* weak mocking costs little here, because
[architecture.md §1](./architecture.md#layers) already puts every outside dependency behind a
**port** — tests substitute hand-written fakes rather than monkey-patching modules, which is the
thing to avoid anyway: it tests *around* a leaked boundary instead of fixing it.

*Costs accepted:*

- **`node:assert` is more verbose than `expect`.** `deepStrictEqual` covers most cases; no assertion
  library is added.
- **No test-project concept.** Per-layer isolation — so a domain test cannot reach
  `src/infrastructure` — is done with separate npm scripts globbing separate directories, not runner
  config.
- **TypeScript support is version-dependent**, which makes the Node version a hard pin ([ADR-011](#adr-011)).
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

*Rejected:* `dependency-cruiser` (clearer messages and free dependency graphs, but CI-only); ESLint
`no-restricted-paths` (no new dependency, but clunkier config and vaguer errors).

*Rejected for now — TypeScript project references.* The only option that fails the *build*, which
architecture.md states as its preference, so this is a real gap. But `next build` type-checks against
the root `tsconfig.json` Next.js manages itself, so composite projects fight the framework and the
guarantee still arrives as a CI step; ADR-006 compounds it, since type-stripped tests are not
type-checked at all. **Revisit if a boundary violation reaches `main`.**

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

*Rejected:* umzug and similar (a dependency for forty lines, built for operator-run CLIs rather than
silent startup migration); Atlas-style declarative diffing (SQLite's weak `ALTER TABLE` forces
auto-generated table rebuilds against irreplaceable data — cleverness
[*Trustworthy before clever*](./vision.md#p-trustworthy-before-clever) sequences last).

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
assumes an official full-ICU Node build, which the pin in [ADR-011](#adr-011) guarantees.

The decoded string is parsed by **`csv-parse`**, chosen for the options that match real bank exports:
`from_line` to skip multi-line preambles, `bom`, and `relax_*` for ragged rows. Its synchronous API
matches the style of ADR-004, and its per-row error codes are what lets the review step in
[features.md](./features.md#transactions) explain *why* a row failed rather than only that it did.

**Encoding is a mapping-profile field**, beside column order, date format and decimal separator. The
assumption [*Bank CSV formats vary unpredictably*](./vision.md#a-csv-formats-vary) applies to encoding
exactly as it does to everything else: chosen once per bank, then remembered, never guessed. Detail
belongs in [csvImport.md](./csvImport.md).

*Rejected:* PapaParse (correct and widely used, but browser-first with coarser errors); hand-rolling
(escaped quotes, quoted delimiters and quoted newlines are easy to get subtly wrong, and the
zero-dependency budget is better spent on mapping and dedup, which no library solves).

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

*Rejected:* `date-fns` at the edges (gains format-string parsing, but the fixed list above removes
that advantage, and it leaves two date vocabularies with drift possible at every crossing).

*Rejected for now — `Temporal`.* `PlainDate` and `PlainYearMonth` are exactly these domain concepts.
Reconsidered 2026-09-15, still declined on cost/benefit rather than purity — recorded so the revisit
need not repeat the work. Native `Temporal` is a builtin and would breach nothing, but is absent from
Node 22 and not Baseline in browsers. `temporal-polyfill` (v1.0.5, MIT, 33 KB gzipped) has a
`./global` entrypoint patching `globalThis` from the composition root, so it would need **no** domain
import and no exception — that is the mechanism to use on revisit. Declined because v1 needs only
month increment, days-in-month, comparison and range containment, all trivial on ISO strings, while
Temporal's strengths (month-end clamping, flexible periods) belong to deferred features that will
likely postdate native support. Deciding cost: the polyfill makes the domain's runtime prerequisite
implicit. **Revisit when Node ships it**, or earlier if a deferred period feature arrives.

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

*Rejected:* Node 22 LTS (works, but maintenance-only with EOL April 2027 — a forced migration during
v1); Node 26 Current (Node's guidance is that production uses LTS, and native-module prebuilds lag
Current); pnpm (strict resolution would usefully block undeclared transitive imports, but that gain
is smaller than the toolchain friction on a solo project); yarn (no advantage here).

*Verified on 2026-09-15, not assumed:* a `.ts` file runs unflagged, `node --test` is present, and
`new TextDecoder('windows-1252')` decodes correctly.

<a id="adr-012"></a>
### ADR-012 — No automated UI tests; thin UI and a manual smoke checklist

**Accepted** · 2026-09-15

No browser-based or component-level test tooling. `node:test` (ADR-006) covers domain, application
and infrastructure; the UI layer is verified by hand.

*Rejected:* Playwright over the import flow (would cover the riskiest feature end-to-end, but adds
browser downloads and a slow second suite); Playwright plus happy-dom component tests (fast feedback,
but React testing libraries expect Jest/Vitest globals, partly reopening ADR-006).

**Two conditions make this defensible, and both are now load-bearing rather than stylistic:**

1. **The UI must contain no logic.** Components are adapters over use cases — nothing else. Any rule
   that creeps into a component becomes untested rule. This was already the intent of
   [architecture.md §1](./architecture.md#layers); it is now the thing standing between the riskiest
   feature and zero coverage.
2. **Import-flow logic belongs in Application, not in React state.** Vendor grouping, unfold
   decisions, duplicate flagging and commit/discard are pure functions over staged rows
   ([architecture.md §4](./architecture.md#import)), so `node:test` can cover all of them. What stays
   untested is then only rendering.

**The manual checks need a written script, or they decay into ad-hoc clicking.** It already exists:
the four measurable criteria in [vision.md §5](./vision.md#5-what-success-looks-like) are an
acceptance test — two of them are stopwatch measurements that can only be taken by hand. Run them
before each release.

*Cost accepted, stated plainly:* the import review screen — vendor grouping with selective
unfolding — is the most intricate UI in the product and sits on the highest-risk feature, with no
regression net. **Revisit trigger:** the second time a bug reaches manual testing in the import flow,
add Playwright for that flow alone.

---

<a id="open-questions"></a>
## 3. Open questions

**None open.** Every question raised so far has been decided.

<a id="risks"></a>
## 4. Integration risk to prove before feature code

One join in this stack is unproven, and both halves were sound in isolation:
**`better-sqlite3` inside Next.js** (ADR-004 × ADR-001). Three known frictions —

- the native module must be declared server-external, or Next attempts to bundle the `.node` binary;
- dev-mode module re-evaluation fights the module-level singleton connection, leaking connections
  across hot reloads;
- `output: 'standalone'` traces dependencies automatically but can miss native binaries — breaking
  precisely the production path ADR-005 depends on.

None is fatal; all are cheaper to discover in a one-hour spike than during feature work.

Separately, and verified on 2026-09-15: **use the package.json `imports` field (`#domain/*`), not
tsconfig `paths` (`@/*`)**. Node does not read `tsconfig.json`, so `@/*` fails under `node --test`
while `#domain/*` resolves natively and TypeScript understands it too. Next.js scaffolds `@/*` by
default, so this is a day-one correction. It also makes a layer crossing visible at the import site,
complementing ADR-007.
