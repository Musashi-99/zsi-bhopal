# AranyaValue — Government Officer Portal: Audit + Plan

## 1. Audit summary (what already exists)

| Area | Finding | Decision |
|---|---|---|
| Stack | Node 22 + Express + `node:sqlite` (`backend/`), React 19 + Vite + react-router 7 (`frontend/`) | Keep. No new deps. |
| Auth | scrypt hash + HMAC token in httpOnly cookie (`services/auth.js`, `middleware/auth.js`). `requireAuth`, `requireRole(...)` exist. | Reuse. |
| Roles | `users.role` CHECK: `collector, centre, buyer, inspector, admin` | **Officer = existing `inspector` role** (no CHECK migration). Add `officer_profiles` for level/jurisdiction. Admin creates officers (`POST /api/admin/users`). |
| Batches | `batches.status`: `draft, pending_verification, needs_info, rejected, failed_checks, verified, verified_with_limitations, dispatched` | Reuse. Map: pending=`pending_verification`; approved=`verified*`; rejected=`rejected,failed_checks`; correction=`needs_info`. |
| Review records | `verifications`, `rejections`, `measurements.evidence_source`, `evidence` | Reuse, extend. |
| Audit | `batch_events` hash chain, append-only triggers, `verifyChain()` | Reuse as tamper-evident audit. Add non-batch events (scheme, role change) via new `audit_events` table that also feeds the chain interface. |
| Notifications | none | Add `notifications` table + API. |
| Schemes | `schemes` table, public read; admin POST/PATCH | Extend: `status, publish_at, expires_at, updated_at, updated_by`; add officer CRUD. |
| Gaps / risks | `OPEN_LOGIN` in `routes/auth.js`: non-production accepts **any** password and auto-creates collectors. `PATCH /batches/:id` lets admin edit verified records. Legacy `honeychain` files remain. | Officer accounts must always verify password (even in dev). Fix in Phase 1. Quality edits after approval → new version (Phase 3). |
| Design | Forest `#173f2b`, leaf `#2f6b4f`, sage `#a7b88a`, paper `#f3efe4`, card `#fffdf8`, clay `#b5522a`, line `#e2d9c8`; Fraunces (headings) + Outfit (body); pill buttons, `.stamp` badges, `.card/.panel`. Mobile-first, 240px forest sidebar ≥960px. | Officer portal keeps tokens; adds desktop-first dense layout (`officer.css`), restrained gold `#b08a3e` accent. |

## 2. Architecture

- One DB, one backend, one auth. Officer API namespace `/api/officer/*`, every route behind `requireAuth + requireRole('inspector','admin')`.
- Frontend: `/officer/*` routes under `Guard roles=['inspector','admin']`, own `OfficerLayout` (sidebar, topbar, jurisdiction chip).
- Login: three entry tabs (Collector / Buyer / Government Officer). Tab is **presentation only**. Server returns real role, client redirects via `homeFor(role)`. Tab/role mismatch → logout + error.
- Jurisdiction scoping: `officer_profiles(user_id, level: state|district, state_id, district_id)`. Queries filter by jurisdiction; admin sees all.

## 3. Phases

**Phase 1 — Shell + Overview (this slice)**
- `GET /api/officer/overview` (real DB aggregates, demo-data flagged).
- `OfficerLayout`, `OfficerOverview` (stat tiles, status funnel, district bars, product bars, quantity by unit, recent activity from hash chain).
- Login 3-way portal switch, `homeFor('inspector') → /officer/overview`.
- Placeholder routes for remaining nav entries (honest "not built yet").
- Doc (this file).

**Phase 2 — Batch Verification** (core)
- `GET /api/officer/batches` filters: state, district, block, centre, product, date, status.
- `GET /api/officer/batches/:id` full detail (collector, evidence, measurements w/ evidence_source, history, buyer requirements, QR).
- `POST .../approve | reject | request-correction` → writes `verifications`/`rejections`, status update, `appendEvent`, notification. Reject/correction require reason.
- Migration: `batch_revisions` (snapshot per resubmission); resubmit hook in `/submit`.
- Collector sees status + reason in dashboard; QR page already reads `batches.status`.

**Phase 3 — Quality Inspection**
- Officer measurement entry with `evidence_source` split: self_reported / AI-assisted / instrument / laboratory / officer-reviewed. Add `ai_assisted` + `laboratory` sources via migration (rebuild `measurements` CHECK).
- Quality profiles per product/standard (already table-driven). Approved records immutable → new version row.
- Wording guard: "Officer-reviewed", never "statutory certification".

**Phase 4 — Centres, Collectors, Buyers/Market**
- Read-only monitoring views over `centres`, `inventory`, `users(role=collector)`, `offers/orders/enquiries`. Minimised PII (name, district, activity; phone/email hidden unless admin).
- Duplicate/suspicious flags: same collector + product + date + qty; qty outliers vs. district median.

**Phase 5 — Schemes, Reports, Audit, Officer Mgmt, Settings**
- Scheme CRUD with publish/expiry → public `/schemes` filters `status='published' AND window`.
- Reports: CSV export endpoints (district, product, verification performance, rejection reasons).
- Audit page: `batch_events` + `audit_events` + `verifyChain()` status. Disclaimer: chain proves tamper-evidence, not truth of inputs.
- Officer management (admin only): create/approve/deactivate, role-change audit.
- `notifications` table, bell + list for both portals; rate-limit login (in-memory).

## 4. Security checklist
- Server role check on every officer route; 403 for collector/buyer/centre.
- Officer login never uses `OPEN_LOGIN` path.
- No password/hash in any response (`publicUser` already filters).
- Evidence files served only via authenticated route (`/evidence-file` currently stubbed 404).
- Status transitions through one function (state machine) — no direct status PATCH.
- Approved quality record: no UPDATE; insert new version.

## 5. Acceptance tests (map to brief §17)
1–3 role redirects; 4 collector → `/api/officer/*` = 403; 5 submit → appears in queue; 6 approve → collector status; 7 reject reason visible; 8 correction → resubmit; 9 QR current status; 10 scheme publish visible; 11 audit chain intact; 12 regression (`npm test`).

## 6. Data honesty rules
Every stat from SQL. Rows with `is_demo=1` counted separately and labelled "demonstration data". No invented government figures.

## 7. Status (built)

All 11 officer modules are implemented against the shared database. Routes: /officer/{overview,verification,verification/:id,quality,quality/:id,centres,centres/:id,collectors,collectors/:id,market,schemes,reports,audit,officers,settings}.

API (all under /api/officer, guarded by requireAuth + requireRole('inspector','admin'); /officers is admin-only): overview, meta, batches, batches/:id, batches/:id/{approve,reject,request-correction,quality,inspections}, quality/{standards,queue}, centres, centres/:id (GET, PATCH), collectors, collectors/:id, market, schemes (GET, POST, PATCH), reports, reports/:id (?format=csv), audit, officers (GET, POST, PATCH), settings, settings/password. Shared: /api/notifications.

New tables: notifications, batch_revisions, correction_requests, inspection_records (append-only), audit_events (append-only), officer_profiles. New columns: schemes (status, publish_at, expires_at, application_steps, districts_json, updated_at, updated_by), centres (status, block_name, linked_groups, updated_at).

Known gaps: no API rate limiting yet; jurisdiction scoping is not applied to the Overview totals; evidence upload from the officer side is not built (officers reference collector evidence); no automated tests for the officer routes.
