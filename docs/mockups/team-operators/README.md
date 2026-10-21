# Team operators mock (proposal, 2026-10-21)

Proposal: show the team's operators on the team page in both the admin console and the review
portal. Operators are the registry's `v1_operators` and `v2_operator` values
(`contracts/teams.schema.json`) that route alerts to the team. This is a mock for review. It is
not an accepted design decision and changes no behavior.

Open the pages from a local HTTP server, so the stylesheet and script load:

```bash
python -m http.server 8231 --directory docs/mockups/team-operators
```

Then open `http://localhost:8231/admin.html` and `http://localhost:8231/portal.html`. The yellow
bar at the top belongs only to the mock: it switches between four sample teams (v1 only with a
registry change since the run, v2 only, migrating with many operators, no operators).

The stylesheets are copies of admin `fb87c91` (shared `STYLESHEET` + `CONSOLE_CSS`) and portal
`203fd7a` (`STYLESHEET`), so the pages look like the real apps. Each page's own `<style>` block
holds the proposed new rules.

## What the mock shows

**Admin console, team page.** An "Operators" panel between the header and the week's
Run/Review/Publish steps:

- v1 operators as exact values (all of them, with a count) and the v2 operator, or "None" /
  "Not set yet".
- The current registry version and effective date.
- A note when the selected week's run froze a different registry version, listing what that run
  used, because the console's list is the current registry.
- A note when the team has no operators (a run finds no alerts).
- A line when an operator is also listed for another team (the schema allows repeats).

**Review portal, team week (Overview tab).** An "Operators" card in the side column, below Phase:

- v1 and v2 operators that this published week was run with (its frozen registry snapshot), not
  the current registry, so the list always explains the alerts on the page.
- The first six values, then "Show N more".
- An empty state when the review listed no operators.

## Decisions needed before implementation

1. **Admin source.** Show the current registry (as mocked) or the selected run's snapshot first?
2. **Portal data.** The portal reads only `portal_*` views, and none exposes operators today. It
   needs a view column or a new view with the published run's frozen operators. Admin owns that
   migration, and it changes the admin-to-portal SQL contract.
3. **Exposure.** Showing operator values to every portal reader is a new disclosure. Confirm that
   operator values are fine to publish read-only to the teams.
4. **Naming.** In this project "operator" also means the person using the console (migration
   `019_erase_operator_names`). The panel's helper text says these are alert operator values.
   Should the heading be "Alert operators" instead?
5. **Placement.** Should the portal show it on every tab or only on Overview (as mocked)? Should
   the admin team cards on `/` show an operator count too?
