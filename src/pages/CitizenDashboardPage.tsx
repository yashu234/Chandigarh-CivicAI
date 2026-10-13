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
    <PageContainer
      maxWidth="xl"
      headerTitle="Citizen Service Portal"
      headerDescription="Track the progress of your reported grievances across Chandigarh municipal departments."
      headerAction={
        <div className="flex items-center gap-2">
          {/* Demo state toggle for testing */}
          <button
            type="button"
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded border border-slate-200 transition-colors"
            title="Toggle between populated and empty states for UI verification"
          >
            {showEmptyState ? 'Show Demo Complaints' : 'Test Empty State'}
          </button>
          <Link to={ROUTES.REPORT_ISSUE}>
            <Button variant="primary" size="md" leftIcon={<PlusCircle className="h-4 w-4" />}>
              Report an Issue
            </Button>
          </Link>
        </div>
      }
    >
      {/* Citizen Welcome Banner */}
      <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
            JA
          </div>
          <div>
            <div className="font-bold text-blue-950 text-sm">Welcome back, Jaswinder Singh</div>
            <p className="text-blue-800 text-xs">
              Resident Account • Sector 17, Chandigarh (UT) • Grievance ID Tracking
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 bg-white/80 px-2.5 py-1 rounded text-blue-900 font-medium text-[11px] border border-blue-200">
          <Sparkles className="h-3 w-3 text-blue-600" />
          <span>Demo Data Mode</span>
        </div>
      </div>

      {/* Top Citizen Service Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card padding="md" className="border-l-4 border-l-slate-700">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Reported</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{total}</div>
          <p className="mt-1 text-[11px] text-slate-500">All submitted grievances</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-amber-700 text-xs">
            <span>Active Grievances</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{active}</div>
          <p className="mt-1 text-[11px] text-slate-500">Under review or field repair</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between text-emerald-700 text-xs">
            <span>Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-700">{resolved}</div>
          <p className="mt-1 text-[11px] text-slate-500">Verified remediations</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-rose-700 text-xs">
            <span>High / Critical Priority</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{highPriority}</div>
          <p className="mt-1 text-[11px] text-slate-500">Flagged for urgent action</p>
        </Card>
      </div>

      {/* Main Grid: Recent Complaints + Helpful Citizen Guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recent Complaints List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader
              title="Recent Reported Issues"
              subtitle="View status updates and explainable priority scores"
              action={
                <Link to={ROUTES.MY_COMPLAINTS}>
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                    View All
                  </Button>
                </Link>
              }
            />

            {citizenComplaints.length === 0 ? (
              <div className="py-10">
                <EmptyState
                  title="No civic issues reported yet"
                  description="When you spot a broken road, pipeline leak, or dark streetlight in Chandigarh, report it with photographic evidence to initiate AI-assisted triage."
                  action={
                    <div className="flex items-center gap-3">
                      <Link to={ROUTES.REPORT_ISSUE}>
                        <Button variant="primary" size="sm" leftIcon={<PlusCircle className="h-4 w-4" />}>
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
              <div className="divide-y divide-slate-100">
                {citizenComplaints.map((item) => {
                  const statusMeta = STATUS_METADATA[item.status];
                  const priorityLevel = item.priorityCalculation?.priorityLevel || 'medium';
                  const priorityScore = item.priorityCalculation?.finalScore;

                  return (
                    <div key={item.id} className="py-4 first:pt-0 last:pb-0 hover:bg-slate-50/50 rounded-lg p-2 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {item.trackingNumber}
                            </span>
                            <Badge variant="secondary" size="sm">
                              {item.category}
                            </Badge>
                            <PriorityIndicator priority={priorityLevel} score={priorityScore} />
                            <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {statusMeta?.label || item.status}
                            </span>
                          </div>

                          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {item.location.sector} • {item.location.landmark || item.location.address}
                            </span>
                            <span className="flex items-center gap-1">
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
                            <Button variant="outline" size="sm" rightIcon={<Eye className="h-3.5 w-3.5" />}>
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
          <Card padding="md" className="bg-slate-900 text-white border-slate-800">
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 text-white">
              <PlusCircle className="h-4 w-4 text-sky-400" />
              Need to Report a New Hazard?
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Snap a clear photo showing both the issue and surrounding context. Our AI assistant will analyze the
              evidence and calculate an explainable priority score for the department.
            </p>
            <div className="mt-4">
              <Link to={ROUTES.REPORT_ISSUE}>
                <Button variant="primary" size="sm" className="w-full">
                  Report an Issue
                </Button>
              </Link>
            </div>
          </Card>

          <Card padding="md">
            <h4 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              Citizen Photography Tips
            </h4>
            <ul className="text-xs text-slate-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Capture context:</strong> Include nearby road markings or curb features so inspectors can locate the hazard.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Ensure good lighting:</strong> Take photos during daylight or use camera flash for night electrical/lighting faults.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">•</span>
                <span><strong>Avoid close-up blur:</strong> Keep a 2–3 meter distance to show scale and pedestrian impact.</span>
              </li>
            </ul>
          </Card>

          <Card padding="md" className="bg-amber-50/60 border-amber-200">
            <h4 className="font-semibold text-amber-950 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-amber-700" />
              Life Safety Emergency?
            </h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              For active sparking power lines or immediate structural collapse, also notify emergency helplines:
            </p>
            <div className="mt-3 text-xs font-mono font-bold text-amber-950 space-y-1">
              <div>UT Police & Disaster: 112</div>
              <div>UT Electricity Faults: 0172-4639999</div>
              <div>Municipal Corp Control: 0172-2787200</div>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};
