// icecream clickable mock. Sample data only; nothing talks to a server.
"use strict";

// ---------------------------------------------------------------- the alert standard
// Same fields as migration-compliance/src/standard/schema.json.
const STANDARD = [
  { name: "Send-Alert", loc: "label", req: true, expl: "Enables sending alerts from this alert rule. Without it, alerts will not be sent.", c: { exact: "true" }, def: "true" },
  { name: "Appchi-$operator", loc: "label", req: true, expl: "The team's personal notification policy connected to its contact point.", c: { starts: "Appchi - " }, def: null },
  { name: "component", loc: "label", req: true, expl: "The component this alert monitors.", c: { min: 2, max: 200 }, def: null },
  { name: "application", loc: "label", req: true, expl: "The application name. If omitted, the field will not appear in the alert.", c: { min: 2, max: 50 }, def: null },
  { name: "node_name", loc: "label", req: false, expl: "Optional node or instance name.", c: { min: 2, max: 200 }, def: null },
  { name: "severity", loc: "label", req: false, expl: "Alert severity. Defaults to 'high' if not provided.", c: { allowed: ["critical", "high", "warning"] }, def: "high" },
  { name: "network", loc: "label", req: false, expl: "Network identifier. Defaults to 'nesharim' if not provided.", c: { min: 2, max: 200 }, def: "nesharim" },
  { name: "site", loc: "label", req: true, expl: "The site this alert belongs to. Free-form text field, no predefined list of values.", c: { min: 2, max: 200 }, def: null },
  { name: "environment", loc: "label", req: false, expl: "Deployment environment. Defaults to 'production' if not provided.", c: { allowed: ["production", "integration", "load", "development", "test"] }, def: "production" },
  { name: "message", loc: "annotation", req: true, expl: "The alert message shown in notifications.", c: { min: 2, max: 800 }, def: null },
  { name: "impact", loc: "annotation", req: false, expl: "Description of the business or operational impact.", c: { min: 2, max: 200 }, def: null },
  { name: "Runbook_url", loc: "annotation", req: false, expl: "Link to the alert runbook or makhteg (מקט'ג).", c: { min: 2, max: 200 }, def: null },
];
const FIELD = Object.fromEntries(STANDARD.map((f) => [f.name, f]));
// The migration form's order (migration-frontend sortFieldsForDisplay): site, required, with a default, the rest.
const FORM_FIELDS = STANDARD.filter((f) => f.name !== "Send-Alert" && f.name !== "Appchi-$operator").sort((a, b) => {
  if (a.name === "site") return -1;
  if (b.name === "site") return 1;
  if (a.req !== b.req) return a.req ? -1 : 1;
  if ((a.def != null) !== (b.def != null)) return a.def != null ? -1 : 1;
  return 0;
});
const ALERT_FIELDS = ["application", "component", "message", "severity", "node_name", "environment", "impact", "Runbook_url"];

// ---------------------------------------------------------------- bays: every rule is in exactly one
const STATE = {
  delete: { label: "Delete first", bay: "Delete", fix: "Reports a status or is hidden by your own dashboard.", c: "var(--ink)", t: "var(--ink)", act: "grafana", btn: "Delete in Grafana" },
  quiet: { label: "Fix the noise first", bay: "Fix the noise", fix: "Stuck or flapping. Fix it before you migrate.", c: "var(--red)", t: "var(--red)", act: "grafana", btn: "Fix in Grafana" },
  review: { label: "Review first", bay: "Review", fix: "Fix the message or the rule link while you migrate.", c: "var(--amber)", t: "var(--amber)", act: "migrate", btn: "Review and migrate" },
  auto: { label: "Ready to migrate", bay: "Ready to migrate", fix: "Nothing to fix first.", c: "var(--buff-2)", t: "var(--buff-ink)", act: "migrate", btn: "Migrate" },
  migrated: { label: "Migrated", bay: "Migrated", c: "var(--green)", t: "var(--green)" },
  v2: { label: "V2", bay: "V2", c: "var(--blue-2)", t: "var(--blue-ink)" },
};
const STATE_ORDER = ["delete", "quiet", "review", "auto", "migrated", "v2"];
const LANES = ["delete", "quiet", "review", "auto"];
const stVars = (k) => ` style="--c:${STATE[k].c};--t:${STATE[k].t}"`;
const VIEWS = [["overview", "Overview"], ["plan", "Action plan"], ["alerts", "Alerts"], ["rules", "Rules"], ["volume", "Volume"], ["history", "History"]];
const VIEW_LABEL = Object.fromEntries(VIEWS);
const WEEKLY_VIEWS = ["overview", "plan", "alerts", "volume"];
const PAGE_LABEL = { migrate: "Migrate rules", create: "New v2 rule", edit: "Edit v2 rule" };

// ---------------------------------------------------------------- sample data (invented)
const GRAFANA = "https://grafana.example.com";
const POLICIES = ["Appchi - checkout", "Appchi - cart", "Appchi - payments", "Appchi - batch", "Appchi - search", "Appchi - data", "Appchi - identity", "Appchi - notifications"];
const WEEKS = ["Nov 16 to 22", "Nov 9 to 15", "Nov 2 to 8", "Oct 26 to Nov 1", "Oct 19 to 25", "Oct 12 to 18"];
const PHASES = ["Phase 0, clean up", "Phase 1, new rules", "Phase 2, enrich", "Done"];
const PHASE_SHORT = ["Phase 0", "Phase 1", "Phase 2", "Done"];
const PROBLEMS = {
  "Heartbeat": ["Fires every few minutes whether or not anything is wrong.", "Alert on the absence of the signal."],
  "Hidden in panel": ["The team's dashboards filter this alert out.", "Show it on the team panel or delete the rule."],
  "Generic message": ["The message doesn't say what broke or where.", "Name the component and the condition."],
  "Critical, no runbook": ["A critical alert with no runbook.", "Add a runbook link."],
  "No rule URL": ["Not from a Grafana alert rule.", "Change it at the sender."],
};
const LDAP_GROUPS = ["Checkout Platform", "Payments Core", "Legacy Batch Jobs", "Search Infra", "Data Platform"];
const FOLDERS = { "ckt-api": "Checkout / API", "ckt-db": "Checkout / Databases", "ckt-workers": "Checkout / Workers", "pay-core": "Payments / Core", "batch": "Batch / Nightly" };

function rule(id, uid, title, folder, extra = {}) {
  return { id, uid, title, folder, schema: "v1", migrated: false, obs: {}, ...extra };
}
function alert(id, msg, app, comp, schema, problems, events, ruleId, extra = {}) {
  return { id, msg, app, comp, schema, problems, events, rule: ruleId, active: "1 h", pattern: null, firstSeen: "Nov 16, 08:12", lastSeen: "Nov 22, 23:40", ...extra };
}
function emptyTeamData() { return { phaseIdx: 0, history: [], rules: {}, alerts: [], folders: [] }; }
function parseFolder(url) {
  const m = String(url || "").match(/\/dashboards\/f\/([^/?#\s]+)(?:\/([^/?#\s]+))?/) || String(url || "").match(/\/folders\/([^/?#\s]+)/);
  if (!m) return null;
  if (!FOLDERS[m[1]]) FOLDERS[m[1]] = m[2] ? m[2].replace(/-/g, " ") : `Folder ${m[1]}`;
  return m[1];
}
// Rules that fired nothing this week, so the folders look like a real team's.
function quietRules(list) {
  const out = {};
  for (const [id, title, folder, kind, by, week] of list) {
    const uid = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const obs = { component: "api", application: "checkout", severity: "high", message: title };
    if (kind === "v2") out[id] = rule(id, uid, title, folder, { schema: "v2", obs: { ...obs, site: "tlv-1", operator: "Appchi - checkout" } });
    else out[id] = rule(id, uid, title, folder, { obs, ...(kind === "migrated" ? { migrated: true, migratedBy: by, migratedAt: week === 2 ? "4 Nov 2026" : "28 Oct 2026", migratedWeek: week } : {}) });
    if (kind === "migrated") out[`${id}-v2`] = rule(`${id}-v2`, `${uid}-v2`, `${title}-v2`, folder, { schema: "v2", copyOf: id, obs: { ...obs, site: "tlv-1", operator: "Appchi - checkout" } });
  }
  return out;
}
function seedTeams() {
  return [
    {
      id: "checkout", name: "Checkout Platform", phaseIdx: 1,
      v1ops: ["checkout-team", "CHECKOUT", "cart_svc"], v2ops: ["Appchi - checkout", "Appchi - cart"],
      folders: [`${GRAFANA}/dashboards/f/ckt-api/checkout-api`, `${GRAFANA}/dashboards/f/ckt-db/checkout-databases`, `${GRAFANA}/dashboards/f/ckt-workers/checkout-workers`],
      history: [
        { phase: 1, v1a: 10, v1e: 1120, v2a: 1, v2e: 9, rl: 5, v2ok: 1, mig: 1 },
        { phase: 1, v1a: 12, v1e: 1480, v2a: 0, v2e: 0, rl: 6, v2ok: 0, mig: 2 },
        { phase: 0, v1a: 13, v1e: 1610, v2a: 0, v2e: 0, rl: 6, v2ok: 0, mig: 1 },
        { phase: 0, v1a: 15, v1e: 2010, v2a: 0, v2e: 0, rl: 7, v2ok: 0, mig: 0 },
        { phase: 0, v1a: 16, v1e: 2240, v2a: 0, v2e: 0, rl: 7, v2ok: 0, mig: 0 },
      ],
      rules: {
        lat: rule("lat", "ckt-lat-p99", "Checkout latency p99", "ckt-api", { fanout: "service", obs: { component: "api", application: "{{ $labels.service }}", severity: "warn", message: "High latency on {{ $labels.service }}" } }),
        disk: rule("disk", "pg-disk-usage", "Postgres disk usage > 90%", "ckt-db", { fanout: "instance", obs: { component: "postgres", application: "payments-db", node_name: "{{ $labels.instance }}", severity: "critical", message: "Disk full on {{ $labels.instance }}" } }),
        queue: rule("queue", "settle-queue", "Settlement queue backlog", "ckt-workers", { obs: { component: "worker", application: "settlements", severity: "warning", message: "Queue backlog", environment: "production" } }),
        err: rule("err", "pay-err-rate", "Payment error rate", "ckt-api", { migrated: true, migratedBy: "noa.cohen", migratedAt: "12 Nov 2026", migratedWeek: 1, obs: { component: "api", application: "payments", severity: "critical", message: "Payment error rate above 2%" } }),
        "err-v2": rule("err-v2", "pay-err-rate-v2", "Payment error rate-v2", "ckt-api", { schema: "v2", copyOf: "err", obs: { component: "api", application: "payments", severity: "critical", message: "Payment error rate above 2%", site: "tlv-1", environment: "production", operator: "Appchi - checkout" } }),
        cpu: rule("cpu", "apigw-cpu", "API gateway CPU", "ckt-api", { schema: "v2", obs: { component: "gateway", application: "api-gw", severity: "critical", message: "CPU high on api-gw", site: "tlv-1", environment: "production", operator: "Appchi - checkout" } }),
        ...quietRules([
          ["q1", "Checkout 5xx ratio", "ckt-api", "v1"], ["q2", "Coupon service errors", "ckt-api", "v1"], ["q3", "Cart abandon spike", "ckt-api", "v1"],
          ["q4", "Checkout p50 latency", "ckt-api", "migrated", "noa.cohen", 2], ["q5", "Refund failures", "ckt-api", "v2"], ["q6", "API saturation", "ckt-api", "v2"],
          ["q7", "Postgres replication lag", "ckt-db", "v1"], ["q8", "Postgres connections", "ckt-db", "migrated", "dana.levi", 2], ["q9", "Redis memory", "ckt-db", "v2"],
          ["q10", "Redis evictions", "ckt-db", "v1"], ["q11", "Worker crash loop", "ckt-workers", "v1"], ["q12", "Job retries", "ckt-workers", "v2"],
          ["q13", "Dead letter queue", "ckt-workers", "migrated", "noa.cohen", 3], ["q14", "Payout delay", "ckt-workers", "v1"],
        ]),
      },
      alerts: [
        alert("c1", "Disk full on db-01", "payments-db", "postgres", "v1", ["Heartbeat", "Hidden in panel"], 342, "disk", { node: "db-01", active: "6 d 20 h", pattern: "Stuck" }),
        alert("c2", "Disk full on db-02", "payments-db", "postgres", "v1", ["Hidden in panel"], 201, "disk", { node: "db-02", active: "2 d 4 h" }),
        alert("c3", "High latency on checkout", "checkout", "api", "v1", ["Generic message"], 118, "lat", { active: "9 h", pattern: "Flapping" }),
        alert("c4", "High latency on refunds", "refunds", "api", "v1", ["Generic message"], 64, "lat", { active: "5 h" }),
        alert("c5", "Queue backlog on settlements", "settlements", "worker", "v1", ["Generic message"], 57, "queue", { active: "3 h" }),
        alert("c6", "Pod restarts in cart-svc", "cart", "k8s", "v1", ["No rule URL"], 33, null, { source: "Prometheus Alertmanager", sev: "warning", active: "40 min" }),
        alert("c7", "Payment error rate above 2%", "payments", "api", "v1", [], 21, "err", { active: "25 min" }),
        alert("c8", "Disk full on db-03", "payments-db", "postgres", "v1", [], 12, "disk", { node: "db-03", active: "50 min" }),
        alert("c9", "CPU high on api-gw", "api-gw", "gateway", "v2", ["Critical, no runbook"], 12, "cpu", { node: "gw-2", active: "3 h", pattern: "Flapping" }),
      ],
    },
    {
      id: "payments", name: "Payments Core", phaseIdx: 2,
      v1ops: ["payments_legacy"], v2ops: ["Appchi - payments"], folders: [`${GRAFANA}/dashboards/f/pay-core/payments-core`],
      history: [
        { phase: 2, v1a: 2, v1e: 30, v2a: 2, v2e: 51, rl: 2, v2ok: 1, mig: 1 },
        { phase: 1, v1a: 4, v1e: 88, v2a: 2, v2e: 40, rl: 3, v2ok: 1, mig: 1 },
        { phase: 1, v1a: 6, v1e: 140, v2a: 1, v2e: 22, rl: 4, v2ok: 0, mig: 0 },
        { phase: 1, v1a: 7, v1e: 190, v2a: 1, v2e: 10, rl: 5, v2ok: 0, mig: 1 },
        { phase: 0, v1a: 9, v1e: 260, v2a: 0, v2e: 0, rl: 6, v2ok: 0, mig: 0 },
      ],
      rules: {
        ledger: rule("ledger", "ledger-sync", "Ledger sync lag", "pay-core", { obs: { component: "sync", application: "ledger-sync-service-payments-core-reconciliation-backend", severity: "warning", message: "Ledger sync lag", site: "tlv-1" } }),
        settle: rule("settle", "settle-mismatch", "Settlement mismatch", "pay-core", { schema: "v2", obs: { component: "reconcile", application: "settlement", severity: "critical", message: "Settlement mismatch detected", site: "tlv-1", environment: "production", operator: "Appchi - payments" } }),
        auth: rule("auth", "card-auth-lat", "Card auth latency", "pay-core", { schema: "v2", obs: { component: "api", application: "card-auth", severity: "high", message: "Card auth latency above 800ms", site: "tlv-1", impact: "Card payments are slow", Runbook_url: "https://wiki/payments/card-auth", operator: "Appchi - payments" } }),
      },
      alerts: [
        alert("p1", "Settlement mismatch detected", "settlement", "reconcile", "v2", ["Critical, no runbook"], 44, "settle", { active: "1 d 2 h", pattern: "Stuck" }),
        alert("p2", "Card auth latency above 800ms", "card-auth", "api", "v2", [], 19, "auth", { active: "2 h" }),
        alert("p3", "Ledger sync lag", "ledger", "sync", "v1", ["Generic message"], 9, "ledger", { active: "30 min" }),
      ],
    },
    {
      id: "batch", name: "Legacy Batch Jobs", phaseIdx: 0,
      v1ops: ["batch-team", "BATCH_JOBS", "batch_svc"], v2ops: [], folders: [],
      history: [
        { phase: 0, v1a: 5, v1e: 80, v2a: 0, v2e: 0, rl: 2, v2ok: 0, mig: 0 },
        { phase: 0, v1a: 5, v1e: 95, v2a: 0, v2e: 0, rl: 2, v2ok: 0, mig: 0 },
        { phase: 0, v1a: 6, v1e: 120, v2a: 0, v2e: 0, rl: 3, v2ok: 0, mig: 0 },
        { phase: 0, v1a: 6, v1e: 110, v2a: 0, v2e: 0, rl: 3, v2ok: 0, mig: 0 },
        { phase: 0, v1a: 7, v1e: 150, v2a: 0, v2e: 0, rl: 3, v2ok: 0, mig: 0 },
      ],
      rules: {
        export: rule("export", "nightly-export", "Nightly export failed", "batch", { fanout: "job", obs: { component: "{{ $labels.job }}", application: "exporter", severity: "critical", message: "Nightly export failed: {{ $labels.job }}", Runbook_url: "https://wiki/batch/export" } }),
        dur: rule("dur", "batch-duration", "Batch runtime too long", "batch", { obs: { component: "runner", application: "batch", severity: "warn", message: "Batch took too long" } }),
      },
      alerts: [
        alert("b1", "Nightly export failed: orders", "exporter", "orders", "v1", ["Critical, no runbook"], 28, "export", { active: "7 h" }),
        alert("b2", "Nightly export failed: invoices", "exporter", "invoices", "v1", ["Critical, no runbook"], 17, "export", { active: "6 h" }),
        alert("b3", "Batch took too long", "batch", "runner", "v1", ["Generic message"], 15, "dur", { active: "2 h", pattern: "Flapping" }),
        alert("b4", "Batch runner heartbeat missing", "batch", "runner", "v1", ["No rule URL", "Heartbeat"], 7, null, { source: "Zabbix", sev: "warning", active: "1 d" }),
      ],
    },
    { id: "identity", name: "Identity & Access", ...emptyTeamData(), phaseIdx: 2, v1ops: [], v2ops: ["Appchi - identity"] },
    { id: "mobile", name: "Mobile Apps", ...emptyTeamData(), phaseIdx: 1, v1ops: ["mobile"], v2ops: ["Appchi - notifications"] },
  ];
}

// ---------------------------------------------------------------- state
let S;
function freshMig() {
  return {
    mode: "idle", queue: [], i: 0, done: [], skipped: [], folder: null, notice: null, error: null, input: "", origin: null, picked: new Set(),
    create: { folder: "", pick: null, title: "", policy: null, error: null },
  };
}
const freshFilter = () => ({ fix: true, schema: "all", q: "", app: "" });
function reset() {
  S = {
    screen: "login", user: null, loginError: null, teams: seedTeams(), teamId: null, newTeamId: null,
    view: "overview", page: null, alertId: null, ruleId: null, ruleFilter: "all", week: 0, filter: freshFilter(), selected: new Set(),
    mig: freshMig(), cre: freshMig(), edt: null, editLoad: { input: "", error: null }, policy: null,
  };
}
reset();

// ---------------------------------------------------------------- helpers
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plural = (n, w, ws = w + "s") => `${n} ${n === 1 ? w : ws}`;
const quoted = (alerts) => alerts.map((a) => `“${esc(a.msg)}”`).join(", ");
const sum = (list) => list.reduce((n, a) => n + a.events, 0);
const ruleUrl = (r) => `${GRAFANA}/alerting/grafana/${r.uid}/view`;
const folderUrl = (fuid) => `${GRAFANA}/dashboards/f/${fuid}/`;
const folderName = (fuid) => FOLDERS[fuid] || `Folder ${fuid}`;
const team = () => S.teams.find((t) => t.id === S.teamId);
const policyOf = (t) => S.policy || t.v2ops[0] || null;
const flow = () => (S.page === "create" ? S.cre : S.mig);
function resetFlow() { if (S.page === "create") S.cre = freshMig(); else S.mig = freshMig(); }
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const missingGroups = () => LDAP_GROUPS.filter((g) => !S.teams.some((t) => sameName(t.name, g)));
const folderUids = (t) => t.folders.map(parseFolder).filter(Boolean);
const copyOf = (t, r) => Object.values(t.rules).find((x) => x.copyOf === r.id && !x.deleted);
const liveRules = (t) => Object.values(t.rules).filter((r) => !r.deleted);
const icon = (id) => `<svg class="i" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const extLink = (href, label = "Open in Grafana") => `<a class="small" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${label} ${icon("ext").replace('class="i"', 'class="i" style="width:13px;height:13px;vertical-align:-2px"')}</a>`;

function toFix(t, a) { const r = a.rule && t.rules[a.rule]; return a.problems.length > 0 || (a.schema === "v1" && !(r && r.migrated)); }
function selectable(t, a) { const r = a.rule && t.rules[a.rule]; return a.schema === "v1" && !!r && r.schema === "v1" && !r.migrated && !r.deleted; }
function ruleCounts(t) { const m = {}; for (const a of t.alerts) if (a.rule) m[a.rule] = (m[a.rule] || 0) + 1; return m; }
// Rules with more than one alert this week get a letter, so their alerts read as one group.
function groupLetters(t) {
  const counts = ruleCounts(t), m = {};
  let i = 0;
  for (const a of [...t.alerts].sort((x, y) => y.events - x.events)) if (a.rule && counts[a.rule] > 1 && !m[a.rule]) m[a.rule] = String.fromCharCode(65 + i++);
  return m;
}
function selectionGroups(t) {
  const byRule = new Map();
  for (const a of t.alerts) { if (!S.selected.has(a.id)) continue; if (!byRule.has(a.rule)) byRule.set(a.rule, []); byRule.get(a.rule).push(a); }
  return [...byRule].map(([rid, sel]) => ({ rid, sel, rule: t.rules[rid], others: t.alerts.filter((a) => a.rule === rid && !S.selected.has(a.id)) }));
}
const byApp = (t) => t.alerts.filter((a) => !S.filter.app || a.app === S.filter.app);
function filtered(t) {
  const q = S.filter.q.trim().toLowerCase();
  return byApp(t)
    .filter((a) => !S.filter.fix || toFix(t, a))
    .filter((a) => S.filter.schema === "all" || a.schema === S.filter.schema)
    .filter((a) => !q || [a.msg, a.app, a.comp, a.rule ? (t.rules[a.rule] || {}).title : "", ...a.problems].join(" ").toLowerCase().includes(q))
    .sort((x, y) => y.events - x.events);
}
// The bay of one V1 alert, evaluated delete, noise, review, ready.
function laneOf(t, a) {
  if (a.schema !== "v1") return null;
  const r = a.rule && t.rules[a.rule];
  if (r && r.migrated) return "migrated";
  const has = (...ps) => ps.some((p) => a.problems.includes(p));
  if (has("Heartbeat", "Hidden in panel")) return "delete";
  if (a.pattern === "Stuck" || a.pattern === "Flapping") return "quiet";
  if (has("Generic message", "No rule URL", "Critical, no runbook")) return "review";
  return "auto";
}
// A rule's bay: v2, migrated, or the most urgent bay of its alerts this week.
function ruleState(t, r) {
  if (r.schema === "v2") return "v2";
  if (r.migrated) return "migrated";
  const lanes = t.alerts.filter((a) => a.rule === r.id).map((a) => laneOf(t, a));
  return ["delete", "quiet", "review"].find((k) => lanes.includes(k)) || "auto";
}
function v2Cat(a) {
  if (a.problems.includes("Heartbeat") || a.problems.includes("Hidden in panel")) return "delete";
  if (a.problems.includes("Generic message")) return "message";
  return "ok";
}
// The team's rules: its folders plus any rule that fired this week.
function teamRules(t) {
  const fu = folderUids(t), fired = new Set(t.alerts.map((a) => a.rule).filter(Boolean));
  return liveRules(t).filter((r) => (fu.includes(r.folder) || fired.has(r.id)) && !r.isNew);
}
const boardRules = (t) => teamRules(t).filter((r) => !r.copyOf);
function laneGroups(t, key) {
  const groups = new Map();
  for (const a of byApp(t)) {
    if (laneOf(t, a) !== key) continue;
    const id = a.rule || `app:${a.app}`;
    if (!groups.has(id)) groups.set(id, { id, rid: a.rule, app: a.app, alerts: [] });
    groups.get(id).alerts.push(a);
  }
  return [...groups.values()].sort((x, y) => y.alerts.length - x.alerts.length || sum(y.alerts) - sum(x.alerts));
}

// Field checks, as in the migration tool's FieldRenderer.
function valid(f, v) {
  const c = f.c;
  if (c.exact != null && v !== c.exact) return false;
  if (c.starts != null && !v.startsWith(c.starts)) return false;
  if (c.allowed && !c.allowed.includes(v)) return false;
  if (c.min != null && v.length < c.min) return false;
  if (c.max != null && v.length > c.max) return false;
  return true;
}
function invalidReason(f, v) {
  const c = f.c;
  if (c.allowed && !c.allowed.includes(v)) return `“${v}” is not an allowed value`;
  if (c.min != null && v.length < c.min) return `Shorter than ${c.min} characters`;
  if (c.max != null && v.length > c.max) return `Longer than ${c.max} characters`;
  return "Value does not meet the standard";
}
function fieldState(f, v) {
  const has = v != null && v !== "";
  if (has && valid(f, v)) return { kind: "carried" };
  if (has) return f.def != null ? { kind: "default" } : { kind: "needs", reason: invalidReason(f, v) };
  if (f.req) return { kind: "empty" };
  return f.def != null ? { kind: "default" } : { kind: "optional" };
}
function constraintText(f) {
  const c = f.c, parts = [];
  if (c.min != null) parts.push(`min ${c.min} chars`);
  if (c.max != null) parts.push(`max ${c.max} chars`);
  if (c.allowed) parts.push(`allowed: ${c.allowed.join(", ")}`);
  if (f.def != null) parts.push(`default: ${f.def}`);
  return parts.join(", ");
}
function badgeHtml(f, st) {
  if (st.kind === "carried") return '<span class="badge carried">Carried over</span>';
  if (st.kind === "default") return `<span class="badge default">Default applied: ${esc(f.def)}</span>`;
  if (st.kind === "empty") return '<span class="badge empty">Required</span>';
  if (st.kind === "needs") return st.reason ? `<div class="reason"><span class="badge needs">Needs input</span><span>${esc(st.reason)}</span></div>` : '<span class="badge needs">Needs input</span>';
  return "";
}
function cubeHead(f, forId) {
  const name = `${esc(f.name)}${f.req ? '<span class="req">*</span>' : ""}`;
  return `<div class="fh">${forId ? `<label for="${forId}">${name}</label>` : `<b>${name}</b>`}<span class="loc">${f.loc}</span></div><p class="explanation">${esc(f.expl)}</p><p class="constraints">${esc(constraintText(f))}</p>`;
}
function editableCubes(values, obs, attr) {
  return FORM_FIELDS.map((f) => {
    const v = values[f.name] ?? "";
    const id = `${attr === "data-efield" ? "e" : "f"}-${f.name}`;
    const control = f.c.allowed
      ? `<select id="${id}" ${attr}="${f.name}"><option value="">Select</option>${f.c.allowed.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select>`
      : `<input id="${id}" ${attr}="${f.name}" value="${esc(v)}" placeholder="${esc(f.def || "")}">`;
    return `<div class="field-row">${cubeHead(f, id)}${control}${badgeHtml(f, fieldState(f, obs[f.name]))}</div>`;
  }).join("");
}
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

// ---------------------------------------------------------------- the strip
// One rule at every size. opts: count, act, check, marks, meta, hero, tall.
function strip(t, r, o = {}) {
  const fmt = r.schema === "v2" ? "v2" : "v1";
  const st = ruleState(t, r);
  const n = o.count != null ? o.count : ruleCounts(t)[r.id] || 0;
  const meta = o.meta != null ? o.meta : `<span class="state"${stVars(st)}><i></i>${STATE[st].label}</span>`;
  const title = o.hero ? `<h1>${esc(r.title)}</h1>` : `<button class="title" data-action="open-rule" data-rule="${r.id}">${esc(r.title)}</button>`;
  if (o.tall) {
    return `<div class="strip tall ${fmt}"><div class="holder"><span class="cs">${esc(r.uid)}</span><span class="fmt">${fmt}</span></div>
      <div class="body">${title}${o.marks ? `<div class="row" style="gap:4px;margin-top:4px">${o.marks}</div>` : ""}</div>
      <div class="foot"><span class="c"><b>${n}</b> ${n === 1 ? "alert" : "alerts"}${o.events != null ? `, <b>${o.events.toLocaleString()}</b> events` : ""}</span><span class="grow"></span>${o.act || ""}</div></div>`;
  }
  return `<div class="strip ${fmt}${o.hero ? " hero" : ""}">${o.check ? `<span class="chk">${o.check}</span>` : ""}
    <span class="holder"><span class="fmt">${fmt}</span><span class="cs">${esc(r.uid)}</span></span>
    <span class="body">${title}<span class="meta">${meta}</span></span>
    ${o.marks ? `<span class="marks">${o.marks}</span>` : ""}
    <span class="count"><b>${n}</b><small>${n === 1 ? "alert" : "alerts"}</small></span>
    ${o.act ? `<span class="act">${o.act}</span>` : ""}</div>`;
}
const marksFor = (alerts) => [...new Set(alerts.flatMap((a) => [...a.problems, ...(a.pattern ? [a.pattern] : [])]))].map((p) => `<span class="mk">${esc(p)}</span>`).join("");
const stateLabel = (k) => `<span class="state"${stVars(k)}><i></i>${STATE[k].label}</span>`;

// ---------------------------------------------------------------- shell
function topbar() {
  const t = S.screen === "team" ? team() : null;
  let path = "";
  if (t) {
    path = `<nav class="path" aria-label="Breadcrumb"><span class="sep">/</span><button data-action="go-teams">Teams</button><span class="sep">/</span>
      <label class="sr" for="team-switch">Team</label><select id="team-switch">${[...S.teams].sort((a, b) => a.name.localeCompare(b.name)).map((x) => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      ${S.page ? `<span class="sep">/</span><span>${PAGE_LABEL[S.page]}</span>` : ""}</nav>`;
  }
  return `<header class="topbar"><a class="brand" href="#" data-action="home"><svg aria-hidden="true"><use href="#logo"/></svg>icecream</a>${path}
    <div class="who"><span>${esc(S.user)}</span><button data-action="logout">Sign out</button></div></header>`;
}
function scopeControls(t) {
  const apps = [...new Set(t.alerts.map((a) => a.app))].sort();
  return `<div class="scope"><label class="sr" for="week-select">Week</label><select id="week-select" class="sm">${WEEKS.map((w, i) => `<option value="${i}" ${i === S.week ? "selected" : ""}>Week of ${w}</option>`).join("")}</select>
    <label class="sr" for="app-select">Applications</label><select id="app-select" class="sm"><option value="">All applications</option>${apps.map((a) => `<option value="${esc(a)}" ${a === S.filter.app ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></div>`;
}

// ---------------------------------------------------------------- login + teams
function loginView() {
  return `<div class="login"><form data-form="login" novalidate>
    <span class="brand"><svg aria-hidden="true"><use href="#logo"/></svg>icecream</span>
    <h1 style="font-size:22px">Sign in</h1>
    <div class="field"><label for="username">Username</label><input id="username" autocomplete="username"></div>
    <div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password"></div>
    ${S.loginError ? `<div class="error" role="alert">${esc(S.loginError)}</div>` : ""}
    <button class="btn primary" type="submit">Sign in</button></form></div>`;
}
function teamsView() {
  const teams = [...S.teams].sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="thead"><h1>Teams</h1><div class="acts"><button class="btn primary" data-action="new-team">${icon("plus")}New team</button></div></div>
  <ul class="teams">${teams.map((t) => `<li class="${t.id === S.newTeamId ? "just-added" : ""}"><button class="open" data-action="open-team" data-team="${t.id}">${esc(t.name)}</button><button class="btn sm" data-action="edit-team" data-team="${t.id}" aria-label="Edit ${esc(t.name)}">${icon("edit")}Edit</button></li>`).join("")}</ul>`;
}

// ---------------------------------------------------------------- team workspace
function teamView() {
  const t = team();
  if (S.page) return actionPage(t);
  if (S.view === "rules" && S.ruleId && t.rules[S.ruleId]) return rulePage(t);
  if (S.view === "alerts" && S.alertId) return alertPage(t);
  const fix = t.alerts.filter((a) => toFix(t, a)).length;
  const tab = ([k, l]) => `<button role="tab" aria-selected="${S.view === k}" data-action="view" data-view="${k}">${l}${k === "alerts" && fix ? `<span class="n">${fix}</span>` : ""}${k === "rules" ? `<span class="n">${boardRules(t).length}</span>` : ""}</button>`;
  const body = { overview: overviewPage, plan: planPage, alerts: alertsPage, rules: rulesPage, volume: volumePage, history: historyPage }[S.view](t);
  return `${teamHead(t)}<div class="tabbar"><div class="tabs" role="tablist">${VIEWS.map(tab).join("")}</div>${WEEKLY_VIEWS.includes(S.view) ? scopeControls(t) : ""}</div>${body}`;
}
// The three actions sit in the same place on every team page; sub-pages put a back link where the team name goes.
function teamHead(t, left) {
  const inProgress = S.mig.mode === "rule";
  return `<div class="thead">${left || `<h1>${esc(t.name)}</h1>`}<div class="acts">
    <button class="btn primary" data-action="open-page" data-page="migrate">${icon("migrate")}${inProgress ? "Continue migrating" : "Migrate rules"}</button>
    <button class="btn" data-action="open-page" data-page="create">${icon("plus")}New v2 rule</button>
    <button class="btn" data-action="open-page" data-page="edit">${icon("edit")}Edit v2 rule</button></div></div>`;
}
const alertLink = (a) => `<button class="tlink" data-action="open-alert" data-id="${a.id}">“${esc(a.msg)}”</button>`;

// Overview: how far the team is, what fired this week compared with last week, and what is wrong.
function overviewPage(t) {
  const rules = boardRules(t);
  const byState = Object.fromEntries(STATE_ORDER.map((k) => [k, []]));
  for (const r of rules) byState[ruleState(t, r)].push(r);
  const onV2 = byState.migrated.length + byState.v2.length;
  const rack = rules.length ? `<section><h2>${onV2} of ${plural(rules.length, "rule")} ${onV2 === 1 ? "is" : "are"} on v2</h2>
    <div class="rack">${STATE_ORDER.filter((k) => byState[k].length).map((k) => `<div class="rack-g"${stVars(k)}>
      <div class="rack-ends">${byState[k].map((r) => `<button class="rack-end" data-action="open-rule" data-rule="${r.id}" title="${esc(r.title)}" aria-label="${esc(r.title)}, ${STATE[k].label}"></button>`).join("")}</div>
      <button class="lab" data-action="rules-state" data-state="${k}"><b>${byState[k].length}</b>${STATE[k].bay}</button></div>`).join("")}</div></section>`
    : `<section class="panel stack"><h2>No rules yet</h2><p class="muted">Add the team's Grafana folders and its rules appear here, sorted into bays.</p><div><button class="btn sm" data-action="edit-team">Add folders</button></div></section>`;

  const list = byApp(t);
  const v1 = list.filter((a) => a.schema === "v1"), v2 = list.filter((a) => a.schema === "v2");
  const prev = t.history[0];
  const migWeek = liveRules(t).filter((r) => r.migrated && r.migratedWeek === 0).length;
  const rows = [
    ["Appchi alerts", v1.length, prev && prev.v1a],
    ["Appchi events", sum(v1).toLocaleString(), prev && prev.v1e.toLocaleString()],
    ["v1 rules that fired", new Set(v1.filter((a) => a.rule && !(t.rules[a.rule] || {}).migrated).map((a) => a.rule)).size, prev && prev.rl],
    ["Appchi V2 alerts", v2.length, prev && prev.v2a],
    ["V2 alerts meeting the standard", `${v2.filter((a) => v2Cat(a) === "ok").length} of ${v2.length}`, prev && `${prev.v2ok} of ${prev.v2a}`],
    ["Rules migrated", migWeek, prev && prev.mig],
  ];
  const week = t.alerts.length ? `<section class="stack" style="gap:8px"><h2>This week</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">Week of ${WEEKS[S.week]}</th><th class="r">Week before</th></tr></thead><tbody>
    ${rows.map(([k, a, b]) => `<tr><td>${k}</td><td class="r"><b>${a}</b></td><td class="r muted">${b ?? ""}</td></tr>`).join("")}</tbody></table></div></section>` : "";

  const probs = Object.keys(PROBLEMS).map((p) => {
    const hit = list.filter((a) => a.problems.includes(p));
    return [p, hit.length, new Set(hit.map((a) => a.rule).filter(Boolean)).size];
  }).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const problems = probs.length ? `<section class="stack" style="gap:8px"><h2>Problems this week</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Problem</th><th class="r">Alerts</th><th class="r">Rules</th><th></th></tr></thead><tbody>
    ${probs.map(([p, n, r]) => `<tr><td><span class="mk">${esc(p)}</span></td><td class="r">${n}</td><td class="r">${r}</td><td class="r"><button class="link small" data-action="show-problem" data-p="${esc(p)}">Show alerts</button></td></tr>`).join("")}</tbody></table></div></section>` : "";

  const loudest = [...list].sort((a, b) => b.events - a.events)[0];
  const leftRules = rules.filter((r) => r.schema === "v1" && !r.migrated).length;
  return `<div class="ov"><div class="ov-main">${rack}${week}${problems}</div>
    <aside class="ov-side">
      <section><h3>Phase</h3><ol class="phase">${PHASES.map((n, i) => `<li class="${i === t.phaseIdx ? "on" : i < t.phaseIdx ? "done" : ""}">${n}</li>`).join("")}</ol>
        <dl class="kv"><dt>v1 rules left</dt><dd>${leftRules}</dd><dt>Migrated, all time</dt><dd>${byState.migrated.length}</dd></dl></section>
      <section><h3>Operators</h3><p class="small muted" style="margin-bottom:5px">v1</p>${t.v1ops.length ? t.v1ops.map((o) => `<span class="op">${esc(o)}</span>`).join("") : '<span class="small muted">None</span>'}
        <p class="small muted" style="margin:8px 0 5px">v2</p>${t.v2ops.length ? t.v2ops.map((o) => `<span class="op">${esc(o)}</span>`).join("") : '<span class="small muted">None yet</span>'}</section>
      ${loudest ? `<section><h3>Loudest alert</h3>${alertLink(loudest)}<span class="sub">${esc(loudest.app)}, ${esc(loudest.comp)}, ${loudest.events.toLocaleString()} events</span></section>` : ""}
    </aside></div>`;
}

// Action plan: the bays. Each strip is one Grafana rule, or one sender with no rule.
function planPage(t) {
  const list = byApp(t);
  const v1 = list.filter((a) => a.schema === "v1"), v2 = list.filter((a) => a.schema === "v2");
  if (!v1.length && !v2.length) return '<section class="panel"><h2>No alerts this week</h2></section>';
  const actFor = (k, g, primary) => {
    if (!g.rid) return '<span class="small muted">Change at the sender</span>';
    const s = STATE[k];
    if (s.act === "grafana") return `<a class="btn sm" href="${ruleUrl(t.rules[g.rid])}" target="_blank" rel="noopener noreferrer">${s.btn}${icon("ext")}</a>`;
    return `<button class="btn ${primary ? "primary" : ""} sm" data-action="plan-migrate" data-rule="${g.rid}" data-lane="${k}">${s.btn}</button>`;
  };
  const elsewhere = (g, k) => {
    if (!g.rid) return "";
    const other = {};
    for (const a of t.alerts) { const l = laneOf(t, a); if (a.rule === g.rid && l && l !== k) other[l] = (other[l] || 0) + 1; }
    return Object.entries(other).map(([l, n]) => `<span class="mk" style="color:var(--mark)">${n} more in ${STATE[l].bay}</span>`).join("");
  };
  const groupStrip = (k, g, o) => {
    if (g.rid) return strip(t, t.rules[g.rid], { count: g.alerts.length, events: sum(g.alerts), marks: marksFor(g.alerts) + elsewhere(g, k), ...o });
    return `<div class="strip api${o.tall ? " tall" : ""}"><span class="holder"><span class="fmt">API</span><span class="cs">${esc(g.app)}</span></span>
      <span class="body"><b>${esc(g.app)}</b><span class="meta">No Grafana rule</span></span>${o.tall ? `<div class="foot"><span class="c"><b>${g.alerts.length}</b> ${g.alerts.length === 1 ? "alert" : "alerts"}</span><span class="grow"></span>${o.act}</div>` : `<span class="count"><b>${g.alerts.length}</b><small>alerts</small></span><span class="act">${o.act}</span>`}</div>`;
  };
  const start = [];
  for (const k of LANES) for (const g of laneGroups(t, k).slice(0, 2)) if (start.length < 5) start.push({ k, g });
  const startHtml = start.length ? `<section class="stack" style="gap:8px"><h2>Start here</h2><ol class="start">${start.map(({ k, g }, i) => `<li><span class="step">${i + 1}</span>${groupStrip(k, g, { meta: stateLabel(k), act: actFor(k, g, true) })}</li>`).join("")}</ol></section>` : "";
  const bays = LANES.map((k) => {
    const groups = laneGroups(t, k);
    const n = groups.reduce((x, g) => x + g.alerts.length, 0);
    return `<section class="bay"${stVars(k)}><div class="bay-h"><h3>${STATE[k].bay}</h3><span class="cnt">${n}</span></div><p>${STATE[k].fix}</p>
      ${groups.length ? groups.map((g) => groupStrip(k, g, { tall: true, act: actFor(k, g, false) })).join("") : '<p class="none">Nothing here this week.</p>'}</section>`;
  }).join("");
  const migratedN = v1.filter((a) => laneOf(t, a) === "migrated").length;
  const cats = [["ok", "meet the standard"], ["message", "need a better message"], ["delete", "should be deleted"]].map(([k, l]) => [v2.filter((a) => v2Cat(a) === k).length, l]).filter(([n]) => n);
  const noRunbook = v2.filter((a) => a.problems.includes("Critical, no runbook")).length;
  return `${startHtml}<section class="stack" style="gap:8px"><div class="row"><h2>Appchi alerts by bay</h2><span class="muted small">${plural(v1.length, "alert")}${migratedN ? `, ${migratedN} from rules already migrated` : ""}</span></div><div class="bays">${bays}</div></section>
  ${v2.length ? `<section class="stack" style="gap:6px"><h2>Appchi V2</h2><p class="muted">${cats.map(([n, l]) => `${n} ${l}`).join(", ")}${noRunbook ? `. For phase 2, ${noRunbook} critical without a runbook.` : "."}</p></section>` : ""}`;
}

function seg(key, options, active) {
  return `<div class="seg" role="group">${options.map(([v, label]) => `<button type="button" data-action="filter" data-key="${key}" data-val="${v}" aria-pressed="${v === active}">${label}</button>`).join("")}</div>`;
}
function alertsPage(t) {
  if (!t.alerts.length) return '<section class="panel"><h2>No alerts this week</h2></section>';
  const list = filtered(t);
  const counts = ruleCounts(t), letters = groupLetters(t), groups = selectionGroups(t);
  const selPerRule = Object.fromEntries(groups.map((g) => [g.rid, g.sel.length]));
  const rows = list.map((a) => alertRow(t, a, counts, letters, selPerRule)).join("") || '<tr><td colspan="6" class="empty">No alerts match these filters. Try All, or clear the search.</td></tr>';
  return `<div class="toolbar">${seg("fix", [["1", "To fix"], ["0", "All"]], S.filter.fix ? "1" : "0")}${seg("schema", [["all", "v1 and v2"], ["v1", "v1"], ["v2", "v2"]], S.filter.schema)}
      <input id="alert-search" class="search" type="search" placeholder="Search alerts, rules or problems" aria-label="Search alerts, rules or problems" value="${esc(S.filter.q)}"><span class="grow"></span><span class="muted small">${plural(list.length, "alert")}</span></div>
    ${selbar(t, groups, letters)}
    <div class="tbl-wrap"><table class="tbl alerts"><thead><tr><th class="pick"><span class="sr">Select</span></th><th>Alert</th><th>Rule</th><th>Problems</th><th class="r">Events</th><th><span class="sr">Action</span></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function alertRow(t, a, counts, letters, selPerRule) {
  const r = a.rule ? t.rules[a.rule] : null;
  const L = a.rule ? letters[a.rule] : null;
  const can = selectable(t, a);
  const isSel = S.selected.has(a.id);
  const ruleOn = !!(a.rule && selPerRule[a.rule]);
  const cls = [isSel && "sel", L && ruleOn && (isSel ? "gsel" : "gsib")].filter(Boolean).join(" ");
  const pick = can ? `<input type="checkbox" id="pick-${a.id}" data-action="pick" data-id="${a.id}" ${isSel ? "checked" : ""} aria-label="Select “${esc(a.msg)}” to migrate its rule">` : "";
  let ruleCell;
  if (!r) ruleCell = `<span class="muted">No Grafana rule</span><span class="sub">${esc(a.source || "")}</span>`;
  else {
    ruleCell = `<span class="mini ${r.schema}"><span class="h">${r.schema}</span><button class="tlink" data-action="open-rule" data-rule="${r.id}">${esc(r.title)}</button></span>`;
    if (L) ruleCell += `<span class="grp" title="Group ${L}: ${counts[a.rule]} alerts this week come from this rule">${L}</span><span class="small muted">${counts[a.rule]} alerts</span>`;
    if (isSel && L && selPerRule[a.rule] > 1) ruleCell += `<div class="note">Same rule as ${plural(selPerRule[a.rule] - 1, "other selected alert")}</div>`;
    else if (!isSel && ruleOn && can) ruleCell += '<div class="note dashed">Changes too: same rule as a selected alert</div>';
  }
  const migrated = r && r.migrated && a.schema === "v1";
  const chips = a.problems.map((p) => `<span class="mk">${esc(p)}</span>`);
  if (migrated) chips.push('<span class="mk ok">Migrated</span>');
  let action = "";
  if (can) action = `<button class="btn primary sm" data-action="migrate-one" data-id="${a.id}">Migrate</button>`;
  else if (r && r.schema === "v2" && !r.deleted) action = `<button class="btn sm" data-action="edit-rule" data-rule="${r.id}">Edit</button>`;
  return `<tr class="${cls}"><td class="pick">${pick}</td><td>${alertLink(a)}<span class="sub">${esc(a.app)}, ${esc(a.comp)}</span></td><td>${ruleCell}</td>
    <td><div class="row" style="gap:4px">${chips.join("") || '<span class="muted small">None</span>'}</div></td><td class="r"><b>${a.events.toLocaleString()}</b></td><td class="r">${action}</td></tr>`;
}
function selbar(t, groups, letters) {
  if (!groups.length) return "";
  const nAlerts = groups.reduce((n, g) => n + g.sel.length, 0);
  const items = groups.map((gr) => {
    const L = letters[gr.rid];
    return `<li>${L ? `<span class="grp" style="margin-left:0">${L}</span>` : ""}<b>${esc(gr.rule.title)}</b>${gr.sel.length > 1 ? '<span class="small" style="color:var(--mark);font-weight:650"> same rule</span>' : ""}<span class="sub">${quoted(gr.sel)}</span>
      ${gr.others.length ? `<div class="also">Also from this rule: ${quoted(gr.others)} <button class="link" data-action="select-siblings" data-rule="${gr.rid}">Select</button></div>` : ""}</li>`;
  }).join("");
  return `<div class="selbar"><div class="selbar-top"><span aria-live="polite"><b>${plural(nAlerts, "alert")}</b> selected, from <b>${plural(groups.length, "rule")}</b></span><span class="grow"></span>
    <button class="btn sm" data-action="clear-sel">Clear</button><button class="btn primary sm" data-action="migrate-selected">${icon("migrate")}Migrate ${plural(groups.length, "rule")}</button></div><ul class="selgroups">${items}</ul></div>`;
}

// Rules: live, from the team's folders, filterable by bay.
function ruleAct(t, r) {
  if (r.schema === "v1" && !r.migrated) return `<button class="btn primary sm" data-action="rules-migrate" data-rule="${r.id}">Migrate</button>`;
  if (r.schema === "v1") { const c = copyOf(t, r); return c ? `<button class="btn sm" data-action="open-rule" data-rule="${c.id}">Open v2 copy</button>` : ""; }
  return `<button class="btn sm" data-action="edit-rule" data-rule="${r.id}">${icon("edit")}Edit</button>`;
}
function ruleMeta(t, r) {
  const st = ruleState(t, r);
  if (r.migrated) return `${stateLabel(st)} <span class="small muted">by ${esc(r.migratedBy)}, ${esc(r.migratedAt)}</span>`;
  if (r.copyOf && t.rules[r.copyOf]) return `${stateLabel(st)} <span class="small muted">copy of ${esc(t.rules[r.copyOf].title)}</span>`;
  if (r.created && !r.copyOf) return `${stateLabel(st)} <span class="small muted">new</span>`;
  return stateLabel(st);
}
function rulesPage(t) {
  const rules = teamRules(t);
  if (!t.folders.length && !rules.length) return `<section class="panel stack"><h2>No folders yet</h2><p class="muted">Add the team's Grafana folders and their rules are listed here.</p><div><button class="btn primary sm" data-action="edit-team">Add folders</button></div></section>`;
  const counts = ruleCounts(t), f = S.ruleFilter;
  const board = rules.filter((r) => !r.copyOf);
  const shown = rules.filter((r) => f === "all" || ruleState(t, r) === f);
  const filters = [["all", "All rules", null], ...STATE_ORDER.map((k) => [k, STATE[k].bay, k])].map(([k, label, st]) =>
    `<button data-action="rule-filter" data-state="${k}" aria-pressed="${f === k}"${st ? stVars(st) : ""}>${st ? "<i></i>" : ""}${label} <span>${k === "all" ? rules.length : rules.filter((r) => ruleState(t, r) === k).length}</span></button>`).join("");
  const fu = folderUids(t);
  const blocks = [...t.folders.map((url) => ({ url, fuid: parseFolder(url) })), { url: null, fuid: null }].map(({ url, fuid }) => {
    const inGroup = (r) => (fuid ? r.folder === fuid : !fu.includes(r.folder));
    const rs = shown.filter(inGroup).sort((a, b) => STATE_ORDER.indexOf(ruleState(t, a)) - STATE_ORDER.indexOf(ruleState(t, b)) || a.title.localeCompare(b.title));
    if (!rs.length) return "";
    const all = board.filter(inGroup), ready = all.filter((r) => r.schema === "v1" && !r.migrated);
    return `<section class="folder"><div class="folder-h"><div>${url ? `<a class="code" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : "<h3>Other rules that fired this week</h3>"}
        <div class="counts"><span><b>${ready.length}</b> v1 left</span><span><b>${all.filter((r) => r.migrated).length}</b> migrated</span><span><b>${all.filter((r) => r.schema === "v2").length}</b> v2</span></div></div>
        ${url && ready.length ? `<button class="btn sm" data-action="rules-migrate-folder" data-folder="${esc(fuid)}">${icon("migrate")}Migrate ${plural(ready.length, "v1 rule")}</button>` : ""}</div>
      ${rs.map((r) => strip(t, r, { count: counts[r.id] || 0, meta: ruleMeta(t, r), marks: marksFor(t.alerts.filter((a) => a.rule === r.id)), act: ruleAct(t, r) })).join("")}</section>`;
  }).join("");
  return `<div class="rfilters" role="group" aria-label="Show rules in a bay">${filters}</div>${blocks || '<p class="muted">No rules in this bay.</p>'}`;
}

// The rule page: this week's alerts and the migration, side by side, under the rule's own strip.
function rulePage(t) {
  const r = t.rules[S.ruleId];
  const st = ruleState(t, r);
  const alerts = t.alerts.filter((a) => a.rule === r.id).sort((a, b) => b.events - a.events);
  const problems = [...new Set(alerts.flatMap((a) => a.problems))];
  const copy = copyOf(t, r), original = r.copyOf ? t.rules[r.copyOf] : null;
  let act = "";
  if (r.schema === "v1" && !r.migrated) act = `<button class="btn primary" data-action="rules-migrate" data-rule="${r.id}">${icon("migrate")}Migrate</button>`;
  if (r.schema === "v2") act = `<button class="btn primary" data-action="edit-rule" data-rule="${r.id}">${icon("edit")}Edit v2 rule</button>`;
  let migration;
  if (r.schema === "v1" && r.migrated) migration = `<dl class="kv"><dt>Migrated by</dt><dd>${esc(r.migratedBy)}</dd><dt>On</dt><dd>${esc(r.migratedAt)}</dd></dl>${copy ? `<p style="margin-top:10px">V2 copy: <button class="link" data-action="open-rule" data-rule="${copy.id}">${esc(copy.title)}</button></p>` : ""}`;
  else if (r.schema === "v1") migration = `<p>${stateLabel(st)}</p><p class="small muted" style="margin-top:6px">${STATE[st].fix}</p>`;
  else if (original) migration = `<p>Created from <button class="link" data-action="open-rule" data-rule="${original.id}">${esc(original.title)}</button> by migration.</p>`;
  else migration = "<p>Written as a v2 rule.</p>";
  const obs = r.obs || {};
  const labels = ["application", "component", "severity", "site", "environment", "message", "operator"].filter((k) => obs[k]).map((k) => `<dt>${k}</dt><dd class="code" style="text-align:left;font-weight:500">${esc(obs[k])}</dd>`).join("");
  return `${teamHead(t, `<button class="link small" data-action="close-rule">${icon("back")}All rules</button>`)}
  ${strip(t, r, { hero: true, count: alerts.length, meta: `${stateLabel(st)} <span class="small muted">${esc(folderName(r.folder))}</span> ${extLink(ruleUrl(r))}`, act })}
  <div class="split"><div class="stack" style="gap:26px">
    <section class="stack" style="gap:8px"><h2>This week</h2>${alerts.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Alert</th><th>Bay</th><th class="r">Events</th></tr></thead><tbody>
      ${alerts.map((a) => { const l = laneOf(t, a); return `<tr><td>${alertLink(a)}<span class="sub">${esc(a.app)}, ${esc(a.comp)}</span></td><td>${l && STATE[l] ? stateLabel(l) : ""}</td><td class="r">${a.events.toLocaleString()}</td></tr>`; }).join("")}</tbody></table></div>` : '<p class="muted">This rule fired no alerts this week.</p>'}</section>
    ${problems.length ? `<section class="stack" style="gap:4px"><h2>What to fix</h2>${problems.map((p) => { const [w, f] = PROBLEMS[p] || ["", ""]; return `<div class="prob"><span class="mk">${esc(p)}</span><span>${esc(w)} <b>${esc(f)}</b></span></div>`; }).join("")}</section>` : ""}
  </div><aside class="stack">
    <section class="panel"><h3 style="margin-bottom:8px">Migration</h3>${migration}</section>
    ${labels ? `<section class="panel white"><h3 style="margin-bottom:4px">Labels and annotations</h3><dl class="kv">${labels}</dl></section>` : ""}
  </aside></div>`;
}

function volumePage(t) {
  if (!t.alerts.length) return '<section class="panel"><h2>No alerts this week</h2></section>';
  const list = [...byApp(t)].sort((a, b) => b.events - a.events);
  const max = Math.max(...list.map((a) => a.events), 1);
  return `<div class="tbl-wrap"><table class="tbl wide"><thead><tr><th>Alert</th><th>Format</th><th>Events</th><th>Active for</th><th>Pattern</th></tr></thead><tbody>
    ${list.map((a) => `<tr><td>${alertLink(a)}<span class="sub">${esc(a.app)}, ${esc(a.comp)}</span></td><td>${a.schema}</td>
      <td><div class="hbar" style="--c:${a.schema === "v1" ? "var(--buff-2)" : "var(--blue-2)"}"><b>${a.events.toLocaleString()}</b><i style="width:${Math.max(3, (a.events / max) * 160)}px"></i></div></td>
      <td>${esc(a.active)}</td><td>${a.pattern ? `<span class="mk">${a.pattern}</span>` : ""}</td></tr>`).join("")}</tbody></table></div>`;
}

// History with progress: the phase line, then one row per week with bars to compare.
function weekRows(t) {
  const v1 = t.alerts.filter((a) => a.schema === "v1"), v2 = t.alerts.filter((a) => a.schema === "v2");
  return [{ phase: t.phaseIdx, v1a: v1.length, v1e: sum(v1), v2a: v2.length, v2e: sum(v2),
    rl: new Set(v1.filter((a) => a.rule && !(t.rules[a.rule] || {}).migrated).map((a) => a.rule)).size,
    v2ok: v2.filter((a) => v2Cat(a) === "ok").length, mig: liveRules(t).filter((r) => r.migrated && r.migratedWeek === 0).length }, ...t.history];
}
function historyPage(t) {
  if (!t.alerts.length) return '<section class="panel"><h2>No published weeks yet</h2></section>';
  const rows = weekRows(t);
  const mx = (k) => Math.max(...rows.map((r) => r[k]), 1);
  const bar = (v, k, c) => `<div class="hbar" style="--c:${c}"><b>${v.toLocaleString()}</b><i style="width:${Math.max(3, (v / mx(k)) * 110)}px"></i></div>`;
  return `<section class="panel"><ol class="hphase">${PHASES.map((n, i) => `<li class="${i === t.phaseIdx ? "on" : i < t.phaseIdx ? "done" : ""}">${n}</li>`).join("")}</ol></section>
  <div class="tbl-wrap"><table class="tbl wide"><thead><tr><th>Week</th><th>Phase</th><th>Appchi alerts</th><th>v1 rules that fired</th><th>Appchi V2 alerts</th><th>Meeting the standard</th><th>Rules migrated</th><th></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr class="${i === S.week ? "viewing" : ""}"><td><b>${WEEKS[i]}</b>${i === 0 ? '<span class="sub">This week</span>' : ""}</td><td>${PHASE_SHORT[r.phase]}</td>
      <td>${bar(r.v1a, "v1a", "var(--buff-2)")}</td><td>${bar(r.rl, "rl", "var(--ink-2)")}</td><td>${bar(r.v2a, "v2a", "var(--blue-2)")}</td>
      <td>${r.v2a ? `${r.v2ok} of ${r.v2a}` : '<span class="muted">None</span>'}</td><td>${bar(r.mig, "mig", "var(--green)")}</td>
      <td class="r">${i === S.week ? '<span class="small muted">Viewing</span>' : `<button class="link small" data-action="open-week" data-week="${i}">Open week</button>`}</td></tr>`).join("")}</tbody></table></div>`;
}

// The alert page: read-only field cards, the same as the migration form.
function alertPage(t) {
  const a = t.alerts.find((x) => x.id === S.alertId);
  const r = a.rule ? t.rules[a.rule] : null;
  const can = selectable(t, a);
  const sibs = a.rule ? t.alerts.filter((x) => x.rule === a.rule && x.id !== a.id) : [];
  const obs = r ? r.obs : {};
  const values = { application: a.app, component: a.comp, message: a.msg, severity: obs.severity || a.sev || null, node_name: a.node || null, environment: obs.environment || null, impact: obs.impact || null, Runbook_url: obs.Runbook_url || null };
  const cubes = ALERT_FIELDS.map((name) => {
    const f = FIELD[name], v = values[name];
    let st = fieldState(f, v);
    if (st.kind === "optional" && (name === "impact" || name === "Runbook_url")) st = { kind: "needs" };
    return `<div class="field-row">${cubeHead(f)}<div class="val${v ? "" : " empty"}">${v ? esc(v) : "Not set"}</div>${badgeHtml(f, st)}</div>`;
  }).join("");
  const lane = laneOf(t, a);
  const act = can ? `<button class="btn primary sm" data-action="migrate-one" data-id="${a.id}">${icon("migrate")}Migrate the rule</button>` : r && r.schema === "v2" && !r.deleted ? `<button class="btn primary sm" data-action="edit-rule" data-rule="${r.id}">${icon("edit")}Edit v2 rule</button>` : "";
  return `${teamHead(t, `<button class="link small" data-action="close-alert">${icon("back")}All alerts</button>`)}
  <h1>“${esc(a.msg)}”</h1>
  <div class="row small"><span class="op">${a.schema}</span>${lane && STATE[lane] ? stateLabel(lane) : ""}<span>${esc(a.app)}, ${esc(a.comp)}</span><span><b>${a.events.toLocaleString()}</b> events</span><span class="muted">Last seen ${esc(a.lastSeen)}</span></div>
  ${r ? `<section class="stack" style="gap:8px"><h2>Rule</h2>${strip(t, r, { act })}${sibs.length ? `<div class="ctx">Same rule: ${sibs.map((s) => `<button class="link" data-action="open-alert" data-id="${s.id}">“${esc(s.msg)}”</button>`).join(", ")}</div>` : ""}</section>`
    : `<section class="panel"><b>No Grafana rule.</b> <span class="muted">Sent by ${esc(a.source || "the API")}; change it at the sender.</span></section>`}
  ${a.problems.length ? `<section class="stack" style="gap:4px"><h2>What to fix</h2>${a.problems.map((p) => { const [w, f] = PROBLEMS[p] || ["", ""]; return `<div class="prob"><span class="mk">${esc(p)}</span><span>${esc(w)} <b>${esc(f)}</b></span></div>`; }).join("")}</section>` : ""}
  <section class="stack" style="gap:8px"><h2>Fields against the standard</h2><div class="standard-form">${cubes}</div></section>
  <details class="tech"><summary>Technical details</summary><dl><dt>Provider</dt><dd>${r ? "grafana" : esc(a.source || "")}</dd><dt>First seen</dt><dd>${esc(a.firstSeen)}</dd><dt>Last seen</dt><dd>${esc(a.lastSeen)}</dd><dt>Key</dt><dd class="code">${esc(a.app)}/${esc(a.msg.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}</dd></dl></details>`;
}

// ---------------------------------------------------------------- action pages
function backTarget(t) {
  if (S.view === "rules" && S.ruleId && t.rules[S.ruleId]) return t.rules[S.ruleId].title;
  if (S.view === "alerts" && S.alertId) return "the alert";
  return VIEW_LABEL[S.view];
}
function actionPage(t) {
  const body = S.page === "migrate" ? migrateBody(t) : S.page === "create" ? createBody(t) : editBody(t);
  return `<div class="thead"><h1>${PAGE_LABEL[S.page]}</h1><div class="acts"><button class="btn" data-action="close-page">${icon("back")}Back to ${esc(backTarget(t))}</button></div></div>${body}`;
}
function policySelect(t, id, value) {
  const own = t.v2ops;
  const opt = (x) => `<option ${x === value ? "selected" : ""}>${esc(x)}</option>`;
  const options = own.length ? `<optgroup label="This team">${own.map(opt).join("")}</optgroup><optgroup label="Other policies">${POLICIES.filter((x) => !own.includes(x)).map(opt).join("")}</optgroup>` : POLICIES.map(opt).join("");
  return `<select id="${id}">${value ? "" : '<option value="">Choose a policy</option>'}${options}</select>`;
}
// Migrate rules: tick strips from the team's folders, or load any rule or folder by URL.
function migrateBody(t) {
  const m = S.mig;
  if (m.mode === "rule") return ruleForm(t);
  if (m.mode === "folder") return folderView(t);
  const pending = boardRules(t).filter((r) => r.schema === "v1" && !r.migrated).sort((a, b) => STATE_ORDER.indexOf(ruleState(t, a)) - STATE_ORDER.indexOf(ruleState(t, b)) || a.title.localeCompare(b.title));
  const counts = ruleCounts(t);
  const picks = pending.length ? pending.map((r) => strip(t, r, { count: counts[r.id] || 0, check: `<input type="checkbox" data-action="pick-rule" data-rule="${r.id}" ${m.picked.has(r.id) ? "checked" : ""} aria-label="Select ${esc(r.title)}">`, meta: `${stateLabel(ruleState(t, r))} <span class="small muted">${esc(folderName(r.folder))}</span>` })).join("")
    : '<p class="muted">Every v1 rule in the team\'s folders is migrated.</p>';
  const ex = Object.values(t.rules).find((r) => r.schema === "v1" && !r.migrated);
  return `${m.mode === "done" ? doneView(t) : ""}<div class="work">
    <section class="stack" style="gap:8px"><div class="row"><h2>v1 rules in the team's folders</h2><span class="grow"></span>
      <button class="btn primary" data-action="migrate-picked" ${m.picked.size ? "" : "disabled"}>${icon("migrate")}Migrate ${m.picked.size ? plural(m.picked.size, "rule") : "selected rules"}</button></div>${picks}</section>
    <aside class="stack">
      <form class="panel stack" data-form="load"><h3>Load by URL</h3>
        <div class="field"><label for="rule-url">Rule or folder URL</label><input id="rule-url" value="${esc(m.input)}" placeholder="https://grafana/alerting/grafana/&lt;uid&gt;/edit"></div>
        ${m.error ? `<div class="error" role="alert">${esc(m.error)}</div>` : ""}${m.notice || ""}<button class="btn primary" type="submit">Load</button>
        ${ex ? `<p class="mockhint">Mock: try <button type="button" class="link" data-action="fill" data-val="${ruleUrl(ex)}">a rule URL</button> or <button type="button" class="link" data-action="fill" data-val="${folderUrl(ex.folder)}">a folder URL</button></p>` : ""}</form>
      <div class="panel"><div class="field"><label for="load-policy">Notification policy</label>${policySelect(t, "load-policy", policyOf(t) || "")}</div></div>
    </aside></div>`;
}
function createBody(t) { const c = S.cre; if (c.mode === "rule") return ruleForm(t); return (c.mode === "done" ? doneView(t) : "") + createCard(t); }
function createCard(t) {
  const c = S.cre.create, ex = Object.values(t.rules)[0];
  const pick = t.folders.length ? c.pick || t.folders[0] : "__other";
  const picker = t.folders.length ? `<div class="field"><label for="new-folder-pick">Folder</label><select id="new-folder-pick">${t.folders.map((f) => `<option ${f === pick ? "selected" : ""}>${esc(f)}</option>`).join("")}<option value="__other" ${pick === "__other" ? "selected" : ""}>Another folder</option></select></div>` : "";
  const urlField = pick === "__other" ? `<div class="field"><label for="new-folder">Folder URL</label><input id="new-folder" value="${esc(c.folder)}" placeholder="https://grafana/dashboards/f/&lt;uid&gt;"></div>` : "";
  return `<form class="panel stack" style="max-width:640px" data-form="create">${picker}${urlField}
    <div class="field"><label for="new-title">Rule title</label><input id="new-title" value="${esc(c.title)}" placeholder="Checkout 5xx ratio above 1%"></div>
    <div class="field"><label for="new-policy">Notification policy</label>${policySelect(t, "new-policy", c.policy ?? policyOf(t) ?? "")}</div>
    ${c.error ? `<div class="error" role="alert">${esc(c.error)}</div>` : ""}<div class="row"><button class="btn primary" type="submit">Continue to the fields</button></div>
    ${ex && pick === "__other" ? `<p class="mockhint">Mock: try <button type="button" class="link" data-action="fill-folder" data-val="${folderUrl(ex.folder)}">a folder URL</button></p>` : ""}</form>`;
}
// Edit v2 rule: pick one of the team's v2 strips or paste a URL, then the same field cards.
function editBody(t) {
  if (S.edt) return editForm(t);
  const v2 = teamRules(t).filter((r) => r.schema === "v2").sort((a, b) => a.title.localeCompare(b.title));
  const list = v2.length ? v2.map((r) => strip(t, r, { meta: `<span class="small muted">${esc(folderName(r.folder))}${r.copyOf && t.rules[r.copyOf] ? `, copy of ${esc(t.rules[r.copyOf].title)}` : ""}</span>`, act: `<button class="btn sm" data-action="edit-rule" data-rule="${r.id}">${icon("edit")}Edit</button>` })).join("") : '<p class="muted">No v2 rules in the team\'s folders yet.</p>';
  const L = S.editLoad;
  return `<div class="work"><section class="stack" style="gap:8px"><h2>v2 rules in the team's folders</h2>${list}</section>
    <aside><form class="panel stack" data-form="edit-load"><h3>Open by URL</h3><div class="field"><label for="edit-url">V2 rule URL</label><input id="edit-url" value="${esc(L.input)}" placeholder="https://grafana/alerting/grafana/&lt;uid&gt;/edit"></div>
      ${L.error ? `<div class="error" role="alert">${esc(L.error)}</div>` : ""}<button class="btn primary" type="submit">Open</button></form></aside></div>`;
}
function editForm(t) {
  const e = S.edt, r = t.rules[e.rid];
  return `${strip(t, r, { meta: `<span class="small muted">${esc(folderName(r.folder))}</span> ${extLink(ruleUrl(r))}` })}
  <section class="panel" style="max-width:420px"><div class="field"><label for="edit-policy">Notification policy</label>${policySelect(t, "edit-policy", e.policy || "")}</div></section>
  <form class="standard-form" onsubmit="return false">${editableCubes(e.values, r.obs, "data-efield")}</form>
  ${e.error ? `<div class="error" role="alert">${esc(e.error)}</div>` : ""}
  <div class="actions-bar">${e.confirm
    ? '<b>Delete this rule from Grafana?</b><span class="grow"></span><button class="btn" data-action="edit-delete-cancel">Keep it</button><button class="btn danger" data-action="edit-delete">Delete rule</button>'
    : '<button class="btn" data-action="edit-pick">Edit another rule</button><span class="grow"></span><button class="btn" data-action="edit-delete-ask">Delete rule</button><button class="btn primary" data-action="edit-save">Save changes</button>'}</div>`;
}
function initValues(r) { const v = {}; for (const f of FORM_FIELDS) { const o = r.obs[f.name]; v[f.name] = o && (valid(f, o) || f.def == null) ? o : f.def ?? ""; } return v; }
const ORIGIN_VIEWS = ["alerts", "plan", "rules", "rule"];
function ruleForm(t) {
  const m = flow(), q = m.queue[m.i], r = t.rules[q.rid];
  const all = t.alerts.filter((a) => a.rule === q.rid), others = all.filter((a) => !q.sel.includes(a));
  const ctx = [];
  if (q.sel.length > 1) ctx.push(`<div class="ctx"><b>Same rule:</b> ${quoted(q.sel)}</div>`);
  else if (q.sel.length === 1) ctx.push(`<div class="ctx">${quoted(q.sel)}</div>`);
  if (q.sel.length && others.length) ctx.push(`<div class="ctx warn">Also from this rule: ${quoted(others)}</div>`);
  const steps = m.queue.length > 1 ? `<ol class="steps">${m.queue.map((x, i) => `<li class="${i === m.i ? "cur" : x.status || ""}">${i + 1}. ${esc(t.rules[x.rid].title)}</li>`).join("")}</ol>` : "";
  const head = r.isNew
    ? `<div class="panel white row"><b>${esc(r.title)}</b><span class="code muted">${esc(r.folderUrl || folderUrl(r.folder))}</span><span class="op">${esc(policyOf(t) || "")}</span></div>`
    : strip(t, r, { meta: `${m.queue.length > 1 ? `<b>Rule ${m.i + 1} of ${m.queue.length}</b> ` : ""}${stateLabel(ruleState(t, r))} <span class="small muted">${esc(folderName(r.folder))}</span> ${extLink(ruleUrl(r))}`,
        act: m.origin === "folder" ? '<button class="btn sm" data-action="mig-back">Back to folder</button>' : '<button class="btn sm" data-action="view-folder">View entire folder</button>' });
  const destUrl = `<input id="dest-folder" value="${esc(q.dest || "")}" placeholder="https://grafana/dashboards/f/&lt;uid&gt;">`;
  const destField = t.folders.length
    ? `<div class="field"><label for="dest-pick">Create the v2 rule in</label><select id="dest-pick"><option value="">The same folder as the original</option>${t.folders.map((f) => `<option ${q.destPick === f ? "selected" : ""}>${esc(f)}</option>`).join("")}<option value="__other" ${q.destPick === "__other" ? "selected" : ""}>Another folder</option></select>${q.destPick === "__other" ? destUrl : ""}</div>`
    : `<div class="field"><label for="dest-folder">Create the v2 rule in <span class="opt">optional, same folder if empty</span></label>${destUrl}</div>`;
  const dest = r.isNew ? "" : `<section class="panel two-col">${destField}<div class="field"><label for="policy-select">Notification policy</label>${policySelect(t, "policy-select", policyOf(t) || "")}</div></section>`;
  const back = m.origin === "folder" ? "" : `<button class="btn" data-action="mig-back">${ORIGIN_VIEWS.includes(m.origin) ? `Back to ${esc(backTarget(t))}` : "Cancel"}</button>`;
  return `${steps}${head}${ctx.join("")}${dest}<form class="standard-form" onsubmit="return false">${editableCubes(q.values, r.obs, "data-field")}</form>
  ${m.error ? `<div class="error" role="alert">${esc(m.error)}</div>` : ""}
  <div class="actions-bar">${back}<span class="grow"></span>${m.queue.length > 1 ? '<button class="btn" data-action="mig-skip">Skip this rule</button>' : ""}
    ${r.isNew ? "" : '<button class="btn" data-action="mig-create-del">Create v2 rule and delete the original</button>'}<button class="btn primary" data-action="mig-create">${r.isNew ? "Create rule" : "Create v2 rule"}</button></div>`;
}
function folderView(t) {
  const fuid = S.mig.folder;
  const rules = liveRules(t).filter((r) => r.folder === fuid).sort((a, b) => STATE_ORDER.indexOf(ruleState(t, a)) - STATE_ORDER.indexOf(ruleState(t, b)));
  const pending = rules.filter((r) => r.schema === "v1" && !r.migrated);
  if (!rules.length) return `<section class="panel stack"><h2>${esc(folderName(fuid))}</h2><p class="muted">This folder has no alert rules.</p><div><button class="btn" data-action="mig-back">Back</button></div></section>`;
  const act = (r) => (r.schema === "v1" && !r.migrated ? `<button class="btn primary sm" data-action="folder-one" data-rule="${r.id}">Migrate</button>` : r.schema === "v2" ? `<button class="btn sm" data-action="edit-rule" data-rule="${r.id}">${icon("edit")}Edit</button>` : "");
  return `<div class="row"><div><h2>${esc(folderName(fuid))}</h2>${extLink(folderUrl(fuid), "Open folder in Grafana")}</div><span class="grow"></span><button class="btn" data-action="mig-back">Back</button>
    ${pending.length ? `<button class="btn primary" data-action="folder-all">${icon("migrate")}Migrate ${plural(pending.length, "v1 rule")}</button>` : ""}</div>
  <div class="stack" style="gap:6px">${rules.map((r) => strip(t, r, { meta: ruleMeta(t, r), act: act(r) })).join("")}</div>`;
}
function doneView(t) {
  const m = flow();
  const items = m.done.map((d) => {
    const r = t.rules[d.rid], target = d.newRule ? r : copyOf(t, r);
    return `<li><span><b>${esc(r.title)}</b>${d.folderUrl ? `<span class="sub">In ${esc(d.folderUrl)}</span>` : ""}${d.deleted ? '<span class="sub">Original v1 rule deleted</span>' : ""}</span>${target ? `<button class="link" data-action="open-rule" data-rule="${target.id}">Open the v2 rule</button>` : ""}</li>`;
  }).join("");
  const back = ORIGIN_VIEWS.includes(m.origin) ? `<button class="btn primary" data-action="back-team">Back to ${esc(backTarget(t))}</button>` : m.origin === "folder" ? '<button class="btn primary" data-action="back-folder">Back to folder</button>' : "";
  return `<section class="panel stack done"><h2>${m.done.length ? icon("check") : ""}${m.done.length ? `${plural(m.done.length, "rule")} ${m.done.some((d) => d.newRule) ? "created" : "migrated"}` : "No rules migrated"}</h2>
    ${items ? `<ul class="done-list">${items}</ul>` : ""}${m.skipped.length ? `<p class="small muted">Skipped: ${m.skipped.map((rid) => esc(t.rules[rid].title)).join(", ")}</p>` : ""}
    <div class="row">${back}<button class="btn" data-action="mig-reset">${S.page === "create" ? "Create another rule" : "Migrate more rules"}</button></div></section>`;
}

// ---------------------------------------------------------------- actions
function openTeam(id) {
  if (S.teamId !== id) { S.selected.clear(); S.mig = freshMig(); S.cre = freshMig(); S.edt = null; S.policy = null; S.filter = freshFilter(); S.ruleFilter = "all"; }
  S.teamId = id; S.screen = "team"; S.view = "overview"; S.page = null; S.alertId = null; S.ruleId = null;
}
function startQueue(t, items, origin) {
  S.page = origin === "create" ? "create" : "migrate";
  const m = flow();
  m.queue = items.map((x) => ({ rid: x.rid, sel: x.sel || [], values: initValues(t.rules[x.rid]), dest: "", destPick: "", status: null }));
  m.i = 0; m.done = []; m.skipped = []; m.error = null; m.notice = null; m.mode = "rule"; m.origin = origin;
}
function openEdit(t, rid) { const r = t.rules[rid]; S.edt = { rid, values: initValues(r), policy: r.obs.operator || policyOf(t), error: null, confirm: false }; S.page = "edit"; }
function advance() {
  const m = flow(); m.error = null; m.i += 1;
  if (m.i >= m.queue.length) { m.mode = "done"; m.input = ""; m.picked = new Set(); }
  window.scrollTo({ top: 0 });
}
function findRuleByUrl(t, raw) {
  const v = raw.trim(), mm = v.match(/\/alerting\/grafana\/([^/?#]+)/);
  const uid = mm ? mm[1] : /^[\w-]+$/.test(v) ? v : null;
  return { uid, rule: uid ? Object.values(t.rules).find((x) => x.uid === uid && !x.deleted) : null };
}
function loadTarget(t, raw) {
  const m = S.mig, v = raw.trim();
  m.input = v; m.error = null; m.notice = null;
  if (!v) { m.error = "Paste a Grafana alert rule URL, UID or folder URL."; return; }
  const folder = v.match(/\/dashboards\/f\/([^/?#]+)/) || v.match(/\/folders\/([^/?#]+)/);
  if (folder) { m.mode = "folder"; m.folder = folder[1]; m.origin = "url"; return; }
  let { uid, rule: r } = findRuleByUrl(t, v);
  if (!uid) { m.error = "That isn't a Grafana alert rule or folder URL. Copy it from the rule's page in Grafana."; return; }
  if (!r) { r = rule(`x-${uid}`, uid, `Rule ${uid}`, "misc"); FOLDERS.misc = "Shared / Misc"; t.rules[r.id] = r; }
  if (r.schema === "v2") { openEdit(t, r.id); return; }
  if (r.migrated) { m.notice = `<div class="notice">“${esc(r.title)}” was already migrated by ${esc(r.migratedBy)} on ${esc(r.migratedAt)}.</div>`; return; }
  startQueue(t, [{ rid: r.id }], "url");
}
function createRule(t) {
  const c = S.cre.create, pickEl = $("#new-folder-pick"), urlEl = $("#new-folder");
  c.pick = pickEl ? pickEl.value : null;
  if (urlEl) c.folder = urlEl.value.trim();
  c.title = $("#new-title").value.trim(); c.policy = $("#new-policy").value || null;
  const fuid = parseFolder(c.pick && c.pick !== "__other" ? c.pick : c.folder);
  c.error = !fuid ? "Paste the folder's URL from Grafana; it contains /dashboards/f/." : !c.title ? "Give the rule a title." : !c.policy ? "Choose a notification policy." : null;
  if (c.error) return;
  S.policy = c.policy;
  const uid = c.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-rule";
  const r = rule(`new-${Date.now()}`, uid, c.title, fuid, { isNew: true, folderUrl: c.pick && c.pick !== "__other" ? c.pick : c.folder });
  t.rules[r.id] = r;
  startQueue(t, [{ rid: r.id }], "create");
}
const missingRequired = (values) => FORM_FIELDS.filter((f) => f.req && !String(values[f.name] || "").trim()).map((f) => f.name);
function createCurrent(t, deleteOriginal) {
  const m = flow(), q = m.queue[m.i], r = t.rules[q.rid];
  const missing = missingRequired(q.values);
  if (missing.length) { m.error = `Fill in the required fields: ${missing.join(", ")}.`; return; }
  const destPicked = q.destPick && q.destPick !== "__other" ? q.destPick : (q.dest || "").trim();
  const destFolder = parseFolder(destPicked);
  if ((q.destPick === "__other" || (!t.folders.length && q.dest)) && !destFolder) { m.error = "Paste the folder's URL from Grafana; it contains /dashboards/f/."; return; }
  const newRule = !!r.isNew, folder = destFolder || r.folder, labels = { ...q.values, operator: policyOf(t) };
  if (newRule) { r.isNew = false; r.schema = "v2"; r.created = true; r.obs = labels; }
  else {
    r.migrated = true; r.migratedBy = S.user; r.migratedAt = "today"; r.migratedWeek = 0;
    t.rules[`${r.id}-v2`] = rule(`${r.id}-v2`, `${r.uid}-v2`, `${r.title}-v2`, folder, { schema: "v2", created: true, copyOf: r.id, obs: labels });
  }
  q.status = "created";
  m.done.push({ rid: q.rid, deleted: !!deleteOriginal, newRule, folderUrl: folder !== r.folder ? destPicked : null });
  for (const a of t.alerts) if (a.rule === q.rid) S.selected.delete(a.id);
  toast(newRule ? `Created “${r.title}”.` : `Migrated “${r.title}”.`);
  advance();
}
function saveEdit(t) {
  const e = S.edt, r = t.rules[e.rid], missing = missingRequired(e.values);
  if (missing.length) { e.error = `Fill in the required fields: ${missing.join(", ")}.`; return; }
  r.obs = { ...e.values, operator: e.policy }; toast(`Saved “${r.title}”.`); S.edt = null;
}
function deleteEdited(t) {
  const r = t.rules[S.edt.rid];
  r.deleted = true;
  // The copy-exists check: once the v2 copy is gone, the original is no longer migrated.
  if (r.copyOf && t.rules[r.copyOf]) t.rules[r.copyOf].migrated = false;
  toast(`Deleted “${r.title}”.`); S.edt = null;
  if (S.ruleId === r.id) S.ruleId = null;
}
function jump(to) {
  if (to === "reset") { reset(); return; }
  if (to === "login") { S.screen = "login"; S.user = null; return; }
  S.user = S.user || "dana.levi";
  if (to === "teams" || to === "new-team" || to === "edit-team") { S.screen = "teams"; return; }
  openTeam("checkout");
  if (to === "plan" || to === "rules") S.view = to;
  if (to === "shared") { S.view = "alerts"; S.filter = freshFilter(); S.selected = new Set(["c1", "c8", "c3"]); }
  if (to === "alert-page") { S.view = "alerts"; S.alertId = "c1"; }
  if (to === "rule-page") { S.view = "rules"; S.ruleId = "disk"; }
  if (to === "migrate" || to === "create" || to === "edit") S.page = to;
}

// ---------------------------------------------------------------- new / edit team window
const NT = { teamId: null, v1: [], v2: [], folders: [] };
const chipX = (action, attr, label) => `<button type="button" data-action="${action}" ${attr} aria-label="Remove ${esc(label)}"><svg class="i"><use href="#i-close"/></svg></button>`;
function renderChips() {
  $("#folder-chips").innerHTML = NT.folders.map((f, i) => `<span class="op-chip folder">${esc(f)}${chipX("remove-folder", `data-i="${i}"`, f)}</span>`).join("");
  $("#v1-chips").innerHTML = NT.v1.map((o, i) => `<span class="op-chip">${esc(o)}${chipX("remove-op", `data-i="${i}"`, o)}</span>`).join("");
  $("#v2-chips").innerHTML = NT.v2.map((p) => `<span class="op-chip v2">${esc(p)}${chipX("remove-v2", `data-p="${esc(p)}"`, p)}</span>`).join("");
  $("#v2-trigger").textContent = NT.v2.length ? "Add more" : "Choose policies";
}
function renderV2Options() {
  const q = $("#v2-filter").value.trim().toLowerCase();
  $("#v2-options").innerHTML = POLICIES.filter((p) => !q || p.toLowerCase().includes(q)).map((p) => {
    const used = S.teams.filter((t) => t.v2ops.includes(p)).map((t) => t.name);
    return `<li><label class="ms-opt"><input type="checkbox" data-v2="${esc(p)}" ${NT.v2.includes(p) ? "checked" : ""}><span class="code">${esc(p)}</span>${used.length ? `<span class="muted">Used by ${esc(used.join(", "))}</span>` : ""}</label></li>`;
  }).join("") || '<li class="muted small" style="padding:6px 8px">No policy matches.</li>';
}
function setV2Panel(open) { $("#v2-panel").hidden = !open; $("#v2-trigger").setAttribute("aria-expanded", String(open)); if (open) { $("#v2-filter").value = ""; renderV2Options(); $("#v2-filter").focus(); } }
function addOps(text) { for (const part of text.split(/[,\n]/)) { const v = part.trim(); if (v && !NT.v1.includes(v)) NT.v1.push(v); } renderChips(); }
function addFolders(text) {
  const err = $("#folder-err"); err.textContent = "";
  for (const part of text.split(/[\s,]+/)) {
    if (!part) continue;
    const uid = parseFolder(part);
    if (!uid) { err.textContent = "That isn't a Grafana folder URL. Copy it from the folder's page; it contains /dashboards/f/."; renderChips(); return false; }
    if (!NT.folders.some((f) => parseFolder(f) === uid)) NT.folders.push(part);
  }
  renderChips(); return true;
}
function openDialog(name = "", edit = null) {
  NT.teamId = edit ? edit.id : null; NT.v1 = edit ? [...edit.v1ops] : []; NT.v2 = edit ? [...edit.v2ops] : []; NT.folders = edit ? [...edit.folders] : [];
  $("#team-dialog-title").textContent = edit ? `Edit ${edit.name}` : "New team";
  $("#team-submit").textContent = edit ? "Save team" : "Create team";
  $("#team-name").value = edit ? edit.name : name;
  $("#v1-input").value = ""; $("#folder-input").value = ""; $("#folder-err").textContent = ""; $("#team-name-err").textContent = "";
  $("#ldap-groups").innerHTML = missingGroups().map((g) => `<option value="${esc(g)}">`).join("");
  setV2Panel(false); renderChips(); $("#team-dialog").showModal();
  (name && !edit ? $("#v1-input") : $("#team-name")).focus();
}
function submitTeam() {
  addOps($("#v1-input").value); $("#v1-input").value = "";
  if (!addFolders($("#folder-input").value)) { $("#folder-input").focus(); return; }
  $("#folder-input").value = "";
  const name = $("#team-name").value.trim(), err = $("#team-name-err");
  if (!name) { err.textContent = "Enter a team name."; $("#team-name").focus(); return; }
  if (S.teams.some((t) => t.id !== NT.teamId && sameName(t.name, name))) { err.textContent = "A team with this name already exists."; $("#team-name").focus(); return; }
  if (NT.teamId) { Object.assign(S.teams.find((t) => t.id === NT.teamId), { name, v1ops: [...NT.v1], v2ops: [...NT.v2], folders: [...NT.folders] }); $("#team-dialog").close(); render(); toast(`Saved ${name}.`); return; }
  const id = `t${Date.now()}`;
  S.teams.push({ id, name, isNew: true, ...emptyTeamData(), v1ops: [...NT.v1], v2ops: [...NT.v2], folders: [...NT.folders] });
  S.newTeamId = id; $("#team-dialog").close(); render(); toast(`Created ${name}.`);
  setTimeout(() => { S.newTeamId = null; }, 3000);
}

// ---------------------------------------------------------------- render + events
function render() {
  const active = document.activeElement, focusId = active && active.id;
  const caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  $("#app").innerHTML = S.screen === "login" ? loginView() : `${topbar()}<main class="page" id="main">${S.screen === "teams" ? teamsView() : teamView()}</main>`;
  const again = focusId && document.getElementById(focusId);
  if (again && again !== document.body) { again.focus(); if (caret != null && again.setSelectionRange) { try { again.setSelectionRange(caret, caret); } catch (e) { /* not a text input */ } } }
  else if (S.screen === "login") $("#username").focus();
}
const top0 = () => window.scrollTo({ top: 0 });
document.addEventListener("click", (e) => {
  if (!$("#v2-panel").hidden && !e.target.closest("#v2-panel, #v2-box")) setV2Panel(false);
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "pick" || action === "pick-rule") return;
  if (el.tagName === "A") e.preventDefault();
  const t = team();
  switch (action) {
    case "jump": jump(el.dataset.to); render(); if (el.dataset.to === "new-team") openDialog(); if (el.dataset.to === "edit-team") openDialog("", S.teams.find((x) => x.id === "checkout")); return;
    case "home": S.screen = S.user ? "teams" : "login"; S.page = null; break;
    case "logout": S.user = null; S.screen = "login"; S.teamId = null; S.selected.clear(); S.mig = freshMig(); S.cre = freshMig(); S.edt = null; S.policy = null; break;
    case "new-team": openDialog(el.dataset.name || ""); return;
    case "edit-team": openDialog("", el.dataset.team ? S.teams.find((x) => x.id === el.dataset.team) : t); return;
    case "close-dialog": $("#team-dialog").close(); return;
    case "remove-op": NT.v1.splice(Number(el.dataset.i), 1); renderChips(); $("#v1-input").focus(); return;
    case "remove-folder": NT.folders.splice(Number(el.dataset.i), 1); renderChips(); $("#folder-input").focus(); return;
    case "remove-v2": NT.v2 = NT.v2.filter((p) => p !== el.dataset.p); renderChips(); if (!$("#v2-panel").hidden) renderV2Options(); $("#v2-trigger").focus(); return;
    case "toggle-v2": setV2Panel($("#v2-panel").hidden); return;
    case "open-team": openTeam(el.dataset.team); top0(); break;
    case "go-teams": S.screen = "teams"; S.page = null; break;
    case "view": S.view = el.dataset.view; S.alertId = null; S.ruleId = null; S.page = null; top0(); break;
    case "open-page": S.page = el.dataset.page; if (S.page === "edit") S.edt = null; top0(); break;
    case "close-page": S.page = null; S.edt = null; top0(); break;
    case "open-alert": S.view = "alerts"; S.alertId = el.dataset.id; S.ruleId = null; S.page = null; top0(); break;
    case "close-alert": S.alertId = null; break;
    case "open-rule": S.view = "rules"; S.ruleId = el.dataset.rule; S.alertId = null; S.page = null; top0(); break;
    case "close-rule": S.ruleId = null; break;
    case "rules-state": S.view = "rules"; S.ruleId = null; S.ruleFilter = el.dataset.state; top0(); break;
    case "rule-filter": S.ruleFilter = el.dataset.state; break;
    case "show-problem": S.view = "alerts"; S.alertId = null; S.filter = { ...freshFilter(), fix: false, q: el.dataset.p, app: S.filter.app }; break;
    case "open-week": S.week = Number(el.dataset.week); S.view = "overview"; break;
    case "filter": S.filter[el.dataset.key] = el.dataset.key === "fix" ? el.dataset.val === "1" : el.dataset.val; break;
    case "clear-sel": S.selected.clear(); break;
    case "select-siblings": for (const a of t.alerts) if (a.rule === el.dataset.rule && selectable(t, a)) S.selected.add(a.id); break;
    case "plan-migrate": { const sel = byApp(t).filter((a) => a.rule === el.dataset.rule && laneOf(t, a) === el.dataset.lane); S.mig = freshMig(); startQueue(t, [{ rid: el.dataset.rule, sel }], "plan"); top0(); break; }
    case "migrate-one": { const a = t.alerts.find((x) => x.id === el.dataset.id); S.mig = freshMig(); startQueue(t, [{ rid: a.rule, sel: [a] }], "alerts"); top0(); break; }
    case "migrate-selected": { const groups = selectionGroups(t); S.mig = freshMig(); startQueue(t, groups.map((g) => ({ rid: g.rid, sel: g.sel })), "alerts"); S.selected.clear(); top0(); break; }
    case "rules-migrate": S.mig = freshMig(); startQueue(t, [{ rid: el.dataset.rule }], S.ruleId ? "rule" : "rules"); top0(); break;
    case "rules-migrate-folder": { const p = liveRules(t).filter((r) => r.folder === el.dataset.folder && r.schema === "v1" && !r.migrated); S.mig = freshMig(); startQueue(t, p.map((r) => ({ rid: r.id })), "rules"); top0(); break; }
    case "migrate-picked": { const ids = [...S.mig.picked]; S.mig = freshMig(); startQueue(t, ids.map((rid) => ({ rid })), "page"); top0(); break; }
    case "edit-rule": openEdit(t, el.dataset.rule); top0(); break;
    case "edit-pick": S.edt = null; break;
    case "edit-save": saveEdit(t); break;
    case "edit-delete-ask": S.edt.confirm = true; break;
    case "edit-delete-cancel": S.edt.confirm = false; break;
    case "edit-delete": deleteEdited(t); break;
    case "fill": S.mig.input = el.dataset.val; S.mig.error = null; S.mig.notice = null; break;
    case "fill-folder": S.cre.create.folder = el.dataset.val; S.cre.create.error = null; break;
    case "mig-reset": resetFlow(); break;
    case "back-team": S.mig = freshMig(); S.page = null; break;
    case "back-folder": S.mig.mode = "folder"; S.mig.queue = []; break;
    case "mig-back": { const m = flow(); if (m.mode === "rule" && ORIGIN_VIEWS.includes(m.origin)) { S.mig = freshMig(); S.page = null; } else if (m.mode === "rule" && m.origin === "folder") { m.mode = "folder"; m.queue = []; m.error = null; } else resetFlow(); break; }
    case "mig-skip": { const m = flow(), q = m.queue[m.i]; q.status = "skipped"; m.skipped.push(q.rid); advance(); break; }
    case "mig-create": createCurrent(t, false); break;
    case "mig-create-del": createCurrent(t, true); break;
    case "view-folder": { const r = t.rules[S.mig.queue[S.mig.i].rid]; Object.assign(S.mig, { mode: "folder", folder: r.folder, queue: [], origin: "url", error: null }); break; }
    case "folder-one": startQueue(t, [{ rid: el.dataset.rule }], "folder"); break;
    case "folder-all": { const p = liveRules(t).filter((r) => r.folder === S.mig.folder && r.schema === "v1" && !r.migrated); startQueue(t, p.map((r) => ({ rid: r.id })), "folder"); break; }
    default: return;
  }
  render();
});
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.v2) { const p = el.dataset.v2; NT.v2 = el.checked ? [...NT.v2.filter((x) => x !== p), p] : NT.v2.filter((x) => x !== p); renderChips(); return; }
  if (el.dataset.action === "pick") { if (el.checked) S.selected.add(el.dataset.id); else S.selected.delete(el.dataset.id); render(); return; }
  if (el.dataset.action === "pick-rule") { if (el.checked) S.mig.picked.add(el.dataset.rule); else S.mig.picked.delete(el.dataset.rule); render(); return; }
  switch (el.id) {
    case "team-switch": openTeam(el.value); render(); return;
    case "week-select": S.week = Number(el.value); render(); return;
    case "app-select": S.filter.app = el.value; render(); return;
    case "new-folder-pick": S.cre.create.pick = el.value; render(); return;
    case "dest-pick": if (flow().mode === "rule") { flow().queue[flow().i].destPick = el.value; render(); } return;
    case "policy-select": S.policy = el.value || null; render(); return;
    case "load-policy": S.policy = el.value || null; return;
    case "new-policy": S.cre.create.policy = el.value || null; return;
    case "edit-policy": if (S.edt) S.edt.policy = el.value || null; return;
  }
  if (el.dataset.efield && S.edt) S.edt.values[el.dataset.efield] = el.value;
  else if (el.dataset.field && flow().mode === "rule") flow().queue[flow().i].values[el.dataset.field] = el.value;
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.id === "alert-search") { S.filter.q = el.value; render(); }
  else if (el.dataset.efield && S.edt) S.edt.values[el.dataset.efield] = el.value;
  else if (el.dataset.field && flow().mode === "rule") flow().queue[flow().i].values[el.dataset.field] = el.value;
  else if (el.id === "dest-folder" && flow().mode === "rule") flow().queue[flow().i].dest = el.value;
  else if (el.id === "rule-url") S.mig.input = el.value;
  else if (el.id === "edit-url") S.editLoad.input = el.value;
  else if (el.id === "new-folder") S.cre.create.folder = el.value;
  else if (el.id === "new-title") S.cre.create.title = el.value;
  else if (el.id === "team-name") $("#team-name-err").textContent = "";
  else if (el.id === "v2-filter") renderV2Options();
});
document.addEventListener("submit", (e) => {
  const form = e.target; e.preventDefault();
  if (form.id === "team-form") { submitTeam(); return; }
  const t = team();
  if (form.dataset.form === "login") {
    const user = $("#username").value.trim(), pass = $("#password").value;
    if (!user || !pass) { S.loginError = "Enter your username and password."; render(); return; }
    S.loginError = null; S.user = user; S.screen = "teams";
  } else if (form.dataset.form === "load") {
    S.policy = ($("#load-policy") || {}).value || S.policy;
    if (S.policy) loadTarget(t, $("#rule-url").value);
    else { S.mig.input = $("#rule-url").value.trim(); S.mig.notice = null; S.mig.error = "Choose a notification policy first."; }
  } else if (form.dataset.form === "create") createRule(t);
  else if (form.dataset.form === "edit-load") {
    const L = S.editLoad; L.input = $("#edit-url").value.trim(); L.error = null;
    const { uid, rule: r } = findRuleByUrl(t, L.input);
    if (!uid) L.error = "That isn't a Grafana alert rule URL. Copy it from the rule's page in Grafana.";
    else if (!r) L.error = "No rule with that URL in this team's folders.";
    else if (r.schema !== "v2") L.error = "That is a v1 rule. Migrate it first, then edit the v2 copy.";
    else openEdit(t, r.id);
  }
  render();
});
const v1Input = $("#v1-input");
v1Input.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addOps(v1Input.value); v1Input.value = ""; } else if (e.key === "Backspace" && !v1Input.value && NT.v1.length) { NT.v1.pop(); renderChips(); } });
v1Input.addEventListener("paste", (e) => { const text = (e.clipboardData || window.clipboardData).getData("text"); if (/[,\n]/.test(text)) { e.preventDefault(); addOps(text); } });
v1Input.addEventListener("blur", () => { if (v1Input.value.trim()) { addOps(v1Input.value); v1Input.value = ""; } });
$("#v1-box").addEventListener("click", (e) => { if (e.target.id === "v1-box") v1Input.focus(); });
const folderInput = $("#folder-input");
folderInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (addFolders(folderInput.value)) folderInput.value = ""; } else if (e.key === "Backspace" && !folderInput.value && NT.folders.length) { NT.folders.pop(); renderChips(); } });
folderInput.addEventListener("input", () => { $("#folder-err").textContent = ""; });
$("#folder-box").addEventListener("click", (e) => { if (e.target.id === "folder-box") folderInput.focus(); });
$("#v2-box").addEventListener("click", (e) => { if (e.target.id === "v2-box") setV2Panel($("#v2-panel").hidden); });
$("#v2-filter").addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });
$("#team-dialog").addEventListener("cancel", (e) => { if (!$("#v2-panel").hidden) { e.preventDefault(); setV2Panel(false); $("#v2-trigger").focus(); } });
render();
