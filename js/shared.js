/* ============================================================
   Shared listings and the realtor's in-character name.

   Every browser keeps its own records, as before. When shared
   listings are switched on (js/shared-config.js), each saved
   property is also sent to Supabase so every agency sees it on
   the Listings tab and the map. Clients, loans and photo files
   never leave the browser; photo links do.

   Nobody logs in. Each browser gets a hidden ID from Supabase the
   first time it saves, and the database only lets that ID change
   or remove its own listings. The Regional Director can remove any.
   ============================================================ */
const Shared = (function () {
  const CFG = window.HUG_SHARED || {};
  const ON = !!(CFG.url && CFG.key);
  const BASE = ON ? String(CFG.url).replace(/\/+$/, "") : "";
  const K = { profile: "hug.profile", auth: "hug.auth", pushed: "hug.pushed" };
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let profile = read(K.profile);
  let auth = read(K.auth);
  let pushed = read(K.pushed) || { owner: null, sigs: {} };
  let list = [];
  let loaded = false, problem = "", busy = false, again = false, timer = null;
  let showing = "mine";

  /* ---------- talking to Supabase ---------- */
  const jsonHeaders = () => ({ apikey: CFG.key, "Content-Type": "application/json" });
  const stamp = a => { if (a && !a.expires_at) a.expires_at = Math.floor(Date.now() / 1000) + (+a.expires_in || 3600); return a; };

  async function session() {
    const now = Date.now() / 1000;
    if (auth && auth.access_token && auth.expires_at - 60 > now) return auth;
    if (auth && auth.refresh_token) {
      const r = await fetch(BASE + "/auth/v1/token?grant_type=refresh_token",
        { method: "POST", headers: jsonHeaders(), body: JSON.stringify({ refresh_token: auth.refresh_token }) });
      if (r.ok) { auth = stamp(await r.json()); write(K.auth, auth); return auth; }
    }
    const r = await fetch(BASE + "/auth/v1/signup", { method: "POST", headers: jsonHeaders(), body: "{}" });
    if (!r.ok) {
      let msg = ""; try { msg = (await r.json()).msg || ""; } catch (e) {}
      throw new Error(/anonymous/i.test(msg) || r.status === 422
        ? "Anonymous sign-ins are switched off in Supabase."
        : "Couldn’t reach the shared listings (" + r.status + ").");
    }
    auth = stamp(await r.json()); write(K.auth, auth);
    return auth;
  }
  const me = () => (auth && auth.user && auth.user.id) || null;

  async function api(path, opts) {
    const a = await session();
    const o = opts || {};
    const r = await fetch(BASE + "/rest/v1/" + path, Object.assign({}, o, {
      headers: Object.assign(jsonHeaders(), { Authorization: "Bearer " + a.access_token }, o.headers || {})
    }));
    if (!r.ok) {
      let msg = ""; try { msg = (await r.json()).message || ""; } catch (e) {}
      throw new Error(msg || "The shared listings answered " + r.status + ".");
    }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  }

  /* ---------- what goes out for one property ---------- */
  function payload(p) {
    const f = p.form || {};
    const mods = f.mods || {};
    const features = (S.rules.mods || []).filter(m => m.id !== "rooms" && !(m.requires && !mods[m.requires]))
      .map(m => describeMod(m, mods[m.id])).filter(Boolean).slice(0, 60);
    const photos = (f.photos || []).filter(x => x && x.kind === "url" && x.url).map(x => x.url).slice(0, 12);
    return {
      owner: me(), local_id: String(p.id),
      agent: (profile && profile.name || "").slice(0, 60), agency: (profile && profile.agency || "").slice(0, 60),
      address: String(p.address || "").slice(0, 120), zone: +p.zone || null, status: p.status || "Draft",
      appraisal: Math.round(+p.appraisal || 0), asking: Math.round(+p.list || 0),
      sold_for: p.soldFor ? Math.round(+p.soldFor) : null,
      sqft: sqftOf(f) || null, rooms: +mods.rooms || null,
      features, photos, updated_at: new Date(p.updated || Date.now()).toISOString()
    };
  }
  const sigOf = b => JSON.stringify([b.agent, b.agency, b.address, b.zone, b.status, b.appraisal, b.asking,
    b.sold_for, b.sqft, b.rooms, b.features, b.photos]);

  /* Send what changed since last time, and take down what was removed. */
  async function sync() {
    if (!ON || !profile || !profile.name) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      await session();
      if (pushed.owner !== me()) pushed = { owner: me(), sigs: {} };
      const here = {};
      const out = [];
      S.properties.forEach(p => {
        here[p.id] = true;
        const b = payload(p), s = sigOf(b);
        if (pushed.sigs[p.id] !== s) out.push([p.id, b, s]);
      });
      for (let i = 0; i < out.length; i += 50) {
        const chunk = out.slice(i, i + 50);
        await api("listings?on_conflict=owner,local_id", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(chunk.map(c => c[1]))
        });
        chunk.forEach(c => { pushed.sigs[c[0]] = c[2]; });
        write(K.pushed, pushed);
      }
      const gone = Object.keys(pushed.sigs).filter(id => !here[id]);
      for (const id of gone) {
        await api("listings?owner=eq." + me() + "&local_id=eq." + encodeURIComponent(id), { method: "DELETE" });
        delete pushed.sigs[id];
        write(K.pushed, pushed);
      }
      problem = "";
      if (out.length || gone.length || !loaded) await fetchAll();
    } catch (e) {
      problem = e.message || String(e);
      paintStatus();
    } finally {
      busy = false;
      if (again) { again = false; queue(); }
    }
  }
  function queue() {
    if (!ON) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 1200);
  }

  async function fetchAll() {
    if (!ON) return;
    try {
      list = (await api("listings?select=*&order=updated_at.desc&limit=2000")) || [];
      loaded = true; problem = "";
    } catch (e) { problem = e.message || String(e); }
    if (showing === "all") renderPortfolio();
    if (S.ui.mode === "listings" && $("#view-map").classList.contains("on")) drawPins();
    paintStatus();
  }

  /* ---------- the realtor's name ---------- */
  function askName(first) {
    const p = profile || {};
    openModal(first ? "Welcome to the San Andreas MLS" : "Your realtor name",
      (first ? '<p class="note" style="margin-bottom:10px">What’s your realtor name? It goes on every listing ' +
        'you save, so other agencies know who to call. It’s kept on this device.</p>' : '') +
      '<div class="fields"><label><span class="lab">Realtor name</span>' +
        '<input id="pf_name" maxlength="60" placeholder="Ricky Realtor" value="' + esc(p.name || "") + '"></label>' +
      '<label><span class="lab">Agency</span>' +
        '<input id="pf_agency" maxlength="60" placeholder="Dynasty 8" value="' + esc(p.agency || "") + '"></label></div>',
      [{ label: first ? "Later" : "Cancel", run: closeModal },
       { label: "Save", kind: "primary", run: m => {
          const name = $("#pf_name", m).value.trim();
          if (!name) { toast("Put in your realtor name first."); return; }
          profile = { name, agency: $("#pf_agency", m).value.trim() };
          write(K.profile, profile);
          closeModal(); paintWho(); toast("You’re listing as " + name + ".");
          queue();
        } }]);
  }

  /* ---------- Listings tab: mine or every agency ---------- */
  function paintWho() {
    const host = $("#view-portfolio .pagehead > div");
    if (!host) return;
    let box = $("#sharedWho");
    if (!box) {
      box = document.createElement("div");
      box.id = "sharedWho";
      host.appendChild(box);
    }
    box.innerHTML = (ON ? '<div class="seg" id="pfScope" style="max-width:300px;margin:10px 0 6px">' +
        '<button data-scope="mine" aria-pressed="' + (showing === "mine") + '">My listings</button>' +
        '<button data-scope="all" aria-pressed="' + (showing === "all") + '">All agencies</button></div>' : '') +
      '<p class="note" style="margin:4px 0 0">' + (profile && profile.name
        ? 'Listing as <strong>' + esc(profile.name) + '</strong>' + (profile.agency ? ' · ' + esc(profile.agency) : '')
        : 'No realtor name yet') +
      ' · <a href="#" id="pfWhoEdit">' + (profile && profile.name ? "Change" : "Add your name") + '</a>' +
      (problem && ON ? ' <span class="drift" title="' + esc(problem) + '">· shared listings offline</span>' : '') + '</p>';
    $("#pfWhoEdit").onclick = e => { e.preventDefault(); askName(false); };
    $$("#pfScope button").forEach(b => b.onclick = () => {
      showing = b.dataset.scope;
      if (showing === "all") fetchAll();
      paintWho(); renderPortfolio();
    });
  }
  function paintStatus() {
    paintWho();
    const s = $("#sharedStatus");
    if (s) s.innerHTML = statusHTML();
  }

  const ago = iso => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 90) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  };
  const whoOf = l => esc(l.agent || "Unnamed") + (l.agency ? '<div class="note">' + esc(l.agency) + '</div>' : '');
  const mine = l => l.owner === me();

  function renderAllAgencies() {
    const q = ($("#pfSearch").value || "").toLowerCase();
    const st = $("#pfStatus").value;
    const zSel = $("#pfZone");
    const zf = zSel.value;
    const used = S.zones.filter(z => list.some(l => String(l.zone) === String(z.id)));
    zSel.innerHTML = '<option value="">All zones</option>' + used.map(z =>
      '<option value="' + z.id + '"' + (String(z.id) === zf ? " selected" : "") + '>' + esc(z.name) + '</option>').join("");
    const sort = $("#pfSort").value || "new";

    let rows = list.filter(l => {
      const z = zoneById(l.zone);
      const hay = (l.address + " " + (z ? z.name : "") + " " + l.agent + " " + l.agency).toLowerCase();
      return (!q || hay.indexOf(q) >= 0) && (!st || l.status === st) && (!zf || String(l.zone) === zf);
    });
    if (sort === "price") rows.sort((a, b) => (b.asking || 0) - (a.asking || 0));
    else if (sort === "address") rows.sort((a, b) => a.address.localeCompare(b.address));
    else if (sort === "zone") rows.sort((a, b) => ((zoneById(a.zone) || {}).name || "").localeCompare((zoneById(b.zone) || {}).name || ""));

    const agents = new Set(list.map(l => l.owner)).size;
    const onMarket = list.filter(l => l.status === "Listed" || l.status === "Auction");
    $("#pfStats").innerHTML =
      '<div class="stat"><div class="n">' + list.length + '</div><div class="l">Shared listings</div></div>' +
      '<div class="stat"><div class="n">' + agents + '</div><div class="l">Realtors</div></div>' +
      '<div class="stat"><div class="n">' + money(onMarket.reduce((s, l) => s + (l.asking || 0), 0)) +
        '</div><div class="l">On the market</div></div>';
    $("#pfStale").innerHTML = problem
      ? '<div class="warn" style="margin-bottom:10px"><strong>Shared listings are offline.</strong> ' + esc(problem) + '</div>' : "";

    if (!rows.length) {
      $("#pfTable").innerHTML = '<div class="empty"><strong>' + (list.length ? "Nothing matches that" : loaded ? "No shared listings yet" : "Loading…") +
        '</strong>' + (list.length ? "Try a different address, zone or status." : loaded ? "Saved properties from every agency show up here." : "") + '</div>';
      return;
    }
    $("#pfTable").innerHTML = '<table class="data"><thead><tr><th>Address</th><th>Zone</th><th class="num">Asking</th>' +
      '<th>Status</th><th>Realtor</th><th>Updated</th><th></th></tr></thead><tbody>' +
      rows.map(l => {
        const z = zoneById(l.zone);
        const shot = (l.photos || [])[0];
        return '<tr><td>' + (shot ? '<img class="thumb" src="' + esc(shot) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
          '<strong>' + esc(l.address) + '</strong>' +
          ((l.features || []).length ? '<div class="note">' + esc(l.features.slice(0, 3).map(lcPhrase).join(", ")) +
            (l.features.length > 3 ? "…" : "") + '</div>' : '') + '</td>' +
          '<td>' + esc(z ? z.name : "—") + '</td>' +
          '<td class="num">' + money(l.status === "Sold" && l.sold_for ? l.sold_for : l.asking) + '</td>' +
          '<td>' + statusChip(l.status || "Draft") + '</td>' +
          '<td>' + whoOf(l) + (mine(l) ? ' <span class="chip listed">You</span>' : '') + '</td>' +
          '<td class="note">' + ago(l.updated_at) + '</td>' +
          '<td style="white-space:nowrap"><button class="btn sm" data-view-shared="' + esc(l.id) + '">View</button>' +
          (MODE === "director" && !mine(l) ? ' <button class="btn sm danger" data-take-down="' + esc(l.id) + '">Remove</button>' : '') +
          '</td></tr>';
      }).join("") + '</tbody></table>';
    $$("#pfTable [data-view-shared]").forEach(b => b.onclick = () => viewListing(b.dataset.viewShared));
    $$("#pfTable [data-take-down]").forEach(b => b.onclick = () => takeDown(b.dataset.takeDown));
    stampTables();
  }

  function viewListing(id) {
    const l = list.find(x => x.id === id); if (!l) return;
    const z = zoneById(l.zone);
    if (mine(l) && propById(l.local_id)) { propertyModal(l.local_id); return; }
    const size = [l.sqft ? Number(l.sqft).toLocaleString() + " sq ft" : "", l.rooms ? l.rooms + (l.rooms === 1 ? " room" : " rooms") : ""]
      .filter(Boolean).join(" · ");
    openModal(l.address,
      '<div class="row" style="gap:8px;margin-bottom:8px">' + statusChip(l.status || "Draft") +
        '<span class="note">' + esc(z ? z.name : "Unknown zone") + (size ? " · " + size : "") + '</span></div>' +
      '<div class="cols3" style="margin:10px 0">' +
        '<div class="stat"><div class="n">' + money(l.asking) + '</div><div class="l">Asking</div></div>' +
        '<div class="stat"><div class="n">' + money(l.appraisal) + '</div><div class="l">Appraised</div></div>' +
        (l.sold_for ? '<div class="stat"><div class="n">' + money(l.sold_for) + '</div><div class="l">Sold for</div></div>' : '') +
      '</div>' +
      ((l.features || []).length ? '<p><strong>Features:</strong> ' + esc(l.features.join(", ")) + '</p>' : '') +
      '<p style="margin-top:8px"><strong>Realtor:</strong> ' + esc(l.agent || "Unnamed") +
        (l.agency ? " · " + esc(l.agency) : "") + '</p>' +
      '<p class="note" style="margin:4px 0 10px">Updated ' + ago(l.updated_at) + '</p>' +
      photoGrid((l.photos || []).map(u => ({ kind: "url", url: u }))),
      [{ label: "Close", run: closeModal }].concat(z ? [{ label: "Show on map", run: () => {
          closeModal(); S.ui.mode = "listings"; save(); showView("map"); selectZone(z.id); } }] : []));
  }

  async function takeDown(id) {
    const l = list.find(x => x.id === id); if (!l) return;
    openModal("Remove a shared listing",
      '<p>Take <strong>' + esc(l.address) + '</strong> by ' + esc(l.agent || "an unnamed realtor") +
      ' off the shared listings?</p><p class="note" style="margin-top:8px">It stays in their own browser. ' +
      'If they save it again it comes back.</p>',
      [{ label: "Keep it", run: closeModal },
       { label: "Remove", kind: "danger", run: async () => {
          closeModal();
          try {
            const gone = await api("listings?id=eq." + encodeURIComponent(id),
              { method: "DELETE", headers: { Prefer: "return=representation" } });
            if (!gone || !gone.length) {
              toast("Not removed. This browser isn’t on the director list yet. Its ID is on the Records tab.");
              return;
            }
            toast("Removed from the shared listings.");
            fetchAll();
          } catch (e) { toast(e.message || "Couldn’t remove it."); }
        } }]);
  }

  /* ---------- the map ---------- */
  function mapItems() {
    if (!ON) return [];
    const id = me();
    return list.filter(l => l.owner !== id).map(l => ({
      zone: l.zone, status: l.status || "Draft", list: l.asking || 0, address: l.address,
      who: l.agent || "", open: () => viewListing(l.id)
    }));
  }

  /* ---------- Records (director) ---------- */
  function statusHTML() {
    if (!ON) return '<div class="note">Shared listings are off. Put the Supabase project URL and public key in ' +
      '<code>js/shared-config.js</code> to switch them on.</div>';
    return (problem ? '<div class="warn" style="margin-bottom:8px">' + esc(problem) + '</div>'
        : '<div class="ok" style="margin-bottom:8px">Connected. ' + list.length + ' shared listing' + (list.length === 1 ? '' : 's') + '.</div>') +
      '<p class="note" style="margin:0 0 6px">To let this browser remove anyone’s listing, add its ID to the ' +
      'directors table in Supabase (SQL Editor):</p>' +
      '<pre class="codebox">' + (me() ? "insert into public.directors values ('" + esc(me()) + "');" : "Save a property or press Connect to get an ID.") + '</pre>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm" id="btnSharedConnect">' + (me() ? "Refresh" : "Connect") + '</button>' +
      (me() ? '<button class="btn sm" id="btnSharedCopy">Copy</button>' : '') + '</div>';
  }
  function mountRecords() {
    const cols = $("#view-data .cols");
    if (!cols || $("#sharedPanel")) return;
    const panel = document.createElement("div");
    panel.className = "panel"; panel.id = "sharedPanel";
    panel.innerHTML = '<h2>Shared listings</h2><div class="body" id="sharedStatus"></div>';
    cols.appendChild(panel);
    $("#sharedStatus").innerHTML = statusHTML();
    $("#sharedStatus").addEventListener("click", async e => {
      if (e.target.id === "btnSharedConnect") {
        try { await session(); await fetchAll(); } catch (err) { problem = err.message; paintStatus(); }
      }
      if (e.target.id === "btnSharedCopy") {
        try { await navigator.clipboard.writeText("insert into public.directors values ('" + me() + "');"); toast("Copied."); }
        catch (err) { toast("Select the line and copy it."); }
      }
    });
  }

  /* ---------- start ---------- */
  function start() {
    paintWho();
    mountRecords();
    if (!profile || !profile.name) setTimeout(() => { if (!$("#scrim").classList.contains("on")) askName(true); }, 400);
    if (ON) {
      fetchAll().then(() => queue());
      setInterval(() => { if (document.visibilityState === "visible") fetchAll(); }, 60000);
    }
  }

  return {
    on: ON, queue, start, mapItems, askName,
    showingAll: () => ON && showing === "all",
    renderAll: renderAllAgencies
  };
})();
Shared.start();
