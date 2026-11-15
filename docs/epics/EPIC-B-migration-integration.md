# Epic B: Migration service integration and sync

> **Status:** Draft for grooming, revised after review · **Author:** Yarin · **Last updated:** 2026-11-15
> **Owner:** integration developer · **Sibling:** [Epic A: Portal action plan](EPIC-A-portal-action-plan.md)
> **Mocks:** [`docs/mockups/action-plan/`](../mockups/action-plan/README.md)

Decisions marked **(author's call)** were made while writing, not by the product owner. They
are defaults a builder can plan from and the product owner can overturn.

The migration service is an existing system with no repository available to the author.
Everything this document says about it is either stated by the product owner or a proposal.
Statements about Grafana are from general knowledge, not from the installed instance.

## Summary

The portal will tell each team which Grafana rules to delete, quiet or migrate (Epic A).
This epic connects that plan to action: one click takes a rule or a folder to the migration
service, noisy rules come with a tested fix, unclear rules come with a drafted V2 version to
approve, and every migrated rule is checked against its old version for a week before the
old one is paused. The aim is to turn migrating a team's Grafana alerts from hand-work per
alert into a review per rule.

## Problem / opportunity

- The migration service already moves a rule's fields to their V2 place and creates the V2
  rule in Grafana. It does not know which rules are worth migrating, which are noise, or
  what a good message would be. The BI knows that, and the two are not connected.
- Teams rebuild rules by hand and are slow at the judgement calls: a clear message and a
  re-decided severity.
- Phase 1 runs old and new rules together. Nobody compares them, so nobody is sure when an
  old rule is safe to remove, and V1 never reaches zero.
- The BI only sees alerts that fired in a week. Rules that stayed silent are invisible, so
  "zero V1" cannot be proven from the BI alone.

## Expected outcome and success metrics

**Project goal (shared with Epic A):** every team's V1 alerts that come from Grafana rules
reach zero by the V1 end-of-life date. *That date is not set yet (open question 1).*

| Metric | Direction | Target | Needs stored |
|---|---|---|---|
| V1 Grafana rules left, from the Grafana inventory | Down | Zero by the V1 end-of-life date | Inventory per read |
| Time from draft ready to V2 rule created, per rule | Down | Set after the first team | Draft time; V2 creation time |
| Share of drafts approved without edits | Up | Set after the first team | The approved text, from the migration service |
| Share of migrated rules that pass the side-by-side check | Up | Set after the first team | Verdict history |
| Old rules paused and later switched back on | Low | Near zero | State changes over time |

## Users and personas

- **Team lead and team members:** follow a link from the portal, review, and approve in the
  migration service.
- **Operator:** watches reads, drafts and failures in the admin console.
- **Migration service owner:** owns the screens where approval happens and every write to
  Grafana.
- **Grafana owner:** grants the service accounts and sets limits.

## Scope

### In scope

1. Handoff links from the portal to the migration service.
2. A read-only Grafana reader on the BI side.
3. A rule inventory per team, including rules that did not fire.
4. Wait-time replay for noisy rules.
5. Model drafts of the V2 message and severity, per rule.
6. Recording which V2 rule replaces which V1 rule.
7. The side-by-side check and its verdict.
8. Pause, then delete, of the old rule.
9. A current-state record per rule, readable by the portal and by the migration service.

### Out of scope

- The portal pages (Epic A).
- Writes to Grafana from the BI or the portal. Every write goes through the migration
  service, after a person approves.
- Collectors (vCenter, OCUM) and Oracle OEM.
- Rules that teams rebuilt by hand. Only rules the migration service created are paired.
- Impact and runbook (phase 2). Drafting them is a natural follow-up.
- A chat assistant that investigates rules live through Grafana's MCP server.

## Functional requirements

Reference for wording and flows:
[`portal-functional.html`](../mockups/action-plan/portal-functional.html). The mock performs
actions inside the page and changes state at once; the product does neither. See "Where the
mock differs".

### 1. Handoff links

A link from the portal to the migration service carries **(author's call, to agree with the
service owner)**:

| Part | Content |
|---|---|
| Action | migrate, review a draft, quiet, delete, or pause |
| Rules | An explicit list of rule IDs. A folder link is shorthand for "the rules of this folder that are in this lane for this team", sent as that list. |
| Context | Team and week |

A folder link must never sweep in rules from another lane or another team. The service
accepts a rule address or a folder address today; whether it can take an action and a list
is open question 3. Without this epic the portal's action is "Open in Grafana".

### 2. Grafana reader (read-only)

- Per rule: ID, name, folder, rule group, queries and expressions, the wait before firing
  ("for"), labels, annotations, paused or not, and last-updated time.
- The evaluation interval belongs to the rule group, not the rule.
- There is no "threshold" field. A threshold sits inside the rule's expressions and can take
  several forms. The reader hands the expressions to the draft step as they are. Where a
  single threshold cannot be read, features that need one say so and are skipped.
- History is recorded per alert instance (one per label set) as state changes, not per rule.
  Where it is stored, how long it is kept, and the address to read it from depend on the
  installed version and its configuration. A paused rule writes no history.
- The account is read-only. Which permissions the endpoints need depends on the version;
  name them in the Grafana check.
- The reader runs as its own daily job, apart from the weekly analysis **(author's call)**.
  A weekly run never waits for it or fails because of it.
- Only engine modules call it, as with Elasticsearch and the model. Credentials come from
  the environment. It keeps to a request budget agreed with the Grafana owner.

### 3. Rule identity and inventory

- **Identity:** a rule is identified everywhere by its Grafana rule ID (the UID).
  The BI's alerts carry a rule link, not an ID. The reader maps link to ID; the parsing rule
  depends on the link format in production and must be checked on real links. An alert whose
  link cannot be mapped stays in Epic A's link-based group, marked "not found in Grafana".
- **V1 or V2:** a rule is V1 or V2 by where its notifications are routed, not by a property
  of the rule. The exact test (label, contact point or policy) and what a rule routed to both
  counts as are open question 5.
- **Team:** how a rule is tied to a team (folder, label, or the operator it sends) is open
  question 5 too.
- **Inventory:** per team and per read, every V1 rule, whether it fired, whether it is
  paused, and its paired V2 rule if any. "V1 rules left" counts V1 rules that are not paused.

### 4. Wait-time replay

- **Incident:** for one alert instance, a stretch in the alerting state. A rule's incidents
  are the union of its instances' stretches on one timeline; overlapping stretches merge.
- For a flapping rule, replay the last four weeks of history with candidate waits of 2, 5,
  10, 15 and 30 minutes **(author's call)**. For each candidate, store incidents before,
  incidents after, and how many incidents of 30 minutes or longer would still fire.
- Recommend the shortest candidate that keeps every incident of 30 minutes or longer. If
  none does, say so and recommend nothing.
- For a stuck rule, report that it was alerting for the whole window, with the choice: wrong
  threshold, real unresolved problem, or delete.
- No model is involved. The portal shows the stored results as a table; it does not replay
  in the page.
- Source: Grafana's history **(author's call)**. Re-running the rule's query over past data
  is exact but heavier and needs query access; only if history is unavailable (open
  question 6).
- **Which rule gets the wait:** the new V2 rule, set by the migration service when it
  creates it **(author's call)**. The old rule is left as it is and removed after the check.
  A team may still change the old rule by hand in Grafana.

### 5. Model drafts

- One draft per rule: a V2 message, a proposed severity, and a one-line reason.
- Input: the rule's expressions, wait, labels and annotations, plus a few fired examples.
  Every number in the message must appear in the rule: in its expressions, its wait, or its
  time windows.
- Drafts are written for every rule in Epic A's review lane, ahead of time. A person
  approving one draft does not trigger anything on the BI side.
- Drafting is its own job, keyed by rule ID and a hash of the rule's definition. A draft is
  kept until the definition changes. A failed draft affects no weekly run.
- Output, to fix in the plan: message (may use Grafana's template syntax), severity from the
  V2 list, reason, and which test questions hold. Language follows the original message
  unless open question 9 says otherwise.
- A draft is always shown as before and after, to accept, edit or reject, in the migration
  service. Nothing is applied without approval.

**Severity and the wake-up test.** The alerting guide's test for a critical alert is: is it
urgent, is there immediate damage, and is it actionable, meaning a runbook is linked. Two
gaps follow, both needing a dated design decision (open question 7):

- A runbook is phase 2, so in phase 1 the third question cannot pass as written. Proposed
  phase 1 reading: "someone can act on it".
- The test separates critical from the rest. It does not say when to choose high over
  warning.

There is no published mapping from V1 to V2 severities; each is re-decided. A rule in the
"migrate automatically" lane therefore also needs a severity. Whether it gets a draft with
severity only, or keeps the service's current behaviour, is open question 7.

**Keeping drafts apart from assessment.** The assessment prompt's version is part of every
run's identity and of verdict reuse. Changing it needs a version bump, which gives every
future run a new identity and stops reuse of earlier verdicts. Stored weeks keep their
verdicts, and an accidental change of the text under an existing version is already
refused. So: drafting must not touch the assessment prompt. It also cannot reuse today's
model plumbing as it stands:

- Prompt artifacts are keyed by version alone, so a draft version would share the
  assessment's namespace.
- The audit journal allows only two kinds of scope, and a run's journal refuses writes once
  the run is published.
- The model client fixes the assessment's response format.

Plan for a new migration (a draft scope and its own version namespace) and a client that
takes the response format as a parameter. Applied migrations are never edited.

Drafts add model load on top of `LLM_CONCURRENCY`, which is per run. Give drafting its own
limit **(author's call)**.

### 6. Pairing old and new rules

- When the migration service creates a V2 rule, it records the ID of the V1 rule it
  replaces and the creation time. Grafana does not expose a creation time itself.
- Where to record it is not settled (open question 8). A label on the rule is copied onto
  every alert it sends and can reach the notification, and the V2 alert key is built from
  most fields; a new label could change that key. An annotation, or a record held by the
  migration service, avoids that. Test before choosing. Whatever is chosen, a team can edit
  a rule, so the pair is checked on every read.
- Rules created or changed through Grafana's provisioning API are locked against editing in
  Grafana's screens unless the request says otherwise (a request header, on versions that
  support it). The service must do that both when it creates a V2 rule and when it pauses a
  V1 rule, or "switch it back on" will not work from Grafana.
- The design withdrew pairing because teams rebuild rather than port. This reinstates it
  only for rules the service created.

### 7. Side-by-side check

- **Window:** the seven days after the V2 rule's creation time, rolling. Re-evaluated on
  every daily read until a person acts.
- **Matching (author's call):** compare the two rules' incident timelines (requirement 4).
  An old incident is matched when a new incident overlaps it, allowing for two evaluation
  intervals at each end. Several incidents may match one. An incident already open when the
  window starts counts.
- **Verdict**, by the first row that applies:

| Order | Verdict | Condition | Offered |
|---|---|---|---|
| 1 | Too early | Fewer than seven days since creation | Nothing |
| 2 | Missed | At least one old incident has no match | Both timelines; single pause after an explicit confirmation |
| 3 | Extra | Every old incident matched, and at least one new incident matches none | A person decides; single pause after confirmation |
| 4 | Nothing to compare | Neither rule had an incident | Wait another week |
| 5 | Passed | Every old incident matched and no new incident unmatched | Pause, singly or in bulk |

- When the V2 rule was created with a wait (requirement 4), old incidents shorter than that
  wait are left out before matching.
- A missing or unreadable history is "nothing to compare", never "passed".

### 8. Pause, then delete

All of this is done by the migration service after a person approves there.

- Pause is the default on a passed rule. Bulk pause applies only to passed rules.
- A paused rule is deleted after two weeks unless it was switched back on. The service runs
  that timer; the approval to pause also covers the later delete; pausing again restarts the
  clock **(author's call; open questions 4 and 11)**.
- Rules in Epic A's delete lane follow the same pause-then-delete path.
- Undoing a migration (removing the new rule and keeping the old) is the service's to offer.

### 9. Current-state record

One row per rule, holding the latest known state, written only by this epic's jobs
**(author's call)**. Every field can be empty.

| Group | Fields |
|---|---|
| Identity | rule ID, team, format (V1 or V2), name, folder, rule link |
| Read | time of last successful read; error, if the last read failed |
| Inventory | fired this week; paused; paired rule ID; V2 creation time |
| Migration state | none, side by side, paused, deleted; time of the last change |
| Draft | message, severity, reason, test questions; definition hash; time; error |
| Replay | recommended wait; time; error |
| Comparison | verdict; time |

Child rows: one per replay candidate (wait, incidents before, incidents after, long
incidents kept); one per state change, for history.

**Who reads it**

- The portal, through a published view, joined to Epic A's weekly groups by rule ID. The
  portal always shows the time of the last successful read.
- The migration service, to show the draft, the replay and the verdict where a person
  approves. Grafana cannot hold these, so the service needs a way to read them from the BI:
  a small read-only API, or a shared export. This is new, and so is its network path and
  authentication (open question 8).

**Staleness (author's call).** If the last successful read is more than two days old, a
"passed" verdict is shown as "passed on that date, not rechecked" and bulk pause is not
offered for it. Inventory and state are shown with their age.

**Reported and confirmed.** State changes reach the BI at the next daily read. A paused rule
counts as confirmed when Grafana shows it paused and the BI received no V1 alerts from it
for a full week. Until then the portal labels it "paused, not yet confirmed".

## User experience

- **In the portal:** links only (Epic A).
- **In the migration service:** review and approval. What its screens can show and accept
  today is not known to the author (open question 3).
- **In the admin console:** a page for the reader's last read per team, draft runs, and
  failures, with a "read now" action.
- **Errors:** a rule that cannot be read, a draft that failed, or a comparison with no data
  each say so in plain words. A failed draft never blocks migrating the rule by hand.

## Acceptance criteria

Checked by this team:

- [ ] A portal link carries the action, an explicit list of rule IDs, the team and the week.
- [ ] A folder link contains only that team's rules in that lane.
- [ ] For a team, the inventory at a given read time lists every V1 rule under the agreed
      team rule, including ones that did not fire, and the count equals Grafana's at that
      time.
- [ ] For a flapping rule, results are stored for all five candidate waits, and the
      recommended wait keeps every incident of 30 minutes or longer; if no candidate does,
      no wait is recommended.
- [ ] Every number in a draft message appears in the rule's expressions, wait or time
      windows.
- [ ] Every draft carries a severity from the V2 list and a reason.
- [ ] Running drafts changes no existing run's identity and no stored verdict.
- [ ] Given two timelines, the verdict follows the table in requirement 7, including
      precedence when an incident is missed and another is extra.
- [ ] A history that is missing or cannot be read yields "nothing to compare".
- [ ] With Grafana unreachable, the weekly run completes and publishes as it does today; the
      portal shows the last read's time; no bulk pause is offered after two days.
- [ ] With the model unreachable, rules appear in the review lane without a draft.
- [ ] No secret, rule expression or full model payload appears in normal logs.

Contract with the migration service, tested against a stub here and owed by the service:

- [ ] A V2 rule it creates records the V1 rule's ID and the creation time.
- [ ] No rule is paused or deleted without a recorded approval by a person.
- [ ] A paused rule can be switched back on from Grafana, and is not deleted while it is on.

## Non-functional requirements

- **Security and permissions:** the BI's Grafana account is read-only; only the migration
  service's account writes. The BI console has no login and records no names, so it is not
  where pause or delete is approved (open question 4). Rule expressions may contain
  sensitive names: keep them out of logs, as alert documents are today.
- **Performance and capacity:** about 1,000 alerts and tens to low hundreds of rules per
  team; about 100 teams. History reads dominate. Agree a request budget with the Grafana
  owner.
- **Availability and reliability:** Grafana, the model and the migration service can each be
  down without failing a weekly run. No failure may leave a rule looking safe.
- **Recoverability:** reads are repeatable. Drafts are journaled, so a retry resumes.
- **Auditability and logging:** approvals, pauses, deletes and switch-backs are recorded by
  the migration service with rule, time and person. The BI logs each read and draft run with
  counts and duration in the existing format.
- **Monitoring:** time of the last successful read per team; draft failures; pairs past
  seven days with no verdict.
- **Network:** new connections: BI to Grafana; the migration service to the BI's read API or
  export; users' browsers to the migration service. Production differs from development;
  test there.
- **Risk:** the dangerous direction is a false "safe". Stale data, a quiet week or a missing
  history never reads as a pass.

## Integrations and dependencies

| Dependency | Needed for | Owner | Engaged? |
|---|---|---|---|
| Migration service: link with action and rule list; show draft, replay and verdict; record the pair and creation time; set the wait on the V2 rule; pause and delete without locking the rule | 1, 4, 5, 6, 8 | Service owner | To confirm |
| Grafana: read-only account and permissions; version; history enabled and kept at least four weeks; request budget | 2, 3, 4, 7 | Grafana owner | Account agreed in principle |
| On-prem model: the draft response format | 5 | Model owner | Capability confirmed verbally |
| Epic A: weekly group record; reserved places; migration 023 lands first | 9 | BI Portal developer | Same team |
| Local test stack has no Grafana | all | This team | Needs a stub or a test instance |

## Architecture notes

- The reader sits beside the Elasticsearch reader and the model client in admin's
  `src/engine/`. The console and the portal never call Grafana.
- Stored results go through the admin migration chain, after Epic A's migration 023, and
  reach the portal through published views.
- Proposal: Grafana holds what it naturally holds (the rules, paused state, history, and the
  pair if an annotation is safe). The BI holds drafts, replays and verdicts and exposes them
  read-only. Architectural input is needed (open question 8).

## Design-document changes

Each goes into `docs/alerts_bi_design.md` as a dated section.

1. **Elasticsearch is no longer the only source.** The design states it is; the Grafana
   reader adds a second.
2. **The Grafana API is a recorded non-goal** for panel discovery and variables. Record that
   it is now used for rules and history, read-only.
3. **Pairing** was withdrawn. Reinstate it for service-created rules only.
4. **The wake-up test in phase 1**, and how to choose high or warning (open question 7).
5. **How often an alert is sent.** The design (amended 2026-10-01) says the repeat interval
   is disabled and a row is written on every evaluation. The product owner says Grafana
   re-sends every 12 hours. Epic A carries the check. This epic does not depend on the
   answer, because it reads incidents from Grafana's history, not from BI rows.

## Delivery and rollout

| Slice | Delivers | Depends on |
|---|---|---|
| B0 | Discovery: migration service session; Grafana check | Nothing. Do first. |
| B1 | Handoff links | B0 (link format); Epic A page |
| B2 | Grafana reader, rule identity, inventory, console status page | B0 (version, permissions, team rule) |
| B3 | Pairs and migration state in the record and the portal | B2; service records the pair |
| B4 | Wait-time replay | B2; history available |
| B5 | Model drafts | B2; new migration; service shows the draft |
| B6 | Side-by-side check; pause and delete | B3 |

- Start with one team that has many Grafana rules, and set the metric targets from it.
- The reader, drafts and the comparison are each switched on in configuration.
- Data migration: none; new tables only.
- Add a load-test story for Grafana reads if it is not done in B2.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| History is not enabled, not kept long enough, or awkward to read per rule | Medium | High | B0 |
| A rule cannot be tied to a team, or told V1 from V2, reliably | Medium | High | B0; measure on one team |
| Rule links in alerts do not map to rule IDs | Medium | High | Check real links in B0 |
| The service cannot take an action and a list, show drafts, or record pairs without real work | Medium | High | B0; B2 and B4 do not need it |
| Pausing through the API locks rules against the Grafana screens | Medium | Medium | Verify on the installed version in B0 |
| Drafts are plausible but wrong about numbers | Medium | High | Numbers must come from the rule; a person approves |
| A needed old rule is paused after a quiet week | Low | High | "Nothing to compare" is never a pass; pause is reversible; delay before delete |
| A pairing label changes the V2 alert key | Medium | Medium | Test an annotation first |
| Grafana load from history reads | Medium | Medium | Request budget; daily, not per page view |

## Assumptions

| Assumption | Status |
|---|---|
| The migration service has its own screens for review and approval | Confirmed by the product owner 2026-11-15 |
| It creates rules in Grafana with a service account | Confirmed by the product owner |
| It accepts a rule address or a folder address, and moves fields such as `object` to `component` | Confirmed by the product owner |
| The BI may read Grafana with a read-only account | Confirmed by the product owner 2026-11-15 |
| The on-prem model can draft a message and propose a severity | Confirmed by the product owner; verify the response format |
| Grafana can return rule definitions, paused state and per-instance history on the installed version | To verify in B0 |
| Rules are evaluated much more often than they notify, so history has exact times | To verify in B0 |

## Globalization and future-proofing

- Times are UTC. Draft language: open question 9. The design records that alert messages are
  in English.
- The draft path extends to impact and runbook for phase 2. The comparison can also serve
  the collectors' own shadow week, which their designs describe in the same terms.

## Open questions

- [ ] 1. When is the V1 end-of-life date? It is the target and is not set yet. (product owner)
- [ ] 2. Metric targets. Proposed: set after the first team. (product owner)
- [ ] 3. What can the migration service's screens and API take and show today? Can a link
      carry an action and a rule list? Is there a repository or API description? (service
      owner)
- [ ] 4. Who may approve pause and delete, and where is it recorded? Does one approval cover
      the later delete? (product owner, service owner)
- [ ] 5. How is a rule tied to a team, and how is a V1 rule told from a V2 rule? What is a
      rule routed to both? (Grafana owner, product owner)
- [ ] 6. Is history enabled, where is it stored, how long is it kept, and how is it read on
      the installed version? (Grafana owner)
- [ ] 7. The phase 1 reading of the wake-up test; the rule for high versus warning; and
      severity for rules that migrate automatically. (product owner)
- [ ] 8. Where is the pair recorded (label, annotation, or in the service), and how does the
      service read drafts, replays and verdicts from the BI? (architect, service owner)
- [ ] 9. Draft language when the original message is not English. (product owner)
- [ ] 10. Installed Grafana version; permissions for a read-only account; keeping
      API-changed rules editable. (Grafana owner)
- [ ] 11. Is two weeks between pause and delete right? (product owner)
- [ ] 12. Is the wait set on the new rule only, as proposed, or on the old rule first as the
      mock shows? (product owner)

## Suggested child stories

- B0: discovery session with the migration service owner; Grafana check (version, history,
  permissions, real rule links, team and format rules, API lock behaviour).
- Grafana stub or test instance for the local stack.
- B1: link contract and portal links.
- B2: reader; link-to-ID mapping; inventory; daily job; console status page; health signal.
- B3: pair and state in the record; "reported" and "confirmed".
- B4: incident timeline from history; replay candidates; recommendation; stuck report.
- B5: migration for draft scope and version namespace; parametrised client; draft prompt and
  format; journal and retry; own concurrency limit; test that run identities are unchanged.
- B6: matching and verdicts; staleness; pause and delete through the service.
- Read-only API or export for the migration service.
- Published view and contracts for the record.
- Production network checks.
- Load test of Grafana reads.
- First-team rollout and metric targets.
- Design-document changes.

## Where the mock differs from this document

| In the mock | In the product |
|---|---|
| Actions happen in the portal and take effect at once | Links to the migration service; state arrives at the next read, labelled with its age |
| "Set a 10-minute wait in Grafana" on the old rule | The wait is set on the new rule (open question 12) |
| A slider replays one week in the page | Stored results for five candidates over four weeks, shown as a table |
| "'error' maps to 'high' in V2"; old severity shown as critical | No mapping exists; each severity is re-decided. V1 has no "critical". |
| Three ticks derived from the chosen severity | The model states which questions hold; the rule is open question 7 |
| A checkbox to draft sibling rules | Every review-lane rule is drafted ahead of time |
| "Moved or deleted" as one state | Paused and deleted are separate |
| "Just migrated" | "Too early", until seven days have passed |
| "Keep it, this is needed"; the three stuck-rule choices; "Undo"; "Pause anyway"; "Wait another week" | Offered by the migration service where they change something. Where a team's "keep" is recorded is Epic A's open question 8. |
| Component name "taken from the rule's query" | Not in scope; drafts cover message and severity |
| "Delete the rule in Grafana" on a group sent by API | Not applicable; no rule exists |
| No failure, stale or "not yet confirmed" states; no inventory of silent rules | Required; add to the mock before Epic A builds the reserved places |

---

## Readiness summary

| Topic | Status | Notes |
| :-- | :-- | :-- |
| Purpose and clarity | Addressed | V1 end-of-life date not set yet; metric targets after the first team |
| Functional requirements | Needs work | Rests on what the migration service and the Grafana instance can do |
| User experience | Needs work | Approval screens belong to a system the author has not seen |
| Integration and dependencies | Needs work | Three outside owners; a new read path from the BI |
| Independence | Needs work | B2 and B4 need only Grafana; the rest need the migration service |
| Architecture | Needs work | Where the pair lives; how the service reads the BI |
| Testability | Needs work | No Grafana in the local stack |
| Performance and capacity | Needs work | Request budget not agreed |
| Availability and reliability | Addressed | Staleness and failure direction defined |
| Recoverability | Addressed | |
| Security and permissions | Needs work | Where approval is recorded; auth for the new read path |
| Risk | Addressed | |
| Network | Needs work | Three new connections, unchecked in production |
| Auditability and logging | Addressed | |
| Monitorability | Addressed | |
| Installation and upgrade | Addressed | New settings and migrations only |
| Rollout | Addressed | |
| Data migration | N/A | New tables only |
| Globalization | Needs work | Draft language |
| Future-proofing | Addressed | |

**Overall readiness:** not ready to groom beyond B0. The discovery slice answers open
questions 3, 5, 6, 8 and 10; after it, B1, B2 and B4 can be planned. B5 also needs open
question 7.
