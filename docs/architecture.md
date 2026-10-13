# Chandigarh CivicAI — Architecture Specification

## 1. Overview & Architectural Principles

Chandigarh CivicAI is designed as an explainable, human-in-the-loop civic decision-support platform tailored for the municipal governance of the Union Territory of Chandigarh.

### Core Principles
1. **Explainable AI Decision Support**: The AI pipeline generates structured, observable scores rather than black-box decisions. Human municipal administrators retain full discretion over priority adjustments and department dispatches.
2. **Evidence Support vs. Authenticity**: The system explicitly avoids claiming that AI can prove an uploaded photograph is authentic. Instead, the model scores **Evidence Support** — assessing the degree to which visual features corroborate reported hazard characteristics, location markers, and severity claims.
3. **Deterministic Priority Engine**: Priority calculation is separated from raw AI inference. A deterministic mathematical engine combines severity, safety risk, public impact, and evidence support weights to yield reproducible priority scores (0–100).
4. **Digital Public Infrastructure (DPI) UX**: Clean, accessible, fast, and trustworthy aesthetic avoiding flashy startup trends or unnecessary animations.

---

## 2. Frontend Architecture

### Technology Stack
- **Framework**: React 19 with TypeScript in strict mode
- **Build System**: Vite 8 with ES module bundling
- **CSS Architecture**: Tailwind CSS v4 configured via `@tailwindcss/vite`
- **Routing**: React Router v7 (`react-router-dom`)
- **Iconography**: Lucide React (standardized civic iconography)

### Directory Structure
```text
src/
├── components/
│   ├── ui/               # Reusable atomic UI (Button, Input, Textarea, Card, Badge, Modal, etc.)
│   ├── layout/           # Global chrome (Navbar, Footer)
│   └── common/           # Domain-specific components (EvidenceSupportBadge, PriorityIndicator)
├── pages/                # Page route views
├── layouts/              # Route layout wrappers (RootLayout)
├── routes/               # Route declarations and path definitions
├── services/             # HTTP clients and data access services
├── hooks/                # Custom React hooks (e.g. useDebounce)
├── types/                # Domain models, AI schema, priority engine contracts
├── utils/                # Utility helpers (e.g. cn)
├── constants/            # Departments, sectors, and metadata
├── assets/               # Static assets
├── App.tsx               # Top-level application component
└── main.tsx              # DOM mounting and root rendering
```

---

## 3. Routing Strategy

Routing is declarative and managed centrally in `src/routes/AppRoutes.tsx` using path constants from `src/constants/index.ts`:

| Route Path | Page Component | Access Scope | Purpose |
| :--- | :--- | :--- | :--- |
| `/` | `LandingPage` | Public | Platform overview, civic vision, process explainer |
| `/login` | `LoginPage` | Public | Citizen and municipal officer authentication (Phase 3) |
| `/register` | `RegisterPage` | Public | Citizen account registration (Phase 3) |
| `/dashboard` | `CitizenDashboardPage` | Citizen | Summary metrics and grievance status |
| `/report-issue` | `ReportIssuePage` | Citizen | Photographic upload and issue intake |
| `/my-complaints` | `MyComplaintsPage` | Citizen | Personal grievance history and filtering |
| `/complaints/:id` | `ComplaintDetailsPage` | Citizen | Citizen tracking, evidence review, and progress timeline |
| `/admin/dashboard` | `AdminDashboardPage` | Admin | Prioritized intake queue with triage metrics |
| `/admin/complaints/:id` | `AdminComplaintDetailsPage` | Admin | Evidence evaluation, department assignment, and status updates |
| `*` | `NotFoundPage` | Public | 404 handler with navigation recovery |

---

## 4. Component Strategy

1. **Atomic and Reusable UI (`src/components/ui/`)**:
   - Every UI component (`Button`, `Input`, `Textarea`, `Card`, `Badge`, `Modal`, `PageContainer`, `LoadingState`, `EmptyState`, `ErrorState`) is strictly typed, supports accessible ARIA attributes, and handles disabled/loading states natively.
   - Built with the zero-dependency `cn` class joiner.
2. **Domain Components (`src/components/common/`)**:
   - `EvidenceSupportBadge`: Visually communicates evidence support levels (`strong`, `moderate`, `weak`, `unsupported`) with explanatory tooltips.
   - `PriorityIndicator`: Standardizes display of priority tiers (`critical`, `high`, `medium`, `low`) and numerical score badges.
3. **Layout Isolation (`src/layouts/`)**:
   - `RootLayout` encapsulates universal navigation and footer semantics.

---

## 5. Domain Models & AI Data Contracts

### AI Assessment Output Contract
```typescript
interface AIAssessment {
  detectedIssue: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'negligible';
  safetyRisk: 'severe' | 'high' | 'moderate' | 'low' | 'none';
  evidenceSupport: 'strong' | 'moderate' | 'weak' | 'unsupported';
  evidenceSupportNotes: string;
  imageQuality: 'high' | 'adequate' | 'blurry' | 'insufficient';
  descriptionImageConsistency: 'consistent' | 'partially_consistent' | 'inconsistent' | 'inconclusive';
  publicImpact: 'widespread' | 'neighborhood' | 'localized' | 'minimal';
  summaryReasoning: string;
}
```

### Deterministic Priority Engine Contract
```typescript
interface PriorityScoreBreakdown {
  baseSeverityScore: number;       // 0-100 (35% weight)
  safetyRiskScore: number;         // 0-100 (40% weight)
  publicImpactScore: number;       // 0-100 (25% weight)
  evidenceSupportWeight: number;   // 0.0 - 1.0 multiplier
  finalScore: number;              // 0-100 deterministic output
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
}
```

---

## 6. Future Backend Integration Plan

The frontend foundation is structured for clean modular integration:
1. **Service Abstraction**: All future data access will occur through `src/services/` without UI components making direct database or API calls.
2. **Database Layer (Phase 2)**: Integration with Supabase PostgreSQL client; table schemas for `citizens`, `complaints`, `departments`, `ai_assessments`, and `status_logs`.
3. **Auth Adapter (Phase 3)**: Authentication state will be provided via React Context consuming Supabase Auth (OTP and JWT tokens).
4. **Storage Pipeline (Phase 5)**: Photographic evidence will be uploaded to Supabase Storage or an S3-compatible bucket, with secure signed URLs passed to the AI inference pipeline.
5. **AI Evidence Analysis Foundation (Phase 6)**: Foundation including dedicated evidence resolution service, strongly-typed structured contracts (`StructuredAIAssessment`), numeric bounds validation (0–100), multi-factor human-review triggers, and truthful presentation of real grievances without frontend AI secrets. See [`docs/ai-evidence-analysis.md`](./ai-evidence-analysis.md).
6. **Real Multimodal AI Inference (Phase 7)**: Completed server-side multimodal integration via Supabase Edge Functions (`supabase/functions/analyze-complaint-evidence/index.ts`) powered by Google Gemini (1.5 Flash). Strict server-side secret management (`GEMINI_API_KEY`), private storage evidence retrieval, 0–100 score validation, idempotency guards, and human-review enforcement.
7. **Deterministic Priority Engine (Phase 8)**: Completed authoritative mathematical priority scoring combining severity (35%), safety risk (30%), public impact (20%), recurrence (10%), and evidence support (5%) into reproducible priority tiers (Critical, High, Medium, Low). Strict non-fabrication for unassessed complaints and zero protected personal attributes. See [`docs/priority-engine.md`](./priority-engine.md).
8. **Admin Review & Civic Triage Workflow (Phase 9)**: Completed authoritative administrative console and review lifecycle. Features real Supabase data integration, live metrics, priority triage queue (Critical → High → Medium → Low → Pending), complaint inspection with signed evidence URLs, strict status transition state machine (`submitted` → `under_review` → `assigned` → `in_progress` → `resolved`, with controlled exceptions for `rejected` and `duplicate`), append-only status history (`complaint_status_history`), comprehensive audit trail (`admin_actions`), non-destructive manual priority override preserving original Phase 8 calculations, human-review flags, and municipal department routing foundation. See [`docs/admin-workflow.md`](./admin-workflow.md).
9. **Duplicate Grievance & Recurring Defect Detection (Phase 10: Complete)**: Completed advisory duplicate and recurrence detection architecture. Features canonical pair normalization ($A < B$), explainable multi-signal similarity scoring (Category 25%, Spatial/GPS 25%, Text vocabulary 30%, Temporal 15%, Landmark 5%), deterministic rolling 60-day sector recurrence signal, human-in-the-loop review workflow (Confirm Duplicate / Dismiss), strict integration with Phase 9 status state machine (`duplicate`), immutable audit logs (`admin_actions`), database schema with unique constraints, and strict citizen RLS isolation. See [`docs/duplicate-detection.md`](./duplicate-detection.md).
10. **Citizen Tracking & In-App Notifications (Phase 11: Complete)**: Completed citizen remediation tracking and in-app notifications. Features persisted status timeline built from `complaint_status_history` in chronological order with active status highlighted, deterministic citizen-safe status message mapping, strict privacy boundary (admin UUIDs and internal notes strictly omitted), minimal `public.notifications` table with check constraints, robust idempotency via `event_key` unique constraints, strict RLS (citizens SELECT and UPDATE read_at on own records only; no citizen INSERT or DELETE), lightweight `NotificationBell` with unread badge in Navbar, and direct navigation to complaints. See [`docs/notifications.md`](./notifications.md).
11. **Production Deployment & External Gateways (Future / Phase 12+)**: Automated citizen external SMS/WhatsApp alerts, NIC integrations, and cloud production deployment.

