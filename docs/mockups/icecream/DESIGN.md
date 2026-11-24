# icecream visual design

The design of the mock in this folder (`index.html`). Taken from the built mock, not from
intentions. Tone: a calm, professional work tool used at a desk during the week, never playful.

## Idea: rules as flight strips

Air-traffic controllers track each flight on a paper strip and move strips between bays as the
flight progresses. In icecream **every Grafana rule is a strip**, and a team's work is moving
strips from state to state until they leave as v2. One rule mark is reused at every size: the
Overview rack, the Action plan columns, the Rules list, the Migrate and Edit pickers, and the rule
page header. Everything else is standard web UI: tabs, tables, buttons and selects.

The strip, left to right:

| Part | Content |
|---|---|
| Holder | Tinted by format: buff for v1, blue for v2, grey for API senders. Shows `v1`/`v2` and the rule UID in monospace. |
| Body | Rule title (opens the rule page), then its state with a small colour bar, and folder or "migrated by" details. |
| Marks | Problems as outlined red tags (Heartbeat, Generic message, Flapping…). |
| Count | Alerts this week, behind a dashed divider. |
| Action | Migrate, Edit, Delete in Grafana… |

Variants: a tall strip inside the Action plan columns, a large strip as the rule page header, a
strip with a checkbox in the Migrate picker, and a small "mini" version (format + title) in the
Alerts table.

## Colours

| Token | Hex | Use |
|---|---|---|
| ink | `#14202B` | Text, top bar, primary buttons, "Delete" state |
| ink-2 / muted | `#3C4A57` / `#5A6977` | Secondary and tertiary text |
| line / line-2 | `#D5DCE2` / `#B6C1CB` | Hairlines and control borders |
| bay | `#ECEFF2` | Grey panels and columns (the "bays") |
| paper | `#FFFFFF` | Page and strips |
| buff / buff-2 / buff-ink | `#F1E5A8` / `#D9C25A` / `#5E4E0B` | v1 holder, "Ready to migrate" |
| blue / blue-2 / blue-ink | `#CFE2F4` / `#7FAFDA` / `#1F4E79` | v2 holder, "V2" state, links |
| red | `#C8102E` | Problems, "Fix the noise", destructive actions only |
| amber | `#955C00` | "Review" state, "also from this rule" warnings |
| green | `#1D7347` | "Migrated" state, success |
| mark / mark-soft | `#1F4E79` / `#E3EDF8` | Selection and same-rule marking in the Alerts table |

State colours: Delete ink, Fix the noise red, Review amber, Ready to migrate buff, Migrated green,
V2 blue. Every state also has its name in text; colour is never the only signal.

## Type

- **Archivo** for everything (Google Fonts, with a system sans fallback). Page titles 28px/750,
  section titles 18px/700, body 15px, small text 13–13.5px.
- **Monospace** only for data: rule UIDs, operator and policy names, folder URLs, label values.
- Tabular numerals in tables and counts.

## Layout rules

- Ink top bar: logo, Teams / team switcher, page name, user.
- Team header: team name on the left; **Migrate rules** (primary), **New v2 rule**, **Edit v2
  rule** on the right, in the same place on every team page.
- Tabs under the header; the week and application filters sit at the right of the tab row, only
  on weekly tabs.
- Overview and rule pages: main column plus a 290–320px side column. Action plan: four columns,
  two on tablets, one on phones.
- 1px hairlines, 2px corners on strips, 4–8px elsewhere, no shadows except the dialog.
- No KPI card grid, no gauges, no gradients, no emoji or text-glyph icons (icons are inline SVG),
  no small labels above headings, no explanatory paragraphs.
- Works down to 390px width without horizontal page scroll; wide tables scroll inside their box.
- Visible keyboard focus, `prefers-reduced-motion` respected.

## Mock only

The yellow bar at the top and the yellow "Mock: try a rule URL" hints are not part of the
product.
