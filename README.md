# LGS Tracker — Starter Kit (On‑Prem, Offline)

**Version:** v0.1.0 • **Build date:** 2025-08-28 • **Timezone:** Europe/Istanbul

This repository is a production‑ready starter kit for an **on‑premise, intranet‑only** LGS (Liselere Geçiş Sınavı) tracking system for a school in Türkiye. It is designed to run **entirely offline** on the school LAN, with a single shared PostgreSQL database. The default UI language is **Turkish** (tr‑TR), and the code is structured to be i18n‑ready. No cloud dependencies.

## Highlights
- Offline‑first architecture; no external calls.
- PostgreSQL with strict schema, FKs, and indexes.
- FastAPI backend with server‑side **session auth** and **Argon2id** password hashing.
- React + Vite frontend with Turkish strings and i18n scaffolding.
- RBAC: **Rooter (Superuser)** & **Teacher**.
- Trial exam entry with **net score** (= `correct − wrong × penalty_factor`).
- Workbook assignment & progress tracking.
- Full **audit log** with before/after snapshots.
- Docker Compose packaging for single host.
- CSV **bulk import** for students (templates included; extendable to others).

## Assumptions
- LAN‑only deployment. No internet egress.
- Local timezone: **Europe/Istanbul**. Timestamps stored as UTC in DB, rendered in local time on clients.
- School grades covered: **5–8**. Sections like `8/A` managed via `class_section` table.
- Subjects are configurable via `subjects_config` (default set included). English aliases are provided in `validation_rules.md`.
- Scale target: up to ~1,500 students and ~100 teachers.
- KVKK: data minimization, auditability, no third‑party processors, no cloud.

## Quickstart
```bash
# 1) Prepare environment variables (do NOT commit secrets)
cp .env.example .env
# Edit .env as needed

# 2) Build & run offline
docker compose up -d --build

# 3) Initialize DB schema & seed
# The backend container runs migrations/seed at startup.
# Or manually:
docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -f /seed/database.sql

# 4) Access
# Frontend (Nginx): http://localhost:8080
# Backend (FastAPI): http://localhost:8000 (docs at /docs when enabled)
# Adminer: http://localhost:8081
```

### Default credentials (for demo use only; change immediately)
- **Rooter:** `rooter@example.edu.tr` / `ChangeMe!123`
- **Teacher:** `teacher1@example.edu.tr` / `ChangeMe!123`
> On first login, teachers are forced to change their password. Events are audited.

## Operations Runbook (Offline)
- **Backups:** See `backup_restore.md` for `pg_dump`/`pg_restore` and rotation.
- **Logs:** Backend emits JSON logs to stdout; use Docker logging. Audit logs live in `audit_log` with query patterns in `audit_model.md`.
- **User mgmt:** Rooter creates/disables accounts and resets temporary passwords in the **Manage Teachers** UI.
- **Bulk import:** In the Rooter UI, use **CSV İçe Aktar** on Students; a rejects CSV is returned with reasons.

## Directory Structure
```
lgs-tracker-starter/
  backend/                # FastAPI app, session auth, RBAC, audit, CSV import
  frontend/               # React + Vite app with tr-TR default and i18n scaffolding
  import_templates/       # CSV templates
  tests/                  # API contract & UI e2e scaffolding
  database.sql            # Authoritative schema + seeds (also copied into backend image)
  openapi.yaml            # REST API contract
  docker-compose.yml      # Services: app, db, nginx(frontend), adminer
  README.md
```
Additional docs:
- `architecture.md` – components, requests, **RBAC matrix**.
- `rbac_policy.md`, `audit_model.md`, `validation_rules.md`.
- `SECURITY.md` – password policy, sessions, CSRF, headers, rate limits.
- `backup_restore.md` – backup/DR.
- `ui-wireframes.md` – teacher & rooter flows (Mermaid).
- `queries.sql` – handy reporting queries.

## Reasonable Design Choices
- **Server sessions vs JWT:** On a trusted LAN, server‑side sessions (DB‑backed) reduce token leakage risk and enable central invalidation. Cookies are `HttpOnly`, `SameSite=Lax`. TLS is recommended even on LAN.
- **Argon2id:** Chosen for strong memory‑hard hashing. Fallback to bcrypt if needed.
- **Trial results modeling:** Normalized `trial_result` + `trial_result_subject` with computed totals for performance. Audited updates; finalized exams are read‑only unless Rooter override.
- **CSRF:** Double‑submit cookie with per‑session token + header `X-CSRF-Token`.
- **I18n:** Keys in code; default `tr-TR.json` and sample `en-US.json` included.

## Extensibility
- Add CSV import for other entities by following `backend/app/routers/import.py` patterns.
- Add charts using lightweight libs; starter includes simple sparkline.
- Add RLS at DB level if desired; app-level scope checks already implemented.

---

© 2025 — Released under the MIT license. For internal school use only. (Review KVKK obligations before production.)
