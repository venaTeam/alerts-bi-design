# Action plan mocks (proposal, 2026-11-15)

Mocks for [Epic A: Portal action plan](../../epics/EPIC-A-portal-action-plan.md) and
[Epic B: Migration service integration](../../epics/EPIC-B-migration-integration.md). They
are a proposal, not accepted design; the epics and, once accepted, `docs/alerts_bi_design.md`
are authoritative.

Open them from a local HTTP server:

```bash
python -m http.server 8232 --directory docs/mockups/action-plan
```

| Page | What it is |
|---|---|
| `portal-functional.html` | Clickable portal team page for a large team (764 alerts). Delete, quiet with the wait-time replay, review a draft, migrate, side by side, collectors and OEM. |
| `admin-senders.html` | Clickable admin "Senders" page: sender rules, the rule editor with a live preview, and the discovery list. |
| `portal-small-team.html` | Static portal page for a small team, built from the seeded Notifications Service week ending 2026-08-24. |
| `portal-large-team-static.html` | Earlier static version of the large-team page. Kept for comparison; `portal-functional.html` supersedes it. |

## Read this before using them

- **Data is invented**, except the small-team page. Counts, rule names, drafts and verdicts
  are examples.
- **Nothing reaches Grafana.** Buttons change the page only. In the product the portal is
  read-only and every approval and write happens in the migration service.
- **The functional pages are driven by JavaScript** for convenience. The real portal is
  rendered by the server, allows one script per page and must work without it.
- **Styles are written for the mock**, not copied from the apps. Each page carries its own
  `<style>` block. The colour variables are the proposed shared set (Epic A, point 3).
- The two static pages predate two corrections and still show them: they lead with event
  counts, and they ask for impact and runbook during phase 1. The functional page and the
  epics are right: lead with incidents, and leave impact and runbook to phase 2.
- **Where a mock and an epic disagree, the epic wins.** Each epic ends with a table of the
  differences. Known mock errors include a stated mapping from V1 to V2 severities (none
  exists) and "a V2 version exists" as a delete reason.
- Checked at desktop width in light and dark. Phone width and right-to-left are not checked.
