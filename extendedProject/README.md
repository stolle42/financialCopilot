# Extended project — archive

These four documents design the **full** feature list (53 P0 items plus P1/P2). They are kept as the backlog and long-term reference.

| File | What it is |
|---|---|
| `features-verbose.md` | The complete feature list, P0/P1/P2 |
| `ARCHITECTURE.md` | System design for all of it — 20 tables, CAMT.053, recurring detection, FX, auth |
| `TECH-STACK.md` | Stack for all of it |
| `RISKS.md` | Full risk register, R1–R14 |

**The active scope is the nine-item subset** — see `../FEATURES.md`, `../ARCHITECTURE.md`, `../TECH-STACK.md`, `../RISKS.md`.

---

## Known defects in these archived documents

Found in review and **fixed in the active set, not here.** If you ever promote a feature out of this backlog, re-read the corresponding section in the active docs rather than these.

**Correctness bugs**

1. `ARCHITECTURE.md` §7.1's exclusion predicate uses `AND t.is_excluded = 0`, which cannot express the "override in both directions" behaviour that §4.1 and `RISKS.md` both claim for the column. The active version uses a nullable column and `COALESCE(t.is_excluded, c.exclude_from_reports, 0) = 0`.
2. §7.2's `MonthlyFacts` has no notion of *essential* spend, so the emergency-fund runway silently substitutes `is_fixed` for "essential". These are different questions. The active schema carries both `is_fixed` and `is_essential`.
3. `transaction_splits` exists but no aggregate reads it — a split €120 purchase is counted entirely under its parent's category. Splits are cut from the active scope, so the bug is moot there.
4. "Recurring commitment load" is a P0 health metric fed only by recurring detection, which is P1 and scheduled at build step 14. The dependency is inverted. `RISKS.md` R10 notes the fix (manual declaration as the primary path); the build order does not reflect it.
5. §5.4 claims one atomic transaction and then describes chunking large batches, which are incompatible. The active version drops chunking.
6. Cross-currency balance: §3.2 adds `account_amount_minor` to fix it, but `RISKS.md` and parts of §7 were written before that and still assume one amount column.

**Contradictions**

7. Nightly backups (§10) vs ADR 10's "no scheduled work" and the stack's "no job queue". Resolved in the active docs: the backup is an **OS-level** scheduled task, never an in-app job.
8. Category merge and delete-with-reassignment are called must-haves in `RISKS.md` R8 but appear nowhere in the build order.
9. `RISKS.md` R9 says unpaired transfers surface in the data-quality banner, but `MonthlyFacts` exposes only `uncategorized`.
10. The §1 diagram places `backups/` beside the database, which §10 and R7 both name as a failure mode.
11. `TECH-STACK.md` §6 keeps sorting client-side while filtering server-side over a paginated set — which silently shows the wrong rows.
12. `RISKS.md` R3 says "100+ P0 items" (the real count is 53) and R4 lists pending-vs-booked as P0 (it is P2).

**Factual errors**

13. `MAX_SAFE_INTEGER` described as "~90 trillion euro-cents" — it is ~9 quadrillion cents, i.e. ~90 trillion euros. Conclusion unaffected, figure wrong by 100×.
14. "Node 22 required by Next.js 15" — Next.js 15 needs ≥ 18.18.
15. `bigint` rejected because it "serializes badly across the RSC boundary" — React 19 supports BigInt in Flight. The real objection is `JSON.stringify` throwing.
16. `PRAGMA journal_mode = WAL` listed as per-connection; it is persisted in the DB header and set once.
17. `foreign_keys = ON` conflicts with drizzle-kit's SQLite table rebuilds, which require FK enforcement off. Not mentioned.
18. `HOSTNAME=127.0.0.1` relied on for the entire network security model; `next start -H 127.0.0.1` is the supported path.
19. `Intl.NumberFormat` said to produce `1.234,56 €` — it emits U+00A0 before `€`, so literal test assertions fail.
20. CAMT.053: no schema version named (`RltdPties/Cdtr/Nm` moves in `.001.08`+); `EndToEndId`/`MndtId`/`RmtInf` shown as entry-level when they are under `NtryDtls/TxDtls`; `RvslInd` reversals and unsigned `<Amt>` + `CdtDbtInd` not covered.
21. Auth.js Credentials provider forces the JWT strategy, so `auth_sessions`, `auth_verification_tokens` and `auth_accounts` provisioned in migration 0001 never receive a row.

**Schema problems**

22. The dedup ordinal is specified as counting matching rows *already in the database*, which breaks the idempotency acceptance test on any file containing genuine same-day repeats. It must be a rank within the source file. **This is the most consequential single defect in the archived design.**
23. `dedup_key = 'eref:' + reference` with no sentinel blacklist — `NOTPROVIDED` is common and collapses every subsequent row onto one key, dropping them silently.
24. No `dedup_key` rule for manually created transactions, though the column is `NOT NULL` and uniquely indexed.
25. `UNIQUE (user_id, parent_id, name)` on categories does not constrain top-level rows, since SQL treats NULLs as distinct.
26. `UNIQUE (user_id, priority)` on rules makes the described reorder impossible under SQLite's row-by-row constraint checking.
27. Only one foreign key is declared in the whole sketch, while the stack doc stresses `PRAGMA foreign_keys = ON`.
28. `user_id` missing from five child tables, contradicting §1.1 and ADR 8 — and RLS needs a local column on every protected table.
29. No `users`/`auth_users` table declared, though `user_id` appears on twenty tables.
30. Missing indexes for near-duplicate detection, transfer pairing, full-text search, batch undo, and the balance `SUM`.
31. Undo-batch keys off `updated_at = created_at`, which is unreliable; the active version uses an explicit nullable `edited_at`.
32. No transfer-group invariant, despite the report predicate excluding every row that carries a group id — so one malformed group silently deletes a real expense from every report.
