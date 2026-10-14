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
  ChevronRight,
  Zap,
  MapPin,
  Clock,
  TrendingUp,
} from 'lucide-react';

/* ── Mini animated stat card for hero ── */
const HeroStatCard: React.FC<{
  icon: React.ReactNode;
  value: string;
  label: string;
  accent: string;
}> = ({ icon, value, label, accent }) => (
  <div className={`glass rounded-xl p-3 border ${accent} flex items-center gap-3 animate-fade-in`}>
    <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div>
      <div className="text-white font-extrabold text-lg leading-none">{value}</div>
      <div className="text-white/60 text-[11px] font-medium mt-0.5">{label}</div>
    </div>
  </div>
);

/* ── Demo complaint card for hero right panel ── */
const DemoComplaintCard: React.FC = () => (
  <div className="glass-dark rounded-2xl p-5 border border-white/10 animate-float">
    <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
        <span className="font-mono text-xs font-bold text-white">CHD-2026-00124</span>
      </div>
      <Badge variant="critical" size="sm">Score: 91.8</Badge>
    </div>

    <div className="space-y-3 text-xs">
      <div>
        <span className="text-white/50 block text-[10px] font-semibold uppercase tracking-wider mb-0.5">
          Classified Issue
        </span>
        <div className="text-white font-semibold text-sm leading-tight">
          Collapsed Road Cavity &amp; Storm Ingress Frame
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/8 p-2.5 rounded-lg border border-white/10">
          <span className="text-white/50 block text-[10px] uppercase tracking-wide mb-0.5">Safety Risk</span>
          <strong className="text-rose-400 text-xs">Severe · 95/100</strong>
        </div>
        <div className="bg-white/8 p-2.5 rounded-lg border border-white/10">
          <span className="text-white/50 block text-[10px] uppercase tracking-wide mb-0.5">Evidence</span>
          <strong className="text-emerald-400 text-xs">Strong · 0.96</strong>
        </div>
      </div>

      {/* Priority score bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/50 font-semibold uppercase tracking-wide">Priority Score</span>
          <span className="text-white font-bold">91.8 / 100</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400"
            style={{ width: '91.8%' }}
          />
        </div>
      </div>

      <div className="bg-sky-500/15 p-2.5 rounded-lg border border-sky-500/30 text-sky-300">
        <span className="font-bold block text-[10px] uppercase tracking-wider mb-0.5 text-sky-200">
          Routing → MCC-ROADS
        </span>
        <span className="text-[11px]">Roads &amp; Civil Works · Sector 17 Sub-Division</span>
      </div>
    </div>
  </div>
);

/* ── Pipeline step card ── */
const PipelineStep: React.FC<{
  phase: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentClass: string;
  delay?: string;
}> = ({ phase, title, description, icon, accentClass, delay }) => (
  <div
    className={`bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/8 hover:border-sky-500/30 transition-all duration-200 animate-fade-in ${delay || ''}`}
  >
    <div className="flex items-center justify-between">
      <span className={`text-[10px] font-bold tracking-widest uppercase ${accentClass}`}>{phase}</span>
      <div className={`${accentClass}`}>{icon}</div>
    </div>
    <div>
      <h4 className="text-sm font-bold text-white leading-tight">{title}</h4>
      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{description}</p>
    </div>
  </div>
);

export const LandingPage: React.FC = () => {
  return (
    <div className="bg-slate-50 text-slate-900">

      {/* ================================================================
          1. HERO SECTION
      ================================================================ */}
      <section className="relative bg-[#0a1628] text-white overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0 dot-grid opacity-100 pointer-events-none" />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-sky-600/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-sky-500/8 blur-3xl pointer-events-none" />

        <PageContainer maxWidth="xl" className="py-0 relative z-10 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── Left: Headline ── */}
            <div className="text-center lg:text-left animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold mb-6">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Digital Public Infrastructure · Chandigarh UT</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
                Smarter Civic<br />
                Services.<br />
                <span className="gradient-text">Faster Action.</span>
              </h1>

              <p className="mt-6 text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Citizens report civic issues with photographic evidence. AI assists municipal
                authorities to analyze hazards, evaluate visual corroboration, and deterministically
                prioritize urgent repairs.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <Link to={ROUTES.REPORT_ISSUE}>
                  <Button variant="sky" size="lg" leftIcon={<Camera className="h-5 w-5" />}>
                    Report an Issue
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white/20 text-slate-200 bg-white/5 hover:bg-white/10 hover:border-sky-400/50"
                  >
                    How It Works
                  </Button>
                </a>
                <Link to={ROUTES.ADMIN_DASHBOARD}>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                  >
                    Municipal Queue
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-10 grid grid-cols-3 gap-3">
                <HeroStatCard
                  icon={<Zap className="h-4 w-4 text-sky-400" />}
                  value="< 2 min"
                  label="AI Analysis"
                  accent="border-sky-500/25"
                />
                <HeroStatCard
                  icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                  value="0–100"
                  label="Priority Score"
                  accent="border-emerald-500/25"
                />
                <HeroStatCard
                  icon={<MapPin className="h-4 w-4 text-amber-400" />}
                  value="62+"
                  label="Sectors Covered"
                  accent="border-amber-500/25"
                />
              </div>
            </div>

            {/* ── Right: Live Demo Card ── */}
            <div className="flex flex-col gap-4 animate-fade-in stagger-2">
              <DemoComplaintCard />

              {/* Secondary info card */}
              <div className="glass rounded-xl p-4 border border-white/10 animate-fade-in stagger-3">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">End-to-End Remediation Pipeline</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['Citizen Report', 'AI Triage', 'Priority Score', 'Dispatch', 'Resolution'].map(
                    (step, i) => (
                      <React.Fragment key={step}>
                        <span className="text-[11px] font-semibold text-slate-300 bg-white/8 px-2 py-0.5 rounded-full border border-white/10">
                          {step}
                        </span>
                        {i < 4 && (
                          <ArrowRight className="h-3 w-3 text-sky-500/60 shrink-0" />
                        )}
                      </React.Fragment>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom: 5-Phase Pipeline Cards ── */}
          <div className="mt-16 pt-10 border-t border-white/10">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                End-to-End Civic Remediation Architecture
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <PipelineStep phase="Phase 01" title="Citizen Report" description="Photo upload, sector selection & hazard description." icon={<Camera className="h-4 w-4" />} accentClass="text-sky-400" delay="stagger-1" />
              <PipelineStep phase="Phase 02" title="AI Evidence Analysis" description="Severity, safety risk & visual corroboration scoring." icon={<Cpu className="h-4 w-4" />} accentClass="text-sky-400" delay="stagger-2" />
              <PipelineStep phase="Phase 03" title="Priority Score" description="Explainable 0–100 triage metric with transparent weights." icon={<BarChart3 className="h-4 w-4" />} accentClass="text-sky-400" delay="stagger-3" />
              <PipelineStep phase="Phase 04" title="Admin Dispatch" description="Officer verification, department dispatch & field orders." icon={<Users2 className="h-4 w-4" />} accentClass="text-sky-400" delay="stagger-4" />
              <PipelineStep phase="Phase 05" title="Verified Resolution" description="Remediation completed, verified & citizen notified." icon={<CheckCircle2 className="h-4 w-4" />} accentClass="text-emerald-400" delay="stagger-5" />
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          2. THE PROBLEM
      ================================================================ */}
      <section className="py-20 bg-white border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="max-w-3xl mb-12 animate-fade-in">
            <span className="section-label bg-rose-50 text-rose-700 border-rose-200">
              Current Municipal Challenge
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
              The Difficulty of Processing Unstructured Civic Complaints
            </h2>
            <p className="text-slate-500 text-sm sm:text-base mt-3 leading-relaxed">
              Every day, Chandigarh civic hotlines receive thousands of unstructured grievances.
              Without objective evidence triage, critical hazards get buried beneath non-urgent complaints.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <AlertTriangle className="h-5 w-5" />,
                iconBg: 'bg-rose-100 text-rose-700',
                accent: 'border-l-rose-500',
                title: 'Unstructured Backlogs',
                body: 'Complaints arrive without standardized formats or severity indicators. Manual sorting takes days, delaying responses to life-safety emergencies.',
              },
              {
                icon: <FileText className="h-5 w-5" />,
                iconBg: 'bg-amber-100 text-amber-700',
                accent: 'border-l-amber-500',
                title: 'Lack of Evidence Verification',
                body: 'Vague text descriptions without photographic corroboration cause misallocated municipal inspection squads and repeat site visits.',
              },
              {
                icon: <Sliders className="h-5 w-5" />,
                iconBg: 'bg-sky-100 text-sky-700',
                accent: 'border-l-sky-500',
                title: 'Opaque Prioritization',
                body: 'First-come-first-served systems treat minor littering identically to exposed electrical wires or collapsed road cavities.',
              },
            ].map((item, i) => (
              <Card
                key={item.title}
                className={`border-l-4 ${item.accent} card-lift animate-fade-in stagger-${i + 1}`}
              >
                <div className={`h-9 w-9 rounded-lg ${item.iconBg} flex items-center justify-center mb-4`}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">{item.body}</p>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          3. THE SOLUTION
      ================================================================ */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div className="animate-fade-in">
              <span className="section-label bg-sky-50 text-sky-700 border-sky-200">
                The Solution
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
                Chandigarh CivicAI: Multimodal Evidence Triage &amp; Transparent Prioritization
              </h2>
              <p className="text-slate-500 text-sm sm:text-base mt-4 leading-relaxed">
                CivicAI bridges citizens and municipal engineers with an explainable AI pipeline.
                A deterministic 0–100 priority score is computed based on observable physical hazards
                and visual evidence support — never a black-box decision.
              </p>

              <div className="mt-6 space-y-4">
                {[
                  {
                    title: 'Objective Visual Corroboration',
                    body: 'Evaluates whether photographs corroborate reported civic damage before field dispatch.',
                    color: 'text-emerald-700 bg-emerald-100',
                  },
                  {
                    title: 'Deterministic Mathematical Formula',
                    body: 'Transparent weights: 35% Severity, 35% Safety Risk, 15% Public Impact, multiplied by evidence confidence.',
                    color: 'text-sky-700 bg-sky-100',
                  },
                  {
                    title: 'Unified Municipal Coordination',
                    body: 'Automated routing to responsible departments across MCC and UT Engineering wings.',
                    color: 'text-amber-700 bg-amber-100',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className={`h-7 w-7 rounded-full ${item.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live demo callout */}
            <div className="bg-[#0a1628] rounded-2xl p-6 sm:p-8 border border-white/10 shadow-xl animate-fade-in stagger-2">
              <div className="text-xs text-sky-400/70 font-bold uppercase tracking-widest mb-4">
                Live Triage Example
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-mono text-xs font-bold text-white">CHD-2026-00124</span>
                </div>
                <Badge variant="critical">Score: 91.8 / 100</Badge>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold text-[10px] uppercase tracking-wide">Classified Issue</span>
                  <div className="font-bold text-white text-sm mt-1">
                    Collapsed Road Cavity &amp; Storm Ingress Frame
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/8 p-3 rounded-lg border border-white/10">
                    <span className="text-slate-500 block text-[10px] uppercase tracking-wide">Safety Risk</span>
                    <strong className="text-rose-400 text-xs">Severe · 95/100</strong>
                  </div>
                  <div className="bg-white/8 p-3 rounded-lg border border-white/10">
                    <span className="text-slate-500 block text-[10px] uppercase tracking-wide">Evidence</span>
                    <strong className="text-emerald-400 text-xs">Strong · 0.96 weight</strong>
                  </div>
                </div>

                <div className="bg-sky-500/15 p-3 rounded-lg border border-sky-500/30 text-sky-300">
                  <span className="font-bold block text-[10px] uppercase tracking-wider text-sky-200 mb-0.5">
                    Routing Recommendation
                  </span>
                  <span>MCC-ROADS · Roads, Pavements &amp; Civil Works · Sector 17 Sub-Division</span>
                </div>

                {/* Score bar */}
                <div>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-slate-500 font-semibold uppercase tracking-wide">Final Priority</span>
                    <span className="text-white font-bold">91.8 / 100 — CRITICAL</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400 animate-fade-in" style={{ width: '91.8%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          4. HOW IT WORKS (5 STEPS)
      ================================================================ */}
      <section id="how-it-works" className="py-20 bg-white border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="section-label bg-sky-50 text-sky-700 border-sky-200">
              Process Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
              From Citizen Report to Field Remediation
            </h2>
            <p className="text-sm text-slate-500 mt-3">
              A transparent, accountable 5-step pipeline connecting citizens and municipal teams.
            </p>
          </div>

          {/* Steps with arrow connectors */}
          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {[
              { num: 1, title: 'Citizen Intake', body: 'Citizen captures photo, specifies sector/landmark, and submits the grievance.', color: 'bg-[#0a1628] text-white', accent: 'border-slate-900/20' },
              { num: 2, title: 'Multimodal AI Triage', body: 'Computer vision & NLP assess detected hazard, severity, and photo corroboration.', color: 'bg-sky-600 text-white', accent: 'border-sky-600/20' },
              { num: 3, title: 'Priority Scoring', body: 'Deterministic calculation assigns priority rank: Critical, High, Medium, or Low.', color: 'bg-sky-700 text-white', accent: 'border-sky-700/20' },
              { num: 4, title: 'Admin Dispatch', body: 'Municipal officers review AI findings and dispatch field remediation work orders.', color: 'bg-amber-500 text-slate-950', accent: 'border-amber-500/20' },
              { num: 5, title: 'Resolution & Audit', body: 'Field work verified, citizen receives closure notification, and audit trail logged.', color: 'bg-emerald-600 text-white', accent: 'border-emerald-600/20' },
            ].map((step, i) => (
              <React.Fragment key={step.num}>
                <div className={`flex-1 bg-slate-50 border border-slate-200 rounded-xl p-5 animate-fade-in stagger-${i + 1} card-lift`}>
                  <div className={`h-9 w-9 rounded-xl ${step.color} flex items-center justify-center font-extrabold text-sm mb-4 shadow-sm`}>
                    {step.num}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{step.title}</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{step.body}</p>
                </div>
                {i < 4 && (
                  <div className="hidden md:flex items-center justify-center px-1 shrink-0 text-sky-400/50">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          5. AI ANALYSIS DIMENSIONS
      ================================================================ */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="section-label bg-sky-50 text-sky-700 border-sky-200">
              Explainable Intelligence
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
              AI-Assisted Evidence Analysis Dimensions
            </h2>
            <p className="text-sm text-slate-500 mt-3">
              Every civic complaint is evaluated across 6 objective dimensions for transparent prioritization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Eye, bg: 'bg-sky-100', fg: 'text-sky-700', title: 'Image Analysis', body: 'Computer vision identifies visual features like road surface fractures, ruptured water mains, structural tilting, or hazardous debris accumulation.' },
              { icon: FileText, bg: 'bg-indigo-100', fg: 'text-indigo-700', title: 'Description Analysis', body: 'Natural Language Processing parses the citizen\'s statement to extract hazard details, traffic conditions, pedestrian proximity, and reported duration.' },
              { icon: ShieldCheck, bg: 'bg-emerald-100', fg: 'text-emerald-700', title: 'Evidence Support', body: 'Measures whether the uploaded image coherently substantiates the reported issue. We deliberately avoid claiming "authenticity verification."' },
              { icon: Construction, bg: 'bg-amber-100', fg: 'text-amber-700', title: 'Structural Severity', body: 'Estimates the physical degradation scale — cavity depth, water volume loss, or electrical conductor displacement on municipal infrastructure.' },
              { icon: AlertTriangle, bg: 'bg-rose-100', fg: 'text-rose-700', title: 'Safety Risk', body: 'Evaluates immediate threat to human life, vehicular skidding, electrocution risk, or senior citizen falls along Chandigarh streets and corridors.' },
              { icon: BarChart3, bg: 'bg-purple-100', fg: 'text-purple-700', title: 'Priority Scoring', body: 'Synthesizes all dimensions into a transparent 0–100 score that determines automated position in the municipal administrator priority triage queue.' },
            ].map((item, i) => (
              <Card key={item.title} className={`card-lift animate-fade-in stagger-${(i % 3) + 1}`} lift>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 ${item.bg} ${item.fg} rounded-xl`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          6. GOVERNANCE & ETHICS (dark panel)
      ================================================================ */}
      <section className="py-16 bg-white border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="bg-[#0a1628] text-white rounded-2xl p-8 sm:p-12 relative overflow-hidden">
            {/* Dot grid */}
            <div className="absolute inset-0 dot-grid opacity-100 rounded-2xl pointer-events-none" />
            {/* Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-sky-600/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-400 text-xs font-bold mb-5 tracking-wide">
                <ShieldCheck className="h-4 w-4" />
                Governance &amp; Ethical AI Principle
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Human Administrators Retain Final Authority
              </h2>
              <p className="text-slate-300 text-sm sm:text-base mt-4 leading-relaxed">
                Chandigarh CivicAI adheres to strict public governance standards: AI generates objective,
                explainable recommendations to assist triage, but human municipal engineers and administrators
                remain entirely responsible for all final dispatch, override, and closure decisions.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: 'Explainable Reasoning', body: 'Every score shows the exact mathematical contribution of severity, safety, and evidence weights.', color: 'border-sky-500/30 bg-sky-500/8' },
                  { title: 'Human Override', body: 'Officers can adjust priority ranks with recorded notes for departmental auditing.', color: 'border-amber-400/30 bg-amber-400/8' },
                  { title: 'No False Claims', body: 'Evidence Support represents corroboration level, not absolute forensic authenticity guarantees.', color: 'border-emerald-400/30 bg-emerald-400/8' },
                ].map((item) => (
                  <div key={item.title} className={`p-4 rounded-xl border ${item.color}`}>
                    <strong className="text-white block font-bold mb-1.5 text-sm">{item.title}</strong>
                    <span className="text-slate-400 text-xs leading-relaxed">{item.body}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          7. CIVIC CATEGORIES
      ================================================================ */}
      <section className="py-20 bg-slate-50 border-b border-slate-200">
        <PageContainer maxWidth="xl" className="py-0">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="section-label bg-sky-50 text-sky-700 border-sky-200">
              Jurisdictional Scope
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
              Supported Civic Categories
            </h2>
            <p className="text-sm text-slate-500 mt-3">
              Routed to designated wings of Municipal Corporation Chandigarh (MCC) and UT Engineering Departments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Trash2, bg: 'bg-amber-100', fg: 'text-amber-700', title: 'Waste & Sanitation', body: 'Commercial dumpster overflow, public littering, dumping on vacant plots, unsanitary conditions.', wing: 'MCC-SWM (Solid Waste Management)' },
              { icon: Construction, bg: 'bg-sky-100', fg: 'text-sky-700', title: 'Roads & Pavements', body: 'Potholes, asphalt road caving, broken kerb channels, damaged footpaths, and storm grates.', wing: 'MCC-ROADS (Civil Works Wing)' },
              { icon: Droplets, bg: 'bg-cyan-100', fg: 'text-cyan-700', title: 'Water Supply', body: 'Pressurized pipeline ruptures, low pressure, dirty water supply, and valve leakages.', wing: 'MCC-WATER (Public Health Division)' },
              { icon: Lightbulb, bg: 'bg-yellow-100', fg: 'text-yellow-700', title: 'Streetlights & Lighting', body: 'Non-functional luminaires, high-mast outages, open junction boxes, and dangling electrical wires.', wing: 'UT-ELEC (Electricity Department)' },
              { icon: Waves, bg: 'bg-indigo-100', fg: 'text-indigo-700', title: 'Drainage & Sewage', body: 'Choked stormwater inlets, waterlogging, sewage backflow, and missing manhole covers.', wing: 'MCC-WATER (Drainage Wing)' },
              { icon: Compass, bg: 'bg-emerald-100', fg: 'text-emerald-700', title: 'Public Obstruction', body: 'Fallen branches, damaged signage, construction debris on lanes, and illegal encroachment.', wing: 'MCC-HORT / UT-TRAFFIC' },
            ].map((item, i) => (
              <Card key={item.title} className={`hover:border-sky-300 transition-all duration-200 card-lift animate-fade-in stagger-${(i % 3) + 1}`} lift>
                <div className={`h-11 w-11 rounded-xl ${item.bg} ${item.fg} flex items-center justify-center mb-4`}>
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">{item.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{item.body}</p>
                <div className="mt-3 text-[10px] font-bold text-sky-700 font-mono tracking-wide flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {item.wing}
                </div>
              </Card>
            ))}
          </div>
        </PageContainer>
      </section>

      {/* ================================================================
          8. FINAL CTA
      ================================================================ */}
      <section className="py-20 bg-white">
        <PageContainer maxWidth="md" className="py-0 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Get Started Today
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Ready to improve Chandigarh's urban infrastructure?
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-4 max-w-xl mx-auto leading-relaxed">
            Report hazards in seconds with photographic evidence, or inspect the municipal triage queue
            to see how issues across your sector are being resolved.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={ROUTES.REPORT_ISSUE}>
              <Button variant="sky" size="lg" leftIcon={<Camera className="h-5 w-5" />}>
                Report an Issue
              </Button>
            </Link>
            <Link to={ROUTES.CITIZEN_DASHBOARD}>
              <Button variant="outline" size="lg">
                Citizen Portal
              </Button>
            </Link>
            <Link to={ROUTES.ADMIN_DASHBOARD}>
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Municipal Queue
              </Button>
            </Link>
          </div>
        </PageContainer>
      </section>
    </div>
  );
};
