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
- Anyone who wants a fully automatic app that requires zero input. This product asks for effort and
  returns understanding. That trade is the point, not a limitation to be engineered away.

---

## 4. Product principles

These are tie-breakers. When two designs are both reasonable, the one that better serves a
higher-numbered principle loses to the one serving a lower-numbered principle.

1. **Local and private by default.** The data lives in a file on the user's machine. Nothing is
   transmitted anywhere. This is not a feature to be advertised — it is the default state, and any
   future change to it is a breaking change to the product's identity.
2. **Honest over automatic.** The app never guesses a category and silently pretends to be sure.
   Where it suggests, it suggests visibly and the user confirms. A wrong number presented
   confidently is worse than no number.
3. **The answer is a picture.** A table of transactions is raw material, not an answer. Every core
   question should resolve to something the user can understand at a glance.
4. **KISS is a product rule, not just a code rule.** A feature that requires explanation is a
   feature that needs redesigning or removing. The pressure to add "just one more field" is the
   primary threat to this project.
5. **No lock-in.** Open-source dependencies only. The user's data is a plain, portable file they can
   open with other tools. Exporting everything is always possible.
6. **Trustworthy before clever.** Nothing probabilistic is added until the deterministic core is
   provably correct. Unlike the principles above, this one governs *sequencing* rather than design —
   it is why AI features are absent from v1 despite being genuinely planned (§7). A recommendation
   built on a ledger the user does not yet trust is worse than no recommendation.

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
| Import + fully categorise one month of bank CSV | **< 2 minutes** |
| Routine weekly upkeep | **< 5 minutes** |
| Answering "where did my money go last month" | **1 screen, 0 clicks beyond period selection** |
| Domain layer framework imports | **zero** |
| Features arrived at test-first | **all of them** |

The first four are the "modern and natural" criterion made concrete. The last two are the
"maintainable" criterion made concrete. Both are non-negotiable for v1; a version that hits one and
misses the other has failed.

---

## 6. Scope — version 1.0

Five capabilities. Nothing here is optional; nothing not here is in v1.

### 6.1 Accounts

Create, edit, and archive accounts, each with a name, type, and running balance derived from its
transactions. *Balance is computed, never stored as a free-standing editable number* — a stored
balance and a transaction list will eventually disagree, and then neither can be trusted.

Two requirements follow directly from computing balances:

- **Opening balance.** Each account records what it held on the day tracking began. Without it, every
  computed balance is wrong until the account's entire history has been imported — which will never
  happen (see assumption 7).
- **Reconcile to actual.** The user can state an account's real balance at any moment; the app books
  the difference as an adjustment (see §6.3). This is what keeps computed balances honest when
  reality drifts from the ledger, and it is a general account operation, not a cash workaround.

**Cash is an ordinary account, not a special type.** A user who wants cash detail creates a cash
account and records ATM withdrawals as transfers into it. A user who does not simply categorises the
withdrawal as an expense and never meets the concept at all. Accounts are deliberately
low-prominence in the UI — they exist to make the numbers trustworthy, not because anyone wants to
look at them.

### 6.2 Transactions

The ledger. Every transaction has a date, an amount, an account, and a description. There are three
kinds:

- **Expense** — must always carry a category.
- **Income** — carries no category in v1 (see §7).
- **Transfer** — a movement between two of the user's own accounts, excluded from all spending
  figures.

**Transfers are first-class**, not a pair of offsetting expense/income rows. Modelled as two ordinary
transactions, every ATM withdrawal and every credit-card payment would appear as spending, silently
corrupting the charts that are the product's entire purpose.

Transactions are created two ways:

- **Manually**, for cash and anything the bank does not see. Manual entry is a repeated, high-volume
  action and must be fast — the account field is defaulted or hidden, never a required decision.
- **By CSV import**, the primary path for everything else.

CSV import must survive real-world bank exports: differing column orders, date formats, decimal
separators, and encodings. It therefore needs **reusable per-bank mapping profiles** and
**duplicate detection**, because users re-import overlapping date ranges and will do so by accident.
This is the highest-risk feature in the product and is specified separately in
[CsvImport.md](./CsvImport.md).

### 6.3 Categories

A sensible predefined set so the app is useful on first launch, fully editable thereafter (create,
rename, recolour, delete).

Two categories are **protected**: the app assigns them itself and forbids their deletion. Their names
and colours stay editable — only their identity is fixed.

| Protected category | Meaning |
| --- | --- |
| **Uncategorised** | *"I have not sorted this yet."* A to-do. Transactions land here when their category is deleted. |
| **Unaccounted** | *"This money is gone and I will never know where."* A final answer, produced by reconciliation. |

The two look alike and mean opposite things. Keeping them separate preserves **"uncategorised = 0"**
as a meaningful signal that an import has been fully processed. Neither may carry a budget — you
cannot plan to spend money you cannot account for.

A reconciliation *surplus* — more money than the ledger predicted — is recorded as **income**, not as
a negative expense, and therefore needs no category in v1.

### 6.4 Budgets

A **monthly spending limit per category**. Budgets exist so the app can tell the user something they
did not already know: not just what they spent, but whether that was more than they intended. This
is the feature that makes the product an assistant rather than a ledger.

Each calendar month starts fresh and **unspent money does not roll over** — a budget is an intention
for a period, not a balance that accumulates. Both rollover and periods other than monthly (yearly,
or any interval the user chooses) are wanted in later versions and should be user-selectable when
they arrive. v1 hardcodes the monthly period, but the domain model should treat monthly as *one*
period rule rather than the only conceivable one.

Protected categories cannot carry budgets (§6.3).

### 6.5 Insights

A dedicated view over a **user-selected time period**, showing at minimum:

- **Spending over time** — a line chart revealing trend.
- **Category breakdown** — a pie or donut chart revealing proportion.
- **Budget progress** — per-category bars of spent-against-limit, with a clear over-limit state.

*Unaccounted* appears in the breakdown like any other category, visually distinguished as a known
unknown. A large Unaccounted share is useful information — it says the user's cash tracking is
failing — and must never be hidden to make the chart look tidier.

Charts are read-only in v1. Drill-down from a chart into the underlying transactions is desirable
and should be considered during UX design, but is not a v1 commitment.

---

## 7. Explicitly out of scope

Listed so that "should we add…?" has an answer that does not require a meeting.

**Never (these would change what the product is):**

- **Moving money.** The app is a read-only ledger. It never initiates a payment, ever.
- **Bank API / Open Banking / credential storage / screen scraping.** CSV is the boundary. This
  keeps the app free of credentials, licensing regimes, and per-bank integration maintenance.
- **Cloud sync, accounts, sharing, or multi-user access.** One user, one machine, one file.
- **Telemetry or analytics of any kind.**

**Not in v1 (defensible later, deliberately excluded now):**

- Multi-currency support.
- **Income categories.** Income is a single undifferentiated kind in v1. Categorising it (salary,
  refunds, gifts) is planned for a later version; the domain model should not make that expensive.
- Investment, asset, or net-worth tracking.
- Tax reporting or accounting-standard exports.
- Native mobile applications. The app should be usable in a browser at a small window size; that is
  the extent of the v1 mobile commitment.
- Recurring-transaction detection and forecasting.
- Budget rollover, and budget periods other than monthly — see §6.4.
- Rule-based auto-categorisation on import. Tempting, but it collides with principle 2 and inflates
  the riskiest feature in the product. Revisit once import is proven.
- **AI features — deferred by design, not rejected.** Two are intended: **receipt scanning** that
  turns a photograph into a transaction, and **analysis with recommendations** for improving the
  user's finances. They are excluded from v1 under principle 6 — the ledger must be provably
  trustworthy before anything probabilistic sits on top of it. The name *financialCopilot*
  anticipates these features rather than contradicting the v1 scope. Where such models may run is
  unresolved and tracked in §9.
- Docker images and desktop packaging. v1 is a local web app; these are later delivery options and
  the architecture must not foreclose them (assumption 6).

---

## 8. Assumptions

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

## 9. Open questions

These block later documents and should be resolved before the phase noted.

| # | Question | Blocks |
| --- | --- | --- |
| 1 | **Where may AI models run?** Receipt scanning and analysis (§7) will eventually need a model. A cloud model contradicts principle 1; local-only models constrain what those features can do. Principle 1 and the AI roadmap are on a collision course, and this is left unresolved deliberately rather than settled prematurely. Whoever plans v2 must decide it before any AI work starts. | v2 planning |

The v1 scope is otherwise settled. Everything below has been decided.

### Resolved

| Question | Resolution | Date |
| --- | --- | --- |
| Deleting a category that has transactions | Reassign to the protected *Uncategorised* category. Never destroys transactions. | 2026-08-21 |
| Are transfers a distinct concept? | Yes — first-class, excluded from spending. Required by cash withdrawals and credit-card payments. | 2026-08-21 |
| Does cash need special handling? | No. Cash is an ordinary opt-in account; reconciliation is a general account operation. | 2026-08-21 |
| Is income categorised? | Not in v1. Income categories are a later version. | 2026-08-21 |
| How is the app packaged and launched? | v1 is a local web app started with one command. Docker and desktop packaging are later delivery options; the architecture must not foreclose them. | 2026-08-21 |
| The name vs. the AI-free scope | Name kept. AI is genuinely planned (receipt scanning, analysis) but sequenced after a trustworthy core — principle 6. | 2026-08-21 |
| Budget period and rollover | Fixed calendar month in v1, no rollover. User-selectable periods and optional rollover are later features. | 2026-08-21 |
| Where do predefined categories come from? | One fixed, opinionated built-in set in v1. No first-run picker. The actual list is decided in features.md. | 2026-08-21 |

---

## 10. Related documents

- [features.md](./features.md) — user stories and prioritisation
- [techstack.md](./techstack.md) — technology decisions and rejected alternatives
- [Architecture.md](./Architecture.md) — structure, domain model, data model
- [Risks.md](./Risks.md) · [Roadmap.md](./Roadmap.md) · [effortEstimations.md](./effortEstimations.md)
