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
async function openConsole() {
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
function draftChanges() {
  if (!PUBLISHED) return { count: S.zones.length, first: true, lines: [] };
  const lines = [];
  const pub = {}; (PUBLISHED.zones || []).forEach(z => { pub[z.id] = z; });
  const mine = {}; S.zones.forEach(z => { mine[z.id] = z; });
  S.zones.forEach(z => {
    const p = pub[z.id];
    if (!p) lines.push("New zone: " + z.name);
    else if (ZONE_FIELDS.some(f => String(p[f] ?? "") !== String(z[f] ?? ""))) lines.push("Changed zone: " + z.name);
  });
  (PUBLISHED.zones || []).forEach(z => { if (!mine[z.id]) lines.push("Removed zone: " + z.name); });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // settings added after a publish count as their defaults, not as edits
  const pubRules = deepFill(clone(PUBLISHED.rules || {}), clone(DEFAULT_RULES));
  if (!same(S.rules.mods, pubRules.mods)) lines.push("Multipliers changed");
  const keys = new Set(Object.keys(S.rules.policy).concat(Object.keys(pubRules.policy)));
  const changedRules = Array.from(keys).filter(k => String(S.rules.policy[k]) !== String(pubRules.policy[k]));
  if (changedRules.length) lines.push("House rules changed");
  if (!same(S.warehouses, PUBLISHED.warehouses)) lines.push("Warehouse prices changed");
  return { count: lines.length, first: false, lines };
}
function updateDraft() {
  if (!editorOn) return;
  const d = draftChanges();
  const live = PUBLISHED ? "Agencies have v" + PUBLISHED.version + "." : "Nothing has been published yet.";
  $("#edState").textContent = d.first
    ? live + " Publish to send these " + S.zones.length + " zones and rules to every agency."
    : d.count ? d.count + (d.count === 1 ? " unpublished change. " : " unpublished changes. ") + live
              : "No unpublished changes. " + live;
  $("#edPublish").classList.toggle("primary", d.first || d.count > 0);
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
  const list = d.lines.length
    ? '<ul class="note" style="margin:8px 0 0 18px;padding:0">' + d.lines.slice(0, 12).map(l => '<li>' + esc(l) + '</li>').join("") +
      (d.lines.length > 12 ? '<li>and ' + (d.lines.length - 12) + ' more</li>' : '') + '</ul>'
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
        const err = await publishPack(pack);
        if (err) { btn.disabled = false; btn.textContent = "Publish v" + next; toast(err); return; }
        S.packVersion = pack.version; S.packIssued = pack.issued; S.packNote = pack.note;
        PUBLISHED = pack; save(); closeModal(); renderData(); updateDraft(); renderHistory();
        toast("Published v" + pack.version + ". Agencies get it within a few minutes.");
      } }]);
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
  Key.clear();
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

/* ---------- start ---------- */
if (Key.get()) {
  trySignIn(Key.get()).then(err => { if (err) showGate(err); else openConsole(); });
} else {
  showGate();
}
