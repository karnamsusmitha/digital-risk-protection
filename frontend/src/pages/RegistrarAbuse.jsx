import React, { useState, useEffect, useMemo, useId } from 'react';
import {
  Radio,
  Globe,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Lock,
  Key,
  Mail,
  Server,
  Activity,
  FileText,
  Send,
  Copy,
  Check,
  Info,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { registrarAbuseService } from '../services/registrarAbuseService';
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

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical (85-100)' },
  { value: 'high', label: 'High (70-84)' },
  { value: 'medium', label: 'Medium (50-69)' },
  { value: 'low', label: 'Low (0-49)' }
];

const TAKEDOWN_STATUS_OPTIONS = [
  { value: 'all', label: 'All Takedown Statuses' },
  { value: 'Notice Dispatched', label: 'Notice Dispatched' },
  { value: 'Pending Registrar Response', label: 'Pending Response' },
  { value: 'Suspended by Registry', label: 'Suspended by Registry' },
  { value: 'Escalated to Brand Counsel', label: 'Escalated to Counsel' },
  { value: 'New Lookup', label: 'New Lookup' }
];

const SAMPLE_DOMAINS = [
  'xn--acm-7la-login.com',
  'acme-pay-verification.net',
  'acmefinancial-secops.org',
  'acmepay-support-desk.cc',
  'phish-acme-portal.xyz'
];

export default function RegistrarAbuse() {
  const searchInputId = useId();
  const severitySelectId = useId();
  const takedownSelectId = useId();
  const lookupInputId = useId();

  // State Management
  const [status, setStatus] = useState(() => registrarAbuseService.getIntegrationStatusSync());
  const [config, setConfig] = useState(() => registrarAbuseService.getConfig());
  const [lookups, setLookups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedTakedownStatus, setSelectedTakedownStatus] = useState('all');

  // Interactive Domain Lookup Form
  const [lookupDomainInput, setLookupDomainInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  // Connection Testing
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Detail Modal & Takedown
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDispatchingTakedown, setIsDispatchingTakedown] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Load Status & Lookups
  const loadData = async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setError(null);
    try {
      const [fetchedStatus, fetchedLookups] = await Promise.all([
        registrarAbuseService.getIntegrationStatus(),
        registrarAbuseService.getRecentLookups()
      ]);
      setStatus(fetchedStatus);
      setConfig(registrarAbuseService.getConfig());
      setLookups(fetchedLookups);
    } catch (err) {
      console.error('[RegistrarAbuse] Data load failed:', err);
      setError(err.message || 'Failed to load registrar abuse integration telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for cross-component status updates
    const handleStatusUpdate = (e) => {
      if (e.detail) {
        setStatus(e.detail);
        setConfig(registrarAbuseService.getConfig());
      }
    };
    window.addEventListener('drp_registrar_status_change', handleStatusUpdate);
    return () => {
      window.removeEventListener('drp_registrar_status_change', handleStatusUpdate);
    };
  }, []);

  // Filtered Lookups List
  const filteredLookups = useMemo(() => {
    let list = lookups;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.domain && r.domain.toLowerCase().includes(q)) ||
          (r.punycode && r.punycode.toLowerCase().includes(q)) ||
          (r.registrar && r.registrar.toLowerCase().includes(q)) ||
          (r.abuseEmail && r.abuseEmail.toLowerCase().includes(q)) ||
          (r.targetBrand && r.targetBrand.toLowerCase().includes(q))
      );
    }
    if (selectedSeverity !== 'all') {
      list = list.filter((r) => r.severity === selectedSeverity);
    }
    if (selectedTakedownStatus !== 'all') {
      list = list.filter((r) => r.takedownStatus === selectedTakedownStatus);
    }
    return list;
  }, [lookups, searchQuery, selectedSeverity, selectedTakedownStatus]);

  // Test Connection Action
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    setActionSuccess(null);
    try {
      const res = await registrarAbuseService.testConnection();
      setTestResult({
        success: true,
        message: res.message,
        latencyMs: res.latencyMs,
        checkedAt: res.checkedAt,
        isDemo: res.isDemo
      });
      // Refresh status after connection test
      const freshStatus = await registrarAbuseService.getIntegrationStatus();
      setStatus(freshStatus);
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || 'Gateway connectivity test failed.',
        checkedAt: new Date().toISOString()
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Toggle Missing Credentials Simulation (Task 7 verification)
  const handleToggleCredentials = () => {
    const updated = registrarAbuseService.toggleSimulateMissingCredentials();
    setConfig(updated);
    setTestResult(null);
    setActionSuccess(
      updated.isConfigured
        ? 'Restored default demo credentials (••••••••••••4a8f).'
        : 'Simulated missing API credentials. Live checks & automated dispatch disabled.'
    );
    setTimeout(() => setActionSuccess(null), 5000);
  };

  // Run Domain Lookup Action
  const handleRunLookup = async (e) => {
    if (e) e.preventDefault();
    if (!lookupDomainInput.trim()) return;

    setIsLookingUp(true);
    setLookupError(null);
    setActionSuccess(null);

    try {
      const newRecord = await registrarAbuseService.runDomainLookup(lookupDomainInput);
      setLookupDomainInput('');
      setActionSuccess(`Lookup successfully completed for ${newRecord.domain}. Identified registrar: ${newRecord.registrar}`);
      const refreshed = await registrarAbuseService.getRecentLookups();
      setLookups(refreshed);
      setSelectedRecord(newRecord);
    } catch (err) {
      setLookupError(err.message || 'Lookup failed.');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Quick Domain Chip Selection
  const handleSelectSampleDomain = (dom) => {
    setLookupDomainInput(dom);
  };

  // Dispatch Takedown Action
  const handleDispatchTakedown = async (record) => {
    setIsDispatchingTakedown(true);
    try {
      const updated = await registrarAbuseService.dispatchTakedown(record.id, 'Takedown notice filed via registrar gateway.');
      const refreshed = await registrarAbuseService.getRecentLookups();
      setLookups(refreshed);
      if (selectedRecord && selectedRecord.id === record.id) {
        setSelectedRecord(updated);
      }
      setActionSuccess(`Notice dispatched to ${updated.registrar} abuse desk (${updated.abuseEmail}). Ticket: ${updated.takedownTicket}`);
      setTimeout(() => setActionSuccess(null), 6000);
    } catch (err) {
      setError(err.message || 'Failed to dispatch takedown notice.');
    } finally {
      setIsDispatchingTakedown(false);
    }
  };

  // Reset Default Benchmark Data
  const handleResetHistory = () => {
    const restored = registrarAbuseService.resetDefaultLookups();
    setLookups(restored);
    setSearchQuery('');
    setSelectedSeverity('all');
    setSelectedTakedownStatus('all');
    setActionSuccess('Lookup history reset to benchmark telemetry.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Copy RFC 2822 notice text
  const handleCopyNotice = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  Registrar Abuse APIs
                </h2>
                {status.isLive ? (
                  <Badge variant="emerald" withDot pulse>
                    Connected & Live
                  </Badge>
                ) : !status.isConfigured ? (
                  <Badge variant="rose" withDot>
                    Credentials Required
                  </Badge>
                ) : (
                  <Badge variant="amber" withDot>
                    Demo Sandbox Mode
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automated ICANN RDAP/WHOIS registry lookup, threat infrastructure resolution & RFC 2822 takedown dispatch gateways.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={loading || isTestingConnection}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Activity className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
            <span>{isTestingConnection ? 'Testing Gateway...' : 'Test Connection'}</span>
          </Button>
        </div>
      </div>

      {/* 2. Mode & Configuration Notification Banners */}
      {status.isDemo && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/90 text-amber-900 flex items-start gap-3 text-xs leading-relaxed shadow-2xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-amber-950 mb-0.5">
              Demo Sandbox Mode Active: Simulated Registrar Abuse Telemetry
            </span>
            <p className="text-amber-800">
              All registrar RDAP lookups, WHOIS records, and automated takedown dispatch tickets shown below are simulated.
              Live registrar API connections require running the FastAPI backend gateway with configured ICANN RDAP provider credentials.
            </p>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded bg-amber-200/60 text-amber-900 font-mono text-[10px] border border-amber-300">
            ISOLATED SANDBOX
          </span>
        </div>
      )}

      {!config.isConfigured && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-900 flex items-start gap-3 text-xs leading-relaxed shadow-2xs">
          <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block text-rose-950 mb-0.5">
              Configuration Notice: API Credentials Missing or Unconfigured
            </span>
            <p className="text-rose-800">
              Registrar API bearer token is currently missing. Real-time RDAP queries and automated takedown dispatches are suspended.
              Configure <code className="font-mono bg-rose-100 px-1 py-0.5 rounded text-rose-900 font-semibold">VITE_REGISTRAR_API_KEY</code> or click "Restore Demo Credentials" to re-enable sandbox telemetry.
            </p>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={handleToggleCredentials}
            className="shrink-0 text-rose-800 border-rose-300 hover:bg-rose-100"
          >
            Restore Demo Credentials
          </Button>
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

      {/* Test Result Feedback */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            testResult.success
              ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
              : 'border-rose-200 bg-rose-50/90 text-rose-950'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold">
                {testResult.success ? 'Gateway Connectivity Verified' : 'Gateway Test Failed'}
              </span>
              {testResult.latencyMs && (
                <span className="font-mono text-[10px] bg-white/80 px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800">
                  {testResult.latencyMs}ms round-trip
                </span>
              )}
            </div>
            <p className="opacity-90">{testResult.message}</p>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <ErrorMessage
          title="Telemetry Synchronization Error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      {/* 3. Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gateway Status"
          value={status.isLive ? 'Live Active' : status.isConfigured ? 'Sandbox Active' : 'Offline'}
          subtitle={
            status.isLive
              ? 'FastAPI remote proxy connected'
              : status.isConfigured
              ? 'Simulated ICANN RDAP gateway'
              : 'API credentials missing'
          }
          icon={Activity}
          iconBg={status.isLive ? 'bg-emerald-50' : status.isConfigured ? 'bg-amber-50' : 'bg-rose-50'}
          iconColor={status.isLive ? 'text-emerald-600' : status.isConfigured ? 'text-amber-600' : 'text-rose-600'}
        />

        <StatCard
          title="Active Gateways"
          value={`${status.activeGateways} Tier-1 Registrars`}
          subtitle="NameSilo, GoDaddy, Tucows, MarkMonitor, Cloudflare"
          icon={Server}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />

        <StatCard
          title="Hourly Quota"
          value={`${status.quota?.limit - status.quota?.used} / ${status.quota?.limit}`}
          subtitle="Remaining requests before rate limit window"
          icon={Layers}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />

        <StatCard
          title="Last Gateway Check"
          value={formatRelativeTime(status.lastChecked) || 'Just now'}
          subtitle={status.lastChecked ? formatDate(status.lastChecked) : 'Pending check'}
          icon={Clock}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      {/* 4. Configuration & Capabilities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration & Credentials */}
        <Card className="lg:col-span-5 border-slate-200">
          <CardHeader
            action={
              <Button
                variant="outline"
                size="xs"
                onClick={handleToggleCredentials}
                className="text-[11px]"
              >
                {config.isConfigured ? 'Simulate Missing Key' : 'Restore Demo Key'}
              </Button>
            }
          >
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">Configuration & Security</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Gateway endpoints, authentication contracts and security boundaries.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Gateway Endpoint</span>
              <span className="font-mono text-slate-800 text-[11px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                {config.gatewayEndpoint}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Authentication Type</span>
              <span className="text-slate-800 font-medium">{config.authType}</span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">API Credential Token</span>
              <div className="flex items-center gap-1.5">
                {config.isConfigured && config.maskedApiKey ? (
                  <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-bold tracking-widest text-[11px]">
                    {config.maskedApiKey}
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Not Configured
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Abuse Contact Mailbox</span>
              <span className="text-slate-800 font-mono text-[11px]">{config.abuseContactEmail}</span>
            </div>

            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Rate Limit Policy</span>
              <span className="text-slate-700 font-medium">{config.rateLimitPerHour} requests / hr per tenant</span>
            </div>

            {/* Zero-Leakage Policy Callout */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-[11px] flex items-start gap-2 leading-relaxed">
              <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Credential Privacy Assurance:</strong> Plain text API keys and bearer tokens are never exposed in browser state, DOM attributes, or console logs. All credentials are masked with cryptographic truncation.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Supported Registrar-Abuse Lookup Capabilities */}
        <Card className="lg:col-span-7 border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">Supported Registrar-Abuse Capabilities</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Integrated protocols for real-time investigation, domain intelligence, and takedown processing.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>RDAP / WHOIS Querying</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Direct ICANN Registration Data Access Protocol (RFC 7480-7484) client resolving accredited registrar, IANA ID, creation age, and registry hold states.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <span>DNS & MX Mail Analysis</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Automated DNS zone interrogation identifying active Mail Exchange records pointing to disposable or bulletproof mail hosts used in phishing campaigns.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Send className="w-4 h-4 text-amber-600" />
                  <span>Abuse Desk Routing</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Algorithmic routing to verified Tier-1 registrar abuse desks (NameSilo, GoDaddy, Tucows, MarkMonitor, Cloudflare) via dedicated abuse webhooks and email queues.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>RFC 2822 Notice Bundles</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Pre-compiled cryptographic takedown notice packages citing registered trademarks, punycode conversions, and timestamped forensic evidence for fast triage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Interactive Domain Lookup Sandbox Tool */}
      <Card className="border-slate-200 bg-gradient-to-br from-white to-slate-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm">Interactive Registrar Abuse Lookup</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Query RDAP metadata, examine hosting infrastructure, and evaluate abuse risk for any domain name.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <form onSubmit={handleRunLookup} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor={lookupInputId} className="sr-only">
                Target Domain Name
              </label>
              <Input
                id={lookupInputId}
                type="text"
                value={lookupDomainInput}
                onChange={(e) => setLookupDomainInput(e.target.value)}
                placeholder="Enter candidate domain (e.g. acmè-login.com or acme-pay-verification.net)..."
                disabled={isLookingUp}
                className="w-full font-mono text-xs"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={isLookingUp || !lookupDomainInput.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5 text-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLookingUp ? 'animate-spin' : ''}`} />
              <span>{isLookingUp ? 'Executing RDAP Query...' : 'Run Abuse Lookup'}</span>
            </Button>
          </form>

          {lookupError && (
            <p className="text-xs text-rose-600 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{lookupError}</span>
            </p>
          )}

          {/* Quick suggestions chips */}
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs text-slate-500">
            <span className="font-semibold text-[11px] text-slate-400">Quick Test Domains:</span>
            {SAMPLE_DOMAINS.map((domainName) => (
              <button
                key={domainName}
                type="button"
                onClick={() => handleSelectSampleDomain(domainName)}
                className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-slate-200 text-slate-700 transition-colors"
              >
                {domainName}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 6. Recent Lookup Results Table */}
      <Card className="border-slate-200">
        <CardHeader
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={handleResetHistory}
              className="text-xs gap-1 text-slate-600"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Benchmark Data</span>
            </Button>
          }
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm">Recent Registrar Lookup Results</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Historical RDAP intelligence queries, registrar abuse desks, and takedown status records.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-6">
              <label htmlFor={searchInputId} className="sr-only">
                Search domain or registrar
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id={searchInputId}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search domain, punycode, registrar or brand..."
                  className="pl-8 text-xs w-full"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
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

            <div className="sm:col-span-3">
              <label htmlFor={takedownSelectId} className="sr-only">
                Filter by takedown status
              </label>
              <Select
                id={takedownSelectId}
                value={selectedTakedownStatus}
                onChange={(e) => setSelectedTakedownStatus(e.target.value)}
                options={TAKEDOWN_STATUS_OPTIONS}
                className="text-xs w-full"
              />
            </div>
          </div>

          {/* Table Container */}
          {loading ? (
            <LoadingState message="Loading registrar abuse telemetry..." />
          ) : filteredLookups.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3">
              <Globe className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <h4 className="text-sm font-semibold text-slate-800">No registrar lookups match your filters</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Try adjusting your search query or reset the filters to view the benchmark dataset.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetHistory}
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
                    <TableHead>Target Domain</TableHead>
                    <TableHead>Matched Brand</TableHead>
                    <TableHead>Registrar & IANA</TableHead>
                    <TableHead>Abuse Contact</TableHead>
                    <TableHead>Risk Severity</TableHead>
                    <TableHead>Telemetry Mode</TableHead>
                    <TableHead>Takedown Status</TableHead>
                    <TableHead>Last Checked</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLookups.map((item) => (
                    <TableRow key={item.id} hover>
                      {/* Target Domain */}
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        <div>
                          <span>{item.domain}</span>
                          {item.punycode && (
                            <span className="block text-[11px] font-sans font-normal text-amber-700">
                              Punycode: {item.punycode}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Matched Brand */}
                      <TableCell className="text-xs text-slate-700 font-medium">
                        {item.targetBrand || '—'}
                      </TableCell>

                      {/* Registrar & IANA */}
                      <TableCell className="text-xs">
                        <span className="font-semibold text-slate-800 block">{item.registrar}</span>
                        <span className="text-[10px] text-slate-400 font-mono">IANA #{item.ianaId}</span>
                      </TableCell>

                      {/* Abuse Contact */}
                      <TableCell className="text-xs font-mono text-slate-600">
                        <span className="text-blue-700">{item.abuseEmail}</span>
                      </TableCell>

                      {/* Risk Severity */}
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

                      {/* Takedown Status */}
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            item.takedownStatus === 'Notice Dispatched'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.takedownStatus === 'Suspended by Registry'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : item.takedownStatus === 'Pending Registrar Response'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {item.takedownStatus}
                        </span>
                      </TableCell>

                      {/* Last Checked */}
                      <TableCell className="text-[11px] text-slate-500">
                        {formatRelativeTime(item.checkedAt)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setSelectedRecord(item)}
                            className="text-xs text-slate-700"
                          >
                            Inspect
                          </Button>

                          {item.takedownStatus !== 'Notice Dispatched' && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => handleDispatchTakedown(item)}
                              disabled={isDispatchingTakedown}
                              className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                            >
                              Dispatch
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* 7. Detailed Record Inspection Modal */}
      {selectedRecord && (
        <Modal
          isOpen={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`Registrar Abuse Dossier: ${selectedRecord.domain}`}
          description={`RDAP metadata and takedown notice package for ${selectedRecord.registrar}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-5 text-xs">
            {/* Demo Sandbox Modal Tag */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  Simulated RDAP Telemetry (Demo Sandbox)
                </span>
              </div>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded font-mono font-medium">
                IANA Accredited Model
              </span>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Registrar of Record</span>
                <span className="font-semibold text-slate-900 text-sm">{selectedRecord.registrar}</span>
                <span className="text-slate-500 font-mono text-[11px] block">IANA ID: {selectedRecord.ianaId}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Abuse Contact Details</span>
                <span className="font-mono text-blue-700 font-semibold text-xs block">{selectedRecord.abuseEmail}</span>
                <span className="font-mono text-slate-500 text-[11px] block">{selectedRecord.abusePhone}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium text-[11px] block">RDAP Domain Status</span>
                <span className="font-mono text-slate-800 text-xs block">{selectedRecord.rdapStatus || 'active'}</span>
              </div>

              <div>
                <span className="text-slate-400 font-medium text-[11px] block">Resolved IP / Host</span>
                <span className="font-mono text-slate-800 text-xs block">
                  {selectedRecord.ipAddress} ({selectedRecord.hostingProvider})
                </span>
              </div>
            </div>

            {/* Evidence & Threat Summary */}
            <div className="space-y-1.5">
              <span className="font-semibold text-slate-900 block text-xs">Forensic Threat Evidence</span>
              <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200">
                {selectedRecord.evidenceSummary || 'Domain active and resolving with potential corporate trademark infringement.'}
              </p>
            </div>

            {/* Nameservers */}
            {selectedRecord.nameservers && (
              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block text-xs">Authoritative Nameservers</span>
                <div className="flex gap-2 flex-wrap">
                  {selectedRecord.nameservers.map((ns) => (
                    <span key={ns} className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      {ns}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pre-Compiled RFC 2822 Takedown Notice Draft */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-xs">
                  RFC 2822 Cryptographic Notice Draft (Ready for Dispatch)
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    handleCopyNotice(`TO: ${selectedRecord.abuseEmail}
SUBJECT: URGENT: Cease and Desist / Domain Suspension Request - ${selectedRecord.domain}
REGISTRAR: ${selectedRecord.registrar} (IANA #${selectedRecord.ianaId})
VIOLATION: Trademark Infringement & Phishing Impersonation targeting ${selectedRecord.targetBrand}
TIMESTAMP: ${new Date().toISOString()}
EVIDENCE: ${selectedRecord.evidenceSummary}
IP ADDRESS: ${selectedRecord.ipAddress}

Dear ${selectedRecord.registrar} Abuse Desk,
Our automated SOC platform has detected malicious activity originating from ${selectedRecord.domain}.
Please initiate immediate suspension in compliance with ICANN Registrar Accreditation Agreement Sec. 3.7.7.`)
                  }
                  className="gap-1 text-[11px]"
                >
                  {copiedNotice ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedNotice ? 'Copied' : 'Copy Notice'}</span>
                </Button>
              </div>

              <pre className="font-mono text-[11px] bg-slate-900 text-slate-200 p-3.5 rounded-xl overflow-x-auto leading-relaxed border border-slate-800">
{`TO: ${selectedRecord.abuseEmail}
SUBJECT: URGENT: Trademark Infringement Notice - ${selectedRecord.domain}
REGISTRAR: ${selectedRecord.registrar} (IANA #${selectedRecord.ianaId})
TARGET BRAND: ${selectedRecord.targetBrand}
EVIDENCE HASH: SHA256-${selectedRecord.id}-SEC
STATUS: ${selectedRecord.takedownStatus}`}
              </pre>
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                Close
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDispatchTakedown(selectedRecord)}
                disabled={isDispatchingTakedown || selectedRecord.takedownStatus === 'Notice Dispatched'}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {selectedRecord.takedownStatus === 'Notice Dispatched'
                    ? 'Notice Dispatched'
                    : 'Dispatch Notice to Abuse Desk'}
                </span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
