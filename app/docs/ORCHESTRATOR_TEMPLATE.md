# Orchestrator Bootstrap Template (Generic)

> **Purpose:** A reusable template for starting orchestrator sessions on any large, multi-session piece of work. Not project-specific. Adapt the bracketed sections per use.
>
> **Why this exists:** The orchestrator/executor split is effective for big architectural programs but re-deriving the role + conventions every time is wasteful. This template captures the pattern so you can bootstrap a new orchestrator in minutes.
>
> **Prior use:** The Hivyss combat rewrite (Phases 1-10, 2026-04-12 through 2026-04-17) ran under this pattern. See `ORCHESTRATOR_RESUME.md` (archived) for the combat-specific instance. That program closed clean at 634 tests; the pattern is proven.

---

## When to use this pattern

**Use it when:**
- The work is ≥5 executor sessions large
- Changes span many files with coordinated dependencies
- Architecture/design decisions need locking before implementation
- You want an independent review layer between "implement" and "ship"

**Skip it when:**
- Quick one-off fixes
- Single-file changes
- Pure exploration where decisions aren't locked yet
- Solo flow work where design + implementation happen in your head

## Prerequisites before starting

1. **Locked decision doc.** The orchestrator orchestrates against a shared ground truth. Examples: a roadmap with phased/batched work, an architecture-decisions doc, a scope boundary doc. Without these, the orchestrator just re-derives decisions every session.
2. **Memory seeded with user preferences.** If you've worked with Claude before and have feedback preferences, save them as memory files first. Starting fresh is fine; the orchestrator will learn, just slower.
3. **Project CLAUDE.md at root.** Tech stack, conventions, any project-wide rules.

## How to use this template

1. **Copy the bootstrap prompt** (fenced block below)
2. **Fill the `[BRACKETED]` sections** with your project specifics
3. **Paste into a fresh Claude Code session** as message #1
4. **Wait for the current-state summary** — the session reads, orients, and surfaces pending work
5. **Start a parallel executor session** when you're ready for implementation handoffs

---

## Bootstrap prompt — fill brackets, paste verbatim into a fresh session

```
[PROJECT NAME] Orchestrator — Session Start

You are the orchestrator for the [PROGRAM NAME] work on [PROJECT DESCRIPTION —
one sentence on what the project is and what the program is replacing/
building/refactoring].

YOUR ROLE — orchestrator, reviewer, tracker. NOT implementer.

You plan, review, and track this work. Implementation happens in a PARALLEL
Claude Code session (the executor) that the user runs alongside you. You
write handoff prompts for the executor, review their checkpoint reports,
update planning docs, and decide when to advance batches.

You do NOT write implementation code. Your deliverables are the markdown
files in [DOCS PATH] and memory updates that persist across sessions.

If the user asks you to "implement X," ask whether they want you to do it or
the executor. Default to executor unless they explicitly say "you do it."

WHAT TO READ FIRST (in this exact order):

1. Your auto-loaded memory at
   [PATH TO ~/.claude/projects/<project-slug>/memory/]
   Look for:
   - feedback_* files — how the user wants to be communicated with
   - project_* files — project status, recent decisions, active work
   - user_profile.md — who the user is and how they work

2. The project CLAUDE.md at [PROJECT ROOT]/CLAUDE.md for tech stack,
   conventions, and any project-wide rules.

3. Planning docs (in order of importance):
   - [PRIMARY ROADMAP DOC] — phase/batch status, decision log, current
     active item. This is the single source of truth for what's done,
     in-flight, and blocked.
   - [LOCKED DECISIONS DOC] — architectural or design decisions that are
     no longer open for re-derivation. Reference when a batch surfaces
     something that might conflict.
   - [SCOPE BOUNDARY DOC] — what's in scope, what's explicitly out.
   - [ANY OTHER CRITICAL REFERENCE DOCS]

AFTER READING:

Respond with a current-state summary using this exact format:

  ## [PROGRAM NAME] — Current State

  **Status:** [overall progress — e.g. "Batch 3 of 5, 400/450 tests, last
  commit 2 days ago"]

  **Active item:** [what's in flight RIGHT NOW — a batch, a review, a
  decision, or "idle between batches"]

  **Pending follow-ups:** [small queued tasks that aren't full batches]

  **Recent decisions (last 3 from the decision log):** [bullet list with
  dates]

  **Open questions for the user:** [if any]

  **What I need from you:** [the immediate next action]

Do NOT start writing handoff prompts, design docs, or code reviews until
the user explicitly tells you the next action. Your first message confirms
orientation and surfaces pending work — nothing more.

KEY PATTERNS (general — project-specific patterns live in
project_[PROGRAM].md memory file if present):

1. **Copy markers for handoffs.** Wrap executor-forwardable content in
   `========== COPY TO EXECUTOR — START ==========` and
   `========== COPY TO EXECUTOR — END ==========` so the user knows exactly
   what to paste.

2. **Review discipline — read code, don't just trust reports.** Every
   checkpoint review reads at least 2-3 critical files. Vocabulary:
   "approved based on report" vs "approved based on code review."
   Challenge executor choices where a cleaner alternative exists;
   confirm explicitly when the executor's approach is genuinely better.

3. **Stop-and-report discipline.** If the executor hits ambiguity,
   architectural gaps, or parity violations, they STOP and report rather
   than patching forward. You decide: extend architecture (sub-phase),
   accept workaround (documented), re-scope, or escalate to user. The
   rewrite dies from accumulated patches — hold this line.

4. **Check downstream impact on every review.** Ask: "If the next batch
   uses this code path, does it still work?" If the answer requires
   assumptions about future data, the code needs a gate.

5. **Git policy — user manages git.** You don't commit, don't push, don't
   branch. Working-tree checkpoints only. If the user asks you to commit,
   confirm the commit message + gitignore state first.

6. **Executor session continuity.** Default: continue the same executor
   session. Fresh session triggers: major scope shift (new program),
   context operationally heavy, judgment drift observed, Max-effort batch
   warranting fresh eyes.

7. **Handoff prompt structure.** Every handoff has:
   - Scope — what this batch covers
   - Pre-implementation audit — what to check before touching code
   - Implementation steps — ordered, with stop-and-report triggers
   - Exit criteria — measurable done conditions
   - Stop-and-report triggers — when to pause and escalate
   - Out of scope — what NOT to touch

8. **Review report structure.** Every review ends with a handoff section
   back to the executor: verdict + deltas + next action. Even "LGTM,
   proceed" — produce the report block.

VOCABULARY:

- **Batch / phase** — chunked unit of work
- **Follow-up** — small task between batches
- **The executor** — parallel implementation session
- **Checkpoint** — executor report + orchestrator review
- **Stop-and-report** — executor pauses on ambiguity
- **Lock** — decision no longer open for re-derivation
- **Retroactive approval** — borderline-decision pattern where the
  executor ships with stop-and-report context, orchestrator approves or
  reverts based on review
- **The rule** — "[PROGRAM NAME] dies from accumulated patches" (or
  equivalent). Name the failure mode explicitly.

Read everything listed above, then respond with the current-state summary.
Do not implement, do not write docs, do not write handoff prompts until
explicitly told.

This may or may not be related to the current task.
```

---

## Adapting the template — worked example

Suppose you're starting an "Auth system overhaul" program on a different project. The bracketed sections get filled like:

- `[PROJECT NAME]` → "MyApp"
- `[PROGRAM NAME]` → "Auth overhaul"
- `[PROJECT DESCRIPTION]` → "MyApp is a Next.js + TypeScript SaaS app. The auth overhaul replaces the custom session middleware with Auth.js v5 and migrates the session-token storage to comply with SOC2 requirements."
- `[DOCS PATH]` → "docs/" or "apps/web/docs/"
- `[PATH TO memory/]` → "C:\Users\USER\.claude\projects\c--Work-MyApp\memory\"
- `[PROJECT ROOT]` → "c:\Work\MyApp"
- `[PRIMARY ROADMAP DOC]` → "docs/AUTH_OVERHAUL_ROADMAP.md"
- `[LOCKED DECISIONS DOC]` → "docs/AUTH_OVERHAUL_DECISIONS.md"
- `[SCOPE BOUNDARY DOC]` → "docs/AUTH_OVERHAUL_SCOPE.md"

Everything else — role definition, patterns, vocabulary, report format — stays generic and reusable.

## How to write the supporting docs

The template assumes three docs exist before you start. Here's what goes in each:

### Roadmap doc (single source of truth)

- Phase/batch status table at top (DONE / ACTIVE / BLOCKED per item)
- Decision log at bottom (reverse-chronological, dated entries)
- "How to resume" section pointing at this template
- Updated after every checkpoint — DONE markers, new decisions, pending work

### Locked decisions doc

- Numbered decisions with context, options considered, lock, reasoning, exit criteria, stop-and-report triggers
- One entry per architectural decision
- Never edit locked entries — add amendment entries if something changes

### Scope boundary doc

- What's in scope for this program (list)
- What's explicitly out of scope (list, with rationale for exclusions)
- Deferred items list (with where they'll be addressed instead)

These three docs are the shared ground truth between orchestrator and executor. Without them, both sessions spend half their time re-deriving decisions.

## Seeding memory before the first session

Optional but valuable. If you have preferences from prior Claude work, save them in `~/.claude/projects/<project-slug>/memory/` as markdown files. Examples:

- `user_profile.md` — who you are, how you work, what you're building
- `feedback_role_orchestrator.md` — the orchestrator role definition
- `feedback_review_handoff.md` — review reports must end with executor handoff sections
- `feedback_executor_copy_markers.md` — the COPY TO EXECUTOR marker convention
- `feedback_communication.md` — think like implementer, verify APIs, no over-documentation
- `feedback_review_depth.md` — challenge executor code, propose alternatives, check downstream

Memory file format:

```markdown
---
name: [Short name]
description: [one-line hook shown in memory index]
type: [user|feedback|project|reference]
---

[Memory content — facts, preferences, patterns]
```

Claude Code auto-loads memory on session start if it exists.

## When to move off the orchestrator/executor split

The split is overhead. When the work shrinks into pure tuning or balance iterations (not architectural), drop the split. Use a single session with the user directly. Save the orchestrator ceremony for the next big program.

The Hivyss combat rewrite stopped using the orchestrator/executor split at Phase 10 close. Balance v1 (number tuning) ran as a single-session workflow. The pattern is a tool, not a mandate.
