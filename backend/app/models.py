import uuid
from sqlalchemy import Column, String, Integer, Text, Enum, Boolean, Date, DateTime, ForeignKey, UniqueConstraint, JSON, Numeric, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .db import Base

class Teacher(Base):
    __tablename__ = "teacher"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    must_change_password = Column(Boolean, default=False, nullable=False)
    status = Column(Enum("active","disabled", name="user_status"), default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

class ClassSection(Base):
    __tablename__ = "class_section"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grade = Column(Integer, nullable=False)
    label = Column(Text, nullable=False)
    active = Column(Boolean, default=True, nullable=False)

class Student(Base):
    __tablename__ = "student"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(Text, nullable=False)
    grade = Column(Integer, nullable=False)
    class_section = Column(Text, nullable=False)
    guardian_name = Column(Text)
    guardian_phone = Column(Text)
    guardian_email = Column(Text)
    status = Column(Enum("active","inactive","graduated", name="student_status"), default="active", nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

class TeacherScope(Base):
    __tablename__ = "teacher_scope"
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teacher.id", ondelete="CASCADE"), primary_key=True)
    grade = Column(Integer, nullable=False, primary_key=True)
    class_section = Column(Text, primary_key=True, nullable=True)

class Config(Base):
    __tablename__ = "config"
    key = Column(Text, primary_key=True)
    value = Column(JSON, nullable=False)

class SubjectsConfig(Base):
    __tablename__ = "subjects_config"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    description = Column(Text)
    penalty_factor = Column(Numeric(6,4), nullable=False)
    per_grade = Column(JSON, nullable=False)

class TrialExam(Base):
    __tablename__ = "trial_exam"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    source = Column(Text)
    date = Column(Date, nullable=False)
    grade_scope = Column(ARRAY(Integer), nullable=False)
    subjects_config_id = Column(UUID(as_uuid=True), ForeignKey("subjects_config.id"), nullable=False)
    is_finalized = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

class TrialResult(Base):
    __tablename__ = "trial_result"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student.id", ondelete="CASCADE"), nullable=False)
    trial_exam_id = Column(UUID(as_uuid=True), ForeignKey("trial_exam.id", ondelete="CASCADE"), nullable=False)
    correct_total = Column(Integer, default=0, nullable=False)
    wrong_total = Column(Integer, default=0, nullable=False)
    blank_total = Column(Integer, default=0, nullable=False)
    net_total = Column(Numeric(6,3), default=0, nullable=False)
    entered_by = Column(UUID(as_uuid=True), ForeignKey("teacher.id"), nullable=False)
    entered_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

class TrialResultSubject(Base):
    __tablename__ = "trial_result_subject"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trial_result_id = Column(UUID(as_uuid=True), ForeignKey("trial_result.id", ondelete="CASCADE"), nullable=False)
    subject_code = Column(Text, nullable=False)
    correct = Column(Integer, default=0, nullable=False)
    wrong = Column(Integer, default=0, nullable=False)
    blank = Column(Integer, default=0, nullable=False)
    net = Column(Numeric(6,3), default=0, nullable=False)
    __table_args__ = (UniqueConstraint("trial_result_id", "subject_code", name="uq_trs_result_subject"),)

class Workbook(Base):
    __tablename__ = "workbook"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(Text, nullable=False)
    subject_code = Column(Text, nullable=False)
    grade = Column(Integer, nullable=False)
    publisher = Column(Text)
    total_units = Column(Integer)
    total_pages = Column(Integer)

class StudentWorkbook(Base):
    __tablename__ = "student_workbook"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student.id", ondelete="CASCADE"), nullable=False)
    workbook_id = Column(UUID(as_uuid=True), ForeignKey("workbook.id", ondelete="CASCADE"), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("teacher.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    target_date = Column(Date)
    status = Column(Text, default="assigned", nullable=False)
    progress_percent = Column(Integer, default=0, nullable=False)
    progress_breakdown = Column(JSON)

class Note(Base):
    __tablename__ = "note"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("teacher.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))

class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    actor_role = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    entity_type = Column(Text, nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    ts = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    before = Column(JSON)
    after = Column(JSON)
    ip = Column(Text)
    user_agent = Column(Text)

class Session(Base):
    __tablename__ = "session"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(Text, nullable=False)
    csrf_token = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_seen_ip = Column(Text)
    user_agent = Column(Text)
