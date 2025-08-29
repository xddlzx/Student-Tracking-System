# Audit Model

## Table
`audit_log(id, actor_id, actor_role, action, entity_type, entity_id, ts, before, after, ip, user_agent)`

- `action`: `create|update|delete|login|logout|finalize|reset_password|import|override` etc.
- `before`/`after`: JSON documents with relevant fields (redact secrets).
- Indexed by `ts`, `actor_id`, `(entity_type, entity_id)`.

## Examples

### Teacher login
```json
{
  "actor_id": "22222222-2222-2222-2222-222222222222",
  "actor_role": "teacher",
  "action": "login",
  "entity_type": "session",
  "entity_id": "…",
  "after": {"success": true}
}
```

### Trial result created
```json
{
  "actor_id": "22222222-2222-2222-2222-222222222222",
  "actor_role": "teacher",
  "action": "create",
  "entity_type": "trial_result",
  "entity_id": "77777777-7777-7777-7777-777777777771",
  "before": null,
  "after": {"student_id": "…", "trial_exam_id": "…", "net_total": 80.0}
}
```

## Query Patterns
- By actor: `WHERE actor_id = $1 AND ts BETWEEN $from AND $to ORDER BY ts DESC`
- By entity: `WHERE entity_type = $1 AND entity_id = $2 ORDER BY ts DESC`
- By action type: `WHERE action = ANY($actions)`

## Retention
- Retain a minimum of **2 school years**; export to encrypted offline media (see `backup_restore.md`). Mask PII if sharing outside the institution.
