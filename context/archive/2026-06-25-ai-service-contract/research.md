---
date: 2026-06-25T00:00:00+02:00
researcher: Claude Sonnet 4.6
git_commit: 9d1ed15b9ab3a032871e4696efd88347aac74003
branch: testing-infra-access-control
repository: Project
topic: "AI service contract and error handling — Phase 3 oracle derivation"
tags: [research, ai-service, risk-1, risk-6, testing, react-unit, integration]
status: complete
last_updated: 2026-06-25
last_updated_by: Claude Sonnet 4.6
---

# Research: AI service contract and error handling

**Date**: 2026-06-25  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: `9d1ed15b9ab3a032871e4696efd88347aac74003`  
**Branch**: `testing-infra-access-control`  
**Repository**: Project

## Research Question

What does the AI service do, where does each risk live, what is the oracle for both risks, and what does Phase 3 need to install or configure to make both test types work?

---

## Summary

**Risk #1** (structured output): `generateBMCCanvas()` in `src/lib/services/ai.ts` uses OpenAI structured output (`json_schema` + `strict: true`) and validates the parsed result through a Zod schema. The oracle is: all 9 `BMC_KEYS` are present as string values in the API response body. The key gap is that `critiqueBMCCanvas()` — also in `ai.ts` — does NOT run Zod validation; its output is a bare type assertion.

**Risk #6** (error recovery): two separate components handle AI failures.

- `NewCanvasForm.tsx` handles `POST /api/canvases` failures: non-201 response triggers an inline red error paragraph; `fetch` rejection triggers a "Network error" message. The loading state uses button label text ("Generating…"), not a spinner element.
- `CanvasEditor.tsx` handles `POST /api/canvases/{id}/critique` failures: any non-OK response or thrown rejection sets `critiqueStatus = "error"` and renders the string `"Critique failed — try again"`. Blocks state is untouched.

**Infrastructure gaps**: MSW, `@testing-library/react`, and a jsdom Vitest project are not installed. Integration tests (Risk #1) could avoid MSW if the OpenAI client is mocked at the module level — but that would bypass the Zod parse path. React unit tests (Risk #6) cannot run in the workerd pool and require a separate Vitest project with `jsdom` or `happy-dom`.

---

## Detailed Findings

### 1. AI service module (`src/lib/services/ai.ts`)

The module exports two AI functions. Both share the same OpenAI client configuration (OpenRouter base URL, `OPENROUTER_API_KEY`).

#### `generateBMCCanvas(idea: string)` — the Risk #1 subject

**Location**: `src/lib/services/ai.ts:121–160`

Call chain: `POST /api/canvases` (`src/pages/api/canvases/index.ts:40`) → `generateBMCCanvas(idea)` → `client.chat.completions.create(...)` → OpenRouter API at `https://openrouter.ai/api/v1`.

Structured output enforcement has two layers:

1. **JSON Schema enforcement** (`ai.ts:130–144`): uses `response_format: { type: "json_schema", json_schema: { name: "bmc_canvas", strict: true, schema: BMC_SCHEMA } }`. `BMC_SCHEMA` at `ai.ts:18–34` declares all 9 BMC keys as `required` strings with `additionalProperties: false`. With `strict: true`, the model API guarantees the schema is honored before the response is returned.

2. **Zod validation** (`ai.ts:158–159`): after `JSON.parse(content)`, the result is passed through `aiCanvasSchema.parse(parsed)`. The Zod schema (`ai.ts:36–46`) validates `name: z.string()` and all 9 BMC keys as `z.string()`. If a key is missing or not a string, Zod throws `ZodError`.

Failure modes and what they throw:

- Empty or null `choices[0].message.content`: `throw new Error("Empty response from AI")` (`ai.ts:157`)
- Malformed JSON: `JSON.parse` throws `SyntaxError`
- Missing or wrong-typed key: Zod throws `ZodError`
- Network failure to OpenRouter: the OpenAI SDK throws its own error
- Missing API key: `throw new Error("OPENROUTER_API_KEY is not configured…")` (`ai.ts:83–85` / `ai.ts:122–126`)

The API route (`index.ts:41–44`) wraps the call in `try/catch` and returns `{ status: 500, body: { error: "AI generation failed" } }` on any throw.

#### `critiqueBMCCanvas(blocks: CanvasBlocks)` — a gap, not the Risk #1 subject

**Location**: `src/lib/services/ai.ts:82–119`

Also uses `response_format: json_schema` with `strict: true` and `CRITIQUE_SCHEMA`. However, after parsing the response, it does `return JSON.parse(content) as CanvasCritique` — a **bare type assertion with no Zod validation**. If the model returns a malformed object (missing `category`, wrong enum value), the function returns it silently. This is outside the scope of Phase 3 (which targets `generateBMCCanvas` for Risk #1), but should be noted as a future gap.

### 2. The 9 BMC block keys — canonical source

**Location**: `src/lib/services/ai.ts:6–16` (`BMC_KEYS` const array)

```
key_partners, key_activities, key_resources, value_propositions,
customer_relationships, channels, customer_segments,
cost_structure, revenue_streams
```

Also reflected in: `src/types.ts:3–12` (`BMCBlockKey` union type) and `CanvasEditor.tsx:18–28` (`ALL_BLOCK_KEYS` array). The `BMC_KEYS` array in `ai.ts` is the authoritative source that drives both `BMC_SCHEMA` (JSON Schema for structured output) and `aiCanvasSchema` (Zod schema for runtime validation).

### 3. API route for canvas creation (`POST /api/canvases`)

**Location**: `src/pages/api/canvases/index.ts`

Full flow:

1. Auth guard: 401 if `context.locals.user` absent (`index.ts:13–15`)
2. Body parse + Zod validation: `idea` must be a string, 10–2000 chars (`index.ts:8–33`)
3. `generateBMCCanvas(idea)` — try/catch → 500 on failure (`index.ts:39–44`)
4. Supabase INSERT: stores `{ owner_id, name, blocks, idea }` (`index.ts:56–65`)
5. Returns `{ id, name, blocks }` with status 201 (`index.ts:72`)

The blocks are written to the DB as the `blocks` column (JSONB). The `name` is stored separately.

### 4. `NewCanvasForm.tsx` — Error handling for Risk #6 (generation path)

**Location**: `src/components/NewCanvasForm.tsx`

State model: `status: "idle" | "loading" | "error"` and `errorMessage: string` (`NewCanvasForm.tsx:4–9`).

`handleSubmit` (`NewCanvasForm.tsx:11–37`):

- Sets `status = "loading"` immediately on submit
- On non-201 response: tries to parse error JSON; falls back to `"Failed to generate canvas. Please try again."`, sets `status = "error"` (`NewCanvasForm.tsx:23–32`)
- On fetch throw (network error): sets `errorMessage = "Network error. Please check your connection and try again."`, `status = "error"` (`NewCanvasForm.tsx:33–36`)

Error display: `{status === "error" && <p className="text-sm text-red-400">{errorMessage}</p>}` at `NewCanvasForm.tsx:57`.

Loading indicator: button text changes to `"Generating…"` while `isLoading`. **There is no spinner element** — only the button label. This means there is no risk of a perpetual spinner; the catch block always transitions the status away from `"loading"`.

Canvas data preservation: `NewCanvasForm` shows no canvas content — only the idea input textarea. Once the error occurs, the `idea` textarea value is preserved (state not reset), so the user can retry.

### 5. `CanvasEditor.tsx` — Error handling for Risk #6 (critique path)

**Location**: `src/components/CanvasEditor.tsx`

State model: `critiqueStatus: "idle" | "loading" | "error"` (`CanvasEditor.tsx:35`). Canvas blocks live in separate `blocks` state (`CanvasEditor.tsx:107`).

`runCritique()` (`CanvasEditor.tsx:161–176`):

- Sets `critiqueStatus = "loading"` at entry (`line 162`)
- Awaits `saveBlocks` (auto-saves current blocks before critique)
- `fetch` to `POST /api/canvases/${canvas.id}/critique`
- If `res.ok`: parses JSON as `CanvasCritique`, sets `critique` state, sets `critiqueStatus = "idle"` (`lines 167–169`)
- If `!res.ok` (non-2xx): sets `critiqueStatus = "error"` (`line 171`)
- Catch block (fetch throws): sets `critiqueStatus = "error"` (`line 173`)

Error display: `{critiqueStatus === "error" && <span className="text-sm text-red-400">Critique failed — try again</span>}` at `CanvasEditor.tsx:209`.

Loading indicator: `critiqueButtonLabel` at `CanvasEditor.tsx:196–197` resolves to `"Analysing…"` when `critiqueStatus === "loading"`. The button itself is `disabled={critiqueStatus === "loading"}` (`line 215`). **No perpetual spinner**: the catch block sets `critiqueStatus = "error"`, which changes the button label to `"Run Critique"` or `"Re-run Critique"` and re-enables it.

Canvas blocks on error: the `blocks` state (`CanvasEditor.tsx:107`) and `critique` state (`line 110`) are fully independent. A failed critique call never touches `blocks`. Existing critique state (`critique`) is also preserved — `setCritique` is only called on success.

### 6. Existing test infrastructure

**Vitest config** (`vitest.config.ts`): uses `@cloudflare/vitest-pool-workers` (`cloudflareTest` plugin) pointing to `dist/server/wrangler.json`. All tests run inside workerd (Cloudflare's local runtime). The Supabase CJS bundle workaround pre-bundles `@supabase/auth-js`, `@supabase/functions-js`, `@supabase/realtime-js`, `@supabase/ssr` to avoid ESModule/CJS mismatch in workerd.

**Global setup** (`tests/global-setup.ts`): `loadEnv` reads `.env` and provides `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` via Vitest `inject`.

**Helpers available**:

- `tests/helpers/setup.ts`: `createTestUser`, `deleteTestUser`, `createTestCanvas`, `deleteTestCanvas`, `canvasExists`, `createTestShareLink`, `deleteTestShareLink`
- `tests/helpers/auth.ts`: `getAuthCookies(email, password)`

**Not installed**: MSW, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `happy-dom`.

**Architectural constraint**: The existing workerd pool is incompatible with `@testing-library/react`. React component tests need a DOM environment (jsdom or happy-dom) running in Node.js. This requires a separate Vitest _project_ config in `vitest.config.ts` using `{ environment: "jsdom" }` and no `cloudflareTest` plugin. Vitest's `projects` array supports multiple pools in one config file.

---

## Code References

- `src/lib/services/ai.ts:6–16` — `BMC_KEYS` — canonical 9-key array; drives both JSON Schema and Zod schema
- `src/lib/services/ai.ts:18–34` — `BMC_SCHEMA` — JSON Schema for OpenAI structured output
- `src/lib/services/ai.ts:36–46` — `aiCanvasSchema` — Zod schema for runtime parse validation
- `src/lib/services/ai.ts:121–160` — `generateBMCCanvas` — full generation function including Zod parse
- `src/lib/services/ai.ts:82–119` — `critiqueBMCCanvas` — critique function; NO Zod validation (gap)
- `src/lib/services/ai.ts:153–159` — empty-content guard + Zod parse call
- `src/pages/api/canvases/index.ts:39–44` — AI call site with try/catch; returns 500 on failure
- `src/pages/api/canvases/index.ts:12–15` — auth guard (401)
- `src/pages/api/canvases/[id]/critique.ts:65–71` — critique AI call site with try/catch
- `src/components/NewCanvasForm.tsx:11–37` — `handleSubmit` with full error handling
- `src/components/NewCanvasForm.tsx:57` — error paragraph render (`"text-red-400"`)
- `src/components/CanvasEditor.tsx:35` — `CritiqueStatus` type
- `src/components/CanvasEditor.tsx:161–176` — `runCritique` function
- `src/components/CanvasEditor.tsx:196–197` — `critiqueButtonLabel` computed value
- `src/components/CanvasEditor.tsx:209` — `"Critique failed — try again"` render
- `src/types.ts:3–12` — `BMCBlockKey` union type
- `tests/helpers/setup.ts:30–38` — `createTestCanvas` (re-usable in Phase 3 integration test)
- `vitest.config.ts` (root) — workerd-only config; needs `projects` split for React unit tests

---

## Architecture Insights

### Two-layer enforcement for Risk #1

`generateBMCCanvas` has defense-in-depth: the OpenAI `strict: true` JSON Schema enforcement at the API level is backed by Zod validation on the parsed response. This means:

- A fixture that passes `strict` schema validation will still exercise the Zod path if any key is missing or mis-typed.
- A test that only checks the API response status is insufficient — it must also inspect the response body keys.

However, the Zod schema uses `z.string()` not `z.string().min(1)`. The PRD requirement is "non-empty string values", but the current runtime guard does not enforce non-emptiness. The test oracle (from the PRD) is stricter than what Zod enforces. This means a fixture test that injects a response with all 9 keys as empty strings `""` would pass Zod but violate the PRD guarantee. This divergence should be documented in the plan and may indicate a code gap to fix alongside the tests.

### Single catch block covers perpetual-spinner risk

Both `NewCanvasForm` and `CanvasEditor.runCritique` use standard `try/catch` around the `fetch` call. Because `status` / `critiqueStatus` transitions to `"error"` in the `catch` block, there is no code path where a promise rejection leaves the component stuck in `"loading"`. The observable behavior to assert in tests: after a rejected fetch, the error message is visible AND the loading indicator (button label) is gone.

### workerd vs jsdom: two Vitest projects required

The existing integration tests use `SELF.fetch` from `cloudflare:test`, which is only available inside the workerd pool. React unit tests using `@testing-library/react` need `render()`, `screen`, and a real DOM — only available in jsdom/happy-dom. These cannot share a pool. The plan for Phase 3 must add a second Vitest project entry (e.g., `{ name: "unit", environment: "jsdom", include: ["tests/unit/**"] }`) alongside the existing workerd project.

### Risk #1 mock boundary choice

The test-plan cites MSW for the HTTP mock boundary. An alternative is `vi.mock('@/lib/services/ai', ...)` to stub `generateBMCCanvas` entirely — but this skips the Zod parse path (the actual validation risk). The right boundary is the outgoing `fetch` call to OpenRouter, so the real `generateBMCCanvas` code runs with a fixture HTTP response. In the workerd environment, this can be done by spying on `globalThis.fetch` within the test. If the test runs in a Node.js project instead, MSW is the natural fit. The plan should decide which environment hosts the Risk #1 test and document the boundary clearly.

---

## Historical Context

- `context/changes/ai-critique/plan.md` — documents the `critiqueBMCCanvas` implementation and the critique UI. The plan relied on manual testing only for AI behavior (Phases 2 and 3 of that change). No automated AI response tests were written. This is the direct predecessor to what Phase 3 here adds.
- `context/changes/ai-critique/plan.md:9` — confirms `generateBMCCanvas` already used the strict JSON schema pattern before critique was added; `CRITIQUE_SYSTEM_PROMPT` and `CRITIQUE_MODEL` follow the same module-level constant pattern.
- Phase 1 (`context/changes/testing-infra-access-control`) and Phase 2 (`context/changes/share-link-integrity`) established the `SELF.fetch` integration test pattern, `createTestCanvas`, and the Supabase CJS bundle workaround. Phase 3 inherits all of this infrastructure.

---

## Open Questions

1. **Where should the Risk #1 integration test live?** If it runs in workerd (like Phases 1 and 2), the fetch spy approach works but is non-standard. If it runs in a Node.js project, MSW is cleaner but requires a new Vitest project. The plan must pick one.

2. **Should `z.string().min(1)` be added to `aiCanvasSchema`?** The PRD oracle is "non-empty string values", but the current Zod schema only requires `z.string()`. Adding `.min(1)` would close the gap between the test oracle and the runtime guard — and is a one-line change in `ai.ts`. The plan should decide whether to include this fix in Phase 3.

3. **Should `critiqueBMCCanvas` get Zod validation?** Currently a bare type assertion. Phase 3 focuses on `generateBMCCanvas` (Risk #1), but noting this gap for a future phase is appropriate.

4. **`OPENROUTER_API_KEY` availability in test environment**: The global setup (`tests/global-setup.ts`) provides Supabase credentials via `inject`. A Risk #1 integration test must NOT reach OpenRouter, so the mock must intercept before the key is checked — or the key must be set to a dummy value in the test environment (`.env` or CI secret).
