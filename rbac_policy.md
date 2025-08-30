# RBAC Policy

## Roles
- **rooter**: Superuser; full access for administration, audit, and overrides.
- **teacher**: Limited to configured grade/class scopes; can create trial results and manage workbooks for in-scope students.

## Route Guards
| Route prefix | rooter | teacher |
|---|---|---|
| `/auth/*` | ✅ | ✅ |
| `/me` | ✅ | ✅ |
| `/students` (list/view) | ✅ | ✅ (scoped) |
| `/students/import` | ✅ | ❌ |
| `/teachers*` | ✅ | ❌ |
| `/classes` | ✅ | ✅ |
| `/trials` (list/create) | ✅ | ✅ |
| `/trials/*/finalize` | ✅ | ❌ |
| `/trial-results` | ✅ | ✅ (scoped) |
| `/workbooks` | ✅ | ✅ |
| `/students/*/workbooks` | ✅ | ✅ (scoped) |
| `/audit` | ✅ | ❌ |

## Data Scope Rules (Teacher)
- Student list returns only rows where there exists a `teacher_scope` row matching `(teacher_id, grade)` and (if scope.class_section is not null) `student.class_section = scope.class_section`.
- Trial result creation only permitted if the `(student, trial_exam)` are within the teacher's scope and the exam includes the student's grade.
- Finalized exams (`trial_exam.is_finalized = true`) disallow editing by teachers.

## Privilege Escalation Analysis
- No self-registration; only Rooter can create users.
- Reset temp password: issued only by Rooter; forces `must_change_password = true` and audited.
- Session hijacking mitigations: HttpOnly cookies, SameSite=Lax; sessions stored server-side and revocable. CSRF on state-changing routes.
- IDOR mitigations: row-level checks in every handler based on authenticated principal + scope.
- Audit trail records all CRUD actions with before/after diffs.
