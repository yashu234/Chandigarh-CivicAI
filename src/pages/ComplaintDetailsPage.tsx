import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ROUTES, STATUS_METADATA } from '../constants';
import { getMockComplaintById, MOCK_COMPLAINTS } from '../data/mockComplaints';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EvidenceSupportBadge } from '../components/common/EvidenceSupportBadge';
import { PriorityIndicator } from '../components/common/PriorityIndicator';
import {
  ArrowLeft,
  MapPin,
  Building,
  Sparkles,
  Calendar,
  CheckCircle2,
  User,
  Database,
  Clock,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  History,
  Check,
} from 'lucide-react';
import type { Complaint, CitizenStatusTimelineItem } from '../types';
import { getComplaintByIdOrTracking, getCitizenStatusTimeline } from '../services/complaintsService';
import {
  CITIZEN_SAFE_STATUS_MAPPINGS,
} from '../services/notifications/citizenSafeMessages';
import {
  getAssessmentForComplaint,
  triggerComplaintAnalysis,
} from '../services/ai/aiAssessmentService';
import type { StructuredAIAssessment, AIAnalysisState } from '../services/ai/aiAssessmentTypes';
import { calculatePriorityFromAIAssessment } from '../services/priority/priorityEngine';

export const ComplaintDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [isLiveRecord, setIsLiveRecord] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [assessment, setAssessment] = useState<StructuredAIAssessment | null>(null);
  const [assessmentState, setAssessmentState] = useState<AIAnalysisState>('pending');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<CitizenStatusTimelineItem[]>([]);

  const priorityResult = React.useMemo(() => {
    if (!isLiveRecord) return null;
    return calculatePriorityFromAIAssessment(assessment);
  }, [isLiveRecord, assessment]);

  const handleAnalyzeEvidence = async (reanalyze = false) => {
    if (!complaint || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    const result = await triggerComplaintAnalysis({
      complaintId: complaint.id,
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      sector: complaint.location.sector,
      reanalyze,
    });

    setIsAnalyzing(false);

    if (result.state === 'completed' && result.data) {
      setAssessment(result.data);
      setAssessmentState('completed');
    } else if (result.state === 'not_configured') {
      setAssessment(result.data);
      setAssessmentState('not_configured');
      if (result.error) {
        setAnalysisError(result.error.message);
      }
    } else {
      setAssessmentState('failed');
      setAnalysisError(result.error?.message || 'AI evidence analysis failed.');
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadComplaint() {
      if (!id) {
        setComplaint(MOCK_COMPLAINTS[0]);
        setIsLoading(false);
        return;
      }

      // 1. Check live database first
      const { data: liveData } = await getComplaintByIdOrTracking(id);
      if (!isMounted) return;

      if (liveData) {
        setComplaint(liveData);
        setIsLiveRecord(true);

        // Fetch real AI assessment record from public.ai_assessments
        const { data: assessmentData, state: fetchedState } = await getAssessmentForComplaint(
          liveData.id
        );
        // Fetch persisted citizen status timeline
        const { data: timelineData } = await getCitizenStatusTimeline(
          liveData.id,
          liveData.createdAt,
          liveData.status
        );
        if (isMounted) {
          setTimeline(timelineData);
          setAssessment(assessmentData);
          setAssessmentState(fetchedState);
          setIsLoading(false);
        }
        return;
      }

      // 2. Fall back to mock complaints
      const mockData = getMockComplaintById(id) || MOCK_COMPLAINTS[0];
      setComplaint(mockData);
      setIsLiveRecord(false);
      const { data: mockTimelineData } = await getCitizenStatusTimeline(
        mockData.id,
        mockData.createdAt,
        mockData.status
      );
      if (isMounted) {
        setTimeline(mockTimelineData);
        setIsLoading(false);
      }
    }

    loadComplaint();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading || !complaint) {
    return (
      <PageContainer maxWidth="xl" className="py-20 text-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-slate-800">Loading Complaint Record...</h3>
        <p className="text-xs text-slate-500 mt-1">Retrieving details and evidence from database.</p>
      </PageContainer>
    );
  }

  const priorityScore = complaint.priorityCalculation?.finalScore;
  const priorityLevel = complaint.priorityCalculation?.priorityLevel || 'medium';

  return (
    <PageContainer
      maxWidth="xl"
      headerTitle={`Complaint Record: ${complaint.trackingNumber}`}
      headerDescription="Citizen tracking view showing remediation status, photographic evidence, and explainable AI triage."
      headerAction={
        <div className="flex items-center gap-2">
          <Link to={ROUTES.MY_COMPLAINTS}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to My Complaints
            </Button>
          </Link>
          <Link to={ROUTES.REPORT_ISSUE}>
            <Button variant="primary" size="sm">
              New Grievance
            </Button>
          </Link>
        </div>
      }
    >
      {/* Live vs Demonstration Data Notice */}
      {isLiveRecord ? (
        <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
          <Database className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-emerald-950">Verified Live Database Record:</span>
            <span className="text-emerald-900 ml-1">
              This grievance was submitted directly through your authenticated session and is persisted in the
              Supabase <code>public.complaints</code> database with private evidence storage.
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-blue-950">Demonstration Interface Mode:</span>
            <span className="text-blue-800 ml-1">
              Metrics and triage values displayed below represent simulated test data to demonstrate the explainable
              AI evaluation pipeline.
            </span>
          </div>
        </div>
      )}

      {/* PERSISTED STATUS TIMELINE & LATEST UPDATE SECTION */}
      <Card className="mb-8">
        <CardHeader
          title="Remediation Status Timeline"
          subtitle="Persisted lifecycle tracking from municipal complaint status history"
          action={
            <Badge
              variant={
                complaint.status === 'resolved'
                  ? 'success'
                  : complaint.status === 'rejected'
                  ? 'danger'
                  : complaint.status === 'duplicate'
                  ? 'neutral'
                  : 'primary'
              }
              size="sm"
            >
              Status: {CITIZEN_SAFE_STATUS_MAPPINGS[complaint.status]?.label || STATUS_METADATA[complaint.status]?.label || complaint.status}
            </Badge>
          }
        />

        <div className="p-4 space-y-6">
          {/* A. Latest Meaningful Status Callout */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              complaint.status === 'resolved'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                : complaint.status === 'duplicate'
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : complaint.status === 'rejected'
                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                : 'bg-blue-50/80 border-blue-200 text-blue-950'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Latest Civic Update
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-current shadow-xs">
                  {CITIZEN_SAFE_STATUS_MAPPINGS[complaint.status]?.label || complaint.status}
                </span>
              </div>
              <p className="text-xs leading-relaxed max-w-2xl">
                {CITIZEN_SAFE_STATUS_MAPPINGS[complaint.status]?.explanation ||
                  'Your grievance is currently tracking with the municipal desk.'}
              </p>
            </div>

            {/* Department or Resolution tag */}
            <div className="shrink-0 text-left sm:text-right">
              {complaint.status === 'resolved' && (
                <div className="text-xs">
                  <span className="font-bold text-emerald-900 block">Resolution Verified</span>
                  <span className="text-emerald-700 text-[11px]">
                    {complaint.resolvedAt
                      ? new Date(complaint.resolvedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Field remediation completed'}
                  </span>
                </div>
              )}
              {complaint.status === 'assigned' && complaint.assignedDepartmentId && (
                <div className="text-xs">
                  <span className="font-bold text-blue-900 block">Assigned Wing</span>
                  <span className="text-blue-700 text-[11px] font-mono">
                    {complaint.assignedDepartmentId}
                  </span>
                </div>
              )}
              {complaint.status === 'duplicate' && (
                <div className="text-xs">
                  <span className="font-bold text-amber-900 block">Merged Remediation</span>
                  <span className="text-amber-800 text-[11px]">Tracking under sector master report</span>
                </div>
              )}
            </div>
          </div>

          {/* B. Persisted Timeline Sequence */}
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-400" />
              Audit-Verified Status History
            </h4>

            <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {timeline.map((step) => (
                <div key={step.id} className="relative group">
                  {/* Dot */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-0.5 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs transition-colors ${
                      step.isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {step.isCurrent ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </div>

                  {/* Content Box */}
                  <div
                    className={`p-3.5 rounded-lg border transition-all ${
                      step.isCurrent
                        ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {step.statusLabel}
                        </span>
                        {step.isCurrent && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Current Stage
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {new Date(step.timestamp).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {step.safeMessage}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLUMNS: ISSUE INFORMATION & EVIDENCE */}
        <div className="lg:col-span-2 space-y-6">
          {/* Issue Overview Card */}
          <Card>
            <CardHeader
              title={complaint.title}
              subtitle={`${complaint.category} • ${complaint.location.sector}`}
              action={
                <div className="flex items-center gap-2">
                  <PriorityIndicator priority={priorityLevel} score={priorityScore} />
                </div>
              }
            />

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-1">
                  Citizen Statement
                </label>
                <div className="text-sm text-slate-800 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-wrap">
                  {complaint.description}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Location & Landmark</span>
                    <span className="text-slate-600">
                      {complaint.location.sector} • {complaint.location.landmark || complaint.location.address}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <Building className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Responsible Department</span>
                    <span className="text-slate-600">
                      {complaint.assignedDepartmentId || 'Under Central Dispatch Assessment'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <Calendar className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Submitted Timestamp</span>
                    <span className="text-slate-600">
                      {new Date(complaint.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <User className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 block">Assigned Officer</span>
                    <span className="text-slate-600">
                      {complaint.assignedOfficerName || 'Pending Field Officer Allocation'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Photographic Evidence Section */}
          <Card>
            <CardHeader
              title="Photographic Evidence"
              subtitle="Uploaded by citizen during intake for visual corroboration"
              action={
                isLiveRecord ? (
                  assessment?.evidenceSupport !== null && assessment?.evidenceSupport !== undefined ? (
                    <Badge
                      variant={
                        assessment.evidenceSupport >= 70
                          ? 'success'
                          : assessment.evidenceSupport >= 40
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      Evidence Support: {assessment.evidenceSupport.toFixed(0)}/100
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      {complaint.imageUrl ? 'Evidence Attached' : 'No Photo Uploaded'}
                    </Badge>
                  )
                ) : complaint.aiAssessment?.evidenceSupport ? (
                  <EvidenceSupportBadge level={complaint.aiAssessment.evidenceSupport} />
                ) : (
                  <Badge variant="neutral" size="sm">
                    {complaint.imageUrl ? 'Evidence Attached' : 'No Photo Uploaded'}
                  </Badge>
                )
              }
            />

            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center min-h-[160px]">
                {complaint.imageUrl ? (
                  <img
                    src={complaint.imageUrl}
                    alt={`Evidence of ${complaint.title}`}
                    className="max-h-80 w-full object-contain mx-auto"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No photographic evidence provided for this complaint
                  </div>
                )}
              </div>

              {isLiveRecord ? (
                assessment?.evidenceSupport !== null && assessment?.evidenceSupport !== undefined ? (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        Visual Evidence Support: {assessment.evidenceSupport.toFixed(0)} / 100
                      </span>
                      {assessment.humanReviewRequired ? (
                        <Badge variant="warning" size="sm">
                          Human Review Required
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          Corroboration Passed
                        </Badge>
                      )}
                    </div>
                    {assessment.reasoningSummary && (
                      <p className="text-slate-600 leading-relaxed">{assessment.reasoningSummary}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      Visual Evidence Intake Stored Privately
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Photographic evidence is preserved in private municipal storage. Automated visual
                      corroboration will be performed once the evidence pipeline is configured.
                      Unassessed images are never rejected and remain queued for human officer inspection.
                    </p>
                  </div>
                )
              ) : (
                complaint.aiAssessment?.evidenceSupportNotes && (
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start justify-between gap-3">
                    <div>
                      <span className="font-bold text-slate-900 block mb-0.5">
                        Visual Evidence Support: {complaint.aiAssessment.evidenceSupport?.toUpperCase()}
                      </span>
                      <span>{complaint.aiAssessment.evidenceSupportNotes}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: AI ANALYSIS & PRIORITY SCORE */}
        <div className="space-y-6">
          {isLiveRecord ? (
            <>
              {/* Priority Assessment Card (Phase 8 Deterministic Engine) */}
              <Card className="border-slate-200 bg-white">
                <CardHeader
                  title="Civic Priority Assessment"
                  subtitle="Deterministic Priority Engine"
                  action={
                    priorityResult?.status === 'calculated' && priorityResult.tier ? (
                      <PriorityIndicator
                        priority={priorityResult.tier}
                        score={priorityResult.score ?? undefined}
                      />
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Priority Pending
                      </Badge>
                    )
                  }
                />

                {priorityResult?.status === 'calculated' &&
                priorityResult.score !== null &&
                priorityResult.breakdown ? (
                  <div className="p-4 space-y-4 text-xs">
                    {/* Score Hero Banner */}
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Deterministic Priority Score
                        </div>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-2xl font-black text-slate-900">
                            {priorityResult.score.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-500">/ 100</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Current Civic Priority
                        </div>
                        <div className="mt-0.5">
                          {(() => {
                            const effectiveTier =
                              complaint?.effectivePriorityTier ?? complaint?.priorityTier ?? priorityResult.tier;
                            return (
                              <Badge
                                variant={
                                  effectiveTier === 'critical'
                                    ? 'danger'
                                    : effectiveTier === 'high'
                                    ? 'warning'
                                    : effectiveTier === 'medium'
                                    ? 'secondary'
                                    : 'neutral'
                                }
                                size="md"
                              >
                                {effectiveTier?.toUpperCase()}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Administrative Priority Adjustment Callout */}
                    {(complaint?.isPriorityOverridden || (complaint?.effectivePriorityTier && priorityResult.tier && complaint.effectivePriorityTier !== priorityResult.tier)) && (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Municipal Review Note:</span>
                          <span className="text-blue-900 ml-1">
                            Priority tier was adjusted by authorized municipal review.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Human Review Signal */}
                    {priorityResult.humanReviewRequired && (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Human Review Required:</span>
                          <span className="text-amber-900 ml-1">
                            Flagged for municipal engineer verification due to safety risk or evidence criteria.
                            Formula and tier score remain strictly objective.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Explainable Weighted Breakdown */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <span>Component Breakdown</span>
                        <span className="text-slate-400 font-normal">Score × Weight = Contribution</span>
                      </div>

                      <div className="space-y-1.5 font-mono text-[11px]">
                        {/* Severity */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="font-sans text-slate-700 font-medium">Severity (35%)</span>
                          <span className="text-slate-600">
                            {priorityResult.breakdown.severity.score.toFixed(0)} × 0.35 ={' '}
                            <strong className="text-slate-900">
                              {priorityResult.breakdown.severity.contribution.toFixed(2)}
                            </strong>
                          </span>
                        </div>

                        {/* Safety Risk */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="font-sans text-slate-700 font-medium">Safety Risk (30%)</span>
                          <span className="text-slate-600">
                            {priorityResult.breakdown.safetyRisk.score.toFixed(0)} × 0.30 ={' '}
                            <strong className="text-slate-900">
                              {priorityResult.breakdown.safetyRisk.contribution.toFixed(2)}
                            </strong>
                          </span>
                        </div>

                        {/* Public Impact */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="font-sans text-slate-700 font-medium">Public Impact (20%)</span>
                          <span className="text-slate-600">
                            {priorityResult.breakdown.publicImpact.score.toFixed(0)} × 0.20 ={' '}
                            <strong className="text-slate-900">
                              {priorityResult.breakdown.publicImpact.contribution.toFixed(2)}
                            </strong>
                          </span>
                        </div>

                        {/* Recurrence */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="font-sans text-slate-700 font-medium">Recurrence (10%)</span>
                          <span className="text-slate-600">
                            {priorityResult.breakdown.recurrence.score.toFixed(0)} × 0.10 ={' '}
                            <strong className="text-slate-900">
                              {priorityResult.breakdown.recurrence.contribution.toFixed(2)}
                            </strong>
                          </span>
                        </div>

                        {/* Evidence Support */}
                        <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                          <span className="font-sans text-slate-700 font-medium">Evidence Support (5%)</span>
                          <span className="text-slate-600">
                            {priorityResult.breakdown.evidenceSupport.score.toFixed(0)} × 0.05 ={' '}
                            <strong className="text-slate-900">
                              {priorityResult.breakdown.evidenceSupport.contribution.toFixed(2)}
                            </strong>
                          </span>
                        </div>

                        {/* Total Sum */}
                        <div className="flex items-center justify-between p-2 bg-blue-50/60 rounded border border-blue-200 text-blue-950 font-bold">
                          <span className="font-sans">Total Priority Score</span>
                          <span>
                            {priorityResult.score.toFixed(2)} → {priorityResult.tier?.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Legal / Transparency Disclaimer */}
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                      Priority is calculated using a deterministic civic scoring formula from the AI assessment and
                      backend-controlled recurrence signal. The AI model does <strong>NOT</strong> assign the priority tier.
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center space-y-2.5">
                    <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                      <Clock className="h-5 w-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Priority Pending AI Evidence Analysis</h4>
                    <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                      Priority scoring is computed strictly from objective evidence assessment dimensions and
                      backend recurrence. No fallback or simulated priority score is fabricated.
                    </p>
                  </div>
                )}
              </Card>

              {/* AI Evidence Analysis Card */}
              <Card className="border-blue-200 bg-white">
                <CardHeader
                  title="AI Evidence Analysis"
                  subtitle="Decision Support & Corroboration"
                  action={
                    isAnalyzing ? (
                      <Badge variant="warning" size="sm">
                        ANALYZING...
                      </Badge>
                    ) : assessmentState === 'completed' ? (
                      <Badge variant="success" size="sm">
                        Completed
                      </Badge>
                    ) : assessmentState === 'not_configured' ? (
                      <Badge variant="neutral" size="sm">
                        Not Configured
                      </Badge>
                    ) : assessmentState === 'failed' ? (
                      <Badge variant="danger" size="sm">
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Pending
                      </Badge>
                    )
                  }
                />

                {isAnalyzing ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      AI Evidence Analysis in progress...
                    </h4>
                    <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                      Securely transmitting private photographic evidence and complaint description to the
                      server-side multimodal AI pipeline for objective corroboration scoring.
                    </p>
                  </div>
                ) : assessmentState === 'completed' && assessment ? (
                  <div className="p-4 space-y-4 text-xs">
                    {/* Detected issue and category */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-600 font-medium">Detected Issue</span>
                        <span className="font-bold text-slate-900 text-right max-w-[60%] truncate">
                          {assessment.detectedIssue || 'Under Evaluation'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                        <span className="text-slate-600 font-medium">Suggested Category</span>
                        <span className="font-semibold text-slate-900">
                          {assessment.suggestedCategory || complaint.category}
                        </span>
                      </div>
                    </div>

                    {/* 6 Bounded Metrics (0-100) */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                        Assessed Dimensions (0–100 Scale)
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 font-medium">
                          <span className="text-slate-600">Evidence Support</span>
                          <span className="font-bold text-blue-700">
                            {assessment.evidenceSupport !== null
                              ? `${assessment.evidenceSupport.toFixed(1)} / 100`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${assessment.evidenceSupport ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 font-medium">
                          <span className="text-slate-600">Severity</span>
                          <span className="font-bold text-slate-900">
                            {assessment.severity !== null
                              ? `${assessment.severity.toFixed(1)} / 100`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-slate-700 h-2 rounded-full"
                            style={{ width: `${assessment.severity ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 font-medium">
                          <span className="text-slate-600">Public Safety Risk</span>
                          <span className="font-bold text-red-700">
                            {assessment.safetyRisk !== null
                              ? `${assessment.safetyRisk.toFixed(1)} / 100`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-red-600 h-2 rounded-full"
                            style={{ width: `${assessment.safetyRisk ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 font-medium">
                          <span className="text-slate-600">Image Quality</span>
                          <span className="font-bold text-slate-800">
                            {assessment.imageQuality !== null
                              ? `${assessment.imageQuality.toFixed(1)} / 100`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-teal-600 h-2 rounded-full"
                            style={{ width: `${assessment.imageQuality ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 font-medium">
                          <span className="text-slate-600">Description Match</span>
                          <span className="font-bold text-slate-800">
                            {assessment.descriptionMatch !== null
                              ? `${assessment.descriptionMatch.toFixed(1)} / 100`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${assessment.descriptionMatch ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 font-medium">
                          <span className="text-slate-600">Public Impact</span>
                          <span className="font-bold text-slate-800">
                            {assessment.publicImpact !== null
                              ? `${assessment.publicImpact.toFixed(1)} / 100`
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-amber-600 h-2 rounded-full"
                            style={{ width: `${assessment.publicImpact ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Reasoning summary */}
                    {assessment.reasoningSummary && (
                      <div className="p-3 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                        <strong>Assessment Reasoning:</strong> {assessment.reasoningSummary}
                      </div>
                    )}

                    {/* Human review status banner */}
                    {assessment.humanReviewRequired ? (
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                          Human Review Required
                        </div>
                        <p className="text-[11px] text-amber-800">
                          This grievance has been flagged for engineer verification:
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                          {assessment.humanReviewReasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                        <span>Routine Queue — No anomaly flags raised.</span>
                      </div>
                    )}

                    {/* Re-analyze action button */}
                    {complaint.imageUrl && (
                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAnalyzeEvidence(true)}
                          disabled={isAnalyzing}
                          leftIcon={<RefreshCw className="h-3 w-3" />}
                        >
                          Re-analyze Evidence
                        </Button>
                      </div>
                    )}
                  </div>
                ) : assessmentState === 'failed' ? (
                  <div className="p-4 space-y-3">
                    <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-950 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-red-900">
                        <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
                        Evidence Analysis Processing Failed
                      </div>
                      <p className="text-[11px] text-red-800 leading-relaxed">
                        {analysisError || 'An error occurred during evidence intake processing.'} The grievance has been
                        safely flagged with <strong>human_review_required = true</strong> for manual municipal triage.
                      </p>
                    </div>

                    {complaint.imageUrl && (
                      <div className="pt-1 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAnalyzeEvidence(true)}
                          disabled={isAnalyzing}
                          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                        >
                          Retry Analysis
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Pending / Not Configured State */
                  <div className="p-4 space-y-4">
                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                        {assessmentState === 'not_configured'
                          ? 'Server AI Pipeline Unconfigured'
                          : 'AI Evidence Analysis Pending'}
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        {analysisError ||
                          'In accordance with municipal transparency guidelines, Chandigarh CivicAI does not display invented scores or simulated metrics for live citizen grievances.'}
                      </p>
                    </div>

                    {/* Trigger analysis button when photographic evidence exists */}
                    {complaint.imageUrl && (
                      <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-center space-y-2">
                        <div className="text-xs text-blue-900 font-semibold">
                          Photographic Evidence Attached
                        </div>
                        <p className="text-[11px] text-blue-700">
                          Trigger server-side multimodal inspection of the uploaded evidence photograph.
                        </p>
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => handleAnalyzeEvidence(false)}
                          disabled={isAnalyzing}
                          leftIcon={
                            isAnalyzing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )
                          }
                        >
                          {isAnalyzing ? 'Analyzing Evidence...' : 'Analyze Evidence'}
                        </Button>
                      </div>
                    )}

                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        Civic Decision-Support Principles
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                        <li>
                          <strong>Evidence Support:</strong> Quantifies how strongly visual evidence
                          corroborates the described defect, not "authenticity".
                        </li>
                        <li>
                          <strong>No Authenticity Claims:</strong> AI does not prove image origin, camera
                          timestamp, or editing status.
                        </li>
                        <li>
                          <strong>Non-Rejection Policy:</strong> Absence of AI scores or low confidence
                          never rejects a citizen's grievance.
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </Card>
            </>
          ) : (
            /* Mock record: Existing demo breakdown */
            <>
              <Card className="border-blue-200 bg-white">
                <CardHeader
                  title="Deterministic Priority Score"
                  subtitle="Explainable mathematical ranking"
                  action={
                    <Badge variant={priorityLevel === 'critical' ? 'critical' : 'high'}>
                      {priorityLevel.toUpperCase()}
                    </Badge>
                  }
                />

                <div className="text-center py-4 border-b border-slate-100">
                  <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    {priorityScore ? priorityScore.toFixed(1) : '87.4'}{' '}
                    <span className="text-lg font-normal text-slate-400">/ 100</span>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 mt-1">
                    Priority Ranking: {priorityLevel.toUpperCase()}
                  </div>
                </div>

                <div className="pt-4 space-y-3.5 text-xs">
                  <div>
                    <div className="flex justify-between mb-1 font-medium">
                      <span className="text-slate-600">Base Structural Severity (35%)</span>
                      <span className="font-bold text-slate-900">
                        {complaint.priorityCalculation?.baseSeverityScore || 92} / 100
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${complaint.priorityCalculation?.baseSeverityScore || 92}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 font-medium">
                      <span className="text-slate-600">Public Safety Risk (35%)</span>
                      <span className="font-bold text-red-700">
                        {complaint.priorityCalculation?.safetyRiskScore || 95} / 100
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-red-600 h-2 rounded-full"
                        style={{ width: `${complaint.priorityCalculation?.safetyRiskScore || 95}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1 font-medium">
                      <span className="text-slate-600">Public Impact Corridor (15%)</span>
                      <span className="font-bold text-slate-900">
                        {complaint.priorityCalculation?.publicImpactScore || 88} / 100
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-600 h-2 rounded-full"
                        style={{ width: `${complaint.priorityCalculation?.publicImpactScore || 88}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                    <strong>Formula:</strong>{' '}
                    {complaint.priorityCalculation?.explanation || 'Transparent deterministic formula'}
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="AI Multimodal Assessment"
                  subtitle="Demonstration metrics generated by computer vision & NLP"
                  action={
                    <Badge variant="warning" size="sm">
                      DEMO DATA
                    </Badge>
                  }
                />

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600 font-medium">Detected Physical Issue</span>
                    <span className="font-bold text-slate-900 text-right max-w-[55%] truncate">
                      {complaint.aiAssessment?.detectedIssue || 'Road cavity defect'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600 font-medium">Severity Level</span>
                    <Badge variant={complaint.aiAssessment?.severity === 'critical' ? 'critical' : 'high'}>
                      {complaint.aiAssessment?.severity?.toUpperCase() || 'CRITICAL'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600 font-medium">Safety Risk</span>
                    <Badge variant="danger">
                      {complaint.aiAssessment?.safetyRisk?.toUpperCase() || 'SEVERE'}
                    </Badge>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
};
export default ComplaintDetailsPage;
