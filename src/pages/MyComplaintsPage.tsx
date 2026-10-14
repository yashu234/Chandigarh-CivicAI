import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES, CIVIC_ISSUE_CATEGORIES, STATUS_METADATA } from '../constants';
import { getMockComplaints } from '../data/mockComplaints';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PriorityIndicator } from '../components/common/PriorityIndicator';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import {
  PlusCircle,
  Search,
  Calendar,
  MapPin,
  Eye,
  RefreshCw,
  Database,
  Sparkles,
} from 'lucide-react';
import type { Complaint, PriorityLevel } from '../types';
import { getMyLiveComplaints } from '../services/complaintsService';
import { useAuth } from '../hooks/useAuth';

interface ComplaintItemWithSource extends Complaint {
  isLive?: boolean;
}

export const MyComplaintsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const mockComplaints = useMemo<ComplaintItemWithSource[]>(
    () => getMockComplaints().map((c) => ({ ...c, isLive: false })),
    []
  );

  const [liveComplaints, setLiveComplaints] = useState<ComplaintItemWithSource[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);

  // Tab filter: 'all' | 'live' | 'demo'
  const [sourceTab, setSourceTab] = useState<'all' | 'live' | 'demo'>('all');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // UI State Demonstration toggles for thorough testing
  const [viewState, setViewState] = useState<'normal' | 'loading' | 'error' | 'empty'>('normal');

  // Load real live complaints from Supabase
  useEffect(() => {
    let isMounted = true;

    async function fetchLive() {
      if (!isAuthenticated) {
        setIsLoadingLive(false);
        return;
      }
      const { data } = await getMyLiveComplaints();
      if (!isMounted) return;

      if (data && data.length > 0) {
        setLiveComplaints(data.map((c) => ({ ...c, isLive: true })));
        setSourceTab('all');
      }
      setIsLoadingLive(false);
    }

    fetchLive();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Combined list with clear separation
  const combinedComplaints = useMemo<ComplaintItemWithSource[]>(() => {
    if (sourceTab === 'live') {
      return liveComplaints;
    }
    if (sourceTab === 'demo') {
      return mockComplaints;
    }
    return [...liveComplaints, ...mockComplaints];
  }, [liveComplaints, mockComplaints, sourceTab]);

  // Filter logic
  const filteredComplaints = useMemo(() => {
    if (viewState === 'empty') return [];

    return combinedComplaints.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesId = item.trackingNumber.toLowerCase().includes(query);
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesSector = item.location.sector.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        if (!matchesId && !matchesTitle && !matchesSector && !matchesCategory) {
          return false;
        }
      }

      // Category
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Status
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }

      // Priority
      if (selectedPriority !== 'all') {
        const itemPriority = item.priorityTier ?? item.priorityCalculation?.priorityLevel;
        if (itemPriority !== (selectedPriority as PriorityLevel)) {
          return false;
        }
      }

      return true;
    });
  }, [combinedComplaints, searchQuery, selectedCategory, selectedStatus, selectedPriority, viewState]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSourceTab('all');
    setViewState('normal');
  };

  return (
    <div className="page-enter py-4 sm:py-6">
      <PageContainer
        maxWidth="xl"
        headerTitle="Citizen Grievance Register"
        headerDescription="Comprehensive ledger of your reported civic issues with live Supabase database records and demonstration scenarios."
        headerAction={
          <div className="flex items-center gap-2">
            {/* UI state selector for tester verification */}
            <div className="hidden sm:flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-xs">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider px-2">
                Simulate:
              </span>
              <button
                type="button"
                onClick={() => setViewState('normal')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewState === 'normal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setViewState('loading')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewState === 'loading'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Loading
              </button>
              <button
                type="button"
                onClick={() => setViewState('error')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewState === 'error'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Error
              </button>
              <button
                type="button"
                onClick={() => setViewState('empty')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  viewState === 'empty'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Empty
              </button>
            </div>

            <Link to={ROUTES.REPORT_ISSUE}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<PlusCircle className="h-4 w-4" />}
                className="btn-gradient-sky"
              >
                Report Issue
              </Button>
            </Link>
          </div>
        }
      >
        {/* Separation Tabs: Live vs Demo Records */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setSourceTab('all')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 ${
              sourceTab === 'all'
                ? 'bg-[#0a1628] text-white border-[#0a1628] shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>All Grievances</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                sourceTab === 'all' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {combinedComplaints.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSourceTab('live')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 ${
              sourceTab === 'live'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Live Filed Complaints</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                sourceTab === 'live' ? 'bg-white text-emerald-800 font-bold' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {liveComplaints.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSourceTab('demo')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-2 ${
              sourceTab === 'demo'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-white text-sky-900 border-sky-200 hover:bg-sky-50'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Demo Showcase Data</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                sourceTab === 'demo' ? 'bg-white text-sky-900 font-bold' : 'bg-sky-100 text-sky-800'
              }`}
            >
              {mockComplaints.length}
            </span>
          </button>
        </div>

        {/* Search and Filters Bar */}
        <Card className="mb-6 p-4 border-slate-200/80 shadow-sm">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search tracking ID (e.g. CHD-2026), sector, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all font-medium"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 shrink-0">
              {/* Category Filter */}
              <div className="min-w-[150px]">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by Category"
                  className="civic-select text-xs py-2"
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
              <div className="min-w-[140px]">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter by Status"
                  className="civic-select text-xs py-2"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div className="min-w-[140px]">
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  aria-label="Filter by Priority"
                  className="civic-select text-xs py-2"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedPriority !== 'all' || sourceTab !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                leftIcon={<RefreshCw className="h-3 w-3" />}
                className="hover:bg-slate-100 text-slate-600"
              >
                Reset
              </Button>
            )}
          </div>
        </Card>

        {/* RENDER VIEW STATES */}
        {(viewState === 'loading' || isLoadingLive) && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-5 w-48 skeleton rounded-lg" />
                <div className="h-5 w-24 skeleton rounded-lg" />
              </div>
              <div className="space-y-3 pt-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 last:border-0">
                    <div className="h-8 w-28 skeleton rounded-lg shrink-0" />
                    <div className="h-5 w-64 skeleton rounded-lg flex-1" />
                    <div className="h-6 w-20 skeleton rounded-full" />
                    <div className="h-6 w-24 skeleton rounded-full" />
                    <div className="h-8 w-16 skeleton rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewState === 'error' && (
          <div className="py-12">
            <ErrorState
              title="Unable to load grievance register"
              message="Demonstration simulated network error. Click retry to return to normal active view."
              onRetry={() => setViewState('normal')}
            />
          </div>
        )}

        {viewState === 'normal' && !isLoadingLive && filteredComplaints.length === 0 && (
          <div className="py-12">
            <EmptyState
              title="No grievances match current filters"
              description="Try adjusting your search query, or clear the category, status, and priority filters."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Clear All Filters
                </Button>
              }
            />
          </div>
        )}

        {viewState === 'empty' && (
          <div className="py-12">
            <EmptyState
              title="Zero grievances on record"
              description="You have not filed any civic grievances yet. Start by reporting a municipal defect with photographic evidence."
              action={
                <div className="flex items-center gap-3">
                  <Link to={ROUTES.REPORT_ISSUE}>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<PlusCircle className="h-4 w-4" />}
                      className="btn-gradient-sky"
                    >
                      Report First Issue
                    </Button>
                  </Link>
                  <Button variant="outline" size="sm" onClick={() => setViewState('normal')}>
                    Return to Demo List
                  </Button>
                </div>
              }
            />
          </div>
        )}

        {viewState === 'normal' && !isLoadingLive && filteredComplaints.length > 0 && (
          <div className="space-y-4">
            {/* DESKTOP / TABLET TABLE VIEW */}
            <div className="hidden md:block bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Complaint ID</th>
                    <th className="py-3.5 px-4">Issue Description</th>
                    <th className="py-3.5 px-4">Origin</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Priority / AI Status</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Submitted</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredComplaints.map((item) => {
                    const statusMeta = STATUS_METADATA[item.status];
                    const priorityLevel = item.priorityCalculation?.priorityLevel || 'medium';
                    const priorityScore = item.priorityCalculation?.finalScore;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-sky-50/30 transition-colors ${
                          item.isLive ? 'bg-emerald-50/15' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-sky-950 whitespace-nowrap">
                          <span className="bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-md text-[11px]">
                            {item.trackingNumber}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs">
                          <div className="truncate font-bold text-slate-900 hover:text-sky-600 transition-colors">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {item.location.sector} • {item.location.landmark || item.location.address}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.isLive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Database className="h-3 w-3" />
                              Live Record
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Sparkles className="h-3 w-3 text-amber-500" />
                              Demo Data
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge variant="secondary" size="sm">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.isLive ? (
                            (item.effectivePriorityTier || item.priorityTier) ? (
                              <PriorityIndicator
                                priority={item.effectivePriorityTier || item.priorityTier!}
                                score={item.calculatedPriorityScore ?? item.priorityScore ?? undefined}
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="neutral" size="sm">
                                  Priority Pending
                                </Badge>
                                {item.aiAnalysisState === 'completed' && (
                                  <Badge variant="success" size="sm">AI Corroborated</Badge>
                                )}
                              </div>
                            )
                          ) : (
                            <PriorityIndicator priority={priorityLevel} score={priorityScore} />
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                            {statusMeta?.label || item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link to={ROUTES.COMPLAINT_DETAILS(item.id)}>
                            <Button
                              variant="outline"
                              size="sm"
                              rightIcon={<Eye className="h-3.5 w-3.5 text-sky-600" />}
                              className="hover:border-sky-300"
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS VIEW */}
            <div className="md:hidden space-y-3">
              {filteredComplaints.map((item) => {
                const statusMeta = STATUS_METADATA[item.status];
                const priorityLevel = item.priorityCalculation?.priorityLevel || 'medium';
                const priorityScore = item.priorityCalculation?.finalScore;

                return (
                  <Card
                    key={item.id}
                    className={`p-4 space-y-3 rounded-2xl border-slate-200/90 shadow-sm ${
                      item.isLive ? 'border-emerald-200 bg-emerald-50/15' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-sky-950 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                        {item.trackingNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {item.isLive ? (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                            Live
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Demo
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {statusMeta?.label || item.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          {item.location.sector} • {item.location.landmark || item.location.address}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="secondary" size="sm">
                        {item.category}
                      </Badge>
                      {item.isLive ? (
                        (item.effectivePriorityTier || item.priorityTier) ? (
                          <PriorityIndicator
                            priority={item.effectivePriorityTier || item.priorityTier!}
                            score={item.calculatedPriorityScore ?? item.priorityScore ?? undefined}
                          />
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Priority Pending
                          </Badge>
                        )
                      ) : (
                        <PriorityIndicator priority={priorityLevel} score={priorityScore} />
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
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
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
};

export default MyComplaintsPage;
