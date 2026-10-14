import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CIVIC_ISSUE_CATEGORIES, STATUS_METADATA, ROUTES } from '../constants';
import { getMockComplaints } from '../data/mockComplaints';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PriorityIndicator } from '../components/common/PriorityIndicator';
import {
  ShieldAlert,
  ArrowRight,
  Search,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Layers,
  Database,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Filter,
  Copy,
} from 'lucide-react';
import type { Complaint, PriorityLevel } from '../types';
import {
  getLiveAdminComplaints,
  getLiveAdminMetrics,
  type AdminMetrics,
} from '../services/admin/adminComplaintService';
import { useAuth } from '../hooks/useAuth';

export const AdminDashboardPage: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  // Live and demo state
  const [liveComplaints, setLiveComplaints] = useState<Complaint[]>([]);
  const [liveMetrics, setLiveMetrics] = useState<AdminMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sourceTab, setSourceTab] = useState<'all' | 'live' | 'demo'>('all');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [humanReviewOnly, setHumanReviewOnly] = useState<boolean>(false);
  const [duplicateAdvisoriesOnly, setDuplicateAdvisoriesOnly] = useState<boolean>(false);

  // Load real database complaints and metrics
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [complaintsRes, metricsRes] = await Promise.all([
        getLiveAdminComplaints(),
        getLiveAdminMetrics(),
      ]);

      if (complaintsRes.data) {
        setLiveComplaints(complaintsRes.data);
      }
      if (metricsRes.data) {
        setLiveMetrics(metricsRes.data);
      }
    } catch {
      // Gracefully handle network issues
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const demoComplaints = useMemo(() => getMockComplaints(), []);

  // Combined queue items tagged with source
  const combinedItems = useMemo(() => {
    const liveTagged = liveComplaints.map((c) => ({ ...c, isLive: true }));
    const demoTagged = demoComplaints.map((c) => ({ ...c, isLive: false }));

    if (sourceTab === 'live') return liveTagged;
    if (sourceTab === 'demo') return demoTagged;
    return [...liveTagged, ...demoTagged];
  }, [liveComplaints, demoComplaints, sourceTab]);

  // Priority Queue filtering and authoritative sorting
  const filteredQueue = useMemo(() => {
    return combinedItems.filter((item) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = item.trackingNumber.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSector = item.location.sector.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesSector && !matchesCategory) return false;
      }

      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      if (selectedPriority !== 'all') {
        const pTier = item.priorityTier ?? item.priorityCalculation?.priorityLevel;
        if (pTier !== (selectedPriority as PriorityLevel)) return false;
      }

      if (humanReviewOnly) {
        const isHr = Boolean(item.aiAssessment?.humanReviewRequired);
        if (!isHr) return false;
      }

      if (duplicateAdvisoriesOnly) {
        if (!item.hasDuplicateAdvisory) return false;
      }

      return true;
    });
  }, [combinedItems, searchQuery, selectedCategory, selectedStatus, selectedPriority, humanReviewOnly, duplicateAdvisoriesOnly]);

  // Aggregate metrics
  const activeMetrics = useMemo(() => {
    if (sourceTab === 'demo') {
      return {
        total: demoComplaints.length,
        submitted: demoComplaints.filter((c) => c.status === 'submitted').length,
        underReview: demoComplaints.filter((c) => c.status === 'under_review').length,
        inProgress: demoComplaints.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length,
        resolved: demoComplaints.filter((c) => c.status === 'resolved').length,
        criticalPriority: demoComplaints.filter((c) => c.priorityCalculation?.priorityLevel === 'critical').length,
        highPriority: demoComplaints.filter((c) => c.priorityCalculation?.priorityLevel === 'high').length,
        humanReviewRequired: 2,
      };
    }

    if (sourceTab === 'live') {
      if (liveMetrics) {
        return liveMetrics;
      }
      return {
        total: liveComplaints.length,
        submitted: liveComplaints.filter((c) => c.status === 'submitted').length,
        underReview: liveComplaints.filter((c) => c.status === 'under_review').length,
        inProgress: liveComplaints.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length,
        resolved: liveComplaints.filter((c) => c.status === 'resolved').length,
        criticalPriority: liveComplaints.filter((c) => c.priorityTier === 'critical').length,
        highPriority: liveComplaints.filter((c) => c.priorityTier === 'high').length,
        humanReviewRequired: liveComplaints.filter((c) => c.aiAssessment?.humanReviewRequired).length,
      };
    }

    // 'all' tab: sum of both
    const demoTotal = demoComplaints.length;
    const demoCritical = demoComplaints.filter((c) => c.priorityCalculation?.priorityLevel === 'critical').length;
    const demoHigh = demoComplaints.filter((c) => c.priorityCalculation?.priorityLevel === 'high').length;
    const demoSub = demoComplaints.filter((c) => c.status === 'submitted').length;
    const demoRev = demoComplaints.filter((c) => c.status === 'under_review').length;
    const demoProg = demoComplaints.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length;
    const demoRes = demoComplaints.filter((c) => c.status === 'resolved').length;

    const liveTotal = liveMetrics ? liveMetrics.total : liveComplaints.length;
    const liveCritical = liveMetrics
      ? liveMetrics.criticalPriority
      : liveComplaints.filter((c) => c.priorityTier === 'critical').length;
    const liveHigh = liveMetrics
      ? liveMetrics.highPriority
      : liveComplaints.filter((c) => c.priorityTier === 'high').length;
    const liveSub = liveMetrics ? liveMetrics.submitted : liveComplaints.filter((c) => c.status === 'submitted').length;
    const liveRev = liveMetrics ? liveMetrics.underReview : liveComplaints.filter((c) => c.status === 'under_review').length;
    const liveProg = liveMetrics ? liveMetrics.inProgress : liveComplaints.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length;
    const liveRes = liveMetrics ? liveMetrics.resolved : liveComplaints.filter((c) => c.status === 'resolved').length;

    return {
      total: demoTotal + liveTotal,
      submitted: demoSub + liveSub,
      underReview: demoRev + liveRev,
      inProgress: demoProg + liveProg,
      resolved: demoRes + liveRes,
      criticalPriority: demoCritical + liveCritical,
      highPriority: demoHigh + liveHigh,
      humanReviewRequired: 2 + (liveComplaints.filter((c) => c.aiAssessment?.humanReviewRequired).length || 0),
    };
  }, [sourceTab, demoComplaints, liveComplaints, liveMetrics]);

  return (
    <div className="page-enter py-4 sm:py-6">
      <PageContainer
        maxWidth="xl"
        headerTitle="Municipal Priority Command Queue"
        headerDescription="Authoritative triage desk for Chandigarh administration wings. Multimodal AI prioritization with mandatory human officer discretion."
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        }
      >
        {/* Admin Security Warning if not signed in as admin */}
        {!isAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-sky-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-sm text-sky-950">
                  Administrative Authentication Required for Actions
                </strong>
                <span className="text-sky-900 leading-relaxed">
                  You are currently viewing the triage console in demonstration inspection mode. To execute real status
                  transitions, department wing dispatches, and priority overrides on live database records, please{' '}
                  <Link to={ROUTES.LOGIN} className="font-bold underline text-sky-800 hover:text-sky-950">
                    sign in with an authorized municipal administrator account
                  </Link>.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Governance & Dispatch Mandate Notice */}
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-xs text-amber-950 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-950 block font-bold text-sm">
              Administrative Governance &amp; Dispatch Mandate
            </strong>
            <span className="leading-relaxed text-amber-900">
              Multimodal AI calculations provide objective evidence corroboration and deterministic priority ordering.
              Authorized municipal officers retain full decision-making discretion over department wing dispatch,
              priority score overrides, and remediation work orders.
            </span>
          </div>
        </div>

        {/* REAL METRICS ROW */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <div className="h-4 w-16 skeleton rounded" />
                <div className="h-8 w-12 skeleton rounded" />
                <div className="h-3 w-20 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <Card padding="md" className="stat-card card-lift border-slate-200/90 bg-white">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Total Intake</span>
                <FileText className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">{activeMetrics.total}</div>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Active grievances</p>
            </Card>

            <Card padding="md" className="stat-card card-lift border-rose-200/80 bg-white">
              <div className="flex items-center justify-between text-xs text-rose-700 font-bold">
                <span>Critical</span>
                <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
              </div>
              <div className="mt-2 text-2xl font-black text-rose-600 tracking-tight">{activeMetrics.criticalPriority}</div>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Score &ge; 80.00</p>
            </Card>

            <Card padding="md" className="stat-card card-lift border-amber-200/80 bg-white">
              <div className="flex items-center justify-between text-xs text-amber-700 font-bold">
                <span>High Priority</span>
                <span className="h-2 w-2 rounded-full bg-amber-500" />
              </div>
              <div className="mt-2 text-2xl font-black text-amber-600 tracking-tight">{activeMetrics.highPriority}</div>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Score 60.00–79.99</p>
            </Card>

            <Card padding="md" className="stat-card card-lift border-sky-200/80 bg-white">
              <div className="flex items-center justify-between text-xs text-sky-700 font-bold">
                <span>Pending Review</span>
                <Clock className="h-4 w-4 text-sky-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-sky-700 tracking-tight">
                {activeMetrics.submitted + activeMetrics.underReview}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Intake / Triage</p>
            </Card>

            <Card padding="md" className="stat-card card-lift border-purple-200/80 bg-white">
              <div className="flex items-center justify-between text-xs text-purple-700 font-bold">
                <span>In Progress</span>
                <Layers className="h-4 w-4 text-purple-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-purple-700 tracking-tight">{activeMetrics.inProgress}</div>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Field remediation</p>
            </Card>

            <Card padding="md" className="stat-card card-lift border-emerald-200/80 bg-white">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-bold">
                <span>Resolved</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-700 tracking-tight">{activeMetrics.resolved}</div>
              <p className="mt-0.5 text-[11px] text-slate-500 font-medium">Works verified</p>
            </Card>
          </div>
        )}

        {/* MAIN SECTION: PRIORITY QUEUE */}
        <Card className="border-slate-200/90 shadow-sm overflow-hidden">
          <CardHeader
            title="Authoritative Priority Triage Queue"
            subtitle="Ranked deterministically: Critical → High → Medium → Low → Pending, newest submission first"
            action={
              <div className="flex items-center gap-2">
                {/* Source Tab Toggle */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setSourceTab('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      sourceTab === 'all' ? 'bg-[#0a1628] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({liveComplaints.length + demoComplaints.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab('live')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                      sourceTab === 'live' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Database className="h-3 w-3" />
                    Live DB ({liveComplaints.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab('demo')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                      sourceTab === 'demo' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    Demo ({demoComplaints.length})
                  </button>
                </div>
              </div>
            }
          />

          {/* Filters and Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              {/* Search */}
              <div className="relative sm:col-span-2">
                <Search className="h-4 w-4 absolute left-3.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tracking ID, issue, sector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                />
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by Category"
                  className="civic-select text-xs py-1.5"
                >
                  <option value="all">All Categories</option>
                  {CIVIC_ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter by Status"
                  className="civic-select text-xs py-1.5"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                  <option value="duplicate">Duplicate</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  aria-label="Filter by Priority"
                  className="civic-select text-xs py-1.5"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical (80–100)</option>
                  <option value="high">High (60–79.99)</option>
                  <option value="medium">Medium (35–59.99)</option>
                  <option value="low">Low (0–34.99)</option>
                </select>
              </div>

              {/* Flags (Human Review & Duplicate) */}
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={humanReviewOnly}
                    onChange={(e) => setHumanReviewOnly(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="flex items-center gap-1 truncate">
                    <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                    Review
                  </span>
                </label>

                <label className="flex-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={duplicateAdvisoriesOnly}
                    onChange={(e) => setDuplicateAdvisoriesOnly(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="flex items-center gap-1 truncate">
                    <Copy className="h-3 w-3 text-amber-700 shrink-0" />
                    Duplicate
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3.5">Complaint ID</th>
                  <th className="py-3 px-3.5">Issue Overview</th>
                  <th className="py-3 px-3.5">Origin</th>
                  <th className="py-3 px-3.5">Category</th>
                  <th className="py-3 px-3.5">Priority Score &amp; Tier</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Submitted</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {isLoading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="py-4 px-4">
                        <div className="h-5 skeleton rounded-lg w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Filter className="h-8 w-8 text-slate-300 mx-auto" />
                        <div className="font-bold text-slate-800">No Complaints Match Filter Criteria</div>
                        <p className="text-xs text-slate-500">
                          Try resetting filters or switching between Live DB and Demo tabs.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((item) => {
                    const statusMeta = STATUS_METADATA[item.status];
                    const priorityTier = item.priorityTier ?? item.priorityCalculation?.priorityLevel ?? null;
                    const priorityScore = item.priorityScore ?? item.priorityCalculation?.finalScore ?? null;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-sky-50/30 transition-colors ${
                          item.isLive ? 'bg-emerald-50/15' : ''
                        }`}
                      >
                        <td className="py-3.5 px-3.5 font-mono font-bold text-sky-950 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md text-[11px]">
                              {item.trackingNumber}
                            </span>
                            {item.hasDuplicateAdvisory && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md"
                                title="Advisory duplicate candidate detected for human review"
                              >
                                <Copy className="h-2.5 w-2.5 text-amber-700" />
                                Duplicate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 font-medium text-slate-900 max-w-[220px]">
                          <div className="truncate font-bold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {item.location.sector} • {item.location.landmark || item.location.address}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {item.isLive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Database className="h-3 w-3" />
                              Live Record
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Sparkles className="h-3 w-3 text-amber-500" />
                              Demo
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <Badge variant="secondary" size="sm">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          {priorityTier ? (
                            <div className="flex items-center gap-1.5">
                              <PriorityIndicator priority={priorityTier} score={priorityScore ?? undefined} />
                              {item.isPriorityOverridden && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                  Override
                                </span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Priority Pending
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap">
                          <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            {statusMeta?.label || item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3.5 whitespace-nowrap text-slate-500 text-[11px]">
                          {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-3.5 text-right whitespace-nowrap">
                          <Link to={`/admin/complaints/${item.id}`}>
                            <Button
                              variant="primary"
                              size="sm"
                              rightIcon={<ArrowRight className="h-3 w-3" />}
                              className="btn-gradient-sky text-xs py-1"
                            >
                              Review &amp; Triage
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="lg:hidden p-4 space-y-3">
            {filteredQueue.map((item) => {
              const statusMeta = STATUS_METADATA[item.status];
              const priorityTier = item.priorityTier ?? item.priorityCalculation?.priorityLevel ?? null;
              const priorityScore = item.priorityScore ?? item.priorityCalculation?.finalScore ?? null;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border border-slate-200/90 bg-white space-y-3 shadow-xs ${
                    item.isLive ? 'border-emerald-200 bg-emerald-50/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-sky-950 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200">
                        {item.trackingNumber}
                      </span>
                      {item.hasDuplicateAdvisory && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md"
                          title="Advisory duplicate candidate detected for human review"
                        >
                          <Copy className="h-2.5 w-2.5 text-amber-700" />
                          Duplicate
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {item.isLive ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200">
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                          Demo
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {statusMeta?.label || item.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>
                        {item.location.sector} • {item.location.landmark || item.location.address}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {priorityTier ? (
                        <>
                          <PriorityIndicator priority={priorityTier} score={priorityScore ?? undefined} />
                          {item.isPriorityOverridden && (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                              Override
                            </span>
                          )}
                        </>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Priority Pending
                        </Badge>
                      )}
                    </div>
                    <Link to={`/admin/complaints/${item.id}`}>
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight className="h-3 w-3" />}
                        className="btn-gradient-sky text-xs py-1"
                      >
                        Review &amp; Triage
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </PageContainer>
    </div>
  );
};

export default AdminDashboardPage;
