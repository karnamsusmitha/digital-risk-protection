import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Download,
  Eye,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Share2,
  Smartphone,
  Globe,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
  ExternalLink,
  Code2
} from 'lucide-react';
import { findingsService } from '../services/findingsService';
import { brandProfileService } from '../services/brandProfileService';
import Card, { CardContent, CardFooter } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import LoadingState from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorMessage';
import FindingEvidencePanel from '../components/findings/FindingEvidencePanel';
import Modal from '../components/common/Modal';
import { formatDate } from '../utils/formatters';

const ASSET_TYPE_OPTIONS = [
  { value: 'all', label: 'All Asset Types' },
  { value: 'Social Profile', label: 'Social Profile' },
  { value: 'Mobile App', label: 'Mobile App / APK' },
  { value: 'Domain Typosquat', label: 'Domain Typosquat' }
];

const RISK_LEVEL_OPTIONS = [
  { value: 'all', label: 'All Risk Levels' },
  { value: 'critical', label: 'Critical (85-100)' },
  { value: 'high', label: 'High (70-84)' },
  { value: 'medium', label: 'Medium (50-69)' },
  { value: 'low', label: 'Low (0-49)' }
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'all', label: 'All Review Statuses' },
  { value: 'New', label: 'New' },
  { value: 'Needs Review', label: 'Needs Review' },
  { value: 'Confirmed Suspicious', label: 'Confirmed Suspicious' },
  { value: 'False Positive', label: 'False Positive' }
];

export default function Findings() {
  const [findings, setFindings] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const [riskLevelFilter, setRiskLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sorting: 'risk-desc' | 'risk-asc' | 'date-desc' | 'date-asc'
  const [sortBy, setSortBy] = useState('risk-desc');

  // Selected Finding for Evidence Panel
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Fetch Unified Findings
  const fetchFindings = async () => {
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

      const res = await findingsService.getUnifiedFindings();
      setFindings(res.data);
      setIsBackendOnline(res.isRemote);
    } catch (err) {
      setError(err.message || 'Failed to aggregate unified security findings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
    const handleUpdate = () => {
      fetchFindings();
    };
    window.addEventListener('drp_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('drp_data_updated', handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically extract unique sources from current findings
  const uniqueSources = useMemo(() => {
    const set = new Set();
    findings.forEach((f) => {
      if (f.source) set.add(f.source);
    });
    return Array.from(set);
  }, [findings]);

  // Filtered Findings
  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      // 1. Brand filter
      if (brandFilter !== 'all' && f.matchedBrandId !== brandFilter && f.matchedBrand !== brandFilter) {
        return false;
      }
      // 2. Asset Type filter
      if (assetTypeFilter !== 'all' && f.assetType !== assetTypeFilter) {
        return false;
      }
      // 3. Risk Level filter
      if (riskLevelFilter !== 'all' && f.severity?.toLowerCase() !== riskLevelFilter.toLowerCase()) {
        return false;
      }
      // 4. Source filter
      if (sourceFilter !== 'all' && f.source !== sourceFilter) {
        return false;
      }
      // 5. Review Status filter
      if (statusFilter !== 'all' && f.review?.status?.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      // 6. Free-text Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = f.candidateName.toLowerCase().includes(q);
        const matchesId = f.identifier.toLowerCase().includes(q);
        const matchesPlatform = f.platform.toLowerCase().includes(q);
        const matchesBrand = f.matchedBrand.toLowerCase().includes(q);
        const matchesReasons = f.detectionReasons.some((r) => r.toLowerCase().includes(q));
        if (!matchesName && !matchesId && !matchesPlatform && !matchesBrand && !matchesReasons) {
          return false;
        }
      }
      return true;
    });
  }, [findings, brandFilter, assetTypeFilter, riskLevelFilter, sourceFilter, statusFilter, search]);

  // Sorted Findings
  const sortedFindings = useMemo(() => {
    const list = [...filteredFindings];
    list.sort((a, b) => {
      if (sortBy === 'risk-desc') {
        return b.riskScore - a.riskScore;
      }
      if (sortBy === 'risk-asc') {
        return a.riskScore - b.riskScore;
      }
      if (sortBy === 'date-desc') {
        return new Date(b.detectedAt) - new Date(a.detectedAt);
      }
      if (sortBy === 'date-asc') {
        return new Date(a.detectedAt) - new Date(b.detectedAt);
      }
      return 0;
    });
    return list;
  }, [filteredFindings, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedFindings.length / pageSize) || 1;
  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFindings.slice(start, start + pageSize);
  }, [sortedFindings, currentPage, pageSize]);

  // Handle Review Status Update
  const handleUpdateReview = async (finding, reviewData) => {
    try {
      const updated = await findingsService.updateReview(finding, reviewData);
      setFindings((prev) => prev.map((f) => (f.id === finding.id ? updated : f)));
      if (selectedFinding?.id === finding.id) {
        setSelectedFinding(updated);
      }
      showToast(`Review decision saved: "${reviewData.status}".`);
    } catch (err) {
      showToast(`Failed to update review: ${err.message}`);
    }
  };

  // Quick Action: Mark as Reviewed or False Positive
  const handleQuickStatusChange = async (finding, newStatus, e) => {
    if (e) e.stopPropagation();
    await handleUpdateReview(finding, {
      status: newStatus,
      analystNotes: finding.review?.analystNotes || '',
      reviewedBy: 'Lead SecOps Analyst (You)'
    });
  };

  // Handle Enforcement Takedown
  const handleTriggerTakedown = async (finding) => {
    await handleUpdateReview(finding, {
      status: 'Confirmed Suspicious',
      analystNotes: `${finding.review?.analystNotes || ''}\n[Enforcement]: Takedown notice queued on ${new Date().toLocaleDateString()}.`,
      reviewedBy: 'Lead SecOps Analyst (You)'
    });
    showToast(`Enforcement notice dispatched for "${finding.candidateName}".`);
  };

  // CSV Export for Visible Findings
  const handleExportCsv = () => {
    if (sortedFindings.length === 0) {
      showToast('No findings match current filters to export.');
      return;
    }
    const csvContent = findingsService.generateCsvData(sortedFindings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `drp-unified-findings-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${sortedFindings.length} findings to CSV.`);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch('');
    setBrandFilter('all');
    setAssetTypeFilter('all');
    setRiskLevelFilter('all');
    setSourceFilter('all');
    setStatusFilter('all');
    setSortBy('risk-desc');
    setCurrentPage(1);
  };

  // Toggle Header Sort
  const toggleRiskSort = () => {
    setSortBy((prev) => (prev === 'risk-desc' ? 'risk-asc' : 'risk-desc'));
  };

  const toggleDateSort = () => {
    setSortBy((prev) => (prev === 'date-desc' ? 'date-asc' : 'date-desc'));
  };

  if (loading && findings.length === 0) {
    return <LoadingState message="Correlating cross-perimeter intelligence across social channels and mobile store repos..." />;
  }

  if (error && findings.length === 0) {
    return <ErrorState message={error} onRetry={fetchFindings} />;
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
              Unified Threat Findings & Evidence Triage
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
              {isBackendOnline ? 'Live Backend Feed' : 'Local Heuristic Sandbox'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized investigation queue correlating social impersonation profiles and counterfeit mobile app binaries across protected corporate brands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsApiModalOpen(true)}
            leftIcon={Code2}
            className="text-xs text-slate-600"
          >
            API Schema
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchFindings}
            leftIcon={RefreshCw}
            className="text-xs text-slate-600"
          >
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={Download}
          >
            Export CSV ({sortedFindings.length})
          </Button>
        </div>
      </div>

      {/* COMPREHENSIVE FILTER & SORT CONTROLS */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Search & Core Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Search Input */}
            <div className="sm:col-span-2">
              <Input
                placeholder="Search candidate name, handle, package, or reasons..."
                startIcon={Search}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Brand Filter */}
            <div>
              <Select
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Asset Type Filter */}
            <div>
              <Select
                value={assetTypeFilter}
                onChange={(e) => {
                  setAssetTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {ASSET_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Risk Level Filter */}
            <div>
              <Select
                value={riskLevelFilter}
                onChange={(e) => {
                  setRiskLevelFilter(e.target.value);
                  setCurrentPage(1);
                }}
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
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {REVIEW_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Row 2: Secondary Filters & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Source Filter */}
              <div className="w-56">
                <Select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">All Ingestion Sources ({uniqueSources.length})</option>
                  {uniqueSources.map((src) => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Sort By Dropdown */}
              <div className="w-48">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="risk-desc">Sort: Risk Score (High → Low)</option>
                  <option value="risk-asc">Sort: Risk Score (Low → High)</option>
                  <option value="date-desc">Sort: Date (Newest First)</option>
                  <option value="date-asc">Sort: Date (Oldest First)</option>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-slate-500">
              <span>
                Showing <strong>{sortedFindings.length}</strong> of <strong>{findings.length}</strong> correlated findings
              </span>
              {(search ||
                brandFilter !== 'all' ||
                assetTypeFilter !== 'all' ||
                riskLevelFilter !== 'all' ||
                sourceFilter !== 'all' ||
                statusFilter !== 'all' ||
                sortBy !== 'risk-desc') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset filters</span>
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UNIFIED FINDINGS TABLE */}
      <Card className="overflow-hidden">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[5%]">Asset</TableHead>
                <TableHead className="w-[28%]">Candidate Identity & Source URL</TableHead>
                <TableHead className="w-[20%]">Target Brand & Benchmark</TableHead>
                <TableHead className="w-[14%]">
                  <button
                    type="button"
                    onClick={toggleRiskSort}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors font-bold uppercase tracking-wider text-[11px]"
                    title="Click to toggle risk score sorting"
                  >
                    <span>Risk Score</span>
                    {sortBy === 'risk-desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : sortBy === 'risk-asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[13%]">Review Status</TableHead>
                <TableHead className="w-[10%]">
                  <button
                    type="button"
                    onClick={toggleDateSort}
                    className="flex items-center gap-1 hover:text-slate-900 transition-colors font-bold uppercase tracking-wider text-[11px]"
                    title="Click to toggle date sorting"
                  >
                    <span>Detected</span>
                    {sortBy === 'date-desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : sortBy === 'date-asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[10%] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedFindings.map((finding) => {
                const isSocial = finding.assetType === 'Social Profile';
                const isSourceAvailable = finding.sourceStatus === 'available' && Boolean(finding.sourceUrl);

                return (
                  <TableRow
                    key={finding.id}
                    onClick={() => setSelectedFinding(finding)}
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                  >
                    {/* 1. Asset Type Icon */}
                    <TableCell>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs border">
                        {isSocial ? (
                          <div className="bg-blue-50 text-blue-600 border-blue-200">
                            <Share2 className="w-4 h-4 m-1.5" />
                          </div>
                        ) : finding.assetType === 'Mobile App' ? (
                          <div className="bg-indigo-50 text-indigo-600 border-indigo-200">
                            <Smartphone className="w-4 h-4 m-1.5" />
                          </div>
                        ) : (
                          <div className="bg-sky-50 text-sky-600 border-sky-200">
                            <Globe className="w-4 h-4 m-1.5" />
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* 2. Candidate Identity & Source URL */}
                    <TableCell>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900 text-xs truncate max-w-[220px]">
                            {finding.candidateName}
                          </span>
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 shrink-0">
                            {finding.platform}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="font-mono text-slate-500 truncate max-w-[160px]">
                            {finding.identifier}
                          </span>

                          {/* Source URL status */}
                          {isSourceAvailable ? (
                            <a
                              href={finding.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-slate-400 hover:text-blue-600 shrink-0 flex items-center gap-0.5"
                              title="Open source URL in new tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span
                              className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 shrink-0"
                              title="Source URL is unavailable or offline"
                            >
                              Source Offline
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* 3. Target Brand & Benchmark */}
                    <TableCell>
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-800 text-xs block truncate">
                          {finding.matchedBrand}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          Ref: {finding.matchedOfficialAsset}
                        </span>
                      </div>
                    </TableCell>

                    {/* 4. Risk Assessment */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge severity={finding.severity} size="xs" withDot={true} />
                          <span className="text-xs font-mono font-bold text-slate-800">
                            {finding.riskScore}/100
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {finding.source}
                        </div>
                      </div>
                    </TableCell>

                    {/* 5. Review Status */}
                    <TableCell>
                      <div className="space-y-1">
                        <Badge status={finding.review?.status || 'new'} size="xs" />
                        {finding.review?.reviewedBy && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">
                            by {finding.review.reviewedBy.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* 6. Detection Date */}
                    <TableCell>
                      <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap block">
                        {formatDate(finding.detectedAt)}
                      </span>
                    </TableCell>

                    {/* 7. Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSelectedFinding(finding)}
                          leftIcon={Eye}
                          title="Open Evidence Panel"
                        >
                          Evidence
                        </Button>

                        {/* Inline status decision */}
                        <select
                          value={finding.review?.status || 'New'}
                          onChange={(e) => handleQuickStatusChange(finding, e.target.value, e)}
                          className="text-[11px] py-1 px-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="New">New</option>
                          <option value="Needs Review">Needs Review</option>
                          <option value="Confirmed Suspicious">Confirmed</option>
                          <option value="False Positive">False Pos</option>
                        </select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Empty State */}
        {sortedFindings.length === 0 && (
          <div className="p-12 text-center bg-white">
            <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">No correlated findings matched filters</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your search query, changing the risk level or asset type, or clear active filters.
            </p>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Reset All Filters
              </Button>
            </div>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={sortedFindings.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
        />

        <CardFooter className="justify-between text-xs text-slate-500">
          <span>
            Compliance Policy: Evidence is strictly grounded in verifiable signals. Unavailable checks are never labeled as passed.
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Total Telemetry Records: {findings.length}
          </span>
        </CardFooter>
      </Card>

      {/* DETAILED EVIDENCE SLIDE-OVER DRAWER */}
      <FindingEvidencePanel
        isOpen={Boolean(selectedFinding)}
        onClose={() => setSelectedFinding(null)}
        finding={selectedFinding}
        onUpdateReview={handleUpdateReview}
        onTriggerTakedown={handleTriggerTakedown}
      />

      {/* API SCHEMA CONTRACT MODAL */}
      <Modal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        title="Unified Findings API Contract & Specifications"
        description="Agreed REST endpoints for correlated findings feed and review state synchronization."
        size="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
            <div><span className="text-emerald-400 font-bold">GET</span>   /api/v1/findings          <span className="text-slate-400">// List unified findings</span></div>
            <div><span className="text-amber-400 font-bold">PATCH</span> /api/v1/findings/:id/review <span className="text-slate-400">// Triage status & notes</span></div>
            <div><span className="text-blue-400 font-bold">POST</span>  /api/v1/findings/takedown  <span className="text-slate-400">// Trigger DMCA notice</span></div>
            <div><span className="text-emerald-400 font-bold">GET</span>   /api/v1/findings/export   <span className="text-slate-400">// CSV export endpoint</span></div>
          </div>

          <div className="space-y-2">
            <h5 className="font-bold text-slate-900 text-xs">Finding Data Object Schema:</h5>
            <pre className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-800 font-mono overflow-x-auto">
{`{
  "id": "find-soc-101",
  "assetType": "Social Profile" | "Mobile App",
  "candidateName": "AcmePay Official Support",
  "identifier": "@AcmePay_Support_Desk",
  "platform": "Telegram",
  "sourceUrl": "https://t.me/...",
  "sourceStatus": "available" | "unavailable",
  "matchedBrand": "AcmePay Mobile",
  "riskScore": 96,
  "severity": "critical",
  "signals": {
    "nameSimilarity": 94,
    "logoSimilarity": 91,
    "logoCheckStatus": "performed" | "unavailable"
  },
  "domainEvidence": { ... },
  "publisherEvidence": { ... },
  "review": {
    "status": "Needs Review",
    "analystNotes": "...",
    "reviewedBy": "Sarah Chen",
    "reviewedAt": "2026-10-12T15:00:00Z"
  }
}`}
            </pre>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
            <strong>Evidence Integrity Guardrail:</strong> Checks that could not be evaluated (e.g. missing candidate logo or unavailable domain) must be reported as <code>unavailable</code>, and must never be fabricated.
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="sm" onClick={() => setIsApiModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
