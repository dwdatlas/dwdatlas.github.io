# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A static web app (GitHub Pages) for **Dulag West District, Division of Leyte** — a MOOE monitoring dashboard used by the district bookkeeper (admin) and 14 school principals. No build step. No framework. Deployed by pushing to `main`; GitHub Pages serves `index.html` directly.

Live URL: `https://joannmarie.github.io/joannmarie/`

## How to develop and deploy

Open `index.html` in a browser locally (or use VS Code Live Server). There is no build, compile, or install step.

To deploy: commit and push to `main`. GitHub Pages auto-publishes.

## Script load order (critical)

`index.html` loads scripts in this exact order — order matters because each file depends on globals from the previous:

```
js/users-data.js → js/auth.js → js/config.js → js/db.js
→ js/views/dashboard.js → js/views/mooe.js → js/views/cdr.js
→ js/views/funds.js → js/views/resources.js → js/views/schools.js
→ js/views/setup.js → js/app.js
```

## Architecture

### Storage
- **Primary DB**: `localStorage` with key prefix `dwd_` (e.g., `dwd_funds`, `dwd_schools`, `dwd_users`).
- **Optional cloud sync**: Supabase (configured at runtime via Setup page; credentials stored in `localStorage` as `sb_url` / `sb_key`). All `DB.*` methods fall back to localStorage when Supabase is not configured.
- **Session**: `sessionStorage` key `dwd_session` — clears when the browser tab closes.

### Auth (`js/auth.js`)
Two roles: `admin` (full access, all schools) and `school` (read-only access to their own school). Passwords are stored as a simple integer hash (`Auth._hash()`). The canonical user list is committed in `js/users-data.js` so all devices share accounts without Supabase. If `dwd_users` exists in localStorage it takes priority over `users-data.js`.

To add a school account: use Setup → School Accounts in the UI, then export and commit the updated `users-data.js`.

### DB layer (`js/db.js`)
Single `DB` object returned from an IIFE. Every method is `async` and returns `{ data, error }`. localStorage table names (without the `dwd_` prefix):

| Table | Purpose |
|---|---|
| `schools` | 14 school records (id, name, school_head, etc.) |
| `funds` | Downloaded fund records per school (ADA-based) |
| `disbursements` | MOOE disbursement entries |
| `cdr_headers` | CDR (Appendix 43) header per school/year |
| `cdr_entries` | Individual CDR line items |
| `resources` | Links/documents in the Resources view |
| `bank_recon` | Bank reconciliation records |

### Views (`js/views/*.js`)
Each view is a plain object with `render()` (returns HTML string) and optionally `afterRender()` (wires up events). `App.navigate(viewName)` sets `innerHTML` then calls `afterRender()`. Views registered in `js/app.js` under `App.views`.

- **`dashboard.js`** — Fund Monitor: per-school liquidation status table. Admin sees a school dropdown; school users auto-load their own school. Admin can toggle `liquidated` / `unliquidated` status per row.
- **`funds.js`** — Fund record CRUD + `seedDefaults()` which loads the hardcoded seed array into `dwd_funds`.
- **`cdr.js`** — Cash Disbursement Register (Appendix 43). Has `downloadExcel(id)` (ExcelJS) and `printCDR(id)` (popup window). `window.open()` must be called synchronously before any `await` to avoid popup blockers.
- **`mooe.js`** — MOOE disbursement tracking.
- **`schools.js`** — School profile management (school head, designation, etc.).
- **`setup.js`** — Supabase config, user management, data export, schema SQL.

### Global helpers (defined at bottom of `dashboard.js`)
`statCard()`, `fmt()`, `formatDate()`, `statusBadge()`, `schoolName()`, `emptyState()` — used across multiple view files. They must remain in `dashboard.js` and load before other views.

### Config (`js/config.js`)
Central constants: `FUND_TYPES`, `STATUSES`, `BANKS`, `UACS_CODES`, `RESOURCE_CATEGORIES`, bookkeeper name/title. Edit here when fund type names or UACS codes change.

## Fund status values

Only two valid status strings across the entire app: `"liquidated"` and `"unliquidated"`. Do not reintroduce `"pending"` or `"submitted_to_sou"` — they were removed.

## School IDs (fixed — do not change)

```
s_alegre, s_arado, s_batug, s_cabacungan, s_cabarasan, s_cabatoan,
s_calipayan, s_delcarmen, s_genroxas, s_mhdelpilar, s_maricum,
s_rawis, s_sanantonio, s_tabu
```

## CSS

Single stylesheet at `css/style.css` using Tailwind (CDN) plus custom utility classes: `section-card`, `section-card-header`, `section-card-body`, `data-table`, `table-scroll`, `form-input`, `form-select`, `form-label`, `btn`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-sm`, `badge`, `badge-liquidated`, `badge-missing`, `badge-submitted`, `badge-pending`, `stat-card`, `page-header`, `nav-link`, `empty-state`, `spinner`.

## External CDN dependencies (no npm)

```
tailwindcss, @supabase/supabase-js@2, chart.js, xlsx (SheetJS), exceljs
```
