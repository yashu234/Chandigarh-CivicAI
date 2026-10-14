import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, STATUS_METADATA } from '../constants';
import { getCitizenMockComplaints } from '../data/mockComplaints';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PriorityIndicator } from '../components/common/PriorityIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  ArrowRight,
  MapPin,
  Calendar,
  Sparkles,
  HelpCircle,
  PhoneCall,
  Eye,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const CitizenDashboardPage: React.FC = () => {
  // Demonstration mode: toggle between realistic mock citizen complaints and empty state
  const [showEmptyState, setShowEmptyState] = useState(false);

  const citizenComplaints = showEmptyState ? [] : getCitizenMockComplaints();

  // Metrics derived from the current view
  const total = citizenComplaints.length;
  const active = citizenComplaints.filter((c) => c.status !== 'resolved' && c.status !== 'rejected').length;
  const resolved = citizenComplaints.filter((c) => c.status === 'resolved').length;
  const highPriority = citizenComplaints.filter(
    (c) => c.priorityCalculation?.priorityLevel === 'critical' || c.priorityCalculation?.priorityLevel === 'high'
  ).length;

  return (
    <div className="page-enter py-4 sm:py-6">
      <PageContainer
        maxWidth="xl"
        headerTitle="Citizen Grievance Portal"
        headerDescription="Track the real-time progress and explainable AI prioritization of your reported issues across Chandigarh municipal wings."
        headerAction={
          <div className="flex items-center gap-2">
            {/* Demo state toggle for testing */}
            <button
              type="button"
              onClick={() => setShowEmptyState(!showEmptyState)}
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors shadow-xs"
              title="Toggle between populated and empty states for UI verification"
            >
              {showEmptyState ? 'Show Demo Complaints' : 'Test Empty State'}
            </button>
            <Link to={ROUTES.REPORT_ISSUE}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<PlusCircle className="h-4 w-4" />}
                className="btn-gradient-sky"
              >
                Report an Issue
              </Button>
            </Link>
          </div>
        }
      >
        {/* Citizen Welcome Banner */}
        <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-[#0a1628] text-white border border-sky-500/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-40 bg-gradient-to-bl from-sky-500/10 via-transparent to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white flex items-center justify-center font-extrabold text-base shadow-glow-sky shrink-0">
                JS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                    Welcome back, Jaswinder Singh
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-sky-400 bg-sky-500/15 border border-sky-400/30 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="h-3 w-3" />
                    Verified Resident
                  </span>
                </div>
                <p className="text-slate-300 text-xs mt-0.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-sky-300">
                    <Building className="h-3 w-3 text-sky-400" /> Sector 17, Chandigarh (UT)
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Citizen ID: CHD-RES-7102</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg text-sky-300 font-semibold text-xs border border-white/15 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                <span>Explainable AI Engine Active</span>
              </span>
            </div>
          </div>
        </div>

        {/* Top Citizen Service Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card padding="md" className="stat-card card-lift border-slate-200/80 bg-white">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Reported</span>
              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <FileText className="h-4 w-4 text-slate-600" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-black text-slate-900 tracking-tight">{total}</div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">All submitted grievances</p>
          </Card>

          <Card padding="md" className="stat-card card-lift border-amber-200/60 bg-white">
            <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
              <span>Active Grievances</span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-black text-amber-600 tracking-tight">{active}</div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">Under review or field repair</p>
          </Card>

          <Card padding="md" className="stat-card card-lift border-emerald-200/60 bg-white">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
              <span>Resolved</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-black text-emerald-600 tracking-tight">{resolved}</div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">Verified remediations</p>
          </Card>

          <Card padding="md" className="stat-card card-lift border-rose-200/60 bg-white">
            <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
              <span>High / Critical</span>
              <div className="h-8 w-8 rounded-lg bg-rose-50 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-black text-rose-600 tracking-tight">{highPriority}</div>
            <p className="mt-1 text-[11px] text-slate-500 font-medium">Flagged for urgent action</p>
          </Card>
        </div>

        {/* Main Grid: Recent Complaints + Helpful Citizen Guidance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Recent Complaints List */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader
                title="Recent Reported Issues"
                subtitle="Live status updates and deterministic priority assessments"
                action={
                  <Link to={ROUTES.MY_COMPLAINTS}>
                    <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                      View All Grievances
                    </Button>
                  </Link>
                }
              />

              {citizenComplaints.length === 0 ? (
                <div className="py-12 px-4">
                  <EmptyState
                    title="No civic issues reported yet"
                    description="When you spot a broken road, pipeline leak, or dark streetlight in Chandigarh, report it with photographic evidence to initiate AI-assisted triage."
                    action={
                      <div className="flex items-center gap-3">
                        <Link to={ROUTES.REPORT_ISSUE}>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<PlusCircle className="h-4 w-4" />}
                            className="btn-gradient-sky"
                          >
                            Report an Issue Now
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" onClick={() => setShowEmptyState(false)}>
                          Restore Demo Data
                        </Button>
                      </div>
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-slate-100 p-2">
                  {citizenComplaints.map((item) => {
                    const statusMeta = STATUS_METADATA[item.status];
                    const priorityLevel = item.priorityCalculation?.priorityLevel || 'medium';
                    const priorityScore = item.priorityCalculation?.finalScore;

                    return (
                      <div
                        key={item.id}
                        className="p-4 hover:bg-slate-50/80 rounded-xl transition-all card-lift"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-sky-950 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
                                {item.trackingNumber}
                              </span>
                              <Badge variant="secondary" size="sm">
                                {item.category}
                              </Badge>
                              <PriorityIndicator priority={priorityLevel} score={priorityScore} />
                              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                {statusMeta?.label || item.status}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-slate-900 hover:text-sky-600 transition-colors">
                              {item.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5 font-medium">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                {item.location.sector} • {item.location.landmark || item.location.address}
                              </span>
                              <span className="flex items-center gap-1.5 font-medium">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                {new Date(item.createdAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                            <Link to={ROUTES.COMPLAINT_DETAILS(item.id)}>
                              <Button
                                variant="outline"
                                size="sm"
                                rightIcon={<Eye className="h-3.5 w-3.5 text-sky-600" />}
                                className="hover:border-sky-300"
                              >
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Col: Citizen Guidance & Emergency Information */}
          <div className="space-y-6">
            <Card
              padding="lg"
              className="bg-gradient-to-br from-[#0a1628] to-[#143058] text-white border-slate-800 shadow-xl relative overflow-hidden"
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-sky-500/10 blur-xl pointer-events-none" />
              <h3 className="font-extrabold text-sm tracking-tight flex items-center gap-2 text-white">
                <PlusCircle className="h-4 w-4 text-sky-400" />
                Need to Report a New Hazard?
              </h3>
              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                Snap a clear photo showing both the issue and surrounding context. Our AI assistant will analyze the
                evidence and calculate an explainable priority score for the department.
              </p>
              <div className="mt-5">
                <Link to={ROUTES.REPORT_ISSUE}>
                  <Button variant="primary" size="sm" className="w-full btn-gradient-sky">
                    Report an Issue Now
                  </Button>
                </Link>
              </div>
            </Card>

            <Card padding="md" className="border-slate-200/80">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3.5 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-sky-600" />
                Photography Evidence Best Practices
              </h4>
              <ul className="text-xs text-slate-600 space-y-2.5">
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Capture surroundings:</strong> Include nearby road markings or curb features so inspectors can locate the hazard.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Ensure good lighting:</strong> Take photos during daylight or use flash for night electrical/lighting faults.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-1.5 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Avoid close-up blur:</strong> Keep a 2–3 meter distance to show scale and pedestrian impact.
                  </span>
                </li>
              </ul>
            </Card>

            <Card padding="md" className="bg-amber-50/70 border-amber-200/80">
              <h4 className="font-bold text-amber-950 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-amber-700" />
                Life Safety Emergency?
              </h4>
              <p className="text-xs text-amber-900 leading-relaxed">
                For active sparking power lines or immediate structural collapse, notify emergency helplines directly:
              </p>
              <div className="mt-3 text-xs font-mono font-bold text-amber-950 space-y-1.5 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="text-amber-800 font-sans font-medium text-[11px]">UT Police & Disaster:</span>
                  <span className="text-amber-950">112</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-800 font-sans font-medium text-[11px]">UT Electricity Faults:</span>
                  <span className="text-amber-950">0172-4639999</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-800 font-sans font-medium text-[11px]">Municipal Corporation:</span>
                  <span className="text-amber-950">0172-2787200</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
};

export default CitizenDashboardPage;
