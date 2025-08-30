from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from .models import TeacherScope, Student

def check_scope_teacher(db: Session, teacher_id, student: Student) -> None:
    scopes = db.query(TeacherScope).filter(TeacherScope.teacher_id == teacher_id).all()
    allowed = False
    for sc in scopes:
        if sc.grade == student.grade and (sc.class_section is None or sc.class_section == student.class_section):
            allowed = True
            break
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="out_of_scope")
