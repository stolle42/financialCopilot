# Tech stack

> **Status:** Draft · **Owner:** simon · **Last updated:** 2026-09-10
>
> This document decides *which technologies build the product*, and which were rejected.
> It may not force a change in the documents above it — precedence: [README.md](./README.md).

---

<a id="stack"></a>
## 1. Decisions

**Three dependencies for the whole application.** Everything else ships with Node.

| Concern | Choice | Why | Cost |
| --- | --- | --- | --- |
| Language + runtime | TypeScript on Node 24 LTS | The browser forces JavaScript in anyway ([*the answer is a picture*](./vision.md#p-answer-is-a-picture) needs charts); one language beats two. Runs `.ts` with no build step | — |
| Database | SQLite via `node:sqlite` | A single portable file, no server — the only store consistent with [*Local-first*](./vision.md#p-local-first) and [*No lock-in*](./vision.md#p-no-lock-in). Enforces the `CHECK` constraint and foreign keys from [architecture.md](./architecture.md#domain-model) | built in |
| Database access | Hand-written SQL in repositories | An ORM's core feature — entity classes it owns — is what [invariant 7](./architecture.md#invariants) forbids, so mappers are hand-written either way. Aggregation dominates [Insights](./features.md#insights) and is where ORMs fail | — |
| Migrations | `PRAGMA user_version` + numbered SQL | A version number lives in the database file already | ~40 lines |
| HTTP server | Hono | Web-standard `FormData` handles CSV upload with no extra package; small API | `hono`, `@hono/node-server` |
| UI | Server-rendered HTML | Keeps `UI --> APP` in [architecture.md](./architecture.md#layers) true. A single-page app would run the UI in the browser and need a JSON API the architecture does not have — and localhost removes the latency argument for client state | — |
| HTML | Tagged template literals | Escapes interpolated values by default, so a bank description containing markup renders as text | ~15 lines |
| Interactivity | HTMX, [import review](./features.md#transactions) only | Full reloads there would lose scroll position across dozens of decisions. Added after the screen works with plain forms | `htmx.org` |
| Charts | Chart.js, served from disk | Works from a plain `<script>` tag, so no build step. Budget bars are **not** a chart — two elements and a CSS width | `chart.js` |
| Styling | Plain CSS | Flexbox and one media query cover the whole mobile commitment | — |
| Tests | `node:test` | Built in and stable; runs `.ts` unconfigured. Fakes and `:memory:` SQLite replace a mocking library | built in |
| Boundary: direction | One `tsconfig.json` per layer, checked with **`tsc -p`** | A violation is a compile error (TS6059/TS6307), which is what [architecture.md](./architecture.md#layout) asks for | built in |
| Boundary: domain purity | `scripts/check-imports.ts` | Invisible to the compiler — `import 'hono'` in the domain resolves through `node_modules` and builds cleanly | built in |

Deliberately absent: bundler, build step, ORM, SPA framework, CSS framework, mocking library, ESLint.

---

<a id="notes"></a>
## 2. Consequences worth knowing

Not preferences — things that follow from the table above and will bite otherwise.

1. **Money is stored as whole minor units** (`1250`, never `12.50`). Floating point cannot represent `0.10`.
2. **String unions, not enums** — and no decorators, parameter properties or runtime namespaces. Type stripping cannot generate the runtime code they need.
3. **Import specifiers carry the extension**: `'./money.ts'`.
4. **Repository ports are synchronous.** [*Local-first*](./vision.md#p-local-first) makes the local database authoritative permanently, so a repository is local by definition. Removes `async` from two layers. *Risk accepted: if one ever became remote, every signature up the stack changes.*
5. **`tsc --build` does not enforce the boundary** — solution mode permits undeclared cross-layer imports. Layers must be checked individually.
6. **Nothing loads from a CDN**, charts included.
7. **Running is not type-checking.** Node strips types without checking them, so `tsc` must be in the gate.
8. **`node:sqlite` is a release candidate.** A future Node major could change its API. Accepted: Node 24 is pinned and every call sits in one repository class.

---

<a id="rejected"></a>
## 3. Rejected

| Instead of | Rejected | Because |
| --- | --- | --- |
| TypeScript | Python, C#, Java | A second language for the browser side; no compile-time layer boundary |
| Node | Deno, Bun | Smaller ecosystems; Node has caught up on the parts used here |
| SQLite | PostgreSQL, MySQL | A server process — breaks one-command start and the portable-file promise |
| SQLite | DuckDB | Built for analytics at a scale [ruled out](./vision.md#a-history-starts-where-user-starts); less stable file format |
| Hand-written SQL | Prisma, Drizzle | A schema language and codegen to learn; types leak into the domain |
| Hand-written SQL | TypeORM, MikroORM, Sequelize | Decorator-based — technically impossible under type stripping |
| Hand-written SQL | Kysely | The closest call. Needs the SQL knowledge anyway; contained behind the ports if hand-written SQL ever hurts |
| Server-rendered | React, Vue, Svelte | A bundler, a router, state, and a JSON API; `.tsx` cannot be type-stripped at all |
| Hono | Express | Needs `multer` for file upload, on the highest-risk feature. Defensible swap for its answer archive |
| Hono | Fastify, `node:http` | More concepts for unneeded performance / hand-rolling multipart parsing |
| Chart.js | Hand-written SVG | Runner-up. Loses on axis intervals, label collisions and tooltips — and "how much exactly?" must be answerable |
| Chart.js | D3, ECharts, Plotly | A toolkit rather than a chart library / far more API than four charts need |
| `node:test` | Vitest | Built on Vite — hands back the build step |
| `node:test` | Jest, Mocha | Needs a transform for TypeScript / two dependencies for what ships free |
| `node:sqlite` | `better-sqlite3` | Native compilation: a toolchain on Windows and a rebuild for desktop packaging |
| Two checks | ESLint | `strict` plus two purpose-built checks cover correctness and architecture; the rest is formatting |

---

<a id="verified"></a>
## 4. Verified 2026-09-10

A throwaway spike ran every claim above rather than trusting it. **Two failed and changed the outcome:**

- A wrong-direction import **passes** `tsc --build` — refuted, hence per-layer `tsc -p`.
- A third-party import in the domain **passes** `tsc` entirely — refuted, hence the script.

Confirmed: no build step; `node:sqlite` synchronous with `CHECK` and foreign keys enforced by default; `node:test` on `.ts` files; per-layer `tsc -p` erroring with an editor squiggle, and a declared reference not opening the undeclared ones.

Not covered: HTMX, Chart.js, CSV import, a second migration.

---

<a id="open"></a>
## 5. Open

| Question | Blocks |
| --- | --- |
| **TypeScript 7** is npm's `latest` — the native compiler rewrite, recent. This stack pins 5.9. Do project references behave identically? | Settle before v1, not mid-build |
| **Will anyone else work in this repo?** Every choice assumed a solo developer. Nothing reverses for a team, but onboarding cost would outrank framework count and CI would become primary enforcement | The ESLint call; where the gate runs |
| Where the gate runs: pre-commit hook, GitHub Action, or both | Nothing yet |
