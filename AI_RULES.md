# AI Rules (Project Guardrails)

## Canonical sources
- Specs: /docs (see docs/00_INDEX.md)
- Schemas: /schemas
- Prompts: /prompts
- Question bank: /question_bank

## Allowed edits for scaffolding tools
- Tools may generate UI code ONLY under /apps/web
- Tools may generate backend code ONLY under /services/api and /services/worker

## Forbidden
- Do NOT modify /docs, /schemas, /prompts, /question_bank unless the change is intentional and described in the PR.
- Do NOT introduce services or regions outside europe-west2 (London).
- Do NOT add dependencies without noting why in the PR.

## Output requirements
- Any agent output must validate against the JSON Schemas in /schemas.
- No claim without citation unless explicitly marked as an assumption.
