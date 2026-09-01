# financialCopilot

A private, local-first finance tracker. Full statement of intent: [vision.md](./vision.md#1-one-liner).

**Status: planning.** No code yet — this repository holds the documents below.

---

## Documents

| Document | Decides |
| --- | --- |
| [vision.md](./vision.md) | Why the product exists, who it is for, where its edges are |
| [features.md](./features.md) | What version 1 contains |
| [architecture.md](./architecture.md) | How the product is put together — layers, domain model, invariants |
| [techstack.md](./techstack.md) | Which technologies, and which were rejected — *not written yet* |
| [csvImport.md](./csvImport.md) | CSV import in detail, the highest-risk feature — *not written yet* |
| [risks.md](./risks.md) · [roadmap.md](./roadmap.md) · [effortEstimations.md](./effortEstimations.md) | Record state rather than decide it — *not written yet* |

---

## Precedence

When two documents disagree, the one **higher in this list wins**. This is the only place that rule is
written down; no other document restates it.

1. **vision.md** — a principle or assumption here overrules anything below.
2. **features.md** — decides v1 scope, bound by the principles above it.
3. **architecture.md** — structure and invariants; may not invent scope.
4. **techstack.md** — technology; may not force a change in the three above it.
5. **csvImport.md** — detail of one feature; subordinate to features.md and architecture.md.

risks.md, roadmap.md and effortEstimations.md sit outside this chain: they record state rather than
decide it, so they can never be the thing that wins.

Each document opens with one sentence about what *it* decides, and describes no other document.
