# Security

## Passwords
- Hash: **Argon2id** (`t=3, m=64MB, p=2`) via passlib.
- Min length **10**; require number, uppercase, and symbol (configurable via env).
- Teachers created with **temporary passwords** must change on first login; event audited.

## Sessions
- Server-side DB sessions table; cookie `HttpOnly`, `SameSite=Lax`.
- CSRF via double-submit cookie (`X-CSRF-Token` required on state mutations).
- Session TTL default 30 days; rotated on login. Logout invalidates record.
- Optional IP pinning; last IP and UA recorded for audit.

## Headers
- `Content-Security-Policy`: default-src 'self'; frame-ancestors 'none'; object-src 'none'.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Cross-Origin-Resource-Policy: same-origin`

## Rate Limiting & Lockouts
- `/auth/*` limited per IP per minute; exponential backoff after repeated failures.
- Account lock after N failed attempts (configurable), auto-unlock with backoff or Rooter reset.

## KVKK Notes
- Data minimization: only required PII stored. No analytics, no trackers.
- Auditability: all teacher actions stored with timestamp and diff.
- Data residency: on‑prem. No cloud processors.
- Right to rectification: edits audited; deleted records soft-delete by status where appropriate.

