# Plate Scan & Case Matching Service

A full-stack, multi-tenant application designed for the vehicle-recovery industry. This platform ingests real-time license plate recognition (LPR) scans from vehicle cameras, determines whether scans belong to existing active tracking files or require a new repossession eligibility check, and exposes results to a tenant-scoped frontend dashboard.

## Live Deployments
* *Frontend Dashboard (Vercel):* https://vercel.app
* *Backend API (AWS):* http://amazonaws.com

---

## Tech Stack
* *Frontend:* React, Vite, Tailwind CSS
* *Backend:* Python (FastAPI / Flask / Django REST Framework), Uvicorn
* *Database:* PostgreSQL
* *Hosting:* Vercel (Frontend), AWS (Backend API & Database)

---

## How to Run Locally

### 1. Prerequisites
* Python 3.10+
* Node.js 18+
* PostgreSQL running locally

### 2. Backend Setup
Navigate to the root or backend folder and install dependencies:
bash
# Install dependencies
pip install -r requirements.txt

# Run the API server locally
uvicorn main:app --reload --port 8000

The local API will be accessible at http://127.0.0.1:8000.

### 3. Frontend Setup
Navigate to the frontend folder:
bash
cd frontend

# Install Node modules
npm install

# Start the local development server
npm run dev

The React dashboard will be accessible at http://localhost:5173.

---

## Core Architecture & Assumptions

### Multi-Tenancy & Access Control Boundary
* *Camera Ingestion:* The POST /api/v1/scans endpoint is unauthenticated to simulate real-time truck webhooks. The system automatically resolves the proper landlord/tenant entity using the inbound camera_id lookup in the PostgreSQL ledger.
* *Isolation Rule:* Tenants can never view or modify active or closed cases belonging to other agencies. 
* *The "Claim" Exception:* As requested by the brief, pending_claim cases are global. Any authenticated user from any tenant can claim a pending case. Once claimed, the system assigns the case exclusively to the claiming agent's tenant and moves the status to active.

### Core Engineering Assumptions Made
1. *Mock Authentication:* Implemented a hardcoded user-per-tenant token scenario to focus core implementation on downstream tenant-boundary enforcement rather than JWT validation mechanics.
2. *Mock Eligibility:* The partner network check alternates status answers based on the incoming VIN structure to simulate real-time lender connectivity.
3. *Image Buffering:* Scan records store static image URLs directly; binary multipart cloud storage hooks are stubbed.

---

## Architecture Design Note (AWS Scale Setup Summary)

For a full production deployment, the platform scales across the following AWS services:
1. *Frontend Layer:* Hosted on Vercel's global edge infrastructure for microsecond loading speeds and automated SSL.
2. *Compute Layer:* Python API containerized via Docker and deployed on *AWS ECS Fargate* behind an *Application Load Balancer (ALB)* to automatically auto-scale based on truck scan traffic spikes.
3. *Database Layer:* A multi-AZ *Amazon RDS PostgreSQL* instance placed inside an isolated private subnet, accessible only by the ECS tasks through managed security groups.

---

## Seeding & Test Walkthrough
To test the two core business flows seamlessly, use the following scenario paths:
* *Existing Case Flow (Tenant A):* Sending an unauthenticated POST scan for camera cam_1001 with VIN 1FTFW1E51NFA12345 automatically routes into the location breadcrumb timeline.
* *New Case Flow (Tenant B):* Scanning an unowned VIN from camera cam_2050 triggers the external provider eligibility check, spinning up a global pending_claim block ready to be verified on the common market grid.
