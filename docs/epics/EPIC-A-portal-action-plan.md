# Epic A: Portal action plan

> **Status:** Draft for grooming, revised after review · **Author:** Yarin · **Last updated:** 2026-11-15
> **Owner:** BI Portal developer · **Sibling:** [Epic B: Migration service integration](EPIC-B-migration-integration.md)
> **Mocks:** [`docs/mockups/action-plan/`](../mockups/action-plan/README.md)

Decisions marked **(author's call)** were made while writing, not by the product owner. They
are defaults a builder can plan from and the product owner can overturn.

## Summary

A team that opens its page in the review portal today sees a lot of data and no clear next
step. This epic turns the team page into an action plan: where the team stands on the road
from the old alert format (V1, "Appchi") to the standard (V2), what is wrong, and the few
fixes that clear the most. It works for a team of 10 alerts and for a team of 1,000.

## Problem / opportunity

- The team page spreads its content over seven tabs (Overview, Fix list, Volume, Dashboards,
  Migration, History, Slides). None of them says what to do first.
- Rules are named but not taught. A reader has to know the standard already to act.
- Nothing scales. Some teams have 800 to 1,000 distinct alerts, produced by a much smaller
  number of Grafana rules that share the same problems. The page lists alerts one by one.
- The goal of the project is to get every team off V1. The page does not show that goal or
  how far the team is from it.

Cost of not doing it: teams keep reading a report instead of working a list, and the
migration stays slow and dependent on hand-holding.

## Expected outcome and success metrics

**Project goal (shared with Epic B):** every team's V1 alerts that come from Grafana rules
reach zero by the V1 end-of-life date. *That date is not set yet (open question 1).*

Signals this epic can be judged by, all read from the weekly runs:

| Metric | Direction | Target |
|---|---|---|
| V1 Grafana alerts that fired, per team and in total | Down | Zero by the V1 end-of-life date |
| V1 Grafana rules that fired, per team | Down | Zero by the V1 end-of-life date |
| Alerts in the "delete" and "quiet first" lanes, per team | Down | Zero before a team's migration starts in earnest |
| Share of non-Grafana alerts covered by a sender rule | Up | 100% for teams that have collectors or OEM |

Two limits on these numbers:

- The weekly run only sees alerts that fired. A rule that stayed silent is invisible here.
  Proof of "zero V1 rules" comes from the Grafana inventory in Epic B.
- The portal has no usage analytics, so "people act faster" is not measurable from it.

## Users and personas

- **Team lead and team members (same needs):** read the portal and act on it. They are the
  primary users. A lead and a member see the same thing.
- **Operator (admin console):** runs and publishes weeks, and maintains sender rules.
- **Platform owners (Vena):** track progress across teams.

## Scope

### In scope

1. The redesigned team page in the portal.
2. Grouping alerts by the Grafana rule that produced them.
3. Sorting every V1 alert into one lane.
4. Incidents as the lead measure, with events as a supporting number.
5. Sender rules, so alerts from collectors, Oracle OEM and other providers are recognised
   and grouped.
6. One set of design variables shared by the portal and the admin console, and the UI fixes
   in Appendix A.
7. The design-document changes this needs.

### Out of scope

- Any write to Grafana. The portal stays read-only.
- Model-written drafts, the wait-time replay, the side-by-side comparison and pairing of old
  and new rules. Epic B produces them; this epic reserves the places where they show.
- "A V2 version already exists, delete the old one." It needs Epic B's pairing and is not a
  delete reason in this epic.
- Rebuilding the vCenter and OCUM collectors.
- Phase 2 content (impact and runbook) beyond showing it as "next".

## Functional requirements

### 1. Pages and views

The mock [`portal-functional.html`](../mockups/action-plan/portal-functional.html) is the
reference for layout and wording. It is driven by JavaScript and performs actions in the
page; the product is rendered by the server, works without scripting, and only links out.
Where the mock and this document differ, this document wins (see "Where the mocks differ").

| View | Address | Content |
|---|---|---|
| Action plan | the team week page (replaces Overview) | Review note, headline, bars, "Start here", the moves |
| Lane | one per lane | Every group in that lane, paged. This is where "show the rest" goes. |
| Rule | one per group | Why it is in its lane, the rule quoted, examples, the field table, its alerts |
| All alerts | | Every alert of the week, both formats |
| Progress | | Phases, week cards, the list of all published weeks |
| Slides | unchanged | |
| Side by side | only with Epic B data | Old and new rules being compared |

"The V2 standard" is a panel that opens from every view, not a view of its own.

**Action plan parts**

| Part | What it shows |
|---|---|
| Headline | One sentence: V1 alerts this week and their split across the lanes that are not empty. |
| Bars | One bar per format. V1 is split by lane. V2 is split by "meets the phase 1 standard" or not. Each V1 count links to its lane view; each V2 count links to All alerts filtered. The two formats are never added together. |
| Start here this week | Up to five groups (rule below). |
| The plan | The lanes in order. Each states its payoff and lists its four largest groups, with a link to its lane view. |

**"Start here" (author's call):** take lanes 1 to 4 in order; within a lane, sort groups by
number of alerts, largest first; take at most two per lane, five in total. Lane 5 is never
included, because Grafana rules come first.

**Small teams (author's call):** when a lane holds 10 alerts or fewer, list the alerts
directly instead of groups. Only that idea is taken from
[`portal-small-team.html`](../mockups/action-plan/portal-small-team.html).

**What happens to today's content**

| Today | In the new page |
|---|---|
| Review note | Kept, at the top of the action plan |
| Application filter (2026-10-08) | Kept, applies to every view |
| Operators card (2026-10-21) | Kept, on the Progress view |
| Phase card | Becomes the phase strip on Progress |
| Key findings, loudest alert, firing patterns | Folded into the lanes |
| Hidden and unseen alerts (Dashboards tab) | Hidden alerts are the delete lane. Unseen alerts are marked on the rule and alert pages. |
| Alert page and recorded human decisions | Kept. Reached from the rule page and from All alerts. |
| Week menu | Kept. Its "All weeks" entry goes to the list on Progress. |
| Slides | Kept, unchanged |

### 2. Lanes

A lane is assigned **per alert**, by the first row that applies. Every V1 alert gets exactly
one lane.

| Order | Lane | An alert lands here when |
|---|---|---|
| 0 | 5. Collectors and other senders | A sender rule matches it. Decided first, and exclusive. |
| 1 | 1. Delete | Core finding R2 (status message) or R5 (hidden by the team's own dashboard) |
| 2 | 2. Quiet first | `fire_pattern` is stuck, flapping or spamming |
| 3 | 4. Review, then migrate | Core finding R1 (generic message), R3 (placeholder name), R4 (no rule link) or R7 (bad creation time); or the model's verdict is flagged or needs review |
| 4 | 3. Migrate automatically | None of the above |

- The display order is 1 to 5; the table above is the order of evaluation.
- An alert the model did not assess, with no core finding, goes to "migrate automatically"
  and is marked "not checked by the model" **(author's call)**.
- V2 readiness findings (R8, R9, R10) apply to V2 alerts only and are phase 2. They never
  affect a lane.
- An alert not sent by Grafana that matches no sender rule goes through the same table. Its
  group key is its application, and its action is "change at the sender"
  **(author's call)**. The Senders page lists these so a rule can be added.
- An alert's other findings are still listed on its rule and alert pages.
- "Stuck" and "flapping" copy must come from the stored fields (`open_since`, `last_seen`,
  `max_clear_cycles_24h`). Flapping is 3 or more fire-and-clear cycles in 24 hours.
- **Sender rules do not change the stored findings.** They change the lane only, so the
  ruleset version does not change **(author's call)**. A collector alert flagged as spamming
  still carries that finding; lane 5 explains it once per sender.

**Groups and lanes.** A group is shown in a lane with only its alerts that are in that lane.
One rule can therefore appear in two lanes, each time with a note such as "9 more alerts
from this rule are in Delete". This keeps the lane counts equal to the alert counts.

### 3. Grouping

- For an alert sent by Grafana, the group key is its rule link (`alert_rule_url`),
  normalised: trimmed, without query string or fragment **(author's call)**. Epic B replaces
  this with the rule's Grafana ID and supplies the rule name and folder.
- The link is taken from the alert's latest row. If rows of one alert carry different links,
  the latest wins.
- Until Epic B, a group is displayed by the last part of its link, with the full link as its
  "Open in Grafana" target. There are no folders: "migrate automatically" lists rules.
- Alerts sent by Grafana with no rule link (R4) form one group per application, titled "no
  rule link". They are counted as "alerts with no rule link", never as rules.
- "Rules that fired" counts groups that have a real rule link.
- Past weeks already store the link, so they can be grouped without re-running them.

### 4. Incidents and events

- An incident is one stretch from "fired" to "cleared".
- What is stored today is not enough for an exact count: `clear_count` counts clear rows,
  and fire-to-clear cycles are kept only as a 24-hour maximum.
- **Store an episode count per alert in the new migration (author's call).** For weeks
  analysed before that, show "about N" from `clear_count` plus one when the alert is still
  open, or show events only.
- A group's incidents are the sum over its alerts, worded "N incidents across M alerts". A
  rule-level timeline needs Grafana's history and belongs to Epic B.
- Lead with incidents; keep events, which are real received messages, as a supporting number.

### 5. V2 alerts

V2 alerts have no lanes **(author's call)**.

- "Meets the phase 1 standard" means: no core finding R1 to R7 and no model finding.
  Readiness findings (impact, runbook) do not count against it.
- V2 alerts that do not meet it are listed under the bars as "V2 alerts to fix", grouped by
  the same reasons.
- All alerts shows both formats, with a Format column.

### 6. All alerts

- Columns: format, application, message, rule, incidents, events, what to do.
- Order: incidents, then events, largest first. Page size is the existing portal setting.
  Paging is the existing seek paging.
- Search covers message, application and rule. Filters: format, lane, rule, application.
- Search is a text field in a GET form. Filters are link menus in the one popover pattern.
  The portal tests forbid `<select>` on every team page; keep that rule.
- Every filter is part of the address and survives opening an alert and going back.

### 7. Progress

- The phase strip shows Phase 0, Phase 1, Phase 2 and Done, from the stored phase. A week
  with no data says so and marks no phase.
- A team whose only V1 alerts come from collectors and other senders is shown as "Grafana
  rules done; collectors remain" **(author's call)**.
- Week cards, most recent six: V1 alerts, V1 rules that fired, V2 alerts meeting the phase 1
  standard out of all V2 alerts. A week whose measurement basis changed is marked, as today.
- Below the cards: every published week, as a list of links.
- The wording allowed here needs a design change (below). Until it is accepted, show counts
  only, with no arrows, percentages of change or "fixed" claims.

### 8. Sender rules

Reference: [`admin-senders.html`](../mockups/action-plan/admin-senders.html).

**What a rule is.** A name, a kind (collector; system that sends and clears its own alerts;
other provider), one or more conditions, and a field to group by. Conditions test operator,
application, provider, object, node name or message with "is", "is one of", "starts with" or
"contains". All conditions must hold. Rules are checked in order; the first match wins.

**Matching (author's call unless noted).**

- Values are compared exactly, including upper and lower case, as operators are today
  (design). The mock's script ignores case; that is a mock shortcut.
- A rule is tested against the alert's latest row.
- Rules apply to both formats, so a sender is still grouped after it moves to V2.
- `operator` is not stored per alert today, only inside the stored document. Store it.
- Changing a team's sender rules is a change of measurement basis, like changing its panels.

**Known cases.** The vCenter and OCUM collectors each have a dedicated operator. Oracle OEM
is recognised by `application = "oracle"`. Neither appears in the code or the sample registry
yet.

**In the portal.** A sender's alerts are lane 5, titled "Collectors and other senders",
grouped by the chosen field. Each sender carries one line on how its alerts reach the
pipeline. The lane says to start with Grafana rules.

**Not buildable until decided** (open questions 2, 3, 6):

| Question | Smaller option, recommended as the first step | Larger option |
|---|---|---|
| Where rules live | In the registry file, per team, as operators do. The console shows a read-only Senders page: what each rule caught, warnings, and the discovery list with a rule ready to copy. | Edited in the console and saved. Needs a write path for the registry, signed forms, and a decision about a console with no login. |
| Whose they are | Per team. Each run already freezes its team's registry entry. | Shared across teams. Needs a new snapshot per run. |
| Group-by field | Object, application or message | The field that holds the vCenter alarm name and the OCUM event name, once known |

From the Senders mock, required: the per-rule result, the "too wide" and "matches nothing"
warnings, the discovery list, and the fixed last row "Grafana rules, everything else". Not
required in the first step: reordering buttons, the editor with live preview, and any hint
based on the expiry field, which the engine does not read.

### 9. Places reserved for Epic B

Render these only when the data is present.

| Place | With Epic B data | Without |
|---|---|---|
| Action on a rule or folder | Link to the migration service | "Open in Grafana" |
| Rule name and folder | From Grafana | Last part of the rule link; no folder |
| Review lane, per rule | Drafted V2 message and proposed severity | The rule and its "not this / this" example |
| Quiet lane, per rule | Result per candidate wait time, as a static table | The firing pattern |
| Side by side view; bar segments for "running side by side" and "moved or deleted" | Shown, each labelled with the age of the data | Hidden |
| "A V2 version exists" | Shown once a pair has passed its check | Never shown |

Every button in the mock that changes something maps to one of these links or is hidden. The
portal never offers Keep, Drop, Approve, Pause or Undo itself. Where a team's own decision
is recorded is open question 8.

## User experience

- **Interaction:** web pages only; readers act through links.
- **Vocabulary, fixed once:** lanes are Delete, Quiet first, Migrate automatically, Review,
  Collectors and other senders. The unit is "rule" for Grafana and "group" otherwise.
- **UI fixes:** Appendix A.
- **Errors and empty states:** an empty lane says "nothing left here". A week with no data
  says so. A bad address shows a readable error page, not raw JSON.
- **Design:** no separate design team; the mocks are the agreed direction.

## Acceptance criteria

- [ ] For a published week, every view renders with scripting disabled.
- [ ] Every V1 alert of the week is in exactly one lane, by the table in requirement 2, and
      the lane counts add up to the team's V1 total.
- [ ] A rule whose alerts fall in two lanes appears in both, and each appearance counts only
      its alerts in that lane.
- [ ] V1 and V2 numbers are never added together.
- [ ] A group's alert count equals the number of rows in All alerts filtered to that rule
      and lane.
- [ ] No lane on the action plan lists more than four groups; the rest are on its lane view.
- [ ] Each lane quotes its rule in one sentence, and "The V2 standard" opens from every view.
- [ ] A V2 alert whose only findings are missing impact or runbook counts as meeting the
      phase 1 standard.
- [ ] Search and filters in All alerts are in the address and survive opening an alert and
      going back.
- [ ] With a sender rule in place, its matching alerts are in lane 5 from the next run,
      grouped by the chosen field, and their stored findings are unchanged.
- [ ] The Senders page marks a rule that matches alerts sent by Grafana, and one that matches
      none.
- [ ] Each old address in the redirect table below lands on the stated new address.
- [ ] With the operating system in dark mode, text on the pages listed in Appendix A meets
      WCAG AA contrast, measured with the Lighthouse accessibility audit.
- [ ] Without Epic B data, no empty panel, no side-by-side view and no "V2 version exists"
      reason is shown.
- [ ] The action plan for a team of 1,000 V1 alerts from about 60 rules meets the read
      targets in `docs/read-path-performance.md`.

**Redirects**

| Old address | New address |
|---|---|
| team week page (Overview) | Action plan |
| `/fix`, with `show`, `state`, `schema`, `rule`, `page`, `cursor` | All alerts with the matching format and rule filters; a filter with no equivalent is dropped; paging restarts |
| `/volume` | Lane view "Quiet first" |
| `/dashboards` | Lane view "Delete" |
| `/migration`, `/history` | Progress |
| `/teams/{id}/weeks?week=&tab=` | The same week, with the tab mapped as above |
| `/alert?…` | Unchanged |

## Non-functional requirements

- **Security and permissions:** the portal keeps its client allowlist, stays GET-only and
  keeps its content security policy. The smaller sender-rule option adds no write path.
- **Performance and capacity:** size for teams of 1,000 alerts and the 100 teams the read
  benchmarks assume. Pages stay bounded. Decide read-time grouping versus stored grouping by
  measurement with admin's `scripts/benchmark_reads.py`.
- **Availability and recoverability:** unchanged.
- **Auditability and logging:** with rules in the registry file, a change is a registry
  change and is recorded the way those are today. Console editing would need its own record.
- **Monitoring:** the portal's readiness check must cover every new view and column.
- **Network:** no change.
- **Risk:** a wrong lane tells a team to delete something it needs. Every "delete" shows its
  reason and examples, and deleting is always the team's decision.

## Integrations and dependencies

- **Admin owns the database.** New views or columns need a new admin migration (023; never
  edit applied ones), updates to `contracts/sql-views.json` and `contracts/migrations.json`,
  and a matching column list in the portal's readiness check. Epic A takes migration 023;
  Epic B's migrations follow it.
- **Shared library.** The portal uses a pinned copy of `alerts-bi-shared` (0.1.10). Shared
  UI changes need 0.1.11, a matching `alerts-bi-operations` release after 0.2.9, and the new
  wheel vendored into the portal.
- **Registry contract.** Sender rules extend `contracts/teams.schema.json`.
- **Console contract.** New admin routes change `contracts/console-openapi.json` and
  `console-http.json`. The committed OpenAPI file must match what the console produces.
- **Epic B.** Two records, to agree before either side builds on them:

  *Per run and group, written by this epic:* run, sender, group key, rule link, lane, alerts,
  incidents, events, reasons.

  *Per rule, current state, written by Epic B:* defined in Epic B. The portal joins it by
  rule and shows its age. Every field may be absent.

## Architecture notes

- Pages are built in Python with no templates: portal `src/pages.py` and `src/tabs.py`,
  admin `src/pages.py` and `src/summary.py`, shared `packages/shared/.../ui/`.
- Styles and scripts are Python strings served from versioned addresses. No Node build.
- Lane and group logic belongs in the engine or the shared insights package, so the admin
  console and the portal agree.
- An existing fallback key `app:<application>` (shared `insights/estimate.py`,
  `portal_v1_rules`) already counts "rules left". Reconcile it with requirement 3.

## Constraints the builder must respect

- No inline styles, `<style>` blocks or inline scripts. Bars are SVG.
- One script per portal page, and every page works without it.
- Portal tests forbid, on team pages: visible rule IDs ("R1"), the words "registry",
  "prompt", "per day", "run_id", "ruleset" and "model version", any `<select>`, and text under
  14px in slides.
- Many tests assert exact text and markup, in both apps and in this repository's integration
  suite.

## Design-document changes

Each goes into `docs/alerts_bi_design.md` as a dated section, then is synced into both apps
with this repository's `scripts/sync_contracts.py`.

1. **How often an alert is sent: three accounts, none verified here.**
   - Section 1.1 originally: V1 re-sends every 5 minutes, V2 every 12 hours.
   - Amendment of 2026-10-01 (section 7.14): the repeat interval is disabled and Grafana
     writes a row on every evaluation. The stuck and flapping rule (R6) is built on this.
   - The product owner, 2026-11-12: one Grafana feeds both pipelines and re-sends every 12
     hours; the standard is one "fired" and one "resolved".

   Check production rows first. If the third account is true, R6's stuck rule and the mock
   generator rest on a wrong premise, and correcting R6 is a ruleset change with a version
   bump. Treat as its own story, ahead of requirement 4.
2. **Progress.** Section 7.10 forbids deltas and "fixed" claims on History. Decide the
   wording Progress may use.
3. **Copy.** Section 7.10 says copy is short with no explanatory paragraphs. The lanes teach
   the rule in a sentence each. Record that this is allowed.
4. **Tabs, lanes, sender rules, the rule page** as new sections.
5. **Language of messages.** Section 4 records that alert messages are in English. The
   right-to-left work in Appendix A is only needed if that has changed (open question 7).

## Delivery and rollout

- Ships without Epic B.
- Deploy admin first, then the portal.
- Slices:

| Slice | Content | Can be planned now? |
|---|---|---|
| 1 | Shared variables and the UI fixes in Appendix A | Yes |
| 2 | Verify sending cadence on production rows; seed data for a large team | Yes |
| 3 | Engine: group, assign lanes, episode count; migration 023 and contracts | Yes, on the author's calls above |
| 4 | Portal views and redirects | Yes, after slice 3's record is fixed |
| 5 | Sender rules and lane 5 | After open questions 2, 3 and 6 |
| 6 | Design-document changes | With each slice |

- Data migration: no rows rewritten. Group past weeks at read time, or backfill; decide by
  measurement and test whichever is chosen.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rule links are missing or inconsistent, so grouping is poor | Medium | High | Measure coverage on real data in slice 2 |
| The sending cadence differs from what R6 assumes | Medium | High | Slice 2; do not lead with incidents until checked |
| Test and contract updates outgrow the feature work | High | Medium | Contracts first; slice as above |
| A collector's polling is flagged as spamming and worries the team | Medium | Low | Lane 5 explains it once per sender |
| The author's calls are overturned late | Medium | Medium | Review them at grooming, before slice 3 |

## Assumptions

| Assumption | Status |
|---|---|
| One Grafana rule produces many alerts | Stated by the product owner; verify on one large team |
| Event counts are real received messages | Confirmed by the product owner |
| vCenter and OCUM alerts carry a dedicated operator; OEM carries `application = "oracle"` | Stated by the product owner; not visible in code or sample registry |
| The engine does not read `expiry_in_minutes` | Checked in code 2026-11-15 |
| The fields named in this document are stored per alert and visible to the portal | Checked in code by the reviewer 2026-11-15 |

## Globalization and future-proofing

- Interface in English. Weeks are Monday to Monday, UTC.
- Lanes and sender kinds are data, so a new sender kind or a phase 2 plan needs no new page.

## Open questions

- [ ] 1. When is the V1 end-of-life date? It is the target and is not set yet. (product owner)
- [ ] 2. Sender rules in the registry file with a read-only page, or edited in the console?
      (product owner, architect)
- [ ] 3. Sender rules per team, or shared? (product owner)
- [ ] 4. Which account of the sending cadence is true in production? (product owner, with
      data)
- [ ] 5. Is storing an episode count acceptable, given it is a new stored fact about each
      alert? (architect)
- [ ] 6. Which V1 field holds the vCenter alarm name and the OCUM event name? (collector
      owners)
- [ ] 7. Can alert text be in Hebrew today? The design says English. (product owner)
- [ ] 8. Where is a team's own decision recorded: "keep this, it is needed" on a delete, and
      keep or drop on a collector alarm? The portal cannot write. Does an operator's recorded
      "dismissed" change a lane? (product owner, with Epic B)

## Suggested child stories

- Shared variables, dark mode, badges, contrast (Appendix A 1, 2, 3, 10).
- Portal error page; filters kept in links (7). One popover pattern (8). Search on the team
  directory and the admin Teams grid (9).
- Verify sending cadence on production rows; decide the R6 follow-up.
- Seed data: a 1,000-alert team and a team with collector and OEM alerts.
- Measure rule-link coverage and alerts per rule on real data.
- Engine: normalised group key; lane table; episode count; store operator.
- Migration 023, views and contracts.
- Portal: action plan; lane view; rule page; All alerts; Progress; standard panel; redirects.
- Sender rules: schema, matching, read-only Senders page, lane 5.
- Shared library 0.1.11 and vendoring.
- Design-document changes.
- Read benchmark at 1,000 alerts per team.

## Where the mocks differ from this document

| In the mocks | In the product |
|---|---|
| Buttons that delete, keep, set a wait, approve, migrate, pause, undo | Links to Grafana or the migration service, or hidden |
| "A V2 version exists" as a delete reason | Out of scope until Epic B |
| "'error' maps to 'high' in V2" | Wrong: the design publishes no severity mapping. Do not show. |
| Lane 5 labelled "After Grafana", unit "alarm definitions" | "Collectors and other senders", unit "group" |
| "Proposed: keep it" with a reason on collector alarms | No source for that proposal exists. Not in this epic. |
| All alerts shows V1 only, with dropdown filters | Both formats, link-menu filters |
| Progress shows four weeks and marks Phase 0 as done | Six weeks; phase from the stored value |
| Sender editor with live preview and reordering | Read-only page in the first step |
| Small-team mock: three moves, impact and runbook asked in phase 1, event counts first | Only "list alerts instead of groups" is taken from it |

---

## Appendix A: UI fixes

From the code review of 2026-11-12. Paths are in the admin and portal repositories.

| # | Problem | Where | Fix |
|---|---|---|---|
| 1 | Admin "Detailed analysis" turns near-white on white when the system is in dark mode: shared variables switch to dark, the console is light-only | shared `ui/assets.py` variables; admin `src/assets.py` | One variable set with light and dark values, used by both apps |
| 2 | "Manual" badge breaks mid-word on team cards | admin `src/assets.py` | Badges never wrap |
| 3 | Two design systems; admin loads both stylesheets | admin `src/pages.py` | One shared variable layer for colour, type size and radius |
| 4 | Work-list table has no styles; its "Findings" link lands on the week, not the alert | admin `src/summary.py` | Style it; link to the alert |
| 5 | Charts have a fixed size; labels shrink and overlap | shared `ui/charts.py` | Progress uses week cards; cap at six |
| 6 | No direction handling for user text; messages wrapped in hard-coded curly quotes | portal `src/tabs.py`, admin `src/summary.py` | Only if open question 7 says yes: logical CSS properties, isolate user text, drop the quotes |
| 7 | "Back to fix list" drops filters; a bad parameter returns raw JSON | portal `src/tabs.py`, `src/app.py` | Keep filters in links; add an error page as admin has |
| 8 | Three dropdown patterns, one of which does not close on Escape | portal `src/tabs.py`; admin `src/pages.py` | The native popover everywhere |
| 9 | Main task buried on the admin team page; no search on the team lists | admin `src/pages.py`; portal `src/pages.py` | Steps first; add search |
| 10 | Text at 11 to 12.5px; muted text below AA contrast | shared `ui/assets.py` | 16px base, nothing under 13px, AA contrast |

Pages to check for contrast and layout: portal directory, action plan, lane view, rule page,
All alerts, Progress, alert page; admin Teams, team page with "Detailed analysis" open,
Decisions, Schedule.

---

## Readiness summary

| Topic | Status | Notes |
| :-- | :-- | :-- |
| Purpose and clarity | Addressed | V1 end-of-life date not set yet |
| Functional requirements | Needs work | Sender rules wait on open questions 2, 3, 6; several rules are the author's calls |
| User experience | Addressed | Mocks checked at desktop width only; differences listed |
| Integration and dependencies | Needs work | Record shared with Epic B not yet agreed |
| Independence | Addressed | Ships without Epic B |
| Architecture | Needs work | Episode count; where sender rules live |
| Testability | Needs work | No seed data for a large team or for collectors |
| Performance and capacity | Needs work | Grouping approach not measured |
| Availability and reliability | N/A | Stateless reader, unchanged |
| Recoverability | N/A | No new state in the portal |
| Security and permissions | Addressed | No new write path in the recommended option |
| Risk | Addressed | |
| Network | N/A | No new connections |
| Auditability and logging | Addressed | For the recommended option |
| Monitorability | Addressed | |
| Installation and upgrade | Addressed | |
| Rollout | Addressed | |
| Data migration | Needs work | Read-time or backfill for past weeks |
| Globalization | Needs work | Open question 7 |
| Future-proofing | Addressed | |

**Overall readiness:** slices 1 to 4 can be groomed once the author's calls are reviewed.
Slice 5 waits on open questions 2, 3 and 6. The cadence check (slice 2) should run first,
because it decides whether incidents can be the lead measure.
