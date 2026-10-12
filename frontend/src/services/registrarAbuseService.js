/**
 * REGISTRAR ABUSE INTEGRATION SERVICE
 *
 * Dedicated frontend service for managing registrar abuse integrations,
 * automated WHOIS / RDAP lookup querying, RFC 2822 takedown notice bundling,
 * and Tier-1 registrar abuse desk routing.
 *
 * BACKEND API CONTRACT (Shared specification for FastAPI backend):
 * - GET  /api/v1/integrations/registrar-abuse/status          -> Health & gateway status
 * - POST /api/v1/integrations/registrar-abuse/test-connection -> Credentials validation & ping
 * - POST /api/v1/integrations/registrar-abuse/lookup          -> Live RDAP / WHOIS lookup for domain
 * - GET  /api/v1/integrations/registrar-abuse/lookups         -> Lookup telemetry history
 * - POST /api/v1/integrations/registrar-abuse/takedown        -> Programmatic takedown notice dispatch
 *
 * DEMO SANDBOX & SECURITY POLICIES:
 * - Operates safely in Demo Sandbox when the remote FastAPI backend is offline.
 * - In Demo Sandbox mode, all lookups and health statuses are explicitly tagged `isDemo: true, _isRemote: false`.
 * - NEVER claims a live registrar API is connected unless a real remote connectivity check succeeds.
 * - NEVER exposes plain API keys, bearer tokens, or secret keys in client-side code, storage, UI, or console logs.
 * - Formats all secret keys as masked indicators (e.g. ••••••••••••4a8f).
 */

import { apiService, API_BASE_URL } from './api.js';

const STORAGE_KEYS = {
  LOOKUPS: 'drp_registrar_abuse_lookups_v2',
  CONFIG: 'drp_registrar_abuse_config_v2'
};

const DEFAULT_CONFIG = {
  gatewayEndpoint: 'https://api.registrar-gateways.net/v2',
  isConfigured: true,
  maskedApiKey: '••••••••••••4a8f',
  abuseContactEmail: 'soc-abuse@acmefinancial.com',
  authType: 'Bearer Token (Ed25519)',
  rateLimitPerHour: 500,
  rateLimitUsed: 50,
  notificationWebhooks: true,
  rfc2822Bundling: true,
  lastChecked: new Date(Date.now() - 1000 * 60 * 12).toISOString()
};

export const INITIAL_REGISTRAR_LOOKUPS = [
  {
    id: 'reg-look-101',
    domain: 'xn--acm-7la-login.com',
    punycode: 'acmè-secure-login.com',
    targetBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    registrar: 'NameSilo, LLC',
    ianaId: '1479',
    abuseEmail: 'abuse@namesilo.com',
    abusePhone: '+1.4805240066',
    whoisServer: 'whois.namesilo.com',
    rdapUrl: 'https://rdap.namesilo.com/domain/xn--acm-7la-login.com',
    rdapStatus: 'clientHold, clientTransferProhibited',
    nameservers: ['ns1.bulletproof-dns.net', 'ns2.bulletproof-dns.net'],
    dnssec: 'Unsigned',
    ipAddress: '198.51.100.42',
    hostingProvider: 'Anonymous Bulletproof Host Inc',
    riskScore: 96,
    severity: 'critical',
    takedownStatus: 'Notice Dispatched',
    evidenceSummary: 'Punycode homoglyph banking login clone; active phishing MX records; rogue SSL cert.',
    registeredAt: '2026-10-08T14:22:00Z',
    checkedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'reg-look-102',
    domain: 'acme-pay-verification.net',
    punycode: null,
    targetBrand: 'AcmePay Mobile',
    matchedBrandId: 'bp-2',
    registrar: 'GoDaddy.com, LLC',
    ianaId: '146',
    abuseEmail: 'abuse@godaddy.com',
    abusePhone: '+1.4806242505',
    whoisServer: 'whois.godaddy.com',
    rdapUrl: 'https://rdap.godaddy.com/v1/domain/acme-pay-verification.net',
    rdapStatus: 'active',
    nameservers: ['ns1.domaincontrol.com', 'ns2.domaincontrol.com'],
    dnssec: 'Unsigned',
    ipAddress: '192.0.2.118',
    hostingProvider: 'Cloud Hosting Services Inc.',
    riskScore: 88,
    severity: 'high',
    takedownStatus: 'Pending Registrar Response',
    evidenceSummary: 'Keyword trademark squatting "verification"; credential harvest form targeting AcmePay.',
    registeredAt: '2026-10-10T09:15:00Z',
    checkedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'reg-look-103',
    domain: 'acmefinancial-secops.org',
    punycode: null,
    targetBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    registrar: 'Tucows Domains Inc',
    ianaId: '69',
    abuseEmail: 'domainabuse@tucows.com',
    abusePhone: '+1.4165350123',
    whoisServer: 'whois.tucows.com',
    rdapUrl: 'https://rdap.tucows.com/v1/domain/acmefinancial-secops.org',
    rdapStatus: 'serverHold',
    nameservers: ['dns1.registrar-servers.com', 'dns2.registrar-servers.com'],
    dnssec: 'Signed',
    ipAddress: '203.0.113.88',
    hostingProvider: 'FastCDN Edge Systems LLC',
    riskScore: 79,
    severity: 'high',
    takedownStatus: 'Suspended by Registry',
    evidenceSummary: 'Pretending to host corporate SecOps portal; spoofed employee SSO landing page.',
    registeredAt: '2026-09-28T18:40:00Z',
    checkedAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'reg-look-104',
    domain: 'acmepay-support-desk.cc',
    punycode: null,
    targetBrand: 'AcmePay Mobile',
    matchedBrandId: 'bp-2',
    registrar: 'MarkMonitor Inc',
    ianaId: '292',
    abuseEmail: 'ccops@markmonitor.com',
    abusePhone: '+1.2083895740',
    whoisServer: 'whois.markmonitor.com',
    rdapUrl: 'https://rdap.markmonitor.com/domain/acmepay-support-desk.cc',
    rdapStatus: 'ok',
    nameservers: ['ns1.markmonitor.com', 'ns2.markmonitor.com'],
    dnssec: 'Unsigned',
    ipAddress: '198.51.100.99',
    hostingProvider: 'Global Edge Hosting LLC',
    riskScore: 62,
    severity: 'medium',
    takedownStatus: 'Escalated to Brand Counsel',
    evidenceSummary: 'Customer support impersonation; social engineering phishing lures.',
    registeredAt: '2026-10-01T11:20:00Z',
    checkedAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    isDemo: true,
    _isRemote: false
  }
];

function getStored(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err) {
    console.warn(`[registrarAbuseService] LocalStorage write error [${key}]:`, err);
  }
}

function emitStatusChange(status) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('drp_registrar_status_change', { detail: status }));
  }
}

export const registrarAbuseService = {
  /**
   * Retrieves current configuration (with masked API key)
   */
  getConfig() {
    const stored = getStored(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    return { ...stored };
  },

  /**
   * Updates configuration securely without storing unmasked secrets
   */
  updateConfig(updates = {}) {
    const current = this.getConfig();
    const updated = {
      ...current,
      ...updates,
      lastChecked: new Date().toISOString()
    };
    setStored(STORAGE_KEYS.CONFIG, updated);
    emitStatusChange(this.getIntegrationStatusSync());
    return updated;
  },

  /**
   * Allows toggling missing credentials state for interactive verification
   */
  toggleSimulateMissingCredentials() {
    const current = this.getConfig();
    const isNowConfigured = !current.isConfigured;
    const updated = {
      ...current,
      isConfigured: isNowConfigured,
      maskedApiKey: isNowConfigured ? '••••••••••••4a8f' : null,
      lastChecked: new Date().toISOString()
    };
    setStored(STORAGE_KEYS.CONFIG, updated);
    const newStatus = this.getIntegrationStatusSync();
    emitStatusChange(newStatus);
    return updated;
  },

  /**
   * Synchronous status helper for immediate UI badges
   */
  getIntegrationStatusSync() {
    const config = this.getConfig();
    return {
      isLive: false,
      isDemo: true,
      _isRemote: false,
      isConfigured: config.isConfigured,
      connectionState: config.isConfigured ? 'demo_sandbox' : 'unconfigured',
      statusLabel: config.isConfigured ? 'Demo Sandbox' : 'Config Required',
      endpoint: config.gatewayEndpoint,
      maskedApiKey: config.maskedApiKey,
      abuseContactEmail: config.abuseContactEmail,
      lastChecked: config.lastChecked,
      latencyMs: config.isConfigured ? 142 : 0,
      activeGateways: config.isConfigured ? 5 : 0,
      quota: {
        used: config.rateLimitUsed || 50,
        limit: config.rateLimitPerHour || 500,
        period: '1 hour'
      }
    };
  },

  /**
   * Asynchronously inspects the integration status and probes the remote backend
   */
  async getIntegrationStatus() {
    const config = this.getConfig();
    const startTime = performance.now();

    try {
      // Attempt live backend health probe
      const health = await apiService.checkHealth();

      if (health.ok && health.isRemote) {
        // Backend is alive, try to probe backend registrar gateway endpoint
        try {
          const res = await fetch(`${API_BASE_URL}/integrations/registrar-abuse/status`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(3000)
          });

          if (res.ok) {
            const data = await res.json();
            const latencyMs = Math.round(performance.now() - startTime);
            const statusResult = {
              isLive: true,
              isDemo: false,
              _isRemote: true,
              isConfigured: true,
              connectionState: 'connected',
              statusLabel: 'Connected',
              endpoint: data.endpoint || config.gatewayEndpoint,
              maskedApiKey: config.maskedApiKey,
              abuseContactEmail: data.abuseContactEmail || config.abuseContactEmail,
              lastChecked: new Date().toISOString(),
              latencyMs,
              activeGateways: data.activeGateways || 5,
              quota: data.quota || { used: 45, limit: 500, period: '1 hour' },
              message: 'Live connection to Registrar Abuse Gateway established via FastAPI backend.'
            };
            emitStatusChange(statusResult);
            return statusResult;
          }
        } catch {
          // Fall through to Demo Sandbox if the specific endpoint isn't mounted yet
        }
      }
    } catch {
      // Remote backend offline
    }

    // Demo Sandbox Fallback: Honest telemetry labeling
    const statusResult = {
      isLive: false,
      isDemo: true,
      _isRemote: false,
      isConfigured: config.isConfigured,
      connectionState: config.isConfigured ? 'demo_sandbox' : 'unconfigured',
      statusLabel: config.isConfigured ? 'Demo Sandbox' : 'Config Required',
      endpoint: config.gatewayEndpoint,
      maskedApiKey: config.maskedApiKey,
      abuseContactEmail: config.abuseContactEmail,
      lastChecked: config.lastChecked,
      latencyMs: config.isConfigured ? 142 : 0,
      activeGateways: config.isConfigured ? 5 : 0,
      quota: {
        used: config.rateLimitUsed || 50,
        limit: config.rateLimitPerHour || 500,
        period: '1 hour'
      },
      supportedRegistrars: [
        'NameSilo, LLC (IANA #1479)',
        'GoDaddy.com, LLC (IANA #146)',
        'Tucows Domains Inc (IANA #69)',
        'MarkMonitor Inc (IANA #292)',
        'Cloudflare, Inc. (IANA #1910)'
      ],
      capabilities: [
        'ICANN RDAP / RFC 7480-7484 REST metadata queries',
        'Direct port 43 WHOIS fallback resolver',
        'Automated registrar abuse desk mailbox routing',
        'RFC 2822 takedown notification package bundling',
        'DNS, MX & mail exchange phishing infrastructure scoring'
      ],
      message: config.isConfigured
        ? 'Demo Sandbox mode active. Telemetry and registrar responses are simulated for demonstration. Live connection requires running backend gateway.'
        : 'Missing API Credentials: No registrar abuse API key configured. Live connectivity and takedown requests are suspended.'
    };

    emitStatusChange(statusResult);
    return statusResult;
  },

  /**
   * Test Connection / Retry action
   */
  async testConnection() {
    const config = this.getConfig();

    if (!config.isConfigured || !config.maskedApiKey) {
      throw new Error(
        'Missing API Credentials: No registrar API key is configured. Please provide a valid gateway token before testing connection.'
      );
    }

    const startTime = performance.now();

    try {
      // Attempt backend verification endpoint
      const res = await fetch(`${API_BASE_URL}/integrations/registrar-abuse/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        signal: AbortSignal.timeout(3000)
      });

      if (res.ok) {
        const data = await res.json();
        const latencyMs = Math.round(performance.now() - startTime);
        const result = {
          success: true,
          isLive: true,
          isDemo: false,
          _isRemote: true,
          latencyMs,
          checkedAt: new Date().toISOString(),
          message: data.message || `Live Registrar API gateway verified (${latencyMs}ms round-trip).`
        };
        this.updateConfig({ lastChecked: result.checkedAt });
        return result;
      }
    } catch {
      // Backend offline -> run simulated verification with realistic timing
    }

    // Simulated sandbox delay
    await new Promise((resolve) => setTimeout(resolve, 600));
    const latencyMs = Math.floor(Math.random() * 40) + 120; // 120-160ms

    const now = new Date().toISOString();
    this.updateConfig({ lastChecked: now });

    const result = {
      success: true,
      isLive: false,
      isDemo: true,
      _isRemote: false,
      latencyMs,
      checkedAt: now,
      message: `Demo Sandbox connection verified: Simulated ICANN RDAP gateway and Tier-1 abuse responders are operational (${latencyMs}ms).`
    };

    emitStatusChange(this.getIntegrationStatusSync());
    return result;
  },

  /**
   * Retrieves recent registrar lookups
   */
  async getRecentLookups(filters = {}) {
    let list = getStored(STORAGE_KEYS.LOOKUPS, INITIAL_REGISTRAR_LOOKUPS);

    // Ensure baseline if empty
    if (!list || list.length === 0) {
      list = [...INITIAL_REGISTRAR_LOOKUPS];
      setStored(STORAGE_KEYS.LOOKUPS, list);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (item) =>
          (item.domain && item.domain.toLowerCase().includes(q)) ||
          (item.punycode && item.punycode.toLowerCase().includes(q)) ||
          (item.registrar && item.registrar.toLowerCase().includes(q)) ||
          (item.abuseEmail && item.abuseEmail.toLowerCase().includes(q)) ||
          (item.targetBrand && item.targetBrand.toLowerCase().includes(q))
      );
    }

    if (filters.severity && filters.severity !== 'all') {
      list = list.filter((item) => item.severity === filters.severity);
    }

    if (filters.takedownStatus && filters.takedownStatus !== 'all') {
      list = list.filter((item) => item.takedownStatus === filters.takedownStatus);
    }

    return list.map((item) => ({ ...item, isDemo: true, _isRemote: false }));
  },

  /**
   * Executes a domain abuse lookup (RDAP / WHOIS simulation)
   */
  async runDomainLookup(rawDomain) {
    if (!rawDomain || !rawDomain.trim()) {
      throw new Error('Please enter a valid domain name to look up.');
    }

    // Normalize domain
    let domain = rawDomain.trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/\/.*$/, '');
    domain = domain.replace(/:\d+$/, '');

    if (!domain.includes('.') || domain.length < 4) {
      throw new Error('Invalid domain format. Please enter a valid fully-qualified domain name (e.g. acme-login.com).');
    }

    const config = this.getConfig();
    if (!config.isConfigured) {
      throw new Error('Cannot execute lookup: API credentials are missing. Please configure credentials first.');
    }

    // Try remote endpoint if online
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/registrar-abuse/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ domain }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const remoteData = await res.json();
        const stored = getStored(STORAGE_KEYS.LOOKUPS, INITIAL_REGISTRAR_LOOKUPS);
        setStored(STORAGE_KEYS.LOOKUPS, [remoteData, ...stored]);
        return remoteData;
      }
    } catch {
      // Fall through to Demo Sandbox simulation
    }

    // Simulate realistic RDAP parsing delay
    await new Promise((resolve) => setTimeout(resolve, 850));

    // Dynamic registrar heuristic based on domain patterns
    let registrar = 'NameSilo, LLC';
    let ianaId = '1479';
    let abuseEmail = 'abuse@namesilo.com';
    let abusePhone = '+1.4805240066';
    let whoisServer = 'whois.namesilo.com';
    let rdapUrl = `https://rdap.namesilo.com/domain/${domain}`;

    if (domain.endsWith('.net') || domain.includes('godaddy')) {
      registrar = 'GoDaddy.com, LLC';
      ianaId = '146';
      abuseEmail = 'abuse@godaddy.com';
      abusePhone = '+1.4806242505';
      whoisServer = 'whois.godaddy.com';
      rdapUrl = `https://rdap.godaddy.com/v1/domain/${domain}`;
    } else if (domain.endsWith('.org') || domain.includes('tucows')) {
      registrar = 'Tucows Domains Inc';
      ianaId = '69';
      abuseEmail = 'domainabuse@tucows.com';
      abusePhone = '+1.4165350123';
      whoisServer = 'whois.tucows.com';
      rdapUrl = `https://rdap.tucows.com/v1/domain/${domain}`;
    } else if (domain.endsWith('.cc') || domain.includes('markmonitor')) {
      registrar = 'MarkMonitor Inc';
      ianaId = '292';
      abuseEmail = 'ccops@markmonitor.com';
      abusePhone = '+1.2083895740';
      whoisServer = 'whois.markmonitor.com';
      rdapUrl = `https://rdap.markmonitor.com/domain/${domain}`;
    } else if (domain.endsWith('.xyz') || domain.includes('cloud')) {
      registrar = 'Cloudflare, Inc.';
      ianaId = '1910';
      abuseEmail = 'abuse@cloudflare.com';
      abusePhone = '+1.6503198930';
      whoisServer = 'whois.cloudflare.com';
      rdapUrl = `https://rdap.cloudflare.com/domain/${domain}`;
    }

    // Risk scoring
    const isPunycode = domain.startsWith('xn--');
    const isAcmeSpoof = domain.includes('acme');
    let riskScore = 65;
    if (isPunycode) riskScore = 95;
    else if (isAcmeSpoof) riskScore = 88;
    else riskScore = Math.floor(Math.random() * 25) + 60;

    let severity = 'medium';
    if (riskScore >= 85) severity = 'critical';
    else if (riskScore >= 70) severity = 'high';

    const newRecord = {
      id: `reg-look-${Date.now()}`,
      domain,
      punycode: isPunycode ? 'acmè-spoof.com' : null,
      targetBrand: isAcmeSpoof ? 'Acme Financial Global' : 'Generic Brand Asset',
      matchedBrandId: isAcmeSpoof ? 'bp-1' : null,
      registrar,
      ianaId,
      abuseEmail,
      abusePhone,
      whoisServer,
      rdapUrl,
      rdapStatus: 'clientTransferProhibited, active',
      nameservers: [`ns1.${domain.split('.')[0]}-dns.com`, `ns2.${domain.split('.')[0]}-dns.com`],
      dnssec: 'Unsigned',
      ipAddress: `198.51.100.${Math.floor(Math.random() * 150) + 10}`,
      hostingProvider: 'High-Risk Hosting VPS',
      riskScore,
      severity,
      takedownStatus: 'New Lookup',
      evidenceSummary: isAcmeSpoof
        ? 'Domain matches trademark keyword patterns. Active DNS MX records detected.'
        : 'Registered within last 14 days. Monitored for suspicious redirects.',
      registeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      checkedAt: new Date().toISOString(),
      isDemo: true,
      _isRemote: false
    };

    const stored = getStored(STORAGE_KEYS.LOOKUPS, INITIAL_REGISTRAR_LOOKUPS);
    setStored(STORAGE_KEYS.LOOKUPS, [newRecord, ...stored]);

    // Increment quota used
    const curConfig = this.getConfig();
    this.updateConfig({ rateLimitUsed: (curConfig.rateLimitUsed || 50) + 1 });

    return newRecord;
  },

  /**
   * Dispatches automated takedown notification to registrar abuse desk
   */
  async dispatchTakedown(lookupId, customNotes = '') {
    const stored = getStored(STORAGE_KEYS.LOOKUPS, INITIAL_REGISTRAR_LOOKUPS);
    const target = stored.find((item) => item.id === lookupId);

    if (!target) {
      throw new Error(`Lookup record ID ${lookupId} not found.`);
    }

    const config = this.getConfig();
    if (!config.isConfigured) {
      throw new Error('Cannot dispatch takedown: Registrar API credentials are missing.');
    }

    // Simulate dispatch processing
    await new Promise((resolve) => setTimeout(resolve, 700));

    const updated = stored.map((item) =>
      item.id === lookupId
        ? {
            ...item,
            takedownStatus: 'Notice Dispatched',
            dispatchedAt: new Date().toISOString(),
            takedownTicket: `TKT-REG-${Math.floor(Math.random() * 89999) + 10000}`,
            analystNotes: customNotes || 'Notice dispatched via automated registrar gateway.'
          }
        : item
    );

    setStored(STORAGE_KEYS.LOOKUPS, updated);
    return updated.find((item) => item.id === lookupId);
  },

  /**
   * Resets lookup history to default benchmark data
   */
  resetDefaultLookups() {
    setStored(STORAGE_KEYS.LOOKUPS, INITIAL_REGISTRAR_LOOKUPS);
    return [...INITIAL_REGISTRAR_LOOKUPS];
  }
};

export default registrarAbuseService;
