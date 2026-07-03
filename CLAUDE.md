## Agent skills

### Issue tracker

Issues and PRDs live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Audit Check Rules
Breakdown required actions into smaller subtaks and must comply following rules:
- **code quality & architecture check** append to `CODE-AUDIT.md`
- **security vulnerabilities check** append to `SEC-AUDIT.md`
- **runtime & performance leaks check** append to `RUN-AUDIT.md`
- **business logic & state vulnerabilities** append to `BUS-AUDIT.md`
- **compliance & accessibilities check** append to `COM-AUDIT.md`
- **robustness & error handling check** append to `ROB-AUDTI.md`
- File format:
```markdown
Item: 
   Verdict: ✅ Correct
   Notes:
   Required Actions:
```
