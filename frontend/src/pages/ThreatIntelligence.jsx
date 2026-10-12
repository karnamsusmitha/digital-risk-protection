import React, { useState, useEffect, useMemo, useId } from 'react';
import {
  ExternalLink,
  Shield,
  CheckCircle2,
  RefreshCw,
  Search,
  Copy,
  Check,
  Info,
  Clock,
  Layers,
  Activity,
  Plus,
  Globe,
  Server,
  Link2,
  Hash,
  Share2,
  Download
} from 'lucide-react';
import { threatIntelService, CONNECTED_SOURCES } from '../services/threatIntelService';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { TableContainer, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/common/Table';
import Modal from '../components/common/Modal';
import LoadingState from '../components/common/LoadingState';
import ErrorMessage from '../components/common/ErrorMessage';
import { formatDate, formatRelativeTime } from '../utils/formatters';

const INDICATOR_TYPE_OPTIONS = [
  { value: 'all', label: 'All Indicator Types' },
  { value: 'Domain', label: 'Domain / FQDN' },
  { value: 'IP Address', label: 'IP Address (C2/Host)' },
  { value: 'URL', label: 'URL (Phishing Kit)' },
  { value: 'File Hash', label: 'File Hash (SHA-256)' },
  { value: 'Social Handle', label: 'Social Handle' }
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical (85-100)' },
  { value: 'high', label: 'High (70-84)' },
  { value: 'medium', label: 'Medium (50-69)' },
  { value: 'low', label: 'Low (0-49)' }
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Triage Statuses' },
  { value: 'Active Threat', label: 'Active Threat' },
  { value: 'Investigating', label: 'Investigating' },
  { value: 'Blocked at Perimeter', label: 'Blocked at Perimeter' },
  { value: 'Takedown In Progress', label: 'Takedown In Progress' },
  { value: 'Mitigated', label: 'Mitigated' }
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Threat Sources' },
  { value: 'Certificate Transparency Stream', label: 'Certificate Transparency' },
  { value: 'AbuseIPDB Threat Exchange', label: 'AbuseIPDB Threat Exchange' },
  { value: 'PhishTank Community Feed', label: 'PhishTank Community Feed' },
  { value: 'MalwareBazaar APK Telemetry', label: 'MalwareBazaar APK Telemetry' },
  { value: 'VirusTotal Threat Graph', label: 'VirusTotal Threat Graph' },
  { value: 'AlienVault OTX Community', label: 'AlienVault OTX Community' }
];

export default function ThreatIntelligence() {
  const searchInputId = useId();
  const typeSelectId = useId();
  const severitySelectId = useId();
  const statusSelectId = useId();
  const sourceSelectId = useId();

  // State
  const [status, setStatus] = useState(() => threatIntelService.getFeedStatusSync());
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Syncing Feeds
  const [isSyncing, setIsSyncing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');

  // Inspection Modal
  const [selectedIoc, setSelectedIoc] = useState(null);
  const [copiedValue, setCopiedValue] = useState(false);

  // Add Indicator Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newIocForm, setNewIocForm] = useState({
    indicatorType: 'Domain',
    indicatorValue: '',
    threatType: 'Phishing Infrastructure',
    matchedBrand: 'Acme Financial Global',
    severity: 'high',
    riskScore: 85,
    description: ''
  });

  // Load Data
  const loadData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setError(null);
    try {
      const [fetchedStatus, fetchedRecords] = await Promise.all([
        threatIntelService.getFeedStatus(),
        threatIntelService.getThreatRecords()
      ]);
      setStatus(fetchedStatus);
      setRecords(fetchedRecords);
    } catch (err) {
      console.error('[ThreatIntelligence] Data load failed:', err);
      setError(err.message || 'Failed to load threat intelligence telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleStatusUpdate = (e) => {
      if (e.detail) setStatus(e.detail);
    };
    window.addEventListener('drp_threat_intel_status_change', handleStatusUpdate);
    return () => {
      window.removeEventListener('drp_threat_intel_status_change', handleStatusUpdate);
    };
  }, []);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    let list = records;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.indicatorValue && r.indicatorValue.toLowerCase().includes(q)) ||
          (r.threatType && r.threatType.toLowerCase().includes(q)) ||
          (r.source && r.source.toLowerCase().includes(q)) ||
          (r.matchedBrand && r.matchedBrand.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.resolvedIp && r.resolvedIp.toLowerCase().includes(q))
      );
    }
    if (selectedType !== 'all') {
      list = list.filter((r) => r.indicatorType === selectedType);
    }
    if (selectedSeverity !== 'all') {
      list = list.filter((r) => r.severity === selectedSeverity);
    }
    if (selectedStatus !== 'all') {
      list = list.filter((r) => r.status === selectedStatus);
    }
    if (selectedSource !== 'all') {
      list = list.filter((r) => r.source === selectedSource);
    }
    return list;
  }, [records, searchQuery, selectedType, selectedSeverity, selectedStatus, selectedSource]);

  // Sync Feeds Action
  const handleSyncFeeds = async () => {
    setIsSyncing(true);
    setActionSuccess(null);
    try {
      const res = await threatIntelService.syncFeeds();
      const freshStatus = await threatIntelService.getFeedStatus();
      setStatus(freshStatus);
      setActionSuccess(res.message);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setError(err.message || 'Failed to sync threat feeds.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Triage Status Update
  const handleUpdateStatus = async (iocId, newStatus) => {
    try {
      const updated = await threatIntelService.updateIndicatorStatus(iocId, newStatus);
      setRecords((prev) => prev.map((item) => (item.id === iocId ? updated : item)));
      if (selectedIoc && selectedIoc.id === iocId) {
        setSelectedIoc(updated);
      }
      setActionSuccess(`Indicator ${updated.indicatorValue} updated to status "${newStatus}".`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to update indicator triage status.');
    }
  };

  // Submit New Indicator
  const handleAddIndicatorSubmit = async (e) => {
    e.preventDefault();
    if (!newIocForm.indicatorValue.trim()) return;

    try {
      const created = await threatIntelService.addIndicator(newIocForm);
      setRecords((prev) => [created, ...prev]);
      setIsAddModalOpen(false);
      setNewIocForm({
        indicatorType: 'Domain',
        indicatorValue: '',
        threatType: 'Phishing Infrastructure',
        matchedBrand: 'Acme Financial Global',
        severity: 'high',
        riskScore: 85,
        description: ''
      });
      setActionSuccess(`Threat indicator ${created.indicatorValue} added to local sandbox feed.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to add indicator.');
    }
  };

  // Reset to Benchmark Data
  const handleResetRecords = () => {
    const restored = threatIntelService.resetDefaultRecords();
    setRecords(restored);
    setSearchQuery('');
    setSelectedType('all');
    setSelectedSeverity('all');
    setSelectedStatus('all');
    setSelectedSource('all');
    setActionSuccess('Threat intelligence records reset to benchmark telemetry.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Copy Indicator Value
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedValue(true);
    setTimeout(() => setCopiedValue(false), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Indicator Type', 'Indicator Value', 'Source', 'Threat Type', 'Matched Brand', 'Risk Score', 'Severity', 'Status', 'First Seen', 'Description'];
    const rows = filteredRecords.map((r) => [
      r.id,
      r.indicatorType,
      r.indicatorValue,
      r.source,
      r.threatType,
      r.matchedBrand,
      r.riskScore,
      r.severity,
      r.status,
      r.firstSeen,
      `"${(r.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `threat_intelligence_feed_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIndicatorIcon = (type) => {
    switch (type) {
      case 'Domain':
        return Globe;
      case 'IP Address':
        return Server;
      case 'URL':
        return Link2;
      case 'File Hash':
        return Hash;
      case 'Social Handle':
        return Share2;
      default:
        return ExternalLink;
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Header Banner & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Threat Intelligence Feed
                </h2>
                {status.isLive ? (
                  <Badge variant="emerald" withDot pulse>
                    Live Feeds Connected
                  </Badge>
                ) : (
                  <Badge variant="amber" withDot>
                    Demo Sandbox Mode
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-perimeter intelligence feeds, continuous IoC telemetry, phishing cluster tracking & automated perimeter blocking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="text-xs gap-1.5 text-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs gap-1.5 text-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Indicator</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSyncFeeds}
            disabled={isSyncing}
            className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Synchronizing Feeds...' : 'Sync Feeds Now'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Demo Sandbox Honesty Banner */}
      {status.isDemo && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/90 text-amber-900 flex items-start gap-3 text-xs leading-relaxed shadow-2xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-amber-950 mb-0.5">
              Demo Sandbox Mode Active: Simulated Threat Intelligence Telemetry
            </span>
            <p className="text-amber-800">
              The external threat intelligence streams displayed below (Certificate Transparency, AbuseIPDB, PhishTank, MalwareBazaar, VirusTotal, and AlienVault OTX) are operating in local sandbox simulation. Live network telemetry requires running the FastAPI backend gateway with configured upstream STIX/TAXII or commercial threat exchange connectors.
            </p>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-amber-200/60 text-amber-900 font-mono text-[10px] border border-amber-300">
            ISOLATED FEED
          </span>
        </div>
      )}

      {/* Action Success Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <ErrorMessage
          title="Threat Intelligence Error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 3. Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Indicators"
          value={`${records.length} Monitored IoCs`}
          subtitle="Cross-perimeter indicators tracked in feed"
          icon={Activity}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Critical Threats"
          value={`${records.filter((r) => r.severity === 'critical').length} Active Critical`}
          subtitle="Severity score >= 85 requiring fast triage"
          icon={Shield}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
        />

        <StatCard
          title="Intelligence Feeds"
          value={`${CONNECTED_SOURCES.length} Feeds Synced`}
          subtitle="CT Stream, AbuseIPDB, PhishTank, MalwareBazaar, VT, OTX"
          icon={Layers}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />

        <StatCard
          title="Last Feed Poll"
          value={formatRelativeTime(status.lastSyncTime) || 'Just now'}
          subtitle={status.lastSyncTime ? formatDate(status.lastSyncTime) : 'Pending sync'}
          icon={Clock}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      {/* 4. Connected Threat Intelligence Sources Grid */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm">Configured Threat Intelligence Streams</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Ingestion streams continuously monitored for brand impersonation, rogue infrastructure, and mobile phishing.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            {CONNECTED_SOURCES.map((source) => (
              <div
                key={source.name}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 truncate">{source.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    {source.status}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">{source.type}</p>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Frequency: {source.frequency}</span>
                  <span className="font-mono text-slate-800">{source.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 5. Indicators Table & Filters */}
      <Card className="border-slate-200">
        <CardHeader
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={handleResetRecords}
              className="text-xs gap-1 text-slate-600"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Benchmark Data</span>
            </Button>
          }
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm">Threat Intelligence Telemetry Feed</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Real-time IoC indicators categorized by asset type, risk level, and source feed.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Search Bar */}
            <div className="sm:col-span-4">
              <label htmlFor={searchInputId} className="sr-only">
                Search indicators
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id={searchInputId}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search indicator, threat, brand or IP..."
                  className="pl-8 text-xs w-full"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="sm:col-span-2">
              <label htmlFor={typeSelectId} className="sr-only">
                Filter by indicator type
              </label>
              <Select
                id={typeSelectId}
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                options={INDICATOR_TYPE_OPTIONS}
                className="text-xs w-full"
              />
            </div>

            {/* Severity Filter */}
            <div className="sm:col-span-2">
              <label htmlFor={severitySelectId} className="sr-only">
                Filter by risk severity
              </label>
              <Select
                id={severitySelectId}
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                options={SEVERITY_OPTIONS}
                className="text-xs w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-2">
              <label htmlFor={statusSelectId} className="sr-only">
                Filter by triage status
              </label>
              <Select
                id={statusSelectId}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={STATUS_OPTIONS}
                className="text-xs w-full"
              />
            </div>

            {/* Source Filter */}
            <div className="sm:col-span-2">
              <label htmlFor={sourceSelectId} className="sr-only">
                Filter by threat source
              </label>
              <Select
                id={sourceSelectId}
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                options={SOURCE_OPTIONS}
                className="text-xs w-full"
              />
            </div>
          </div>

          {/* Table Container */}
          {loading ? (
            <LoadingState message="Loading threat intelligence feed records..." />
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
              <Activity className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-slate-800">No threat indicators match your filter</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Try adjusting your search keywords or resetting filters to view benchmark records.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetRecords}
                className="text-xs mx-auto"
              >
                Reset Filters & Data
              </Button>
            </div>
          ) : (
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicator Value</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Threat Classification</TableHead>
                    <TableHead>Target Brand</TableHead>
                    <TableHead>Source Feed</TableHead>
                    <TableHead>Risk Severity</TableHead>
                    <TableHead>Telemetry Mode</TableHead>
                    <TableHead>Triage Status</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((item) => {
                    const TypeIcon = getIndicatorIcon(item.indicatorType);
                    return (
                      <TableRow key={item.id} hover>
                        {/* Indicator Value */}
                        <TableCell className="font-mono text-xs font-semibold text-slate-900 max-w-[200px] truncate">
                          <div className="flex items-center gap-1.5" title={item.indicatorValue}>
                            <TypeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.indicatorValue}</span>
                          </div>
                        </TableCell>

                        {/* Type */}
                        <TableCell className="text-xs text-slate-600 font-medium">
                          {item.indicatorType}
                        </TableCell>

                        {/* Threat Classification */}
                        <TableCell className="text-xs text-slate-800 font-semibold">
                          {item.threatType}
                        </TableCell>

                        {/* Target Brand */}
                        <TableCell className="text-xs text-slate-700">
                          {item.matchedBrand || '—'}
                        </TableCell>

                        {/* Source Feed */}
                        <TableCell className="text-xs text-slate-500 max-w-[150px] truncate" title={item.source}>
                          {item.source}
                        </TableCell>

                        {/* Severity */}
                        <TableCell>
                          <Badge severity={item.severity} size="xs" withDot>
                            {item.severity?.toUpperCase()} ({item.riskScore})
                          </Badge>
                        </TableCell>

                        {/* Telemetry Mode */}
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Demo Sandbox
                          </span>
                        </TableCell>

                        {/* Triage Status */}
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                              item.status === 'Active Threat'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.status === 'Blocked at Perimeter'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'Takedown In Progress'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : item.status === 'Mitigated'
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {item.status}
                          </span>
                        </TableCell>

                        {/* Last Seen */}
                        <TableCell className="text-[11px] text-slate-500">
                          {formatRelativeTime(item.lastSeen)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedIoc(item)}
                            className="text-xs text-slate-700"
                          >
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* 6. IoC Inspection & Triage Modal */}
      {selectedIoc && (
        <Modal
          isOpen={!!selectedIoc}
          onClose={() => setSelectedIoc(null)}
          title={`Threat Intelligence Dossier: ${selectedIoc.indicatorValue}`}
          description={`Forensic analysis, infrastructure correlation, and perimeter defenses for ${selectedIoc.indicatorType}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            {/* Demo Sandbox Tag */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  Simulated Threat Feed Record (Demo Sandbox)
                </span>
              </div>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-mono font-medium">
                Confidence: {selectedIoc.confidence}%
              </span>
            </div>

            {/* Quick Details Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Indicator Type & Value</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-slate-900 font-bold text-xs truncate max-w-[200px]">
                    {selectedIoc.indicatorValue}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedIoc.indicatorValue)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    title="Copy indicator"
                  >
                    {copiedValue ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-slate-500 text-[11px] block mt-0.5">{selectedIoc.indicatorType}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Threat Classification</span>
                <span className="font-semibold text-slate-900 text-xs block mt-0.5">{selectedIoc.threatType}</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">Target: {selectedIoc.matchedBrand}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Source Stream</span>
                <span className="text-slate-800 text-xs block mt-0.5">{selectedIoc.source}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Resolved IP / Network</span>
                <span className="font-mono text-slate-800 text-xs block mt-0.5">
                  {selectedIoc.resolvedIp} ({selectedIoc.asn || selectedIoc.country})
                </span>
              </div>
            </div>

            {/* Forensic Description */}
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 block text-xs">Threat Narrative & Forensic Context</span>
              <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {selectedIoc.description}
              </p>
            </div>

            {/* Tags */}
            {selectedIoc.tags && selectedIoc.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-[11px] font-medium">IoC Tags:</span>
                {selectedIoc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Triage Actions */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 font-medium text-xs">Set Triage:</span>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedIoc.id, 'Blocked at Perimeter')}
                  className="px-2.5 py-1 text-xs rounded-lg font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  Block at Perimeter
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedIoc.id, 'Takedown In Progress')}
                  className="px-2.5 py-1 text-xs rounded-lg font-medium bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  Initiate Takedown
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedIoc.id, 'Mitigated')}
                  className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                >
                  Mark Mitigated
                </button>
              </div>

              <Button variant="outline" size="sm" onClick={() => setSelectedIoc(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 7. Add Custom Indicator Modal */}
      {isAddModalOpen && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Threat Indicator to Feed"
          description="Register candidate IoC for continuous brand monitoring and perimeter triage."
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleAddIndicatorSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Indicator Type</label>
              <Select
                value={newIocForm.indicatorType}
                onChange={(e) => setNewIocForm({ ...newIocForm, indicatorType: e.target.value })}
                options={INDICATOR_TYPE_OPTIONS.filter((o) => o.value !== 'all')}
                className="w-full text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Indicator Value *</label>
              <Input
                type="text"
                required
                value={newIocForm.indicatorValue}
                onChange={(e) => setNewIocForm({ ...newIocForm, indicatorValue: e.target.value })}
                placeholder="e.g. phish-acme-bank.com or 198.51.100.99"
                className="w-full font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Threat Type</label>
                <Input
                  type="text"
                  value={newIocForm.threatType}
                  onChange={(e) => setNewIocForm({ ...newIocForm, threatType: e.target.value })}
                  placeholder="e.g. Phishing Landing Page"
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Brand</label>
                <Input
                  type="text"
                  value={newIocForm.matchedBrand}
                  onChange={(e) => setNewIocForm({ ...newIocForm, matchedBrand: e.target.value })}
                  placeholder="e.g. Acme Financial Global"
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Severity</label>
                <Select
                  value={newIocForm.severity}
                  onChange={(e) => setNewIocForm({ ...newIocForm, severity: e.target.value })}
                  options={SEVERITY_OPTIONS.filter((o) => o.value !== 'all')}
                  className="w-full text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Risk Score (0-100)</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={newIocForm.riskScore}
                  onChange={(e) => setNewIocForm({ ...newIocForm, riskScore: Number(e.target.value) })}
                  className="w-full text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Description & Evidence</label>
              <textarea
                rows={3}
                value={newIocForm.description}
                onChange={(e) => setNewIocForm({ ...newIocForm, description: e.target.value })}
                placeholder="Observed activity, targeting methodology, and infrastructure details..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Save Indicator
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
