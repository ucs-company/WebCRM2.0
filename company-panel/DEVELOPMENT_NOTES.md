# WebCRM2.0 — Strapi CMS Panel — Handoff Notes

## What this project is

A Strapi 5 admin panel (one shared panel at `http://localhost:1337/admin`) for managing **multiple NGO websites** with role-based isolation:

- **Master Admin** (Super Admin): sees and manages everything.
- **Website Admin** role: each admin owns assigned NGOs and can **only see/edit their own websites' content** (strict isolation between admins).

Hierarchy: **Website** → **Page** → **Section**
Each Website Admin owns 2 NGOs (A→NGO-1/2, B→NGO-3/4, C→NGO-5/6).

## How to run it

```bash
cd "C:\Users\Sohan Khedekar\OneDrive\Desktop\webcrm\WebCRM2.0\company-panel"
npm run dev
```

- Takes ~30–60s to boot (first cold build ~3–4 min).
- Admin panel: `http://localhost:1337/admin`
- Runs against remote **Supabase PostgreSQL** (see `.env`).
- Stop: `Ctrl+C`. If a hidden background copy is stuck on port 1337, find the PID with
  `netstat -ano | findstr 1337` then `taskkill /PID <pid> /T /F`.

## Important facts learned (do not repeat mistakes)

1. **Supabase direct host is IPv6-only** — this PC has no IPv6. You MUST use the **Session pooler** host (`*.pooler.supabase.com`), not `db.<ref>.supabase.co`.
2. **Password contains `@`** → must stay URL-encoded as `%40` inside `DATABASE_URL`.
3. **SSL** needs `DATABASE_SSL=true` and `DATABASE_SSL_REJECT_UNAUTHORIZED=false` (self-signed chain). Dev-only; add proper CA for production.
4. **`npm i` works** now (better-sqlite3 comes as a prebuilt binary; no Python needed). Don't delete `node_modules` over this.
5. The **dev watcher auto-reloads `src/` changes but does NOT re-run `bootstrap()`** after reload. Anything in `src/index.ts` bootstrap (the seed) only runs on a **true fresh `npm run dev`**.

## Data model (content types in `src/api/`)

| Content type | File | Fields |
|---|---|---|
| `website` | `src/api/website/.../schema.json` | name, slug (UID), domain, logo (media), `admins` (manyToMany → `admin::user`), `pages` (oneToMany → page) |
| `page` | `src/api/page/.../schema.json` | title, slug, order, isHome, `website` (manyToOne), `sections` (oneToMany) |
| `section` | `src/api/section/.../schema.json` | type (enum: hero/text/image_text/gallery/stats/contact), heading, subheading, text (richtext), images (media, multiple), order, `page` (manyToOne) |

## TARGET ARCHITECTURE — per-website table (desired, NOT yet implemented)

> This is the user's intended end-goal design. The current schema (website → page → section) is the foundation; the below describes how it should evolve.

**Flow:** Master creates Website Admins → each Website Admin owns multiple websites → **each website gets its OWN table in the database**.

Rules:
1. **One table per website** — when a new website (e.g. NGO-7) is created for an admin, a new table is **auto-created** in the DB (e.g. `website__ngo_7`).
2. **Auto table creation** — no manual DDL. Creating a Website record must automatically create its dedicated table.
3. **Columns = website UI sections** — the table's columns/keys are managed **directly**:
   - When a **section is added** in the website's UI → a **column/key is added** to that website's table.
   - When a **section is removed** → the **column/key is dropped**.
   - The columns are editable as per the website's UI section list.
4. **Isolation stays** — each table is bound to exactly one website, so admins only ever touch their own website's table. RBAC conditions (below) keep the panel restricted to assigned websites.

Implementation note (future work): this dynamic table-per-website layer can be built on top of the current content types — a `website` row stores the website meta + an auto-created dynamic table name; a **lifecycle hook** on `website` create/delete (and on section add/remove) runs `CREATE TABLE` / `ALTER TABLE ADD/DROP COLUMN` against Supabase. The per-website table is then used directly for content edits.

## RBAC isolation (already implemented in `src/index.ts`)

Custom conditions registered at bootstrap:

- `admin::website-assigned-to-admin` → filters websites where `admins.id` includes current user.
- `admin::page-belongs-to-assigned-website` → page whose `website.admins` includes user.
- `admin::section-belongs-to-assigned-website` → section via `page.website.admins`.

These are attached to the **Website Admin** role's content-manager permissions. So a Website Admin only ever sees assigned NGOs and their pages/sections in the panel.

## Seed script (`src/seed.ts`)

Idempotent script that:
1. Creates/finds the **Website Admin** role.
2. Creates admin users `admina@ / adminb@ / adminc@ngosites.in` (password `Ngo@123456`).
3. Creates websites NGO-1..NGO-6 and assigns admins (A→1,2; B→3,4; C→5,6).
4. Creates demo "Home" page + 4 sections (hero/stats/gallery/contact) for NGO-1.
5. Assigns scoped CM permissions + upload permissions to Website Admin role.

**How to run it:** add `SEED_STRUCTURE=true` to `.env` (Strapi loads `.env` via dotenv), start fresh `npm run dev`, wait for log `[seed] Structure seed completed.` and `Strapi started successfully`, then **remove `SEED_STRUCTURE=true` from `.env`** and restart.

## CURRENT STATUS (as of last session)

- Content types + RBAC conditions + seed script are written.
- DB connectivity to Supabase verified (PostgreSQL 17.6).
- **The seed has NOT been confirmed to run yet.** Last attempt: server was started with `SEED_STRUCTURE=true` in `.env`, but the background launch got interrupted (`^C^C Terminate batch job`) and a foreground run was cut short by a timeout. The `.env` file **still contains `SEED_STRUCTURE=true`** (added near the bottom).
- No server is currently running.

### ⚡ TODO for tomorrow (in order)

1. Remove nothing yet — keep `SEED_STRUCTURE=true` in `.env`.
2. Start fresh: `npm run dev` (foreground, give it 2+ minutes). Watch for `[seed] ...` logs and `Strapi started successfully`.
3. If seed ran, **remove `SEED_STRUCTURE=true`** from `.env`, then restart normally.
4. If seed errored, read the error in the terminal and fix `src/seed.ts` (or `src/index.ts`), then retry.
5. Verify isolation in the browser:
   - Login Master: `khedekarsohan10@gmail.com` → should see all 6 websites + pages/sections.
   - Login `admina@ngosites.in` / `Ngo@123456` → should see **only NGO-1 & NGO-2** and their pages/sections. Confirm NGO-3..6 are invisible and that editing/creating sections works only inside NGO-1/2.
6. Note: if CM relations/conditions behave oddly in edit views, the handler form may need adjustment to dotted notation like `{ "website.admins.id": { $in: [user.id] } }` (known Strapi GitHub issue #17622).
7. **Build the per-website dynamic table layer** (see "TARGET ARCHITECTURE" above): auto-create a dedicated table per website + auto add/drop columns when website UI sections are added/removed (lifecycle hooks on website/section, executed against Supabase).
8. Production cleanup: provide proper CA cert instead of `DATABASE_SSL_REJECT_UNAUTHORIZED=false`; stop leaving env toggles in `.env`.

## Credentials (dev only)

- Master Admin: `khedekarsohan10@gmail.com` (existing Super Admin).
- Seed admins: `admina@ngosites.in`, `adminb@ngosites.in`, `adminc@ngosites.in` — password `Ngo@123456`, role "Website Admin".
- DB: in `.env` (Supabase Session pooler).

## Key files

- `.env` — DB + secrets (contains `SEED_STRUCTURE=true`; remove after successful seed).
- `src/index.ts` — bootstrap: registers RBAC conditions + runs seed when `SEED_STRUCTURE=true`.
- `src/seed.ts` — seed script (not yet verified run).
- `src/api/website|page|section/content-types/*/schema.json` — content types.
- `strapi-dev.log` — previous server output.
