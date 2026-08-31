# Features

<a id="scope"></a>
## 1. Scope — version 1.0

Five capabilities. Nothing here is optional; nothing not here is in v1.

<a id="accounts"></a>
### 1.1 Accounts

Create, edit, and archive accounts, each with a name, type, and running balance derived from its
transactions. *Balance is computed, never stored as a free-standing editable number* — a stored
balance and a transaction list will eventually disagree, and then neither can be trusted.

Two requirements follow directly from computing balances:

- **Opening balance.** Each account records what it held on the day tracking began. Without it, every
  computed balance is wrong until the account's entire history has been imported — which will never
  happen (see the assumption [*Historical data starts where the user starts*](./Vision.md#a-history-starts-where-user-starts)).
- **Reconcile to actual.** The user can state an account's real balance at any moment; the app books
  the difference as an adjustment (see [Categories](#categories)). This is what keeps computed balances honest when
  reality drifts from the ledger, and it is a general account operation, not a cash workaround.

**Cash is an ordinary account, not a special type.** A user who wants cash detail creates a cash
account and records ATM withdrawals as transfers into it. A user who does not can simply categorise the
withdrawal as an expense. 

Accounts are deliberately low-prominence in the UI — they exist as a check to make the numbers trustworthy, but might be completely ignored by some users.
<a id="transactions"></a>
### 1.2 Transactions

Every transaction has a date, an amount, an account, and a description. There are three
kinds:

- **Expense** — must always carry an expense category.
- **Income** — must always carry an income category. v1 offers only the protected ones, so income
  stays undifferentiated in practice (see [Explicitly out of scope](#out-of-scope)).
- **Transfer** — a movement between two of the user's own accounts, excluded from all spending
  figures. **Transfers never carry a category**, in this or any version.

**Transfers are first-class**, not a pair of offsetting expense/income rows. Modelled as two ordinary
transactions, every ATM withdrawal and every credit-card payment would appear as spending and income, silently
corrupting the charts that are the product's entire purpose.

Transactions are created two ways:

- **Manually**, for cash and anything the bank does not see. Manual entry is a repeated, high-volume
  action and must be fast — the account field is defaulted to Cash.
- **By CSV import**, the primary path for everything else.

CSV import must survive real-world bank exports: differing column orders, date formats, decimal
separators, and encodings. It therefore needs **reusable per-bank mapping profiles** and
**duplicate detection**, because users re-import overlapping date ranges and will do so by accident.

Import ends in a **review step**: parsed rows wait in a pending batch, outside the ledger, until the
user confirms them. Review groups rows **by vendor** so a month is a few dozen decisions rather than
a few hundred, and any group **unfolds** for vendors the user splits across categories. Without this
the five-minute target is missed several times over.

This is the highest-risk feature in the product and is specified separately in
[CsvImport.md](./CsvImport.md).

<a id="categories"></a>
### 1.3 Categories

**Expense categories and income categories are two separate sets.** They never mix in a picker, never
appear in one list, and a category from one side can never be assigned to a transaction of the other.
A sensible predefined set of *expense* categories ships so the app is useful on first launch, fully
editable thereafter (create, rename, recolour, delete).

Each set carries the same two **protected** categories: the app assigns them itself and forbids their
deletion. Their names and colours stay editable — only their identity is fixed.

 v1 ships **no income categories**  (see [Explicitly out of scope](#out-of-scope)).

| Protected category | Meaning |
| --- | --- |
| **Uncategorised** | *"I have not sorted this yet."* A to-do. Transactions land here when their category is deleted. |
| **Unaccounted** | *"I will never know where this money went, or where it came from."* A final answer, produced by reconciliation. |

The two look alike and mean opposite things, on both sides. Keeping them separate preserves
**"uncategorised = 0"** as a meaningful signal that an import has been fully processed — a signal
**scoped to expenses**, since in v1 there are no income categories.

The same name appearing on both sides is safe precisely because the sets never meet: a picker is
always scoped to the transaction's kind, so the user is never offered two entries called
*Uncategorised*.

A reconciliation *shortfall* lands in expense *Unaccounted*. A reconciliation **surplus** — more money
than the ledger predicted — is recorded as **income**, not as a negative expense, and lands in income
*Unaccounted*: money appeared and the user will never know why, which is a final answer rather than a
to-do.

**Budgets attach to expense categories only** (see [Budgets](#budgets)), and never to the protected
two — you cannot plan to spend money you cannot account for, and income is not something you budget.

<a id="budgets"></a>
### 1.4 Budgets

A **monthly spending limit per expense category**. Budgets exist so the app can tell the user something they
did not already know: not just what they spent, but whether that was more than they intended. This
is the feature that makes the product an assistant rather than a ledger.

Each calendar month starts fresh and **unspent money does not roll over** — a budget is an intention
for a period, not a balance that accumulates. Both rollover and periods other than monthly (yearly,
or any interval the user chooses) are wanted in later versions and should be user-selectable when
they arrive. v1 hardcodes the monthly period, but the domain model should treat monthly as *one*
period rule rather than the only conceivable one.

Income categories and protected categories cannot carry budgets (see [Categories](#categories)).

<a id="insights"></a>
### 1.5 Insights

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

<a id="out-of-scope"></a>
## 2. Explicitly out of scope

Listed so that "should we add…?" has an answer that does not require a meeting.

**Never (these would change what the product is):**

- **Moving money.** The app is a read-only ledger. It never initiates a payment, ever.
- **Bank API / Open Banking / credential storage / screen scraping.** CSV is the boundary. This
  keeps the app free of credentials, licensing regimes, and per-bank integration maintenance.
- **Multi-user access, shared ledgers, or holding another person's data.** One user, one machine, one
  file. Sync between a single user's *own* devices is not forbidden by the principle [*Local-first*](./Vision.md#p-local-first), but it needs a
  server and is not planned — treat it as a v3 question at the earliest.
- **Telemetry or analytics of any kind.** No exceptions, opt-in or otherwise.

**Not in v1 (defensible later, deliberately excluded now):**

- Multi-currency support.
- **Income categories.** e.g. salary, refunds and gifts is a
  data seed and a chart — no migration, because income transactions already carry a category.
- **Linking an income category to an expense category** — so a refund could offset the category it
  came from. A much later idea, and only if a user actually wants it.
- Investment, asset, or net-worth tracking.
- Tax reporting or accounting-standard exports.
- Native mobile applications. The app should be usable in a browser at a small window size; that is
  the extent of the v1 mobile commitment.
- Recurring-transaction detection and forecasting.
- Budget rollover, and budget periods other than monthly — see [Budgets](#budgets).
- Rule-based auto-categorisation on import. Tempting, but it collides with the principle [*KISS is a product rule*](./Vision.md#p-kiss) and inflates
  the riskiest feature in the product. Revisit once import is proven.
- **Learned recall** — pre-filling a vendor's category from the user's own past decisions. Distinct
  from rule-based categorisation: a lookup filled in as a side effect of normal work, with nothing to
  author. The first thing to add once import is proven; see [CsvImport.md](./CsvImport.md#deferred).
- **AI features — deferred by design, not rejected.** Three are intended: **receipt scanning** that
  turns a photograph into a transaction, **analysis with recommendations** for improving the
  user's finances, and **transaction pre-categorisation** on import — local-only, suggestion-only,
  user-invoked, and held in reserve rather than planned: needed only if learned recall proves
  insufficient. All are excluded from v1 under the principle [*Trustworthy before clever*](./Vision.md#p-trustworthy-before-clever) — the ledger must be provably
  trustworthy before anything probabilistic sits on top of it. The name *financialCopilot*
  anticipates these features rather than contradicting the v1 scope.

  Worth recording now, because it changes how much these features actually cost: **receipt
  extraction is narrow, structured, and runs on-device**, and **much of "analysis and tips" is
  statistics rather than inference** — averages, outliers, dormant subscriptions, budget pace. That
  work is deterministic, therefore testable, therefore compatible with TDD in a way model output is
  not. Only *conversational* analysis ("why was last month expensive?") clearly wants a capable
  model that probably won't run on-devices.
- Docker images and desktop packaging. v1 is a local web app; these are later delivery options and
  the architecture must not foreclose them (see the assumption [*The user can run a local application*](./Vision.md#a-local-application)).
