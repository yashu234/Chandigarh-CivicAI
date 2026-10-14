import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ROUTES,
  CHANDIGARH_DEPARTMENTS,
  STATUS_METADATA,
} from '../constants';
import { getMockComplaintById, MOCK_COMPLAINTS } from '../data/mockComplaints';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Textarea';
import { Modal } from '../components/ui/Modal';
import { PriorityIndicator } from '../components/common/PriorityIndicator';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Building,
  Check,
  RotateCcw,
  MapPin,
  AlertCircle,
  Sparkles,
  Database,
  Copy,
  ExternalLink,
  Info,
} from 'lucide-react';
import type { Complaint, ComplaintStatus } from '../types';
import type { PriorityTier } from '../services/priority/priorityTypes';
import {
  getAdminComplaintDetails,
  transitionComplaintStatus,
  overridePriority,
  assignDepartment,
  type AdminComplaintDetailResult,
} from '../services/admin/adminComplaintService';
import { getAllowedTransitions } from '../services/admin/statusWorkflow';
import { useAuth } from '../hooks/useAuth';
import {
  detectDuplicateCandidates,
  calculateSectorRecurrenceSignal,
  confirmDuplicateSuggestion,
  dismissDuplicateSuggestion,
} from '../services/duplicates/duplicateDetectionService';
import type {
  DuplicateCandidateSummary,
  RecurrenceSignal,
} from '../services/duplicates/duplicateTypes';

export const AdminComplaintDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Live and demo state
  const [detailData, setDetailData] = useState<AdminComplaintDetailResult | null>(null);
  const [demoComplaint, setDemoComplaint] = useState<Complaint | null>(null);
  const [isLiveRecord, setIsLiveRecord] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Modal Dialog States
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState('');

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDeptCode, setSelectedDeptCode] = useState('MCC-ROADS');
  const [assignNote, setAssignNote] = useState('');

  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [selectedOverrideTier, setSelectedOverrideTier] = useState<PriorityTier>('critical');
  const [overrideReason, setOverrideReason] = useState('');

  // Duplicate Candidate Review Modal States
  const [isConfirmDuplicateModalOpen, setIsConfirmDuplicateModalOpen] = useState(false);
  const [selectedCandidateToConfirm, setSelectedCandidateToConfirm] = useState<DuplicateCandidateSummary | null>(null);
  const [confirmDuplicateReason, setConfirmDuplicateReason] = useState('');

  const [isDismissDuplicateModalOpen, setIsDismissDuplicateModalOpen] = useState(false);
  const [selectedCandidateToDismiss, setSelectedCandidateToDismiss] = useState<DuplicateCandidateSummary | null>(null);
  const [dismissDuplicateNote, setDismissDuplicateNote] = useState('');

  // Demo mode state for duplicate candidates & recurrence
  const [demoDuplicates, setDemoDuplicates] = useState<DuplicateCandidateSummary[]>([]);
  const [demoRecurrence, setDemoRecurrence] = useState<RecurrenceSignal | null>(null);

  const showFeedback = (message: string) => {
    setActionFeedback(message);
    setActionError(null);
    setTimeout(() => {
      setActionFeedback(null);
    }, 5000);
  };

  const showError = (message: string) => {
    setActionError(message);
    setActionFeedback(null);
  };

  // Helper to compute demo duplicates and recurrence
  const computeDemoDuplicatesAndRecurrence = (mock: Complaint) => {
    const demoCandidates = detectDuplicateCandidates(mock, MOCK_COMPLAINTS);
    const demoRec = calculateSectorRecurrenceSignal(
      mock.location.sector,
      mock.category,
      mock.createdAt,
      MOCK_COMPLAINTS.map((c) => ({
        id: c.id,
        sector: c.location.sector,
        category: c.category,
        createdAt: c.createdAt,
      })),
      mock.id
    );
    setDemoRecurrence(demoRec);

    const summaries: DuplicateCandidateSummary[] = demoCandidates.map((cand) => {
      const otherId = cand.sourceComplaintId === mock.id ? cand.candidateComplaintId : cand.sourceComplaintId;
      const other = MOCK_COMPLAINTS.find((c) => c.id === otherId);
      return {
        candidate: cand,
        otherComplaint: {
          id: other?.id || otherId,
          trackingId: other?.trackingNumber || 'DEMO-PAIR',
          title: other?.title || 'Related Civic Issue',
          category: other?.category || mock.category,
          sector: other?.location.sector || mock.location.sector,
          status: other?.status || 'submitted',
          createdAt: other?.createdAt || cand.createdAt,
        },
      };
    });
    setDemoDuplicates(summaries);
  };

  // Load details from database or demo fallback
  const loadDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);

    const { data: liveResult } = await getAdminComplaintDetails(id);

    if (liveResult) {
      setDetailData(liveResult);
      setIsLiveRecord(true);
      setIsLoading(false);
      return;
    }

    // Fall back to demo data
    const mock = getMockComplaintById(id) || MOCK_COMPLAINTS[0];
    setDemoComplaint(mock);
    setIsLiveRecord(false);
    computeDemoDuplicatesAndRecurrence(mock);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const activeComplaint = detailData?.complaint ?? demoComplaint;
  const activeDuplicates = isLiveRecord
    ? (detailData?.duplicateSuggestions ?? [])
    : demoDuplicates;
  const activeRecurrence = isLiveRecord
    ? (detailData?.recurrenceSignal ?? null)
    : demoRecurrence;

  // Execute status transition
  const handleConfirmTransition = async () => {
    if (!activeComplaint || !targetStatus) return;

    if (!isAdmin && isLiveRecord) {
      showError('Administrative privileges required. Please sign in as an admin.');
      setIsTransitionModalOpen(false);
      return;
    }

    setIsSubmittingAction(true);

    if (isLiveRecord) {
      const { success, error } = await transitionComplaintStatus(
        activeComplaint.id,
        targetStatus,
        transitionNote
      );

      setIsSubmittingAction(false);
      setIsTransitionModalOpen(false);

      if (!success && error) {
        showError(error.message);
      } else {
        showFeedback(`Status transitioned to ${STATUS_METADATA[targetStatus]?.label || targetStatus}.`);
        setTransitionNote('');
        loadDetails();
      }
    } else {
      // Demo mode interactive transition
      setIsSubmittingAction(false);
      setIsTransitionModalOpen(false);
      showFeedback(`[DEMO MODE] Status marked as ${STATUS_METADATA[targetStatus]?.label || targetStatus}.`);
    }
  };

  // Execute Department Assignment
  const handleConfirmAssign = async () => {
    if (!activeComplaint) return;

    if (!isAdmin && isLiveRecord) {
      showError('Administrative privileges required to assign complaints.');
      setIsAssignModalOpen(false);
      return;
    }

    setIsSubmittingAction(true);

    if (isLiveRecord) {
      const { success, error } = await assignDepartment(
        activeComplaint.id,
        selectedDeptCode,
        assignNote
      );

      setIsSubmittingAction(false);
      setIsAssignModalOpen(false);

      if (!success && error) {
        showError(error.message);
      } else {
        showFeedback(`Assigned to municipal department wing: ${selectedDeptCode}.`);
        setAssignNote('');
        loadDetails();
      }
    } else {
      setIsSubmittingAction(false);
      setIsAssignModalOpen(false);
      showFeedback(`[DEMO MODE] Assigned to department wing ${selectedDeptCode}.`);
    }
  };

  // Execute Priority Override
  const handleConfirmOverride = async () => {
    if (!activeComplaint) return;

    if (!overrideReason.trim() || overrideReason.trim().length < 5) {
      showError('Please provide a mandatory justification reason (at least 5 characters).');
      return;
    }

    if (!isAdmin && isLiveRecord) {
      showError('Administrative privileges required for priority overrides.');
      setIsOverrideModalOpen(false);
      return;
    }

    setIsSubmittingAction(true);

    if (isLiveRecord) {
      const { success, error } = await overridePriority(
        activeComplaint.id,
        selectedOverrideTier,
        overrideReason
      );

      setIsSubmittingAction(false);
      setIsOverrideModalOpen(false);

      if (!success && error) {
        showError(error.message);
      } else {
        showFeedback(`Priority tier overridden to ${selectedOverrideTier.toUpperCase()}. Original calculated score preserved.`);
        setOverrideReason('');
        loadDetails();
      }
    } else {
      setIsSubmittingAction(false);
      setIsOverrideModalOpen(false);
      showFeedback(`[DEMO MODE] Priority overridden to ${selectedOverrideTier.toUpperCase()}.`);
    }
  };

  // Duplicate candidate confirmation
  const handleConfirmDuplicateAction = async () => {
    if (!selectedCandidateToConfirm || !activeComplaint) return;
    const trimmed = confirmDuplicateReason.trim();
    if (trimmed.length < 5) {
      showError('Confirmation justification reason must be at least 5 characters.');
      return;
    }

    if (!isAdmin && isLiveRecord) {
      showError('Administrative privileges required to confirm duplicates.');
      setIsConfirmDuplicateModalOpen(false);
      return;
    }

    setIsSubmittingAction(true);

    if (isLiveRecord) {
      const { success, error } = await confirmDuplicateSuggestion(
        selectedCandidateToConfirm.candidate.id,
        selectedCandidateToConfirm.otherComplaint.id,
        activeComplaint.id,
        trimmed
      );

      setIsSubmittingAction(false);
      setIsConfirmDuplicateModalOpen(false);

      if (!success && error) {
        showError(error.message);
      } else {
        showFeedback(
          `Grievance ${selectedCandidateToConfirm.otherComplaint.trackingId} confirmed as duplicate of ${activeComplaint.trackingNumber}.`
        );
        setConfirmDuplicateReason('');
        setSelectedCandidateToConfirm(null);
        loadDetails();
      }
    } else {
      // Demo mode
      setDemoDuplicates((prev) =>
        prev.map((item) =>
          item.candidate.id === selectedCandidateToConfirm.candidate.id
            ? {
                ...item,
                candidate: {
                  ...item.candidate,
                  status: 'confirmed_duplicate',
                  reviewNotes: trimmed,
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: 'Demo Administrator',
                },
              }
            : item
        )
      );
      setIsSubmittingAction(false);
      setIsConfirmDuplicateModalOpen(false);
      showFeedback(
        `[DEMO MODE] Grievance ${selectedCandidateToConfirm.otherComplaint.trackingId} confirmed as duplicate.`
      );
      setConfirmDuplicateReason('');
      setSelectedCandidateToConfirm(null);
    }
  };

  // Duplicate candidate dismissal
  const handleDismissDuplicateAction = async () => {
    if (!selectedCandidateToDismiss) return;
    const note =
      dismissDuplicateNote.trim() ||
      'Dismissed by authorized administrator: Verified as distinct grievance.';

    if (!isAdmin && isLiveRecord) {
      showError('Administrative privileges required to dismiss duplicate suggestions.');
      setIsDismissDuplicateModalOpen(false);
      return;
    }

    setIsSubmittingAction(true);

    if (isLiveRecord) {
      const { success, error } = await dismissDuplicateSuggestion(
        selectedCandidateToDismiss.candidate.id,
        note
      );

      setIsSubmittingAction(false);
      setIsDismissDuplicateModalOpen(false);

      if (!success && error) {
        showError(error.message);
      } else {
        showFeedback('Duplicate suggestion dismissed. Complaint maintained as distinct.');
        setDismissDuplicateNote('');
        setSelectedCandidateToDismiss(null);
        loadDetails();
      }
    } else {
      // Demo mode
      setDemoDuplicates((prev) =>
        prev.map((item) =>
          item.candidate.id === selectedCandidateToDismiss.candidate.id
            ? {
                ...item,
                candidate: {
                  ...item.candidate,
                  status: 'dismissed',
                  reviewNotes: note,
                  reviewedAt: new Date().toISOString(),
                  reviewedBy: 'Demo Administrator',
                },
              }
            : item
        )
      );
      setIsSubmittingAction(false);
      setIsDismissDuplicateModalOpen(false);
      showFeedback('[DEMO MODE] Duplicate suggestion dismissed. Retained as distinct.');
      setDismissDuplicateNote('');
      setSelectedCandidateToDismiss(null);
    }
  };

  if (isLoading || !activeComplaint) {
    return (
      <PageContainer maxWidth="xl" headerTitle="Loading Administrative Triage...">
        <div className="py-24 text-center">
          <Clock className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading municipal grievance records...</p>
        </div>
      </PageContainer>
    );
  }

  const allowedNextStatuses = getAllowedTransitions(activeComplaint.status);

  return (
    <div className="page-enter py-4 sm:py-6">
      <PageContainer
        maxWidth="xl"
        headerTitle={`Administrative Triage: ${activeComplaint.trackingNumber}`}
        headerDescription="Multimodal evidence review, priority verification, department dispatch, and field remediation oversight."
      headerAction={
        <div className="flex items-center gap-2">
          <Link to={ROUTES.ADMIN_DASHBOARD}>
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to Priority Queue
            </Button>
          </Link>
          {isAdmin ? (
            <Badge variant="success" size="sm">
              Verified Administrator
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              Read-Only Demo Mode
            </Badge>
          )}
        </div>
      }
    >
      {/* Live vs Demo Banner */}
      {isLiveRecord ? (
        <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
          <Database className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Verified Live Database Record:</span>
            <span className="text-emerald-900 ml-1">
              You are triaging a real citizen grievance recorded in <code>public.complaints</code>. All status
              transitions and priority adjustments are committed with immutable audit logging.
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Demonstration Scenario Record:</span>
            <span className="text-blue-800 ml-1">
              This grievance represents simulated municipal test data.
            </span>
          </div>
        </div>
      )}

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{actionFeedback}</span>
          </div>
          <Badge variant="success" size="sm">
            Audited
          </Badge>
        </div>
      )}

      {/* Error Banner */}
      {actionError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-xs text-red-950 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span>{actionError}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActionError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT 2 COLUMNS: INSPECTION, EVIDENCE, AI, & PRIORITY */}
        <div className="lg:col-span-2 space-y-6">
          {/* SECTION A: COMPLAINT INFORMATION */}
          <Card>
            <CardHeader
              title="Grievance Details"
              subtitle={`Citizen intake received on ${new Date(activeComplaint.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}`}
              action={
                <Badge variant="primary" size="sm">
                  Status: {STATUS_METADATA[activeComplaint.status]?.label || activeComplaint.status}
                </Badge>
              }
            />
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">{activeComplaint.title}</h3>
                <div className="flex items-center gap-2 text-slate-500 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-700">{activeComplaint.location.sector}</span>
                  <span>•</span>
                  <span>{activeComplaint.location.landmark || activeComplaint.location.address}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900 block mb-1">Citizen Statement:</span>
                {activeComplaint.description}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">Category</span>
                  <span className="font-bold text-slate-800">{activeComplaint.category}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">Tracking ID</span>
                  <span className="font-mono font-bold text-blue-900">{activeComplaint.trackingNumber}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[11px] text-slate-500 block">Intake Time</span>
                  <span className="font-medium text-slate-700">
                    {new Date(activeComplaint.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* SECTION B: PHOTOGRAPHIC EVIDENCE */}
          <Card>
            <CardHeader
              title="Photographic Evidence"
              subtitle="Secure private municipal storage object with signed token retrieval"
              action={
                <Badge variant="neutral" size="sm">
                  Private Bucket Access
                </Badge>
              }
            />
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center min-h-[200px]">
                {activeComplaint.imageUrl ? (
                  <img
                    src={activeComplaint.imageUrl}
                    alt="Complaint evidence photograph"
                    className="max-h-96 w-full object-contain mx-auto"
                  />
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No photographic evidence attached to this grievance
                  </div>
                )}
              </div>

              {detailData?.evidence && (
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <div>
                    <span className="text-slate-400 block">File Name:</span>
                    <span className="font-mono font-semibold text-slate-800 truncate block">
                      {detailData.evidence.original_filename}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">MIME Type:</span>
                    <span className="font-mono text-slate-800">{detailData.evidence.mime_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">File Size:</span>
                    <span className="font-mono text-slate-800">
                      {(detailData.evidence.file_size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* SECTION C & D: AI ASSESSMENT & DETERMINISTIC PRIORITY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Evidence Assessment */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">AI Evidence Assessment</h4>
                  <p className="text-[11px] text-slate-500">Multimodal physical defect analysis</p>
                </div>
                {detailData?.assessment?.human_review_required ? (
                  <Badge variant="warning" size="sm">
                    Human Review Flagged
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm">
                    Intake Passed
                  </Badge>
                )}
              </div>

              {detailData?.assessment ? (
                <div className="space-y-3 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Detected Issue:</span>
                    <span className="font-bold text-slate-900">{detailData.assessment.detected_issue}</span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-600">Evidence Support</span>
                        <span className="font-bold text-blue-700">
                          {Number(detailData.assessment.evidence_support).toFixed(0)} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${detailData.assessment.evidence_support}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-600">Severity</span>
                        <span className="font-bold text-red-700">
                          {Number(detailData.assessment.severity).toFixed(0)} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-red-600 h-1.5 rounded-full"
                          style={{ width: `${detailData.assessment.severity}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-slate-600">Safety Risk</span>
                        <span className="font-bold text-amber-700">
                          {Number(detailData.assessment.safety_risk).toFixed(0)} / 100
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-600 h-1.5 rounded-full"
                          style={{ width: `${detailData.assessment.safety_risk}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {detailData.assessment.reasoning_summary && (
                    <p className="text-[11px] text-slate-600 p-2 bg-slate-50 rounded border border-slate-100 leading-relaxed">
                      <strong>Reasoning:</strong> {detailData.assessment.reasoning_summary}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  AI assessment has not completed for this grievance.
                </div>
              )}
            </Card>

            {/* Deterministic Priority Score & Administrative Override Card */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Civic Priority & Administrative Override</h4>
                  <p className="text-[11px] text-slate-500">Deterministic formula calculation with municipal triage governance</p>
                </div>
                {detailData?.isOverridden ? (
                  <Badge variant="warning" size="sm">
                    Admin Override Active
                  </Badge>
                ) : (
                  <Badge variant="primary" size="sm">
                    Deterministic Formula
                  </Badge>
                )}
              </div>

              {/* Side-by-Side: Calculated vs Administrative Override */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Calculated Priority */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">
                    Calculated Priority
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    {detailData?.calculatedPriorityScore !== null && detailData?.calculatedPriorityScore !== undefined ? (
                      <>
                        <span className="text-xl font-black text-slate-900">
                          {detailData.calculatedPriorityScore.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          — {detailData.calculatedPriorityTier ? detailData.calculatedPriorityTier.toUpperCase() : 'PENDING'}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Score pending AI analysis</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Generated from objective severity, safety risk, and public impact inputs.
                  </p>
                </div>

                {/* Administrative Override */}
                <div
                  className={`p-3 rounded-lg border ${
                    detailData?.isOverridden
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider block font-bold">
                    Administrative Override
                  </span>
                  <div className="mt-1">
                    {detailData?.isOverridden && detailData.activePriorityTier ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="danger" size="md">
                            {detailData.activePriorityTier.toUpperCase()}
                          </Badge>
                          <span className="text-[11px] font-semibold text-amber-900">
                            (Effective Priority)
                          </span>
                        </div>
                        {detailData.overrideRecord?.reason && (
                          <div className="text-[11px] text-slate-700 pt-1">
                            <span className="font-bold text-slate-900">Reason:</span>{' '}
                            <span className="italic">&quot;{detailData.overrideRecord.reason}&quot;</span>
                          </div>
                        )}
                        {detailData.overrideRecord?.createdAt && (
                          <span className="text-[10px] text-slate-400 block">
                            Recorded on {new Date(detailData.overrideRecord.createdAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-bold text-slate-500">None</span>
                        <span className="text-[11px] text-slate-400">
                          (Effective priority matches calculated tier)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Effective Municipal Priority Banner */}
              <div className="p-2.5 bg-blue-50/50 rounded border border-blue-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-950">Effective Civic Priority:</span>
                  <PriorityIndicator
                    priority={detailData?.activePriorityTier ?? activeComplaint.priorityTier ?? 'medium'}
                    score={detailData?.calculatedPriorityScore ?? activeComplaint.priorityScore ?? undefined}
                  />
                </div>
                <span className="text-[11px] text-blue-800">
                  {detailData?.isOverridden ? 'Human administrative override' : 'Deterministic algorithm'}
                </span>
              </div>

              {/* Formula explanation note */}
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Deterministic formula: <code>0.35*Severity + 0.30*Safety + 0.20*Impact + 0.10*Recurrence + 0.05*Evidence</code>.
                AI scores serve as decision support; municipal triage authority resides with administrators.
              </p>
            </Card>

            {/* SECTION E: ADVISORY DUPLICATE GRIEVANCE DETECTION */}
            <Card className="space-y-4">
              <CardHeader
                title="Advisory Duplicate Grievance Detection"
                subtitle="Heuristic correlation across sector complaints (Decision Support Only — No Auto-Merge)"
                action={
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Threshold: 60%
                    </span>
                    <Badge variant={activeDuplicates.length > 0 ? 'warning' : 'neutral'} size="sm">
                      {activeDuplicates.length} Candidate{activeDuplicates.length === 1 ? '' : 's'}
                    </Badge>
                  </div>
                }
              />

              {/* Advisory Disclaimer Notice */}
              <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Advisory Municipal Decision Support</span>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Duplicate detection is strictly advisory. Correlations are derived from spatial proximity,
                    normalized text overlap, temporal proximity, and category matching. Complaints are never
                    automatically merged or deleted. Confirmation requires authorized municipal review and
                    preserves distinct records in the audit trail.
                  </p>
                </div>
              </div>

              {/* Duplicate Candidates List */}
              {activeDuplicates.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
                  <Copy className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                  <div className="font-semibold text-slate-700">No Duplicate Candidates Detected</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    All examined complaints in {activeComplaint.location.sector} remain below the 60.0% advisory confidence threshold.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeDuplicates.map((item) => {
                    const cand = item.candidate;
                    const signals = cand.matchingSignals;
                    const score = cand.similarityScore;

                    return (
                      <div
                        key={cand.id}
                        className={`p-3.5 rounded-lg border transition-all ${
                          cand.status === 'confirmed_duplicate'
                            ? 'bg-red-50/40 border-red-200'
                            : cand.status === 'dismissed'
                            ? 'bg-slate-50/60 border-slate-200 opacity-75'
                            : 'bg-white border-amber-300 shadow-xs'
                        }`}
                      >
                        {/* Candidate Top Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {item.otherComplaint.trackingId}
                            </span>
                            <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] md:max-w-[280px]">
                              {item.otherComplaint.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Similarity Score */}
                            <span
                              className={`text-[11px] font-black px-2 py-0.5 rounded border ${
                                score >= 80
                                  ? 'bg-red-100 text-red-900 border-red-300'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {score.toFixed(1)}% Similarity
                            </span>

                            {/* Candidate Status Badge */}
                            {cand.status === 'suggested' && (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Advisory Suggested
                              </span>
                            )}
                            {cand.status === 'confirmed_duplicate' && (
                              <span className="text-[10px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                                Confirmed Duplicate
                              </span>
                            )}
                            {cand.status === 'dismissed' && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                Dismissed (Distinct)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Location, Category, and Details */}
                        <div className="pt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {item.otherComplaint.sector}
                          </span>
                          <span>•</span>
                          <span>Category: <strong>{item.otherComplaint.category}</strong></span>
                          <span>•</span>
                          <span>
                            Logged on:{' '}
                            {new Date(item.otherComplaint.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <Link
                            to={`/admin/complaints/${item.otherComplaint.id}`}
                            className="ml-auto text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 text-[11px]"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Inspect Complaint
                          </Link>
                        </div>

                        {/* Signal Metrics Grid */}
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/80 p-2.5 rounded border border-slate-200 text-center">
                          <div className="p-1.5 bg-white rounded border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Category (25%)</span>
                            <span className="text-xs font-bold text-slate-800">
                              {signals.categoryMatched ? '100% Match' : 'Mismatch'}
                            </span>
                          </div>
                          <div className="p-1.5 bg-white rounded border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Spatial (25%)</span>
                            <span className="text-xs font-bold text-slate-800">
                              {signals.distanceMeters !== null ? `${signals.distanceMeters}m` : 'Sector Match'} ({signals.locationScore}%)
                            </span>
                          </div>
                          <div className="p-1.5 bg-white rounded border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Text (30%)</span>
                            <span className="text-xs font-bold text-slate-800">
                              {signals.textScore.toFixed(0)}% Match
                            </span>
                          </div>
                          <div className="p-1.5 bg-white rounded border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Temporal (15%)</span>
                            <span className="text-xs font-bold text-slate-800">
                              {signals.deltaHours < 24 ? `${signals.deltaHours}h` : `${Math.round(signals.deltaHours / 24)}d`} ({signals.temporalScore}%)
                            </span>
                          </div>
                        </div>

                        {/* Explainable Reasons */}
                        {signals.signalReasons && signals.signalReasons.length > 0 && (
                          <div className="mt-2.5 space-y-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Explainable Correlation Signals:
                            </span>
                            <ul className="text-[11px] text-slate-600 list-disc list-inside space-y-0.5 bg-white p-2 rounded border border-slate-100">
                              {signals.signalReasons.map((reason, rIdx) => (
                                <li key={rIdx}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Review Notes (if reviewed) */}
                        {cand.reviewNotes && (
                          <div className="mt-2 p-2 bg-slate-100/70 rounded border border-slate-200 text-[11px] text-slate-700">
                            <span className="font-bold text-slate-900">Review Note:</span>{' '}
                            <span className="italic">&quot;{cand.reviewNotes}&quot;</span>
                            {cand.reviewedAt && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Reviewed on {new Date(cand.reviewedAt).toLocaleString('en-IN', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Admin Action Buttons (for suggested candidates) */}
                        {cand.status === 'suggested' && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-slate-600 hover:bg-slate-100 text-xs"
                              onClick={() => {
                                setSelectedCandidateToDismiss(item);
                                setDismissDuplicateNote('Verified as distinct civic issue in this sector.');
                                setIsDismissDuplicateModalOpen(true);
                              }}
                            >
                              Dismiss (Keep Separate)
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                              onClick={() => {
                                setSelectedCandidateToConfirm(item);
                                setConfirmDuplicateReason('');
                                setIsConfirmDuplicateModalOpen(true);
                              }}
                              leftIcon={<Copy className="h-3.5 w-3.5" />}
                            >
                              Confirm Duplicate
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* SECTION E2: SECTOR RECURRENCE PATTERN SIGNAL */}
            <Card className="space-y-3">
              <CardHeader
                title="Municipal Sector Recurrence Signal"
                subtitle="Rolling 60-day historical frequency analysis (Deterministic backend metric)"
                action={
                  activeRecurrence ? (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        activeRecurrence.level === 'severe' || activeRecurrence.level === 'chronic'
                          ? 'bg-red-100 text-red-900 border-red-300'
                          : activeRecurrence.level === 'frequent'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : activeRecurrence.level === 'emerging'
                          ? 'bg-blue-100 text-blue-900 border-blue-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {activeRecurrence.level.toUpperCase()} RECURRENCE
                    </span>
                  ) : null
                }
              />

              {activeRecurrence ? (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Recurrence Score
                      </span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900">
                          {activeRecurrence.recurrenceScore}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">/ 100</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                        <div
                          className={`h-1.5 rounded-full ${
                            activeRecurrence.recurrenceScore >= 75
                              ? 'bg-red-600'
                              : activeRecurrence.recurrenceScore >= 50
                              ? 'bg-amber-600'
                              : activeRecurrence.recurrenceScore > 0
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          }`}
                          style={{ width: `${activeRecurrence.recurrenceScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Rolling Window
                      </span>
                      <div className="mt-1 text-2xl font-black text-slate-900">
                        {activeRecurrence.windowDays}
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Days prior in {activeComplaint.location.sector}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        Prior Related Reports
                      </span>
                      <div className="mt-1 text-2xl font-black text-slate-900">
                        {activeRecurrence.priorComplaintsCount}
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Under &quot;{activeComplaint.category}&quot;
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-blue-50/50 rounded border border-blue-100 text-[11px] text-blue-950 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Explainable Recurrence Assessment</span>
                      <p className="text-slate-700 mt-0.5">{activeRecurrence.explanation}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Recurrence Signal Architecture: Calculated deterministically via <code>min(100, N * 25)</code> where N is
                    the count of prior related grievances within a 60-day window. To preserve audit reproducibility, historical
                    Phase 8 priority scores remain unchanged until administrative confirmation.
                  </p>
                </div>
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Recurrence data not available for this grievance.
                </div>
              )}
            </Card>
          </div>

          {/* SECTION F: STATUS HISTORY AUDIT TRAIL */}
          <Card>
            <CardHeader
              title="Immutable Remediation Audit Trail"
              subtitle="Chronological lifecycle transitions recorded in public.complaint_status_history"
              action={
                <Badge variant="neutral" size="sm">
                  Append-Only Register
                </Badge>
              }
            />
            <div className="space-y-3">
              {(detailData?.statusHistory && detailData.statusHistory.length > 0) ? (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {detailData.statusHistory.map((event, idx) => (
                    <div key={idx} className="relative text-xs">
                      <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-blue-600 ring-4 ring-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          Status Transition: {STATUS_METADATA[event.status]?.label || event.status}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(event.timestamp).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Recorded by: <strong>{event.actor}</strong>
                      </div>
                      {event.notes && (
                        <p className="mt-1 p-2 bg-slate-50 rounded border border-slate-100 text-slate-700 text-[11px]">
                          {event.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-3 text-center">
                  No status transitions recorded yet. Grievance is at intake stage (submitted).
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: ADMINISTRATIVE WORKFLOW ACTIONS */}
        <div className="space-y-6">
          <Card className="border-blue-200 bg-white">
            <CardHeader
              title="Civic Triage Console"
              subtitle="Authorized Municipal Action Panel"
              action={
                <Badge variant="critical" size="sm">
                  Admin Action
                </Badge>
              }
            />

            <div className="p-4 space-y-5 text-xs">
              {/* STATUS TRANSITIONS ACTION BUTTONS */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Allowed Status Transitions
                </label>

                {allowedNextStatuses.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-500 text-center">
                    Grievance has reached terminal status (<strong>{activeComplaint.status}</strong>).
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Primary Progression Actions */}
                    {allowedNextStatuses.includes('under_review') && (
                      <Button
                        variant="primary"
                        className="w-full justify-center"
                        size="sm"
                        onClick={() => {
                          setTargetStatus('under_review');
                          setTransitionNote('Administrative review initiated.');
                          setIsTransitionModalOpen(true);
                        }}
                      >
                        Start Administrative Review
                      </Button>
                    )}

                    {allowedNextStatuses.includes('assigned') && (
                      <Button
                        variant="primary"
                        className="w-full justify-center"
                        size="sm"
                        onClick={() => setIsAssignModalOpen(true)}
                        leftIcon={<Building className="h-3.5 w-3.5" />}
                      >
                        Dispatch / Assign Wing
                      </Button>
                    )}

                    {allowedNextStatuses.includes('in_progress') && (
                      <Button
                        variant="primary"
                        className="w-full justify-center"
                        size="sm"
                        onClick={() => {
                          setTargetStatus('in_progress');
                          setTransitionNote('Field maintenance crew mobilized.');
                          setIsTransitionModalOpen(true);
                        }}
                      >
                        Commence Field Works (In Progress)
                      </Button>
                    )}

                    {allowedNextStatuses.includes('resolved') && (
                      <Button
                        variant="secondary"
                        className="w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white"
                        size="sm"
                        onClick={() => {
                          setTargetStatus('resolved');
                          setTransitionNote('');
                          setIsTransitionModalOpen(true);
                        }}
                        leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Verify & Mark Resolved
                      </Button>
                    )}

                    {/* Exception Actions */}
                    <div className="pt-2 border-t border-slate-100 flex gap-2">
                      {allowedNextStatuses.includes('duplicate') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-center text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => {
                            setTargetStatus('duplicate');
                            setTransitionNote('');
                            setIsTransitionModalOpen(true);
                          }}
                        >
                          Mark Duplicate
                        </Button>
                      )}

                      {allowedNextStatuses.includes('rejected') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 justify-center text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => {
                            setTargetStatus('rejected');
                            setTransitionNote('');
                            setIsTransitionModalOpen(true);
                          }}
                        >
                          Reject Grievance
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* MANUAL PRIORITY OVERRIDE ACTION */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Administrative Priority Discretion
                </label>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Authorized officers may adjust the municipal triage tier for urgent field hazards.
                  The original AI calculation and deterministic score are preserved in the permanent audit log.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    setSelectedOverrideTier('critical');
                    setOverrideReason('');
                    setIsOverrideModalOpen(true);
                  }}
                  leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Adjust Priority Tier Override
                </Button>
              </div>

              {/* DEPARTMENT ASSIGNMENT QUICK INFO */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Responsible Municipal Department
                </label>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-blue-700" />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {activeComplaint.assignedDepartmentId
                          ? CHANDIGARH_DEPARTMENTS.find((d) => d.id === activeComplaint.assignedDepartmentId)?.name || activeComplaint.assignedDepartmentId
                          : 'Roads, Pavements & Civil Works'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {activeComplaint.assignedDepartmentId || 'MCC-ROADS'}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" size="sm">
                    {activeComplaint.status === 'assigned' || activeComplaint.status === 'in_progress' ? 'Assigned' : 'Triage Queue'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* MODAL 1: STATUS TRANSITION CONFIRMATION */}
      <Modal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        title={`Confirm Status Transition: ${targetStatus?.toUpperCase()}`}
        description="Every lifecycle change is immutably appended to public.complaint_status_history and public.admin_actions."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTransitionModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmTransition}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction ? 'Recording...' : 'Confirm Transition'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Transitioning grievance <strong>{activeComplaint.trackingNumber}</strong> from{' '}
            <Badge variant="neutral" size="sm">{activeComplaint.status}</Badge> to{' '}
            <Badge variant="primary" size="sm">{targetStatus || ''}</Badge>.
          </p>

          {(targetStatus === 'rejected' || targetStatus === 'duplicate' || targetStatus === 'resolved') && (
            <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-950 font-medium text-[11px]">
              A mandatory explanatory justification note is required for &quot;{targetStatus}&quot;.
            </div>
          )}

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Administrative Action Note / Justification:
            </label>
            <Textarea
              rows={3}
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              placeholder="Provide reason for this status change..."
              className="w-full text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 2: DEPARTMENT WING ASSIGNMENT */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Dispatch Grievance to Municipal Wing"
        description="Dispatches work order to the designated engineering or maintenance department."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssignModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmAssign}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction ? 'Dispatching...' : 'Dispatch Work Order'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Select Department Wing:</label>
            <select
              value={selectedDeptCode}
              onChange={(e) => setSelectedDeptCode(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-xs bg-white text-slate-800"
            >
              {CHANDIGARH_DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.code}>
                  {dept.code} — {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Dispatch Instructions / Note:</label>
            <Textarea
              rows={3}
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="Instructions for the field inspection team..."
              className="w-full text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 3: PRIORITY OVERRIDE */}
      <Modal
        isOpen={isOverrideModalOpen}
        onClose={() => setIsOverrideModalOpen(false)}
        title="Administrative Priority Tier Override"
        description="Preserves calculated Phase 8 score while logging an administrative urgency adjustment."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOverrideModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmOverride}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction ? 'Applying...' : 'Apply Priority Override'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded bg-blue-50 border border-blue-200 text-blue-950 space-y-1">
            <span className="font-bold block">Original Phase 8 Calculated Priority:</span>
            <span className="font-mono text-slate-700">
              Score: {activeComplaint.priorityScore?.toFixed(2) ?? 'N/A'} — Tier:{' '}
              {detailData?.calculatedPriorityTier?.toUpperCase() ?? activeComplaint.priorityTier?.toUpperCase() ?? 'PENDING'}
            </span>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Target Priority Tier:</label>
            <select
              value={selectedOverrideTier}
              onChange={(e) => setSelectedOverrideTier(e.target.value as PriorityTier)}
              className="w-full p-2 border border-slate-300 rounded text-xs bg-white text-slate-800 font-bold"
            >
              <option value="critical">CRITICAL (Immediate hazard)</option>
              <option value="high">HIGH (Elevated safety risk)</option>
              <option value="medium">MEDIUM (Standard schedule)</option>
              <option value="low">LOW (Routine maintenance)</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Mandatory Justification Reason (min 5 chars):
            </label>
            <Textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g., Major road obstruction during peak public transit hours..."
              className="w-full text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* MODAL 4: CONFIRM DUPLICATE GRIEVANCE */}
      <Modal
        isOpen={isConfirmDuplicateModalOpen}
        onClose={() => setIsConfirmDuplicateModalOpen(false)}
        title="Confirm Duplicate Civic Grievance"
        description="Integrates with Phase 9 status workflow. Transitions the duplicate grievance to 'duplicate' status while preserving separate records."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmDuplicateModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmDuplicateAction}
              disabled={isSubmittingAction || confirmDuplicateReason.trim().length < 5}
            >
              {isSubmittingAction ? 'Confirming...' : 'Confirm as Duplicate'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-700" />
              Advisory Duplicate Resolution Policy
            </div>
            <p className="text-[11px] leading-relaxed">
              Confirming this grievance will transition <strong>{selectedCandidateToConfirm?.otherComplaint.trackingId}</strong> to the
              status <strong>&quot;duplicate&quot;</strong> under primary parent <strong>{activeComplaint.trackingNumber}</strong>.
              Records are <strong>not merged</strong> or deleted; both tracking IDs remain accessible with immutable status history.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Duplicate Candidate:</span>
              <span className="font-mono font-bold text-slate-800">
                {selectedCandidateToConfirm?.otherComplaint.trackingId} — {selectedCandidateToConfirm?.otherComplaint.title}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Heuristic Similarity:</span>
              <span className="font-bold text-amber-800">
                {selectedCandidateToConfirm?.candidate.similarityScore.toFixed(1)}% Confidence
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Parent Grievance:</span>
              <span className="font-mono font-bold text-blue-900">{activeComplaint.trackingNumber}</span>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Mandatory Justification Reason (min 5 characters):
            </label>
            <Textarea
              rows={3}
              value={confirmDuplicateReason}
              onChange={(e) => setConfirmDuplicateReason(e.target.value)}
              placeholder="e.g., Confirmed identical drainage cavity and road cave-in reported in Sector 17..."
              className="w-full text-xs"
            />
            {confirmDuplicateReason.trim().length > 0 && confirmDuplicateReason.trim().length < 5 && (
              <span className="text-[10px] text-red-600 mt-1 block">
                Reason must be at least 5 characters (current: {confirmDuplicateReason.trim().length}).
              </span>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL 5: DISMISS DUPLICATE SUGGESTION */}
      <Modal
        isOpen={isDismissDuplicateModalOpen}
        onClose={() => setIsDismissDuplicateModalOpen(false)}
        title="Dismiss Advisory Duplicate Suggestion"
        description="Confirms that these complaints represent distinct physical issues and retains them as separate grievances."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDismissDuplicateModalOpen(false)}
              disabled={isSubmittingAction}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDismissDuplicateAction}
              disabled={isSubmittingAction}
            >
              {isSubmittingAction ? 'Dismissing...' : 'Dismiss & Retain Separate'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Dismissing candidate correlation between <strong>{activeComplaint.trackingNumber}</strong> and{' '}
            <strong>{selectedCandidateToDismiss?.otherComplaint.trackingId}</strong>. Both grievances will remain
            independently active in the triage queue.
          </p>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Optional Administrative Review Note:
            </label>
            <Textarea
              rows={3}
              value={dismissDuplicateNote}
              onChange={(e) => setDismissDuplicateNote(e.target.value)}
              placeholder="e.g., Verified field coordinates represent distinct defects 35m apart..."
              className="w-full text-xs"
            />
          </div>
        </div>
      </Modal>
    </PageContainer>
    </div>
  );
};
