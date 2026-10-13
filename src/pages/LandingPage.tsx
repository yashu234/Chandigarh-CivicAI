import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  Camera,
  Cpu,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Droplets,
  Construction,
  Lightbulb,
  Trash2,
  Waves,
  Eye,
  Sliders,
  Users2,
  Compass,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="bg-slate-50 text-slate-900">
      {/* 1. HERO SECTION */}
      <section className="relative bg-slate-900 text-white pt-16 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-800 overflow-hidden">
        {/* Subtle geometric background grid for civic infrastructure feel */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <PageContainer maxWidth="xl" className="py-0 relative z-10">
          <div className="max-w-3xl mx-auto text-center lg:text-left lg:mx-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700 text-sky-400 text-xs font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Digital Public Infrastructure • Chandigarh UT</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Smarter Civic Services.<br />
              <span className="text-sky-400">Faster Action.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl">
              Citizens report civic issues with photographic evidence, while AI assists Chandigarh municipal authorities
              to analyze hazards, evaluate visual corroboration, and deterministically prioritize urgent repairs.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
              <Link to={ROUTES.REPORT_ISSUE}>
                <Button variant="primary" size="lg" leftIcon={<Camera className="h-5 w-5" />}>
                  Report an Issue
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="border-slate-700 text-slate-200 hover:bg-slate-800">
                  How It Works
                </Button>
              </a>
              <Link to={ROUTES.ADMIN_DASHBOARD}>
                <Button variant="ghost" size="lg" className="text-amber-300 hover:text-amber-200 hover:bg-slate-800/60">
                  Municipal Priority Queue →
                </Button>
              </Link>
            </div>
          </div>

          {/* Civic Pipeline Flow Visual Representation */}
          <div className="mt-14 sm:mt-16 pt-10 border-t border-slate-800/80">
            <div className="text-center sm:text-left mb-6">
              <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                End-to-End Civic Remediation Architecture
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {/* Step 1 */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-sky-400 tracking-wider">PHASE 01</span>
                  <Camera className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Citizen Report</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Photo upload, sector selection & hazard description.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-sky-400 tracking-wider">PHASE 02</span>
                  <Cpu className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">AI Evidence Analysis</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Severity, safety risk & visual corroboration scoring.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-sky-400 tracking-wider">PHASE 03</span>
                  <BarChart3 className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Priority Score</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Explainable 0–100 triage metric with transparent weights.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-sky-400 tracking-wider">PHASE 04</span>
                  <Users2 className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Administrative Action</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Officer verification, department dispatch & field orders.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-emerald-400 tracking-wider">PHASE 05</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Verified Resolution</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Remediation completed, verified & citizen notified.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 2. THE PROBLEM */}
      <section className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded">
              Current Municipal Challenge
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 tracking-tight">
              The Difficulty of Processing Unstructured Civic Complaints
            </h2>
            <p className="text-slate-600 text-sm sm:text-base mt-3 leading-relaxed">
              Every day, Chandigarh civic hotlines and municipal portals receive thousands of unstructured grievances.
              Without objective evidence triage, critical hazards often get buried beneath non-urgent complaints.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-rose-500">
              <div className="h-9 w-9 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center mb-3">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Unstructured Backlogs</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Complaints arrive without standardized formats or severity indicators. Manual sorting takes days,
                delaying responses to life-safety emergencies.
              </p>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <div className="h-9 w-9 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Lack of Evidence Verification</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                Vague text descriptions without photographic corroboration cause misallocated municipal inspection squads
                and repeat site visits.
              </p>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <div className="h-9 w-9 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                <Sliders className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Opaque Prioritization</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                First-come-first-served systems treat minor cosmetic littering identically to exposed electrical wires or
                collapsed road cavities.
              </p>
            </Card>
          </div>
        </PageContainer>
      </section>

      {/* 3. THE SOLUTION */}
      <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
                The Solution
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 tracking-tight">
                Chandigarh CivicAI: Multimodal Evidence Triage & Transparent Prioritization
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-4 leading-relaxed">
                Chandigarh CivicAI bridges citizens and municipal engineers with an explainable AI pipeline.
                Instead of opaque black-box decisions, CivicAI computes a deterministic 0–100 priority score
                based on observable physical hazards and visual evidence support.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Objective Visual Corroboration</h4>
                    <p className="text-xs text-slate-600">
                      Evaluates whether photographs corroborate reported civic damage before field dispatch.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Deterministic Mathematical Formula</h4>
                    <p className="text-xs text-slate-600">
                      Transparent weights: 35% Severity, 35% Safety Risk, 15% Public Impact, multiplied by evidence confidence.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Unified Municipal Coordination</h4>
                    <p className="text-xs text-slate-600">
                      Automated routing to responsible departments across MCC and UT Engineering wings.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Callout Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />
                  <span className="font-mono text-xs font-bold text-slate-900">CHD-2026-00124</span>
                </div>
                <Badge variant="critical">Score: 91.8 / 100</Badge>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Classified Issue:</span>
                  <div className="font-semibold text-slate-900 text-sm mt-0.5">
                    Collapsed Road Cavity & Storm Ingress Frame
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Safety Risk Factor</span>
                    <strong className="text-red-700 text-xs">Severe (95/100)</strong>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                    <span className="text-slate-500 block text-[11px]">Evidence Support</span>
                    <strong className="text-emerald-700 text-xs">Strong (0.96 weight)</strong>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-md border border-blue-200 text-blue-900">
                  <span className="font-semibold block text-[11px] uppercase tracking-wider text-blue-950">
                    Routing Recommendation
                  </span>
                  <span className="text-xs mt-0.5 block">
                    MCC-ROADS (Roads, Pavements & Civil Works) • Sector 17 Sub-Division
                  </span>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 4. HOW IT WORKS (5 STEPS) */}
      <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
              Process Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 tracking-tight">
              From Citizen Report to Field Remediation
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              A transparent, accountable 5-step pipeline connecting citizens and municipal teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">
                1
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Citizen Intake</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Citizen captures photo, specifies sector/landmark, and submits the grievance.
              </p>
            </div>

            <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">
                2
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Multimodal AI Triage</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Computer vision & NLP assess detected hazard, severity, and photo corroboration.
              </p>
            </div>

            <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">
                3
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Priority Scoring</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Deterministic calculation assigns priority rank (Critical, High, Medium, Low).
              </p>
            </div>

            <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs mb-3">
                4
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Admin Dispatch</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Municipal officers review AI findings and dispatch field remediation work orders.
              </p>
            </div>

            <div className="relative bg-slate-50 border border-slate-200 rounded-lg p-5">
              <div className="h-8 w-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs mb-3">
                5
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Resolution & Audit</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Field work verified, citizen receives closure notification, and audit trail logged.
              </p>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 5. AI-ASSISTED ANALYSIS CAPABILITIES */}
      <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 bg-sky-50 px-2.5 py-1 rounded">
              Explainable Intelligence
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 tracking-tight">
              AI-Assisted Evidence Analysis Dimensions
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Every civic complaint is evaluated across 6 objective dimensions to ensure transparent prioritization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-md">
                  <Eye className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base">Image Analysis</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Computer vision identifies visual features like road surface fractures, ruptured water mains,
                structural tilting, or hazardous debris accumulation.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-md">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base">Description Analysis</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Natural Language Processing parses the citizen's statement to extract specific hazard details,
                traffic conditions, pedestrian proximity, and reported duration.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-md">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base">Evidence Support</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Measures whether the uploaded image coherently substantiates the reported issue.
                We deliberately avoid claiming "authenticity verification."
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-50 text-amber-700 rounded-md">
                  <Construction className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base">Structural Severity</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Estimates the physical degradation scale—such as cavity depth, water volume loss, or electrical
                conductor displacement—on municipal infrastructure.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-50 text-rose-700 rounded-md">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base">Safety Risk</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Evaluates immediate threat to human life, vehicular skidding, electrocution risk, or senior citizen
                falls along Chandigarh streets and corridors.
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-50 text-purple-700 rounded-md">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 text-base">Priority Scoring</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Synthesizes all dimensions into a transparent 0–100 score that determines automated position
                in the municipal administrator priority triage queue.
              </p>
            </Card>
          </div>
        </PageContainer>
      </section>

      {/* 6. TRANSPARENCY & HUMAN-IN-THE-LOOP PRINCIPLES */}
      <section className="py-16 bg-white border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-12 relative overflow-hidden">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-amber-400 text-xs font-semibold mb-4">
                <ShieldCheck className="h-4 w-4" />
                <span>Governance & Ethical AI Principle</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Human Administrators Retain Final Authority
              </h2>
              <p className="text-slate-300 text-sm sm:text-base mt-4 leading-relaxed">
                Chandigarh CivicAI adheres to strict public governance standards: AI generates objective,
                explainable recommendations to assist triage, but human municipal engineers and administrators
                remain entirely responsible for all final dispatch, override, and closure decisions.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
                  <strong className="text-white block font-semibold mb-1">Explainable Reasoning</strong>
                  <span className="text-slate-400">
                    Every score shows the exact mathematical contribution of severity, safety, and evidence weights.
                  </span>
                </div>
                <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
                  <strong className="text-white block font-semibold mb-1">Human Override</strong>
                  <span className="text-slate-400">
                    Officers can adjust priority ranks with recorded notes for departmental auditing.
                  </span>
                </div>
                <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
                  <strong className="text-white block font-semibold mb-1">No False Claims</strong>
                  <span className="text-slate-400">
                    Evidence Support represents corroboration level, not absolute forensic authenticity guarantees.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 7. CIVIC CATEGORIES */}
      <section className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded">
              Jurisdictional Scope
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3 tracking-tight">
              Supported Civic Categories
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Routed to designated wings of Municipal Corporation Chandigarh (MCC) and UT Engineering Departments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:border-blue-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Waste & Sanitation</h3>
              <p className="text-xs text-slate-500 mt-1">
                Commercial dumpster overflow, public littering, dumping on vacant plots, and unsanitary conditions.
              </p>
              <div className="mt-3 font-mono text-[11px] text-blue-800 font-semibold">
                Wing: MCC-SWM (Solid Waste Management)
              </div>
            </Card>

            <Card className="hover:border-blue-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
                <Construction className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Roads & Pavements</h3>
              <p className="text-xs text-slate-500 mt-1">
                Potholes, asphalt road caving, broken kerb channels, damaged footpaths, and storm grates.
              </p>
              <div className="mt-3 font-mono text-[11px] text-blue-800 font-semibold">
                Wing: MCC-ROADS (Civil Works Wing)
              </div>
            </Card>

            <Card className="hover:border-blue-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center mb-3">
                <Droplets className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Water Supply</h3>
              <p className="text-xs text-slate-500 mt-1">
                Pressurized pipeline ruptures, low pressure, dirty water supply, and valve leakages.
              </p>
              <div className="mt-3 font-mono text-[11px] text-blue-800 font-semibold">
                Wing: MCC-WATER (Public Health Division)
              </div>
            </Card>

            <Card className="hover:border-blue-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-yellow-50 text-yellow-700 flex items-center justify-center mb-3">
                <Lightbulb className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Streetlights & Lighting</h3>
              <p className="text-xs text-slate-500 mt-1">
                Non-functional luminaires, high-mast outages, open junction boxes, and dangling electrical wires.
              </p>
              <div className="mt-3 font-mono text-[11px] text-blue-800 font-semibold">
                Wing: UT-ELEC (Electricity Department)
              </div>
            </Card>

            <Card className="hover:border-blue-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center mb-3">
                <Waves className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Drainage & Sewage</h3>
              <p className="text-xs text-slate-500 mt-1">
                Choked stormwater inlets, waterlogging during precipitation, sewage backflow, and missing manhole covers.
              </p>
              <div className="mt-3 font-mono text-[11px] text-blue-800 font-semibold">
                Wing: MCC-WATER (Drainage Wing)
              </div>
            </Card>

            <Card className="hover:border-blue-300 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Public Obstruction</h3>
              <p className="text-xs text-slate-500 mt-1">
                Fallen branches across carriageways, damaged signage, construction debris on lanes, and illegal encroachment.
              </p>
              <div className="mt-3 font-mono text-[11px] text-blue-800 font-semibold">
                Wing: MCC-HORT / UT-TRAFFIC
              </div>
            </Card>
          </div>
        </PageContainer>
      </section>

      {/* 8. FINAL CTA */}
      <section className="py-16 sm:py-20 bg-white border-b border-slate-200">
        <PageContainer maxWidth="md" className="py-0 text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Ready to improve Chandigarh's urban infrastructure?
          </h2>
          <p className="text-slate-600 text-sm sm:text-base mt-4 max-w-xl mx-auto leading-relaxed">
            Report hazards in seconds with photographic evidence, or inspect the municipal triage queue to see
            how issues across your sector are being resolved.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={ROUTES.REPORT_ISSUE}>
              <Button variant="primary" size="lg" leftIcon={<Camera className="h-5 w-5" />}>
                Report an Issue
              </Button>
            </Link>
            <Link to={ROUTES.CITIZEN_DASHBOARD}>
              <Button variant="outline" size="lg">
                View Citizen Portal
              </Button>
            </Link>
            <Link to={ROUTES.ADMIN_DASHBOARD}>
              <Button variant="secondary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Municipal Queue
              </Button>
            </Link>
          </div>
        </PageContainer>
      </section>
    </div>
  );
};
