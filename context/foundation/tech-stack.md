---
starter_id: 10x-astro-starter
package_manager: npm
project_name: bmc-ai-advisor
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
---

## Why this stack

A solo founder shipping a 3-week after-hours MVP needs a battle-tested, agent-friendly starter that handles auth, database, and edge deployment out of the box — without assembly. The 10x Astro Starter (Astro 6 + React 19 + TypeScript + Supabase + Cloudflare Pages) is the recommended default for the (web-app, js) combination and clears all four agent-friendly quality gates: fully typed, convention-based, well-represented in training data, and well-documented. Supabase covers auth (FR-001, FR-002) and persistent canvas storage with no extra wiring; the Cloudflare edge runtime keeps the shared read-only link (FR-011, FR-012) fast globally. AI canvas generation and critique (FR-007, FR-010) use an OpenAI-compatible SDK pointed at one of two backends — **OpenRouter** (`openrouter.ai/api/v1`, multi-model gateway for testing Claude, GPT-4o, Gemini, Llama, etc.) or **OpenAI directly** (`api.openai.com/v1`, GPT models). The active backend is selected by setting `AI_PROVIDER=openrouter|openai` and the corresponding key (`OPENROUTER_API_KEY` or `OPENAI_API_KEY`). No application code changes are needed to switch — only env vars. No self-hosted model required, consistent with the PRD non-goal. CI runs on GitHub Actions with auto-deploy-on-merge, matching the starter's default shape and the solo workflow.
