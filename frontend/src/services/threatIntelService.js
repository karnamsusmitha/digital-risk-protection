/**
 * THREAT INTELLIGENCE FEED SERVICE
 *
 * Dedicated frontend service for real-time external threat feeds,
 * Indicators of Compromise (IoCs), phishing infrastructure tracking,
 * and perimeter security telemetry.
 *
 * BACKEND API CONTRACT (Shared REST specification for FastAPI backend):
 * - GET  /api/v1/integrations/threat-intelligence/status  -> Threat feed health & sync telemetry
 * - GET  /api/v1/integrations/threat-intelligence/feed    -> Multi-source IoC indicators feed
 * - POST /api/v1/integrations/threat-intelligence/sync    -> Force sync with upstream intelligence sources
 * - POST /api/v1/integrations/threat-intelligence/ioc     -> Submit analyst candidate indicator
 * - PATCH /api/v1/integrations/threat-intelligence/ioc/:id/status -> Update indicator status
 *
 * DEMO SANDBOX & SECURITY POLICIES:
 * - Operates safely in Demo Sandbox when the remote FastAPI backend is offline.
 * - In Demo Sandbox mode, all feed records and health statuses are explicitly tagged `isDemo: true, _isRemote: false`.
 * - NEVER claims live threat intelligence feeds are connected when running in local sandbox.
 * - Stores state in LocalStorage key `drp_threat_intel_feed_v2`.
 */

import { apiService, API_BASE_URL } from './api.js';

const STORAGE_KEYS = {
  RECORDS: 'drp_threat_intel_feed_v2',
  STATUS: 'drp_threat_intel_status_v2'
};

export const INITIAL_THREAT_RECORDS = [
  {
    id: 'ioc-101',
    indicatorType: 'Domain',
    indicatorValue: 'xn--acm-7la-login.com',
    source: 'Certificate Transparency Stream',
    sourceId: 'ct-stream-01',
    threatType: 'Punycode Phishing Portal',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    riskScore: 96,
    severity: 'critical',
    confidence: 98,
    status: 'Active Threat',
    firstSeen: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    resolvedIp: '198.51.100.42',
    asn: 'AS394520 (Bulletproof Edge Inc)',
    country: 'RO',
    description: 'Freshly registered punycode homoglyph issued Let\'s Encrypt certificate copying Acme Financial customer login page with credential harvest backend.',
    tags: ['phishing', 'homoglyph', 'banking-trojan', 'lets-encrypt'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-102',
    indicatorType: 'IP Address',
    indicatorValue: '198.51.100.42',
    source: 'AbuseIPDB Threat Exchange',
    sourceId: 'abuseipdb-live',
    threatType: 'Bulletproof Phishing Host',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    riskScore: 92,
    severity: 'critical',
    confidence: 95,
    status: 'Blocked at Perimeter',
    firstSeen: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    resolvedIp: '198.51.100.42',
    asn: 'AS394520 (Bulletproof Edge Inc)',
    country: 'RO',
    description: 'High-reputation malicious host observed serving 8 active financial phishing kits with disposable MX mail exchanges.',
    tags: ['c2', 'bulletproof-host', 'phishing-cluster'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-103',
    indicatorType: 'URL',
    indicatorValue: 'https://acme-pay-verification.net/verify/login.php',
    source: 'PhishTank Community Feed',
    sourceId: 'phishtank-verified',
    threatType: 'Credential Harvester',
    matchedBrand: 'AcmePay Mobile',
    matchedBrandId: 'bp-2',
    riskScore: 88,
    severity: 'high',
    confidence: 94,
    status: 'Takedown In Progress',
    firstSeen: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    resolvedIp: '192.0.2.118',
    asn: 'AS13335 (Cloud Proxy Corp)',
    country: 'US',
    description: 'Active URL harvesting mobile SMS 2FA codes and user payment PINs under fake AcmePay verification premise.',
    tags: ['smishing', '2fa-bypass', 'acmepay-clone'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-104',
    indicatorType: 'File Hash',
    indicatorValue: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    source: 'MalwareBazaar APK Telemetry',
    sourceId: 'mbazaar-daily',
    threatType: 'Rogue Banking Dropper APK',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    riskScore: 94,
    severity: 'critical',
    confidence: 99,
    status: 'Active Threat',
    firstSeen: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    resolvedIp: '203.0.113.88',
    asn: 'AS4812 (Offshore CDN Svc)',
    country: 'NL',
    description: 'Trojanized Android package imitating Acme Financial Mobile with overlay injection permissions and SMS interception.',
    tags: ['banking-trojan', 'rogue-apk', 'overlay-attack'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-105',
    indicatorType: 'Domain',
    indicatorValue: 'acmefinancial-secops.org',
    source: 'VirusTotal Threat Graph',
    sourceId: 'vt-live-cluster',
    threatType: 'Executive SSO Impersonator',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    riskScore: 79,
    severity: 'high',
    confidence: 88,
    status: 'Investigating',
    firstSeen: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    resolvedIp: '203.0.113.88',
    asn: 'AS4812 (Offshore CDN Svc)',
    country: 'NL',
    description: 'Spoofed employee internal authentication gateway targeting Acme Financial corporate SecOps administrators.',
    tags: ['spearphishing', 'sso-spoof', 'executive-targeting'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-106',
    indicatorType: 'Social Handle',
    indicatorValue: '@AcmeFinanciial_Support',
    source: 'AlienVault OTX Community',
    sourceId: 'otx-social-feed',
    threatType: 'Impersonation Scam Account',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    riskScore: 74,
    severity: 'high',
    confidence: 90,
    status: 'Active Threat',
    firstSeen: new Date(Date.now() - 1000 * 60 * 960).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    resolvedIp: 'Platform Hosted',
    asn: 'AS13414 (Twitter/X Infra)',
    country: 'US',
    description: 'Typo-squatted social support handle DMing banking customers requesting account wallet seed phrases.',
    tags: ['social-impersonation', 'support-scam', 'crypto-lure'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-107',
    indicatorType: 'URL',
    indicatorValue: 'https://acmepay-support-desk.cc/ticket/auth',
    source: 'OpenPhish Global Stream',
    sourceId: 'openphish-premium',
    threatType: 'Helpdesk Phishing Lure',
    matchedBrand: 'AcmePay Mobile',
    matchedBrandId: 'bp-2',
    riskScore: 62,
    severity: 'medium',
    confidence: 82,
    status: 'Mitigated',
    firstSeen: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    resolvedIp: '198.51.100.99',
    asn: 'AS20940 (Akamai Linode LLC)',
    country: 'DE',
    description: 'Fake customer service ticket portal with corporate logo theft and user session harvesting.',
    tags: ['helpdesk-phish', 'session-harvest'],
    isDemo: true,
    _isRemote: false
  },
  {
    id: 'ioc-108',
    indicatorType: 'IP Address',
    indicatorValue: '203.0.113.88',
    source: 'Shodan Malicious Scanner Feed',
    sourceId: 'shodan-intel',
    threatType: 'Malware Staging Server',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    riskScore: 68,
    severity: 'medium',
    confidence: 86,
    status: 'Blocked at Perimeter',
    firstSeen: new Date(Date.now() - 1000 * 60 * 1800).toISOString(),
    lastSeen: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    resolvedIp: '203.0.113.88',
    asn: 'AS4812 (Offshore CDN Svc)',
    country: 'NL',
    description: 'Open port 8080 hosting unpacked malware APK artifacts and automated brute force bots.',
    tags: ['scanner', 'staging-server', 'botnet'],
    isDemo: true,
    _isRemote: false
  }
];

export const CONNECTED_SOURCES = [
  {
    name: 'Certificate Transparency Stream',
    type: 'SSL/TLS CT Logs (RFC 6962)',
    status: 'Simulated Feed',
    frequency: 'Continuous Stream',
    recordsCount: 412,
    latencyMs: 92,
    trustScore: '99% High'
  },
  {
    name: 'AbuseIPDB Threat Exchange',
    type: 'Reputation & IP Blacklist API',
    status: 'Simulated Feed',
    frequency: 'Every 5 mins',
    recordsCount: 320,
    latencyMs: 110,
    trustScore: '95% High'
  },
  {
    name: 'PhishTank Community Feed',
    type: 'Community Verified Phishing URLs',
    status: 'Simulated Feed',
    frequency: 'Every 15 mins',
    recordsCount: 284,
    latencyMs: 145,
    trustScore: '94% High'
  },
  {
    name: 'MalwareBazaar APK Telemetry',
    type: 'Mobile Malware Sample Feed',
    status: 'Simulated Feed',
    frequency: 'Every 30 mins',
    recordsCount: 168,
    latencyMs: 130,
    trustScore: '98% High'
  },
  {
    name: 'VirusTotal Threat Graph',
    type: 'Multi-Engine IOC Correlator',
    status: 'Simulated Feed',
    frequency: 'Every 10 mins',
    recordsCount: 194,
    latencyMs: 125,
    trustScore: '96% High'
  },
  {
    name: 'AlienVault OTX Community',
    type: 'Open Threat Exchange Pulses',
    status: 'Simulated Feed',
    frequency: 'Hourly',
    recordsCount: 142,
    latencyMs: 98,
    trustScore: '90% Med'
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
    console.warn(`[threatIntelService] LocalStorage write error [${key}]:`, err);
  }
}

function emitStatusChange(status) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('drp_threat_intel_status_change', { detail: status }));
  }
}

export const threatIntelService = {
  /**
   * Synchronous helper for immediate sidebar pill / badges
   */
  getFeedStatusSync() {
    return {
      isLive: false,
      isDemo: true,
      _isRemote: false,
      statusLabel: 'Demo Sandbox',
      activeFeeds: CONNECTED_SOURCES.length,
      totalIndicators: 1520,
      criticalIndicators: 34,
      lastSyncTime: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      latencyMs: 104,
      message: 'Demo Sandbox mode active. Threat intelligence feeds and IoC records are simulated.'
    };
  },

  /**
   * Asynchronously inspects the threat intelligence feed status
   */
  async getFeedStatus() {
    const startTime = performance.now();

    try {
      const health = await apiService.checkHealth();
      if (health.ok && health.isRemote) {
        try {
          const res = await fetch(`${API_BASE_URL}/integrations/threat-intelligence/status`, {
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
              statusLabel: 'Live Feeds Connected',
              activeFeeds: data.activeFeeds || CONNECTED_SOURCES.length,
              totalIndicators: data.totalIndicators || 1520,
              criticalIndicators: data.criticalIndicators || 34,
              lastSyncTime: new Date().toISOString(),
              latencyMs,
              message: 'Live connection established to Enterprise Threat Intelligence feeds.'
            };
            emitStatusChange(statusResult);
            return statusResult;
          }
        } catch {
          // Fall through to Demo Sandbox
        }
      }
    } catch {
      // Backend offline
    }

    // Demo Sandbox Fallback
    const storedStatus = getStored(STORAGE_KEYS.STATUS, null);
    const lastSync = storedStatus?.lastSyncTime || new Date(Date.now() - 1000 * 60 * 8).toISOString();

    const statusResult = {
      isLive: false,
      isDemo: true,
      _isRemote: false,
      statusLabel: 'Demo Sandbox',
      activeFeeds: CONNECTED_SOURCES.length,
      totalIndicators: 1520,
      criticalIndicators: 34,
      lastSyncTime: lastSync,
      latencyMs: 104,
      sources: CONNECTED_SOURCES,
      message: 'Demo Sandbox mode active. Threat intelligence feeds and IoC records are simulated for development and demonstration.'
    };

    emitStatusChange(statusResult);
    return statusResult;
  },

  /**
   * Manually trigger feed synchronization
   */
  async syncFeeds() {
    try {
      const res = await fetch(`${API_BASE_URL}/integrations/threat-intelligence/sync`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          isLive: true,
          isDemo: false,
          _isRemote: true,
          syncedAt: new Date().toISOString(),
          message: data.message || 'Threat feeds synchronized successfully with remote upstream sources.'
        };
      }
    } catch {
      // Fall through to simulation
    }

    // Realistic simulated sync delay
    await new Promise((resolve) => setTimeout(resolve, 750));

    const now = new Date().toISOString();
    setStored(STORAGE_KEYS.STATUS, { lastSyncTime: now });

    const result = {
      success: true,
      isLive: false,
      isDemo: true,
      _isRemote: false,
      syncedAt: now,
      latencyMs: 98,
      message: 'Demo Sandbox synchronization complete. 6 simulated threat feeds polled; 0 new high-confidence zero-days.'
    };

    emitStatusChange(this.getFeedStatusSync());
    return result;
  },

  /**
   * Retrieves threat intelligence records
   */
  async getThreatRecords(filters = {}) {
    let list = getStored(STORAGE_KEYS.RECORDS, INITIAL_THREAT_RECORDS);

    if (!list || list.length === 0) {
      list = [...INITIAL_THREAT_RECORDS];
      setStored(STORAGE_KEYS.RECORDS, list);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.indicatorValue && r.indicatorValue.toLowerCase().includes(q)) ||
          (r.threatType && r.threatType.toLowerCase().includes(q)) ||
          (r.source && r.source.toLowerCase().includes(q)) ||
          (r.matchedBrand && r.matchedBrand.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q))
      );
    }

    if (filters.indicatorType && filters.indicatorType !== 'all') {
      list = list.filter((r) => r.indicatorType === filters.indicatorType);
    }

    if (filters.severity && filters.severity !== 'all') {
      list = list.filter((r) => r.severity === filters.severity);
    }

    if (filters.source && filters.source !== 'all') {
      list = list.filter((r) => r.source === filters.source);
    }

    if (filters.status && filters.status !== 'all') {
      list = list.filter((r) => r.status === filters.status);
    }

    return list.map((r) => ({ ...r, isDemo: true, _isRemote: false }));
  },

  /**
   * Updates indicator triage status (e.g. 'Blocked at Perimeter', 'Mitigated', etc.)
   */
  async updateIndicatorStatus(id, newStatus) {
    const list = getStored(STORAGE_KEYS.RECORDS, INITIAL_THREAT_RECORDS);
    const updated = list.map((item) =>
      item.id === id
        ? {
            ...item,
            status: newStatus,
            updatedAt: new Date().toISOString()
          }
        : item
    );
    setStored(STORAGE_KEYS.RECORDS, updated);
    return updated.find((i) => i.id === id);
  },

  /**
   * Adds custom analyst indicator
   */
  async addIndicator(indicatorData) {
    const list = getStored(STORAGE_KEYS.RECORDS, INITIAL_THREAT_RECORDS);
    const newRecord = {
      id: `ioc-${Date.now()}`,
      indicatorType: indicatorData.indicatorType || 'Domain',
      indicatorValue: indicatorData.indicatorValue.trim(),
      source: 'Analyst Custom Submission',
      sourceId: 'custom-entry',
      threatType: indicatorData.threatType || 'Suspicious Infrastructure',
      matchedBrand: indicatorData.matchedBrand || 'Acme Financial Global',
      riskScore: indicatorData.riskScore || 75,
      severity: indicatorData.severity || 'high',
      confidence: 90,
      status: indicatorData.status || 'Active Threat',
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      resolvedIp: indicatorData.resolvedIp || 'Dynamic DNS / Unresolved',
      asn: indicatorData.asn || 'Pending ASN Resolution',
      country: indicatorData.country || 'Global',
      description: indicatorData.description || 'Analyst submitted threat intelligence indicator.',
      tags: indicatorData.tags || ['analyst-submitted'],
      isDemo: true,
      _isRemote: false
    };

    setStored(STORAGE_KEYS.RECORDS, [newRecord, ...list]);
    return newRecord;
  },

  /**
   * Resets feed records to default benchmark data
   */
  resetDefaultRecords() {
    setStored(STORAGE_KEYS.RECORDS, INITIAL_THREAT_RECORDS);
    return [...INITIAL_THREAT_RECORDS];
  }
};

export default threatIntelService;
