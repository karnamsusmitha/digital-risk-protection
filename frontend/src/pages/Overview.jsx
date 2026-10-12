import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Share2,
  Smartphone,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  RotateCcw,
  Check,
  X,
  Inbox
} from 'lucide-react';
import {
  DEMO_SUMMARY_METRICS,
  calculateDemoMetrics,
  calculateSeverityDistribution,
  calculateCategoryDistribution,
  getDemoActivityLog,
  addDemoActivity,
  resetDemoActivityLog
} from '../services/demoOverviewData';
import { brandProfileService } from '../services/brandProfileService';
import { socialMonitoringService } from '../services/socialMonitoringService';
import { appMonitoringService } from '../services/appMonitoringService';
import { findingsService } from '../services/findingsService';
import StatCard from '../components/common/StatCard';
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import LoadingState from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorMessage';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from '../components/common/Table';
import RiskDistributionChart from '../components/overview/RiskDistributionChart';
import {
  AddBrandQuickModal,
  AnalyzeSocialQuickModal,
  AnalyzeAppQuickModal
} from '../components/overview/QuickActionModals';
import { formatRelativeTime } from '../utils/formatters';

export default function Overview() {
  // Demonstration state
  const [metrics, setMetrics] = useState(DEMO_SUMMARY_METRICS);
  const [findings, setFindings] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick Action Modal states
  const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
  const [isAnalyzeSocialOpen, setIsAnalyzeSocialOpen] = useState(false);
  const [isAnalyzeAppOpen, setIsAnalyzeAppOpen] = useState(false);

  // Filter & Search states for Findings Table
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Load consolidated telemetry across shared demo stores
  const loadOverviewData = async () => {
    try {
      setError(null);
      const [brandList, socialRes, appRes, findingsRes] = await Promise.all([
        brandProfileService.getSavedBrands(),
        socialMonitoringService.getCandidates(),
        appMonitoringService.getCandidates(),
        findingsService.getUnifiedFindings()
      ]);

      const brands = Array.isArray(brandList) ? brandList : brandList?.data || [];
      const socialCandidates = socialRes?.data || [];
      const appCandidates = appRes?.data || [];
      const allFindings = findingsRes?.data || [];

      // Calculate dynamic metrics from live shared datasets
      const dynamicMetrics = calculateDemoMetrics({
        brands,
        socialCandidates,
        appCandidates,
        findings: allFindings
      });

      setMetrics(dynamicMetrics);
      setFindings(allFindings);
      setActivity(getDemoActivityLog());
    } catch (err) {
      console.warn('Overview telemetry load error:', err);
      setError(err.message || 'Failed to aggregate overview telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData();

    // Listen to shared mutations from any other tab
    const handleDataUpdate = () => {
      loadOverviewData();
    };
    window.addEventListener('drp_data_updated', handleDataUpdate);
    return () => {
      window.removeEventListener('drp_data_updated', handleDataUpdate);
    };
  }, []);

  // Handler: Add Brand Quick Action
  const handleAddBrand = async (newBrand) => {
    try {
      const domain =
        newBrand.monitoredDomains && newBrand.monitoredDomains[0]
          ? newBrand.monitoredDomains[0]
          : `${newBrand.name.toLowerCase().replace(/\s+/g, '')}.com`;

      await brandProfileService.createProfile({
        name: newBrand.name,
        type: newBrand.type,
        tier: newBrand.tier,
        officialWebsite: `https://${domain}`,
        officialDomain: domain,
        identifiers: {
          trademarkNumber: newBrand.trademarkNumber || 'DEMO-TM-PENDING'
        }
      });

      addDemoActivity({
        title: `Monitored Brand Enrolled: ${newBrand.name}`,
        description: `Surveillance active for ${newBrand.name} (${newBrand.type}) with ${newBrand.monitoredDomains?.length || 1} apex domains.`,
        type: 'brand',
        severity: 'info'
      });

      showToast(`Brand "${newBrand.name}" registered to demonstration surveillance.`);
      await loadOverviewData();
    } catch (err) {
      showToast(`Error registering brand: ${err.message}`);
    }
  };

  // Handler: Analyze Social Profile Quick Action
  const handleAnalyzeSocial = async ({ platform, handle, brand, violation }) => {
    try {
      const brandList = brandProfileService.getSavedBrands();
      const brands = Array.isArray(brandList) ? brandList : brandList?.data || [];
      const matched = brands.find((b) => b.name === brand) || brands[0] || { name: brand, id: 'bp-1' };

      const res = await socialMonitoringService.analyzeCandidate(
        {
          platform,
          profileName: handle.replace('@', ''),
          handle,
          url: handle.startsWith('http')
            ? handle
            : `https://${platform.toLowerCase().replace(/[^a-z]/g, '')}.com/${handle.replace('@', '')}`,
          description: `Suspected ${violation} targeting ${matched.name}.`
        },
        matched
      );

      const score = res.data?.modelEvidence?.riskScore || 92;

      addDemoActivity({
        title: `Social Profile Analyzed: ${handle}`,
        description: `Scored ${score}/100 on ${platform}. Queued for analyst review.`,
        type: 'analysis',
        severity: score >= 85 ? 'critical' : 'high'
      });

      showToast(`Analyzed ${handle} on ${platform} (Score: ${score}/100). Candidate queued for review.`);
      await loadOverviewData();
    } catch (err) {
      showToast(`Error analyzing candidate: ${err.message}`);
    }
  };

  // Handler: Analyze App Quick Action
  const handleAnalyzeApp = async ({ appName, store, packageId, sha256 }) => {
    try {
      const brandList = brandProfileService.getSavedBrands();
      const brands = Array.isArray(brandList) ? brandList : brandList?.data || [];
      const selectedBrand = brands[0] || { name: 'Acme Financial Global', id: 'bp-1' };

      const res = await appMonitoringService.analyzeCandidate(
        {
          appName,
          store,
          packageId,
          sha256,
          publisher: 'Apex Media Group Ltd',
          storeUrl: `https://${store.toLowerCase().replace(/[^a-z]/g, '')}.com/${appName.toLowerCase().replace(/\s+/g, '-')}`,
          description: `Instant loans and cash advance for ${selectedBrand.name} account holders.`
        },
        selectedBrand,
        selectedBrand.mobileApps?.[0] || null
      );

      const score = res.data?.comparativeAnalysis?.riskScore || 91;

      addDemoActivity({
        title: `Mobile APK Inspected: ${appName}`,
        description: `Package ${packageId} scored ${score}/100 for malware overlay traits on ${store}.`,
        type: 'detection',
        severity: 'critical'
      });

      showToast(`Analyzed ${appName} on ${store} (Score: ${score}/100). Added to review candidates.`);
      await loadOverviewData();
    } catch (err) {
      showToast(`Error analyzing mobile package: ${err.message}`);
    }
  };

  // Handler: Update Finding Review Status
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const target = findings.find((f) => f.id === id || f.originalId === id);
      if (target) {
        await findingsService.updateReview(target, {
          status: newStatus,
          analystNotes: `Status changed to ${newStatus} from Overview dashboard.`
        });

        addDemoActivity({
          title: `Candidate Status Updated: ${newStatus}`,
          description: `Analyst changed review decision for "${target.candidateName}" to "${newStatus}".`,
          type: 'review',
          severity: newStatus === 'Approved Takedown' || newStatus === 'Confirmed Suspicious' ? 'critical' : 'info'
        });
      }

      showToast(`Candidate status updated to: ${newStatus}`);
      await loadOverviewData();
    } catch (err) {
      showToast(`Failed to update review status: ${err.message}`);
    }
  };

  // Handler: Reset demonstration data
  const handleResetDemoData = async () => {
    try {
      brandProfileService.resetToDefaults();
      socialMonitoringService.resetToDefaults();
      appMonitoringService.resetToDefaults();
      resetDemoActivityLog();
      setStatusFilter('all');
      setSearchQuery('');
      showToast('Reset demonstration dataset to original benchmark values across all modules.');
      await loadOverviewData();
    } catch (err) {
      showToast(`Reset error: ${err.message}`);
    }
  };

  // Handler: Simulate Empty State (temporary client filter test)
  const handleSimulateEmptyState = () => {
    setFindings([]);
    setMetrics((prev) => ({
      ...prev,
      candidatesRequiringReview: {
        ...prev.candidatesRequiringReview,
        total: 0
      }
    }));
    showToast('Simulated empty review queue.');
  };

  // Filtered findings list
  const filteredFindings = useMemo(() => {
    return findings.filter((item) => {
      const rawStatus = (item.review?.status || item.reviewStatus || 'Requires Review').toLowerCase();
      const normalizedStatus =
        rawStatus === 'new' || rawStatus === 'requires review'
          ? 'requires review'
          : rawStatus === 'needs review' || rawStatus === 'in review'
          ? 'in review'
          : rawStatus === 'confirmed suspicious' || rawStatus === 'approved takedown'
          ? 'approved takedown'
          : rawStatus === 'false positive' || rawStatus === 'dismissed'
          ? 'dismissed'
          : rawStatus;

      const matchesStatus =
        statusFilter === 'all' || normalizedStatus === statusFilter.toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        (item.candidateName && item.candidateName.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q)) ||
        (item.detectionReasons && item.detectionReasons.some((r) => r.toLowerCase().includes(q))) ||
        (item.source && item.source.toLowerCase().includes(q)) ||
        (item.assetType && item.assetType.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [findings, statusFilter, searchQuery]);

  // Compute live severity & category chart data from current findings
  const severityChartData = useMemo(() => {
    return calculateSeverityDistribution(findings);
  }, [findings]);

  const categoryChartData = useMemo(() => {
    return calculateCategoryDistribution(findings);
  }, [findings]);

  if (loading && findings.length === 0) {
    return <LoadingState message="Aggregating enterprise security posture telemetry and active monitoring feeds..." />;
  }

  if (error && findings.length === 0) {
    return <ErrorState message={error} onRetry={loadOverviewData} />;
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

      {/* Demonstration Data Banner (explicit disclaimer) */}
      <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-bold tracking-wider uppercase shrink-0">
            DEMO
          </span>
          <div>
            <span className="font-semibold">Demonstration Mode &bull; Simulated Security Telemetry:</span>{' '}
            <span className="text-blue-800">
              The metrics, threat scores, and review candidates below represent benchmark demonstration data for frontend review until production APIs are connected.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetDemoData}
            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Top Header & Functional Quick Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Digital Risk Protection Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Holistic brand perimeter surveillance, social bot discovery, and candidate threat review console.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddBrandOpen(true)}
            leftIcon={Plus}
          >
            Add Brand
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAnalyzeSocialOpen(true)}
            leftIcon={Share2}
          >
            Analyze Social Profile
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAnalyzeAppOpen(true)}
            leftIcon={Smartphone}
          >
            Analyze App
          </Button>
        </div>
      </div>

      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monitored Brands"
          value={metrics.monitoredBrands.total}
          trend={metrics.monitoredBrands.change}
          trendPositive={true}
          subtitle={metrics.monitoredBrands.detail}
          icon={Shield}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />

        <StatCard
          title="Analyzed Social Profiles"
          value={metrics.analyzedSocialProfiles.total.toLocaleString()}
          trend={metrics.analyzedSocialProfiles.change}
          trendPositive={true}
          subtitle={metrics.analyzedSocialProfiles.detail}
          icon={Share2}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />

        <StatCard
          title="Analyzed Apps"
          value={metrics.analyzedApps.total.toLocaleString()}
          trend={metrics.analyzedApps.change}
          trendPositive={true}
          subtitle={metrics.analyzedApps.detail}
          icon={Smartphone}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />

        <StatCard
          title="Candidates Requiring Review"
          value={metrics.candidatesRequiringReview.total}
          trend={metrics.candidatesRequiringReview.change}
          trendPositive={false}
          subtitle={metrics.candidatesRequiringReview.detail}
          icon={AlertTriangle}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
        />
      </div>

      {/* 2. Middle Row: Risk Distribution Chart using Recharts & Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Risk Distribution Chart */}
        <div className="lg:col-span-2">
          <RiskDistributionChart
            severityData={severityChartData}
            categoryData={categoryChartData}
            className="h-full"
          />
        </div>

        {/* 5. Recent Activity Section */}
        <div>
          <Card className="h-full flex flex-col">
            <CardHeader
              action={
                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Demonstration Log
                </span>
              }
            >
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Chronological audit trail of simulated investigations and detections.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[340px]">
              {activity.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          act.severity === 'critical'
                            ? 'bg-rose-500'
                            : act.severity === 'high'
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      {act.type}
                    </span>
                    <span className="text-slate-400 font-mono">
                      {formatRelativeTime(act.timestamp)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-900 leading-snug">{act.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">{act.description}</p>
                </div>
              ))}
            </CardContent>

            <CardFooter className="justify-between">
              <span className="text-[11px] text-slate-400">
                {activity.length} simulated events logged
              </span>
              <button
                onClick={handleResetDemoData}
                className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
              >
                Reset Audit Trail
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* 3. Recent Findings Table & 5. Empty State */}
      <Card>
        <CardHeader
          action={
            <div className="flex items-center gap-2 flex-wrap">
              {/* Empty state test button */}
              <button
                onClick={handleSimulateEmptyState}
                className="text-[11px] text-slate-500 hover:text-slate-800 border border-slate-200 bg-white px-2.5 py-1 rounded-md transition-colors font-medium shadow-2xs cursor-pointer"
                title="Simulate queue cleared"
              >
                Simulate Empty Queue
              </button>

              <Link
                to="/findings"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 ml-1"
              >
                <span>Full Console &rarr;</span>
              </Link>
            </div>
          }
        >
          <div className="flex items-center gap-2">
            <CardTitle>Recent Findings & Review Queue</CardTitle>
            <Badge variant="blue" size="xs">
              Demonstration
            </Badge>
          </div>
          <CardDescription>
            Candidate domains, social handles, and mobile applications flagged for potential brand infringement.
          </CardDescription>
        </CardHeader>

        {/* Filter Controls for Recent Findings Table */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Filter by candidate, source, reason..."
              startIcon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap mr-1">
              Status:
            </span>
            {['all', 'Requires Review', 'In Review', 'Approved Takedown', 'Dismissed'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status.toLowerCase())}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === status.toLowerCase()
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </div>

        {/* Table / Empty State */}
        {filteredFindings.length > 0 ? (
          <TableContainer className="rounded-none border-x-0 border-b-0 shadow-none">
            <Table>
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead>Candidate Name</TableHead>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead>Detection Reason</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Review Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFindings.map((item) => {
                  const displayStatus = item.review?.status || item.reviewStatus || 'Requires Review';
                  const isPending =
                    displayStatus.toLowerCase() === 'requires review' ||
                    displayStatus.toLowerCase() === 'new';

                  return (
                    <TableRow key={item.id}>
                      {/* Candidate Name */}
                      <TableCell>
                        <div className="font-mono text-xs font-bold text-slate-900 break-all max-w-[200px]">
                          {item.candidateName}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {item.id} &bull; {formatRelativeTime(item.detectedAt)}
                        </span>
                      </TableCell>

                      {/* Asset Type */}
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                          {item.assetType}
                        </span>
                      </TableCell>

                      {/* Risk Score */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                              item.riskScore >= 90
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : item.riskScore >= 75
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.riskScore}/100
                          </span>
                        </div>
                      </TableCell>

                      {/* Reason */}
                      <TableCell>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-xs line-clamp-2">
                          {item.reason || (item.detectionReasons && item.detectionReasons[0]) || 'Anomalous brand pattern detected.'}
                        </p>
                      </TableCell>

                      {/* Source */}
                      <TableCell>
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          {item.source}
                        </span>
                      </TableCell>

                      {/* Review Status */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            displayStatus === 'Requires Review' || displayStatus === 'New'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : displayStatus === 'In Review' || displayStatus === 'Needs Review'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : displayStatus === 'Approved Takedown' || displayStatus === 'Confirmed Suspicious'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {displayStatus}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => handleUpdateStatus(item.id, 'In Review')}
                            >
                              Triage
                            </Button>
                          )}

                          {displayStatus !== 'Approved Takedown' && displayStatus !== 'Confirmed Suspicious' ? (
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleUpdateStatus(item.id, 'Approved Takedown')}
                            >
                              Approve Takedown
                            </Button>
                          ) : (
                            <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              Approved
                            </span>
                          )}

                          {displayStatus !== 'Dismissed' && displayStatus !== 'False Positive' && (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'Dismissed')}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Dismiss finding"
                              aria-label={`Dismiss finding ${item.id}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-900">
              Review Queue Empty
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery || statusFilter !== 'all'
                ? 'No findings match your active search filters.'
                : 'All detected candidate risks have been investigated and triaged.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetDemoData}
            >
              Restore Demonstration Findings
            </Button>
          </div>
        )}

        <CardFooter className="justify-between text-xs text-slate-500">
          <span>
            Demonstration Mode &bull; All evaluations run via local forensic heuristics.
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Total Telemetry Records: {findings.length}
          </span>
        </CardFooter>
      </Card>

      {/* Quick Action Modals */}
      <AddBrandQuickModal
        isOpen={isAddBrandOpen}
        onClose={() => setIsAddBrandOpen(false)}
        onAddBrand={handleAddBrand}
      />

      <AnalyzeSocialQuickModal
        isOpen={isAnalyzeSocialOpen}
        onClose={() => setIsAnalyzeSocialOpen(false)}
        onAnalyzeSocial={handleAnalyzeSocial}
      />

      <AnalyzeAppQuickModal
        isOpen={isAnalyzeAppOpen}
        onClose={() => setIsAnalyzeAppOpen(false)}
        onAnalyzeApp={handleAnalyzeApp}
      />
    </div>
  );
}
