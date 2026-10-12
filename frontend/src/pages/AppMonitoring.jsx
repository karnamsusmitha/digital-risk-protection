import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Search,
  CheckCircle2,
  RefreshCw,
  Plus,
  Eye,
  Code2,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  Building,
  Trash2
} from 'lucide-react';
import { appMonitoringService } from '../services/appMonitoringService';
import { brandProfileService } from '../services/brandProfileService';
import Card, { CardContent, CardFooter } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import LoadingState from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorMessage';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/Table';
import AppSubmissionModal from '../components/app/AppSubmissionModal';
import AppComparisonModal from '../components/app/AppComparisonModal';

const RISK_LEVEL_OPTIONS = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'critical', label: 'Critical (85-100)' },
  { value: 'high', label: 'High (70-84)' },
  { value: 'medium', label: 'Medium (50-69)' },
  { value: 'low', label: 'Low (0-49)' }
];

const REVIEW_STATUS_FILTERS = [
  { value: 'all', label: 'All Review Statuses' },
  { value: 'new', label: 'New' },
  { value: 'needs review', label: 'Needs Review' },
  { value: 'confirmed suspicious', label: 'Confirmed Suspicious' },
  { value: 'false positive', label: 'False Positive' }
];

const STORE_FILTERS = [
  { value: 'all', label: 'All Stores & Repos' },
  { value: 'google play', label: 'Google Play' },
  { value: 'apple app store', label: 'Apple App Store' },
  { value: 'apkpure', label: 'APKPure' },
  { value: 'apkmirror', label: 'APKMirror' },
  { value: 'f-droid', label: 'F-Droid' },
  { value: 'unofficial', label: 'Third-Party / Web' }
];

export default function AppMonitoring() {
  const [candidates, setCandidates] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');

  // Modals & Active Candidate
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isApiContractModalOpen, setIsApiContractModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Initial Data Fetch
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let savedBrands = [];
      try {
        if (typeof brandProfileService.getSavedBrands === 'function') {
          savedBrands = brandProfileService.getSavedBrands();
        } else if (typeof brandProfileService.getProfiles === 'function') {
          const bpRes = await brandProfileService.getProfiles();
          savedBrands = bpRes.data || [];
        }
      } catch (brandErr) {
        console.warn('Brand retrieval warning:', brandErr);
      }
      setBrands(Array.isArray(savedBrands) ? savedBrands : (savedBrands?.data || []));

      const res = await appMonitoringService.getCandidates({
        brandId: brandFilter,
        riskLevel: riskFilter,
        status: statusFilter,
        store: storeFilter,
        search
      });

      setCandidates(res.data);
      setIsBackendOnline(res.isRemote);
    } catch (err) {
      setError(err.message || 'Failed to load mobile app telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener('drp_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('drp_data_updated', handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandFilter, riskFilter, statusFilter, storeFilter]);

  // Handle Free-text Filter Client-side
  const filteredCandidates = candidates.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.appName.toLowerCase().includes(q) ||
      (item.packageId && item.packageId.toLowerCase().includes(q)) ||
      (item.publisher && item.publisher.toLowerCase().includes(q)) ||
      item.store.toLowerCase().includes(q) ||
      item.matchedBrand.toLowerCase().includes(q) ||
      item.comparativeAnalysis?.detectionReasons?.some((r) => r.toLowerCase().includes(q))
    );
  });

  // Candidate Submission & Analysis Handler
  const handleAnalyzeCandidate = async (candidateData, brand, officialApp) => {
    setIsAnalyzing(true);
    try {
      const res = await appMonitoringService.analyzeCandidate(candidateData, brand, officialApp);
      setIsSubmitModalOpen(false);

      // Refresh candidate list
      await fetchData();

      // Open detailed comparison modal for the newly analyzed candidate
      setSelectedCandidate(res.data);

      showToast(
        res.isRemote
          ? `Live API evaluated "${res.data.appName}" with risk score ${res.data.comparativeAnalysis.riskScore}/100.`
          : `Client-side heuristic engine evaluated "${res.data.appName}" (Risk: ${res.data.comparativeAnalysis.riskScore}/100).`
      );

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drp_data_updated', { detail: { type: 'app_analyzed' } }));
      }
    } catch (err) {
      showToast(`Analysis failed: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Review Status Update Handler
  const handleUpdateReview = async (id, reviewData) => {
    try {
      const res = await appMonitoringService.updateReview(id, reviewData);
      setCandidates((prev) => prev.map((c) => (c.id === id ? res.data : c)));
      setSelectedCandidate(res.data);
      showToast(`Review status updated to "${reviewData.status}".`);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drp_data_updated', { detail: { type: 'app_reviewed' } }));
      }
    } catch (err) {
      showToast(`Failed to update review: ${err.message}`);
    }
  };

  // Takedown Filing Handler
  const handleIssueTakedown = async (candidate) => {
    try {
      const updatedReview = {
        status: 'Confirmed Suspicious',
        analystNotes: `${candidate.review?.analystNotes || ''}\n[DMCA Escalation]: Takedown notice filed with ${candidate.store} store compliance team on ${new Date().toLocaleDateString()}.`
      };
      await handleUpdateReview(candidate.id, updatedReview);
      showToast(`Store DMCA infringement complaint filed for ${candidate.appName} on ${candidate.store}.`);
    } catch {
      showToast(`Failed to dispatch store DMCA notice.`);
    }
  };

  // Reset to Baseline Demo Data
  const handleResetToBaseline = () => {
    const defaults = appMonitoringService.resetToDefaults();
    setCandidates(defaults);
    showToast('App monitoring candidates reset to baseline demonstration dataset.');
  };

  // Delete Candidate
  const handleDeleteCandidate = async (id, name, e) => {
    e.stopPropagation();
    if (confirm(`Archive or remove candidate finding "${name}"?`)) {
      await appMonitoringService.deleteCandidate(id);
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      showToast(`Removed candidate "${name}".`);
    }
  };

  // Quick Triage Status Change from Table Row
  const handleQuickStatusChange = async (candidate, newStatus, e) => {
    e.stopPropagation();
    await handleUpdateReview(candidate.id, {
      status: newStatus,
      analystNotes: candidate.review?.analystNotes || ''
    });
  };

  // Summary Metrics
  const totalApps = candidates.length;
  const criticalThreats = candidates.filter((c) => c.comparativeAnalysis?.severity === 'critical').length;
  const needsReviewCount = candidates.filter((c) => c.review?.status === 'Needs Review').length;
  const publisherMismatches = candidates.filter((c) => c.comparativeAnalysis?.publisherMismatch).length;

  if (loading && candidates.length === 0) {
    return <LoadingState message="Connecting to mobile store threat feeds and APK reverse-engineering engine..." />;
  }

  if (error && candidates.length === 0) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Mobile App & APK Store Monitoring
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isBackendOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBackendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isBackendOnline ? 'Live REST API' : 'Local Heuristic Sandbox'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Detect rogue mobile apps, counterfeit APK listings, and unauthorized brand usage across Google Play, Apple App Store, and third-party APK repositories.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsApiContractModalOpen(true)}
            leftIcon={Code2}
            className="text-xs text-slate-600"
          >
            API Contract
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToBaseline}
            leftIcon={RotateCcw}
            className="text-xs text-slate-600"
            title="Reset to default mock findings"
          >
            Reset Demo
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            leftIcon={RefreshCw}
            className="text-xs text-slate-600"
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
            leftIcon={Plus}
          >
            Submit Candidate App
          </Button>
        </div>
      </div>

      {/* DEMO / OFFLINE SANDBOX NOTICE BANNER */}
      {!isBackendOnline && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs border border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <p className="text-slate-200">
              <strong className="text-white">Demonstration Sandbox Active:</strong> Backend API is currently running in local evaluation mode. Threat assessments use client-side multi-factor heuristics (Levenshtein name similarity, publisher analysis, package squatting, and permission flags).
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400 shrink-0 bg-slate-800 px-2 py-1 rounded">
            Target: /api/v1/app-monitoring/*
          </span>
        </div>
      )}

      {/* METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Monitored Apps</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">{totalApps}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Aggregated across store feeds</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Critical Threats</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2 font-mono">{criticalThreats}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">High overlay / trojan risk</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Publisher Mismatches</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2 font-mono">{publisherMismatches}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Advisory signal requiring triage</span>
        </Card>

        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Needs Review</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-2 font-mono">{needsReviewCount}</p>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Pending analyst decision</span>
        </Card>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px]">
              <Input
                placeholder="Search candidate app, package ID, publisher, brand, or store..."
                startIcon={Search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Risk Level Filter */}
              <div>
                <Select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  {RISK_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Review Status Filter */}
              <div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {REVIEW_STATUS_FILTERS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Store Filter */}
              <div>
                <Select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                >
                  {STORE_FILTERS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Brand Filter */}
              <div>
                <Select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                >
                  <option value="all">All Brands</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Clear Filters */}
            {(search || riskFilter !== 'all' || statusFilter !== 'all' || brandFilter !== 'all' || storeFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRiskFilter('all');
                  setStatusFilter('all');
                  setBrandFilter('all');
                  setStoreFilter('all');
                }}
                className="text-xs text-slate-500 whitespace-nowrap"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CANDIDATE APPS TABLE */}
      <Card className="overflow-hidden">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Candidate App & Store</TableHead>
                <TableHead className="w-[20%]">Target Brand & Benchmark</TableHead>
                <TableHead className="w-[18%]">Package & Publisher</TableHead>
                <TableHead className="w-[12%]">Risk Assessment</TableHead>
                <TableHead className="w-[10%]">Review Status</TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.map((c) => {
                const analysis = c.comparativeAnalysis || {};
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => setSelectedCandidate(c)}
                    className="cursor-pointer hover:bg-slate-50/70 transition-colors"
                  >
                    {/* 1. App Title & Store */}
                    <TableCell>
                      <div className="flex items-start gap-3">
                        {c.logoUrl ? (
                          <img
                            src={c.logoUrl}
                            alt={c.appName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs mt-0.5"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 text-slate-400">
                            <Smartphone className="w-5 h-5 text-blue-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-xs truncate">
                              {c.appName}
                            </span>
                            {c.storeUrl && (
                              <a
                                href={c.storeUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-blue-600 shrink-0"
                                title="Open store URL"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                              {c.store}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              v{c.version || '1.0.0'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* 2. Target Brand & Official App */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-800 text-xs block truncate">
                          {c.matchedBrand}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <span>Ref:</span>
                          <span className="truncate text-slate-600 font-medium">
                            {c.officialAppName || 'Brand Identity'}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* 3. Package ID & Publisher */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-mono text-[11px] text-slate-700 truncate max-w-[180px]">
                          {c.packageId || (
                            <span className="text-slate-400 italic">No package ID</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-600 truncate max-w-[120px]">
                            {c.publisher}
                          </span>
                          {analysis.publisherMismatch && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0"
                              title="Publisher mismatch is an advisory indicator; not conclusive of fraud."
                            >
                              Mismatch
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* 4. Risk Assessment */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            severity={analysis.severity || 'low'}
                            size="xs"
                            withDot={true}
                          />
                          <span className="text-xs font-mono font-bold text-slate-700">
                            {analysis.riskScore ?? 0}/100
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {analysis.nameSimilarity}% name match
                        </div>
                      </div>
                    </TableCell>

                    {/* 5. Review Status */}
                    <TableCell>
                      <div className="space-y-1">
                        <Badge status={c.review?.status || 'new'} size="xs" />
                        {c.review?.reviewedBy && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[100px]">
                            by {c.review.reviewedBy.split(' ')[0]}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* 6. Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedCandidate(c)}
                          leftIcon={Eye}
                          title="Open detailed comparison & triage view"
                        >
                          Compare
                        </Button>

                        {/* Quick Status Select */}
                        <select
                          value={c.review?.status || 'New'}
                          onChange={(e) => handleQuickStatusChange(c, e.target.value, e)}
                          className="text-[11px] py-1 px-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="New">New</option>
                          <option value="Needs Review">Needs Review</option>
                          <option value="Confirmed Suspicious">Confirmed Suspicious</option>
                          <option value="False Positive">False Positive</option>
                        </select>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteCandidate(c.id, c.appName, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Remove finding"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredCandidates.length === 0 && (
          <div className="p-12 text-center bg-white">
            <Smartphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No candidate apps matched current filters</h4>
            <p className="text-xs text-slate-400 mt-1">
              Try broadening your search query or reset the filter dropdowns.
            </p>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setRiskFilter('all');
                  setStatusFilter('all');
                  setBrandFilter('all');
                  setStoreFilter('all');
                }}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        )}

        <CardFooter className="justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredCandidates.length}</strong> of <strong>{candidates.length}</strong> monitored candidate apps
          </span>
          <span className="text-[11px] text-slate-400">
            Advisory Policy: Publisher mismatch alone is never treated as conclusive fraud.
          </span>
        </CardFooter>
      </Card>

      {/* SUBMISSION MODAL */}
      <AppSubmissionModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        brands={brands}
        onAnalyze={handleAnalyzeCandidate}
        isAnalyzing={isAnalyzing}
      />

      {/* DETAILED COMPARISON & REVIEW MODAL */}
      <AppComparisonModal
        isOpen={Boolean(selectedCandidate)}
        onClose={() => setSelectedCandidate(null)}
        candidate={selectedCandidate}
        onUpdateReview={handleUpdateReview}
        onIssueTakedown={handleIssueTakedown}
      />

      {/* BACKEND API CONTRACT MODAL */}
      <Modal
        isOpen={isApiContractModalOpen}
        onClose={() => setIsApiContractModalOpen(false)}
        title="App Monitoring API Contract & Specification"
        description="Shared REST endpoints agreed for backend implementation by Member 2."
        size="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
            <div><span className="text-emerald-400 font-bold">GET</span>    /api/v1/app-monitoring/candidates</div>
            <div><span className="text-blue-400 font-bold">POST</span>   /api/v1/app-monitoring/analyze</div>
            <div><span className="text-emerald-400 font-bold">GET</span>    /api/v1/app-monitoring/candidates/:id</div>
            <div><span className="text-amber-400 font-bold">PATCH</span>  /api/v1/app-monitoring/candidates/:id/review</div>
            <div><span className="text-rose-400 font-bold">DELETE</span> /api/v1/app-monitoring/candidates/:id</div>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-900 text-xs">Analyze Request Payload Schema (POST):</h5>
            <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-800 font-mono overflow-x-auto">
{`{
  "appName": "Acme Financial Quick Cash",
  "packageId": "com.acmefinancial.quickloan.cash", // optional
  "publisher": "Apex FinTech Media Ltd",
  "store": "APKPure",
  "storeUrl": "https://apkpure.com/...",
  "description": "Instant collateral-free loans...",
  "logoUrl": "data:image/png;base64,...", // optional
  "matchedBrandId": "bp-1",
  "officialAppId": "app-1" // optional
}`}
            </pre>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-900 text-xs">Comparative Analysis Response Schema:</h5>
            <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-800 font-mono overflow-x-auto">
{`{
  "id": "app-cand-201",
  "comparativeAnalysis": {
    "riskScore": 92, // 0 - 100
    "severity": "critical", // "low" | "medium" | "high" | "critical"
    "nameSimilarity": 88, // %
    "logoSimilarity": 89, // % or null
    "publisherMismatch": true,
    "publisherAssessment": "Advisory note...",
    "descriptionSimilarity": 72,
    "packageAnalysis": {
      "candidatePackage": "com.acmefinancial.quickloan.cash",
      "officialPackage": "com.acmefinancial.banking",
      "isSquatted": true
    },
    "sourceEvidence": { ... },
    "detectionReasons": [ ... ]
  },
  "review": {
    "status": "New", // "New" | "Needs Review" | "Confirmed Suspicious" | "False Positive"
    "analystNotes": ""
  }
}`}
            </pre>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
            <strong>Platform Guardrail:</strong> Backend multi-modal model must separate automated detection score from human analyst review status. Different publisher alone must not produce a fraudulent verdict.
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setIsApiContractModalOpen(false)}>
              Got It
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
