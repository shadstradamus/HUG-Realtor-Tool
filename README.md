# San Andreas MLS — Department of Housing and Urban Gentrification

The Multiple Listing Service run by HUG for every licensed real estate agency in San Andreas, plus the Regional Director console that sets the rules agencies work by.

- **Agency MLS:** https://shadstradamus.github.io/HUG-Realtor-Tool/
- **Director console:** https://shadstradamus.github.io/HUG-Realtor-Tool/admin.html

## How it fits together

| Piece | Who uses it | What it does |
| --- | --- | --- |
| `index.html` | Agencies | Listings, map, appraisals, warehouses, financing (when the director has it on) and clients. Agents see values and asking prices only, never the zones, multipliers or house rules behind them. |
| `admin.html` | HUG Regional Director | Same tool with the zone editor on. Edits stay a draft until **Publish to all agencies**. |
| `rules.json` | Written by the director console | Zones, price bands, multipliers, house rules and warehouse prices. Every agency loads it when they open the site. |

Agency records (properties, clients, pictures) stay in each agency's own browser. Nothing is sent to HUG. Backups and the Records tab are director-only.

## Giving the director a key

The director signs in with a key made from the site owner's GitHub account. They do not need a GitHub account of their own.

1. On GitHub, go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name it something like `HUG Director` and pick an expiration.
3. Under **Repository access**, choose **Only select repositories** and pick **HUG-Realtor-Tool**.
4. Under **Permissions → Repository permissions**, set **Contents** to **Read and write**. Leave everything else alone.
5. Generate it, copy it, and send it to the director privately. They paste it into `admin.html`.

To cut off access, delete the token on the same page and make a new one.

## Shared listings (Supabase)

Saved properties can be shared with every agency through a free Supabase project. With it off, everything stays in each browser as before.

1. In Supabase, turn on **Authentication → Sign In / Providers → Allow anonymous sign-ins**.
2. Run `supabase/setup.sql` in the SQL Editor.
3. Put the **Project URL** and the **anon public** key in `js/shared-config.js` and push. Never put the `service_role` key in the site.
4. To let the director remove anyone's listing, open **Records** in the director console and run the line it shows in the SQL Editor.

Each realtor gets a realtor ID worked out from their in-character name (initials plus four digits, e.g. HUG-RR-0192), shown next to their name and in the Realtor directory under All agencies. Each browser also gets a hidden ID the first time it saves, and the database only lets that ID change or remove its own listings. Realtor names are what people type in, so they aren't verified. Clients, loans and photo files never leave the browser; photo links are shared.

## Layout

When you change anything in `css/` or `js/`, bump the `?v=` number on the links at the bottom of `index.html` and `admin.html` (same number in both). Browsers keep the old files otherwise.

```
index.html      agency MLS
admin.html      director console
rules.json      published rules (created by the first publish)
js/shared.js    shared listings and realtor names
js/shared-config.js  Supabase URL and public key
supabase/       database setup
css/hug.css     Capitol Navy theme
js/app.js       the tool
js/director.js  sign-in, draft tracking, publishing, history
js/assets.js    paths to built-in pictures
img/            seal, maps, warehouse photos
```

---
N92 Development Works
