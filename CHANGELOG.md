# Changelog

## v0.1.0 (Initial Release)
- Offline-first Docker Compose stack (FastAPI + PostgreSQL + Nginx).
- DB schema with subjects config, trials, results (normalized), workbooks, audit, sessions.
- Seed data (≥5 students, trials, results, workbooks, teachers).
- Auth with server sessions, Argon2id hashing, CSRF tokens.
- Teacher scope enforcement.
- CSV import for students with rejects report.
- React+Vite frontend with tr-TR default, i18n scaffolding, basic screens.
- API + UI tests scaffolding.
