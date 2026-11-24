# icecream mock (proposal, 2026-11-24)

A clickable mock of **icecream**, one site that replaces the alerts-bi portal and the
alerts-migration tool. It is a proposal, not an accepted design: the plan, decisions, work list
and open questions are in
[`docs/handoffs/2026-11-24-icecream-portal.md`](../../handoffs/2026-11-24-icecream-portal.md).
Once accepted, the design document becomes the authority.

Open it from a local HTTP server:

```bash
python -m http.server 8240 --directory docs/mockups/icecream
```

Then open `http://localhost:8240/`. Opening `index.html` straight from disk also works. Sign in
with any username and password. **Checkout Platform** is the complete sample team. All data is
invented.

The yellow bar at the top belongs only to the mock. It jumps to each screen: Login, Teams, New
team, Edit team, Overview, Action plan, Same-rule selection, Alert page, Rules, Rule page,
Migrate rules, New v2 rule, Edit v2 rule. **Reset** restores the sample data.

| File | What it is |
|---|---|
| `index.html` | Page and styles |
| `app.js` | Sample data and behaviour, plain JavaScript with no build step |
| `DESIGN.md` | Colours, type, the "strip" rule mark, layout rules |
| `PRODUCT.md` | Users, purpose, principles |

Things to try:

- **Alerts** tab: tick "Disk full on db-01", "Disk full on db-03" and "High latency on
  checkout" to see same-rule marking ("3 alerts selected, from 2 rules"), then **Migrate 2
  rules** to see the queue.
- **Edit v2 rule**: open "Payment error rate-v2" and delete it. "Payment error rate" goes back
  to "Ready to migrate", because migrated status needs the v2 copy to exist.
- **Migrate rules**: use the yellow hint to load a rule or folder by URL.
- **Teams**: create a team with only a name; operators and folders are optional.
