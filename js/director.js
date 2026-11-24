"use strict";
/* ============================================================
   HUG Regional Director console (admin.html only)
   Author: N92 Development Works

   The director signs in with a GitHub key that can write to this
   site's repository. Publishing writes rules.json there; GitHub
   Pages republishes it and every agency picks it up on its next
   visit. Edits stay a draft in this browser until published.
   ============================================================ */

const GH = { owner: "shadstradamus", repo: "HUG-Realtor-Tool", branch: "main", path: "rules.json" };
const KEY_STORE = "hug.director.key";

const Key = {
  get() { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } },
  set(v) { try { localStorage.setItem(KEY_STORE, v); } catch (e) {} },
  clear() { try { localStorage.removeItem(KEY_STORE); } catch (e) {} }
};

async function gh(method, url, body) {
  const r = await fetch("https://api.github.com/repos/" + GH.owner + "/" + GH.repo + url, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + Key.get(),
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  let data = null;
  try { data = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, data };
}

function ghError(res, doing) {
  if (res.status === 401) return "GitHub did not accept this key. It may have expired or been deleted.";
  if (res.status === 403 || res.status === 404)
    return "This key can read the site but cannot " + doing + ". It needs Contents: Read and write on the " +
      GH.repo + " repository.";
  if (res.status === 409) return "Someone else published at the same moment. Try again.";
  return "GitHub answered " + res.status + (res.data && res.data.message ? " (" + res.data.message + ")" : "") + ".";
}

/* ---------- sign-in gate ---------- */
const gate = $("#gate");
async function trySignIn(key) {
  Key.set(key);
  const res = await gh("GET", "");
  if (!res.ok) { Key.clear(); return ghError(res, "be read"); }
  return null;
}
function showGate(msg) {
  gate.hidden = false;
  document.body.classList.add("gated");
  $("#gateMsg").innerHTML = msg ? '<div class="warn">' + esc(msg) + '</div>' : "";
  setTimeout(() => $("#gateKey").focus(), 50);
}
$("#gateForm").addEventListener("submit", async e => {
  e.preventDefault();
  const key = $("#gateKey").value.trim();
  if (!key) { showGate("Paste the key you were given."); return; }
  const btn = $("#gateGo"); btn.disabled = true; btn.textContent = "Checking…";
  const err = await trySignIn(key);
  btn.disabled = false; btn.textContent = "Sign in";
  if (err) { showGate(err); return; }
  $("#gateKey").value = "";
  openConsole();
});

/* ---------- console ---------- */
let viaDb = false;   // signed in because this browser is on the director list
async function openConsole() {
  $("#edDone").textContent = viaDb && !Key.get() ? "Agency MLS" : "Sign out";
  gate.hidden = true;
  document.body.classList.remove("gated");
  editorOn = true; editorTool = null;
  $("#editorBar").classList.add("on");
  drawPins();
  $("#edState").textContent = "Loading the published rules…";
  const pk = await fetchPublishedRules();
  PUBLISHED = pk;
  if (pk) {
    const changes = applyOfficePack(S, pk);
    if (changes) { save(); renderAll(); toast("Loaded published rules v" + pk.version + "."); }
  }
  updateDraft();
  renderHistory();
}

/* What differs between this browser and what agencies currently get. */
const ZONE_FIELDS = ["name", "base", "floor", "ceiling", "x", "y", "unique", "notForSale"];
/* Only what changes a price counts. Blank, 0, false and missing are all "nothing",
   and the order fields happen to be saved in doesn't matter. */
const nv = v => (v === undefined || v === null || v === false || v === "" || v === 0 || v === "0") ? "" : String(v);
const MOD_FIELDS = ["label", "kind", "group", "pct", "pctExtra", "flat", "flatExtra", "penaltyPct", "hint", "requires", "special", "forcesAuction"];
const modKey = m => JSON.stringify(MOD_FIELDS.map(f => nv(m[f])).concat([(m.options || []).map(o => [nv(o.label), nv(o.pct), nv(o.flat)])]));
const whKey = w => JSON.stringify([nv(w.label), nv(w.price), nv(w.tier)]);
function draftChanges() {
  if (!PUBLISHED) return { count: S.zones.length, first: true, lines: [], items: [] };
  const items = [];   // { text, undo() }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const zdiff = (p, z) => ZONE_FIELDS.filter(f => nv(p[f]) !== nv(z[f]));
  const pubZones = PUBLISHED.zones || [];
  const pub = {}; pubZones.forEach(z => { pub[z.id] = z; });
  const mine = {}; S.zones.forEach(z => { mine[z.id] = z; });
  S.zones.forEach(z => {
    const p = pub[z.id];
    if (!p) items.push({ text: "New zone: " + z.name, undo: () => { S.zones = S.zones.filter(x => x.id !== z.id); } });
    else if (zdiff(p, z).length) {
      const what = zdiff(p, z)
        .map(f => ({ name: "name", base: "price", floor: "floor", ceiling: "ceiling", x: "map position", y: "map position",
                     unique: "estate", notForSale: "for sale" })[f]);
      items.push({ text: "Changed zone: " + z.name + " (" + Array.from(new Set(what)).join(", ") + ")",
        undo: () => { const i = S.zones.findIndex(x => x.id === z.id); if (i >= 0) S.zones[i] = clone(p); } });
    }
  });
  pubZones.forEach(z => { if (!mine[z.id]) items.push({ text: "Removed zone: " + z.name, undo: () => { S.zones.push(clone(z)); } }); });

  // settings added after a publish count as their defaults, not as edits
  const pubRules = deepFill(clone(PUBLISHED.rules || {}), clone(DEFAULT_RULES));
  const pm = {}; (pubRules.mods || []).forEach(m => { pm[m.id] = m; });
  const mm = {}; (S.rules.mods || []).forEach(m => { mm[m.id] = m; });
  (S.rules.mods || []).forEach(m => {
    const p = pm[m.id];
    if (!p) items.push({ text: "New multiplier: " + m.label, undo: () => { S.rules.mods = S.rules.mods.filter(x => x.id !== m.id); } });
    else if (modKey(m) !== modKey(p)) items.push({ text: "Changed multiplier: " + m.label,
      undo: () => { const i = S.rules.mods.findIndex(x => x.id === m.id); if (i >= 0) S.rules.mods[i] = clone(p); } });
  });
  (pubRules.mods || []).forEach((m, idx) => { if (!mm[m.id]) items.push({ text: "Removed multiplier: " + m.label,
    undo: () => { S.rules.mods.splice(Math.min(idx, S.rules.mods.length), 0, clone(m)); } }); });
  const order = (a) => (a || []).map(m => m.id).filter(id => pm[id] && mm[id]);
  if (!same(order(S.rules.mods), order(pubRules.mods)) && items.every(i => i.text.indexOf("multiplier") < 0))
    items.push({ text: "Multipliers reordered", undo: () => {
      S.rules.mods.sort((a, b) => (pubRules.mods.findIndex(x => x.id === a.id) + 1 || 999) - (pubRules.mods.findIndex(x => x.id === b.id) + 1 || 999)); } });

  const label = k => { const f = (typeof POLICY_FIELDS !== "undefined" ? POLICY_FIELDS : []).find(x => x[0] === k); return f ? f[1] : k; };
  const keys = new Set(Object.keys(S.rules.policy).concat(Object.keys(pubRules.policy)));
  Array.from(keys).filter(k => nv(S.rules.policy[k]) !== nv(pubRules.policy[k])).forEach(k =>
    items.push({ text: "House rule: " + label(k) + " (" + (pubRules.policy[k] ?? "\u2014") + " \u2192 " + (S.rules.policy[k] ?? "\u2014") + ")",
      undo: () => { S.rules.policy[k] = pubRules.policy[k]; } }));

  const pw = {}; (PUBLISHED.warehouses || []).forEach(w => { pw[w.id] = w; });
  (S.warehouses || []).forEach(w => {
    const p = pw[w.id];
    if (p && whKey(w) !== whKey(p)) items.push({ text: "Warehouse: " + w.label + " (" + money(p.price) + " \u2192 " + money(w.price) + ")",
      undo: () => { const i = S.warehouses.findIndex(x => x.id === w.id); if (i >= 0) S.warehouses[i] = clone(p); } });
  });
  return { count: items.length, first: false, lines: items.map(i => i.text), items };
}

/* Undo one change, then redraw everything that shows rules. */
function undoChange(item) {
  item.undo();
  save(); renderAll(); updateDraft();
  toast("Undone: " + item.text.replace(/ \(.*\)$/, "") + ".");
}
function changesListHTML(d) {
  return '<ul class="changes">' + d.items.map((it, i) =>
    '<li><span>' + esc(it.text) + '</span><button class="btn sm" data-undo="' + i + '">Undo</button></li>').join("") + '</ul>';
}
function bindUndo(m, after) {
  $$("[data-undo]", m).forEach(b => b.onclick = () => {
    const d = draftChanges(); const it = d.items[+b.dataset.undo];
    if (it) undoChange(it);
    after();
  });
}
function showChanges() {
  const d = draftChanges();
  if (d.first) { toast("Nothing has been published yet, so everything here goes out on the first publish."); return; }
  if (!d.count) { toast("No unpublished changes."); return; }
  const m = openModal("Unpublished changes",
    '<p class="note" style="margin:0 0 8px">Undo anything you don\u2019t want before you publish. Agencies won\u2019t see any of this until then.</p>' +
    changesListHTML(d),
    [{ label: "Undo all", kind: "danger", run: () => { closeModal(); $("#edDiscard").click(); } },
     { label: "Done", kind: "primary", run: closeModal }]);
  bindUndo(m, () => { closeModal(); if (draftChanges().count) showChanges(); });
}
$("#edState").addEventListener("click", showChanges);
$("#edState").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.currentTarget.classList.contains("clickable")) { e.preventDefault(); showChanges(); } });

function updateDraft() {
  if (!editorOn) return;
  const d = draftChanges();
  const live = PUBLISHED ? "Agencies have v" + PUBLISHED.version + "." : "Nothing has been published yet.";
  $("#edState").textContent = d.first
    ? live + " Publish to send these " + S.zones.length + " zones and rules to every agency."
    : d.count ? d.count + (d.count === 1 ? " unpublished change. " : " unpublished changes. ") + live
              : "No unpublished changes. " + live;
  $("#edPublish").classList.toggle("primary", d.first || d.count > 0);
  const st = $("#edState");
  st.classList.toggle("clickable", d.count > 0 && !d.first);
  st.setAttribute("role", d.count > 0 && !d.first ? "button" : "status");
  st.tabIndex = d.count > 0 && !d.first ? 0 : -1;
  if (d.count > 0 && !d.first) st.textContent += " Review or undo \u203a";
}
let draftTimer = null;
const baseWrite = Store.write;
Store.write = function (obj) {
  const out = baseWrite.call(Store, obj);
  clearTimeout(draftTimer); draftTimer = setTimeout(updateDraft, 150);
  return out;
};

/* ---------- publish ---------- */
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
$("#edPublish").onclick = () => {
  const d = draftChanges();
  const next = Math.max(S.packVersion || 0, PUBLISHED ? PUBLISHED.version : 0) + 1;
  const list = d.items && d.items.length
    ? changesListHTML(d)
    : (d.first ? '<p class="note">First publish: every zone, multiplier, house rule and warehouse price goes out.</p>'
               : '<p class="note">Nothing differs from what agencies already have. You can still republish.</p>');
  const m = openModal("Publish to all agencies",
    '<div class="tip">Publishing as <strong>v' + next + '</strong>. Agencies get it the next time they open the MLS, usually within a few minutes.</div>' +
    '<div style="margin-top:12px"><strong style="font-size:14px">What will change</strong>' + list + '</div>' +
    '<div style="margin-top:12px"><span class="lab">Note for agencies (shown when it loads)</span>' +
    '<input id="pb_note" placeholder="e.g. Sandy Shores rezoned, Cayo Perico now auction only"></div>',
    [{ label: "Cancel", run: closeModal },
     { label: "Publish v" + next, kind: "primary", run: async () => {
        const btn = $(".foot .primary", m); btn.disabled = true; btn.textContent = "Publishing…";
        const pack = buildPack($("#pb_note", m).value.trim());
        pack.version = next;
        // HUG's list is the whole list: agencies get exactly these zones and house rules
        pack.replaceZones = true;
        pack.keepLocalPolicy = false;
        pack.publishedBy = "HUG Regional Director";
        let err = null;
        if (viaDb) {
          try { await Shared.publishRules(pack); } catch (e) { err = /duplicate/i.test(e.message) ? "Someone published v" + next + " first. Reload and try again." : (e.message || "Couldn\u2019t publish."); }
          // keep the GitHub backup in step when this browser also has the key
          if (!err && Key.get()) publishPack(pack).then(e2 => { if (e2) toast("Published. The GitHub backup copy didn\u2019t update: " + e2); });
        } else {
          err = await publishPack(pack);
          if (!err && typeof Shared !== "undefined" && Shared.on) Shared.publishRules(pack).catch(() => {});
        }
        if (err) { btn.disabled = false; btn.textContent = "Publish v" + next; toast(err); return; }
        S.packVersion = pack.version; S.packIssued = pack.issued; S.packNote = pack.note;
        PUBLISHED = pack; save(); closeModal(); renderData(); updateDraft(); renderHistory();
        toast("Published v" + pack.version + ". Agencies get it the next time they open the MLS.");
      } }]);
  bindUndo(m, () => { closeModal(); $("#edPublish").click(); });
};
async function publishPack(pack) {
  const cur = await gh("GET", "/contents/" + GH.path + "?ref=" + GH.branch);
  if (!cur.ok && cur.status !== 404) return ghError(cur, "be read");
  const body = {
    message: "HUG rules v" + pack.version + (pack.note ? ": " + pack.note : ""),
    content: toBase64(JSON.stringify(pack, null, 2) + "\n"),
    branch: GH.branch
  };
  if (cur.ok && cur.data && cur.data.sha) body.sha = cur.data.sha;
  const res = await gh("PUT", "/contents/" + GH.path, body);
  return res.ok ? null : ghError(res, "publish");
}

/* ---------- discard ---------- */
$("#edDiscard").onclick = () => {
  if (!PUBLISHED) { toast("Nothing has been published yet, so there is no draft to discard."); return; }
  openModal("Discard draft",
    '<p>Put every zone, multiplier, house rule and warehouse price back to published v' + PUBLISHED.version + '?</p>' +
    '<p class="note" style="margin-top:8px">Your properties, clients and loans are not touched.</p>',
    [{ label: "Keep editing", run: closeModal },
     { label: "Discard changes", kind: "danger", run: () => {
        S.zones = clone(PUBLISHED.zones || S.zones);
        if (Array.isArray(PUBLISHED.warehouses)) S.warehouses = clone(PUBLISHED.warehouses);
        if (PUBLISHED.rules) S.rules = deepFill(clone(PUBLISHED.rules), clone(DEFAULT_RULES));
        S.packVersion = PUBLISHED.version;
        save(); closeModal(); renderAll(); updateDraft(); toast("Draft discarded.");
      } }]);
};

/* ---------- sign out ---------- */
$("#edDone").onclick = () => {
  if (viaDb && !Key.get()) { location.href = "./"; return; }
  Key.clear();
  if (viaDb) { location.href = "./"; return; }
  editorOn = false; editorTool = null;
  $("#editorBar").classList.remove("on");
  $("#mapWrap").classList.remove("placing");
  drawPins();
  showGate("Signed out. Your unpublished changes are still saved in this browser.");
};

/* ---------- publish history ---------- */
async function renderHistory() {
  const box = $("#pubHistory"); if (!box) return;
  box.innerHTML = '<p class="note">Loading…</p>';
  if (viaDb) {
    try {
      const rows = await Shared.rulesHistory();
      box.innerHTML = !rows.length ? '<p class="note">Nothing published yet.</p>' :
        '<table class="data"><thead><tr><th>Update</th><th>Published</th></tr></thead><tbody>' +
        rows.map(r => { const w = new Date(r.published_at);
          return '<tr><td>HUG rules v' + r.version + (r.note ? ': ' + esc(r.note) : '') + '</td><td class="num">' +
            esc(w.toLocaleDateString() + " " + w.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) + '</td></tr>'; }).join("") +
        '</tbody></table>';
      stampTables();
    } catch (e) { box.innerHTML = '<div class="warn">' + esc(e.message || "Couldn\u2019t load the history.") + '</div>'; }
    return;
  }
  const res = await gh("GET", "/commits?path=" + GH.path + "&sha=" + GH.branch + "&per_page=10");
  if (!res.ok) { box.innerHTML = '<div class="warn">' + esc(ghError(res, "read the history")) + '</div>'; return; }
  if (!res.data.length) { box.innerHTML = '<p class="note">Nothing published yet.</p>'; return; }
  box.innerHTML = '<table class="data"><thead><tr><th>Update</th><th>Published</th></tr></thead><tbody>' +
    res.data.map(c => {
      const when = new Date(c.commit.author.date);
      return '<tr><td>' + esc(c.commit.message.split("\n")[0]) + '</td><td class="num">' +
        esc(when.toLocaleDateString() + " " + when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) + '</td></tr>';
    }).join("") + '</tbody></table>';
  stampTables();
}

/* ---------- start ----------
   A browser on the director list opens straight in. The GitHub key is the backup. */
document.body.classList.add("gated");   // stay hidden while we check
(async () => {
  if (typeof Shared !== "undefined" && Shared.on && await Shared.amDirector()) { viaDb = true; openConsole(); return; }
  if (Key.get()) {
    const err = await trySignIn(Key.get());
    if (err) showGate(err); else openConsole();
    return;
  }
  const p = typeof Shared !== "undefined" && Shared.profile && Shared.profile();
  showGate(p && p.name ? p.name + " (" + Shared.realtorId(p.name) + ") isn\u2019t a director yet. Ask a director to mark you in the Realtor directory, or sign in with the backup key."
                       : "");
})();
