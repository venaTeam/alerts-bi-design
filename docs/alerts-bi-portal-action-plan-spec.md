# Alerts BI portal: from weekly report to action plan - product specification

> **Based on:** Epic A, "Portal action plan" (`alerts-bi-design/docs/epics/EPIC-A-portal-action-plan.md`) and its mocks (`alerts-bi-design/docs/mockups/action-plan/`) · **Related:** Epic B, "Migration service integration" (separate owner)

## Intro

### The problem

Teams must move their alerts from the old format (V1) to the new standard (V2). Today, a team that opens its week in the review portal sees a lot of data and no clear next step.

- **Seven tabs, no starting point.** The team page is split into Overview, Fix list, Volume, Dashboards, Migration, History and Slides. None of them says what to do first.
- **Rules are named, not explained.** The page shows rule codes without reasons or examples, so a reader must already know the standard to understand what to fix.
- **It does not scale.** Some teams have 800 to 1,000 distinct alerts, produced by a much smaller number of Grafana rules that share the same problems. The portal lists alerts one by one, so one bad rule looks like hundreds of separate tasks.
- **The goal is not visible.** The project's goal is to get every team off V1. The page does not show how far a team is from that.

**Cost of not doing it:** teams keep reading a report instead of working through a list, and the move to V2 stays slow and dependent on hand-holding by the standardization team.

### The proposal in one paragraph

Turn the team's week into an **action plan**. Show where the team stands on V1 and V2, sort V1 alerts into a few **action lanes** (delete, quiet first, migrate automatically, review then migrate, collectors and other senders), and **group alerts by the Grafana rule** that produces them. Then 100 alerts from one rule become one item to fix. Every recommendation explains its reason with examples and comes with an action: **delete**, **quiet**, **migrate**, **review** or **fix**. The action button takes the team to where the change is made: the rule in Grafana at first, and the migration service once Epic B connects it.

**Senders** are services that send alerts directly through the Appchi API rather than from a Grafana rule, for example collectors such as vCenter or OCUM and other in-house services. Their alerts have no Grafana rule to group by or fix, so the change has to be made in the sending service. Every alert already records whether it came from Grafana or the API (`provider`), so the portal recognises these alerts, groups them by application and labels them "change at the sender." They go through the same lanes as other alerts. In Stage 2, sender rules recognise collectors and other known senders and give them their own lane.

- **Stage 1 - UI features:** the visual refresh plus every new page and UI feature that can be built from data the weekly analysis already produces, including the four action lanes and their action buttons. The analysis itself does not change.
- **Stage 2 - new product capabilities:** features that need new data, new analysis or new configuration across admin, portal and the design contracts: sender rules with the fifth lane, alert cycles, and actions through the migration service with other Epic B information.

## Requirements

- Replace the report-first team page with an action plan.
- Group related alerts so teams can address one source rule instead of reviewing every alert separately.
- Explain every recommendation with a reason and examples.
- Keep copy short: a label, a number and one sentence to fix; no teaching sentences or explanatory paragraphs.
- Keep V1 and V2 counts separate. Every V1 alert belongs to one action lane. V2 shows alerts meeting the standard and groups needing action, such as improving the message or deleting the alert.
- Give each recommendation an action button where there is a rule to act on: delete, quiet, migrate, review or fix. The button opens Grafana or the migration service, where a person makes or approves the change. The portal itself writes nothing.
- Support small and large teams and accessible light/dark views.
- **Stage 1** uses only the findings and alert facts already produced and published each week. It must not change how alerts are analysed or which findings they receive.
- **Stage 2** adds what Stage 1 cannot show without new data: sender rules with the fifth lane for collectors and other senders, alert cycles, and actions through the migration service with other Epic B information.

## Proposed Implementation

### Stage 1: UI features on existing data

#### 1.1 Visual refresh

| Area | UI change |
|---|---|
| Colours and dark mode | Consistent, readable colours across portal/admin, including expanded admin Detailed analysis. |
| Typography | 16px base text, minimum 13px, at least 14px in Slides, and AA contrast. |
| Layout | Improve spacing, alignment, table styling and responsiveness. Keep badges such as Manual on one line. |
| Admin team page | Make the existing Run/Review/Publish steps prominent. |
| Menus and panels | Consistent appearance, keyboard access, Escape and outside-click dismissal. |
| Navigation | Fix broken detail/back links; filters survive opening an alert and returning. |
| Errors | Invalid addresses and parameters show a readable error page. |

#### 1.2 Replace Overview with Action plan

The team week page becomes the default Action plan view.

| Area | What the user sees |
|---|---|
| Review note | The operator's existing note at the top. |
| Headline | V1 alerts this week, split across nonempty lanes. |
| V1 bar | Separate segments for the lanes. Each count opens its lane. |
| V2 bar | Alerts meeting the phase 1 standard and action categories such as "need a better message" and "delete." Each count opens the corresponding filtered All alerts list. |
| Start here this week | Up to five groups to work on first. |
| The plan | Lanes in order, each with its name, count, one sentence on what to fix and its four largest groups. A link opens the rest. |
| V2 alerts to fix | V2 problems grouped by required action, below the bars. |

Keep the application filter above navigation and the week selector. Selections follow the user across pages and weeks. An empty lane says "nothing left here"; a week with no data says so.

**Start here:** visit lanes 1 to 4 in order, take the largest groups first, at most two per lane and five overall. The same rule may appear twice when its alerts need different work in different lanes.

#### 1.3 V1 action lanes 1 to 4

| Display order | Lane | Which alerts belong here |
|---|---|---|
| 1 | Delete | Status/heartbeat messages or alerts hidden by the team's own dashboard, from Grafana or the API. |
| 2 | Quiet first | Alerts identified as stuck, flapping or spamming, from Grafana or the API. |
| 3 | Migrate automatically | Alerts with no finding in lanes 1, 2 or 4, from Grafana or the API. API alerts here are moved to V2 at the sender, not automatically. |
| 4 | Review, then migrate | Generic messages, missing/placeholder metadata, missing rule links, invalid creation times, or model findings needing attention, from Grafana or the API. |

To avoid overlapping counts, evaluate Delete first, then Quiet first, then Review, and finally Migrate automatically. Each V1 alert appears in exactly one lane. Other findings remain visible in its details.

A V1 alert the model did not check, with no other blocker, goes to Migrate automatically and is labelled "not checked by the model."

Lane 5, Collectors and other senders, arrives with sender rules in Stage 2 (2.1).

Each lane has its own page listing all its groups with pagination. Clicking a group opens its explanation and alerts.

**Small lanes:** when a lane has 10 alerts or fewer after the application filter, show those alerts directly instead of groups.

#### 1.4 Group alerts by their source rule

Instead of 100 separate entries from one Grafana rule, show one rule with "100 alerts."

- Identify the group by the alert's latest rule link, ignoring surrounding spaces and anything after `?` or `#`, so small variations of one rule's link stay together. Show the last part of the link as the label.
- Grafana alerts without a rule link form one group per application, labelled "no rule link." Count these as alerts, not rules.
- API alerts group by application and are labelled "change at the sender," in whichever lane they land.
- One rule may appear in multiple lanes. Each appearance counts only its alerts in that lane and notes the other work, for example "9 more alerts from this rule are in Delete."
- "Rules that fired" counts only groups with actual Grafana rule links, once per rule across lanes. It does not include silent rules.

#### 1.5 Rule/group detail pages

Each rule or group has its own page that users can open and share. It shows:

- The rule or group name, lane and affected-alert count.
- Why it belongs in the lane (its finding) and one sentence on what to fix.
- Examples of affected alerts and, where helpful, a clearly labelled "not this / this" standard example.
- A table of relevant alert fields, other findings and unseen-alert indicators.
- Received events.
- A paged list of member alerts, linking to existing alert detail and recorded decisions.
- The lane's action button (1.9).

Recorded decisions appear next to their findings and do not change the lane.

#### 1.6 Replace Fix list with All alerts

All alerts includes both V1 and V2.

| UI element | Required behavior |
|---|---|
| Columns | Format, application, message, rule/group, events, what to do. |
| Default order | Most events first. |
| Search | Message, application and rule/group. |
| Filters | Format, lane, V2 category (meets the standard, need a better message, delete), rule/group and application. Use link menus, not select dropdowns. |
| Paging | Keep the existing page size. Changing filters starts at the beginning. |
| Navigation | Search and filters stay in the address, survive opening an alert, and remain when returning. |

V2 does not use the V1 migration lanes. It has its own categories: alerts meeting the phase 1 standard and alerts needing action, such as "need a better message" or "delete."

Missing impact/runbook readiness findings alone do not prevent meeting the phase 1 standard. V2 alerts never checked by the model show as "not checked" and are not counted as meeting the standard.

#### 1.7 Replace Migration and History with Progress

Progress shows:

- Phase 0, Phase 1, Phase 2 and Done, using the week's recorded phase. No-data weeks highlight no phase.
- The six most recent published week cards: V1 alerts, V1 Grafana rules that fired, and V2 alerts meeting phase 1 out of all V2 alerts.
- A marker where the measurement basis changed, including when a team's sender rules change (Stage 2).
- The existing operators card and links to every published week.

When a team's only V1 alerts left come from the API, Progress says "Grafana rules done; collectors remain" for that week.

Show counts only, with no improvement arrows, change percentages or "fixed" claims.

#### 1.8 Navigation, old bookmarks, standard panel and search

| Existing destination | New destination |
|---|---|
| Overview / team week page | Action plan |
| Fix list | All alerts, retaining equivalent filters and restarting paging |
| Volume | Quiet first lane |
| Dashboards | Delete lane; unseen indicators remain on detail pages |
| Migration / History | Progress |
| Week selector's All weeks | Published-week list on Progress |
| Alert detail / Slides | Retained |

Old bookmarks must reach the corresponding new view. Add "The V2 standard" as a panel available from every view. Add search to the portal team directory and admin Teams list.

#### 1.9 Action buttons

Every group carries its lane's action, on the lane page, the Action plan previews and the group page, so the team can act straight from the plan. In Stage 1 the button opens the rule in Grafana, where the team makes the change; it uses the rule link already stored.

| Lane | Stage 1 button | Stage 2 button (2.3) |
|---|---|---|
| 1. Delete | Delete in Grafana | Delete, in the migration service |
| 2. Quiet first | Quiet in Grafana | Quiet, in the migration service |
| 3. Migrate automatically | Migrate in Grafana | Migrate N alerts, in the migration service |
| 4. Review, then migrate | Review in Grafana | Review the draft, in the migration service |
| V2: delete | Delete in Grafana | Delete, in the migration service |
| V2: need a better message | Fix in Grafana | Fix, in the migration service |

Grafana alerts without a rule link have no button. API groups have no button in any lane or format; the change is made at the sender.

#### Stage 1 release note

Stage 1 ships in two reviewable steps: the visual refresh (1.1) first, then the new pages and buttons (1.2 to 1.9). Neither waits for Stage 2.

### Stage 2: New product capabilities

These features need new data, analysis or configuration in admin as well as the portal.

#### 2.1 Sender rules

In Stage 1, API alerts go through lanes 1 to 4, grouped by application. Sender rules recognise collectors and other known senders, such as vCenter, OCUM and Oracle OEM, name them and give them their own lane. Inside it, each rule is its own group. For example, a `vcenter` group of 300 alerts becomes "Datastore space low: 120", "Host disconnected: 80" and so on, so a team can decide per alarm type.

| Topic | Product behavior |
|---|---|
| Where rules are managed | Operators create and edit sender rules in the team's admin Senders page. |
| Who uses a rule | Each rule applies only to its team. Editing one team's rules does not change another team's rules. |
| How alerts are grouped | The operator writing the rule decides, with field conditions such as "field x = y and field z = e." Each rule is one group in lane 5. To split vCenter alarms by type, write one rule per type. |

A sender rule has a name and conditions. A condition can use any alert field the operator chooses, for example object, node name or message, with is, is one of, starts with or contains. Values must match exactly, including upper and lower case, and are tested against the alert's latest received event. All conditions must match; the first matching rule wins.

The Senders page shows results per rule, warnings for rules that match nothing, and API alerts no rule matches yet.

Each sender rule's name is shown wherever its alerts appear, in both V1 and V2: as their group in lane 5 and in the rule/group column and filter of All alerts.

**Sender side by side.** A sender rule matches the sender's alerts in both formats, so its page shows the sender's V1 and V2 alerts next to each other: the V1 alerts in lane 5 and the V2 alerts with their V2 category, each with its own count. This shows how far each sender has moved to V2. The two counts are never added together. This is separate from Epic B's side-by-side check of a migrated Grafana rule.

Lane 5 joins the lanes:

| Display order | Lane | Which alerts belong here |
|---|---|---|
| 5 | Collectors and other senders | V1 API alerts a sender rule matches, one group per rule. One sentence to fix: keep what you need and drop the rest at the sender, after the team's Grafana rules. |

Lane 5 is checked before lanes 1 to 4, so all of a sender's alerts are reviewed together; their findings stay visible on the group page. It is not part of "Start here." API alerts no rule matches stay in lanes 1 to 4, grouped by application.

Sender rules apply only to API alerts, in both formats; only V1 has lanes. Sender rules change lanes and groups only, never findings. Rule changes affect the next run rather than rewriting historical weeks, and Progress marks them as a measurement change.

#### 2.2 Alert cycles as the main activity measure

Each Grafana alert stores a count of its **alert cycles**. API alerts show events only.

A Grafana alert that is still firing is re-sent every 5 minutes in V1 and every 12 hours in V2, until it is sent with severity `clear` (V1) or status `resolved` (V2).

An **alert cycle** runs from the first firing message until the clear (V1) or resolved (V2) message. The repeats inside it do not start new cycles. For example, a V1 alert fires for one hour and clears, then later fires for another hour and clears: about 26 events, but 2 alert cycles. Because alert cycles do not depend on how often an alert repeats, they can be compared between V1 and V2; event counts cannot.

Show alert cycles first and received events as supporting information. For groups, say "N alert cycles across M alerts." All alerts gains an alert-cycles column and orders by most alert cycles, then most events. Group and detail pages show alert cycles next to events.

Weeks analysed before alert cycles existed show events only; alert cycles are marked unavailable.

#### 2.3 Actions in the migration service and other Epic B information

Once Epic B connects the migration service, each action button opens it with the action, the rules of that group and the team's week. A person reviews and approves there, and the service makes the change:

| Lane | Button | What the migration service does after approval |
|---|---|---|
| 1. Delete | Delete | Pauses the rule, then deletes it after a waiting period unless it is switched back on. |
| 2. Quiet first | Quiet | **Flapping rule:** tests wait times on the last four weeks and sets the shortest one that still catches every problem lasting 30 minutes or more on the V2 rule. **Stuck rule:** asks the team to choose: fix the threshold, fix the real problem, or delete. |
| 3. Migrate automatically | Migrate N alerts, or Migrate folder | Creates the V2 rule, runs it side by side with the old one for a week, then pauses the old one. |
| 4. Review, then migrate | Review the draft | Shows a drafted V2 message and proposed severity to approve or edit, then migrates as above. |
| 5. Collectors and other senders | None | No Grafana rule exists; the change is made at the sender. |

A folder button covers only that folder's rules in the same lane for the same team.

Epic B also fills these areas:

| Area | Without Epic B | With relevant Epic B data |
|---|---|---|
| Action button | Opens the rule in Grafana (1.9) | Opens the migration service |
| Rule identity | Link-based label, no folder | Rule name and folder |
| Review details | Reason and standard example | Drafted V2 message and proposed severity |
| Quiet details | Observed firing pattern | Static candidate wait-time results |
| Side by side and migration-state bar segments | Hidden | Shown with the age of the data |
| "A V2 version exists" reason | Hidden | Shown only after the pair passes its check |

### Acceptance criteria

**Stage 1**

- The analysis and its findings are unchanged; every new page reads existing weekly results.
- Styling, typography, badges, tables and menus are consistent and readable in both themes, keyboard-accessible and usable for small and large teams.
- Every V1 alert belongs to one of lanes 1 to 4; lane counts equal the V1 total for the selected applications. API groups are labelled "change at the sender."
- A group's count matches All alerts filtered to that group and lane. Real-rule counts exclude application-only groups.
- Start here shows at most five groups, at most two per lane, from lanes 1 to 4; lanes of 10 alerts or fewer list their alerts directly.
- Recorded decisions are visible and never change an alert's lane.
- V1/V2 remain separate; readiness-only V2 gaps do not count as phase-1 failures. V2 action categories open the corresponding filtered alerts.
- V2 alerts the model did not check show as "not checked" and are not counted as meeting the standard.
- Search, filters, paging, back links and old bookmarks behave consistently.
- The V2 standard panel opens from every view, and the portal team directory and admin Teams list can be searched.
- Every recommendation shows its evidence.
- Every Grafana group with a rule link, V1 or V2, has its action button, opening the rule in Grafana; API groups have none.
- Progress shows the recorded phase, six cards, measurement changes and access to all published weeks, with counts only. When a team's only V1 alerts left come from the API, it says "Grafana rules done; collectors remain."
- Copy is a label, a number and one sentence to fix; no explanatory paragraphs.

**Stage 2**

- Operators can create/edit sender rules in admin for one team without affecting another team. Lane 5 holds exactly the V1 alerts a sender rule matches, one group per rule, and the rule's name appears in All alerts and the side-by-side view; lanes 1 to 5 together equal the V1 total. Sender results do not erase findings or change old weeks.
- The Senders page shows results per rule, warns about rules that match nothing, and lists API alerts no rule matches.
- Repeats inside one alert cycle count once. Alert cycles are counted for Grafana alerts only; API alerts show events. Alert cycles are marked unavailable for weeks where they cannot be known.
- With Epic B, action buttons open the migration service with the action, the group's rules and the team's week; a folder button never includes rules from another lane or team.
- A sender's page shows its V1 and V2 alerts side by side, with separate counts that are never added.
- Epic B areas appear only with their data and its age, and are hidden otherwise.

## Summary

**Stage 1:** visual refresh plus Action plan, lanes 1 to 4 with their action buttons, rule grouping, detail pages, All alerts, Progress, redirects, the standard panel and team search, all built on today's weekly results.

**Stage 2:** per-team sender rules in admin with lane 5, alert cycles, and action buttons that open the migration service, with the other Epic B display areas.
