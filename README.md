# Chandigarh CivicAI

> AI-assisted civic complaint analysis and explainable priority intelligence platform for the Union Territory of Chandigarh.

[![CI](https://img.shields.io/badge/build-passing-brightgreen)](docs/deployment.md)
[![Tests](https://img.shields.io/badge/tests-135%2F135-brightgreen)](test/)
[![Security](https://img.shields.io/badge/security-28%2F28-blue)](docs/security-audit.md)
[![Phases](https://img.shields.io/badge/phases-1--13%20complete-blueviolet)](docs/development-roadmap.md)

---

## 🏛️ Project Purpose

Chandigarh CivicAI bridges citizen grievance reporting and municipal remediation across the 60 sectors of Chandigarh. Citizens submit photographic evidence and precise locations of civic hazards. Municipal administrators receive an explainable, deterministic priority-scored triage queue, freeing them from manual complaint sorting.

### Core AI Principle: "Evidence Support — Not Proof"

The AI system explicitly **does NOT claim to prove whether an uploaded image is authentic or whether the reported location is correct.** Instead, it evaluates **Evidence Support** — measuring how strongly the visual features in an uploaded photograph substantiate the severity and physical hazard described by the citizen. All AI recommendations are fully explainable and designed to support human administrative discretion.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Icons | Lucide React |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage (private bucket) |
| AI Pipeline | Google Gemini (Supabase Edge Function) |
| Code Quality | Oxlint + TypeScript strict mode |

---

## 📁 Project Structure

```text
chandigarh-civicai/
│
├── src/
│   ├── components/
│   │   ├── ui/               # Reusable atomic UI (Button, Input, Textarea, Card, Badge, Modal, etc.)
│   │   ├── layout/           # Digital Public Infrastructure Header & Footer
│   │   └── common/           # Domain components (EvidenceSupportBadge, PriorityIndicator)
│   │
│   ├── pages/                # Citizen & Admin views
│   ├── layouts/              # RootLayout shell
│   ├── routes/               # Declarative client-side routing with role guards
│   ├── services/             # API & Supabase service layer
│   ├── context/              # AuthContext (session, profile, role management)
│   ├── hooks/                # Custom React utility hooks
│   ├── types/                # Domain type definitions & AI contracts
│   ├── utils/                # Zero-dependency utilities (priority engine, validators)
│   ├── constants/            # Departments, sectors, and metadata
│   └── data/                 # Static mock fallback data
│
├── supabase/
│   ├── schema.sql            # Consolidated schema (single source of truth)
│   ├── seed.sql              # Synthetic demo data (CHD-TEST-* prefix only)
│   ├── functions/
│   │   └── analyze-complaint-evidence/   # Gemini AI edge function
│   └── migrations/           # 7 ordered incremental migrations (Phase 3–13)
│
├── test/                     # 9 test suites — 159 total tests
│   ├── phase6_tests.mjs      # AI evidence pipeline (18 tests)
│   ├── phase7_tests.mjs      # Prompt integrity & secrets audit (12 tests)
│   ├── phase8_tests.mjs      # Admin dashboard & priority engine (17 tests)
│   ├── phase9_tests.mjs      # Status state machine (16 tests)
│   ├── phase9_patch_tests.mjs # Priority override semantics (11 tests)
│   ├── phase10_tests.mjs     # Duplicate detection (18 tests)
│   ├── phase11_tests.mjs     # Notification semantics (17 tests)
│   ├── phase12_security_tests.mjs  # Security hardening (28 tests)
│   └── phase13_demo_readiness.mjs  # Deployment readiness (24 tests)
│
├── docs/
│   ├── architecture.md
│   ├── development-roadmap.md
│   ├── manual-setup.md       # Supabase manual setup guide
│   ├── deployment.md         # Phase 13 production deployment guide
│   ├── demo-guide.md         # 6-scene demo walkthrough script
│   ├── security-audit.md     # OWASP-aligned security audit report
│   ├── priority-engine.md    # Deterministic scoring formula documentation
│   ├── ai-evidence-analysis.md
│   ├── admin-workflow.md
│   ├── duplicate-detection.md
│   └── notifications.md
│
├── .env.example              # Environment variables template (no real secrets)
├── .gitignore                # Excludes .env.local and all secrets
├── package.json
├── tsconfig.json
└── vite.config.ts            # Production build with code splitting & security headers
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm v9+
- A Supabase project (free tier sufficient for development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key
```

### 3. Apply Database Schema
Follow [`docs/manual-setup.md`](docs/manual-setup.md) to apply `supabase/schema.sql` to your Supabase project.

### 4. (Optional) Apply Demo Seed Data
```sql
-- Run supabase/seed.sql in Supabase SQL Editor (staging/dev only)
```

### 5. Run Development Server
```bash
npm run dev
# Open http://localhost:5173
```

### 6. Run Test Suites
```bash
node test/phase12_security_tests.mjs  # Security tests
node test/phase13_demo_readiness.mjs  # Deployment readiness
```

### 7. Production Build
```bash
npm run build
# Outputs to dist/ — no source maps, vendor code-split
```

---

## 🔒 Security & Compliance

| Control | Status |
|---|---|
| Row Level Security (RLS) on all 8 tables | ✅ Enforced |
| No USING(true) / WITH CHECK(true) policies | ✅ Verified by test 23 |
| Service-role key excluded from frontend | ✅ Verified by test 21 |
| Gemini API key server-side only (Edge Function) | ✅ Verified by test 21 |
| No Aadhaar / biometric / caste / religion stored | ✅ Verified by tests 24, 11 |
| Citizens cannot mutate priority scores | ✅ Verified by test 6 |
| Citizens cannot access other citizens' data | ✅ Verified by tests 3–5 |
| Status transitions enforce state machine | ✅ Verified by test 17 |
| Notification immutability trigger | ✅ Phase 12 migration |

Full audit report: [`docs/security-audit.md`](docs/security-audit.md)

---

## 🧭 Phase Completion Status

| Phase | Title | Status |
|:---:|:---|:---:|
| 1 | Frontend Foundation | ✅ Complete |
| 2 | Database & Backend | ✅ Complete |
| 3 | Authentication | ✅ Complete |
| 4 | Complaint Submission | ✅ Complete |
| 5 | Image Storage | ✅ Complete |
| 6 | AI Analysis Pipeline | ✅ Complete |
| 7 | Deterministic Priority Engine | ✅ Complete |
| 8 | Admin Dashboard | ✅ Complete |
| 9 | Duplicate & Recurring Issue Detection | ✅ Complete |
| 10 | Citizen Tracking | ✅ Complete |
| 11 | Notifications | ✅ Complete |
| 12 | Security Hardening & Testing | ✅ Complete |
| 13 | Deployment & Demo Readiness | ✅ Complete |

---

## 📖 Documentation

| Document | Purpose |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System architecture overview |
| [`docs/development-roadmap.md`](docs/development-roadmap.md) | Phase-by-phase roadmap |
| [`docs/manual-setup.md`](docs/manual-setup.md) | Supabase manual setup guide |
| [`docs/deployment.md`](docs/deployment.md) | Production deployment guide (Vercel + Supabase) |
| [`docs/demo-guide.md`](docs/demo-guide.md) | 6-scene demo walkthrough script |
| [`docs/priority-engine.md`](docs/priority-engine.md) | Priority scoring formula documentation |
| [`docs/security-audit.md`](docs/security-audit.md) | OWASP-aligned security audit |
| [`docs/ai-evidence-analysis.md`](docs/ai-evidence-analysis.md) | AI evidence analysis pipeline |
| [`docs/admin-workflow.md`](docs/admin-workflow.md) | Municipal admin workflow |
| [`docs/duplicate-detection.md`](docs/duplicate-detection.md) | Duplicate detection algorithm |
| [`docs/notifications.md`](docs/notifications.md) | Notification system semantics |

---

## ⚖️ Ethical AI Statement

Chandigarh CivicAI is designed with responsible AI principles at its core:

1. **No automation of consequential decisions**: The AI provides ranked evidence assessments; humans make all final determinations.
2. **No protected attributes**: Aadhaar, biometric, religion, caste, gender, and other protected identity attributes are structurally excluded from the system.
3. **Explainability first**: Every priority score is derived from a transparent, documented, deterministic formula — not a black-box model.
4. **Evidence support ≠ proof**: The system never asserts that uploaded images are authentic or that reported locations are accurate.
5. **Citizen data minimization**: Only operationally necessary data is collected and stored.
