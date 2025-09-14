from fastapi import FastAPI, Request, Depends, HTTPException, status, UploadFile, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from io import StringIO
import csv
from uuid import UUID
from datetime import datetime, timezone, date
from typing import List

from .config import settings
from .db import Base, engine, SessionLocal
from .models import *
from .schemas import *
from .security import hash_password
from .deps import get_db, require_csrf
from .rbac import check_scope_teacher
from .audit import audit

from fastapi import FastAPI, Request, Depends, HTTPException, status, UploadFile, Response
from .auth import router as auth_router

app = FastAPI(title="LGS Tracker API", version="0.1.0")

app.include_router(auth_router)   

SUBJECTS = [
    {"code": "TR",  "label": "Türkçe"},
    {"code": "MAT", "label": "Matematik"},
    {"code": "FEN", "label": "Fen Bilimleri"},
    {"code": "INK", "label": "T.C. İnkılap Tarihi ve Atatürkçülük"},
    {"code": "DIN", "label": "Din Kültürü"},
    {"code": "ING", "label": "İngilizce"},
]

def _ensure_subject_outcomes_seed(db: Session):
    # If no outcomes exist at all, seed with 20 generic outcomes per subject.
    existing = db.query(SubjectOutcome).count()
    if existing > 0:
        return
    items = []
    for s in SUBJECTS:
        for i in range(1, 21):
            items.append(SubjectOutcome(subject_code=s["code"], code=i, text=f"Kazanım {i}"))
    db.bulk_save_objects(items)
    db.commit()

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    # --- ensure a rooter user exists ---
    with SessionLocal() as db:
        _ensure_subject_outcomes_seed(db)
        existing = db.query(Teacher).filter(Teacher.username == settings.ROOTER_USERNAME).first()
        if not existing:
            db.add(Teacher(
                full_name="Rooter Admin",
                email=settings.ROOTER_EMAIL,
                username=settings.ROOTER_USERNAME,
                password_hash=hash_password(settings.ROOTER_PASSWORD),
                must_change_password=False,
                status="active",
            ))
            db.commit()
            
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

def _get_user(request: Request, db: Session) -> tuple[Teacher, Session]:
    sid = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not sid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="no_session")
    sess = db.query(Session).filter(Session.id == sid, Session.expires_at > datetime.now(timezone.utc)).first()
    if not sess:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_session")
    user = db.query(Teacher).filter(Teacher.id == sess.user_id, Teacher.status == "active").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_disabled")
    return user, sess

@app.get("/me", response_model=AuthMe)
def me(request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    # Scopes
    scopes = db.query(TeacherScope).filter(TeacherScope.teacher_id == user.id).all()
    scope_items = [ {"grade": s.grade, "class_section": s.class_section} for s in scopes ]
    role = "rooter" if user.username == "rooter" else "teacher"
    return {
        "id": str(user.id), "full_name": user.full_name, "role": role, "email": user.email,
        "username": user.username, "must_change_password": user.must_change_password, "scope": scope_items
    }

@app.get("/students")
def list_students(grade: int | None = None, q: str | None = None, page: int = 1, page_size: int = 20,
                  request: Request = None, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    is_rooter = (user.username == "rooter")
    query = db.query(Student)
    if not is_rooter and not settings.TEACHER_GLOBAL_ACCESS:
        # apply scope
        scopes = db.query(TeacherScope).filter(TeacherScope.teacher_id == user.id).all()
        if not scopes:
            return {"items": [], "total": 0}
        cond = []
        for s in scopes:
            if s.class_section is None:
                cond.append((Student.grade == s.grade))
            else:
                cond.append((Student.grade == s.grade) & (Student.class_section == s.class_section))
        from sqlalchemy import or_
        query = query.filter(or_(*cond))
    if grade:
        query = query.filter(Student.grade == grade)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(func.lower(Student.full_name).like(like))
    total = query.count()
    items = query.order_by(Student.grade.desc(), Student.class_section.asc(), Student.full_name.asc()) \
                 .offset((page-1)*page_size).limit(page_size).all()
    def to_dict(s: Student):
        return {
            "id": str(s.id), "full_name": s.full_name, "grade": s.grade, "class_section": s.class_section,
            "guardian_name": s.guardian_name, "guardian_phone": s.guardian_phone, "guardian_email": s.guardian_email,
            "status": s.status, "created_at": s.created_at.isoformat(), "updated_at": s.updated_at.isoformat()
        }
    return {"items": [to_dict(s) for s in items], "total": total}

@app.get("/students/{id}", response_model=StudentOut)
def get_student(id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="not_found")
    if user.username != "rooter":
        check_scope_teacher(db, user.id, st)
    return st

@app.put("/students/{id}", response_model=StudentOut, dependencies=[Depends(require_csrf)])
def update_student(id: UUID, body: StudentUpdate, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)

    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="not_found")

    # Teachers allowed, but still pass through the (now global) scope gate
    if user.username != "rooter":
        check_scope_teacher(db, user.id, st)

    before = {
        "full_name": st.full_name,
        "grade": st.grade,
        "class_section": st.class_section,
        "guardian_name": st.guardian_name,
        "guardian_phone": st.guardian_phone,
        "guardian_email": st.guardian_email,
        "status": st.status
    }

    for field, value in body.dict(exclude_unset=True).items():
        setattr(st, field, value.strip() if isinstance(value, str) else value)

    db.commit()
    db.refresh(st)

    audit(
        db,
        actor_id=user.id,
        actor_role=("rooter" if user.username == "rooter" else "teacher"),
        action="update",
        entity_type="student",
        entity_id=st.id,
        before=before,
        after={
            "full_name": st.full_name,
            "grade": st.grade,
            "class_section": st.class_section,
            "guardian_name": st.guardian_name,
            "guardian_phone": st.guardian_phone,
            "guardian_email": st.guardian_email,
            "status": st.status
        },
    )

    return st

@app.post("/students/import")
def import_students(csv_file: UploadFile, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    if user.username != "rooter":
        raise HTTPException(status_code=403, detail="forbidden")
    content = csv_file.file.read().decode("utf-8")
    reader = csv.DictReader(StringIO(content))
    rejects = []
    created = 0
    for row in reader:
        try:
            full_name = row["full_name"].strip()
            grade = int(row["grade"])
            class_section = row["class_section"].strip()
            if not (5 <= grade <= 8):
                raise ValueError("grade_out_of_range")
            s = Student(full_name=full_name, grade=grade, class_section=class_section,
                        guardian_name=row.get("guardian_name") or None,
                        guardian_phone=row.get("guardian_phone") or None,
                        guardian_email=row.get("guardian_email") or None,
                        status=row.get("status") or "active")
            db.add(s); db.commit()
            audit(db, actor_id=user.id, actor_role="rooter", action="import", entity_type="student", entity_id=s.id,
                  after={"full_name": full_name, "grade": grade, "class_section": class_section})
            created += 1
        except Exception as e:
            row["reject_reason"] = str(e)
            rejects.append(row)
    output = StringIO()
    if rejects:
        fieldnames = list(rejects[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rejects)
        resp = StreamingResponse(iter([output.getvalue().encode("utf-8")]), media_type="text/csv")
        return resp
    return {"created": created, "rejects": 0}

@app.get("/trials")
def list_trials(grade: int | None = None, request: Request = None, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    q = db.query(TrialExam)
    # FIX: proper Postgres ARRAY filtering
    if grade is not None:
        # matches rows where 'grade' is contained in the grade_scope array
        q = q.filter(TrialExam.grade_scope.contains([grade]))
    items = q.order_by(TrialExam.date.desc()).all()
    return [{
        "id": str(t.id),
        "name": t.name,
        "source": t.source,
        "date": t.date.isoformat(),
        "grade_scope": t.grade_scope,
        "subjects_config_id": str(t.subjects_config_id),
        "is_finalized": t.is_finalized
    } for t in items]

@app.post("/trials")
def create_trial(payload: TrialExamCreate, request: Request, db: Session = Depends(get_db), csrf: None = Depends(require_csrf)):
    user, sess = _get_user(request, db)
    # Teachers can create; Rooter can also create
    t = TrialExam(name=payload.name, source=payload.source, date=payload.date,
                  grade_scope=payload.grade_scope, subjects_config_id=str(payload.subjects_config_id), is_finalized=False)
    db.add(t); db.commit()
    audit(db, actor_id=user.id, actor_role=("rooter" if user.username=="rooter" else "teacher"),
          action="create", entity_type="trial_exam", entity_id=t.id, after={"name": t.name})
    return {"id": str(t.id), "name": t.name, "source": t.source, "date": t.date.isoformat(),
            "grade_scope": t.grade_scope, "subjects_config_id": str(t.subjects_config_id), "is_finalized": t.is_finalized}

@app.post("/trials/{id}/finalize")
def finalize_trial(id: UUID, request: Request, db: Session = Depends(get_db), csrf: None = Depends(require_csrf)):
    user, sess = _get_user(request, db)
    if user.username != "rooter":
        raise HTTPException(403, "forbidden")
    t = db.query(TrialExam).filter(TrialExam.id == str(id)).first()
    if not t:
        raise HTTPException(404, "not_found")
    t.is_finalized = True
    db.commit()
    audit(db, actor_id=user.id, actor_role="rooter", action="finalize", entity_type="trial_exam", entity_id=t.id,
          after={"is_finalized": True})
    return {"ok": True}

def _get_subjects_config(db: Session, conf_id: str):
    return db.query(SubjectsConfig).filter(SubjectsConfig.id == conf_id).first()

@app.post("/trial-results", response_model=TrialResultOut)
def create_trial_result(payload: TrialResultCreate, request: Request, db: Session = Depends(get_db), csrf: None = Depends(require_csrf)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(payload.student_id)).first()
    if not st:
        raise HTTPException(404, "student_not_found")
    if user.username != "rooter":
        check_scope_teacher(db, user.id, st)
    exam = db.query(TrialExam).filter(TrialExam.id == str(payload.trial_exam_id)).first()
    if not exam:
        raise HTTPException(404, "exam_not_found")
    if exam.is_finalized and user.username != "rooter":
        raise HTTPException(403, "finalized")
    # validation against subjects_config
    conf = _get_subjects_config(db, str(exam.subjects_config_id))
    if not conf:
        raise HTTPException(422, "subjects_config_missing")
    per_grade = conf.per_grade.get(str(st.grade))
    if not per_grade:
        raise HTTPException(422, "subjects_config_grade_missing")
    penalty = float(conf.penalty_factor)

    correct_total = wrong_total = blank_total = 0
    net_total = 0.0
    subjects_out = []
    for item in payload.subjects:
        scode = item.subject_code
        maxq = int(per_grade.get(scode, {}).get("max", 0))
        if maxq <= 0:
            raise HTTPException(422, f"subject_not_allowed:{scode}")
        if (item.correct + item.wrong + item.blank) != maxq:
            raise HTTPException(422, f"invalid_total:{scode}:{maxq}")
        net = float(item.correct - (item.wrong * penalty))
        correct_total += item.correct
        wrong_total += item.wrong
        blank_total += item.blank
        net_total += net
        subjects_out.append({"subject_code": scode, "correct": item.correct, "wrong": item.wrong, "blank": item.blank, "net": round(net,3)})

    tr = TrialResult(student_id=str(st.id), trial_exam_id=str(exam.id), correct_total=correct_total,
                     wrong_total=wrong_total, blank_total=blank_total, net_total=round(net_total,3),
                     entered_by=user.id)
    db.add(tr); db.commit()
    for so in subjects_out:
        trs = TrialResultSubject(trial_result_id=tr.id, subject_code=so["subject_code"], correct=so["correct"],
                                 wrong=so["wrong"], blank=so["blank"], net=so["net"])
        db.add(trs)
    db.commit()
    audit(db, actor_id=user.id, actor_role=("rooter" if user.username=="rooter" else "teacher"),
          action="create", entity_type="trial_result", entity_id=tr.id,
          after={"student_id": str(st.id), "trial_exam_id": str(exam.id), "net_total": float(tr.net_total)})
    return {"id": str(tr.id), "student_id": str(st.id), "trial_exam_id": str(exam.id),
            "correct_total": tr.correct_total, "wrong_total": tr.wrong_total, "blank_total": tr.blank_total,
            "net_total": float(tr.net_total), "subjects": subjects_out}


@app.get("/students/{id}/trial-results", response_model=List[TrialResultOut])
def list_trial_results_for_student(id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="student_not_found")
    if user.username != "rooter":
        check_scope_teacher(db, user.id, st)

    results = (
        db.query(TrialResult)
        .filter(TrialResult.student_id == str(st.id))
        .order_by(TrialResult.entered_at.desc())
        .all()
    )

    out = []
    for r in results:
        subjects = (
            db.query(TrialResultSubject)
            .filter(TrialResultSubject.trial_result_id == str(r.id))
            .order_by(TrialResultSubject.subject_code.asc())
            .all()
        )
        out.append({
            "id": r.id,
            "student_id": r.student_id,
            "trial_exam_id": r.trial_exam_id,
            "correct_total": r.correct_total,
            "wrong_total": r.wrong_total,
            "blank_total": r.blank_total,
            "net_total": float(r.net_total),
            "subjects": [
                {
                    "subject_code": s.subject_code,
                    "correct": s.correct,
                    "wrong": s.wrong,
                    "blank": s.blank,
                    "net": float(s.net),
                }
                for s in subjects
            ],
        })
    return out

# Backwards-compat alias for older frontends/components:
@app.get("/students/{id}/trials", response_model=List[TrialResultOut])
def list_trial_results_for_student_alias(id: UUID, request: Request, db: Session = Depends(get_db)):
    return list_trial_results_for_student(id, request, db)

@app.get("/workbooks")
def list_workbooks(grade: int | None = None, request: Request = None, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    q = db.query(Workbook)
    if grade:
        q = q.filter(Workbook.grade == grade)
    items = q.order_by(Workbook.grade.desc(), Workbook.title.asc()).all()
    return [{"id": str(w.id), "title": w.title, "subject_code": w.subject_code, "grade": w.grade,
             "publisher": w.publisher, "total_units": w.total_units, "total_pages": w.total_pages} for w in items]

@app.post("/students/{id}/workbooks", response_model=StudentWorkbookOut)
def assign_workbook(id: UUID, payload: StudentWorkbookCreate, request: Request, db: Session = Depends(get_db), csrf: None = Depends(require_csrf)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(404, "student_not_found")
    if user.username != "rooter":
        check_scope_teacher(db, user.id, st)
    wb = db.query(Workbook).filter(Workbook.id == str(payload.workbook_id)).first()
    if not wb:
        raise HTTPException(404, "workbook_not_found")
    sw = StudentWorkbook(student_id=str(st.id), workbook_id=str(wb.id), assigned_by=user.id, target_date=payload.target_date)
    db.add(sw); db.commit()
    audit(db, actor_id=user.id, actor_role=("rooter" if user.username=="rooter" else "teacher"),
          action="create", entity_type="student_workbook", entity_id=sw.id,
          after={"student_id": str(st.id), "workbook_id": str(wb.id)})
    return sw

@app.get("/students/{id}/trials")
def student_trial_history(id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(404, "not_found")
    if user.username != "rooter":
        check_scope_teacher(db, user.id, st)

    results = (
        db.query(TrialResult)
          .filter(TrialResult.student_id == str(id))
          .order_by(TrialResult.entered_at.asc())
          .all()
    )

    out = []
    for r in results:
        subs = (
            db.query(TrialResultSubject)
              .filter(TrialResultSubject.trial_result_id == str(r.id))
              .order_by(TrialResultSubject.subject_code.asc())
              .all()
        )
        out.append({
            "id": str(r.id),
            "student_id": str(r.student_id),
            "trial_exam_id": str(r.trial_exam_id),
            "correct_total": int(r.correct_total),
            "wrong_total": int(r.wrong_total),
            "blank_total": int(r.blank_total),
            "net_total": float(r.net_total),
            "entered_at": r.entered_at.isoformat() if r.entered_at else None,
            "subjects": [
                {
                    "subject_code": s.subject_code,
                    "correct": int(s.correct),
                    "wrong": int(s.wrong),
                    "blank": int(s.blank),
                    "net": float(s.net),
                } for s in subs
            ],
        })
    return out

@app.get("/audit")
def audit_view(actor_id: UUID | None = None, action: str | None = None, entity_type: str | None = None,
               from_: datetime | None = None, to: datetime | None = None, request: Request = None, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    if user.username != "rooter":
        raise HTTPException(403, "forbidden")
    q = db.query(AuditLog)
    if actor_id:
        q = q.filter(AuditLog.actor_id == str(actor_id))
    if action:
        q = q.filter(AuditLog.action == action)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if from_:
        q = q.filter(AuditLog.ts >= from_)
    if to:
        q = q.filter(AuditLog.ts <= to)
    rows = q.order_by(AuditLog.ts.desc()).limit(200).all()
    return {"items": [{
        "id": str(a.id), "actor_id": str(a.actor_id), "actor_role": a.actor_role, "action": a.action,
        "entity_type": a.entity_type, "entity_id": (str(a.entity_id) if a.entity_id else None),
        "ts": a.ts.isoformat(), "before": a.before, "after": a.after, "ip": a.ip, "user_agent": a.user_agent
    } for a in rows]}



# ==== Rooter management endpoints ====
from .security import hash_password
from .audit import audit
from .deps import require_csrf

@app.get("/teachers")
def list_teachers(request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    if user.username != "rooter":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    rows = db.query(Teacher).order_by(Teacher.full_name.asc()).all()
    return {"items": [{
        "id": str(t.id), "full_name": t.full_name, "email": t.email,
        "username": t.username, "must_change_password": bool(getattr(t, "must_change_password", False))
    } for t in rows]}

@app.post("/teachers", dependencies=[Depends(require_csrf)])
def create_teacher(body: TeacherCreate, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    if user.username != "rooter":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    # Check unique username/email
    existing = db.query(Teacher).filter((Teacher.username == body.username) | (Teacher.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="username_or_email_exists")
    t = Teacher(
        full_name=body.full_name.strip(),
        email=body.email,
        username=body.username,
        password_hash=hash_password(body.temp_password),
        must_change_password=body.must_change_password
    )
    db.add(t); db.commit(); db.refresh(t)
    audit(db, actor_id=user.id, actor_role="rooter", action="create", entity_type="teacher", entity_id=t.id,
          after={"full_name": t.full_name, "email": t.email, "username": t.username})
    return {"id": str(t.id), "full_name": t.full_name, "email": t.email, "username": t.username, "must_change_password": t.must_change_password}

@app.get("/teachers/{teacher_id}")
def get_teacher(teacher_id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    if user.username != "rooter":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    t = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    scopes = db.query(TeacherScope).filter(TeacherScope.teacher_id == t.id).all()
    scope_items = [{"grade": s.grade, "class_section": s.class_section} for s in scopes]
    return {"id": str(t.id), "full_name": t.full_name, "email": t.email, "username": t.username, "must_change_password": t.must_change_password, "scope": scope_items}

@app.post("/students", dependencies=[Depends(require_csrf)])
def create_student(body: StudentCreate, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    # Rooter only
    if user.username != "rooter":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    st = Student(
        full_name=body.full_name.strip(),
        grade=body.grade,
        class_section=body.class_section,
        guardian_name=body.guardian_name,
        guardian_phone=body.guardian_phone,
        guardian_email=body.guardian_email,
        status=body.status
    )
    db.add(st); db.commit(); db.refresh(st)
    audit(db, actor_id=user.id, actor_role="rooter", action="create", entity_type="student", entity_id=st.id,
          after={"full_name": st.full_name, "grade": st.grade, "class_section": st.class_section})
    return {
        "id": str(st.id), "full_name": st.full_name, "grade": st.grade, "class_section": st.class_section,
        "guardian_name": st.guardian_name, "guardian_phone": st.guardian_phone, "guardian_email": st.guardian_email,
        "status": st.status, "created_at": st.created_at, "updated_at": st.updated_at
    }

# --- NEW: Resource book & outcomes endpoints ---

@app.get("/students/{id}/resource-books", response_model=List[ResourceBookOut])
def list_resource_books_for_student(id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="student_not_found")
    books = db.query(ResourceBook).filter(ResourceBook.student_id == str(id)).order_by(ResourceBook.created_at.asc()).all()
    out = []
    for b in books:
        total = db.query(func.count(SubjectOutcome.id)).filter(SubjectOutcome.subject_code == b.subject_code).scalar() or 0
        checked = (
            db.query(func.count(ResourceOutcomeCheck.id))
              .join(SubjectOutcome, ResourceOutcomeCheck.outcome_id == SubjectOutcome.id)
              .filter(ResourceOutcomeCheck.resource_book_id == b.id)
              .filter(ResourceOutcomeCheck.checked == True)
              .filter(SubjectOutcome.subject_code == b.subject_code)
              .scalar()
        ) or 0
        progress = int(round((checked / total) * 100)) if total > 0 else 0
        out.append({"id": str(b.id), "name": b.name, "subject_code": b.subject_code, "progress_percent": progress})
    return out

@app.post("/students/{id}/resource-books", response_model=ResourceBookOut)
def create_resource_book_for_student(id: UUID, body: ResourceBookCreate, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="student_not_found")
    if body.subject_code not in [s["code"] for s in SUBJECTS]:
        raise HTTPException(status_code=400, detail="invalid_subject")
    rb = ResourceBook(student_id=str(id), name=body.name.strip(), subject_code=body.subject_code)
    db.add(rb); db.commit(); db.refresh(rb)
    try:
        audit(db, actor_id=user.id, actor_role="teacher", action="create", entity_type="resource_book", entity_id=rb.id,
              after={"student_id": str(id), "name": rb.name, "subject_code": rb.subject_code})
    except Exception:
        pass
    return {"id": str(rb.id), "name": rb.name, "subject_code": rb.subject_code, "progress_percent": 0}

@app.get("/resource-books/{book_id}/outcomes", response_model=List[OutcomeWithCheck])
def get_outcomes_for_resource_book(book_id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    rb = db.query(ResourceBook).filter(ResourceBook.id == str(book_id)).first()
    if not rb:
        raise HTTPException(status_code=404, detail="resource_book_not_found")
    outcomes = db.query(SubjectOutcome).filter(SubjectOutcome.subject_code == rb.subject_code).order_by(SubjectOutcome.code.asc()).all()
    checks = { str(x.outcome_id): x for x in db.query(ResourceOutcomeCheck).filter(ResourceOutcomeCheck.resource_book_id == rb.id).all() }
    out = []
    for o in outcomes:
        oc = checks.get(str(o.id))
        out.append({
            "outcome_id": str(o.id),
            "subject_code": o.subject_code,
            "code": o.code,
            "text": o.text,
            "checked": bool(oc.checked) if oc else False
        })
    return out

@app.post("/resource-books/{book_id}/outcomes/toggle")
def toggle_outcomes_for_resource_book(book_id: UUID, body: ToggleOutcomeBulkIn, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    rb = db.query(ResourceBook).filter(ResourceBook.id == str(book_id)).first()
    if not rb:
        raise HTTPException(status_code=404, detail="resource_book_not_found")
    # validate outcome ids belong to rb.subject_code
    valid_ids = set(x.id for x in db.query(SubjectOutcome.id).filter(SubjectOutcome.subject_code == rb.subject_code).all())
    for item in body.items:
        if item.outcome_id not in valid_ids:
            continue
        rec = db.query(ResourceOutcomeCheck).filter(
            ResourceOutcomeCheck.resource_book_id == rb.id,
            ResourceOutcomeCheck.outcome_id == item.outcome_id
        ).first()
        if not rec:
            rec = ResourceOutcomeCheck(resource_book_id=rb.id, outcome_id=item.outcome_id, checked=item.checked)
            db.add(rec)
        else:
            rec.checked = item.checked
    db.commit()
    # return fresh progress
    total = db.query(func.count(SubjectOutcome.id)).filter(SubjectOutcome.subject_code == rb.subject_code).scalar() or 0
    checked = (
        db.query(func.count(ResourceOutcomeCheck.id))
          .join(SubjectOutcome, ResourceOutcomeCheck.outcome_id == SubjectOutcome.id)
          .filter(ResourceOutcomeCheck.resource_book_id == rb.id, ResourceOutcomeCheck.checked == True)
          .filter(SubjectOutcome.subject_code == rb.subject_code)
          .scalar()
    ) or 0
    progress = int(round((checked / total) * 100)) if total > 0 else 0
    return {"ok": True, "progress_percent": progress}

@app.get("/students/{id}/workbooks")
def list_student_workbooks(id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="student_not_found")
    rows = db.query(StudentWorkbook).filter(StudentWorkbook.student_id == str(id)).order_by(StudentWorkbook.assigned_at.asc()).all()
    out = []
    for sw in rows:
        w = db.query(Workbook).filter(Workbook.id == sw.workbook_id).first()
        out.append({
            "id": str(sw.id),
            "status": sw.status,
            "progress_percent": sw.progress_percent,
            "assigned_at": sw.assigned_at,
            "workbook": {
                "id": str(w.id) if w else None,
                "title": w.title if w else None,
                "subject_code": w.subject_code if w else None,
                "grade": w.grade if w else None,
                "publisher": w.publisher if w else None,
                "total_units": w.total_units if w else None,
                "total_pages": w.total_pages if w else None,
            }
        })
    return out

@app.get("/students/{id}/resource-books", response_model=List[ResourceBookOut])
def list_resource_books_for_student(id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="student_not_found")
    books = (db.query(ResourceBook)
               .filter(ResourceBook.student_id == str(id))
               .order_by(ResourceBook.created_at.asc())
               .all())
    out = []
    for b in books:
        total = (db.query(func.count(SubjectOutcome.id))
                   .filter(SubjectOutcome.subject_code == b.subject_code)
                   .scalar()) or 0
        checked = (db.query(func.count(ResourceOutcomeCheck.id))
                     .join(SubjectOutcome, ResourceOutcomeCheck.outcome_id == SubjectOutcome.id)
                     .filter(ResourceOutcomeCheck.resource_book_id == b.id)
                     .filter(ResourceOutcomeCheck.checked == True)
                     .filter(SubjectOutcome.subject_code == b.subject_code)
                     .scalar()) or 0
        progress = int(round((checked / total) * 100)) if total > 0 else 0
        out.append({"id": b.id, "name": b.name, "subject_code": b.subject_code, "progress_percent": progress})
    return out

@app.post("/students/{id}/resource-books", response_model=ResourceBookOut)
def create_resource_book_for_student(id: UUID, body: ResourceBookCreate, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    st = db.query(Student).filter(Student.id == str(id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="student_not_found")
    if body.subject_code not in [s["code"] for s in SUBJECTS]:
        raise HTTPException(status_code=400, detail="invalid_subject")
    rb = ResourceBook(student_id=str(id), name=body.name.strip(), subject_code=body.subject_code)
    db.add(rb); db.commit(); db.refresh(rb)
    try:
        audit(db, actor_id=user.id, actor_role="teacher", action="create", entity_type="resource_book", entity_id=rb.id,
              after={"student_id": str(id), "name": rb.name, "subject_code": rb.subject_code})
    except Exception:
        pass
    return {"id": rb.id, "name": rb.name, "subject_code": rb.subject_code, "progress_percent": 0}

@app.get("/resource-books/{book_id}/outcomes", response_model=List[OutcomeWithCheck])
def get_outcomes_for_resource_book(book_id: UUID, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    rb = db.query(ResourceBook).filter(ResourceBook.id == str(book_id)).first()
    if not rb:
        raise HTTPException(status_code=404, detail="resource_book_not_found")
    outcomes = (db.query(SubjectOutcome)
                  .filter(SubjectOutcome.subject_code == rb.subject_code)
                  .order_by(SubjectOutcome.code.asc())
                  .all())
    checks = {
        str(x.outcome_id): x
        for x in db.query(ResourceOutcomeCheck)
                   .filter(ResourceOutcomeCheck.resource_book_id == rb.id)
                   .all()
    }
    out = []
    for o in outcomes:
        oc = checks.get(str(o.id))
        out.append({
            "outcome_id": o.id,
            "subject_code": o.subject_code,
            "code": o.code,
            "text": o.text,
            "checked": bool(oc.checked) if oc else False
        })
    return out

@app.post("/resource-books/{book_id}/outcomes/toggle")
def toggle_outcomes_for_resource_book(book_id: UUID, body: ToggleOutcomeBulkIn, request: Request, db: Session = Depends(get_db)):
    user, sess = _get_user(request, db)
    rb = db.query(ResourceBook).filter(ResourceBook.id == str(book_id)).first()
    if not rb:
        raise HTTPException(status_code=404, detail="resource_book_not_found")

    # IMPORTANT FIX: querying a single column returns rows (tuples). Use row[0].
    valid_id_rows = (db.query(SubjectOutcome.id)
                       .filter(SubjectOutcome.subject_code == rb.subject_code)
                       .all())
    valid_ids = set(str(row[0]) for row in valid_id_rows)

    for item in body.items:
        if str(item.outcome_id) not in valid_ids:
            continue
        rec = (db.query(ResourceOutcomeCheck)
                 .filter(ResourceOutcomeCheck.resource_book_id == rb.id,
                         ResourceOutcomeCheck.outcome_id == item.outcome_id)
                 .first())
        if not rec:
            rec = ResourceOutcomeCheck(resource_book_id=rb.id, outcome_id=item.outcome_id, checked=item.checked)
            db.add(rec)
        else:
            rec.checked = item.checked
    db.commit()

    total = (db.query(func.count(SubjectOutcome.id))
               .filter(SubjectOutcome.subject_code == rb.subject_code)
               .scalar()) or 0
    checked = (db.query(func.count(ResourceOutcomeCheck.id))
                 .join(SubjectOutcome, ResourceOutcomeCheck.outcome_id == SubjectOutcome.id)
                 .filter(ResourceOutcomeCheck.resource_book_id == rb.id, ResourceOutcomeCheck.checked == True)
                 .filter(SubjectOutcome.subject_code == rb.subject_code)
                 .scalar()) or 0
    progress = int(round((checked / total) * 100)) if total > 0 else 0
    return {"ok": True, "progress_percent": progress}
