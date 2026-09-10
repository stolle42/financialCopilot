# Tech stack

> **Status:** Draft · **Owner:** simon · **Last updated:** 2026-09-10
>
> This document decides *which technologies build the product*, and which were rejected.
> It may not force a change in the documents above it — precedence: [README.md](./README.md).

---

<a id="stack"></a>
## 1. Decisions

| Concern | Choice | Why | Cost |
| --- | --- | --- | --- |
| Language + runtime | TypeScript on Node 24 LTS | The browser forces JavaScript in anyway; one language beats two — and it lets the domain layer be shared with the browser ([§3](#notes)). Runs `.ts` with no build step | — |
| Database | SQLite via `node:sqlite` | A single portable file, no server — the only store consistent with [*Local-first*](./vision.md#p-local-first) and [*No lock-in*](./vision.md#p-no-lock-in). Enforces the `CHECK` constraint and foreign keys from [architecture.md](./architecture.md#domain-model) | built in |
| Database access | Hand-written SQL in repositories | An ORM's core feature — entity classes it owns — is what [invariant 7](./architecture.md#invariants) forbids, so mappers are hand-written either way. Aggregation dominates [Insights](./features.md#insights) and is where ORMs fail | — |
| Migrations | `PRAGMA user_version` + numbered SQL | A version number lives in the database file already | ~40 lines |
| HTTP server | Hono | Web-standard `FormData` handles CSV upload with no extra package; serves HTML and JSON from one app | `hono`, `@hono/node-server` |
| UI — phase 1 | Server-rendered HTML, deliberately unstyled | A clickable test harness while the risky work is server-side. Thin on purpose, so replacing it wastes little ([§2](#phasing)) | — |
| UI — phase 2 | React | Fits the [import review](./features.md#transactions) screen, whose state is held in memory before commit; and is the deliberate transferable-skill investment. *Not a necessity — a justified choice* | `react`, `react-dom`, `react-router` |
| Build — browser only | Vite | `.tsx` cannot be type-stripped by Node, so React needs a bundler. The **server** keeps running `.ts` directly | `vite`, `@vitejs/plugin-react` |
| Server ↔ browser | JSON routes on the same Hono app | Added alongside the HTML routes, which are deleted per screen as React covers it | — |
| Server HTML | Tagged template literals | Escapes interpolated values by default, so a bank description containing markup renders as text | ~15 lines |
| Charts | Chart.js, served from disk | Works from a plain `<script>` tag. Budget bars are **not** a chart — two elements and a CSS width | `chart.js` |
| Styling | Plain CSS | Flexbox and one media query cover the whole mobile commitment | — |
| Tests | `node:test` | Built in and stable; runs `.ts` unconfigured. Fakes and `:memory:` SQLite replace a mocking library | built in |
| Boundary: direction | One `tsconfig.json` per layer, checked with **`tsc -p`** | A violation is a compile error (TS6059/TS6307), which is what [architecture.md](./architecture.md#layout) asks for | built in |
| Boundary: domain purity | `scripts/check-imports.ts` | Invisible to the compiler — `import 'hono'` in the domain resolves through `node_modules` and builds cleanly | built in |

Deliberately absent: ORM, CSS framework, mocking library, ESLint, HTMX, a client-side data-fetching library ([§3](#notes)).

---

<a id="phasing"></a>
## 2. Phasing

The UI is decided in two steps because [*Trustworthy before clever*](./vision.md#p-trustworthy-before-clever) governs sequencing: a second interface waits until the first core is correct.

1. **Inner three layers first**, behind an ugly server-rendered UI. CSV import and money arithmetic are the risky, valuable work and are entirely server-side.
2. **React once that core is trusted.** Learning JSX while also debugging a `GROUP BY` means learning neither well.

Swapping the UI while `domain/`, `application/` and `infrastructure/` stay untouched is Clean Architecture's central claim, demonstrated rather than asserted.

---

<a id="notes"></a>
## 3. Consequences worth knowing

Not preferences — things that follow from the table above and will bite otherwise.

1. **The domain layer is shareable with the browser.** [Invariant 7](./architecture.md#invariants) keeps `src/domain/` free of Node built-ins, so Vite can bundle it for the browser while Node runs the same files natively. Validation rules therefore live **once**, not once per side — which removes React's only cost that carried no upside. The purity checker is what keeps this true.
2. **No client-side data-fetching library.** The server is on the same machine, so a round trip is about a millisecond. Refetch-after-mutation is fine; optimistic updates and cache invalidation solve a latency problem that does not exist here. Revisit only if a screen actually feels slow.
3. **The no-build-step property now applies to the server only.** Browser code goes through Vite; `node src/root/main.ts` still starts the app.
4. **Money is stored as whole minor units** (`1250`, never `12.50`). Floating point cannot represent `0.10`.
5. **String unions, not enums** — and no decorators, parameter properties or runtime namespaces in server code. Type stripping cannot generate the runtime code they need.
6. **Import specifiers carry the extension**: `'./money.ts'`.
7. **Repository ports are synchronous.** [*Local-first*](./vision.md#p-local-first) makes the local database authoritative permanently, so a repository is local by definition. Removes `async` from two layers. *Risk accepted: if one ever became remote, every signature up the stack changes.*
8. **`tsc --build` does not enforce the boundary** — solution mode permits undeclared cross-layer imports. Layers must be checked individually.
9. **Nothing loads from a CDN**, charts included.
10. **Running is not type-checking.** Node strips types without checking them, so `tsc` must be in the gate.
11. **`node:sqlite` is a release candidate.** A future Node major could change its API. Accepted: Node 24 is pinned and every call sits in one repository class.

---

<a id="rejected"></a>
## 4. Rejected

| Instead of | Rejected | Because |
| --- | --- | --- |
| TypeScript | Python, C#, Java | A second language for the browser side; no compile-time layer boundary; no shareable domain |
| Node | Deno, Bun | Smaller ecosystems; Node has caught up on the parts used here |
| SQLite | PostgreSQL, MySQL | A server process — breaks one-command start and the portable-file promise |
| SQLite | DuckDB | Built for analytics at a scale [ruled out](./vision.md#a-history-starts-where-user-starts); less stable file format |
| Hand-written SQL | Prisma, Drizzle | A schema language and codegen to learn; types leak into the domain |
| Hand-written SQL | TypeORM, MikroORM, Sequelize | Decorator-based — technically impossible under type stripping |
| Hand-written SQL | Kysely | The closest call. Needs the SQL knowledge anyway; contained behind the ports if hand-written SQL ever hurts |
| React | Vue, Svelte, Angular | All defensible technically. React chosen for transferability, which is the stated point of the learning goal |
| React | HTMX, Alpine.js | Would have covered the import screen without a build step, but there is no reason to learn both |
| Hono | Express | Needs `multer` for file upload, on the highest-risk feature. Defensible swap for its answer archive |
| Hono | Fastify, `node:http` | More concepts for unneeded performance / hand-rolling multipart parsing |
| Chart.js | Hand-written SVG | Runner-up. Loses on axis intervals, label collisions and tooltips — and "how much exactly?" must be answerable |
| Chart.js | D3, ECharts, Plotly | A toolkit rather than a chart library / far more API than four charts need |
| TypeScript 5.9 | TypeScript 7 | npm's `latest`, but the compiler API moved to `typescript/unstable/*`, which breaks the import checker's `preProcessFile` call — and a days-old whole-compiler rewrite is a poor bet on project references, which enforce the layer boundary. Its speed gain is invisible at this size. Revisit when that API stabilises |
| `node:test` | Vitest | Built on Vite. Reconsider in phase 2 — once Vite is present for React anyway, its main objection is gone |
| `node:test` | Jest, Mocha | Needs a transform for TypeScript / two dependencies for what ships free |
| `node:sqlite` | `better-sqlite3` | Native compilation: a toolchain on Windows and a rebuild for desktop packaging |
| Two checks | ESLint | `strict` plus two purpose-built checks cover correctness and architecture; the rest is formatting |

---

<a id="verified"></a>
## 5. Verified 2026-09-10

A throwaway spike ran the phase-1 claims rather than trusting them. **Two failed and changed the outcome:**

- A wrong-direction import **passes** `tsc --build` — refuted, hence per-layer `tsc -p`.
- A third-party import in the domain **passes** `tsc` entirely — refuted, hence the script.

Confirmed: no build step; `node:sqlite` synchronous with `CHECK` and foreign keys enforced by default; `node:test` on `.ts` files; per-layer `tsc -p` erroring with an editor squiggle, and a declared reference not opening the undeclared ones.

Untested: Chart.js, CSV import, a second migration, and **everything in phase 2** — including whether Vite bundles `src/domain/` cleanly, which [§3.1](#notes) depends on.

---

<a id="open"></a>
## 6. Open

| Question | Blocks |
| --- | --- |
| Does Vite bundle `src/domain/` for the browser without complaint? The shared-validation argument rests on it | Phase 2 start — worth a five-minute spike then |
| Chart.js or Recharts once React arrives | Phase 2 |
| **Will anyone else work in this repo?** Every choice assumed a solo developer. Nothing reverses for a team, but onboarding cost would outrank framework count and CI would become primary enforcement | The ESLint call; where the gate runs |
| Where the gate runs: pre-commit hook, GitHub Action, or both | Nothing yet |
