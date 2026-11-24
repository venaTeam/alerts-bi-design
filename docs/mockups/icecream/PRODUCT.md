# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Engineers and team leads on each product team. Every week they check their team's alerts and move the team's Grafana alert rules from the old format (v1, "Appchi") to the new standard (v2, "Appchi V2"). The standardization team also looks across all teams.

## Product Purpose
icecream puts two internal tools in one place: alerts-bi, the weekly review of each team's alerts (what fires, what is wrong, how far the team is from the v2 standard), and the alerts-migration tool, which turns a v1 Grafana rule into a v2 rule that meets the standard. Success is a team that can see what to fix and fix it, rule by rule, without switching tools or logging in twice.

## Positioning
One model joins both halves: a team owns Grafana rules, and rules fire alerts. The weekly review shows the alerts; the migration acts on the rules; the "migrated" state comes live from the migration registry, not from the weekly run. Inferred from the existing tools and the conversation, not stated as a slogan by the user.

## Operating Context
- Sign-in with the company LDAP account, checked through Grafana (the same credentials as Grafana).
- One Grafana instance. Rules live in Grafana folders; each team can register its folders.
- Alert data comes from the weekly alerts-bi review (published per team per week). Migration status is live.
- Internal, on-premises (OpenShift, air-gapped). Used at a desk during the work week, not during incidents.

## Capabilities and Constraints
- Teams: everyone sees every team and can create or edit any team (for now). A team has a name, optional v1 operators (free text), optional v2 operators (notification policies starting "Appchi - "), and optional Grafana folder URLs.
- Views per team: Overview (relevant raw numbers only), Action plan, Alerts, Rules, Volume, History (with progress).
- Actions per team: Migrate rules, New v2 rule, Edit v2 rule. Each opens its own page and returns to where the user came from.
- The rule form uses the migration tool's field cards ("cubes"), driven by the alert standard schema (migration-compliance `src/standard/schema.json`).
- Several alerts can come from one Grafana rule; the UI must show when selected alerts share a rule, and migration acts on the rule once.
- Terminology: v1 / Appchi, v2 / Appchi V2, alert rule, folder, notification policy, operator, phase 0 to 2.

## Brand Commitments
- Name: "icecream". Keep the small cone logo.
- Everything else visual may change. Tone is professional and calm, never playful or toy-like.

## Evidence on Hand
- Clickable mock: `index.html` and `app.js` in this folder (sample data only; teams, rules and numbers are invented).
- Real standard schema: `migration-compliance/src/standard/schema.json` (12 fields).
- No real customer data, metrics or quotes; do not invent any.

## Product Principles
- One system, not two tools glued together: rules and alerts share one vocabulary and one status everywhere.
- Every action starts from something the user can see and returns them to it.
- Show only relevant numbers; no walls of figures, boxes or explanatory text.
- Actions must be easy to find: Migrate rules, New v2 rule and Edit v2 rule are always visible inside a team.
