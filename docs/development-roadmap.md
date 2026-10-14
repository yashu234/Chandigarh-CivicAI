# Chandigarh CivicAI — Development Roadmap

This document outlines the 13 sequential development phases for building Chandigarh CivicAI. Each phase builds systematically on previous deliverables without jumping ahead.

---

## Phase Summary

| Phase | Title | Scope | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Frontend Foundation** | React 19, Vite, TypeScript, Tailwind CSS, Reusable UI, Routing, 10 Placeholder Pages, Documentation | **✅ COMPLETED** |
| **Phase 2** | **Database & Backend** | PostgreSQL / Supabase schema, migrations, RLS policies, table relations | **✅ COMPLETED** |
| **Phase 3** | **Authentication** | Citizen and Administrator authentication, role-based route guards, session management | **✅ COMPLETED** |
| **Phase 4** | **Complaint Submission** | Citizen grievance form state, validation, location tagging, submission endpoint | **✅ COMPLETED** |
| **Phase 5** | **Image Storage** | Photographic evidence upload pipeline, size/format validation, CDN/storage bucket, atomic tracking ID | **✅ COMPLETED** |
| **Phase 6** | **AI Analysis Pipeline** | Multimodal model inference for detected issue, severity, safety risk, evidence support, and image quality | **✅ COMPLETED** |
| **Phase 7** | **Deterministic Priority Engine** | Rule-based scoring formula combining severity, risk, impact, and evidence support weight | **✅ COMPLETED** |
| **Phase 8** | **Admin Dashboard** | Live prioritized queue, department assignment, workload tracking, status transition controls | **✅ COMPLETED** |
| **Phase 9** | **Duplicate & Recurring Issue Detection** | Geospatial and text similarity clustering to link related complaints in the same sector | **✅ COMPLETED** |
| **Phase 10** | **Citizen Tracking** | Real-time status tracker, in-app notification milestones, timeline audits | **✅ COMPLETED** |
| **Phase 11** | **Notifications** | Citizen notification system with idempotent event_key, notification immutability, read-state management | **✅ COMPLETED** |
| **Phase 12** | **Security Hardening & Testing** | Comprehensive security tests (28 tests), RLS audit, XSS prevention, injection prevention, notification trigger | **✅ COMPLETED** |
| **Phase 13** | **Deployment & Demo Readiness** | Production build optimization, Vercel deployment, Supabase remote verification, demo seed data, deployment guide | **✅ COMPLETED** |

---

## Detailed Phase Breakdown

### Phase 1: Frontend Foundation (Current)
- Scaffolding of React 19 + TypeScript + Vite project.
- Tailwind CSS v4 design system aligned with Digital Public Infrastructure standards.
- Reusable UI kit: Button, Input, Textarea, Card, Badge, Modal, PageContainer, LoadingState, EmptyState, ErrorState.
- Domain badges: `EvidenceSupportBadge`, `PriorityIndicator`.
- Client routing covering all 10 core views.
- Documentation: architecture, development roadmap, and manual setup guides.

### Phase 2: Database & Backend
- Database schema modeling:
  - `citizens` (profile, contact, verification)
  - `complaints` (title, description, category, sector, landmark, coordinates, status)
  - `departments` (MCC departments and engineering wings)
  - `evidence_media` (image metadata, file dimensions, storage path)
  - `ai_evaluations` (detected issue, severity, risk, evidence support, confidence)
  - `priority_scores` (breakdown factors, mathematical weights, final score)
  - `status_audit_log` (transition history, officer ID, timestamp, notes)
- Database migration scripts and Row Level Security (RLS) policies.

### Phase 3: Authentication
- Secure authentication integrating Supabase Auth or verified OTP service.
- Citizen registration with mobile verification.
- Department officer & municipal administrator role authorization.
- Protected route middleware and session persistence.

### Phase 4: Complaint Submission
- Multi-step or streamlined civic grievance intake workflow.
- Form validation (sector selection, problem description length, required fields).
- Geographic location selector for Chandigarh sectors 1 to 60 with landmark autocomplete.
- Complaint creation service with unique tracking identifier generation (e.g., `CMP-YYYY-CH-XXXX`).

### Phase 5: Image Storage
- Client-side pre-processing (compression, EXIF orientation correction, dimension verification).
- Secure upload to cloud object storage.
- Storage bucket access control (private read/write with signed URLs for authorized reviews).
- Fallback handling for poor mobile connectivity during uploads.

### Phase 6: AI Analysis Pipeline
- Multimodal AI pipeline analyzing photographic evidence and text description.
- Extraction of:
  - Detected issue classification
  - Severity level (`critical`, `high`, `moderate`, `low`, `negligible`)
  - Safety hazard rating (`severe`, `high`, `moderate`, `low`, `none`)
  - **Evidence Support Level** (`strong`, `moderate`, `weak`, `unsupported`)
  - Image quality rating (clarity, blur detection, daylight sufficiency)
  - Description/image consistency check
  - Estimated public impact tier
- Explicit adherence to the principle: AI assists review and never claims proof of image authenticity.

### Phase 7: Deterministic Priority Engine
- Transparent, explainable scoring engine decoupled from black-box LLM output.
- Configurable weights:
  - Severity: 35%
  - Safety Risk: 40%
  - Public Impact: 25%
  - Evidence Support Modifier: Multiplicative confidence factor (0.5x to 1.0x)
- Outputting a deterministic 0–100 integer score with human-readable rationale breakdown.

### Phase 8: Admin Dashboard
- Live priority-ordered triage queue for municipal officers.
- Department assignment dropdown with automated routing suggestions.
- Status transition engine: `submitted` → `under_review` → `assigned` → `in_progress` → `resolved` / `rejected`.
- Internal notes and audit log trail.

### Phase 9: Duplicate & Recurring Issue Detection
- Clustering algorithms identifying reports submitted for the same pothole or water leak within a radius.
- Linking citizen reports to parent work orders to prevent duplicate dispatch.
- Citizen notification when their report joins an active remediation order.

### Phase 10: Citizen Tracking
- Public and authenticated tracking page using tracking IDs.
- Visual milestone timeline (Intake → Scored → Dispatched → Resolved).
- Resolution proof verification (post-remediation photograph display).

### Phase 11: Security & Testing
- Unit tests for deterministic priority engine and form validators.
- Integration tests for API endpoints and status transition logic.
- End-to-end tests for citizen reporting and administrator dispatch workflows.
- Security audit against OWASP Top 10 vulnerabilities and data protection standards.

### Phase 12: Deployment & Production Readiness
- Production containerization / hosting configuration (Vercel, Cloudflare, or Gov cloud).
- Performance tuning (Lighthouse score > 90, asset minification, caching).
- Automated CI/CD deployment pipelines with linting and typechecking gates.
