# Spike — techstack verification

> **Throwaway.** This exists to prove the six techstack decisions work together.
> Delete the whole folder once it has answered its questions. It is not v1 code,
> and it decides nothing — [techstack.md](../techstack.md) does that.

**Requires Node ≥ 24.12** (the version where TypeScript type stripping became stable).

```
cd spike
npm install
```

---

## What each step proves

Run them in order and compare against the expected result. **Probe 3 is the one that matters** — it is the only claim made without evidence.

### 1. No build step

```
npm start
```

**Expect:** a server on <http://localhost:8787> showing a ledger, a category bar, and a working form. Add an expense; it persists to `spike.db`.

Proves: Node runs `.ts` files directly with no bundler, no `tsc` beforehand, no config. Hono serves server-rendered HTML. A form POST reaches the application layer and lands in SQLite.

### 2. Tests, with no test framework installed

```
npm test
```

**Expect:** all tests pass, including `sqliteTransactionRepository.test.ts`.

Proves: `node:test` runs `.ts` test files unconfigured; `node:sqlite` works synchronously; the `CHECK` constraint refuses an expense with no category *and* a transfer carrying one; foreign keys are enforced **without** switching them on. Domain tests need no fixtures — [architecture.md](../architecture.md#layout) names that as the symptom of a leaked boundary.

### 3. The layer boundary — the claim under test

```
npm run check
```

**Expect:** passes cleanly.

Now break it deliberately:

```powershell
copy violations\wrong-direction.ts.txt src\domain\wrong-direction.ts
npm run check
```

**Expect: the build FAILS**, with something like `TS6059: File ... is not under 'rootDir'` or `TS6307: File ... is not listed within the file list of project`.

```powershell
del src\domain\wrong-direction.ts
```

**This is what I could not verify.** Project references require `composite: true`, which does not combine freely with `noEmit`, and I worked around that with `emitDeclarationOnly` plus `rewriteRelativeImportExtensions` — three options that each have their own constraints. I believe the combination is valid. I have not run it.

**If step 3 fails to even build the clean tree**, the fallback is already in place and needs no new thinking: `npm run imports` enforces the same rule as a check rather than a build failure. [architecture.md](../architecture.md#layout) explicitly permits this — *"and — where the language allows it — by making each layer its own compilation unit"*. We would simply have learned that the language does not allow it as cleanly as hoped. **Paste me the error either way.**

### 4. The rule references cannot catch

```powershell
copy violations\third-party-in-domain.ts.txt src\domain\third-party-in-domain.ts
npm run check     # expect: PASSES — this is the point
npm run imports   # expect: FAILS with 'domain must import nothing external, found "hono"'
del src\domain\third-party-in-domain.ts
```

Proves why two mechanisms are needed rather than one: `hono` resolves through `node_modules`, outside the layer graph, so the compiler never sees a violation. Invariant 7 needs the script.

### 5. Optional — TypeScript 7

npm's `latest` for TypeScript is now **7.0.2**, the native compiler rewrite, and it is very fresh. This spike pins `^5.9.0` deliberately.

```
npm install --save-dev typescript@7
npm run check:clean && npm run check
```

If project references behave identically, TypeScript 7 is a safe default for v1 and we get a much faster type-check. If not, stay on 5.9 and revisit. Worth knowing before v1 starts rather than mid-build.

---

## The gate

```
npm run gate
```

`check` + `test` + `imports`. Nothing passes this while violating an invariant from [architecture.md §5](../architecture.md#invariants).

---

## What this spike deliberately does not cover

- **HTMX** — nothing here needs a fragment swap. It arrives with the import review screen, and is incremental by design.
- **Chart.js** — the category bar is plain CSS on purpose, showing that budget progress needs no chart library. The two real charts are untested here.
- **CSV import** — the highest-risk feature, and out of scope for a stack probe. `c.req.formData()` in `src/ui/server.ts` is the same mechanism that will read an uploaded file.
- **Real migrations** — `openDatabase` reads and writes `PRAGMA user_version` but has only one version to apply. The mechanism is shown, not exercised.

## Correction to decision 3

Hono needs **two** packages on Node: `hono` plus `@hono/node-server`, the adapter between web-standard `Request`/`Response` and `node:http`. I claimed one. Against Express + `multer` that is a tie on count, not a win — Hono still wins on substance, because the adapter has no API to learn while `multer` does, but the "one dependency" line was wrong.
