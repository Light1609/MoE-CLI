# MoA Infinite Builder CLI (Bootstrap v2 functional)

CLI local-first con loop funcional. Por defecto corre en modo determinista (simple y estable); Gemini es opcional.

## Modelos configurados

- `gemini-3.1-pro-preview` (arquitectura/contratos)
- `gemini-3.1-flash-lite-preview` (normalización/review)
- `gemini-3-flash-preview` (implementación)

## Quick start

```bash
node src/cli.js init
node src/cli.js plan "crear módulo auth"
node src/cli.js run "implementar endpoint"
node src/cli.js verify
node src/cli.js apply --patch <runId>
node src/cli.js cache stats
node src/cli.js cache clear
node src/cli.js doctor
```

## Modo LLM opcional

Por defecto `run` usa modo determinista. Para activar Gemini:

```bash
export MOA_USE_LLM=1
export GEMINI_API_KEY="<tu_api_key>"
```

## Estado actual

- Structured outputs con validación de schema.
- Patch engine AnchorOps (`insert_after`, `replace_block`, `delete_block`, `replace_regex`) con dry-run/apply.
- Tool gates reales por allowlist (`npm test` activo por default).
- Artefactos de run en `.moa/runs/<runId>/` con `events.jsonl`, `metrics.jsonl`, `patch.json` y reportes de gates.
- Exact cache por `objective + repo_fingerprint` para evitar regeneración repetida.
- `run` usa modo determinista por defecto. Con `MOA_USE_LLM=1` + `GEMINI_API_KEY`, intenta Gemini y si falla aplica fallback determinista.
