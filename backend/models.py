import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Index
from sqlalchemy.orm import relationship
from database import Base

class CaseStatus(str, enum.Enum):
    PENDING_CLAIM = "pending_claim"
    ACTIVE = "active"
    CLOSED = "closed"

class UserRole(str, enum.Enum):
    STAFF = "staff"
    ADMIN = "admin"

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    users = relationship("User", back_populates="tenant")
    cameras = relationship("Camera", back_populates="tenant")
    cases = relationship("Case", back_populates="tenant")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STAFF)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    tenant = relationship("Tenant", back_populates="users")

class Camera(Base):
    __tablename__ = "cameras"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    tenant = relationship("Tenant", back_populates="cameras")

class Case(Base):
    __tablename__ = "cases"
    id = Column(Integer, primary_key=True, index=True)
    vin = Column(String, nullable=False)
    status = Column(Enum(CaseStatus), default=CaseStatus.PENDING_CLAIM)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)  # Nullable if unassigned open marketplace case
    assigned_agent_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tenant = relationship("Tenant", back_populates="cases")
    
    _table_args_ = (
        Index("idx_cases_tenant_status", "tenant_id", "status"),
        Index("idx_cases_vin", "vin"),
    )

class Scan(Base):
    __tablename__ = "scans"
    id = Column(Integer, primary_key=True, index=True)
    camera_id = Column(String, ForeignKey("cameras.id"), nullable=False)
    plate = Column(String, nullable=False)
    vin = Column(String, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    scanned_at = Column(DateTime, nullable=False)
    image_url = Column(String, nullable=True)
    
    _table_args_ = (
        Index("idx_scans_vin_timestamp", "vin", "scanned_at"),
    )