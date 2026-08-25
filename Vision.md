# Vision

> **Status:** Draft · **Owner:** simon · **Last updated:** 2026-08-21
>
> This document defines *why* the product exists and *where its edges are*. It deliberately contains
> no technical decisions — those live in [techstack.md](./techstack.md) and
> [Architecture.md](./Architecture.md). If a discussion about scope stalls, this document decides.

---

## 1. One-liner

**A private, local-first finance tracker that turns a pile of bank transactions into a clear answer to
one question: where is my money actually going?**

---

## 2. The problem

A private individual who wants to understand their spending today has three bad options:

| Option | Why it fails |
| --- | --- |
| **Online banking** | Shows one account in isolation. Categorisation is automatic, opaque, and usually wrong. No history beyond what the bank chooses to keep. |
| **A spreadsheet** | Infinitely flexible, which is the problem. Requires manual discipline, breaks silently when a formula is dragged one row too far, and nobody builds charts for it twice. |
| **Commercial finance apps** | Require handing over bank credentials or account access to a third party, frequently carry a subscription, and treat the user's financial history as a product input. |

The gap: **there is no simple tool that keeps the data on your own machine, lets you decide what a
category means, and still gives you a real visual answer.** That gap is what this product fills.

---

<a id="persona"></a>
## 3. Who it is for

**Primary persona — "the deliberate tracker".**

A private individual who:

- holds **2–5 accounts** (current account, savings, maybe a credit card),
- can export a **CSV from their bank** and is willing to do so every week or month,
- will spend **a few minutes a week** on upkeep in exchange for genuine clarity,
- **cares that their financial data does not leave their machine**,
- is comfortable enough with a computer to run a local application.

**Explicitly not the user:**

- Businesses, freelancers, or anyone needing tax-grade bookkeeping.
- Investors tracking portfolio performance or net worth across assets.
- Households wanting shared, multi-user access to one ledger.

---

<a id="principles"></a>
## 4. Product principles

These are tie-breakers. When two designs are both reasonable, the one that better serves a
higher-numbered principle loses to the one serving a lower-numbered principle.

1. **Local-first.** The database on the user's machine is the **sole source of truth**, and **no
   feature may require the network to function.** Anything that does leave the machine is opt-in,
   per-feature, and visible — never a default, never silent. v1 transmits nothing at all; this
   wording exists so that later features ([out of scope](./features.md#out-of-scope)) can be added without breaking the product's promise
   rather than by amending it. In practice this means anything that might one day become a network
   call sits behind an interface from day one.
2. **KISS is a product rule, not just a code rule.** A feature that requires explanation is a
   feature that needs redesigning or removing. The pressure to add "just one more field" is the
   primary threat to this project.
3. **Honest over automatic.** The app never guesses a category and silently pretends to be sure.
   Where it suggests, it suggests visibly and the user confirms. A wrong number presented
   confidently is worse than no number.
4. **Trustworthy before clever.** Nothing probabilistic is added until the deterministic core is
   provably correct. Unlike the others, this one governs *sequencing* rather than design —
   it is why AI features are absent from v1 despite being genuinely planned ([out of scope](./features.md#out-of-scope)). A recommendation
   built on a ledger the user does not yet trust is worse than no recommendation.
5. **The answer is a picture.** A table of transactions is raw material, not an answer. Every core
   question should resolve to something the user can understand at a glance.
6. **No lock-in.** Open-source dependencies only. The user's data is a plain, portable file they can
   open with other tools. Exporting everything is always possible.

---

## 5. What success looks like

The product succeeds when it can answer three questions faster than any alternative:

- **"Where did my money go last month?"** — one screen, one period selector, no further clicks.
- **"Am I on track?"** — budget progress visible without doing arithmetic.
- **"What changed?"** — spending over time, so a trend is obvious before it becomes a problem.

### Measurable criteria for v1

| Criterion | Target |
| --- | --- |
| Empty app → first meaningful chart | **< 10 minutes** for a new user |
| Import + fully categorise one month of bank CSV | **< 5 minutes** |
| Routine weekly upkeep | **< 5 minutes** |
| Answering "where did my money go last month" | **1 screen, 0 clicks beyond period selection** |

These conditions are non-negotiable for v1: a version that misses any of them has failed.

---

<a id="assumptions"></a>
## 6. Assumptions

Stated so they can be challenged rather than silently inherited.

1. **Single currency.** All amounts share one currency, configured once. Multi-currency is not a
   feature that can be retrofitted cheaply, so it is an accepted risk (see Risks.md).
2. **Single user, single machine, no sync.** No concurrent access. This removes an entire category
   of complexity and is the main reason the architecture can stay simple.
3. **The user's bank offers CSV export.** If it does not, the app is only usable in manual mode.
4. **Bank CSV formats vary unpredictably** and cannot be auto-detected reliably, hence mapping
   profiles rather than a single parser.
5. **English UI first.** Structured so translation is possible later; no translations shipped in v1.
6. **The user can run a local application.** In v1 this means a local web app: one command starts a
   production build, the user opens it in a browser. Because Docker and desktop packaging are
   intended later, nothing may hardcode paths, ports, or the location of the data file.
7. **Historical data starts where the user starts.** No expectation of importing years of history at
   once; performance targets assume thousands of transactions, not millions. Opening balances exist
   precisely because of this.
8. **Cash tracking will always be incomplete.** Nobody records every €2.50 coffee. The product treats
   this as normal and makes the gap visible rather than pretending it away — hence *Unaccounted*.
9. **Users hold only their own accounts.** A transfer always has both ends inside the app; paying
   another person is an expense, not a transfer.

---

<a id="open-questions"></a>
## 7. Open questions

These block later documents and should be resolved before the phase noted.

| # | Question | Blocks |
| --- | --- | --- |
| 1 | **Which AI features, if any, justify leaving the machine?** Principle 1 now permits opt-in outbound calls, so this is a judgement call per feature rather than a contradiction. Receipt extraction and statistical analysis appear locally feasible; conversational analysis probably is not. Decide feature by feature when v2 is planned — not before, and never as a blanket policy. | v2 planning |

The v1 scope is otherwise settled. Everything below has been decided.

### Resolved

| Question | Resolution | Date |
| --- | --- | --- |
| Deleting a category that has transactions | Reassign to the protected *Uncategorised* category. Never destroys transactions. | 2026-08-21 |
| Are transfers a distinct concept? | Yes — first-class, excluded from spending. Required by cash withdrawals and credit-card payments. | 2026-08-21 |
| Does cash need special handling? | No. Cash is an ordinary opt-in account; reconciliation is a general account operation. | 2026-08-21 |
| Is income categorised? | Not in v1. Income categories are a later version. | 2026-08-21 |
| How is the app packaged and launched? | v1 is a local web app started with one command. Docker and desktop packaging are later delivery options; the architecture must not foreclose them. | 2026-08-21 |
| The name vs. the AI-free scope | Name kept. AI is genuinely planned (receipt scanning, analysis) but sequenced after a trustworthy core — [principle 6](#principles). | 2026-08-21 |
| Budget period and rollover | Fixed calendar month in v1, no rollover. User-selectable periods and optional rollover are later features. | 2026-08-21 |
| Where do predefined categories come from? | One fixed, opinionated built-in set in v1. No first-run picker. The actual list is decided in [features.md](./features.md#categories). | 2026-08-21 |
| Does AI force us to abandon local-first? | No. Principle 1 relaxed from "nothing is transmitted" to proper local-first: local DB is authoritative, no feature may *require* the network, anything outbound is opt-in and per-feature. v1 scope unchanged; a fully networked product was considered and rejected — it would cost assumption 2, the [persona](#persona), and the product's only structural differentiator. | 2026-08-21 |

---

## 8. Related documents

- [features.md](./features.md) — user stories and prioritisation
- [techstack.md](./techstack.md) — technology decisions and rejected alternatives
- [Architecture.md](./Architecture.md) — structure, domain model, data model
- [Risks.md](./Risks.md) · [Roadmap.md](./Roadmap.md) · [effortEstimations.md](./effortEstimations.md)
