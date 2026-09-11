# Archive Completed Changes Implementation Plan

## Overview

`context/changes/` currently holds 15 folders, but only `account-deletion` (13/36 Progress items still pending) is genuinely in-flight. This plan archives the other 13 folders — 12 via the existing `/10x-archive` skill, plus `bootstrap-verification`, which predates the `change.md` lifecycle and needs a manual move — so `context/changes/` matches roadmap slice S-11's outcome: "contains only in-flight work."

## Current State Analysis

`context/changes/` today:

| Folder                           | `change.md` status | Progress pending  | impl-review | Roadmap slice | Roadmap already shows `done`?                                  |
| -------------------------------- | ------------------ | ----------------- | ----------- | ------------- | -------------------------------------------------------------- |
| `account-deletion`               | `implemented`      | 13/36             | none        | S-05          | yes (stale vs. actual state — **excluded**, still active work) |
| `canvas-schema`                  | `impl_reviewed`    | 0/10              | yes         | F-01          | yes                                                            |
| `canvas-dashboard`               | `impl_reviewed`    | 0/20              | yes         | S-01          | yes                                                            |
| `s-02`                           | `impl_reviewed`    | 0/31              | yes         | S-02          | yes                                                            |
| `ai-critique`                    | `impl_reviewed`    | 0/22              | yes         | S-03          | yes                                                            |
| `s-04`                           | `impl_reviewed`    | 0/30              | yes         | S-04          | yes                                                            |
| `agent-hooks`                    | `implemented`      | 0/10              | none        | S-09          | yes                                                            |
| `product-landing-page`           | `implemented`      | 0/14              | none        | S-07          | yes                                                            |
| `architecture-evidence`          | `implemented`      | 4/7 (manual-only) | none        | S-10          | **no** (still `ready`)                                         |
| `testing-infra-access-control`   | `implemented`      | 0/21              | none        | —             | n/a (no roadmap slice)                                         |
| `ai-service-contract`            | `implemented`      | 0/18              | none        | —             | n/a                                                            |
| `data-persistence-quality-gates` | `implemented`      | 0/7               | none        | —             | n/a                                                            |
| `share-link-integrity`           | `implemented`      | 0/9               | none        | —             | n/a (has one untracked file: `plan-brief.md`)                  |
| `bootstrap-verification`         | no `change.md`     | n/a               | n/a         | —             | n/a (pre-lifecycle starter-bootstrap record, dated 2026-05-30) |

`.claude/skills/10x-archive/SKILL.md` already implements the full per-change archive operation: stamp `change.md`, `git mv` to `context/archive/<created>-<change-id>/`, best-effort close the matching `roadmap.md` slice, and commit. This plan drives that skill rather than re-implementing `git mv` by hand.

### Key Discoveries:

- `context/foundation/roadmap.md`'s `## Done` section (`context/foundation/roadmap.md:316-327`) is a **markdown table**, not the bullet-list format `/10x-archive`'s roadmap-close step (`SKILL.md:175-181`) is written to append to. Per that skill's own error-handling rule ("if a target isn't where the template puts it... skip that sub-edit, keep going" — `SKILL.md:172`), the bullet-append sub-edit should be **skipped** for every matched change in this batch, not forced in after the table.
- Seven of the twelve skill-archived folders (`canvas-schema`/F-01, `canvas-dashboard`/S-01, `s-02`/S-02, `ai-critique`/S-03, `s-04`/S-04, `agent-hooks`/S-09, `product-landing-page`/S-07) already show `done` in both the `## At a glance` table and the `## Done` table — their roadmap sub-edits 1 and 2 (Status cell, Status body line) are idempotent no-ops.
- `architecture-evidence`/S-10 is the only match still showing `ready` — its roadmap Status flips for real.
- The other four (`testing-infra-access-control`, `ai-service-contract`, `data-persistence-quality-gates`, `share-link-integrity`) have no `Change ID` match anywhere in `roadmap.md`, so their roadmap-close step is a documented no-op ("no match → roadmap left untouched").
- `share-link-integrity/plan-brief.md` is untracked (`?? context/changes/share-link-integrity/plan-brief.md`) and will trip `/10x-archive`'s hard-refusal pre-flight check (`SKILL.md:64-78`) unless committed first.
- `bootstrap-verification/` has no `change.md` at all — only `verification.md` (a starter-bootstrap record, `bootstrapped_at: 2026-05-30T12:42:31Z`). `/10x-archive`'s resolution step reads `change.md` frontmatter and cannot process this folder; it needs a plain `git mv`.

## Desired End State

`context/changes/` contains exactly two entries: `account-deletion` (active) and `archive-completed-changes` (this change, still being executed). The 13 other folders live under `context/archive/<date>-<name>/`. `context/foundation/roadmap.md`'s S-10 row and `## Done` table entry are updated for `architecture-evidence`; all other roadmap content is unchanged (verified — no stray bullets, no duplicate rows). Verify with `ls -d context/changes/*/`.

## What We're NOT Doing

- Not archiving `account-deletion` — 13 Progress items remain open; it stays active.
- Not writing or backfilling `impl-review.md` for the five folders that never got one (`agent-hooks`, `product-landing-page`, `architecture-evidence`, `ai-service-contract`, `data-persistence-quality-gates`, `testing-infra-access-control`) — that's a separate, out-of-scope workflow step (`/10x-impl-review`), not this archiving pass.
- Not completing `architecture-evidence`'s 4 unchecked manual-verification boxes before archiving — decided as acceptable per the skill's own manual-only warn-and-continue path.
- Not modifying `/10x-archive`'s `SKILL.md` to handle the table-shaped `## Done` section — working around the mismatch procedurally in this plan instead of changing shared tooling.
- Not touching the other untracked files in the repo (`src/pages/api/auth/delete-account.ts`, `supabase/snippets/`, `context/foundation/archive/`) — unrelated to this change.

## Implementation Approach

Drive `/10x-archive` once per change-id via the Skill tool, sequentially — never in parallel, since each call's roadmap-close step checks whether `roadmap.md` was already dirty before deciding whether to stage its edit into the archive commit; overlapping calls would corrupt that check. Order folders by roadmap-duplication risk first (Phase 1 prep), then no-match/no-op-roadmap folders (Phase 2), then already-`done`-in-roadmap folders (Phase 3), then the one non-skill folder (Phase 4), then verify (Phase 5).

## Critical Implementation Details

**Roadmap `## Done` shape mismatch.** `SKILL.md` step 5.5.3 describes appending a bullet under `## Done`; the actual file has a table there instead. When running `/10x-archive` for any of the seven roadmap-matched changes, watch its own output/diff for that sub-edit — if it tries to force a bullet in after the table (rather than skipping it per its own documented fallback), stop and fix the resulting `roadmap.md` by hand before committing, rather than letting a malformed section land in the archive commit.

**Sequencing.** Each `/10x-archive` call must fully complete (including its commit) before the next one starts — `SKILL.md`'s "pre-existing staged changes" hard block (step 2 of "Hard refusal") will otherwise misfire on the tail end of the previous call's staged roadmap edit.

## Phase 1: Prep — commit the loose share-link-integrity file

### Overview

Get `share-link-integrity/plan-brief.md` under version control so it doesn't trip `/10x-archive`'s uncommitted-changes gate.

### Changes Required:

#### 1. Commit the untracked plan brief

**File**: `context/changes/share-link-integrity/plan-brief.md`

**Intent**: The file is finished content that was never committed. Commit it as-is (no edits) so the folder is clean before archiving.

**Contract**: `git add context/changes/share-link-integrity/plan-brief.md && git commit -m "docs(share-link-integrity): add plan brief"`.

### Success Criteria:

#### Automated Verification:

- `git status --porcelain context/changes/share-link-integrity/` produces no output

---

## Phase 2: Archive — no roadmap match (safe, no roadmap side effects)

### Overview

Archive the four folders with no corresponding `Change ID` anywhere in `roadmap.md` — their roadmap-close step is a documented no-op, so there's no shape-mismatch risk here.

### Changes Required:

#### 1. Archive `testing-infra-access-control`

**File**: `context/changes/testing-infra-access-control/`

**Intent**: Fully implemented (0/21 pending), no roadmap slice to close.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "testing-infra-access-control")`. Expect one soft warning (missing impl-review) — select "Continue archiving".

#### 2. Archive `ai-service-contract`

**File**: `context/changes/ai-service-contract/`

**Intent**: Fully implemented (0/18 pending), no roadmap slice to close.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "ai-service-contract")`. Expect the missing-impl-review warning — select "Continue archiving".

#### 3. Archive `data-persistence-quality-gates`

**File**: `context/changes/data-persistence-quality-gates/`

**Intent**: Fully implemented (0/7 pending), no roadmap slice to close.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "data-persistence-quality-gates")`. Expect the missing-impl-review warning — select "Continue archiving".

#### 4. Archive `share-link-integrity`

**File**: `context/changes/share-link-integrity/`

**Intent**: Fully implemented (0/9 pending) once Phase 1's commit lands; no roadmap slice to close.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "share-link-integrity")`. Expect the missing-impl-review warning — select "Continue archiving".

### Success Criteria:

#### Automated Verification:

- `[ ! -d context/changes/testing-infra-access-control ]` and a matching `context/archive/*-testing-infra-access-control/` directory exists
- `[ ! -d context/changes/ai-service-contract ]` and a matching `context/archive/*-ai-service-contract/` directory exists
- `[ ! -d context/changes/data-persistence-quality-gates ]` and a matching `context/archive/*-data-persistence-quality-gates/` directory exists
- `[ ! -d context/changes/share-link-integrity ]` and a matching `context/archive/*-share-link-integrity/` directory exists
- `git log --oneline | grep -c "chore(archive): close"` increased by 4 over this phase

---

## Phase 3: Archive — already `done` in roadmap (idempotent roadmap edits)

### Overview

Archive the seven folders whose roadmap slice already shows `done`. Their roadmap Status sub-edits are no-ops; watch specifically for the `## Done` bullet-append sub-edit on each, since that section is a table (see Critical Implementation Details).

### Changes Required:

#### 1. Archive `canvas-schema` (F-01)

**File**: `context/changes/canvas-schema/`

**Intent**: Fully implemented and reviewed (0/10 pending, has impl-review). Roadmap F-01 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "canvas-schema")`. No warnings expected (impl-review present, 0 pending). Verify the roadmap diff doesn't append a stray bullet under `## Done`.

#### 2. Archive `canvas-dashboard` (S-01)

**File**: `context/changes/canvas-dashboard/`

**Intent**: Fully implemented and reviewed (0/20 pending, has impl-review). Roadmap S-01 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "canvas-dashboard")`. No warnings expected. Verify no stray `## Done` bullet.

#### 3. Archive `s-02` (S-02)

**File**: `context/changes/s-02/`

**Intent**: Fully implemented and reviewed (0/31 pending, has impl-review). Roadmap S-02 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "s-02")`. No warnings expected. Verify no stray `## Done` bullet.

#### 4. Archive `ai-critique` (S-03)

**File**: `context/changes/ai-critique/`

**Intent**: Fully implemented and reviewed (0/22 pending, has impl-review). Roadmap S-03 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "ai-critique")`. No warnings expected. Verify no stray `## Done` bullet.

#### 5. Archive `s-04` (S-04)

**File**: `context/changes/s-04/`

**Intent**: Fully implemented and reviewed (0/30 pending, has impl-review). Roadmap S-04 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "s-04")`. No warnings expected. Verify no stray `## Done` bullet.

#### 6. Archive `agent-hooks` (S-09)

**File**: `context/changes/agent-hooks/`

**Intent**: Fully implemented (0/10 pending, no impl-review). Roadmap S-09 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "agent-hooks")`. Expect the missing-impl-review warning — select "Continue archiving". Verify no stray `## Done` bullet.

#### 7. Archive `product-landing-page` (S-07)

**File**: `context/changes/product-landing-page/`

**Intent**: Fully implemented (0/14 pending, no impl-review). Roadmap S-07 already `done`.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "product-landing-page")`. Expect the missing-impl-review warning — select "Continue archiving". Verify no stray `## Done` bullet.

#### 8. Archive `architecture-evidence` (S-10)

**File**: `context/changes/architecture-evidence/`

**Intent**: Automated checks complete, 4 manual-verification boxes unchecked (agreed acceptable). Roadmap S-10 is **not yet** `done` — this is the one real roadmap flip in this batch.

**Contract**: Invoke `Skill(skill: "10x-archive", args: "architecture-evidence")`. Expect the missing-impl-review warning plus the manual-only-pending warning (labeled "Continue archiving (Recommended)") — select "Continue archiving". Confirm afterward that `## At a glance` and the S-10 item body both flip to `done`, and that the `## Done` sub-edit is skipped (table shape) rather than appending a bullet.

### Success Criteria:

#### Automated Verification:

- `[ ! -d context/changes/canvas-schema ]` .. `[ ! -d context/changes/architecture-evidence ]` — all 7 folders gone from `context/changes/`, each with a matching `context/archive/*-<name>/` directory
- `awk '/^## Done/,/^## /' context/foundation/roadmap.md | grep -v '^## ' | grep -E '^- '` produces no output (no bullet-style lines were appended into the table-shaped `## Done` section)
- `grep -A1 'S-10' context/foundation/roadmap.md | grep -c 'done'` shows S-10 flipped to `done` in the At-a-glance row
- `git log --oneline | grep -c "chore(archive): close"` increased by 7 over this phase

#### Manual Verification:

- Spot-check `context/foundation/roadmap.md`'s `## At a glance` table and `## Done` table by eye — no duplicate rows, no malformed markdown

---

## Phase 4: Manual archive — bootstrap-verification

### Overview

`bootstrap-verification` predates the `change.md` lifecycle and can't go through `/10x-archive`. Move it by hand using its own `bootstrapped_at` date for the destination folder name, matching the skill's naming convention.

### Changes Required:

#### 1. Move the folder

**File**: `context/changes/bootstrap-verification/`

**Intent**: Get this legacy artifact out of `context/changes/` alongside everything else, without inventing a `change.md` it never had.

**Contract**: `git mv context/changes/bootstrap-verification context/archive/2026-05-30-bootstrap-verification && git commit -m "chore(archive): close bootstrap-verification"`. No `change.md` edits (none exists). No roadmap-close step (not a roadmap-tracked slice).

### Success Criteria:

#### Automated Verification:

- `[ ! -d context/changes/bootstrap-verification ]`
- `[ -f context/archive/2026-05-30-bootstrap-verification/verification.md ]`

---

## Phase 5: Verify final state

### Overview

Confirm `context/changes/` matches S-11's outcome and nothing else drifted.

### Changes Required:

None — verification only.

### Success Criteria:

#### Automated Verification:

- `ls -d context/changes/*/ | xargs -n1 basename | sort` outputs exactly `account-deletion` and `archive-completed-changes`
- `git status --porcelain context/changes/ context/archive/ context/foundation/roadmap.md` produces no output (everything committed)
- `awk '/^## Done/,/^## /' context/foundation/roadmap.md | grep -v '^## ' | grep -E '^- '` still produces no output

#### Manual Verification:

- Read through `context/foundation/roadmap.md`'s `## At a glance` and `## Done` tables once more to confirm they read cleanly with no leftover artifacts from this batch

---

## Testing Strategy

### Unit Tests:

- None — this change touches only `context/` documentation/process files, no application code.

### Integration Tests:

- None applicable.

### Manual Testing Steps:

1. After Phase 3, open `context/foundation/roadmap.md` and read the `## At a glance` and `## Done` sections top to bottom.
2. After Phase 5, run `ls context/changes/` and confirm the two expected entries.
3. Spot-check one archived folder (e.g. `context/archive/2026-06-07-canvas-schema/change.md`) to confirm `status: archived` and `archived_at` are set.

## Performance Considerations

None — no runtime code is touched.

## Migration Notes

Not applicable.

## References

- `/10x-archive` skill: `.claude/skills/10x-archive/SKILL.md`
- Roadmap slice: `context/foundation/roadmap.md` — S-11 (`### S-11: Archive completed changes`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Prep — commit the loose share-link-integrity file

#### Automated

- [x] 1.1 `git status --porcelain context/changes/share-link-integrity/` produces no output — c0a2c97

### Phase 2: Archive — no roadmap match (safe, no roadmap side effects)

#### Automated

- [x] 2.1 `testing-infra-access-control` moved to `context/archive/*-testing-infra-access-control/` — df714cc
- [x] 2.2 `ai-service-contract` moved to `context/archive/*-ai-service-contract/` — 32c8907
- [x] 2.3 `data-persistence-quality-gates` moved to `context/archive/*-data-persistence-quality-gates/` — 36241a3
- [x] 2.4 `share-link-integrity` moved to `context/archive/*-share-link-integrity/` — b02ffa3
- [x] 2.5 `git log` shows 4 new `chore(archive): close` commits from this phase

### Phase 3: Archive — already done in roadmap (idempotent roadmap edits)

#### Automated

- [x] 3.1 All 7 folders (`canvas-schema`, `canvas-dashboard`, `s-02`, `ai-critique`, `s-04`, `agent-hooks`, `product-landing-page`, `architecture-evidence`) moved to `context/archive/*-<name>/` — 5d8d136
- [x] 3.2 No stray bullet lines appended under `roadmap.md`'s `## Done` heading — 63030ff
- [x] 3.3 S-10 flipped to `done` in the `## At a glance` table — 63030ff
- [x] 3.4 `git log` shows 8 new `chore(archive): close` commits from this phase

#### Manual

- [x] 3.5 `roadmap.md`'s `## At a glance` and `## Done` tables spot-checked — no duplicate rows, no malformed markdown

### Phase 4: Manual archive — bootstrap-verification

#### Automated

- [x] 4.1 `context/changes/bootstrap-verification/` no longer exists — ac0e5f8
- [x] 4.2 `context/archive/2026-05-30-bootstrap-verification/verification.md` exists — ac0e5f8

### Phase 5: Verify final state

#### Automated

- [ ] 5.1 `context/changes/` contains exactly `account-deletion` and `archive-completed-changes`
- [ ] 5.2 `git status --porcelain` on touched paths is clean
- [ ] 5.3 `roadmap.md`'s `## Done` section still has no stray bullet lines

#### Manual

- [ ] 5.4 Final read-through of `roadmap.md`'s `## At a glance` and `## Done` sections
