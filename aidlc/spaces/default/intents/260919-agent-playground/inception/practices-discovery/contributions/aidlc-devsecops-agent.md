**Collaborator:** aidlc-devsecops-agent

## Contribution

Independent inspection focused on lint/format, SAST/DAST, secret and dependency scanning, and supply-chain controls. I re-verified the lead's absence findings directly (not just via CodeKB) and inspected `docs/SAFETY.md` and `apps/api/src/app.ts` for the policy/audit model's actual enforcement surface, since this is a health-adjacent app for seniors/caretakers.

### 1. Confirmed: zero automated security tooling of any kind

Direct inspection confirms, beyond the lint/CI gaps the lead already found:
- No `.eslintrc*`, `.prettierrc*`, `eslint.config.*`, or `.editorconfig` anywhere (root or any package).
- No SAST tooling: no CodeQL, Semgrep, SonarQube, or ESLint security-plugin config anywhere in the tree.
- No dependency/supply-chain scanning: no Dependabot (`.github/dependabot.yml` — `.github/` itself doesn't exist), no Renovate config, no `pnpm audit`/`npm audit`/Snyk step in any script or docs. `apps/api/package.json` and `packages/shared/package.json` scripts are limited to `dev`/`start`/`typecheck`/`test` — no `audit` script exists at any level.
- No secret-scanning tooling (gitleaks/trufflehog) configured, though a manual grep for hardcoded API-key-shaped strings (`sk-...`, `apiKey: "..."`) across `apps/` and `packages/` found none — consistent with the lead's "no secrets in git" finding.
- No DAST tooling — expected, given there's no deployed/hosted environment to scan (consistent with lead's Deployment section).

This is a genuine blind spot in the lead's draft as currently scoped: `team-practices.md` and `discovered-rules.md` cover branching, testing, deployment, and code style, but **security tooling as a practice area is absent entirely** — there is no line anywhere stating "no SAST/dependency-scanning/secret-scanning exists." Given this is a health/eldercare-adjacent product with an explicit safety/policy model, that omission should be closed before this artifact is finalized.

### 2. Secrets management — verified good practice, worth stating explicitly

- `.gitignore` excludes `.env` and `.env.local`; only `.env.example` (root, `apps/api/.env.example`, `apps/mobile/.env.example`) is tracked, and every secret-shaped key in it (`ELEVENLABS_API_KEY`, `MODEL_API_KEY`, `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`, `COMPOSIO_API_KEY`) is left **empty** — no placeholder secrets, no real-looking values.
- `apps/api/src/load-env.ts` is a small hand-rolled `.env` parser (duplicated in `apps/mobile/scripts/start-expo.cjs`, per CodeKB) that never overwrites an already-set `process.env` value and fails silently (comment: "No local `.env` is fine; keys can still come from the shell") — no crash-on-missing-secret behavior, which is appropriate for this project's designed-fallback model (missing `MODEL_API_KEY` → rules engine; missing `ELEVENLABS_API_KEY` → 501).
- This confirms the lead's "NEVER commit secrets — use `.env.example` keys only" Forbidden rule is followed in actual practice today, not just documented. I'd promote this from "documented convention" to "verified practice" in `evidence.md`.

### 3. New finding — unauthenticated API surface, not surfaced by the lead or CodeKB

Direct read of `apps/api/src/app.ts` (not covered by the lead's draft or by `code-quality-assessment.md` beyond the CORS line):
- **No authentication or authorization middleware exists on any route.** Every endpoint — including `GET /audit` (full audit log, or filtered by a client-supplied `sessionId` query param) and `GET /sessions/:sessionId` (full session view: current request, pending approval, last booking, **consent state**) — is reachable by anyone who can reach the process, with no API key, bearer token, or session-ownership check.
- `sessionId` is a client-suppliable/guessable string, not a server-issued signed credential — so `GET /sessions/:sessionId` and `GET /audit?sessionId=` amount to an **unauthenticated, enumerable read of another user's health-adjacent session and audit data** if the API is ever reachable beyond localhost.
- Combined with `cors({ origin: "*" })` (already flagged by CodeKB as a technical-debt item, but only as "would need tightening before any non-local deployment" — a soft note, not a blocking constraint), this is a concrete access-control gap, not just a CORS convenience issue. For a project whose own `docs/SAFETY.md` treats "share health information" as requiring "explicit consent and a recipient on an allow-list," an unauthenticated audit/session-read endpoint is in tension with that policy's spirit even if it's in-scope-for-localhost today.
- This is currently **low actual risk** because the only run surfaces are `localhost:3001` and Expo Go on the same LAN (per `AGENTS.md`/README), and there is no deployed environment (confirmed by the lead). But it should be recorded as a **named, must-close-before-deployment precondition**, not left implicit inside "Deployment — entirely unresolved."

### 4. Composio policy/audit bypass — confirm and escalate

I independently confirmed `apps/api/src/composio.ts` and the `/composio/connect` / `/composio/execute` routes in `app.ts`: both validate the request body with Zod (`composioConnectRequestSchema` / `composioExecuteRequestSchema` via `safeParse`) but neither route calls `invokeTool`/`evaluateToolCall`/`auditLog` — Composio-executed Gmail actions bypass the policy engine and audit trail entirely. `ARCHITECTURE.md` self-documents this gap. I agree with the lead that this belongs in the human interview, but given the Mandated rule "ALWAYS write an audit event for every tool invoke" and "NEVER let a tool execute without first going through `evaluateToolCall`" already exist in `discovered-rules.md`, this is not just an open question — **Composio's current behavior actively violates an already-stated Mandated rule**, sourced to the project's own docs. I'd recommend `discovered-rules.md` state this as a known, tracked violation (with a pointer to `ARCHITECTURE.md`'s own callout) rather than only listing it as a code-quality technical-debt item.

### 5. Input validation and design-level defense-in-depth — good, worth keeping as Mandated

- Zod `safeParse`/`.parse` is used consistently at every API boundary I checked (`/health`, `/speech/speak`, `/composio/connect`, `/composio/execute`, `/tools/:name` via `invokeTool`), and malformed-JSON bodies are caught and return `400` rather than throwing. This is a solid input-validation posture and should stay Mandated exactly as the lead drafted it.
- The `docs/SAFETY.md` header's self-declared normativity ("if they disagree, the code is wrong or this file is stale — fix both") between the human-readable policy table and `packages/shared/src/policy.ts` is a good documentation-as-control pattern, but it is **manually enforced only** — there is no automated check (test or CI step) that diffs the two. Recommend flagging this as a future automatable control (e.g., a test that asserts every `docs/SAFETY.md` table row has a corresponding `policy.ts` entry) rather than leaving it purely as a documentation discipline.

### 6. Recommendations for when CI is eventually adopted (contingent on the "CI pipeline adoption" open question)

If the human interview confirms CI is in scope (lead's open question #7), the minimum security gates to bundle in alongside `pnpm typecheck && pnpm test` should be: a dependency-audit step (`pnpm audit --audit-level=high` at minimum, Dependabot/Renovate for ongoing supply-chain hygiene), and — once a linter is adopted (open question #6) — a security-focused lint ruleset (e.g. `eslint-plugin-security` / `eslint-plugin-react-hooks` per the CodeKB's own note). Secret-scanning (gitleaks) in CI is a cheap addition given the current clean baseline. None of this should be presented as mandatory scope for the current intent — only as the shape of the security gate once CI exists.

## Positions

- AGREE: The lead's Forbidden rule "NEVER commit secrets — use `.env.example` keys only" — independently verified: `.env`/`.env.local` are gitignored, only empty-valued `.env.example` files are tracked, and a manual secret-pattern grep across `apps/`/`packages/` found nothing.
- AGREE: The lead's explicit refusal to silently apply the org-level Prettier/ESLint default, flagging the lint/format gap instead of assuming it — this is the right call; I confirmed independently that no linter/formatter config exists anywhere in the tree.
- AGREE: The lead's decision to surface the Composio policy/audit bypass in the open-questions list rather than silently ignore it.
- OBJECT: The draft has no dedicated "Security Tooling" coverage (SAST/DAST/dependency-scanning/secret-scanning) anywhere in `team-practices.md` or `discovered-rules.md` — this should be added as its own subsection (even if the answer is "none configured, confirmed absent") so the gap is explicit rather than only inferable from the CI/lint sections.
- OBJECT: Neither `evidence.md` nor `code-quality-assessment.md`'s CORS note captures that `GET /audit` and `GET /sessions/:sessionId` have **no authentication or session-ownership check** — this is a more concrete finding than "wide-open CORS" alone and should be recorded as a named pre-deployment blocking item, not left implicit under "Deployment — entirely unresolved."
- OBJECT: The Composio policy/audit bypass should be reframed in `discovered-rules.md` as an active violation of the already-stated Mandated rules ("every tool invoke gets an audit event," "no tool executes without `evaluateToolCall`"), not only as a code-quality technical-debt item — it's a security-posture inconsistency the project itself already flags.
