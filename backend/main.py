from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

import models
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="Plate Scan Matching Engine")

app.add_middleware(    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic DTO Serialization Rules ---
class ScanIngestPayload(BaseModel):
    camera_id: str
    plate: str
    vin: str
    latitude: float
    longitude: float
    scanned_at: datetime
    image_url: Optional[str] = None

class CaseClaimResponse(BaseModel):
    id: int
    vin: str
    status: str
    tenant_id: Optional[int]
    assigned_agent_id: Optional[int]
    
    class Config:
        from_attributes = True

# --- Mock Authentication Security Boundary Layer ---
def get_current_user(x_user_id: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing required X-User-Id Authorization header")
    
    # Check if the user exists in the database mapping registry
    user = db.query(models.User).filter(models.User.id == int(x_user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User Identity not registered within platform domain")
        
    # Injects the active tenant ID context directly into the current PostgreSQL database transaction
    from sqlalchemy import text
    try:
        db.execute(text(f"SET LOCAL app.current_tenant_id = '{user.tenant_id}';"))
    except Exception:
        # Graceful fallback to prevent crashes if testing on a local database engine that doesn't support RLS
        pass

    return user

# --- Appendix A: Mock Partner Network Eligibility Verification ---
@app.post("/mock/partner-network/eligibility")
def check_partner_eligibility(payload: dict):
    vin = payload.get("vin", "")
    # Evaluates true unless the tracking target ends with an even digit
    eligible = not (vin and vin[-1].isdigit() and int(vin[-1]) % 2 == 0)
    return {"vin": vin, "still_eligible_for_repo": eligible}

# --- Endpoint 1: POST /api/v1/scans (Camera Ingestion Pipeline) ---
@app.post("/api/v1/scans", status_code=201)
def ingest_field_scan(payload: ScanIngestPayload, db: Session = Depends(get_db)):
    camera = db.query(models.Camera).filter(models.Camera.id == payload.camera_id).first()
    if not camera:
        raise HTTPException(status_code=400, detail="Inbound payload ingestion blocked: Unknown Camera ID.")
    
    # Process Storage (Always persist records)
    scan_record = models.Scan(**payload.model_dump())
    db.add(scan_record)
    db.commit()
    
    # Core Flow Split Check
    active_case = db.query(models.Case).filter(
        models.Case.vin == payload.vin,
        models.Case.tenant_id == camera.tenant_id,
        models.Case.status == models.CaseStatus.ACTIVE
    ).first()
    
    if active_case:
        return {"status": "processed", "flow": "existing_case_flow", "scan_id": scan_record.id}
    
    # Execute external visibility lifecycle verification via mock loopback loop
    is_eligible = check_partner_eligibility({"vin": payload.vin})["still_eligible_for_repo"]
    if is_eligible:
        new_case = models.Case(
            vin=payload.vin,
            status=models.CaseStatus.PENDING_CLAIM,
            tenant_id=camera.tenant_id
        )
        db.add(new_case)
        db.commit()
        return {"status": "processed", "flow": "new_case_flow_created", "case_id": new_case.id}
        
    return {"status": "processed", "flow": "ignored_ineligible"}

# --- Endpoint 2: POST /api/v1/cases/{case_id}/claim ---
@app.post("/api/v1/cases/{case_id}/claim", response_model=CaseClaimResponse)
def claim_open_case(case_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    target_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not target_case:
        raise HTTPException(status_code=404, detail="Target case files not found.")
    if target_case.status != models.CaseStatus.PENDING_CLAIM:
        raise HTTPException(status_code=400, detail="Transaction Rejected: Case file already claimed or closed.")
    
    # Mutate cross-tenant mapping structures cleanly
    target_case.status = models.CaseStatus.ACTIVE
    target_case.tenant_id = current_user.tenant_id
    target_case.assigned_agent_id = current_user.id
    db.commit()
    db.refresh(target_case)
    return target_case

# --- Endpoint 3: GET /api/v1/cases/{case_id}/scans ---
@app.get("/api/v1/cases/{case_id}/scans")
def get_case_location_trail(case_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    target_case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not target_case:
        raise HTTPException(status_code=404, detail="Target registry footprint not found.")
        
    # Multi-tenancy Isolation Check
    if target_case.status != models.CaseStatus.PENDING_CLAIM and target_case.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Access Denied: Resource belongs to an external tenant.")
        
    scans = db.query(models.Scan).filter(models.Scan.vin == target_case.vin).order_by(models.Scan.scanned_at.asc()).all()
    return scans

# --- Endpoint 4: GET /api/v1/cases ---
@app.get("/api/v1/cases")
def list_cases(status: Optional[str] = None, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.Case).filter(
        or_(
            models.Case.tenant_id == current_user.tenant_id,
            models.Case.status == models.CaseStatus.PENDING_CLAIM
        )
    )
    if status:
        query = query.filter(models.Case.status == status)
    return query.all()

# --- Automated System Data Seeding Fixture Hook ---
@app.post("/api/v1/system/seed", tags=["Infrastructure Utility"])
def seed_test_database(db: Session = Depends(get_db)):
    db.query(models.Scan).delete()
    db.query(models.Case).delete()
    db.query(models.Camera).delete()
    db.query(models.User).delete()
    db.query(models.Tenant).delete()
    
    t1 = models.Tenant(id=1, name="Tenant A Recovery Systems")
    t2 = models.Tenant(id=2, name="Tenant B Repossession Group")
    db.add_all([t1, t2])
    db.commit()
    
    db.add_all([
        models.User(id=1, username="agent_a", tenant_id=1, role=models.UserRole.STAFF),
        models.User(id=2, username="agent_b", tenant_id=2, role=models.UserRole.STAFF),
        models.Camera(id="cam_1001", tenant_id=1),
        models.Camera(id="cam_2050", tenant_id=2)
    ])
    db.commit()
    
    # Active track configuration setup for Tenant A (Exercises existing flow)
    db.add(models.Case(id=50, vin="VIN11111111111111", status=models.CaseStatus.ACTIVE, tenant_id=1, assigned_agent_id=1))
    db.add_all([
        models.Scan(camera_id="cam_1001", plate="AAA111", vin="VIN11111111111111", latitude=33.749, longitude=-84.388, scanned_at=datetime.utcnow()),
        models.Scan(camera_id="cam_1001", plate="AAA111", vin="VIN11111111111111", latitude=33.755, longitude=-84.390, scanned_at=datetime.utcnow())
    ])
    db.commit()
    return {"status": "System storage environment seeded successfully."}