# MoA Infinite Builder CLI (Bootstrap v2 functional)

CLI local-first con loop funcional; ahora soporta routing con Gemini API (con fallback determinista si no hay API key).

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

## API key

Configura tu key como variable de entorno (no se guarda en el repo):

```bash
export GEMINI_API_KEY="<tu_api_key>"
```

## Estado actual

- Structured outputs con validación de schema.
- Patch engine AnchorOps (`insert_after`, `replace_block`, `delete_block`, `replace_regex`) con dry-run/apply.
- Tool gates reales por allowlist (`npm test` activo por default).
- Artefactos de run en `.moa/runs/<runId>/` con `events.jsonl`, `metrics.jsonl`, `patch.json` y reportes de gates.
- Exact cache por `objective + repo_fingerprint` para evitar regeneración repetida.
- `run` usa Gemini cuando `GEMINI_API_KEY` está presente; si falla, aplica fallback determinista.
