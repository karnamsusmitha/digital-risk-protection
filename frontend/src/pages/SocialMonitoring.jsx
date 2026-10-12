import React, { useState, useEffect } from 'react';
import {
  Share2,
  Search,
  CheckCircle2,
  RefreshCw,
  Plus,
  Eye,
  Code2,
  RotateCcw
} from 'lucide-react';
import { socialMonitoringService } from '../services/socialMonitoringService';
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
import CandidateSubmissionModal from '../components/social/CandidateSubmissionModal';
import CandidateDetailModal from '../components/social/CandidateDetailModal';

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

export default function SocialMonitoring() {
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
      const [backendCheck, brandRes, candidateRes] = await Promise.all([
        brandProfileService.checkBackendConnection(),
        brandProfileService.getProfiles(),
        socialMonitoringService.getCandidates()
      ]);
      setIsBackendOnline(backendCheck);
      setBrands(brandRes.data || []);
      setCandidates(candidateRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch candidate profiles.');
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
  }, []);

  // Handle Candidate Analysis Submission
  const handleAnalyzeCandidate = async (candidatePayload, selectedBrand) => {
    setIsAnalyzing(true);
    try {
      const result = await socialMonitoringService.analyzeCandidate(
        candidatePayload,
        selectedBrand
      );
      setCandidates((prev) => [result.data, ...prev]);
      setIsSubmitModalOpen(false);
      setSelectedCandidate(result.data); // Open details immediately to review
      showToast(
        result.isRemote
          ? `Candidate analyzed via backend API (Score: ${result.data.modelEvidence.riskScore}/100).`
          : `Candidate analyzed via heuristic model (Score: ${result.data.modelEvidence.riskScore}/100 - Local Sandbox).`
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drp_data_updated', { detail: { type: 'social_analyzed' } }));
      }
    } catch (err) {
      alert(`Error analyzing candidate profile: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Review Status Update
  const handleUpdateReview = async (id, reviewData) => {
    try {
      const result = await socialMonitoringService.updateReviewStatus(id, reviewData);
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? result.data : c))
      );
      if (selectedCandidate && selectedCandidate.id === id) {
        setSelectedCandidate(result.data);
      }
      showToast(`Review status updated to: ${reviewData.status}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drp_data_updated', { detail: { type: 'social_reviewed' } }));
      }
    } catch (err) {
      alert(`Error updating review decision: ${err.message}`);
    }
  };

  // Handle Takedown Notice Action
  const handleIssueTakedown = (candidate) => {
    showToast(`Platform abuse complaint queued for: ${candidate.handle}`);
    handleUpdateReview(candidate.id, {
      status: 'Confirmed Suspicious',
      analystNotes: `${candidate.review?.analystNotes || ''}\n[${new Date().toLocaleDateString()}] Abuse takedown notice transmitted to ${candidate.platform} Trust & Safety.`
    });
  };

  // Reset Filters
  const resetFilters = () => {
    setSearch('');
    setRiskFilter('all');
    setStatusFilter('all');
    setBrandFilter('all');
  };

  // Filtered Candidates List
  const filteredCandidates = candidates.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.profileName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.url.toLowerCase().includes(q) ||
      c.matchedBrand.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q));

    const matchesRisk =
      riskFilter === 'all' ||
      c.modelEvidence?.severity?.toLowerCase() === riskFilter.toLowerCase();

    const matchesStatus =
      statusFilter === 'all' ||
      c.review?.status?.toLowerCase() === statusFilter.toLowerCase();

    const matchesBrand =
      brandFilter === 'all' || c.matchedBrandId === brandFilter;

    return matchesSearch && matchesRisk && matchesStatus && matchesBrand;
  });

  if (loading && candidates.length === 0) {
    return <LoadingState message="Loading candidate social profiles and model scoring telemetry..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-slide-up"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Backend API Integration Banner */}
      <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
            <Share2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-100">Social Threat Analysis API:</span>
              {isBackendOnline ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REST API Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Local Heuristic Sandbox (Backend Awaiting Member 2)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              API Contract prepared for <code className="text-blue-300 font-mono">/api/v1/social-monitoring/analyze</code>. Multi-modal scoring combines name distance, logo pHash, bio phrases, and domain analysis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsApiContractModalOpen(true)}
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-slate-800 hover:bg-slate-750 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>API Contract</span>
          </button>
          <button
            onClick={fetchData}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh candidates"
            aria-label="Refresh candidates"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Social Media Impersonation Monitoring
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify copycat handles, phishing bots, and fake customer care channels across major networks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsSubmitModalOpen(true)}
            leftIcon={Plus}
          >
            Submit Candidate for Analysis
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <Input
              placeholder="Search profile name, handle, URL..."
              startIcon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Risk Level Filter */}
            <Select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              options={RISK_LEVEL_OPTIONS}
            />

            {/* Analysis Review Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={REVIEW_STATUS_FILTERS}
            />

            {/* Brand Filter */}
            <Select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Registered Brands' },
                ...brands.map((b) => ({ value: b.id, label: b.name }))
              ]}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
            <span className="text-slate-500">
              Showing <strong className="text-slate-800">{filteredCandidates.length}</strong> candidate profiles
            </span>
            {(search || riskFilter !== 'all' || statusFilter !== 'all' || brandFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Searchable, Filterable Candidates Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>Candidate Profile & Handle</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Matched Brand</TableHead>
                <TableHead>Model Risk Score</TableHead>
                <TableHead>Automated Signals</TableHead>
                <TableHead>Analyst Review Decision</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCandidates.map((cand) => {
                const { modelEvidence, review } = cand;

                return (
                  <TableRow
                    key={cand.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                        setSelectedCandidate(cand);
                      }
                    }}
                  >
                    {/* Candidate Name & Handle */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {cand.logoUrl ? (
                            <img
                              src={cand.logoUrl}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Share2 className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {cand.profileName}
                          </h4>
                          <span className="font-mono text-[11px] text-blue-600 truncate block">
                            {cand.handle}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Platform */}
                    <TableCell>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] font-semibold text-slate-700">
                        {cand.platform}
                      </span>
                    </TableCell>

                    {/* Matched Brand */}
                    <TableCell>
                      <span className="font-medium text-xs text-slate-800">
                        {cand.matchedBrand}
                      </span>
                    </TableCell>

                    {/* Model Risk Score */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            modelEvidence?.severity === 'critical'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : modelEvidence?.severity === 'high'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {modelEvidence?.riskScore || 0}/100
                        </span>
                        <Badge severity={modelEvidence?.severity || 'info'} size="xs" withDot={true} />
                      </div>
                    </TableCell>

                    {/* Automated Model Signals Preview */}
                    <TableCell>
                      <div className="space-y-0.5 text-[11px] text-slate-600">
                        <div>
                          Name Match: <strong>{modelEvidence?.nameSimilarity}%</strong>
                        </div>
                        {modelEvidence?.logoSimilarity !== null && (
                          <div className="text-rose-600 font-medium">
                            Logo pHash: {modelEvidence?.logoSimilarity}%
                          </div>
                        )}
                        {modelEvidence?.domainEvidence && (
                          <div className="text-amber-700 font-medium truncate max-w-[160px]">
                            Phishing link detected
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Analyst Review Decision (Explicit Separation) */}
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          review?.status === 'Confirmed Suspicious'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : review?.status === 'Needs Review'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : review?.status === 'False Positive'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {review?.status || 'New'}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => setSelectedCandidate(cand)}
                          leftIcon={Eye}
                        >
                          Triage & Review
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredCandidates.length === 0 && (
          <div className="p-12 text-center">
            <Share2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-700">No candidate profiles found</h4>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your risk, status, or search filters, or submit a new candidate profile.
            </p>
          </div>
        )}

        <CardFooter className="justify-between text-xs text-slate-500">
          <span>
            Total candidate inventory: <strong>{candidates.length}</strong> profiles
          </span>
          <span className="text-[11px] text-slate-400">
            Model scores provide heuristic indicators &bull; Analyst decision controls enforcement
          </span>
        </CardFooter>
      </Card>

      {/* Candidate Submission Modal */}
      <CandidateSubmissionModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        brands={brands}
        onAnalyze={handleAnalyzeCandidate}
        isAnalyzing={isAnalyzing}
      />

      {/* Candidate Detailed View & Review Workflow Modal */}
      <CandidateDetailModal
        isOpen={!!selectedCandidate}
        onClose={() => setSelectedCandidate(null)}
        candidate={selectedCandidate}
        onUpdateReview={handleUpdateReview}
        onIssueTakedown={handleIssueTakedown}
      />

      {/* Backend API Contract Coordination Modal */}
      <Modal
        isOpen={isApiContractModalOpen}
        onClose={() => setIsApiContractModalOpen(false)}
        title="Social Monitoring REST API Contract Specification"
        description="Agreed endpoints and multi-modal analysis payload schema for Member 2."
        maxWidth="max-w-2xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsApiContractModalOpen(false)}>
            Close Specification
          </Button>
        }
      >
        <div className="space-y-4 text-xs font-sans text-slate-700">
          <p className="text-slate-600 leading-relaxed">
            The frontend service is prepared to invoke these REST endpoints once implemented on the backend. When the backend is unavailable, the frontend operates in a client-side sandbox with identical data schemas.
          </p>

          <div className="space-y-2 font-mono text-[11px]">
            <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-blue-600 mr-2">POST</span>
                <span className="text-slate-800">/api/v1/social-monitoring/analyze</span>
              </div>
              <span className="text-slate-400">Run model heuristics on candidate profile</span>
            </div>
            <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-emerald-600 mr-2">GET</span>
                <span className="text-slate-800">/api/v1/social-monitoring/candidates</span>
              </div>
              <span className="text-slate-400">List all analyzed profiles</span>
            </div>
            <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-amber-600 mr-2">PATCH</span>
                <span className="text-slate-800">/api/v1/social-monitoring/candidates/:id/review</span>
              </div>
              <span className="text-slate-400">Record analyst review decision</span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Sample Model Response Structure
            </h4>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto leading-relaxed">
{`{
  "id": "soc-cand-101",
  "profileName": "AcmePay Official 24/7 Resolution",
  "handle": "@AcmePay_Support_Desk",
  "platform": "Telegram",
  "url": "https://t.me/AcmePay_Support_Desk",
  "matchedBrand": "AcmePay Mobile",
  "modelEvidence": {
    "riskScore": 96,
    "severity": "critical",
    "nameSimilarity": 94,
    "logoSimilarity": 91,
    "domainEvidence": {
      "detectedUrl": "https://acmepay-help.support/verify",
      "domainRisk": "Critical - Homoglyph phishing host"
    },
    "detectionReasons": ["Stolen logo", "Solicits recovery keys", "Unverified badge"]
  },
  "review": {
    "status": "New | Needs Review | Confirmed Suspicious | False Positive",
    "analystNotes": "string",
    "reviewedBy": "string (analyst)",
    "reviewedAt": "ISO datetime"
  }
}`}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
