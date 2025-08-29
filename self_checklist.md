# Self-Checklist

- [ ] `database.sql` creates cleanly on Postgres 15; FKs & indexes present.
- [ ] `subjects_config` includes aliases and per-grade maxima.
- [ ] Seed data: ≥5 students, ≥1 teacher, ≥2 trials, ≥1 result, ≥3 workbooks.
- [ ] `openapi.yaml` passes lint; names/fields consistent with schema.
- [ ] RBAC matrix aligns with `backend/app/rbac.py` guards.
- [ ] Forms validate on client and server; API returns structured errors.
- [ ] CSRF enforced on state mutations; session cookies are HttpOnly.
- [ ] `docker compose up` brings all services healthy offline.
- [ ] Argon2id hashing configured; secrets via `.env`.
- [ ] Istanbul timezone handled consistently.
- [ ] Import templates provided; student import tested.
