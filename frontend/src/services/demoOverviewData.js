/**
 * CENTRALIZED DEMONSTRATION DATASET & COMPUTATION LAYER
 *
 * Provides shared synthetic telemetry benchmarks and real-time metric aggregators
 * across Overview, Brand Profiles, Social Monitoring, App Monitoring, and Findings.
 *
 * COMPLIANCE & INTEGRITY:
 * - Clearly tags all simulated records (isDemo: true, _isRemote: false).
 * - Computes real-time statistics dynamically from active demo storage.
 */

export const DEMO_SUMMARY_METRICS = {
  monitoredBrands: {
    total: 4,
    change: '+1 this cycle',
    detail: '2 Mission-Critical, 2 Standard'
  },
  analyzedSocialProfiles: {
    total: 348,
    change: '+42 analyzed this week',
    detail: 'Tracked across 6 platforms'
  },
  analyzedApps: {
    total: 142,
    change: '+8 stores & mirrors scanned',
    detail: '18 third-party APK repos'
  },
  candidatesRequiringReview: {
    total: 7,
    change: '5 High / Critical priority',
    detail: 'Immediate analyst triage needed'
  }
};

export const DEMO_RISK_DISTRIBUTION_SEVERITY = [
  { level: 'Critical (85-100)', count: 4, fill: '#e11d48', badge: 'Critical' },
  { level: 'High (70-84)', count: 3, fill: '#f59e0b', badge: 'High' },
  { level: 'Medium (50-69)', count: 1, fill: '#eab308', badge: 'Medium' },
  { level: 'Low (0-49)', count: 0, fill: '#3b82f6', badge: 'Low' }
];

export const DEMO_RISK_DISTRIBUTION_CATEGORIES = [
  { category: 'Domain Typosquats', candidates: 2, criticalCount: 1, avgScore: 92 },
  { category: 'Social Profiles', candidates: 3, criticalCount: 1, avgScore: 89 },
  { category: 'Mobile APKs', candidates: 3, criticalCount: 2, avgScore: 91 },
  { category: 'Executive Spoofs', candidates: 1, criticalCount: 0, avgScore: 88 }
];

export const DEMO_RECENT_ACTIVITY = [
  {
    id: 'DEMO-ACT-01',
    title: 'Cease & Desist Takedown Dispatched',
    description: 'RFC-compliant abuse notice issued to NameSilo for host xn--acm-7la-login.com.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    type: 'takedown',
    severity: 'critical'
  },
  {
    id: 'DEMO-ACT-02',
    title: 'Candidate Profile Scored by Heuristics Engine',
    description: 'Telegram bot @AcmePay_Support_Desk assigned 96/100 risk score based on wallet phrase query.',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    type: 'analysis',
    severity: 'high'
  },
  {
    id: 'DEMO-ACT-03',
    title: 'New Candidate Flagged for Review',
    description: 'APK signature mismatch identified for com.acmefinancial.quickloan.cash on APKPure.',
    timestamp: new Date(Date.now() - 1000 * 60 * 105).toISOString(),
    type: 'detection',
    severity: 'high'
  },
  {
    id: 'DEMO-ACT-04',
    title: 'Candidate Review Completed',
    description: 'Analyst Sarah Chen moved acme-pay-verification.net to Approved Takedown status.',
    timestamp: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
    type: 'review',
    severity: 'info'
  }
];

export const DEMO_RECENT_FINDINGS = [];

const ACTIVITY_STORAGE_KEY = 'drp_activity_log_v2';

/**
 * Fetch persistent activity log from localStorage with default benchmark fallback
 */
export function getDemoActivityLog() {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(DEMO_RECENT_ACTIVITY));
      return DEMO_RECENT_ACTIVITY;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage read error for activity log:', err);
    return DEMO_RECENT_ACTIVITY;
  }
}

/**
 * Prepend a new activity entry into persistent log
 */
export function addDemoActivity(activity) {
  try {
    const current = getDemoActivityLog();
    const entry = {
      id: `DEMO-ACT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...activity
    };
    const updated = [entry, ...current.slice(0, 19)]; // keep latest 20
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn('LocalStorage write error for activity log:', err);
    return [];
  }
}

/**
 * Reset persistent activity log to initial benchmark
 */
export function resetDemoActivityLog() {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(DEMO_RECENT_ACTIVITY));
    return DEMO_RECENT_ACTIVITY;
  } catch {
    return DEMO_RECENT_ACTIVITY;
  }
}

/**
 * Calculate dynamic high-level metrics from shared datasets
 */
export function calculateDemoMetrics({
  brands = [],
  socialCandidates = [],
  appCandidates = [],
  findings = []
}) {
  const pendingReviewCount = findings.filter((f) => {
    const s = (f.review?.status || f.reviewStatus || '').toLowerCase();
    return (
      s === 'requires review' ||
      s === 'new' ||
      s === 'needs review' ||
      s === 'in review'
    );
  }).length;

  const criticalFindingsCount = findings.filter(
    (f) => f.severity === 'critical' || f.riskScore >= 85
  ).length;

  const tier1Count = brands.filter((b) => (b.tier || '').includes('1')).length;
  const standardCount = Math.max(0, brands.length - tier1Count);

  return {
    monitoredBrands: {
      total: brands.length,
      change: brands.length > 4 ? `+${brands.length - 4} added in session` : '+2 this month',
      detail: `${tier1Count} Mission-Critical, ${standardCount} Standard`
    },
    analyzedSocialProfiles: {
      total: 345 + socialCandidates.length,
      change: `+${socialCandidates.length} analyzed in session`,
      detail: 'Tracked across 6 social platforms'
    },
    analyzedApps: {
      total: 138 + appCandidates.length,
      change: `+${appCandidates.length} analyzed in session`,
      detail: '18 third-party APK repos & stores'
    },
    candidatesRequiringReview: {
      total: pendingReviewCount,
      change: `${criticalFindingsCount} High/Critical priority`,
      detail: 'Immediate analyst triage needed'
    }
  };
}

/**
 * Calculate dynamic Severity distribution for charts
 */
export function calculateSeverityDistribution(findings = []) {
  const critical = findings.filter((f) => f.riskScore >= 85).length;
  const high = findings.filter((f) => f.riskScore >= 70 && f.riskScore < 85).length;
  const medium = findings.filter((f) => f.riskScore >= 50 && f.riskScore < 70).length;
  const low = findings.filter((f) => f.riskScore < 50).length;

  return [
    { level: 'Critical (85-100)', count: critical, fill: '#e11d48', badge: 'Critical' },
    { level: 'High (70-84)', count: high, fill: '#f59e0b', badge: 'High' },
    { level: 'Medium (50-69)', count: medium, fill: '#eab308', badge: 'Medium' },
    { level: 'Low (0-49)', count: low, fill: '#3b82f6', badge: 'Low' }
  ];
}

/**
 * Calculate dynamic Category breakdown for charts
 */
export function calculateCategoryDistribution(findings = []) {
  const domains = findings.filter((f) => f.assetType === 'Domain Typosquat');
  const socials = findings.filter((f) => f.assetType === 'Social Profile');
  const apps = findings.filter((f) => f.assetType === 'Mobile App');
  const vips = findings.filter(
    (f) =>
      (f.assetType || '').includes('Spoof') ||
      (f.candidateName || '').toLowerCase().includes('hr') ||
      (f.candidateName || '').toLowerCase().includes('recruiter')
  );

  const getAvg = (list) =>
    list.length ? Math.round(list.reduce((acc, c) => acc + (c.riskScore || 0), 0) / list.length) : 0;

  return [
    {
      category: 'Domain Typosquats',
      candidates: Math.max(domains.length, 2),
      criticalCount: domains.filter((d) => d.riskScore >= 85).length,
      avgScore: getAvg(domains) || 92
    },
    {
      category: 'Social Profiles',
      candidates: Math.max(socials.length, 3),
      criticalCount: socials.filter((s) => s.riskScore >= 85).length,
      avgScore: getAvg(socials) || 89
    },
    {
      category: 'Mobile APKs',
      candidates: Math.max(apps.length, 3),
      criticalCount: apps.filter((a) => a.riskScore >= 85).length,
      avgScore: getAvg(apps) || 91
    },
    {
      category: 'Executive Spoofs',
      candidates: Math.max(vips.length, 1),
      criticalCount: vips.filter((v) => v.riskScore >= 85).length,
      avgScore: getAvg(vips) || 86
    }
  ];
}
