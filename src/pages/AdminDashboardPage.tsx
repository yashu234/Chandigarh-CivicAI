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
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchInitial = async () => {
      setIsLoading(true);
      const [complaintsRes, metricsRes] = await Promise.all([
        getLiveAdminComplaints(),
        getLiveAdminMetrics(),
      ]);
      if (!isMounted) return;
      if (complaintsRes.data) {
        setLiveComplaints(complaintsRes.data);
      }
      if (metricsRes.data) {
        setLiveMetrics(metricsRes.data);
      }
      setIsLoading(false);
    };
    fetchInitial();
    return () => {
      isMounted = false;
    };
  }, []);

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

    if (liveMetrics && sourceTab === 'live') {
      return {
        total: liveMetrics.total,
        submitted: liveMetrics.submitted,
        underReview: liveMetrics.underReview,
        inProgress: liveMetrics.inProgress + liveMetrics.assigned,
        resolved: liveMetrics.resolved,
        criticalPriority: liveMetrics.criticalPriority,
        highPriority: liveMetrics.highPriority,
        humanReviewRequired: liveMetrics.humanReviewRequired,
      };
    }

    // Combined default
    return {
      total: (liveMetrics?.total ?? 0) + demoComplaints.length,
      submitted: (liveMetrics?.submitted ?? 0) + demoComplaints.filter((c) => c.status === 'submitted').length,
      underReview: (liveMetrics?.underReview ?? 0) + demoComplaints.filter((c) => c.status === 'under_review').length,
      inProgress: (liveMetrics ? liveMetrics.inProgress + liveMetrics.assigned : 0) + demoComplaints.filter((c) => c.status === 'in_progress' || c.status === 'assigned').length,
      resolved: (liveMetrics?.resolved ?? 0) + demoComplaints.filter((c) => c.status === 'resolved').length,
      criticalPriority: (liveMetrics?.criticalPriority ?? 0) + demoComplaints.filter((c) => c.priorityCalculation?.priorityLevel === 'critical').length,
      highPriority: (liveMetrics?.highPriority ?? 0) + demoComplaints.filter((c) => c.priorityCalculation?.priorityLevel === 'high').length,
      humanReviewRequired: (liveMetrics?.humanReviewRequired ?? 0) + 2,
    };
  }, [liveMetrics, demoComplaints, sourceTab]);

  return (
    <PageContainer
      maxWidth="xl"
      headerTitle="Municipal Administrator Command Center"
      headerDescription="Deterministic AI-scored triage queue and dispatch management for Chandigarh municipal departments."
      headerAction={
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Badge variant="success" size="sm">
              Verified Administrator
            </Badge>
          ) : (
            <Badge variant="warning" size="sm">
              Read-Only Demo Mode
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            leftIcon={<RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      }
    >
      {/* Admin Security Warning if not signed in as admin */}
      {!isAdmin && (
        <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-sm">
                Administrative Authentication Required for Actions
              </strong>
              <span>
                You are currently viewing the triage console in demonstration mode. To execute real status
                transitions, department wing dispatches, and priority overrides on live database records, please{' '}
                <Link to={ROUTES.LOGIN} className="font-bold underline text-blue-900">
                  sign in with an authorized municipal administrator account
                </Link>.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Governance & Dispatch Mandate Notice */}
      <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong className="text-amber-950 block font-semibold text-sm">
            Administrative Governance & Dispatch Mandate
          </strong>
          <span className="leading-relaxed text-amber-900">
            Multimodal AI calculations provide objective evidence corroboration and deterministic priority ordering.
            Authorized municipal officers retain full decision-making discretion over department wing dispatch,
            priority score overrides, and remediation work orders.
          </span>
        </div>
      </div>

      {/* REAL METRICS ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Card padding="md" className="border-l-4 border-l-slate-700 bg-white">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Intake</span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{activeMetrics.total}</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Active grievances</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-red-600 bg-white">
          <div className="flex items-center justify-between text-xs text-red-700 font-semibold">
            <span>Critical Priority</span>
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-red-600">{activeMetrics.criticalPriority}</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Score &ge; 80.00</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-amber-500 bg-white">
          <div className="flex items-center justify-between text-xs text-amber-700 font-semibold">
            <span>High Priority</span>
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600">{activeMetrics.highPriority}</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Score 60.00–79.99</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-blue-600 bg-white">
          <div className="flex items-center justify-between text-xs text-blue-700 font-semibold">
            <span>Pending Review</span>
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-blue-700">
            {activeMetrics.submitted + activeMetrics.underReview}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Intake / Triage</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-purple-600 bg-white">
          <div className="flex items-center justify-between text-xs text-purple-700 font-semibold">
            <span>In Progress</span>
            <Layers className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-purple-700">{activeMetrics.inProgress}</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Field remediation</p>
        </Card>

        <Card padding="md" className="border-l-4 border-l-emerald-600 bg-white">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
            <span>Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">{activeMetrics.resolved}</div>
          <p className="mt-0.5 text-[11px] text-slate-500">Works verified</p>
        </Card>
      </div>

      {/* MAIN SECTION: PRIORITY QUEUE */}
      <Card>
        <CardHeader
          title="Authoritative Priority Triage Queue"
          subtitle="Ranked deterministically: Critical → High → Medium → Low → Pending, newest submission first"
          action={
            <div className="flex items-center gap-2">
              {/* Source Tab Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setSourceTab('all')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                    sourceTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({liveComplaints.length + demoComplaints.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceTab('live')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                    sourceTab === 'live' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Database className="h-3 w-3" />
                  Live DB ({liveComplaints.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSourceTab('demo')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                    sourceTab === 'demo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Demo ({demoComplaints.length})
                </button>
              </div>
            </div>
          }
        />

        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tracking ID, issue, sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by Category"
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {CIVIC_ISSUE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by Status"
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              aria-label="Filter by Priority"
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical (80–100)</option>
              <option value="high">High (60–79.99)</option>
              <option value="medium">Medium (35–59.99)</option>
              <option value="low">Low (0–34.99)</option>
            </select>

            {/* Human Review Checkbox Filter */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-md border border-slate-300 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={humanReviewOnly}
                onChange={(e) => setHumanReviewOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Human Review Only
              </span>
            </label>

            {/* Duplicate Advisory Checkbox Filter */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-md border border-slate-300 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={duplicateAdvisoriesOnly}
                onChange={(e) => setDuplicateAdvisoriesOnly(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="flex items-center gap-1">
                <Copy className="h-3.5 w-3.5 text-amber-700" />
                Duplicate Advisory
              </span>
            </label>
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-3">Complaint ID</th>
                <th className="py-3 px-3">Issue Overview</th>
                <th className="py-3 px-3">Origin</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Priority Score & Tier</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Submitted</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredQueue.length === 0 ? (
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
                      className={`hover:bg-slate-50/80 transition-colors ${
                        item.isLive ? 'bg-emerald-50/15' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{item.trackingNumber}</span>
                          {item.hasDuplicateAdvisory && (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded"
                              title="Advisory duplicate candidate detected for human review"
                            >
                              <Copy className="h-2.5 w-2.5 text-amber-700" />
                              Duplicate
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-900 max-w-[220px]">
                        <div className="truncate font-semibold">{item.title}</div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          {item.location.sector} • {item.location.landmark || item.location.address}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {item.isLive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                            <Database className="h-3 w-3" />
                            Live Record
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            Demo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <Badge variant="secondary" size="sm">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
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
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {statusMeta?.label || item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <Link to={`/admin/complaints/${item.id}`}>
                          <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3 w-3" />}>
                            Review & Triage
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
                className={`p-4 rounded-lg border border-slate-200 bg-white space-y-3 ${
                  item.isLive ? 'border-emerald-200 bg-emerald-50/10' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {item.trackingNumber}
                    </span>
                    {item.hasDuplicateAdvisory && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded"
                        title="Advisory duplicate candidate detected for human review"
                      >
                        <Copy className="h-2.5 w-2.5 text-amber-700" />
                        Duplicate
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isLive ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200">
                        Live
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        Demo
                      </span>
                    )}
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {statusMeta?.label || item.status}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      {item.location.sector} • {item.location.landmark || item.location.address}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
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
                    <Button variant="primary" size="sm" rightIcon={<ArrowRight className="h-3 w-3" />}>
                      Review & Triage
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </PageContainer>
  );
};
