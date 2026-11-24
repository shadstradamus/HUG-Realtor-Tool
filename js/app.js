
"use strict";
/* ============================================================
   San Andreas MLS — Department of Housing and Urban Gentrification
   Author: N92 Development Works
   Agency records live in each browser. Zones, prices and rules come
   from rules.json, which the Regional Director publishes from
   admin.html; every agency picks it up on its next visit.

   Legacy modifiers — rooms, pools, balconies, torture rooms,
   and anything the house rules add — live in rules.mods. Modern
   appraisal uses the fixed additive formula alongside them.
   ============================================================ */

const BUILD = "1.0";
const SCHEMA = 9;
const KEY = "dynasty8.terminal";

/* ---------- storage (degrades to memory if the browser blocks it) ---------- */
let memFallback = null;
const Store = {
  ok: true,
  read() {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; }
    catch (e) { this.ok = false; return memFallback; }
  },
  write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); memFallback = obj; return true; }
    catch (e) {
      memFallback = obj; this.ok = false;
      toast(e && e.name === "QuotaExceededError"
        ? "Out of browser storage. Export a backup, then remove the custom map image."
        : "This browser is blocking saves. Export a backup before you close the tab.");
      return false;
    }
  },
  bytes() { try { return (localStorage.getItem(KEY) || "").length; } catch (e) { return 0; } }
};

/* ---------- zones ---------- */
// Pin coordinates are pixels on the 2048x2048 map images.
/* Warehouses are sold at a flat rate. The interior is the same interior
   wherever the door is, so no zone multiplier applies. Order is smallest
   to largest, which is also the order they appear in the script. */
const DEFAULT_WAREHOUSES = [
  { id: "compact_warehouse",  label: "Executive Lockup",     tier: "small",  price: 250000,
    interior: "Corrugated lockup, single roller door" },
  { id: "standard_warehouse", label: "Executive Depot",      tier: "small",  price: 325000,
    interior: "Fitted workshop with benches and cabinets" },
  { id: "premium_warehouse",  label: "Executive Storage",    tier: "small",  price: 425000,
    interior: "Clean white hall, open floor" },
  { id: "small_warehouse",    label: "Corporate Warehouse",  tier: "small",  price: 600000,
    interior: "Small cargo warehouse, two racking bays" },
  { id: "medium_warehouse",   label: "Commercial Warehouse", tier: "medium", price: 850000,
    interior: "Medium cargo warehouse, rows of racking" },
  { id: "large_warehouse",    label: "Large Warehouse",      tier: "xl",     price: 1400000,
    interior: "Large cargo warehouse, full racking aisles" },
  { id: "car_garage",         label: "Enterprise Warehouse", tier: "xl",     price: 1700000,
    interior: "Vehicle warehouse with lifts and bays" },
  { id: "xl_warehouse",       label: "Premier Warehouse",    tier: "xl",     price: 2000000,
    interior: "Underground vehicle floor, multiple levels" }
];

const DEFAULT_ZONES = [
  // base = a typical 4-room property. floor/ceiling are soft bounds: value beyond
  // them still counts, at 25%. Anchored to the real Los Angeles counterparts,
  // scaled so Beverly Hills tops the ordinary market under $1M.
  { id: 15, name: "Stab City",                     base: 85000,   floor: 75000,   ceiling: 145000,  x: 1102, y: 662 },
  { id: 17, name: "Wind Farm Trailer Park",        base: 88000,   floor: 75000,   ceiling: 150000,  x: 1330, y: 762 },
  { id: 18, name: "Senora Freeway",                base: 90000,   floor: 75000,   ceiling: 153000,  x: 1180, y: 900 },
  { id: 16, name: "Sandy Shores",                  base: 92000,   floor: 75000,   ceiling: 156000,  x: 1228, y: 738 },
  { id: 14, name: "Harmony",                       base: 95000,   floor: 75000,   ceiling: 162000,  x: 950,  y: 860 },
  { id: 21, name: "Alamo",                         base: 98000,   floor: 76000,   ceiling: 167000,  x: 1090, y: 700 },
  { id: 23, name: "Cayo Perico",                   base: 100000,  floor: 78000,   ceiling: 170000,  x: 165,  y: 1855, offshore: true },
  { id: 20, name: "Grapeseed",                     base: 105000,  floor: 82000,   ceiling: 179000,  x: 1248, y: 556 },
  { id: 1,  name: "South Los Santos",              base: 115000,  floor: 90000,   ceiling: 196000,  x: 905,  y: 1525 },
  { id: 25, name: "East Los Santos",               base: 130000,  floor: 101000,  ceiling: 221000,  x: 1075, y: 1522 },
  { id: 3,  name: "Downtown",                      base: 145000,  floor: 113000,  ceiling: 247000,  x: 890,  y: 1400 },
  { id: 5,  name: "Little Seoul / Vespucci Canals",base: 155000,  floor: 121000,  ceiling: 264000,  x: 722,  y: 1478 },
  { id: 4,  name: "Lower Vespucci / Little Seoul", base: 165000,  floor: 129000,  ceiling: 281000,  x: 762,  y: 1432 },
  { id: 22, name: "Paleto Bay",                    base: 175000,  floor: 137000,  ceiling: 298000,  x: 905,  y: 252 },
  { id: 9,  name: "Vinewood",                      base: 210000,  floor: 164000,  ceiling: 357000,  x: 925,  y: 1288 },
  { id: 2,  name: "Mirror Park",                   base: 250000,  floor: 195000,  ceiling: 425000,  x: 1005, y: 1372 },
  { id: 12, name: "Upper Mirror Park",             base: 305000,  floor: 238000,  ceiling: 519000,  x: 1022, y: 1330 },
  { id: 7,  name: "Del Perro",                     base: 325000,  floor: 254000,  ceiling: 553000,  x: 632,  y: 1390 },
  { id: 8,  name: "Morningwood",                   base: 510000,  floor: 398000,  ceiling: 867000,  x: 648,  y: 1352 },
  { id: 13, name: "Chumash",                       base: 770000,  floor: 601000,  ceiling: 1310000, x: 478,  y: 1010 },
  { id: 10, name: "Vinewood Hills",                base: 900000,  floor: 702000,  ceiling: 1530000, x: 845,  y: 1158 },
  { id: 6,  name: "Rockford Hills",                base: 950000,  floor: 741000,  ceiling: 1620000, x: 763,  y: 1322 },
  { id: 11, name: "Medrazzo Ranch",                base: 2500000, floor: 1950000, ceiling: 4250000, x: 1000, y: 1000, unique: true },
  { id: 19, name: "Lighthouse",                    base: 2500000, floor: 1950000, ceiling: 4250000, x: 1418, y: 764,  unique: true },
  { id: 26, name: "Farmhouse Grapeseed",           base: 2500000, floor: 1950000, ceiling: 4250000, x: 1312, y: 512,  unique: true },
  { id: 24, name: "Cayo Mansion",                  base: 2500000, floor: 1950000, ceiling: 4250000, x: 268,  y: 1900, offshore: true, unique: true }
];

/* Fieldset order on the appraisal form. Any module with a group not listed
   here is appended after these, so a custom section still shows up. */
const GROUPS = ["Counts", "Property", "Grounds and features", "Disclosures and hazards", "Other"];

function legacyMods() {
  return [
    // value / value2  drive the legacy multiplier model
    // pct / pctExtra / options[].pct drive the modern model
    { id: "rooms",       label: "Rooms",                       group: "Counts", kind: "count",  value: 1.1, pct: 0,
      hint: "Rooms only \u2014 hallways don't count. Four rooms is the baseline." },
    { id: "pools",       label: "Pools",                       group: "Counts", kind: "tiered", value: 1.4, value2: 1.2,
      pct: 4, pctExtra: -2, hint: "A second pool eats the yard and costs value" },
    { id: "garages",     label: "Garages",                     group: "Counts", kind: "count",  value: 1.1,
      flat: 12000, flatExtra: 6000, hint: "A fixed amount each, not a share of the zone price" },
    { id: "buildings",   label: "Additional buildings",        group: "Counts", kind: "count",  value: 1.3, pct: 8, pctExtra: 4 },
    { id: "courts",      label: "Tennis or basketball courts", group: "Counts", kind: "count",  value: 1.2,
      flat: 10000, flatExtra: 4000 },

    { id: "type",        label: "Property type",               group: "Property", kind: "choice", value: 1,
      options: [{ label: "House", value: 1, pct: 0 }, { label: "Apartment", value: 0.9, pct: -8 },
                { label: "Trailer", value: 0.8, pct: -18 }] },

    { id: "driveway",    label: "Paved driveway",              group: "Grounds and features", kind: "toggle", value: 1.1, flat: 3000 },
    { id: "frontGarden", label: "Front garden",                group: "Grounds and features", kind: "choice", value: 1,
      options: [{ label: "None", value: 1, pct: 0 }, { label: "Small", value: 1.1, pct: 2 },
                { label: "Large", value: 1.2, pct: 5 }] },
    { id: "rearGarden",  label: "Rear garden",                 group: "Grounds and features", kind: "choice", value: 1,
      options: [{ label: "None", value: 1, pct: 0 }, { label: "Small", value: 1.3, pct: 4 },
                { label: "Large", value: 1.45, pct: 8 }] },
    { id: "decking",     label: "Decking or patio",            group: "Grounds and features", kind: "toggle", value: 1.1, pct: 3 },
    { id: "beachfront",  label: "Beachfront or water access",  group: "Grounds and features", kind: "toggle", value: 1.1, pct: 20,
      hint: "Water is the biggest single driver of land value" },
    { id: "balcony",     label: "Balcony",                     group: "Grounds and features", kind: "toggle", value: 1.4, pct: 3 },
    { id: "shed",        label: "Shed",                        group: "Grounds and features", kind: "toggle", value: 1.1, flat: 4000 },
    { id: "solar",       label: "Solar panels",                group: "Grounds and features", kind: "toggle", value: 1.1, flat: 9000 },
    { id: "mlo",         label: "Custom interior (MLO)",       group: "Grounds and features", kind: "toggle", value: 1.6, pct: 10,
      forcesAuction: true },
    { id: "storage",     label: "Storage or warehouse",        group: "Grounds and features", kind: "choice", value: 1,
      outside: true, hint: "Exempt from the square root in legacy",
      options: [{ label: "None", value: 1, pct: 0 }, { label: "Standard", value: 1.6, pct: 12 },
                { label: "Large", value: 2.4, pct: 22 }] },
    { id: "exotic",      label: "Exotic or unique feature",    group: "Grounds and features", kind: "free", value: 1.2,
      value2: 5, pct: 8, forcesAuction: true,
      hint: "Legacy uses the multiplier you type; modern adds a flat percentage per feature." },

    { id: "torture",     label: "Hidden torture room",         group: "Disclosures and hazards", kind: "choice", value: 1,
      special: true,
      options: [{ label: "None", value: 1 }, { label: "Torture room", value: 2 }, { label: "Torture + armoury", value: 4 }] },
    { id: "drugLab",     label: "Hidden drug lab",             group: "Disclosures and hazards", kind: "toggle", value: 2, special: true },
    { id: "panic",       label: "Panic mode lockdown",         group: "Disclosures and hazards", kind: "toggle", value: 8, special: true },
    { id: "cougars",     label: "Cougars spawn in the garden", group: "Disclosures and hazards", kind: "toggle", value: 0.9, penaltyPct: 10 },
    { id: "death",       label: "Recorded death in the house", group: "Disclosures and hazards", kind: "toggle", value: 0.8, penaltyPct: 12,
      hint: "A stigmatised property sells slower, not cheaper by much" },
    { id: "crimeArea",   label: "Violent crime area",          group: "Disclosures and hazards", kind: "toggle", value: 0.9, penaltyPct: 10,
      hint: "Players are known to be robbed here" }
  ];
}

const DEFAULT_RULES = {
  mods: legacyMods(),
  policy: {
    roundIncrement: 5000, minDownPct: 20,
    agentCommissionPct: 6,
    evictionWarnDays: 7, furnitureMinPct: 20, furnitureMaxPct: 50,
    locationShare: 70, featureFullTo: 25, featureTaper: 50, maxDepreciationPct: 30, boundGive: 25,
    auctionsEnabled: 1, uniqueForcesAuction: 1
  }
};

/* ------------------------------------------------------------
   RULES PACK — an embedded pack still works, but the site normally
   gets its zones and rules from rules.json (see loadPublishedRules).
   ------------------------------------------------------------ */
/*PACK_START*/
const OFFICE_PACK = { version: 0, issued: "", note: "", zones: null, rules: null };
/*PACK_END*/

function applyOfficePack(state, given, force) {
  const pack = given || ((typeof OFFICE_PACK !== "undefined") ? OFFICE_PACK : null);
  if (!pack || !pack.version) return null;
  if (!force && (state.packVersion || 0) >= pack.version) return null;
  const changes = [];
  if (pack.zones && pack.zones.length) {
    const before = state.zones.length;
    const byId = {};
    state.zones.forEach(z => { byId[z.id] = z; });
    pack.zones.forEach(z => {
      if (byId[z.id]) Object.assign(byId[z.id], z); else state.zones.push(clone(z));
    });
    if (pack.replaceZones) {
      const keep = new Set(pack.zones.map(z => String(z.id)));
      state.zones = state.zones.filter(z => keep.has(String(z.id)));
    }
    const added = state.zones.length - before;
    changes.push(added > 0 ? added + " new zones, " + pack.zones.length + " updated"
                           : pack.zones.length + " zones updated");
  }
  if (Array.isArray(pack.warehouses) && pack.warehouses.length) {
    const byId = {};
    state.warehouses.forEach(w => { byId[w.id] = w; });
    pack.warehouses.forEach(w => {
      if (byId[w.id]) Object.assign(byId[w.id], w); else state.warehouses.push(clone(w));
    });
    changes.push("warehouse prices updated");
  }
  if (pack.rules) {
    const policy = clone(state.rules.policy);
    state.rules = deepFill(clone(pack.rules), clone(DEFAULT_RULES));
    if (!Array.isArray(state.rules.mods) || !state.rules.mods.length) state.rules.mods = legacyMods();
    if (pack.keepLocalPolicy) state.rules.policy = policy;
    if (state.rules.policy) delete state.rules.policy.societyCommissionPct;
    changes.push("multipliers updated");
  }
  state.packVersion = pack.version;
  state.packIssued = pack.issued;
  state.packNote = pack.note;
  return changes.join(" · ");
}

function blankState() {
  return {
    schema: SCHEMA,
    zones: clone(DEFAULT_ZONES),
    warehouses: clone(DEFAULT_WAREHOUSES),
    rules: clone(DEFAULT_RULES),
    properties: [], clients: [], loans: [],
    ui: { layer: "atlas", mode: "zones", sections: {} },
    packVersion: 0, packIssued: "", packNote: "", lastExport: null,
    customMap: null,
    lastForm: null
  };
}

/* ---------- migrations: old saves open in new builds ---------- */
// Turn a v3 form's loose fields into the module map the engine now reads.
function liftForm(f) {
  if (!f || f.mods) return f;
  const out = { address: f.address || "", zone: f.zone, mods: {},
    furnitureCost: f.furnitureCost || 0, furniturePct: f.furniturePct || 30, premiumPct: f.premiumPct || 0 };
  ["rooms", "pools", "garages", "buildings", "courts", "driveway", "frontGarden", "rearGarden",
   "largeRear", "decking", "beachfront", "balcony", "shed", "solar", "mlo", "drugLab", "panic",
   "cougars", "death", "crimeArea"].forEach(k => { if (f[k] !== undefined) out.mods[k] = f[k]; });
  out.mods.type = f.type || "House";
  out.mods.storage = f.storage || "None";
  out.mods.torture = f.torture || "None";
  out.mods.exotic = { mult: f.exoticMult || 0, count: f.exoticCount || 0, note: f.exoticNote || "" };
  Object.keys(f.custom || {}).forEach(id => { out.mods[id] = f.custom[id]; });
  return out;
}

const MIGRATIONS = {
  1: s => { s.loans = s.loans || []; s.clients = s.clients || []; return s; },
  2: s => { s.ui = s.ui || { layer: "atlas", mode: "zones" }; s.customMap = s.customMap || null; return s; },
  // v3 kept every multiplier as its own named field. Rebuild them as modules,
  // carrying across whatever the user had edited.
  3: s => {
    const R = s.rules || {}, st = R.struct || {};
    const mods = legacyMods();
    const by = id => mods.find(m => m.id === id);
    const carry = { rooms: "perRoom", garages: "garage", buildings: "building", courts: "court",
      driveway: "driveway", frontGarden: "frontGarden", rearGarden: "rearGarden", largeRear: "largeRear",
      decking: "decking", beachfront: "beachfront", balcony: "balcony", shed: "shed", solar: "solar",
      mlo: "mlo", drugLab: "drugLab", panic: "panic", cougars: "cougars", death: "death", crimeArea: "crimeArea" };
    Object.keys(carry).forEach(id => {
      const v = R[carry[id]];
      if (typeof v === "number" && by(id)) by(id).value = v;
    });
    if (typeof R.poolFirst === "number") by("pools").value = R.poolFirst;
    if (typeof R.poolExtra === "number") by("pools").value2 = R.poolExtra;
    if (typeof R.exoticMin === "number") by("exotic").value = R.exoticMin;
    if (typeof R.exoticMax === "number") by("exotic").value2 = R.exoticMax;
    by("type").options = [{ label: "House", value: R.typeHouse != null ? R.typeHouse : 1 },
      { label: "Apartment", value: R.typeApartment != null ? R.typeApartment : 0.9 },
      { label: "Trailer", value: R.typeTrailer != null ? R.typeTrailer : 0.8 }];
    by("storage").options = [{ label: "None", value: 1 },
      { label: "Standard", value: R.storageStandard != null ? R.storageStandard : 1.6 },
      { label: "Large", value: R.storageLarge != null ? R.storageLarge : 2.4 }];
    by("torture").options = [{ label: "None", value: 1 },
      { label: "Torture room", value: R.tortureRoom != null ? R.tortureRoom : 2 },
      { label: "Torture + armoury", value: R.tortureArmoury != null ? R.tortureArmoury : 4 }];
    by("storage").outside = st.storageExempt !== false;
    by("type").outside = st.typeInSqrt === false;
    ["cougars", "death", "crimeArea"].forEach(id => { by(id).outside = st.negativesInSqrt === false; });
    by("panic").outside = st.panicInSqrt === false;
    (R.custom || []).forEach(cm => mods.push({ id: cm.id, label: cm.label, group: "Other",
      kind: cm.kind === "count" ? "count" : "toggle", value: cm.value, outside: !!cm.outside }));
    s.rules = { mods: mods, policy: R.policy || clone(DEFAULT_RULES.policy) };
    (s.properties || []).forEach(p => { if (p.form) p.form = liftForm(p.form); });
    if (s.lastForm) s.lastForm = liftForm(s.lastForm);
    delete s.auctions;
    return s;
  },
  // v5 adds the modern appraisal without altering the legacy rules. Existing
  // saved work stays on Legacy until an agent deliberately changes its model.
  4: s => {
    (s.zones || []).forEach(z => {
      if (z.floor == null) z.floor = 0;
      if (z.ceiling == null) z.ceiling = 0;
    });
    (s.properties || []).forEach(p => {
      if (!p.form) return;
      if (!p.form.appraisalModel) p.form.appraisalModel = "modern";
      if (p.form.specialPremium == null) p.form.specialPremium = 0;
    });
    if (s.lastForm) {
      if (!s.lastForm.appraisalModel) s.lastForm.appraisalModel = "modern";
      if (s.lastForm.specialPremium == null) s.lastForm.specialPremium = 0;
    }
    return s;
  },
  // v5 had front garden as a toggle and a separate "large rear" bonus that
  // required the rear garden. Front and rear are now independent sizes.
  5: s => {
    const liftGarden = mods => {
      if (!mods) return;
      if (typeof mods.frontGarden === "boolean") mods.frontGarden = mods.frontGarden ? "Small" : "None";
      const hadRear = mods.rearGarden === true || mods.rearGarden === "Small" || mods.rearGarden === "Large";
      if (typeof mods.rearGarden === "boolean" || mods.largeRear !== undefined) {
        mods.rearGarden = hadRear ? (mods.largeRear ? "Large" : "Small") : "None";
      }
      delete mods.largeRear;
    };
    (s.properties || []).forEach(p => { if (p.form) liftGarden(p.form.mods); });
    if (s.lastForm) liftGarden(s.lastForm.mods);
    (s.rules && s.rules.mods ? s.rules.mods : []).forEach(m => {
      if (m.id === "decking") delete m.requires;
    });
    if (s.rules && Array.isArray(s.rules.mods)) {
      s.rules.mods = s.rules.mods.filter(m => m.id !== "largeRear");
      const fresh = legacyMods();
      ["frontGarden", "rearGarden"].forEach(id => {
        const cur = s.rules.mods.find(m => m.id === id);
        const def = fresh.find(m => m.id === id);
        if (cur && cur.kind !== "choice") Object.assign(cur, def);
      });
      // carry modern percentages onto any module that predates them
      s.rules.mods.forEach(m => {
        const def = fresh.find(x => x.id === m.id);
        if (!def) return;
        if (m.pct === undefined && def.pct !== undefined) m.pct = def.pct;
        if (m.pctExtra === undefined && def.pctExtra !== undefined) m.pctExtra = def.pctExtra;
        if (m.penaltyPct === undefined && def.penaltyPct !== undefined) m.penaltyPct = def.penaltyPct;
        if (m.special === undefined && def.special !== undefined) m.special = def.special;
        if (m.kind === "choice" && def.options) {
          (m.options || []).forEach(o => {
            const d = def.options.find(x => x.label === o.label);
            if (o.pct === undefined && d && d.pct !== undefined) o.pct = d.pct;
          });
        }
      });
    }
    // zones gain soft bounds
    const zdef = {};
    DEFAULT_ZONES.forEach(z => { zdef[z.id] = z; });
    (s.zones || []).forEach(z => {
      const d = zdef[z.id];
      if (!d) return;
      if (!z.floor) z.floor = d.floor;
      if (!z.ceiling) z.ceiling = d.ceiling;
    });
    (s.properties || []).forEach(p => { if (p.form && !p.form.appraisalModel) p.form.appraisalModel = "modern"; });
    return s;
  }
,
  // photos were a list of URL strings; they are records now so local files fit too
  6: s => {
    const lift = form => {
      if (!form || !Array.isArray(form.photos)) return;
      form.photos = form.photos.map(p =>
        typeof p === "string" ? { kind: "url", url: p } : p).filter(Boolean);
    };
    (s.properties || []).forEach(p => lift(p.form));
    lift(s.lastForm);
    return s;
  },
  // warehouses arrive as their own list, priced flat by size
  7: s => {
    if (!Array.isArray(s.warehouses) || !s.warehouses.length) s.warehouses = clone(DEFAULT_WAREHOUSES);
    return s;
  },
  // Remove the obsolete warehouse payout field from older saves.
  8: s => {
    if (s.rules && s.rules.policy) delete s.rules.policy.societyCommissionPct;
    return s;
  }
};

function migrate(s) {
  if (!s || typeof s !== "object") return blankState();
  let v = s.schema || 1;
  while (v < SCHEMA) { const step = MIGRATIONS[v]; if (step) s = step(s); v++; s.schema = v; }
  const base = blankState();
  s.rules = s.rules || clone(base.rules);
  if (!Array.isArray(s.rules.mods) || !s.rules.mods.length) s.rules.mods = legacyMods();
  s.rules.policy = deepFill(s.rules.policy || {}, clone(base.rules.policy));
  delete s.rules.policy.societyCommissionPct;
  s.ui = deepFill(s.ui || {}, clone(base.ui));
  s.zones = Array.isArray(s.zones) && s.zones.length ? s.zones : base.zones;
  s.zones.forEach(z => {
    if (z.floor == null) z.floor = 0;
    if (z.ceiling == null) z.ceiling = 0;
  });
  const have = new Set(s.zones.map(z => String(z.id)));
  base.zones.forEach(z => { if (!have.has(String(z.id))) s.zones.push(z); });
  ["properties", "clients", "loans"].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
  if (!Array.isArray(s.warehouses) || !s.warehouses.length) s.warehouses = clone(DEFAULT_WAREHOUSES);
  if (s.packVersion === undefined) s.packVersion = 0;
  s.schema = SCHEMA;
  return s;
}
function deepFill(target, defaults) {
  Object.keys(defaults).forEach(k => {
    if (target[k] === undefined || target[k] === null) target[k] = clone(defaults[k]);
    else if (isPlain(defaults[k]) && isPlain(target[k])) deepFill(target[k], defaults[k]);
  });
  return target;
}
const isPlain = v => v && typeof v === "object" && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));

let S = migrate(Store.read());
const packApplied = applyOfficePack(S);
const save = () => Store.write(S);
if (packApplied) save();

/* ------------------------------------------------------------
   Local photos live in IndexedDB, not in the main save. localStorage
   holds a few megabytes at most and would be filled by two or three
   screenshots, taking every saved appraisal down with it.
   ------------------------------------------------------------ */
const PhotoStore = (function () {
  const DB = "dynasty8-photos", STORE = "photos";
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (typeof indexedDB === "undefined") { rej(new Error("no indexeddb")); return; }
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => {
        if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE);
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const rq = fn(t.objectStore(STORE));
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    }));
  }
  return {
    put: (key, dataUrl) => tx("readwrite", s => s.put(dataUrl, key)),
    get: key => tx("readonly", s => s.get(key)),
    del: key => tx("readwrite", s => s.delete(key)),
    keys: () => tx("readonly", s => s.getAllKeys()),
    all: () => open().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, "readonly"), s = t.objectStore(STORE);
      const out = {}, rq = s.openCursor();
      rq.onsuccess = () => {
        const c = rq.result;
        if (!c) { res(out); return; }
        out[c.key] = c.value; c.continue();
      };
      rq.onerror = () => rej(rq.error);
    }))
  };
})();

/* Screenshots come in at 4K. Shrink before storing so a property with six
   photos costs megabytes rather than tens of them. */
function shrinkImage(file, maxEdge, quality) {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = () => rej(new Error("could not read the file"));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error("that file isn't an image this browser can read"));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const hgt = Math.max(1, Math.round(img.height * scale));
        const cv = document.createElement("canvas");
        cv.width = w; cv.height = hgt;
        cv.getContext("2d").drawImage(img, 0, 0, w, hgt);
        try { res(cv.toDataURL("image/jpeg", quality)); }
        catch (e) { rej(new Error("that image could not be converted")); }
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

/* ---------- icons ---------- */
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>';
const ICON_LOAD = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
const ICON_UP = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
const ICON_DOWN = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" ' +
  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const money = n => "$" + Math.round(n || 0).toLocaleString("en-US");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const zoneById = id => S.zones.find(z => String(z.id) === String(id));
const propById = id => S.properties.find(p => p.id === id);
const clientById = id => S.clients.find(c => c.id === id);
const modById = id => (S.rules.mods || []).find(m => m.id === id);
const trim = n => String(+(+n).toFixed(4));

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 3200);
}
function when(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
         d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/* ============================================================
   Appraisal engine — walks rules.mods and knows nothing else
   ============================================================ */
function blankForm() {
  return { address: "", zone: 13, appraisalModel: "modern", mods: { rooms: 4 }, specialPremium: 0,
    boundsWaived: false, boundsReason: "", photos: [],
    furnitureCost: 0, furniturePct: 30, premiumPct: 0 };
}
function modValue(m, entry) {
  // { mult, label }, or null when this module contributes nothing
  if (m.kind === "count") {
    const n = Math.max(0, +entry || 0);
    if (!n) return null;
    return { mult: Math.pow(m.value, n), label: n + " × " + m.label.toLowerCase() };
  }
  if (m.kind === "tiered") {
    const n = Math.max(0, +entry || 0);
    if (!n) return null;
    return { mult: m.value * Math.pow(m.value2 == null ? 1 : m.value2, n - 1),
      label: n > 1 ? n + " " + m.label.toLowerCase() : m.label.replace(/s$/, "") };
  }
  if (m.kind === "choice") {
    const opt = (m.options || []).find(o => o.label === entry);
    if (!opt || opt.value === 1) return null;
    return { mult: opt.value, label: m.label + ": " + opt.label };
  }
  if (m.kind === "free") {
    const e = entry || {};
    const mult = +e.mult || 0, n = Math.max(0, +e.count || 0);
    if (!mult || !n) return null;
    return { mult: Math.pow(mult, n), label: (e.note || m.label) + (n > 1 ? " ×" + n : "") };
  }
  return entry ? { mult: m.value, label: m.label } : null;   // toggle
}

function appraiseLegacy(f) {
  const z = zoneById(f.zone) || S.zones[0] || { name: "—", base: 0 };
  const base = z.base || 0;
  const inside = [], outside = [], notes = [], auctionWhy = [];
  const entries = f.mods || {};

  (S.rules.mods || []).forEach(m => {
    if (m.requires && !entries[m.requires]) {
      if (entries[m.id]) {
        const parent = modById(m.requires);
        notes.push(m.label + " only counts with " + (parent ? parent.label.toLowerCase() : "its parent") + " — ignored.");
      }
      return;
    }
    const r = modValue(m, entries[m.id]);
    if (!r) return;
    if (m.kind === "free") {
      const e = entries[m.id] || {};
      const lo = +m.value, hi = +m.value2;
      if (lo && hi && (+e.mult < lo || +e.mult > hi))
        notes.push(m.label + " is outside the " + trim(lo) + "–" + trim(hi) + "× band the house rules allow.");
    }
    (m.outside ? outside : inside).push({ label: r.label, val: r.mult });
    if (m.forcesAuction && S.rules.policy.auctionsEnabled) auctionWhy.push(m.label.toLowerCase());
  });

  const insideProduct = inside.reduce((a, m) => a * m.val, 1);
  const outsideProduct = outside.reduce((a, m) => a * m.val, 1);
  const root = Math.sqrt(insideProduct);
  const appraisal = Math.floor(base * root * outsideProduct);

  const P = S.rules.policy;
  const furn = Math.max(0, +f.furnitureCost || 0);
  const furnPct = Math.min(P.furnitureMaxPct, Math.max(P.furnitureMinPct, +f.furniturePct || 0));
  const furnAdd = furn > 0 ? Math.round(furn * (1 + furnPct / 100)) : 0;

  const inc = Math.max(1, +P.roundIncrement || 1);
  const premium = Math.max(0, +f.premiumPct || 0) / 100;
  let list = Math.ceil((appraisal + furnAdd) * (1 + premium) / inc) * inc;
  if (list < appraisal) list = Math.ceil(appraisal / inc) * inc;

  if (z.unique && S.rules.policy.auctionsEnabled && S.rules.policy.uniqueForcesAuction)
    auctionWhy.push("unique property");

  return { model: "legacy", zone: z, base, inside, outside, insideProduct, outsideProduct, root,
    appraisal, furnAdd, furnPct, list, auction: auctionWhy.length > 0, auctionWhy, notes };
}

/* Modern appraisal separates location, room value, features, disclosures and
   special-use premiums. Its office-wide percentages and soft-bound behavior
   are controlled by the house rules. */
/* Modern reads its percentages off the modules themselves, so anything you add
   on the Rules tab works here exactly as the built-in features do. */
const MODERN_SPECIAL_IDS = new Set(["torture", "drugLab", "panic"]);

function entryCount(m, entry) {
  if (m.kind === "count" || m.kind === "tiered") return Math.max(0, +entry || 0);
  if (m.kind === "choice") return entry && entry !== "None" ? 1 : 0;
  if (m.kind === "free") return Math.max(0, +(entry || {}).count || 0);
  return entry ? 1 : 0;
}
function roomUnits(rooms) {
  const n = Math.max(0, rooms);
  return Math.min(n, 4) + Math.min(Math.max(n - 4, 0), 4) * .70 +
    Math.min(Math.max(n - 8, 0), 4) * .45 + Math.max(n - 12, 0) * .25;
}
function isSpecialUse(m) { return m.special === true || MODERN_SPECIAL_IDS.has(m.id); }
function penaltyPctOf(m) { return +m.penaltyPct || 0; }

/* A feature contributes either a share of the zone base or a fixed amount.
   Fixed suits anything with a real cost of its own \u2014 a shed is a shed whether
   it stands in Sandy Shores or Rockford Hills. */
function isFlatFeature(m) {
  return (+m.flat || 0) !== 0 || (+m.flatExtra || 0) !== 0 ||
    (m.kind === "choice" && (m.options || []).some(o => +o.flat));
}
function modernFeatureValue(m, entry) {
  const n = entryCount(m, entry);
  if (!n) return null;
  if (m.kind === "choice") {
    const opt = (m.options || []).find(o => o.label === entry);
    if (!opt) return null;
    const label = m.label + ": " + opt.label;
    if (+opt.flat) return { label, flat: +opt.flat };
    if (+opt.pct) return { label, pct: +opt.pct };
    return null;
  }
  const label = n > 1 ? n + " \u00d7 " + m.label.toLowerCase() : m.label;
  if (isFlatFeature(m)) {
    const flat = (+m.flat || 0) + Math.max(0, n - 1) * (+m.flatExtra || 0);
    return flat ? { label, flat } : null;
  }
  const pct = (+m.pct || 0) + Math.max(0, n - 1) * (+m.pctExtra || 0);
  return pct ? { label, pct } : null;
}

/* Feature adjustments taper rather than stopping dead, so adding something
   always moves the price a little. */
function taperFeatures(rawPct, fullTo, halfWeight) {
  if (rawPct <= fullTo) return rawPct;
  return fullTo + (rawPct - fullTo) * halfWeight;
}
/* Value past a soft bound still counts, at the bound's give. */
function softBound(value, floor, ceiling, give) {
  let out = value;
  if (ceiling && out > ceiling) out = ceiling + (out - ceiling) * give;
  if (floor && out < floor) out = floor - (floor - out) * give;
  return out;
}

function appraiseModern(f) {
  const z = zoneById(f.zone) || S.zones[0] || { name: "\u2014", base: 0, floor: 0, ceiling: 0 };
  const base = Math.max(0, +z.base || 0);
  const entries = f.mods || {};
  const P = S.rules.policy;
  const notes = [], auctionWhy = [], features = [], penalties = [], specialUses = [];
  const rooms = Math.max(0, +entries.rooms || 0);
  const locationValue = base * (P.locationShare / 100);
  const roomUnitValue = base * ((100 - P.locationShare) / 100) / 4;
  const roomValue = roomUnitValue * roomUnits(rooms);

  (S.rules.mods || []).forEach(m => {
    if (m.requires && !entries[m.requires]) {
      if (entries[m.id]) {
        const parent = modById(m.requires);
        notes.push(m.label + " only counts with " + (parent ? parent.label.toLowerCase() : "its parent") + " \u2014 ignored.");
      }
      return;
    }
    if (m.id === "rooms" || !entryCount(m, entries[m.id])) return;
    if (m.forcesAuction && P.auctionsEnabled) auctionWhy.push(m.label.toLowerCase());
    if (isSpecialUse(m)) { specialUses.push(m.label); return; }
    if (penaltyPctOf(m)) { penalties.push({ label: m.label, pct: penaltyPctOf(m) }); return; }
    const feature = modernFeatureValue(m, entries[m.id]);
    if (feature) features.push(feature);
  });

  const pctFeatures = features.filter(x => x.pct != null);
  const flatFeatures = features.filter(x => x.flat != null);
  const rawFeaturePct = pctFeatures.reduce((sum, x) => sum + x.pct, 0);
  const featurePct = taperFeatures(Math.max(0, rawFeaturePct), P.featureFullTo, P.featureTaper / 100) +
    Math.min(0, rawFeaturePct);
  const featureValue = base * featurePct / 100;
  const flatValue = flatFeatures.reduce((sum, x) => sum + x.flat, 0);
  const beforePenalties = locationValue + roomValue + featureValue + flatValue;

  const rawPenaltyMultiplier = penalties.reduce((mult, x) => mult * (1 - x.pct / 100), 1);
  const rawDepreciationPct = (1 - rawPenaltyMultiplier) * 100;
  const depreciationPct = Math.min(P.maxDepreciationPct, Math.max(0, rawDepreciationPct));
  const penaltyMultiplier = 1 - depreciationPct / 100;
  const beforeBounds = beforePenalties * penaltyMultiplier;

  const floor = Math.max(0, +z.floor || 0);
  let ceiling = Math.max(0, +z.ceiling || 0);
  if (ceiling && floor > ceiling) {
    notes.push("This zone's floor sits above its ceiling. The ceiling is ignored until the zone is corrected.");
    ceiling = 0;
  }
  const waived = !!f.boundsWaived;
  const give = waived ? 1 : Math.max(0, Math.min(1, P.boundGive / 100));
  const residential = waived ? beforeBounds : softBound(beforeBounds, floor, ceiling, give);
  if (waived && ((ceiling && beforeBounds > ceiling) || (floor && beforeBounds < floor)))
    notes.push("Zone bounds waived" + (f.boundsReason ? " \u2014 " + f.boundsReason : "") + ".");

  const specialPremium = Math.max(0, +f.specialPremium || 0);
  const appraisal = Math.floor(residential + specialPremium);
  const furn = Math.max(0, +f.furnitureCost || 0);
  const furnPct = Math.min(P.furnitureMaxPct, Math.max(P.furnitureMinPct, +f.furniturePct || 0));
  const furnAdd = furn > 0 ? Math.round(furn * (1 + furnPct / 100)) : 0;
  const inc = Math.max(1, +P.roundIncrement || 1);
  const premium = Math.max(0, +f.premiumPct || 0) / 100;
  let list = Math.ceil((appraisal + furnAdd) * (1 + premium) / inc) * inc;
  if (list < appraisal) list = Math.ceil(appraisal / inc) * inc;
  if (z.unique && P.auctionsEnabled && P.uniqueForcesAuction) auctionWhy.push("unique property");

  return { model: "modern", zone: z, base, rooms, locationValue, roomUnitValue, roomValue,
    features, pctFeatures, flatFeatures, rawFeaturePct, featurePct, featureValue, flatValue,
    beforePenalties, penalties,
    rawDepreciationPct, depreciationPct, penaltyMultiplier, beforeBounds, floor, ceiling,
    waived, residential, specialUses, specialPremium, appraisal, furnAdd, furnPct, list,
    auction: auctionWhy.length > 0, auctionWhy, notes };
}

function appraise(f) {
  // Legacy was retired; every appraisal uses the one model.
  return appraiseModern(f);
}

function listingCopy(f, r) {
  const feats = [];
  (S.rules.mods || []).forEach(m => {
    if (m.group === "Disclosures and hazards") return;
    if (m.requires && !(f.mods || {})[m.requires]) return;
    const v = modValue(m, (f.mods || {})[m.id]);
    if (v) feats.push(v.label.toLowerCase());
  });
  const L = [];
  L.push("DYNASTY 8 — " + (f.address || "New listing"));
  L.push(r.zone.name);
  L.push("");
  L.push(feats.length ? feats.join(", ").replace(/^./, s => s.toUpperCase()) + "." : "Viewing by appointment.");
  L.push("");
  L.push(r.auction ? "AUCTION — opening at " + money(r.list) + "." : "Asking " + money(r.list) + ".");
  if (r.furnAdd) L.push("Sold furnished; furniture included in the asking price.");
  L.push("Loans available with " + S.rules.policy.minDownPct + "% down.");
  L.push("");
  L.push("Enquiries welcome.");
  return L.join("\n");
}
/* ============================================================
   Modal
   ============================================================ */
let modalClose = null;
function openModal(title, bodyHTML, buttons) {
  const m = $("#modal");
  m.innerHTML = '<h2>' + esc(title) + '</h2><div class="body">' + bodyHTML + '</div><div class="foot"></div>';
  const foot = $(".foot", m);
  (buttons || []).forEach(b => {
    const el = document.createElement("button");
    el.className = "btn " + (b.kind || "");
    el.innerHTML = b.label;
    el.onclick = () => b.run(m);
    foot.appendChild(el);
  });
  $("#scrim").classList.add("on");
  const first = m.querySelector("input,select,textarea");
  if (first) first.focus();
  modalClose = () => { $("#scrim").classList.remove("on"); modalClose = null; };
  return m;
}
function closeModal() { if (modalClose) modalClose(); }
$("#scrim").addEventListener("mousedown", e => { if (e.target.id === "scrim") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* ============================================================
   Appraisal form — built entirely from rules.mods
   ============================================================ */
let F = Object.assign(blankForm(), S.lastForm || {});
F.appraisalModel = "modern";   // Legacy is retired
(S.properties || []).forEach(p => { if (p.form) p.form.appraisalModel = "modern"; });
if (!F.mods) F.mods = {};
let editingPropId = null;

function modField(m) {
  const v = F.mods[m.id];
  const hint = m.hint ? '<span class="hint">' + esc(m.hint) + '</span>' : '';
  const head = '<label for="m_' + m.id + '">' + esc(m.label) + hint + '</label>';
  if (m.kind === "count" || m.kind === "tiered")
    return '<div class="field">' + head + '<input id="m_' + m.id + '" data-m="' + m.id +
      '" type="number" min="0" step="1" value="' + (+v || 0) + '"></div>';
  if (m.kind === "choice")
    return '<div class="field">' + head + '<select id="m_' + m.id + '" data-m="' + m.id + '">' +
      (m.options || []).map(o => '<option' + (v === o.label ? " selected" : "") + '>' + esc(o.label) + '</option>').join("") +
      '</select></div>';
  if (m.kind === "free") {
    const e = v || {};
    return '<div style="padding:6px 0;border-bottom:1px solid #e9edf2">' +
      '<span class="lab">' + esc(m.label) + '</span>' +
      '<input data-m="' + m.id + '" data-sub="note" value="' + esc(e.note || "") + '" placeholder="What is it? e.g. private helipad" style="margin-bottom:6px">' +
      '<div class="grid2">' +
        '<div><span class="lab">Multiplier (' + trim(m.value) + "–" + trim(m.value2) + '×)</span>' +
        '<input data-m="' + m.id + '" data-sub="mult" type="number" step="0.1" min="0" value="' + (+e.mult || 0) + '"></div>' +
        '<div><span class="lab">How many</span>' +
        '<input data-m="' + m.id + '" data-sub="count" type="number" min="0" value="' + (+e.count || 0) + '"></div>' +
      '</div></div>';
  }
  return '<div class="field">' + head + '<input id="m_' + m.id + '" data-m="' + m.id +
    '" type="checkbox"' + (v ? " checked" : "") + '></div>';
}

/* Which fieldsets are open. Kept in the save so the form opens the way you left it. */
function sectionOpen(name) {
  const st = (S.ui.sections || {});
  return st[name] === undefined ? true : !!st[name];
}
function setSectionOpen(name, open) {
  S.ui.sections = S.ui.sections || {};
  S.ui.sections[name] = open;
  save();
}

/* A short line describing what is set in a section, so a closed one still tells
   you whether there is anything in it. */
function sectionSummary(inGroup) {
  const bits = [];
  inGroup.forEach(m => {
    const v = (F.mods || {})[m.id];
    if (m.requires && !(F.mods || {})[m.requires]) return;
    const r = modValue(m, v);
    if (!r) return;
    bits.push(m.kind === "count" || m.kind === "tiered"
      ? (+v) + " " + m.label.toLowerCase()
      : m.kind === "choice" ? v + " " + m.label.toLowerCase()
      : m.label.toLowerCase());
  });
  return bits;
}

function renderAppraiseForm() {
  const mods = S.rules.mods || [];
  const scroller = $("main");
  const keepScroll = scroller ? scroller.scrollTop : 0;
  const focused = document.activeElement;
  const focusKey = focused && (focused.dataset.f || focused.dataset.m) ? {
    kind: focused.dataset.f ? "f" : "m",
    id: focused.dataset.f || focused.dataset.m,
    sub: focused.dataset.sub || "",
    start: focused.selectionStart, end: focused.selectionEnd
  } : null;

  const zoneOpts = S.zones.map(z =>
    '<option value="' + z.id + '"' + (String(F.zone) === String(z.id) ? " selected" : "") + '>' +
    esc(z.name) + " \u2014 " + money(z.base) + '</option>').join("");
  const roomsMod = modById("rooms");

  /* the three things that move the number most, up top and always visible */
  let html = '<fieldset><legend>The property</legend>' +
    '<div style="margin-bottom:9px"><span class="lab">Address or property name</span>' +
    '<input id="f_address" data-f="address" value="' + esc(F.address) +
    '" placeholder="e.g. 2044 North Conker Avenue"></div>' +
    '<div class="grid2">' +
      '<div><span class="lab">Zone</span><select id="f_zone" data-f="zone">' + zoneOpts + '</select></div>' +
      (roomsMod
        ? '<div><span class="lab">Rooms</span><input id="m_rooms" data-m="rooms" type="number" min="0" ' +
          'value="' + (+(F.mods || {}).rooms || 0) + '"></div>'
        : '') +
      '</div></fieldset>';

  const groups = GROUPS.concat(mods.map(m => m.group).filter(g => GROUPS.indexOf(g) < 0));
  groups.forEach(g => {
    const inGroup = mods.filter(m => m.group === g && m.id !== "rooms");
    if (!inGroup.length) return;
    const open = sectionOpen(g);
    const bits = sectionSummary(inGroup);
    html += '<fieldset class="fold' + (open ? " open" : "") + '" data-fold="' + esc(g) + '">' +
      '<legend><button type="button" class="foldbtn" data-foldbtn="' + esc(g) + '" ' +
      'aria-expanded="' + open + '"><span class="caret">\u203a</span>' + esc(g) +
      (bits.length ? '<span class="foldcount">' + bits.length + '</span>' : '') + '</button></legend>' +
      (open ? '<div class="foldbody">' + inGroup.map(modField).join("") + '</div>'
            : '<p class="note foldsum">' + (bits.length ? esc(bits.join(", ")) : "nothing set") + '</p>') +
      '</fieldset>';
  });

  const P = S.rules.policy;
  const termsOpen = sectionOpen("Sale terms");
  html += '<fieldset class="fold' + (termsOpen ? " open" : "") + '" data-fold="Sale terms">' +
    '<legend><button type="button" class="foldbtn" data-foldbtn="Sale terms" aria-expanded="' + termsOpen +
    '"><span class="caret">\u203a</span>Sale terms</button></legend>' +
    (termsOpen ? '<div class="foldbody">' +
      (F.appraisalModel !== "legacy" ? '<label class="row" style="gap:6px;margin-bottom:8px">' +
        '<input type="checkbox" data-f="boundsWaived"' + (F.boundsWaived ? " checked" : "") + '> ' +
        'Waive this zone\'s floor and ceiling</label>' +
        (F.boundsWaived ? '<div style="margin-bottom:9px"><span class="lab">Why</span>' +
          '<input data-f="boundsReason" value="' + esc(F.boundsReason || "") + '" ' +
          'placeholder="Recorded on the appraisal"></div>' : '') +
        '<div style="margin-bottom:9px"><span class="lab">Special-use premium ($)</span>' +
        '<input data-f="specialPremium" type="number" min="0" value="' + (+F.specialPremium || 0) + '">' +
        '<span class="hint">Added after the zone ceiling; 0 when no private-market premium applies</span></div>' : '') +
      '<div class="grid3">' +
      '<div><span class="lab">Furniture cost ($)</span><input data-f="furnitureCost" type="number" min="0" value="' + F.furnitureCost + '"></div>' +
      '<div><span class="lab">Furniture uplift (%)</span><input data-f="furniturePct" type="number" min="' + P.furnitureMinPct +
        '" max="' + P.furnitureMaxPct + '" value="' + F.furniturePct + '"></div>' +
      '<div><span class="lab">Listing premium (%)</span><input data-f="premiumPct" type="number" min="0" value="' + F.premiumPct + '"></div>' +
      '</div></div>'
      : '<p class="note foldsum">' +
        (F.furnitureCost || F.premiumPct || F.specialPremium || F.boundsWaived
          ? [F.furnitureCost ? "furniture " + money(F.furnitureCost) : "",
             F.premiumPct ? F.premiumPct + "% premium" : "",
             F.specialPremium ? "special use " + money(F.specialPremium) : "",
             F.boundsWaived ? "bounds waived" : ""].filter(Boolean).join(", ")
          : "nothing set") + '</p>') +
    '</fieldset>';

  const photosOpen = sectionOpen("Photos");
  const shots = (F.photos || []).length;
  html += '<fieldset class="fold' + (photosOpen ? " open" : "") + '" data-fold="Photos">' +
    '<legend><button type="button" class="foldbtn" data-foldbtn="Photos" aria-expanded="' + photosOpen +
    '"><span class="caret">\u203a</span>Photos' +
    (shots ? '<span class="foldcount">' + shots + '</span>' : '') + '</button></legend>' +
    (photosOpen ? '<div class="foldbody">' +
      '<div id="photoDrop"><div id="photoStrip"></div>' +
      '<p class="note dropnote">Drop pictures here</p></div>' +
      '<div class="row" style="margin-top:9px">' +
        '<button class="btn sm" id="btnPickPhoto">Choose pictures</button>' +
        '<input type="file" id="photoFile" accept="image/*" multiple hidden>' +
        '<span class="note">kept on this machine</span>' +
      '</div>' +
      '<div class="row" style="margin-top:6px">' +
        '<input id="photoUrl" placeholder="or paste a link\u2026" style="flex:1">' +
        '<button class="btn sm" id="btnAddPhoto">Add</button>' +
        '<button class="btn sm" id="btnTestPhoto">Check it</button>' +
      '</div><div id="photoHint"></div>' +
      '<p class="note" style="margin-top:7px">Links work too \u2014 postimg, imgur, FiveManage, ' +
      'your own host. Discord links expire, so add those as files.</p></div>'
      : '<p class="note foldsum">' + (shots ? shots + (shots === 1 ? " photo" : " photos") : "none yet") + '</p>') +
    '</fieldset>';

  html += '<div class="row"><button class="btn sm" id="btnClearForm">Clear form</button>' +
    '<span class="note" id="editingNote"></span></div>';

  $("#appraiseForm").innerHTML = html;

  $$("#appraiseForm [data-foldbtn]").forEach(b => b.onclick = () => {
    const name = b.dataset.foldbtn;
    setSectionOpen(name, !sectionOpen(name));
    renderAppraiseForm();
  });

  const commit = () => { S.lastForm = F; save(); renderResult(); };
  $$("#appraiseForm [data-f]").forEach(el => {
    const handler = () => {
      F[el.dataset.f] = el.type === "checkbox" ? el.checked
        : (el.type === "number" ? (el.value === "" ? 0 : +el.value) : el.value);
      commit();
      if ((el.dataset.f === "appraisalModel" || el.dataset.f === "boundsWaived") && el.type !== "number")
        renderAppraiseForm();
    };
    el.addEventListener("input", handler); el.addEventListener("change", handler);
  });
  $$("#appraiseForm [data-m]").forEach(el => {
    const handler = () => {
      const id = el.dataset.m, sub = el.dataset.sub;
      if (sub) {
        const cur = F.mods[id] || {};
        cur[sub] = el.type === "number" ? (+el.value || 0) : el.value;
        F.mods[id] = cur;
      } else {
        F.mods[id] = el.type === "checkbox" ? el.checked
          : (el.type === "number" ? (+el.value || 0) : el.value);
      }
      commit();
      // only rebuild when something gates another field
      if ((S.rules.mods || []).some(x => x.requires === id)) renderAppraiseForm();
    };
    el.addEventListener("input", handler); el.addEventListener("change", handler);
  });

  if (photosOpen) {
    renderPhotoStrip();
    const addPhoto = () => {
      const raw = $("#photoUrl").value.trim();
      if (!raw) return;
      if (!/^https?:\/\//i.test(raw)) { toast("That needs to start with http:// or https://"); return; }
      const fixed = normalisePhotoUrl(raw);
      F.photos = F.photos || [];
      if (F.photos.some(p => p && p.url === fixed.url)) { toast("That photo is already on this property."); return; }
      F.photos.push({ kind: "url", url: fixed.url });
      $("#photoUrl").value = "";
      S.lastForm = F; save(); renderPhotoStrip();
      $("#photoHint").innerHTML = fixed.note
        ? '<div class="tip" style="margin-top:8px">' + esc(fixed.note) + '</div>' : "";
    };
    $("#btnAddPhoto").onclick = addPhoto;
    $("#photoUrl").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); addPhoto(); } });
    $("#btnTestPhoto").onclick = () => testPhotoUrl($("#photoUrl").value.trim());
    $("#btnPickPhoto").onclick = () => $("#photoFile").click();
    $("#photoFile").onchange = ev => { addLocalPhotos(ev.target.files); ev.target.value = ""; };

    const drop = $("#photoDrop");
    ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, ev => {
      ev.preventDefault(); ev.stopPropagation(); drop.classList.add("over");
    }));
    ["dragleave", "drop"].forEach(t => drop.addEventListener(t, ev => {
      ev.stopPropagation(); drop.classList.remove("over");
    }));
    drop.addEventListener("drop", ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.dataTransfer && ev.dataTransfer.files.length) addLocalPhotos(ev.dataTransfer.files);
    });
  }

  $("#btnClearForm").onclick = () => {
    F = blankForm(); editingPropId = null; renderAppraiseForm(); renderResult();
  };
  $("#editingNote").textContent = editingPropId ? "Editing a saved property." : "";
  $("#btnSaveProp").textContent = editingPropId ? "Update this property" : "Save to listings";

  // put the cursor back where it was
  if (focusKey) {
    const sel = focusKey.kind === "f"
      ? '#appraiseForm [data-f="' + focusKey.id + '"]'
      : '#appraiseForm [data-m="' + focusKey.id + '"]' + (focusKey.sub ? '[data-sub="' + focusKey.sub + '"]' : '');
    const again = $(sel);
    if (again) {
      again.focus();
      if (again.setSelectionRange && focusKey.start != null && again.type !== "number") {
        try { again.setSelectionRange(focusKey.start, focusKey.end); } catch (e) {}
      }
    }
  }
  if (scroller) scroller.scrollTop = keepScroll;
}

/* Image hosts disagree about referrers: some reject a file:// referrer,
   others reject requests that send none. Try it plain, then stripped. */
function shotFailed(img) {
  if (img.dataset.retried) { img.closest(".shot").classList.add("broken", "showurl"); return; }
  // A fresh element is required: referrerpolicy only applies to a request that
  // has not been made yet, and re-setting src on the same node reuses the
  // failed response. Blanking src first would fire another error immediately.
  const src = img.getAttribute("src");
  const fig = img.closest(".shot");
  const next = document.createElement("img");
  next.setAttribute("referrerpolicy", "no-referrer");
  next.setAttribute("alt", "");
  next.dataset.retried = "1";
  next.dataset.shot = img.dataset.shot || "";
  next.onerror = () => fig.classList.add("broken", "showurl");
  next.onclick = img.onclick;
  img.replaceWith(next);
  next.setAttribute("src", src);
}
window.shotFailed = shotFailed;

/* Most "broken" photo links are page links, not image links. Rewrite the ones
   that follow a known pattern, and warn about the ones that expire. */
function normalisePhotoUrl(raw) {
  let url = raw.trim();
  let note = "";

  // imgur: a page or gallery link points at the viewer, not the file
  let m = url.match(/^https?:\/\/(?:www\.)?imgur\.com\/(?:gallery\/|a\/)?([A-Za-z0-9]{5,8})(?:[?#].*)?$/);
  if (m) { url = "https://i.imgur.com/" + m[1] + ".jpeg"; note = "Rewritten to the direct imgur file."; }

  // postimg: the share page is postimg.cc/<id>, the file lives on i.postimg.cc
  m = url.match(/^https?:\/\/(?:www\.)?postimg\.cc\/([A-Za-z0-9]+)\/?$/);
  if (m) note = "That is the postimg share page. Open it, right-click the picture " +
    "and copy the image address \u2014 it should start with i.postimg.cc.";

  // google drive
  m = url.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) { url = "https://drive.google.com/uc?export=view&id=" + m[1];
    note = "Rewritten to a direct Drive link. The file has to be shared publicly."; }

  // dropbox serves a viewer unless asked for the raw file
  if (/^https?:\/\/(?:www\.)?dropbox\.com\//.test(url) && !/[?&]raw=1/.test(url)) {
    url = url.replace(/[?&]dl=\d/, "") + (url.indexOf("?") >= 0 ? "&" : "?") + "raw=1";
    note = "Rewritten to the raw Dropbox file.";
  }

  // github blob pages
  m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (m) { url = "https://raw.githubusercontent.com/" + m[1] + "/" + m[2] + "/" + m[3];
    note = "Rewritten to the raw GitHub file."; }

  // discord signs its links and they die within about a day
  if (/^https?:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\//.test(url))
    note = "Discord links expire after about a day. Add the picture as a file instead.";

  const looksLikeFile = /\.(png|jpe?g|gif|webp|avif|bmp)(\?|#|$)/i.test(url) ||
    /i\.imgur\.com|i\.postimg\.cc|fivemanage|raw\.githubusercontent|drive\.google\.com\/uc/.test(url);
  if (!looksLikeFile && !note)
    note = "That does not look like a direct link to an image file. If it opens a web page " +
      "rather than just the picture, right-click the picture and copy the image address.";

  return { url, note };
}

/* Photos are links, never files \u2014 storing the image itself would fill
   the browser's quota after a handful of properties. */
function photoGrid(list, opts) {
  const photos = (list || []).filter(Boolean);
  if (!photos.length) return '<p class="note">No photos yet.</p>';
  return '<div class="photos">' + photos.map((p, i) => {
    const local = p.kind === "local";
    const label = local ? (p.name || "Saved on this device") : (p.url || "");
    return '<figure class="shot" data-i="' + i + '">' +
      (local
        ? '<img alt="" data-localkey="' + esc(p.key) + '" data-shot="' + i + '">'
        : '<img alt="" src="' + esc(p.url) + '" data-shot="' + i + '" onerror="shotFailed(this)">') +
      '<div class="brokenmsg">This host won\u2019t serve the image here. Check it opens below \u2014 ' +
      'if it does, save the picture and add it as a file instead.</div>' +
      '<figcaption class="shoturl" data-url="' + esc(local ? "" : (p.url || "")) + '">' + esc(label) +
      (local ? '<span class="shotopen">stored on this device</span>'
             : '<a class="shotopen" href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">Open in a tab</a>') +
      '</figcaption>' +
      (opts && opts.removable
        ? '<button class="btn sm danger icon shotdel" data-rmshot="' + i +
          '" title="Remove photo" aria-label="Remove photo">' + ICON_TRASH + '</button>' : '') +
      '</figure>';
  }).join("") + '</div>';
}

/* Local photos are fetched from IndexedDB once the grid is on the page. */
function hydrateLocalPhotos(root) {
  $$("img[data-localkey]", root).forEach(img => {
    PhotoStore.get(img.dataset.localkey).then(data => {
      if (data) img.src = data;
      else img.closest(".shot").classList.add("broken", "showurl");
    }).catch(() => img.closest(".shot").classList.add("broken", "showurl"));
  });
}

function bindPhotoGrid(root, onRemove) {
  hydrateLocalPhotos(root);
  $$(".shot img", root).forEach(img => img.onclick = () => {
    const fig = img.closest(".shot");
    const open = fig.classList.toggle("showurl");
    if (!open) return;
    const url = $(".shoturl", fig).dataset.url;
    if (url) navigator.clipboard.writeText(url).then(() => toast("Link copied."), () => {});
  });
  $$(".shoturl", root).forEach(cap => cap.onclick = () => {
    if (cap.dataset.url) navigator.clipboard.writeText(cap.dataset.url).then(() => toast("Link copied."), () => {});
  });
  if (onRemove) $$("[data-rmshot]", root).forEach(b => b.onclick = () => onRemove(+b.dataset.rmshot));
}

/* Reports what actually happens when this browser tries to load a link,
   so a failure points at a cause instead of a shrug. */
function testPhotoUrl(raw) {
  const box = $("#photoHint");
  if (!raw) { box.innerHTML = '<div class="warn" style="margin-top:8px">Paste a link first.</div>'; return; }
  const fixed = normalisePhotoUrl(raw);
  const online = (typeof navigator !== "undefined" && "onLine" in navigator) ? navigator.onLine : true;
  box.innerHTML = '<div class="note" style="margin-top:8px">Checking\u2026</div>';

  const started = Date.now();
  let settled = false;
  const finish = html => { if (settled) return; settled = true; box.innerHTML = html; };

  const img = new Image();
  img.onload = () => finish('<div class="ok" style="margin-top:8px"><strong>Loaded fine</strong> \u2014 ' +
    img.naturalWidth + '\u00d7' + img.naturalHeight + ' in ' + (Date.now() - started) + 'ms. ' +
    'Add it and it will show.</div>');
  img.onerror = () => {
    const causes = [];
    if (!online) causes.push("This browser reports it is offline. A link cannot load without a connection \u2014 " +
      "add the picture as a file instead.");
    if (location.protocol === "file:")
      causes.push("This page is running from a file on disk, and a few hosts " +
        "refuse requests that come from there.");
    if (location.protocol !== "file:" && location.protocol !== "http:" && location.protocol !== "https:")
      causes.push("This page is running inside a sandbox that blocks outside images. Open the " +
        "site in a normal browser tab.");
    causes.push("An ad blocker, privacy extension or network filter may be stopping it \u2014 " +
      "try opening the link below in a normal tab.");
    if (fixed.note) causes.push(fixed.note);
    finish('<div class="warn" style="margin-top:8px"><strong>Did not load</strong> after ' +
      (Date.now() - started) + 'ms.<ul style="margin:6px 0 0 16px;padding:0">' +
      causes.map(c => '<li>' + esc(c) + '</li>').join("") + '</ul>' +
      '<a href="' + esc(fixed.url) + '" target="_blank" rel="noopener noreferrer" ' +
      'style="display:inline-block;margin-top:7px">Open the link in a tab</a></div>');
  };
  setTimeout(() => finish('<div class="warn" style="margin-top:8px"><strong>No answer after 12 seconds.</strong> ' +
    'The host is slow, unreachable from this machine, or being blocked. ' +
    'Adding the picture as a file avoids the problem entirely.</div>'), 12000);
  img.src = fixed.url;
}

function addLocalPhotos(files) {
  const list = Array.from(files || []).filter(f => f.type.indexOf("image/") === 0);
  if (!list.length) { toast("Those weren\u2019t image files."); return; }
  F.photos = F.photos || [];
  let done = 0, failed = 0;
  toast(list.length === 1 ? "Adding the picture\u2026" : "Adding " + list.length + " pictures\u2026");
  list.reduce((chain, file) => chain.then(() =>
    shrinkImage(file, 1600, 0.82)
      .then(dataUrl => {
        const key = "ph_" + uid();
        return PhotoStore.put(key, dataUrl).then(() => {
          F.photos.push({ kind: "local", key, name: file.name });
          done++;
        });
      })
      .catch(() => { failed++; })
  ), Promise.resolve()).then(() => {
    S.lastForm = F; save(); renderPhotoStrip();
    if (done) toast(done + (done === 1 ? " picture added." : " pictures added.") +
      (failed ? " " + failed + " could not be read." : ""));
    else toast("None of those could be added. IndexedDB may be blocked in this browser.");
  });
}

function renderPhotoStrip() {
  const box = $("#photoStrip");
  if (!box) return;
  box.innerHTML = photoGrid(F.photos, { removable: true });
  bindPhotoGrid(box, i => {
    const gone = F.photos.splice(i, 1)[0];
    if (gone && gone.kind === "local") PhotoStore.del(gone.key).catch(() => {});
    S.lastForm = F; save(); renderPhotoStrip();
  });
}

function renderResult() {
  const r = appraise(F);
  $("#outAppraisal").textContent = money(r.appraisal);
  $("#outList").textContent = r.zone.name + " · asking " + money(r.list) + (r.furnAdd ? " incl. furniture" : "");

  let flags = "";
  if (r.auction) flags += '<div class="tip" style="margin-bottom:8px"><strong>Auction required</strong> — ' +
    r.auctionWhy.join(", ") + '.</div>';
  if (r.model === "modern" && r.specialUses.length)
    flags += '<div class="tip" style="margin-bottom:8px"><strong>Special-use features</strong> — ' +
      esc(r.specialUses.join(", ").toLowerCase()) + (r.specialPremium ? "." : "; recorded at a $0 premium.") + '</div>';
  r.notes.forEach(n => { flags += '<div class="warn" style="margin-bottom:8px">' + esc(n) + '</div>'; });
  $("#outFlags").innerHTML = flags;

  const rows = ['<tr><td>' + esc(r.zone.name) + ' base</td><td>' + money(r.base) + '</td></tr>'];
  if (r.model === "legacy") {
    r.inside.forEach(m => rows.push('<tr class="dim"><td style="padding-left:10px">' + esc(m.label) +
      '</td><td>×' + trim(m.val) + '</td></tr>'));
    if (r.inside.length)
      rows.push('<tr><td>Square root of ' + trim(r.insideProduct) + '</td><td>×' + r.root.toFixed(4) + '</td></tr>');
    r.outside.forEach(m => rows.push('<tr><td>' + esc(m.label) +
      ' <span class="note">(outside the root)</span></td><td>×' + trim(m.val) + '</td></tr>'));
    rows.push('<tr class="sum"><td>Appraised, rounded down</td><td>' + money(r.appraisal) + '</td></tr>');
  } else {
    rows.push('<tr><td>Location value (' + S.rules.policy.locationShare + '%)</td><td>' + money(r.locationValue) + '</td></tr>');
    rows.push('<tr><td>Room value (' + r.rooms + ' room' + (r.rooms === 1 ? "" : "s") + ')</td><td>' +
      money(r.roomValue) + '</td></tr>');
    r.features.forEach(x => rows.push('<tr class="dim"><td style="padding-left:10px">' + esc(x.label) +
      ' (+' + trim(x.pct) + '%)</td><td>' + money(r.base * x.pct / 100) + '</td></tr>'));
    if (r.rawFeaturePct > S.rules.policy.featureFullTo)
      rows.push('<tr class="dim"><td style="padding-left:10px">Beyond +' + S.rules.policy.featureFullTo +
        '% these count at ' + S.rules.policy.featureTaper + '%</td><td>from +' + trim(r.rawFeaturePct) + '%</td></tr>');
    if (r.featurePct)
      rows.push('<tr><td>Features as a share of base (' + (r.featurePct > 0 ? "+" : "") +
        trim(r.featurePct) + '%)</td><td>' + money(r.featureValue) + '</td></tr>');
    if (r.flatFeatures.length) {
      r.flatFeatures.forEach(x => rows.push('<tr class="dim"><td style="padding-left:10px">' +
        esc(x.label) + '</td><td>' + money(x.flat) + '</td></tr>'));
      rows.push('<tr><td>Fixed-cost features</td><td>' + money(r.flatValue) + '</td></tr>');
    }
    r.penalties.forEach(x => rows.push('<tr class="dim"><td style="padding-left:10px">' + esc(x.label) +
      '</td><td>−' + trim(x.pct) + '%</td></tr>'));
    if (r.penalties.length)
      rows.push('<tr><td>Combined depreciation' +
        (r.rawDepreciationPct > S.rules.policy.maxDepreciationPct ? ' (' + S.rules.policy.maxDepreciationPct + '% cap)' : '') +
        '</td><td>−' + trim(r.depreciationPct) + '%</td></tr>');
    if (!r.waived && r.floor && r.beforeBounds < r.floor)
      rows.push('<tr><td>Below the ' + money(r.floor) + ' zone floor, lifted to</td><td>' +
        money(r.residential) + '</td></tr>');
    if (!r.waived && r.ceiling && r.beforeBounds > r.ceiling)
      rows.push('<tr><td>Over the ' + money(r.ceiling) + ' zone ceiling, held to</td><td>' +
        money(r.residential) + '</td></tr>');
    if (r.waived && (r.beforeBounds > r.ceiling || r.beforeBounds < r.floor))
      rows.push('<tr><td>Zone bounds waived</td><td>' + money(r.residential) + '</td></tr>');
    if (r.specialPremium)
      rows.push('<tr><td>Special-use premium</td><td>+' + money(r.specialPremium) + '</td></tr>');
    rows.push('<tr class="sum"><td>Modern appraised value</td><td>' + money(r.appraisal) + '</td></tr>');
  }
  if (r.furnAdd) rows.push('<tr><td>Furniture at +' + r.furnPct + '%</td><td>' + money(r.furnAdd) + '</td></tr>');
  if (F.premiumPct) rows.push('<tr><td>Listing premium ' + F.premiumPct + '%</td><td>' +
    money(r.list - r.appraisal - r.furnAdd) + '</td></tr>');
  rows.push('<tr class="sum"><td>Suggested asking price</td><td>' + money(r.list) + '</td></tr>');
  $("#outBreak").innerHTML = rows.join("");

  /* ---- what the the house rules say about this appraisal ---- */
  const P = S.rules.policy;
  const z = r.zone;
  const outs = (S.rules.mods || []).filter(m => m.outside).map(m => m.label.toLowerCase());
  const parts = [];

  if (r.model === "legacy") {
    parts.push("<p><strong>Legacy model.</strong> The base is multiplied by the square root of " +
      "every multiplier together. " + (S.rules.mods || []).length + " are in force" +
      (outs.length ? ", and " + esc(outs.join(", ")) + " sit outside the root so they hit at full strength."
                   : ", all of them inside the root.") + "</p>");
  } else {
    parts.push("<p><strong>Modern model.</strong> " + P.locationShare + "% of the " +
      esc(z.name) + " base is location value and never moves. The other " + (100 - P.locationShare) +
      "% scales with rooms, four being the baseline, and each further room counts for less.</p>");
    parts.push("<p style='margin-top:7px'>Features add a percentage of the base on top \u2014 in full " +
      "up to +" + P.featureFullTo + "%, then at " + P.featureTaper + "% beyond that" +
      (r.rawFeaturePct > P.featureFullTo
        ? ", which is why this one\u2019s +" + trim(r.rawFeaturePct) + "% counts as +" + trim(r.featurePct) + "%."
        : ".") + " Disclosures take value off afterwards, never more than " + P.maxDepreciationPct +
      "% combined.</p>");
  }

  /* the band, and where this property sits in it */
  if (r.model !== "legacy" && (z.floor || z.ceiling)) {
    let where;
    if (r.waived) {
      where = "<strong>The band is waived on this property</strong>" +
        (F.boundsReason ? " \u2014 " + esc(F.boundsReason) : "") +
        ", so it prices at what the features actually come to.";
    } else if (z.ceiling && r.beforeBounds > z.ceiling) {
      where = "This one comes to " + money(r.beforeBounds) + ", over the ceiling, so only " +
        P.boundGive + "% of the excess counts and it settles at " + money(r.residential) + ".";
    } else if (z.floor && r.beforeBounds < z.floor) {
      where = "This one comes to " + money(r.beforeBounds) + ", under the floor, so it is lifted to " +
        money(r.residential) + ".";
    } else {
      where = "This one sits inside the band, so nothing is being held back.";
    }
    parts.push("<p style='margin-top:7px'><strong>" + esc(z.name) + " runs " + money(z.floor || 0) +
      " to " + money(z.ceiling || 0) + ".</strong> Neither is a hard wall: value past either end still " +
      "counts, at " + P.boundGive + "%. " + where + "</p>");
    if (!r.waived)
      parts.push("<p class='note' style='margin-top:5px'>Waiving the band under Sale terms switches " +
        "that off for one property, and records your reason on the appraisal. It is for a genuinely " +
        "exceptional place \u2014 if you are reaching for it often, the zone\u2019s ceiling is set too low.</p>");
  }

  if (r.model !== "legacy" && r.specialUses.length)
    parts.push("<p style='margin-top:7px'><strong>" + esc(r.specialUses.join(", ")) +
      "</strong> " + (r.specialUses.length === 1 ? "is" : "are") + " kept off the appraisal. " +
      "That is not what the house is worth, it is what one particular buyer will pay, so it is quoted " +
      "separately" + (r.specialPremium ? " \u2014 " + money(r.specialPremium) + " here." : ". Set the amount under Sale terms.") + "</p>");

  if (r.auction)
    parts.push("<p style='margin-top:7px'><strong>This one goes to auction</strong> \u2014 " +
      esc(r.auctionWhy.join(", ")) + ".</p>");

  parts.push("<p style='margin-top:7px'>You may list above the appraisal, never below it. " +
    "Asking prices round up to the nearest " + money(P.roundIncrement) + "." +
    (r.furnAdd ? " Furniture is charged at cost plus " + r.furnPct + "%." : "") + "</p>");

  parts.push("<p style='margin-top:7px'>The house rules suggest " + P.minDownPct +
    "% down on a financed sale, though the terms are yours to set. Work them out under Payments.</p>");

  $("#outRules").innerHTML = parts.join("");
}

$("#btnCopyAd").onclick = () => {
  const text = listingCopy(F, appraise(F));
  navigator.clipboard.writeText(text).then(
    () => toast("Listing post copied."),
    () => openModal("Listing post", '<textarea rows="16" readonly>' + esc(text) + '</textarea>',
      [{ label: "Close", run: closeModal }])
  );
};

$("#btnSaveProp").onclick = () => {
  if (!F.address.trim()) { toast("Give the property an address first."); return; }
  const r = appraise(F);
  if (editingPropId) {
    const p = propById(editingPropId);
    Object.assign(p, { form: clone(F), address: F.address, zone: F.zone,
      appraisal: r.appraisal, list: r.list, updated: Date.now() });
    toast("Property updated.");
  } else {
    S.properties.unshift({
      id: uid(), address: F.address, zone: F.zone, form: clone(F),
      appraisal: r.appraisal, list: r.list, status: r.auction ? "Auction" : "Draft",
      clientId: null, notes: "", created: Date.now(), updated: Date.now()
    });
    toast("Saved to listings.");
  }
  save(); renderAll();
};

/* ============================================================
   Portfolio
   ============================================================ */
function statusChip(s) {
  const cls = { Draft: "draft", Listed: "listed", Auction: "auction", "Under offer": "held", Sold: "sold", Repossessed: "flag" }[s] || "draft";
  return '<span class="chip ' + cls + '">' + esc(s) + '</span>';
}
/* A saved appraisal is a snapshot. Change a zone price or a multiplier and it
   no longer matches what the tool would say today, so say so out loud. */
function currentValue(p) {
  if (!p.form) return null;
  const f = Object.assign(blankForm(), p.form);
  f.zone = p.zone;
  try { return appraise(f); } catch (e) { return null; }
}
function staleBy(p) {
  const now = currentValue(p);
  if (!now) return 0;
  return now.appraisal - (p.appraisal || 0);
}

function renderPortfolio() {
  const q = ($("#pfSearch").value || "").toLowerCase();
  const st = $("#pfStatus").value;
  const zf = $("#pfZone").value;
  const sort = $("#pfSort").value || "new";

  const zonesUsed = S.zones.filter(z => S.properties.some(p => String(p.zone) === String(z.id)));
  $("#pfZone").innerHTML = '<option value="">Every zone</option>' + zonesUsed.map(z =>
    '<option value="' + z.id + '"' + (String(zf) === String(z.id) ? " selected" : "") + '>' +
    esc(z.name) + '</option>').join("");

  let list = S.properties.filter(p => {
    const z = zoneById(p.zone), c = clientById(p.clientId);
    const hay = (p.address + " " + (z ? z.name : "") + " " + (c ? c.name : "") + " " + (p.notes || "")).toLowerCase();
    return (!q || hay.indexOf(q) >= 0) && (!st || p.status === st) && (!zf || String(p.zone) === String(zf));
  });
  list = list.slice().sort((x, y) =>
    sort === "price" ? (y.list || 0) - (x.list || 0) :
    sort === "address" ? x.address.localeCompare(y.address) :
    sort === "zone" ? ((zoneById(x.zone) || {}).name || "").localeCompare((zoneById(y.zone) || {}).name || "") :
    (y.created || 0) - (x.created || 0));

  const sold = S.properties.filter(p => p.status === "Sold");
  const gross = sold.reduce((a, p) => a + (p.soldFor || p.list || 0), 0);
  const onMarket = S.properties.filter(p => p.status === "Listed" || p.status === "Auction");
  $("#pfStats").innerHTML =
    '<div class="stat"><div class="n">' + onMarket.length + '</div><div class="l">On the market</div></div>' +
    '<div class="stat"><div class="n">' + money(onMarket.reduce((a, p) => a + (p.list || 0), 0)) +
      '</div><div class="l">Asking, combined</div></div>' +
    '<div class="stat"><div class="n">' + money(gross) + '</div><div class="l">Sold across ' +
      sold.length + (sold.length === 1 ? " property" : " properties") + '</div></div>';

  /* how many saved appraisals no longer match today's rules */
  const drifted = S.properties.filter(p => Math.abs(staleBy(p)) >= 1);
  $("#pfStale").innerHTML = drifted.length
    ? '<div class="tip" style="margin-bottom:12px"><strong>' + drifted.length +
      (drifted.length === 1 ? " appraisal was" : " appraisals were") +
      ' worked out under different rules.</strong> Prices or multipliers have changed since. ' +
      '<button class="btn sm" id="btnRefreshAll" style="margin-left:6px">Bring them up to date</button></div>'
    : "";
  const ref = $("#btnRefreshAll");
  if (ref) ref.onclick = () => refreshAllModal(drifted);

  if (!list.length) {
    $("#pfTable").innerHTML = '<div class="empty"><strong>' +
      (S.properties.length ? "Nothing matches that" : "No properties yet") + '</strong>' +
      (S.properties.length ? "Try a different address, zone or status."
        : "Appraise a property and save it, and it will land here.") + '</div>';
    return;
  }

  $("#pfTable").innerHTML = '<table class="data"><thead><tr>' +
    '<th>Address</th><th>Zone</th><th class="num">Appraised</th><th class="num">Asking</th>' +
    '<th>Status</th><th>Client</th><th></th></tr></thead><tbody>' +
    list.map(p => {
      const z = zoneById(p.zone), c = clientById(p.clientId);
      const shot = ((p.form || {}).photos || [])[0];
      const shots = ((p.form || {}).photos || []).length;
      const drift = staleBy(p);
      return '<tr><td>' +
        (shot ? (shot.kind === "local"
          ? '<img class="thumb" alt="" data-localkey="' + esc(shot.key) + '">'
          : '<img class="thumb" src="' + esc(shot.url) + '" alt="" loading="lazy" ' +
            'onerror="this.style.display=\'none\'">') : '') +
        '<strong>' + esc(p.address) + '</strong>' +
        (shots > 1 ? ' <span class="note">' + shots + ' photos</span>' : '') +
        (p.notes ? '<div class="note">' + esc(p.notes.slice(0, 70)) +
          (p.notes.length > 70 ? "\u2026" : "") + '</div>' : '') + '</td>' +
        '<td>' + esc(z ? z.name : "\u2014") + '</td>' +
        '<td class="num">' + money(p.appraisal) +
          (Math.abs(drift) >= 1 ? '<div class="note drift">now ' + money(p.appraisal + drift) + '</div>' : '') +
        '</td>' +
        '<td class="num">' + money(p.list) + '</td>' +
        '<td>' + statusChip(p.status) + '</td>' +
        '<td>' + esc(c ? c.name : "\u2014") + '</td>' +
        '<td style="white-space:nowrap"><button class="btn sm" data-open="' + p.id + '">Open</button> ' +
        '<button class="btn sm" data-load="' + p.id + '">Re-appraise</button> ' +
        '<button class="btn sm" data-dupe="' + p.id + '" title="Duplicate">Copy</button></td></tr>';
    }).join("") + '</tbody></table>';

  hydrateLocalPhotos($("#pfTable"));
  $$("#pfTable [data-open]").forEach(b => b.onclick = () => propertyModal(b.dataset.open));
  $$("#pfTable [data-load]").forEach(b => b.onclick = () => {
    const p = propById(b.dataset.load);
    F = Object.assign(blankForm(), clone(p.form)); F.mods = F.mods || {}; editingPropId = p.id;
    showView("appraise"); renderAppraiseForm(); renderResult();
  });
  $$("#pfTable [data-dupe]").forEach(b => b.onclick = () => {
    const p = propById(b.dataset.dupe);
    const copy = clone(p);
    copy.id = uid();
    copy.address = p.address + " (copy)";
    copy.clientId = null;
    copy.status = "Draft";
    copy.soldFor = null;
    copy.created = copy.updated = Date.now();
    S.properties.unshift(copy);
    save(); renderAll(); toast("Copied. Open it to change the address.");
  });
}

function refreshAllModal(drifted) {
  const rows = drifted.slice(0, 12).map(p => {
    const d = staleBy(p);
    return '<tr><td>' + esc(p.address) + '</td><td class="num">' + money(p.appraisal) +
      '</td><td class="num">' + money(p.appraisal + d) + '</td><td class="num">' +
      (d > 0 ? "+" : "") + money(d) + '</td></tr>';
  }).join("");
  openModal("Bring appraisals up to date",
    '<p class="note">These were worked out before the current prices and multipliers. ' +
    'Updating recalculates each one and moves the asking price by the same amount, ' +
    'keeping whatever premium was on it.</p>' +
    '<table class="data" style="margin-top:11px"><thead><tr><th>Property</th><th class="num">Was</th>' +
    '<th class="num">Now</th><th class="num">Change</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    (drifted.length > 12 ? '<p class="note" style="margin-top:8px">and ' + (drifted.length - 12) + ' more.</p>' : '') +
    '<p class="warn" style="margin-top:11px">Sold properties keep the price they actually sold for.</p>',
    [{ label: "Leave them", run: closeModal },
     { label: "Update all", kind: "primary", run: () => {
        let n = 0;
        drifted.forEach(p => {
          const now = currentValue(p);
          if (!now) return;
          const premium = (p.list || 0) - (p.appraisal || 0);
          p.appraisal = now.appraisal;
          if (p.status !== "Sold") p.list = Math.max(now.list, now.appraisal + Math.max(0, premium));
          p.updated = Date.now();
          n++;
        });
        save(); closeModal(); renderAll(); toast(n + " brought up to date.");
      } }]);
}

function propertyModal(id) {
  const p = propById(id);
  const clientOpts = '<option value="">— none —</option>' + S.clients.map(c =>
    '<option value="' + c.id + '"' + (p.clientId === c.id ? " selected" : "") + '>' + esc(c.name) + '</option>').join("");
  const statuses = ["Draft", "Listed", "Auction", "Under offer", "Sold", "Repossessed"];
  const m = openModal(p.address,
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Status</span><select id="m_status">' +
        statuses.map(s => '<option' + (p.status === s ? " selected" : "") + '>' + s + '</option>').join("") + '</select></div>' +
      '<div><span class="lab">Client</span><select id="m_client">' + clientOpts + '</select></div>' +
    '</div>' +
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Asking price ($)</span><input id="m_list" type="number" value="' + p.list + '"></div>' +
      '<div><span class="lab">Sold for ($)</span><input id="m_sold" type="number" value="' + (p.soldFor || "") + '"></div>' +
    '</div>' +
    '<div style="margin-bottom:10px"><span class="lab">Notes</span>' +
      '<textarea id="m_notes" rows="4">' + esc(p.notes) + '</textarea></div>' +
    '<div style="margin-bottom:10px"><span class="lab">Photos</span>' +
      '<div id="m_photos">' + photoGrid((p.form || {}).photos) + '</div>' +
      '<p class="note" style="margin-top:5px">Tap a photo to show and copy its link.</p></div>' +
    '<div class="note">Appraised at ' + money(p.appraisal) + ' in ' + esc((zoneById(p.zone) || {}).name || "\u2014") +
    '. Saved ' + when(p.created) + '.</div>',
    [
      { label: ICON_TRASH + " Delete", kind: "danger icon-btn", run: () => {
          if (!confirm("Delete " + p.address + "? Its loans stay in the file.")) return;
          S.properties = S.properties.filter(x => x.id !== id); save(); closeModal(); renderAll(); toast("Property deleted.");
        } },
      { label: "Cancel", run: closeModal },
      { label: "Save changes", kind: "primary", run: () => {
          p.status = $("#m_status", m).value;
          p.clientId = $("#m_client", m).value || null;
          p.list = +$("#m_list", m).value || 0;
          const sf = $("#m_sold", m).value;
          p.soldFor = sf === "" ? null : +sf;
          p.notes = $("#m_notes", m).value;
          p.updated = Date.now();
          if (p.clientId) {
            const c = clientById(p.clientId);
            if (c && c.criminalGroup)
              toast("Heads up: " + c.name + " is flagged as connected to a criminal group.");
          }
          save(); closeModal(); renderAll();
        } }
    ]);
  bindPhotoGrid($("#m_photos", m));
}

$("#btnNewProp").onclick = () => {
  F = blankForm(); editingPropId = null;
  showView("appraise"); renderAppraiseForm(); renderResult();
  $("#f_address").focus();
};
$("#pfSearch").addEventListener("input", () => { renderPortfolio(); stampTables(); });
$("#pfStatus").addEventListener("change", () => { renderPortfolio(); stampTables(); });
$("#pfZone").addEventListener("change", () => { renderPortfolio(); stampTables(); });
$("#pfSort").addEventListener("change", () => { renderPortfolio(); stampTables(); });

/* ============================================================
   Clients
   ============================================================ */
function clientProperties(id) {
  return S.properties.filter(p => p.clientId === id);
}
function clientWorth(id) {
  return clientProperties(id).reduce((sum, p) => sum + (p.soldFor || p.list || 0), 0);
}

function renderClients() {
  const q = ($("#clSearch").value || "").toLowerCase();
  const sort = $("#clSort").value || "name";

  const owners = S.clients.filter(c => clientProperties(c.id).length).length;
  const held = S.properties.filter(p => p.clientId).length;
  $("#clStats").innerHTML =
    '<div class="stat"><div class="n">' + S.clients.length + '</div><div class="l">On file</div></div>' +
    '<div class="stat"><div class="n">' + owners + '</div><div class="l">Holding property</div></div>' +
    '<div class="stat"><div class="n">' + held + '</div><div class="l">Properties assigned</div></div>';

  let list = S.clients.filter(c => {
    if (!q) return true;
    const addresses = clientProperties(c.id).map(p => p.address).join(" ");
    return (c.name + " " + (c.contact || c.birdy || "") + " " + (c.phone || "") + " " +
      (c.notes || "") + " " + addresses).toLowerCase().indexOf(q) >= 0;
  });
  list = list.slice().sort((x, y) =>
    sort === "value" ? clientWorth(y.id) - clientWorth(x.id) :
    sort === "count" ? clientProperties(y.id).length - clientProperties(x.id).length :
    x.name.localeCompare(y.name));

  if (!list.length) {
    $("#clTable").innerHTML = '<div class="empty"><strong>' +
      (S.clients.length ? "No one matches that" : "No clients on file") + '</strong>' +
      (S.clients.length ? "Try another name, number or address."
        : "Add someone and you can keep track of what they own.") + '</div>';
    return;
  }

  $("#clTable").innerHTML = '<table class="data"><thead><tr><th>Name</th><th>Contact</th><th>Phone</th>' +
    '<th>Holds</th><th class="num">Worth</th><th></th></tr></thead><tbody>' +
    list.map(c => {
      const own = clientProperties(c.id);
      const worth = clientWorth(c.id);
      return '<tr><td><strong>' + esc(c.name) + '</strong>' +
        (c.criminalGroup ? ' <span class="chip flag">criminal group</span>' : '') +
        (c.notes ? '<div class="note">' + esc(c.notes.slice(0, 60)) +
          (c.notes.length > 60 ? "\u2026" : "") + '</div>' : '') + '</td>' +
        '<td>' + esc(c.contact || c.birdy || "\u2014") + '</td>' +
        '<td>' + esc(c.phone || "\u2014") + '</td>' +
        '<td>' + (own.length
          ? own.map(p => '<button class="btn sm linkish" data-clprop="' + p.id + '">' +
              esc(p.address) + '</button>').join(" ")
          : '<span class="note">nothing yet</span>') + '</td>' +
        '<td class="num">' + (worth ? money(worth) : "\u2014") + '</td>' +
        '<td><button class="btn sm" data-cl="' + c.id + '">Open</button></td></tr>';
    }).join("") + '</tbody></table>';

  $$("#clTable [data-cl]").forEach(b => b.onclick = () => clientModal(b.dataset.cl));
  $$("#clTable [data-clprop]").forEach(b => b.onclick = () => propertyModal(b.dataset.clprop));
}

function clientModal(id) {
  const c = id ? clientById(id) : { id: null, name: "", contact: "", phone: "", notes: "", criminalGroup: false };
  const own = id ? clientProperties(id) : [];
  const free = S.properties.filter(p => !p.clientId);
  const m = openModal(id ? c.name : "Add client",
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Name</span><input id="c_name" value="' + esc(c.name) + '"></div>' +
      '<div><span class="lab">Contact</span><input id="c_contact" value="' +
        esc(c.contact || c.birdy || "") + '" placeholder="however you reach them"></div>' +
    '</div>' +
    '<div style="margin-bottom:10px"><span class="lab">Phone</span><input id="c_phone" value="' + esc(c.phone || "") + '"></div>' +
    '<label class="row" style="gap:6px;margin-bottom:10px"><input type="checkbox" id="c_crim"' +
      (c.criminalGroup ? " checked" : "") + '> Connected to a criminal group</label>' +
    '<div style="margin-bottom:10px"><span class="lab">Notes</span>' +
      '<textarea id="c_notes" rows="4" placeholder="what they are after, budget, anything worth remembering">' +
      esc(c.notes || "") + '</textarea></div>' +
    (id
      ? '<div style="border-top:1px solid var(--rule);padding-top:11px">' +
        '<span class="lab">Properties held</span>' +
        '<div id="c_props">' + (own.length
          ? '<table class="data"><tbody>' + own.map(p =>
              '<tr><td><button class="btn sm linkish" data-cmprop="' + p.id + '">' + esc(p.address) +
              '</button><div class="note">' + esc((zoneById(p.zone) || {}).name || "") + '</div></td>' +
              '<td class="num">' + money(p.soldFor || p.list) + '</td>' +
              '<td>' + statusChip(p.status) + '</td>' +
              '<td><button class="btn sm danger icon" data-unlink="' + p.id +
              '" title="Unassign" aria-label="Unassign">' + ICON_TRASH + '</button></td></tr>').join("") +
            '</tbody></table>'
          : '<p class="note">Nothing assigned yet.</p>') + '</div>' +
        (free.length
          ? '<div class="row" style="margin-top:9px">' +
            '<select id="c_addprop" style="flex:1"><option value="">\u2014 assign a property \u2014</option>' +
            free.map(p => '<option value="' + p.id + '">' + esc(p.address) + " \u2014 " +
              money(p.list) + '</option>').join("") + '</select>' +
            '<button class="btn sm" id="c_addbtn">Assign</button></div>'
          : '<p class="note" style="margin-top:8px">Every saved property already has someone against it.</p>') +
        '</div>'
      : '<p class="note">Save them first, then you can assign properties.</p>'),
    [
      id ? { label: ICON_TRASH + " Delete", kind: "danger icon-btn", run: () => {
        if (!confirm("Delete " + c.name + "? Their properties stay, just unassigned.")) return;
        S.clients = S.clients.filter(x => x.id !== id);
        S.properties.forEach(p => { if (p.clientId === id) p.clientId = null; });
        save(); closeModal(); renderAll();
      } } : { label: "Cancel", run: closeModal },
      { label: id ? "Save changes" : "Add client", kind: "primary", run: () => {
          const name = $("#c_name", m).value.trim();
          if (!name) { toast("A name is required."); return; }
          const rec = {
            id: c.id || uid(), name,
            contact: $("#c_contact", m).value.trim(), phone: $("#c_phone", m).value.trim(),
            criminalGroup: $("#c_crim", m).checked, notes: $("#c_notes", m).value
          };
          if (c.id) Object.assign(clientById(c.id), rec); else S.clients.push(rec);
          save(); closeModal(); renderAll(); toast(c.id ? "Client updated." : "Client added.");
        } }
    ]);

  if (id) {
    const rebind = () => { closeModal(); clientModal(id); };
    $$("#c_props [data-cmprop]", m).forEach(b => b.onclick = () => { closeModal(); propertyModal(b.dataset.cmprop); });
    $$("#c_props [data-unlink]", m).forEach(b => b.onclick = () => {
      const p = propById(b.dataset.unlink);
      p.clientId = null; save(); renderClients(); rebind();
    });
    const add = $("#c_addbtn", m);
    if (add) add.onclick = () => {
      const pid = $("#c_addprop", m).value;
      if (!pid) return;
      propById(pid).clientId = id;
      save(); renderClients(); rebind();
      if (c.criminalGroup) toast(c.name + " is flagged as connected to a criminal group.");
    };
  }
}
$("#btnNewClient").onclick = () => clientModal(null);
$("#clSearch").addEventListener("input", () => { renderClients(); stampTables(); });
$("#clSort").addEventListener("change", () => { renderClients(); stampTables(); });



/* ============================================================
   Loans
   ============================================================ */
/* ============================================================
   Warehouses — flat prices, sized rather than zoned
   ============================================================ */
const WH_TIER = { small: "Small", medium: "Medium", xl: "Extra large" };

function renderWarehouses() {
  const P = S.rules.policy;
  const list = S.warehouses || [];
  const cheapest = list.reduce((a, w) => Math.min(a, w.price || 0), Infinity);
  const dearest = list.reduce((a, w) => Math.max(a, w.price || 0), 0);

  $("#whIntro").innerHTML =
    '<div class="cols3" style="margin-bottom:12px">' +
      '<div class="stat"><div class="n">' + list.length + '</div><div class="l">On the books</div></div>' +
      '<div class="stat"><div class="n">' + money(cheapest === Infinity ? 0 : cheapest) + ' \u2013 ' +
        money(dearest) + '</div><div class="l">Price range</div></div>' +
      '<div class="stat"><div class="n">' + P.agentCommissionPct + '%</div><div class="l">Your commission</div></div>' +
    '</div>' +
    '<p class="note">A warehouse is priced flat, by size. The interior is the same interior wherever ' +
    'the door goes, so zones and multipliers do not apply \u2014 what a buyer pays is what is on this ' +
    'list. Price is the only thing set here; how much one holds and how many a player may own come ' +
    'from the server.</p>';

  $("#whTable").innerHTML = '<div class="whgrid">' + list.map(w => {
    const cut = Math.round((w.price || 0) * P.agentCommissionPct / 100);
    const shot = (typeof WH_SHOTS !== "undefined") ? WH_SHOTS[w.id] : null;
    return '<article class="whcard">' +
      (shot ? '<img class="whshot" src="' + shot + '" alt="Inside the ' + esc(w.label) + '" loading="lazy">'
            : '<div class="whshot noshot"></div>') +
      '<div class="whbody">' +
        '<div class="row" style="align-items:baseline;gap:7px">' +
          '<strong style="flex:1">' + esc(w.label) + '</strong>' +
          '<span class="chip ' + (w.tier === "xl" ? "auction" : w.tier === "medium" ? "held" : "listed") +
            '">' + esc(WH_TIER[w.tier] || w.tier) + '</span>' +
        '</div>' +
        '<p class="note" style="margin:4px 0 8px">' + esc(w.interior || "") + '</p>' +
        '<div class="whprice">' +
          '<input data-whp="' + esc(w.id) + '" type="number" step="25000" value="' + (w.price || 0) + '">' +

        '</div>' +
        '<div class="row" style="margin-top:9px;align-items:center">' +
          '<span class="note" style="flex:1">You earn ' + money(cut) + '</span>' +
          '<button class="btn sm" data-whcalc="' + esc(w.id) + '">Quote</button>' +
        '</div>' +
      '</div></article>';
  }).join("") + '</div>' +
    '<p class="note" style="margin-top:10px">Prices are editable here and travel in a rules pack, ' +
    'the same as zone prices.</p>';

  $$("#whTable [data-whp]").forEach(el => el.onchange = () => {
    const w = (S.warehouses || []).find(x => x.id === el.dataset.whp);
    if (!w) return;
    w.price = +el.value || 0;
    save(); renderWarehouses();
  });
  $$("#whTable [data-whcalc]").forEach(b => b.onclick = () => {
    $("#whCalc").value = b.dataset.whcalc; whCommission();
  });

  $("#whCalc").innerHTML = list.map(w =>
    '<option value="' + esc(w.id) + '">' + esc(w.label) + " \u2014 " + money(w.price) + '</option>').join("");
  whCommission();

  const WH_TERMS = [
    ["agentCommissionPct", "Your commission (%)"]
  ];
  $("#whTerms").innerHTML =
    '<p class="note" style="margin-bottom:10px">What a sale pays out. Everything else about a ' +
    'warehouse \u2014 how much it holds, how many a player may own, what they get back for selling ' +
    'one \u2014 is set on the server, not here.</p>' +
    WH_TERMS.map(f =>
      '<div class="field"><label for="w_' + f[0] + '">' + f[1] + '</label>' +
      '<input id="w_' + f[0] + '" data-wt="' + f[0] + '" type="number" value="' + P[f[0]] + '"></div>').join("");

  $$("#whTerms [data-wt]").forEach(el => el.onchange = () => {
    S.rules.policy[el.dataset.wt] = +el.value || 0;
    save(); renderWarehouses(); renderRules();
  });
}

function whCommission() {
  const w = (S.warehouses || []).find(x => x.id === $("#whCalc").value);
  const P = S.rules.policy;
  if (!w) { $("#whCommission").innerHTML = '<p class="note">No warehouses on the list.</p>'; return; }
  const agent = Math.round(w.price * P.agentCommissionPct / 100);
  $("#whCommission").innerHTML =
    '<div class="value-card"><div class="cap">You take home</div>' +
    '<div class="amt">' + money(agent) + '</div>' +
    '<div class="list">' + esc(w.label) + ' at ' + money(w.price) + '</div></div>' +
    '<table class="breakdown" style="margin-top:12px">' +
    '<tr><td>Sale price</td><td>' + money(w.price) + '</td></tr>' +
    '<tr><td>Your commission (' + P.agentCommissionPct + '%)</td><td>' + money(agent) + '</td></tr>' +
    '</table>';
}
$("#whCalc").addEventListener("change", whCommission);

/* ============================================================
   Payment calculator — nothing is stored, the money moves in game
   ============================================================ */
const FREQ_WORD = { "1": "day", "7": "week", "14": "two weeks", "30": "month" };

function loanCheck() {
  const price = Math.max(0, +$("#lnPrice").value || 0);
  const down = Math.max(0, +$("#lnDown").value || 0);
  const term = Math.max(1, +$("#lnTerm").value || 1);
  const every = $("#lnFreq").value;
  const el = $("#lnCheck");
  if (!price) {
    el.innerHTML = '<div class="empty"><strong>Enter a sale price</strong>' +
      'Or pick one of your saved appraisals to start from.</div>';
    return;
  }
  const capped = Math.min(down, price);
  const pct = Math.round(capped / price * 1000) / 10;
  const financed = Math.max(0, price - capped);
  const per = Math.ceil(financed / term);
  const last = financed - per * (term - 1);
  const word = FREQ_WORD[every] || "period";
  const weeks = (+every * term) / 7;
  const suggested = S.rules.policy.minDownPct;

  el.innerHTML =
    '<div class="value-card"><div class="cap">Each payment</div>' +
    '<div class="amt">' + money(per) + '</div>' +
    '<div class="list">every ' + word + ', ' + term + ' times</div></div>' +
    '<table class="breakdown" style="margin-top:12px">' +
    '<tr><td>Sale price</td><td>' + money(price) + '</td></tr>' +
    '<tr><td>Down at signing</td><td>' + money(capped) + ' (' + pct + '%)</td></tr>' +
    '<tr class="sum"><td>Financed</td><td>' + money(financed) + '</td></tr>' +
    '<tr><td>' + term + ' payments of</td><td>' + money(per) + '</td></tr>' +
    (last !== per && term > 1 ? '<tr class="dim"><td>Final payment settles at</td><td>' + money(last) + '</td></tr>' : '') +
    '<tr><td>Paid off in</td><td>' + (weeks >= 1 ? Math.round(weeks * 10) / 10 + " weeks" : Math.round(weeks * 7) + " days") + '</td></tr>' +
    '</table>' +
    (pct < suggested
      ? '<div class="tip" style="margin-top:11px">' + pct + '% down. The house rules suggest ' +
        suggested + '% (' + money(Math.ceil(price * suggested / 100)) + '), but the terms are yours.</div>'
      : '<div class="ok" style="margin-top:11px">' + pct + '% down, at or above the ' + suggested +
        '% the house rules suggest.</div>') +
    '<div class="row end" style="margin-top:12px"><button class="btn" id="btnCopyTerms">Copy terms</button></div>';

  $("#btnCopyTerms").onclick = () => {
    const lines = [
      "Sale price: " + money(price),
      "Down at signing: " + money(capped) + " (" + pct + "%)",
      "Financed: " + money(financed),
      term + " payments of " + money(per) + ", every " + word,
      last !== per && term > 1 ? "Final payment: " + money(last) : ""
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines).then(
      () => toast("Terms copied."),
      () => openModal("Terms", '<textarea rows="8" readonly>' + esc(lines) + '</textarea>',
        [{ label: "Close", run: closeModal }])
    );
  };
}

function syncDownPct(from) {
  const price = Math.max(0, +$("#lnPrice").value || 0);
  if (!price) return;
  if (from === "amount") {
    const d = Math.max(0, +$("#lnDown").value || 0);
    $("#lnDownPct").value = Math.round(Math.min(d, price) / price * 1000) / 10;
  } else {
    const p = Math.min(100, Math.max(0, +$("#lnDownPct").value || 0));
    $("#lnDown").value = Math.round(price * p / 100);
  }
}

["lnPrice", "lnTerm", "lnFreq"].forEach(id => {
  const el = $("#" + id);
  if (el) el.addEventListener("input", () => { if (id === "lnPrice") syncDownPct("amount"); loanCheck(); });
});
$("#lnDown").addEventListener("input", () => { syncDownPct("amount"); loanCheck(); });
$("#lnDownPct").addEventListener("input", () => { syncDownPct("pct"); loanCheck(); });
$("#lnProp").addEventListener("change", () => {
  const p = propById($("#lnProp").value);
  if (!p) return;
  $("#lnPrice").value = p.soldFor || p.list;
  $("#lnDownPct").value = S.rules.policy.minDownPct;
  syncDownPct("pct");
  loanCheck();
});
$$("[data-lnpreset]").forEach(b => b.onclick = () => {
  $("#lnTerm").value = b.dataset.lnpreset; loanCheck();
});

function renderLoans() {
  $("#lnProp").innerHTML = '<option value="">\u2014 enter a price by hand \u2014</option>' +
    S.properties.map(p => '<option value="' + p.id + '">' + esc(p.address) + " \u2014 " +
      money(p.soldFor || p.list) + '</option>').join("");
  loanCheck();
}

/* ============================================================
   Rules
   ============================================================ */
const POLICY_FIELDS = [
  ["roundIncrement", "Asking prices round up to ($)"],
  ["locationShare", "Location share of base (%)"],
  ["featureFullTo", "Features count in full up to (%)"],
  ["featureTaper", "Weight of features beyond that (%)"],
  ["maxDepreciationPct", "Most that disclosures can take off (%)"],
  ["boundGive", "How much value past a zone bound still counts (%)"],
  ["auctionsEnabled", "Auctions are used on this server", "bool"],
  ["uniqueForcesAuction", "Unique properties must go to auction", "bool"],
  ["minDownPct", "Suggested downpayment (%)"],
  ["evictionWarnDays", "Eviction warning (days)"],
  ["furnitureMinPct", "Furniture uplift, lowest (%)"],
  ["furnitureMaxPct", "Furniture uplift, highest (%)"]
];
const KIND_LABEL = { toggle: "Yes or no", count: "Counted, compounding",
  tiered: "First one, then each after", choice: "Pick from a list", free: "Agent sets it" };

function modSummary(m) {
  if (m.kind === "tiered") return "first \u00d7" + trim(m.value) + ", then \u00d7" + trim(m.value2);
  if (m.kind === "count") return "\u00d7" + trim(m.value) + " each";
  if (m.kind === "choice") return (m.options || []).map(o => o.label + " \u00d7" + trim(o.value)).join(", ");
  if (m.kind === "free") return trim(m.value) + "\u2013" + trim(m.value2) + "\u00d7 band";
  return "\u00d7" + trim(m.value);
}
function modSummaryModern(m) {
  const pc = n => (n > 0 ? "+" : "") + trim(n) + "%";
  if (m.id === "rooms") return "structure, " + (100 - S.rules.policy.locationShare) + "% of base";
  if (m.penaltyPct) return "\u2212" + trim(m.penaltyPct) + "%";
  if (isSpecialUse(m)) return "premium line";
  if (m.kind === "choice") {
    const parts = (m.options || []).filter(o => +o.pct).map(o => o.label + " " + pc(+o.pct));
    return parts.length ? parts.join(", ") : "no effect";
  }
  if (isFlatFeature(m)) {
    const f = +m.flat || 0, fx = +m.flatExtra || 0;
    return money(f) + (fx ? ", then " + money(fx) : "") + " fixed";
  }
  if (!+m.pct && !+m.pctExtra) return "no effect";
  if (m.kind === "count" || m.kind === "tiered")
    return pc(+m.pct || 0) + (+m.pctExtra ? ", then " + pc(+m.pctExtra) : "");
  return pc(+m.pct || 0);
}

/* Both models are editable side by side. The appraisal model is chosen per
   property, so the Rules tab can't follow "the current one" — it shows both. */
function legacyCell(m) {
  if (m.kind === "choice" || m.kind === "free")
    return '<span class="note">' + esc(modSummary(m)) + '</span>';
  const second = m.kind === "tiered"
    ? '<input data-lv2="' + m.id + '" type="number" step="0.05" value="' + m.value2 +
      '" title="Each after the first">' : "";
  return '<div class="minipair">' +
    '<input data-lv="' + m.id + '" type="number" step="0.05" value="' + m.value + '" title="Multiplier">' +
    second + '</div>';
}
function modernCell(m) {
  if (m.id === "rooms")
    return '<span class="note">' + esc(modSummaryModern(m)) + '<br>set on the House rules panel</span>';
  if (m.penaltyPct != null)
    return '<div class="minipair"><input data-pp="' + m.id + '" type="number" step="1" value="' +
      m.penaltyPct + '" title="Takes this % off"></div>';
  if (isSpecialUse(m)) return '<span class="note">premium line</span>';
  if (m.kind === "choice" || m.kind === "free")
    return '<span class="note">' + esc(modSummaryModern(m)) + '</span>';
  const flat = isFlatFeature(m);
  const many = m.kind === "count" || m.kind === "tiered";
  const second = many
    ? '<input data-' + (flat ? "fx" : "px") + '="' + m.id + '" type="number" step="' +
      (flat ? "500" : "1") + '" value="' + (flat ? (m.flatExtra == null ? 0 : m.flatExtra)
        : (m.pctExtra == null ? 0 : m.pctExtra)) + '" title="Each after the first">' : "";
  return '<div class="minipair' + (flat ? " flatpair" : "") + '">' +
    '<input data-' + (flat ? "fv" : "pv") + '="' + m.id + '" type="number" step="' +
    (flat ? "500" : "1") + '" value="' + (flat ? (m.flat == null ? 0 : m.flat)
      : (m.pct == null ? 0 : m.pct)) + '" title="' +
    (flat ? "A fixed amount in dollars" : "% of the zone base") + '">' + second + '</div>';
}

function renderRules() {
  const P = S.rules.policy;
  const mods = S.rules.mods || [];
  const zones = S.zones.slice().sort((x, y) => (x.base || 0) - (y.base || 0));
  const ordinary = zones.filter(z => !z.unique);
  const cheapest = ordinary[0], dearest = ordinary[ordinary.length - 1];

  /* ---- plain-language summary: the part a realtor actually reads ---- */
  $("#rulesSummary").innerHTML =
    '<div class="cols3" style="margin-bottom:12px">' +
      '<div class="stat"><div class="n">' + zones.length + '</div><div class="l">Zones</div></div>' +
      '<div class="stat"><div class="n">' + mods.length + '</div><div class="l">Multipliers</div></div>' +
      '<div class="stat"><div class="n">' +
        (cheapest ? money(cheapest.floor || cheapest.base) : "\u2014") + ' \u2013 ' +
        (dearest ? money(dearest.ceiling || dearest.base) : "\u2014") +
        '</div><div class="l">Ordinary market</div></div>' +
    '</div>' +
    '<p class="note"><strong>How an appraisal is built.</strong> It starts from the zone base. ' + P.locationShare +
    '% of it is location and never moves; the rest scales with rooms, four being the baseline. ' +
    'Features add a percentage of base on top, counting in full to +' + P.featureFullTo +
    '% and at ' + P.featureTaper + '% beyond that. Disclosures take value off, never more than ' +
    P.maxDepreciationPct + '% combined. Torture rooms, drug labs and panic rooms are kept off the ' +
    'appraisal and quoted as a separate premium.</p>' +
    '<p class="note" style="margin-top:8px">' + (P.auctionsEnabled
      ? 'Custom interiors, exotic features' + (P.uniqueForcesAuction ? ' and unique properties' : '') +
        ' are flagged for auction.'
      : 'Auctions are switched off, so nothing is flagged for one.') + '</p>' +
    '<p class="note" style="margin-top:8px">Every zone has a floor and a ceiling. Neither is a wall: ' +
    'value beyond a bound still counts, at ' + P.boundGive + '%. You may list above an appraisal, ' +
    'never below it. Asking prices round up to the nearest ' + money(P.roundIncrement) + '.</p>';

  /* ---- zones, now including the price band ---- */
  const zq = ($("#zoneSearch") ? $("#zoneSearch").value : "").toLowerCase();
  const shown = S.zones.filter(z => !zq || z.name.toLowerCase().indexOf(zq) >= 0);
  $("#zoneCount").textContent = shown.length === S.zones.length
    ? S.zones.length + " zones" : shown.length + " of " + S.zones.length + " zones";
  $("#zoneTable").innerHTML = shown.length
    ? '<table class="data zonetable"><thead><tr><th>#</th><th>Zone</th>' +
      '<th class="num">Floor</th><th class="num">Base</th><th class="num">Ceiling</th>' +
      '<th>Unique property</th><th class="num">Saved</th><th></th></tr></thead><tbody>' +
      shown.map(z => {
        const n = S.properties.filter(p => String(p.zone) === String(z.id)).length;
        const bad = z.floor && z.ceiling && z.floor > z.ceiling;
        return '<tr' + (bad ? ' class="rowbad"' : '') + '><td>' + z.id + '</td>' +
          '<td><input data-z="' + z.id + '" data-f="name" value="' + esc(z.name) + '"></td>' +
          '<td class="num"><input data-z="' + z.id + '" data-f="floor" type="number" value="' + (z.floor || 0) + '"></td>' +
          '<td class="num"><input data-z="' + z.id + '" data-f="base" type="number" value="' + z.base + '"></td>' +
          '<td class="num"><input data-z="' + z.id + '" data-f="ceiling" type="number" value="' + (z.ceiling || 0) + '"></td>' +
          '<td><input data-z="' + z.id + '" data-f="unique" type="checkbox"' + (z.unique ? " checked" : "") + '></td>' +
          '<td class="num">' + n + '</td>' +
          '<td style="white-space:nowrap"><button class="btn sm" data-zmap="' + z.id + '">Map</button> ' +
          '<button class="btn sm danger icon" data-delzone="' + z.id + '" title="Delete zone" ' +
          'aria-label="Delete zone">' + ICON_TRASH + '</button></td></tr>' +
          (bad ? '<tr class="rowbadnote"><td colspan="8" class="note">Floor is above the ceiling \u2014 ' +
            'the ceiling is ignored until this is fixed.</td></tr>' : '');
      }).join("") + '</tbody></table>' +
      '<p class="note" style="margin-top:8px">Zones, prices and map positions are set by the HUG Regional Director ' +
      'and update here automatically.</p>'
    : '<div class="empty"><strong>No zone matches that</strong>Try another name.</div>';

  $$("#zoneTable [data-z]").forEach(el => el.onchange = () => {
    const z = zoneById(el.dataset.z), f = el.dataset.f;
    z[f] = f === "unique" ? el.checked : (f === "name" || f === "real" ? el.value : +el.value);
    save(); renderRules(); renderResult(); drawPins();
  });
  $$("#zoneTable [data-zmap]").forEach(b => b.onclick = () => {
    showView("map"); selectZone(b.dataset.zmap);
  });
  $$("#zoneTable [data-delzone]").forEach(b => b.onclick = () => {
    const z = zoneById(b.dataset.delzone);
    if (!confirm("Delete zone " + z.name + "?")) return;
    S.zones = S.zones.filter(x => String(x.id) !== String(z.id));
    save(); renderAll();
  });

  /* ---- multipliers ---- */
  const groups = GROUPS.concat(mods.map(m => m.group).filter(g => GROUPS.indexOf(g) < 0));
  const gf = $("#modGroupFilter");
  const gfVal = gf && gf.value ? gf.value : "";
  if (gf) gf.innerHTML = '<option value="">Every section</option>' +
    groups.filter(g => mods.some(m => m.group === g)).map(g =>
      '<option' + (gfVal === g ? " selected" : "") + '>' + esc(g) + '</option>').join("");
  const mq = ($("#modSearch") ? $("#modSearch").value : "").toLowerCase();
  const visible = mods.filter(m => (!mq || m.label.toLowerCase().indexOf(mq) >= 0) &&
    (!gfVal || m.group === gfVal));

  $("#rulesMult").innerHTML = visible.length
    ? '<table class="data modtable"><thead><tr><th></th><th>Multiplier</th><th>Type</th>' +
      '<th>Adds</th><th>Section</th><th></th></tr></thead><tbody>' +
      visible.map(m => {
        const i = mods.indexOf(m);
        return '<tr><td style="white-space:nowrap;padding-right:0">' +
          '<button class="btn sm icon" data-up="' + m.id + '" title="Move up" aria-label="Move up"' +
            (i === 0 ? " disabled" : "") + '>' + ICON_UP + '</button> ' +
          '<button class="btn sm icon" data-down="' + m.id + '" title="Move down" aria-label="Move down"' +
            (i === mods.length - 1 ? " disabled" : "") + '>' + ICON_DOWN + '</button></td>' +
        '<td><strong>' + esc(m.label) + '</strong>' +
          (m.requires ? '<div class="note">needs ' + esc((modById(m.requires) || {}).label || m.requires) + '</div>' : '') +
          (m.forcesAuction && S.rules.policy.auctionsEnabled
            ? '<div class="note">forces an auction</div>' : '') + '</td>' +
        '<td class="note">' + esc(KIND_LABEL[m.kind] || m.kind) + '</td>' +
        '<td>' + modernCell(m) + '</td>' +
        '<td class="note">' + esc(m.group || "\u2014") + '</td>' +
        '<td style="white-space:nowrap"><button class="btn sm" data-editmod="' + m.id + '">Edit</button> ' +
          '<button class="btn sm danger icon" data-delmod="' + m.id + '" title="Delete ' + esc(m.label) +
          '" aria-label="Delete ' + esc(m.label) + '">' + ICON_TRASH + '</button></td></tr>';
      }).join("") + '</tbody></table>' +
      (visible.length < mods.length
        ? '<p class="note" style="margin-top:8px">Showing ' + visible.length + ' of ' + mods.length + '.</p>' : '')
    : '<div class="empty"><strong>No multiplier matches that</strong>Clear the search to see all ' +
      mods.length + '.</div>';

  const touchMod = () => { save(); renderRules(); renderResult(); };
  const bindNum = (attr, apply) => $$("#rulesMult [data-" + attr + "]").forEach(el => el.onchange = () => {
    const m = modById(el.getAttribute("data-" + attr));
    if (!m) return;
    apply(m, +el.value);
    touchMod();
  });
  bindNum("lv",  (m, v) => { m.value = v; });
  bindNum("lv2", (m, v) => { m.value2 = v; });
  bindNum("pv",  (m, v) => { m.pct = v; });
  bindNum("px",  (m, v) => { m.pctExtra = v; });
  bindNum("pp",  (m, v) => { m.penaltyPct = v; });
  bindNum("fv",  (m, v) => { m.flat = v; });
  bindNum("fx",  (m, v) => { m.flatExtra = v; });
  $$("#rulesMult [data-editmod]").forEach(b => b.onclick = () => modModal(b.dataset.editmod));
  $$("#rulesMult [data-delmod]").forEach(b => b.onclick = () => deleteMod(b.dataset.delmod));
  $$("#rulesMult [data-up]").forEach(b => b.onclick = () => moveMod(b.dataset.up, -1));
  $$("#rulesMult [data-down]").forEach(b => b.onclick = () => moveMod(b.dataset.down, 1));

  /* ---- house rules ---- */
  $("#rulesPolicy").innerHTML = POLICY_FIELDS.map(f =>
    '<div class="field"><label for="p_' + f[0] + '">' + f[1] + '</label>' +
    (f[2] === "bool"
      ? '<input id="p_' + f[0] + '" data-p="' + f[0] + '" data-bool="1" type="checkbox"' +
        (P[f[0]] ? " checked" : "") + '>'
      : '<input id="p_' + f[0] + '" data-p="' + f[0] + '" type="number" value="' + P[f[0]] + '">') +
    '</div>').join("");
  $$("#rulesPolicy [data-p]").forEach(el => el.onchange = () => {
    S.rules.policy[el.dataset.p] = el.dataset.bool ? (el.checked ? 1 : 0) : +el.value;
    save(); renderRules(); renderResult();
  });

  $("#btnAddMod").onclick = () => modModal(null);
  stampTables();
}

/* filters re-render without losing what was typed */
["zoneSearch", "modSearch"].forEach(id => {
  const el = $("#" + id);
  if (el) el.addEventListener("input", () => {
    renderRules();
    const again = $("#" + id);
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });
});
$("#modGroupFilter").addEventListener("change", renderRules);


function moveMod(id, dir) {
  const mods = S.rules.mods, i = mods.findIndex(m => m.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= mods.length) return;
  mods.splice(j, 0, mods.splice(i, 1)[0]);
  save(); renderRules(); renderAppraiseForm(); renderResult();
}

function deleteMod(id) {
  const m = modById(id);
  if (!m) return;
  const dependants = (S.rules.mods || []).filter(x => x.requires === id);
  const used = S.properties.filter(p => ((p.form || {}).mods || {})[id]).length;
  openModal("Delete " + m.label,
    '<p>It comes off the appraisal form and out of every calculation from now on.</p>' +
    (used ? '<div class="warn" style="margin-top:10px">' + used + ' saved ' +
      (used === 1 ? "property has" : "properties have") + ' a value for it. Their stored appraisals stay as they are, ' +
      'but re-appraising them will come out lower.</div>' : '') +
    (dependants.length ? '<div class="warn" style="margin-top:10px">' +
      dependants.map(d => esc(d.label)).join(", ") + ' depend' + (dependants.length === 1 ? "s" : "") +
      ' on it and will start applying on their own.</div>' : ''),
    [{ label: "Cancel", run: closeModal },
     { label: ICON_TRASH + " Delete", kind: "danger icon-btn", run: () => {
        S.rules.mods = S.rules.mods.filter(x => x.id !== id);
        S.rules.mods.forEach(x => { if (x.requires === id) delete x.requires; });
        if (F.mods) delete F.mods[id];
        S.properties.forEach(p => { if (p.form && p.form.mods) delete p.form.mods[id]; });
        save(); closeModal(); renderAll(); toast(m.label + " deleted.");
      } }]);
}

function modModal(id) {
  const m = id ? modById(id) : { id: null, label: "", group: "Other", kind: "toggle",
    value: 1.2, value2: 1.1, options: [{ label: "None", value: 1 }, { label: "Yes", value: 1.2 }],
    outside: false, forcesAuction: false, hint: "", requires: "" };
  const groups = GROUPS.concat((S.rules.mods || []).map(x => x.group).filter(g => GROUPS.indexOf(g) < 0));
  const others = (S.rules.mods || []).filter(x => x.id !== id && x.kind === "toggle");
  const mm = openModal(id ? "Edit " + m.label : "Add a multiplier",
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Name</span><input id="d_label" value="' + esc(m.label) + '" placeholder="e.g. Private dock"></div>' +
      '<div><span class="lab">How it is entered</span><select id="d_kind">' +
        Object.keys(KIND_LABEL).map(k => '<option value="' + k + '"' + (m.kind === k ? " selected" : "") + '>' +
          KIND_LABEL[k] + '</option>').join("") + '</select></div></div>' +
    '<div id="d_values" style="margin-bottom:10px"></div>' +
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Form section</span><select id="d_group">' +
        groups.map(g => '<option' + (m.group === g ? " selected" : "") + '>' + esc(g) + '</option>').join("") + '</select></div>' +
      '<div><span class="lab">Only counts with</span><select id="d_req">' +
        '<option value="">— nothing —</option>' + others.map(o =>
          '<option value="' + o.id + '"' + (m.requires === o.id ? " selected" : "") + '>' + esc(o.label) + '</option>').join("") +
      '</select></div></div>' +
    '<div style="margin-bottom:10px"><span class="lab">Note on the form (optional)</span>' +
      '<input id="d_hint" value="' + esc(m.hint || "") + '"></div>' +
    '<input type="checkbox" id="d_out" hidden' + (m.outside ? " checked" : "") + '>' +
    (S.rules.policy.auctionsEnabled
      ? '<label class="row" style="gap:6px;margin-top:5px"><input type="checkbox" id="d_auc"' +
        (m.forcesAuction ? " checked" : "") + '> A property with this must be sold at auction</label>'
      : '') +
    '',
    [id ? { label: ICON_TRASH + " Delete", kind: "danger icon-btn", run: () => { closeModal(); deleteMod(id); } }
        : { label: "Cancel", run: closeModal },
     { label: id ? "Save" : "Add", kind: "primary", run: () => {
        const label = $("#d_label", mm).value.trim();
        if (!label) { toast("Give it a name."); return; }
        const kind = $("#d_kind", mm).value;
        const rec = { id: id || uid(), label, kind, group: $("#d_group", mm).value,
          hint: $("#d_hint", mm).value.trim(), outside: $("#d_out", mm).checked,
          forcesAuction: $("#d_auc", mm) ? $("#d_auc", mm).checked : !!m.forcesAuction };
        const req = $("#d_req", mm).value; if (req) rec.requires = req;
        if (kind === "choice") {
          const opts = [];
          $$("#d_values .optrow", mm).forEach(row => {
            const l = $(".ol", row).value.trim(), v = +$(".ov", row).value, pc = +$(".op", row).value;
            if (l) opts.push({ label: l, value: v || 1, pct: pc || 0 });
          });
          if (opts.length < 2) { toast("A list needs at least two options."); return; }
          rec.options = opts; rec.value = opts[0].value;
        } else {
          rec.value = +$("#d_val", mm).value;
          if (!rec.value || rec.value <= 0) { toast("The multiplier has to be above zero."); return; }
          const v2 = $("#d_val2", mm);
          if (v2) rec.value2 = +v2.value || 1;
          const modeEl = mm.querySelector('input[name="d_mode"]:checked');
          const asFlat = modeEl && modeEl.value === "flat";
          const pc = $("#d_pct", mm), pc2 = $("#d_pct2", mm);
          if (asFlat) {
            rec.flat = pc ? (+pc.value || 0) : 0;
            rec.flatExtra = pc2 ? (+pc2.value || 0) : 0;
            rec.pct = 0; rec.pctExtra = 0;
          } else {
            rec.pct = pc ? (+pc.value || 0) : 0;
            rec.pctExtra = pc2 ? (+pc2.value || 0) : 0;
            rec.flat = 0; rec.flatExtra = 0;
          }
        }
        if (id) {
          const target = modById(id);
          Object.keys(target).forEach(k => { if (!(k in rec)) delete target[k]; });
          Object.assign(target, rec);
        } else S.rules.mods.push(rec);
        save(); closeModal(); renderAll();
        toast(id ? label + " saved." : label + " added.");
      } }]);

  const flatMode = isFlatFeature(m);
  const pctRow = (kind) => {
    if (kind === "choice") return "";
    const many = (kind === "count" || kind === "tiered");
    return '<div>' +
      '<span class="lab">What it adds</span>' +
      '<div class="row" style="gap:14px;margin-bottom:8px">' +
        '<label class="row" style="gap:5px"><input type="radio" name="d_mode" value="pct"' +
          (flatMode ? "" : " checked") + '> Share of the zone price</label>' +
        '<label class="row" style="gap:5px"><input type="radio" name="d_mode" value="flat"' +
          (flatMode ? " checked" : "") + '> A fixed amount</label>' +
      '</div>' +
      '<div class="' + (many ? "grid2" : "") + '">' +
        '<div><span class="lab" data-modelab>' + (flatMode ? "Adds this many dollars" : "Adds this % of the zone base") + '</span>' +
        '<input id="d_pct" type="number" step="' + (flatMode ? "500" : "1") + '" value="' +
          (flatMode ? (m.flat == null ? 0 : m.flat) : (m.pct == null ? 0 : m.pct)) + '"></div>' +
        (many ? '<div><span class="lab" data-modelab2>' +
          (flatMode ? "Each after the first" : "%, each after the first") + '</span>' +
          '<input id="d_pct2" type="number" step="' + (flatMode ? "500" : "1") + '" value="' +
          (flatMode ? (m.flatExtra == null ? 0 : m.flatExtra) : (m.pctExtra == null ? 0 : m.pctExtra)) +
          '"></div>' : "") +
      '</div><p class="note" style="margin-top:5px">A share of the price suits anything about land ' +
      'or the building itself. A fixed amount suits things with a cost of their own \u2014 a shed is ' +
      'a shed wherever it stands. Negative numbers take value off.</p></div>';
  };
  const drawValues = () => {
    const kind = $("#d_kind", mm).value;
    const box = $("#d_values", mm);
    if (kind === "choice") {
      const opts = (m.kind === "choice" && m.options) ? m.options : [{ label: "None", value: 1 }, { label: "Yes", value: 1.2 }];
      box.innerHTML = '<span class="lab">Options — label and % of the zone base it adds. ' +
        'The first should usually be a 0% "None".</span>' +
        '<div id="d_opts">' + opts.map(o =>
          '<div class="row optrow" style="gap:6px;margin-bottom:5px">' +
          '<input class="ol" value="' + esc(o.label) + '" placeholder="Label">' +
          '<input class="ov" type="number" step="0.05" value="' + o.value + '" hidden>' +
          '<input class="op" type="number" step="1" value="' + (o.pct == null ? 0 : o.pct) + '" style="max-width:70px" title="Modern %">' +
          '<button class="btn sm danger icon" data-rmopt title="Remove option" aria-label="Remove option">' +
          ICON_TRASH + '</button></div>').join("") + '</div>' +
        '<button class="btn sm" id="d_addopt">Add option</button>';
      $("#d_addopt", mm).onclick = () => {
        const row = document.createElement("div");
        row.className = "row optrow"; row.style.cssText = "gap:6px;margin-bottom:5px";
        row.innerHTML = '<input class="ol" placeholder="Label"><input class="ov" type="number" step="0.05" ' +
          'value="1.2" hidden>' +
          '<input class="op" type="number" step="1" value="5" style="max-width:70px" title="Modern %">' +
          '<button class="btn sm danger icon" data-rmopt ' +
          'title="Remove option" aria-label="Remove option">' + ICON_TRASH + '</button>';
        $("#d_opts", mm).appendChild(row);
        row.querySelector("[data-rmopt]").onclick = () => row.remove();
      };
      $$("#d_values [data-rmopt]", mm).forEach(b => b.onclick = () => b.closest(".optrow").remove());
    } else if (kind === "tiered") {
      box.innerHTML = '<div class="grid2" hidden><div><span class="lab">First one</span>' +
        '<input id="d_val" type="number" step="0.05" value="' + (m.value || 1.4) + '"></div>' +
        '<div><span class="lab">Each after that</span>' +
        '<input id="d_val2" type="number" step="0.05" value="' + (m.value2 || 1.2) + '"></div></div>';
    } else if (kind === "free") {
      box.innerHTML = '<div class="grid2" hidden><div><span class="lab">Lowest allowed</span>' +
        '<input id="d_val" type="number" step="0.1" value="' + (m.value || 1.2) + '"></div>' +
        '<div><span class="lab">Highest allowed</span>' +
        '<input id="d_val2" type="number" step="0.1" value="' + (m.value2 || 5) + '"></div></div>';
    } else {
      box.innerHTML = '<input id="d_val" type="number" step="0.05" value="' + (m.value || 1.2) + '" hidden>';
    }
    if (kind !== "choice") {
      box.innerHTML += pctRow(kind);
      $$('input[name="d_mode"]', mm).forEach(rb => rb.onchange = () => {
        const flat = rb.value === "flat" && rb.checked;
        const l1 = $("[data-modelab]", mm), l2 = $("[data-modelab2]", mm);
        if (l1) l1.textContent = flat ? "Adds this many dollars" : "Adds this % of the zone base";
        if (l2) l2.textContent = flat ? "Each after the first" : "%, each after the first";
        [$("#d_pct", mm), $("#d_pct2", mm)].forEach(i => { if (i) i.step = flat ? "500" : "1"; });
      });
    }
  };
  drawValues();
  $("#d_kind", mm).onchange = drawValues;
}

$("#btnResetMods").onclick = () => {
  openModal("Reset multipliers",
    '<p>Every multiplier goes back to the values this tool ships with, and anything you added ' +
    'yourself is removed.</p>' +
    '<p class="note" style="margin-top:9px">Zones, prices, house rules and saved appraisals ' +
    'are left alone.</p>',
    [{ label: "Cancel", run: closeModal },
     { label: "Reset", kind: "danger", run: () => {
        S.rules.mods = legacyMods();
        save(); closeModal(); renderAll(); toast("Multipliers reset.");
      } }]);
};

/* ============================================================
   Data tab
   ============================================================ */
function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
$("#btnCsv").onclick = () => {
  if (!S.properties.length) { toast("Nothing to write out yet."); return; }
  const head = ["Address", "Zone", "Rooms", "Appraised", "Asking", "Sold for",
    "Status", "Client", "Photos", "Saved", "Notes"];
  const rows = S.properties.map(p => {
    const f = p.form || {}, mods = f.mods || {};
    return [p.address, (zoneById(p.zone) || {}).name || "",
      mods.rooms || 0, p.appraisal || 0, p.list || 0, p.soldFor == null ? "" : p.soldFor,
      p.status, (clientById(p.clientId) || {}).name || "", (f.photos || []).length,
      p.created ? new Date(p.created).toISOString().slice(0, 10) : "", p.notes || ""];
  });
  const csv = [head].concat(rows).map(r => r.map(csvCell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = "hug-mls-properties-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click(); URL.revokeObjectURL(a.href);
  toast(S.properties.length + " properties written out.");
};

function renderData() {
  $("#schemaVer").textContent = "v" + SCHEMA;
  const bs = $("#buildStamp"); if (bs) bs.textContent = "Build " + BUILD +
    (S.packVersion ? " \u00b7 rules pack v" + S.packVersion : "");
  const lb = $("#btnLoad");
  if (lb && !lb.dataset.iced) { lb.innerHTML = ICON_LOAD + "<span>Load file</span>"; lb.dataset.iced = "1"; }
  const bytes = Store.bytes();
  const kb = Math.round(bytes / 102.4) / 10;
  const pct = Math.min(100, Math.round(bytes / 5242880 * 100));
  const since = S.lastExport ? Math.floor((Date.now() - S.lastExport) / 86400000) : null;
  $("#storageInfo").innerHTML =
    (Store.ok ? '<div class="ok">Saving normally. ' + kb + ' KB used.</div>'
              : '<div class="warn">This browser is not saving. Private browsing or strict privacy settings can cause this \u2014 export a backup before closing.</div>') +
    '<div class="note" style="margin-top:8px">' + S.properties.length + " properties \u00b7 " +
    S.clients.length + " clients \u00b7 <span id='photoCount'>counting pictures\u2026</span></div>" +
    '<div class="meter" title="' + pct + '% of the browser\u2019s text storage"><i style="width:' +
    Math.max(2, pct) + '%"></i></div>' +
    '<div class="note">' + kb + ' KB of records, about ' + pct + '% of what this browser allows. ' +
    'Pictures are stored separately and do not count toward it.</div>' +
    (since === null
      ? '<div class="tip" style="margin-top:9px">You have never exported a backup.</div>'
      : since >= 7
        ? '<div class="tip" style="margin-top:9px">Last backup was ' + since + ' days ago.</div>'
        : '<div class="note" style="margin-top:9px">Last backup ' +
          (since === 0 ? "today" : since === 1 ? "yesterday" : since + " days ago") + '.</div>');
  PhotoStore.keys().then(k => {
    const el = $("#photoCount");
    if (el) el.textContent = k.length + (k.length === 1 ? " picture" : " pictures");
  }).catch(() => { const el = $("#photoCount"); if (el) el.textContent = "pictures unavailable"; });
  $("#packInfo").innerHTML = S.packVersion
    ? '<div class="ok">Running rules pack v' + S.packVersion +
      (S.packIssued ? ", issued " + esc(S.packIssued) : "") + '.' +
      (S.packNote ? '<div class="note" style="margin-top:4px">' + esc(S.packNote) + '</div>' : '') + '</div>'
    : '<div class="note">No rules pack applied — these are your own zones and rules.</div>';
  $("#mapFileInfo").innerHTML = S.customMap
    ? '<div class="ok">Custom map loaded (' + Math.round(S.customMap.length / 1365) / 1000 + ' MB).</div>'
    : '<div class="note">Using the shipped map images.</div>';
}

$("#btnExport").onclick = () => {
  PhotoStore.all().then(photos => exportBackup(photos)).catch(() => exportBackup({}));
};
function exportBackup(photos) {
  const payload = Object.assign({}, S, { photoBlobs: photos || {} });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hug-mls-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click(); URL.revokeObjectURL(a.href);
  S.lastExport = Date.now(); save();
  renderData();
  const n = Object.keys(photos || {}).length;
  toast("Backup downloaded" + (n ? " with " + n + (n === 1 ? " picture." : " pictures.") : "."));
}
$("#btnLoad").onclick = () => $("#loadFile").click();
$("#loadFile").onchange = e => {
  const f = e.target.files[0];
  if (f) routeFile(f);
  e.target.value = "";
};

/* One loader for everything. Works out what the file is and sends it
   where it belongs rather than making you pick the right button. */
function routeFile(file) {
  if (file.type && file.type.indexOf("image/") === 0) { loadMapImage(file); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const text = String(rd.result || "");
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (err) { parsed = null; }
    if (parsed && typeof parsed === "object") {
      if (parsed.kind === "dynasty8-office-pack" || parsed.kind === "dynasty8-rules-pack") {
        if (MODE !== "director") { toast("That is a rules file. Zones and rules come from HUG automatically."); return; }
        applyPackFile(parsed); return;
      }
      if (Array.isArray(parsed.properties) || Array.isArray(parsed.clients)) { applyBackupFile(parsed); return; }
      toast("That JSON is neither a backup nor a rules pack.");
      return;
    }
    toast("Couldn't tell what that file was. Backups and rules packs are .json; map art is an image.");
  };
  rd.readAsText(file);
}

function applyBackupFile(incoming) {
  const v = incoming.schema || 1;
  openModal("Restore a backup",
    '<p>This backup holds ' + (incoming.properties || []).length + ' properties, ' +
    (incoming.clients || []).length + ' clients and ' +
    Object.keys(incoming.photoBlobs || {}).length + ' pictures' +
    (v < SCHEMA ? ', saved in format v' + v + ' and will be converted' : '') + '.</p>' +
    '<p class="warn" style="margin-top:10px">Restoring replaces everything currently on this machine.</p>',
    [{ label: "Cancel", run: closeModal },
     { label: "Replace my data", kind: "primary", run: () => {
        const blobs = incoming.photoBlobs || {};
        delete incoming.photoBlobs;
        S = migrate(incoming); applyOfficePack(S);
        // a backup never overrides HUG's published zones and rules on an agency
        if (MODE !== "director" && PUBLISHED) applyOfficePack(S, PUBLISHED, true);
        save();
        const keys = Object.keys(blobs);
        Promise.all(keys.map(k => PhotoStore.put(k, blobs[k]).catch(() => {})))
          .then(() => { closeModal(); renderAll();
            toast("Backup restored" + (keys.length ? " with " + keys.length + " pictures." : "."));
          });
      } }]);
}

function loadMapImage(file) {
  if (file.size > 4e6) { toast("That image is over 4 MB and won't fit in browser storage."); return; }
  const rd = new FileReader();
  rd.onload = () => {
    S.customMap = rd.result;
    if (save()) { S.ui.layer = "custom"; save(); renderAll(); applyLayer(); toast("Custom map loaded."); }
  };
  rd.readAsDataURL(file);
}

/* Dropping a file anywhere on the window goes through the same router. */
["dragenter", "dragover"].forEach(ev => window.addEventListener(ev, e => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf("Files") >= 0) {
    e.preventDefault(); document.body.classList.add("dropping");
  }
}));
["dragleave", "drop"].forEach(ev => window.addEventListener(ev, e => {
  if (ev === "dragleave" && e.relatedTarget) return;
  document.body.classList.remove("dropping");
}));
window.addEventListener("drop", e => {
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!f) return;
  e.preventDefault();
  routeFile(f);
});

$("#btnWipe").onclick = () => {
  openModal("Erase all data",
    '<p>Every property, client and loan on this machine will be removed, and zones and rules go back to defaults.</p>' +
    '<p class="warn" style="margin-top:10px">There is no undo. Export a backup first if you might want any of it.</p>',
    [{ label: "Cancel", run: closeModal },
     { label: "Erase everything", kind: "danger", run: () => {
        S = blankState(); save(); closeModal(); renderAll(); toast("All data erased.");
      } }]);
};
$("#btnMapUpload").onclick = () => $("#mapFile").click();
$("#mapFile").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 4e6) { toast("That image is over 4 MB and will not fit in browser storage."); return; }
  const rd = new FileReader();
  rd.onload = () => {
    S.customMap = rd.result;
    if (save()) { S.ui.layer = "custom"; save(); toast("Custom map loaded."); renderAll(); applyLayer(); }
  };
  rd.readAsDataURL(f);
};
$("#btnMapClear").onclick = () => {
  S.customMap = null;
  if (S.ui.layer === "custom") S.ui.layer = "atlas";
  save(); renderData(); applyLayer();
};


/* ============================================================
   Rules pack — zones and rules, shared between agencies
   ============================================================ */
function buildPack(note) {
  return {
    kind: "dynasty8-office-pack",
    version: (S.packVersion || 0) + 1,
    issued: new Date().toISOString().slice(0, 10),
    note: note || "",
    schema: SCHEMA,
    zones: clone(S.zones),
    warehouses: clone(S.warehouses),
    rules: clone(S.rules)
  };
}
function downloadJSON(obj, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

$("#btnPackExport").onclick = () => {
  const m = openModal("Export rules pack",
    '<p class="note">Zones and pricing rules travel; properties, clients and loans stay here.</p>' +
    '<div style="margin-top:10px"><span class="lab">What changed? (shown to whoever applies it)</span>' +
    '<input id="pk_note" placeholder="e.g. added Palomino Highlands, Del Perro up to 320k"></div>' +
    '<label class="row" style="gap:6px;margin-top:10px"><input type="checkbox" id="pk_policy" checked> ' +
    'Let each agency keep their own house rule numbers</label>',
    [{ label: "Cancel", run: closeModal },
     { label: "Export pack", kind: "primary", run: () => {
        const pack = buildPack($("#pk_note", m).value.trim());
        pack.keepLocalPolicy = $("#pk_policy", m).checked;
        S.packVersion = pack.version; S.packIssued = pack.issued; S.packNote = pack.note;
        save();
        downloadJSON(pack, "hug-rules-v" + pack.version + ".json");
        closeModal(); renderData(); toast("Pack v" + pack.version + " exported.");
      } }]);
};

function applyPackFile(pk) {
    const zoneCount = (pk.zones || []).length;
    const mine = {}; S.zones.forEach(z => { mine[z.id] = z; });
    const added = (pk.zones || []).filter(z => !mine[z.id]).length;
    const changed = (pk.zones || []).filter(z => mine[z.id] &&
      (mine[z.id].base !== z.base || mine[z.id].floor !== z.floor ||
       mine[z.id].ceiling !== z.ceiling || mine[z.id].name !== z.name)).length;
    const m = openModal("Apply rules pack v" + (pk.version || "?"),
      (pk.note ? '<div class="tip" style="margin-bottom:10px">' + esc(pk.note) + '</div>' : '') +
      '<p>' + zoneCount + ' zones in this pack — <strong>' + added + '</strong> new to you, <strong>' +
      changed + '</strong> with a different name or price.</p>' +
      '<p class="note" style="margin-top:9px">Issued ' + esc(pk.issued || "unknown") +
      '. Your properties, clients and loans are not touched.</p>' +
      ((pk.version || 0) <= (S.packVersion || 0)
        ? '<div class="warn" style="margin-top:10px">You already have v' + S.packVersion +
          '. Applying this rolls you back.</div>' : ''),
      [{ label: "Cancel", run: () => { closeModal(); $("#loadFile").value = ""; } },
       { label: "Apply", kind: "primary", run: () => {
          const byId = {}; S.zones.forEach(z => { byId[z.id] = z; });
          (pk.zones || []).forEach(z => {
            if (byId[z.id]) Object.assign(byId[z.id], z); else S.zones.push(clone(z));
          });
          if (pk.rules) {
            const policy = clone(S.rules.policy);
            S.rules = deepFill(clone(pk.rules), clone(DEFAULT_RULES));
            if (pk.keepLocalPolicy) S.rules.policy = policy;
            delete S.rules.policy.societyCommissionPct;
          }
          S.packVersion = pk.version || 0; S.packIssued = pk.issued || ""; S.packNote = pk.note || "";
          save(); closeModal(); renderAll(); $("#loadFile").value = "";
          toast("Rules pack v" + S.packVersion + " applied.");
        } }]);
}
/* ============================================================
   Map
   ============================================================ */
// Maps and the seal ship in img/ beside the page (see js/assets.js).
const MAP_FILES = {
  atlas: "GTAV_ATLUS_2048x2048.png",
  satellite: "GTAV_SATELLITE_2048x2048.png",
  road: "GTAV_ROADMAP_2048x2048.png"
};
function mapSource(layer) {
  if (layer === "custom" && S.customMap) return S.customMap;
  return (typeof EMBED !== "undefined" && EMBED[layer]) || MAP_FILES[layer] || MAP_FILES.atlas;
}
const MAP_PX = 2048;
const view = { x: 0, y: 0, k: 0.35 };
let editorOn = false, editorTool = null, selectedZone = null;

function applyLayer() {
  const layer = S.ui.layer || "atlas";
  const img = $("#mapImg");
  img.src = mapSource(layer);
  img.onerror = () => {
    $("#mapInfo").innerHTML = '<div class="warn"><strong>That map image will not load.</strong> ' +
      'Pick another layer, or load your own from the Data tab.</div>';
  };
  $$("#mapLayer button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.layer === layer)));
  $$("#mapMode button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === S.ui.mode)));
}
function minZoom() {
  const w = $("#mapWrap").clientWidth, h = $("#mapWrap").clientHeight;
  return Math.min(w, h) / MAP_PX;   // the whole map, no further
}
function clampView() {
  const w = $("#mapWrap").clientWidth, h = $("#mapWrap").clientHeight;
  const s = MAP_PX * view.k;
  view.x = s <= w ? (w - s) / 2 : Math.min(0, Math.max(w - s, view.x));
  view.y = s <= h ? (h - s) / 2 : Math.min(0, Math.max(h - s, view.y));
}
function applyTransform() {
  clampView();
  $("#mapCanvas").style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.k + ")";
  positionPins();
}

/* Pins are laid out in screen pixels from their map coordinates. Anything that
   falls outside the viewport is hidden rather than left to pile up off-screen. */
function positionPins() {
  const wrap = $("#mapWrap");
  const w = wrap.clientWidth, hh = wrap.clientHeight;
  const showTags = view.k > 0.28;
  $$("#mapPins .pin").forEach(el => {
    const mx = +el.dataset.mx, my = +el.dataset.my;
    const x = mx * view.k + view.x, y = my * view.k + view.y;
    const off = x < -60 || y < -40 || x > w + 60 || y > hh + 60;
    el.style.display = off ? "none" : "";
    if (off) return;
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
    el.classList.toggle("notag", !showTags);
  });
}
function fitMap() {
  const w = $("#mapWrap").clientWidth, h = $("#mapWrap").clientHeight;
  view.k = minZoom();
  view.x = (w - MAP_PX * view.k) / 2;
  view.y = (h - MAP_PX * view.k) / 2;
  applyTransform();
}
function zoomAt(cx, cy, factor) {
  const k2 = Math.max(minZoom(), Math.min(4, view.k * factor));
  const r = k2 / view.k;
  view.x = cx - (cx - view.x) * r;
  view.y = cy - (cy - view.y) * r;
  view.k = k2;
  applyTransform();
}
function priceColor(base) {
  const lo = 65000, hi = 500000;
  const t = Math.max(0, Math.min(1, (base - lo) / (hi - lo)));
  // low value reads green, high value gold, the dearest a deep amber
  const hue = 146 - 138 * t;
  const sat = 44 + 34 * t;
  const lit = 33 + 16 * t - (t > .8 ? 6 * (t - .8) * 5 : 0);
  return "hsl(" + hue + " " + sat + "% " + lit + "%)";
}
function statusColor(s) {
  return { Draft: "#8a929e", Listed: "#23824f", Auction: "#c79a12", "Under offer": "#4a3f8f",
           Sold: "#0a1f44", Repossessed: "#a12a1e" }[s] || "#8a929e";
}

function zoneStats(id) {
  const props = S.properties.filter(p => String(p.zone) === String(id));
  return { count: props.length, worth: props.reduce((s, p) => s + (p.list || 0), 0), props: props };
}

function drawPins() {
  const wrap = $("#mapPins");
  wrap.innerHTML = "";
  const mode = S.ui.mode;
  const frag = document.createDocumentFragment();

  const makePin = (cls, mx, my, colour, label, title, onClick) => {
    const el = document.createElement("div");
    el.className = "pin " + cls;
    el.dataset.mx = mx; el.dataset.my = my;
    el.innerHTML = '<div class="dot" style="background:' + colour + '"></div>' +
      (label ? '<div class="tag">' + esc(label) + '</div>' : '');
    el.title = title;
    el.onclick = ev => { ev.stopPropagation(); onClick(); };
    frag.appendChild(el);
    return el;
  };

  if (mode === "listings") {
    const byZone = {};
    S.properties.forEach(p => { (byZone[p.zone] = byZone[p.zone] || []).push(p); });
    Object.keys(byZone).forEach(zid => {
      const z = zoneById(zid); if (!z) return;
      const group = byZone[zid];
      group.forEach((p, i) => {
        const angle = (i / Math.max(1, group.length)) * Math.PI * 2;
        const radius = group.length === 1 ? 0 : 15 + Math.floor(i / 8) * 13;
        makePin("prop", z.x + Math.cos(angle) * radius, z.y + Math.sin(angle) * radius - 20,
          statusColor(p.status), p.address + " \u00b7 " + money(p.list),
          p.address + " \u2014 " + p.status, () => propertyModal(p.id));
      });
    });
  }

  S.zones.forEach(z => {
    const st = zoneStats(z.id);
    const colour = mode === "value" ? priceColor(z.base) : (z.unique ? "#c79a12" : "#13568c");
    const label = mode === "value"
      ? z.name + " \u00b7 " + money(z.floor || z.base) + "\u2013" + money(z.ceiling || z.base)
      : mode === "listings"
        ? z.name + (st.count ? " \u00b7 " + money(st.worth) : "")
        : z.name + (st.count ? " \u00b7 " + st.count : "");
    const el = makePin("zone" + (String(selectedZone) === String(z.id) ? " sel" : "") +
      (mode === "listings" ? " muted" : ""), z.x, z.y, colour, label,
      z.name + " \u2014 " + money(z.base) +
        (st.count ? " \u00b7 " + st.count + (st.count === 1 ? " property" : " properties") : ""),
      () => selectZone(z.id));
    if (editorOn && editorTool === "move") makeDraggable(el, z);
  });

  wrap.appendChild(frag);
  positionPins();
}

/* centre the view on a zone without changing the zoom */
function panToZone(id) {
  const z = zoneById(id); if (!z) return;
  const w = $("#mapWrap").clientWidth, hh = $("#mapWrap").clientHeight;
  if (view.k < 0.5) view.k = 0.5;
  view.x = w / 2 - z.x * view.k;
  view.y = hh / 2 - z.y * view.k;
  applyTransform();
  drawPins();
}

function makeDraggable(el, z) {
  el.style.cursor = "move";
  el.onpointerdown = ev => {
    ev.stopPropagation(); ev.preventDefault();
    el.setPointerCapture(ev.pointerId);
    const move = e => {
      const r = $("#mapWrap").getBoundingClientRect();
      z.x = Math.round((e.clientX - r.left - view.x) / view.k);
      z.y = Math.round((e.clientY - r.top - view.y) / view.k);
      el.dataset.mx = z.x; el.dataset.my = z.y;
      positionPins();
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      save(); renderRules(); toast(z.name + " moved to " + z.x + ", " + z.y + ".");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
}

function selectZone(id) {
  selectedZone = id;
  const z = zoneById(id);
  if (!z) { clearZone(); return; }
  const st = zoneStats(id);
  const P = S.rules.policy;
  const auctionNote = z.unique && P.auctionsEnabled && P.uniqueForcesAuction
    ? " \u00b7 unique, sold at auction" : (z.unique ? " \u00b7 unique property" : "");

  $("#mapInfo").hidden = false;
  $("#mapInfo").innerHTML =
    '<div class="row" style="align-items:flex-start"><h3 style="flex:1">' + esc(z.name) + '</h3>' +
    '<button class="btn sm icon" id="mapClose" title="Close" aria-label="Close">\u00d7</button></div>' +
    '<div class="zoneprice">' + money(z.base) + '</div>' +
    '<div class="note" style="margin-bottom:9px">Zone ' + z.id + auctionNote +
      (z.offshore ? " \u00b7 offshore" : "") + '</div>' +
    (MODE === "director" && (z.floor || z.ceiling)
      ? '<div class="band"><span>' + money(z.floor || 0) + '</span>' +
        '<div class="bandbar"><i></i></div><span>' + money(z.ceiling || 0) + '</span></div>' +
        '<div class="note" style="margin-bottom:9px">Floor and ceiling. Value beyond either still ' +
        'counts, at ' + P.boundGive + '%.</div>'
      : '') +
    (st.count
      ? '<div class="note" style="margin-bottom:5px">' + st.count +
        (st.count === 1 ? " property" : " properties") + ' \u00b7 ' + money(st.worth) + ' asking</div>' +
        '<table class="data"><tbody>' + st.props.map(p =>
          '<tr><td><button class="btn sm linkish" data-mp="' + p.id + '">' + esc(p.address) + '</button>' +
          '<div class="note">' + esc(p.status) + '</div></td>' +
          '<td class="num">' + money(p.list) + '</td></tr>').join("") + '</tbody></table>'
      : '<div class="note">No properties filed here.</div>') +
    '<div class="row" style="margin-top:10px">' +
      '<button class="btn sm" id="mapAppraise">Appraise here</button>' +
      (MODE === "director" ? '<button class="btn sm" id="mapZoneRules">Edit price</button>' : '') +
      (editorOn ? '<button class="btn sm" id="mapEditZone">Move or rename</button>' : '') +
    '</div>';

  $$("#mapInfo [data-mp]").forEach(b => b.onclick = () => propertyModal(b.dataset.mp));
  $("#mapClose").onclick = clearZone;
  $("#mapAppraise").onclick = () => {
    F = blankForm(); F.zone = z.id; editingPropId = null;
    showView("appraise"); renderAppraiseForm(); renderResult();
  };
  const zr = $("#mapZoneRules"); if (zr) zr.onclick = () => {
    showView("rules");
    const s = $("#zoneSearch"); if (s) { s.value = z.name; renderRules(); }
  };
  const ez = $("#mapEditZone"); if (ez) ez.onclick = () => zoneModal(z.id);
  drawPins();
}

function clearZone() {
  selectedZone = null;
  $("#mapInfo").hidden = true;
  $("#mapInfo").innerHTML = "";
  drawPins();
}

/* ---------- pan / zoom ---------- */
(function () {
  const wrap = $("#mapWrap");
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
  wrap.addEventListener("pointerdown", e => {
    if (e.target.closest(".map-hud") || e.target.closest(".pin")) return;
    if (editorOn && editorTool === "place") return;
    dragging = true; moved = false;
    sx = e.clientX; sy = e.clientY; ox = view.x; oy = view.y;
    wrap.classList.add("panning"); wrap.setPointerCapture(e.pointerId);
  });
  wrap.addEventListener("pointermove", e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3) moved = true;
    view.x = ox + (e.clientX - sx); view.y = oy + (e.clientY - sy);
    applyTransform();
  });
  wrap.addEventListener("pointerup", e => { dragging = false; wrap.classList.remove("panning"); });
  wrap.addEventListener("wheel", e => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.16 : 1 / 1.16);
    drawPins();
  }, { passive: false });
  wrap.addEventListener("click", e => {
    if (e.target.closest(".map-hud") || e.target.closest(".pin")) return;
    if (!editorOn && selectedZone && !moved) { clearZone(); return; }
    if (editorOn && editorTool === "place") {
      const r = wrap.getBoundingClientRect();
      newZoneAt(Math.round((e.clientX - r.left - view.x) / view.k),
                Math.round((e.clientY - r.top - view.y) / view.k));
    }
  });
  $("#zIn").onclick = () => { const r = wrap.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.3); drawPins(); };
  $("#zOut").onclick = () => { const r = wrap.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.3); drawPins(); };
  $("#zFit").onclick = () => { fitMap(); drawPins(); };
})();

function refreshZoneList() {
  const dl = $("#mapZoneList");
  if (dl) dl.innerHTML = S.zones.map(z => '<option value="' + esc(z.name) + '">').join("");
}
$("#mapJump").addEventListener("change", () => {
  const v = $("#mapJump").value.trim().toLowerCase();
  const z = S.zones.find(x => x.name.toLowerCase() === v) ||
            S.zones.find(x => x.name.toLowerCase().indexOf(v) === 0);
  if (!z) { if (v) toast("No zone by that name."); return; }
  $("#mapJump").value = "";
  panToZone(z.id); selectZone(z.id);
});

/* arrows pan, plus and minus zoom, escape clears the selection */
document.addEventListener("keydown", e => {
  if (!$("#view-map").classList.contains("on")) return;
  if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
  if ($("#scrim").classList.contains("on")) return;
  const step = 90;
  const w = $("#mapWrap").clientWidth, hh = $("#mapWrap").clientHeight;
  if (e.key === "ArrowLeft") { view.x += step; applyTransform(); }
  else if (e.key === "ArrowRight") { view.x -= step; applyTransform(); }
  else if (e.key === "ArrowUp") { view.y += step; applyTransform(); }
  else if (e.key === "ArrowDown") { view.y -= step; applyTransform(); }
  else if (e.key === "+" || e.key === "=") { zoomAt(w / 2, hh / 2, 1.3); drawPins(); }
  else if (e.key === "-" || e.key === "_") { zoomAt(w / 2, hh / 2, 1 / 1.3); drawPins(); }
  else if (e.key === "Escape" && selectedZone) { clearZone(); }
  else return;
  e.preventDefault();
});

$$("#mapLayer button").forEach(b => b.onclick = () => {
  if (b.dataset.layer === "custom" && !S.customMap) { toast("Load a custom map image from the Data tab first."); return; }
  S.ui.layer = b.dataset.layer; save(); applyLayer();
});
$$("#mapMode button").forEach(b => b.onclick = () => {
  S.ui.mode = b.dataset.mode; save(); applyLayer(); drawPins(); renderLegend();
});
function renderLegend() {
  const m = S.ui.mode;
  $("#mapLegend").innerHTML = m === "value"
    ? '<i style="background:' + priceColor(65000) + '"></i>cheapest &nbsp; <i style="background:' + priceColor(500000) + '"></i>dearest'
    : m === "listings"
      ? '<i style="background:#23824f"></i>listed <i style="background:#c79a12;margin-left:7px"></i>auction ' +
        '<i style="background:#0a1f44;margin-left:7px"></i>sold'
      : '<i style="background:#13568c"></i>zone <i style="background:#c79a12;margin-left:7px"></i>auction-only location';
}

/* ============================================================
   Zone editor — only switched on in the Director console (admin.html)
   ============================================================ */
$("#edPlace").onclick = () => {
  editorTool = "place"; $("#mapWrap").classList.add("placing");
  $("#edState").textContent = "Click the map to drop a new zone.";
  drawPins();
};
$("#edMove").onclick = () => {
  editorTool = "move"; $("#mapWrap").classList.remove("placing");
  $("#edState").textContent = "Drag any zone pin to reposition it.";
  drawPins();
};
function newZoneAt(x, y) {
  const nextId = S.zones.reduce((m, z) => Math.max(m, +z.id || 0), 0) + 1;
  zoneModal(null, { id: nextId, name: "", base: 100000, floor: 0, ceiling: 0, x, y, unique: false });
}
function zoneModal(id, draft) {
  const z = id ? zoneById(id) : draft;
  const m = openModal(id ? "Edit zone" : "New zone",
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Zone number</span><input id="z_id" type="number" value="' + z.id + '"' + (id ? " disabled" : "") + '></div>' +
      '<div><span class="lab">Base price ($)</span><input id="z_base" type="number" value="' + z.base + '"></div></div>' +
    '<div class="grid2" style="margin-bottom:10px">' +
      '<div><span class="lab">Modern floor ($)</span><input id="z_floor" type="number" min="0" value="' + (+z.floor || 0) + '"></div>' +
      '<div><span class="lab">Modern ceiling ($)</span><input id="z_ceiling" type="number" min="0" value="' + (+z.ceiling || 0) + '"></div></div>' +
    '<div style="margin-bottom:10px"><span class="lab">Name</span><input id="z_name" value="' + esc(z.name) + '" placeholder="e.g. Palomino Highlands"></div>' +
    '<label class="row" style="gap:6px"><input type="checkbox" id="z_uniq"' + (z.unique ? " checked" : "") +
      '> Unique location — always sold at auction</label>' +
    '<p class="note" style="margin-top:9px">Dropped at ' + z.x + ", " + z.y + " on the map. Drag it later with the move tool.</p>",
    [{ label: "Cancel", run: closeModal },
     { label: id ? "Save zone" : "Create zone", kind: "primary", run: () => {
        const name = $("#z_name", m).value.trim();
        if (!name) { toast("Give the zone a name."); return; }
        const floor = +$("#z_floor", m).value || 0, ceiling = +$("#z_ceiling", m).value || 0;
        if (floor && ceiling && floor > ceiling) { toast("The floor cannot be higher than the ceiling."); return; }
        const rec = { id: id || +$("#z_id", m).value, name, base: +$("#z_base", m).value || 0,
          floor, ceiling,
          x: z.x, y: z.y, unique: $("#z_uniq", m).checked };
        if (id) Object.assign(zoneById(id), rec);
        else {
          if (zoneById(rec.id)) { toast("Zone " + rec.id + " already exists."); return; }
          S.zones.push(rec);
        }
                save(); closeModal(); renderAll(); selectZone(rec.id); toast(id ? "Zone saved." : "Zone " + rec.id + " created.");
      } }]);
}

/* ============================================================
   Navigation and boot
   ============================================================ */
let mapFitted = false;
function showView(name) {
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "view-" + name));
  $$("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === name)));
  if (name === "map") { requestAnimationFrame(() => {
    // first visit always fits the whole map; after that keep where the user left it
    if (!mapFitted || view.k <= minZoom() * 1.001) { fitMap(); mapFitted = true; } else applyTransform();
    drawPins(); renderLegend(); }); }
}
$$("nav.tabs button").forEach(b => b.onclick = () => showView(b.dataset.view));

/* On phones the tables become cards, so each cell needs its column name. */
function stampTables() {
  $$("table.data").forEach(t => {
    const heads = $$("thead th", t).map(th => th.textContent.trim());
    if (!heads.length) return;
    $$("tbody tr", t).forEach(tr => {
      $$("td", tr).forEach((td, i) => {
        if (heads[i]) td.setAttribute("data-l", heads[i]); else td.removeAttribute("data-l");
      });
    });
  });
}

function renderAll() {
  renderAppraiseForm(); renderResult();
  renderPortfolio(); renderClients(); renderLoans();
  renderRules(); renderWarehouses(); renderData(); applyLayer(); drawPins(); renderLegend(); refreshZoneList(); stampTables();
}

window.addEventListener("resize", () => { if ($("#view-map").classList.contains("on")) { fitMap(); drawPins(); } });

/* ------------------------------------------------------------
   Published rules. The Regional Director writes rules.json from
   admin.html; agencies load it on every visit and apply it when it
   is newer than what this browser already has.
   ------------------------------------------------------------ */
const MODE = document.body.dataset.mode === "director" ? "director" : "agency";
let PUBLISHED = null;

async function fetchPublishedRules() {
  try {
    const r = await fetch("rules.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return null;
    const pk = await r.json();
    return pk && pk.version ? pk : null;
  } catch (e) { return null; }
}
async function loadPublishedRules() {
  const pk = await fetchPublishedRules();
  PUBLISHED = pk;
  if (!pk) return null;
  const changes = applyOfficePack(S, pk);
  if (changes) { save(); renderAll(); }
  return pk;
}

/* Agencies read the Department's zones, rules and warehouse prices but
   do not change them; searching and filtering still work. */
const READ_ONLY_KEEP = new Set(["zoneSearch", "modSearch", "modGroupFilter"]);
function lockAgencyControls() {
  $$("#view-rules input, #view-rules select, #view-rules textarea, #view-rules button.danger, #btnAddMod, #btnResetMods").forEach(el => {
    if (READ_ONLY_KEEP.has(el.id) || el.disabled) return;
    el.disabled = true;
  });
  $$("#whTable [data-whp]").forEach(el => { if (!el.disabled) el.disabled = true; });
}
if (MODE === "agency") {
  const mo = new MutationObserver(lockAgencyControls);
  ["view-rules", "whTable"].forEach(id => { const el = document.getElementById(id); if (el) mo.observe(el, { childList: true, subtree: true }); });
}

refreshZoneList();
renderAll();
if (MODE === "agency") lockAgencyControls();
if (typeof packApplied !== "undefined" && packApplied)
  toast("House rules updated \u2014 " + packApplied + ".");
if (!Store.ok) toast("This browser is not saving data. Private browsing can cause this.");
if (MODE === "agency") loadPublishedRules();
