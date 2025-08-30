from pydantic import BaseModel, EmailStr, Field, conint
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime

class ScopeItem(BaseModel):
    grade: int
    class_section: Optional[str] = None

class AuthMe(BaseModel):
    id: UUID
    full_name: str
    role: str
    email: EmailStr
    username: str
    must_change_password: bool
    scope: List[ScopeItem] = []

class StudentOut(BaseModel):
    id: UUID
    full_name: str
    grade: int
    class_section: str
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

class TeacherOut(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    username: str
    status: str
    must_change_password: bool

class TrialExamCreate(BaseModel):
    name: str
    source: Optional[str] = None
    date: date
    grade_scope: List[int]
    subjects_config_id: UUID

class TrialExamOut(TrialExamCreate):
    id: UUID
    is_finalized: bool

class TrialSubjectInput(BaseModel):
    subject_code: str
    correct: conint(ge=0)
    wrong: conint(ge=0)
    blank: conint(ge=0)

class TrialResultCreate(BaseModel):
    student_id: UUID
    trial_exam_id: UUID
    subjects: List[TrialSubjectInput]

class TrialSubjectOut(BaseModel):
    subject_code: str
    correct: int
    wrong: int
    blank: int
    net: float

class TrialResultOut(BaseModel):
    id: UUID
    student_id: UUID
    trial_exam_id: UUID
    correct_total: int
    wrong_total: int
    blank_total: int
    net_total: float
    subjects: List[TrialSubjectOut]

class WorkbookOut(BaseModel):
    id: UUID
    title: str
    subject_code: str
    grade: int
    publisher: Optional[str] = None
    total_units: Optional[int] = None
    total_pages: Optional[int] = None

class StudentWorkbookCreate(BaseModel):
    workbook_id: UUID
    target_date: Optional[date] = None

class StudentWorkbookOut(BaseModel):
    id: UUID
    student_id: UUID
    workbook_id: UUID
    assigned_by: UUID
    assigned_at: datetime
    target_date: Optional[date]
    status: str
    progress_percent: int
    progress_breakdown: Optional[Dict[str, int]]


# ==== Rooter: create/update payloads ====

class TeacherCreate(BaseModel):
    full_name: str
    email: EmailStr
    username: str
    temp_password: str
    must_change_password: bool = True

class TeacherListItem(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    username: str
    must_change_password: bool

class StudentCreate(BaseModel):
    full_name: str
    grade: conint(ge=1, le=12)
    class_section: str
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[EmailStr] = None
    status: str = "active"

class AuditItem(BaseModel):
    id: UUID
    actor_id: UUID
    actor_role: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    ts: datetime
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    ip: Optional[str] = None
    user_agent: Optional[str] = None
