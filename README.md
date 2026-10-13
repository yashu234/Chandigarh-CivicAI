# Chandigarh CivicAI

> AI-assisted civic complaint analysis and explainable priority intelligence platform for the Union Territory of Chandigarh.

## 🏛️ Project Purpose

Chandigarh CivicAI bridges citizen grievance reporting and municipal remediation across Chandigarh. It provides citizens with a seamless channel to submit photographic evidence and locations of civic hazards, while equipping municipal administrators with explainable, deterministic priority scoring to systematically triage work orders.

### Core AI Principle: "Evidence Support"
Chandigarh CivicAI is designed around an explicit principle of integrity: **the AI system does NOT claim to prove whether an uploaded image is authentic.**

Instead, it evaluates **Evidence Support** — measuring how strongly the visual features in an uploaded photograph substantiate the severity, location features, and physical hazard described by the citizen. All AI recommendations are explainable and designed to support human administrative discretion.

---

## 🛠️ Technology Stack (Phase 1)

- **Frontend Core**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 (Digital Public Infrastructure aesthetic)
- **Routing**: React Router v7 (`react-router-dom`)
- **Icons**: Lucide React
- **Code Quality**: Oxlint & TypeScript strict mode

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
│   ├── pages/                # 10 Phase 1 placeholder views
│   ├── layouts/              # RootLayout shell
│   ├── routes/               # Declarative client-side routing
│   ├── services/             # API integration service layer (deferred to Phase 2+)
│   ├── hooks/                # Custom React utility hooks
│   ├── types/                # Domain type definitions & AI contracts
│   ├── utils/                # Zero-dependency utilities
│   ├── constants/            # Departments, sectors, and metadata
│   ├── assets/               # Static icons and assets
│   ├── App.tsx               # App router provider
│   └── main.tsx              # Application entry point
│
├── public/                   # Public assets & civic SVG favicon
├── docs/                     # Architectural and roadmap documentation
│   ├── architecture.md
│   ├── development-roadmap.md
│   └── manual-setup.md
│
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore patterns
├── README.md                 # Project overview
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite & Tailwind build configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Build for Production
```bash
npm run build
```

---

## 🧭 Phase 1 Scope & Status

This repository is currently at **Phase 1: Project Foundation Only**.
No databases, authentication providers, AI model inference, or external cloud services are configured in this phase.
See [docs/development-roadmap.md](docs/development-roadmap.md) for the complete phase breakdown.
