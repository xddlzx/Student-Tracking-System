from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
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
    scope: List[ScopeItem]

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
