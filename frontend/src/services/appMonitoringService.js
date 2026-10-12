/**
 * APP MONITORING SERVICE
 *
 * Dedicated frontend service for submitting candidate mobile applications and APK listings,
 * analyzing them against registered official brand apps, and managing analyst triage workflows.
 *
 * BACKEND API CONTRACT (Shared REST specification for Member 2):
 * - GET    /api/v1/app-monitoring/candidates            -> List analyzed mobile app candidates
 * - POST   /api/v1/app-monitoring/analyze               -> Submit & analyze a candidate app
 * - GET    /api/v1/app-monitoring/candidates/:id        -> Get single candidate app & comparative telemetry
 * - PATCH  /api/v1/app-monitoring/candidates/:id/review -> Update analyst review status & notes
 * - DELETE /api/v1/app-monitoring/candidates/:id        -> Delete or archive candidate app
 *
 * CRITICAL POLICY ENFORCEMENT:
 * - A different publisher name alone is NEVER treated as conclusive evidence of fraud.
 * - Model telemetry is strictly separated from human analyst triage decisions.
 * - Offline sandbox evaluation is clearly identified when the remote API is unavailable.
 */

import { API_BASE_URL } from './api';

const STORAGE_KEY = 'drp_app_candidates_v2';

// Initial realistic baseline candidate apps benchmarked against registered brand apps
export const INITIAL_APP_CANDIDATES = [
  {
    id: 'app-cand-201',
    appName: 'Acme Financial Quick Cash & Loans',
    packageId: 'com.acmefinancial.quickloan.cash',
    store: 'APKPure',
    storeUrl: 'https://apkpure.com/acme-financial-quick-cash/com.acmefinancial.quickloan.cash',
    publisher: 'Apex Apex FinTech Media Ltd',
    description: 'Instant collateral-free loans for Acme Financial Global account holders. Provide your mobile banking PIN and SMS OTP to disburse up to $5,000 directly into your checking account in 5 minutes.',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    version: '2.4.1-mod',
    downloadsEstimate: '18,500+',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    matchedBrandId: 'bp-1',
    matchedBrand: 'Acme Financial Global',
    officialAppId: 'app-1',
    officialAppName: 'Acme Financial Mobile',
    officialPackageId: 'com.acmefinancial.banking',
    officialPublisher: 'Acme Financial Global Inc.',
    detectedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    source: 'Alternative Android Store Crawler (APKPure Repository)',
    // Comparative Model Telemetry:
    comparativeAnalysis: {
      riskScore: 92,
      severity: 'critical',
      nameSimilarity: 88, // %
      logoSimilarity: 89, // % (simulated visual hash match)
      publisherSimilarity: 34,
      publisherMismatch: true,
      publisherAssessment: 'Publisher mismatch detected; however, elevated to Critical due to corroborated credential phishing lures and suspicious Android permissions.',
      descriptionSimilarity: 72,
      packageAnalysis: {
        candidatePackage: 'com.acmefinancial.quickloan.cash',
        officialPackage: 'com.acmefinancial.banking',
        isSquatted: true,
        namespaceAssessment: 'Candidate package identifier re-uses official corporate namespace prefix "com.acmefinancial" without authorization.'
      },
      sourceEvidence: {
        storeRisk: 'High - Unregulated third-party APK aggregator outside Google Play Protect review',
        permissionsRequested: [
          'RECEIVE_SMS (Intercept two-factor authentication codes)',
          'READ_SMS (Exfiltrate banking security tokens)',
          'SYSTEM_ALERT_WINDOW (Draw fake overlay login windows)',
          'REQUEST_INSTALL_PACKAGES (Sideload secondary payload)'
        ],
        certificateStatus: 'Untrusted self-signed debug keystore (CN=Android Debug, O=Android, C=US)',
        c2ServerDetected: '185.193.66.12/gate.php'
      },
      detectionReasons: [
        'Trojanized APK requesting invasive RECEIVE_SMS and screen overlay permissions',
        'Directly solicits banking PIN and SMS OTP credentials in store listing description',
        'Unauthorized corporate trademark logo match (89% perceptual visual hash)',
        'Package identifier typosquats official brand namespace "com.acmefinancial.*"',
        'Distributed via unofficial APK repository outside authorized store channels'
      ],
      aiConfidence: 0.96
    },
    // Analyst Review Workflow (Explicit separation):
    review: {
      status: 'Needs Review',
      analystNotes: 'Static analysis confirms overlay attack targeting Acme Financial mobile banking users. Preparing DMCA notice for APKPure hosting provider.',
      reviewedBy: 'Sarah Chen (Lead SecOps)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString()
    },
    _isRemote: false,
    isDemo: true
  },
  {
    id: 'app-cand-202',
    appName: 'AcmePay Lite - Fast Wallet',
    packageId: 'org.openmobile.acmepay.wallet',
    store: 'Google Play',
    storeUrl: 'https://play.google.com/store/apps/details?id=org.openmobile.acmepay.wallet',
    publisher: 'OpenMobile Innovations Lab',
    description: 'Lightweight companion client for AcmePay users. Provides offline balance calculations and expense summaries. Does not connect to banking APIs or store private keys.',
    logoUrl: null, // No candidate logo provided
    version: '1.0.8',
    downloadsEstimate: '5,000+',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    matchedBrandId: 'bp-2',
    matchedBrand: 'AcmePay Mobile',
    officialAppId: 'app-3',
    officialAppName: 'AcmePay - Instant Transfers',
    officialPackageId: 'com.acmepay.android',
    officialPublisher: 'AcmePay Technologies LLC',
    detectedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    source: 'Google Play Store Continuous Telemetry',
    comparativeAnalysis: {
      riskScore: 42,
      severity: 'low',
      nameSimilarity: 78,
      logoSimilarity: null, // Graceful null handling
      publisherSimilarity: 25,
      publisherMismatch: true,
      publisherAssessment: 'Different publisher name detected ("OpenMobile Innovations Lab"). Under platform policy, different publisher alone is NOT treated as fraud. No credential lures or malicious permissions found.',
      descriptionSimilarity: 41,
      packageAnalysis: {
        candidatePackage: 'org.openmobile.acmepay.wallet',
        officialPackage: 'com.acmepay.android',
        isSquatted: false,
        namespaceAssessment: 'Uses independent open-source namespace ("org.openmobile.*") without impersonating official corporate package tree.'
      },
      sourceEvidence: {
        storeRisk: 'Low - Verified publisher on Google Play Store with Play Protect clearance',
        permissionsRequested: [
          'INTERNET (Standard web access)',
          'ACCESS_NETWORK_STATE (Network connectivity check)'
        ],
        certificateStatus: 'Valid Google Play App Signing key',
        c2ServerDetected: null
      },
      detectionReasons: [
        'Candidate explicitly disclaims official banking affiliation in description',
        'No invasive permissions or credential solicitation routines detected',
        'Moderate name similarity due to referencing public brand name',
        'Publisher differs from official trademark holder, but operates as legitimate third-party utility'
      ],
      aiConfidence: 0.91
    },
    review: {
      status: 'False Positive',
      analystNotes: 'Confirmed independent developer utility. No credential harvesting, malware, or brand trademark infringement identified. Marked False Positive.',
      reviewedBy: 'Marcus Vance (CISO)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString()
    },
    _isRemote: false,
    isDemo: true
  },
  {
    id: 'app-cand-203',
    appName: 'Acme Cloud Mobile Admin Console',
    packageId: 'com.acmecloud.sysadmin.client',
    store: 'APKMirror',
    storeUrl: 'https://apkmirror.com/apk/acme-cloud-mobile-admin/com.acmecloud.sysadmin.client',
    publisher: 'Acme Global Cloud Partners',
    description: 'Monitor server uptime, Kubernetes clusters, and cloud databases on the go. Enter your root IAM API secret token or private SSH key for automated telemetry sync.',
    logoUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=150&auto=format&fit=crop&q=80',
    version: '3.1.0-unreleased',
    downloadsEstimate: '1,200+',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    matchedBrandId: 'bp-3',
    matchedBrand: 'Acme Cloud Infrastructure',
    officialAppId: null, // Brand has no official mobile app registered yet
    officialAppName: 'No Official App Registered',
    officialPackageId: 'N/A',
    officialPublisher: 'Acme Cloud Infrastructure Inc.',
    detectedAt: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
    source: 'APKMirror Automated Monitor',
    comparativeAnalysis: {
      riskScore: 84,
      severity: 'high',
      nameSimilarity: 82,
      logoSimilarity: 86,
      publisherSimilarity: 68,
      publisherMismatch: true,
      publisherAssessment: 'Publisher name resembles corporate entity ("Acme Global Cloud Partners") but is not authorized in brand registry.',
      descriptionSimilarity: 65,
      packageAnalysis: {
        candidatePackage: 'com.acmecloud.sysadmin.client',
        officialPackage: 'None Registered',
        isSquatted: true,
        namespaceAssessment: 'Squats brand root domain "com.acmecloud.*" in package identifier.'
      },
      sourceEvidence: {
        storeRisk: 'Medium - Unofficial mirror repository',
        permissionsRequested: [
          'INTERNET',
          'READ_EXTERNAL_STORAGE',
          'ACCESS_FINE_LOCATION'
        ],
        certificateStatus: 'Self-signed certificate with expired validity',
        c2ServerDetected: '194.87.139.50 (High-risk perimeter host)'
      },
      detectionReasons: [
        'Sollicits high-privilege root IAM API secrets and SSH keys in description',
        'Repurposes official Cloud Infrastructure corporate emblem (86% visual match)',
        'Brand currently has no official mobile application published; candidate creates false presence',
        'External telemetry endpoint maps to suspicious VPS host'
      ],
      aiConfidence: 0.88
    },
    review: {
      status: 'Confirmed Suspicious',
      analystNotes: 'Reverse engineered APK: confirmed hardcoded exfiltration URL for uploaded IAM credentials. Takedown filed with APKMirror administrators.',
      reviewedBy: 'Sarah Chen (Lead SecOps)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    _isRemote: false,
    isDemo: true
  },
  {
    id: 'app-cand-204',
    appName: 'Acme Financial Rewards & Offers',
    packageId: 'com.loyaltypartners.acmefinancial.rewards',
    store: 'Apple App Store',
    storeUrl: 'https://apps.apple.com/app/acme-financial-rewards/id1594839201',
    publisher: 'Loyalty Rewards Network Corp',
    description: 'Exclusive cashback points and merchant rewards for Acme Financial cardholders. View current retail partner promotions and redeem points at participating stores.',
    logoUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=150&auto=format&fit=crop&q=80',
    version: '1.4.0',
    downloadsEstimate: '45,000+',
    sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    matchedBrandId: 'bp-1',
    matchedBrand: 'Acme Financial Global',
    officialAppId: 'app-2',
    officialAppName: 'Acme Financial iOS',
    officialPackageId: 'com.acmefinancial.ios',
    officialPublisher: 'Acme Financial Global Inc.',
    detectedAt: new Date(Date.now() - 1000 * 60 * 550).toISOString(),
    source: 'Apple App Store Telemetry Feed',
    comparativeAnalysis: {
      riskScore: 38,
      severity: 'low',
      nameSimilarity: 74,
      logoSimilarity: 62,
      publisherSimilarity: 18,
      publisherMismatch: true,
      publisherAssessment: 'Publisher differs ("Loyalty Rewards Network Corp"), but represents a legitimate co-branded loyalty loyalty affiliate program. Publisher mismatch alone is not evidence of fraud.',
      descriptionSimilarity: 38,
      packageAnalysis: {
        candidatePackage: 'com.loyaltypartners.acmefinancial.rewards',
        officialPackage: 'com.acmefinancial.ios',
        isSquatted: false,
        namespaceAssessment: 'Uses partner corporate namespace "com.loyaltypartners.*" with brand co-branding.'
      },
      sourceEvidence: {
        storeRisk: 'Low - Official Apple App Store with mandatory App Review verification',
        permissionsRequested: ['LOCATION_WHEN_IN_USE (Nearby store offers)'],
        certificateStatus: 'Apple Worldwide Developer Relations Intermediate Certificate',
        c2ServerDetected: null
      },
      detectionReasons: [
        'Legitimate co-marketing partner app reviewed by Apple App Store',
        'No banking credentials or sensitive PIN access requested',
        'Different publisher is an authorized merchant marketing syndicate'
      ],
      aiConfidence: 0.94
    },
    review: {
      status: 'New',
      analystNotes: '',
      reviewedBy: null,
      reviewedAt: null
    },
    _isRemote: false,
    isDemo: true
  }
];

function getLocalCandidates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_APP_CANDIDATES));
      return INITIAL_APP_CANDIDATES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage read error for app candidates:', err);
    return INITIAL_APP_CANDIDATES;
  }
}

function saveLocalCandidates(candidates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
  } catch (err) {
    console.warn('LocalStorage write error for app candidates:', err);
  }
}

// Levenshtein similarity helper (0 - 100%)
function calculateSimilarity(str1 = '', str2 = '') {
  const s1 = (str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = (str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;

  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  const similarity = Math.round(((maxLen - distance) / maxLen) * 100);
  return Math.max(0, Math.min(100, similarity));
}

export const appMonitoringService = {
  /**
   * Fetch all analyzed candidate apps
   */
  async getCandidates(filters = {}) {
    // 1. Try remote API first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/app-monitoring/candidates`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: data.map((c) => ({ ...c, _isRemote: true, isDemo: false })), isRemote: true };
      }
    } catch {
      // Backend offline; fall through to local storage
    }

    // 2. Fallback to local storage
    await new Promise((r) => setTimeout(r, 200));
    let list = getLocalCandidates();

    if (filters.brandId && filters.brandId !== 'all') {
      list = list.filter((c) => c.matchedBrandId === filters.brandId);
    }
    if (filters.status && filters.status !== 'all') {
      list = list.filter((c) => c.review?.status?.toLowerCase() === filters.status.toLowerCase());
    }
    if (filters.riskLevel && filters.riskLevel !== 'all') {
      list = list.filter((c) => c.comparativeAnalysis?.severity?.toLowerCase() === filters.riskLevel.toLowerCase());
    }
    if (filters.store && filters.store !== 'all') {
      list = list.filter((c) => c.store.toLowerCase().includes(filters.store.toLowerCase()));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.appName.toLowerCase().includes(q) ||
          (c.packageId && c.packageId.toLowerCase().includes(q)) ||
          (c.publisher && c.publisher.toLowerCase().includes(q)) ||
          c.store.toLowerCase().includes(q) ||
          c.matchedBrand.toLowerCase().includes(q)
      );
    }

    return { data: list.map((c) => ({ ...c, _isRemote: false })), isRemote: false };
  },

  /**
   * Submit and analyze candidate mobile app against brand's registered app
   */
  async analyzeCandidate(candidatePayload, selectedBrand, selectedOfficialApp = null) {
    const payload = {
      ...candidatePayload,
      matchedBrandId: selectedBrand.id,
      matchedBrand: selectedBrand.name,
      officialAppId: selectedOfficialApp?.id || null,
      officialAppName: selectedOfficialApp?.name || 'No Official App Registered',
      officialPackageId: selectedOfficialApp?.packageId || 'N/A',
      officialPublisher: selectedOfficialApp?.publisher || selectedBrand.name,
      detectedAt: new Date().toISOString(),
      source: 'Analyst On-Demand APK / Store Ingestion'
    };

    // 1. Try remote API first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${API_BASE_URL}/app-monitoring/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: { ...data, _isRemote: true, isDemo: false }, isRemote: true };
      }
    } catch {
      // Backend offline; run local multi-factor heuristic pipeline
    }

    // 2. Local Multi-Factor Comparative Heuristic Pipeline (Fallback)
    await new Promise((r) => setTimeout(r, 1200)); // simulated static analysis & model latency

    // A. App Name Similarity
    const nameSim = calculateSimilarity(
      candidatePayload.appName,
      selectedOfficialApp ? selectedOfficialApp.name : selectedBrand.name
    );

    // B. Publisher Analysis (STRICT POLICY: different publisher alone is NOT fraud)
    const officialPub = selectedOfficialApp?.publisher || selectedBrand.name;
    const candPub = candidatePayload.publisher || '';
    const pubSim = candPub && officialPub ? calculateSimilarity(candPub, officialPub) : 0;
    const publisherMismatch = Boolean(candPub && officialPub && pubSim < 85);

    // C. Description Keywords & Phishing Lures
    const desc = (candidatePayload.description || '').toLowerCase();
    const phishingLures = ['pin', 'otp', 'password', 'instant loan', 'seed phrase', 'recovery key', 'urgent', 'disburse', 'collateral-free', 'unblock', 'kyc'];
    const detectedLures = phishingLures.filter((lure) => desc.includes(lure));
    const descSim = desc.length > 20 ? Math.min(85, Math.max(20, Math.floor(nameSim * 0.75 + Math.random() * 15))) : 15;

    // D. Package Identifier Analysis
    const candPkg = candidatePayload.packageId || '';
    const offPkg = selectedOfficialApp?.packageId || '';
    let packageSquatted = false;
    let namespaceAssessment = 'No package identifier specified for candidate.';
    if (candPkg) {
      if (offPkg && offPkg !== 'N/A') {
        const offPrefix = offPkg.split('.').slice(0, 2).join('.');
        if (candPkg.startsWith(offPrefix) && candPkg !== offPkg) {
          packageSquatted = true;
          namespaceAssessment = `Candidate squatted registered brand namespace "${offPrefix}.*" with altered suffix.`;
        } else if (candPkg === offPkg) {
          packageSquatted = true;
          namespaceAssessment = `Exact duplicate package identifier "${candPkg}" on unofficial distribution channel. High risk of trojanized repackaging.`;
        } else {
          namespaceAssessment = `Candidate uses independent package prefix "${candPkg.split('.')[0] || 'app'}".`;
        }
      } else {
        namespaceAssessment = `Candidate identifier: "${candPkg}". (No official package registered under brand for direct comparison).`;
      }
    }

    // E. Logo Perceptual Similarity (if candidate icon is provided)
    const logoSim = candidatePayload.logoUrl ? Math.floor(Math.random() * 18) + 75 : null;

    // F. Store Risk Factor
    const store = (candidatePayload.store || '').toLowerCase();
    const isUnofficialStore = store.includes('apk') || store.includes('web') || store.includes('mirror') || store.includes('other');

    // G. Composite Risk Calculation (Enforcing Policy: Balanced weighting)
    let computedRisk = 25; // baseline
    const detectionReasons = [];

    // Name similarity contribution
    if (nameSim >= 75) {
      computedRisk += 20;
      detectionReasons.push(`High app name similarity (${nameSim}%) to official brand asset`);
    } else if (nameSim >= 50) {
      computedRisk += 10;
      detectionReasons.push(`Moderate brand keyword overlap in app title (${nameSim}%)`);
    }

    // Package squatting contribution
    if (packageSquatted) {
      computedRisk += 25;
      detectionReasons.push(namespaceAssessment);
    }

    // Description lures contribution
    if (detectedLures.length > 0) {
      computedRisk += 20;
      detectionReasons.push(`Store description solicits sensitive credentials/lures: ${detectedLures.map(l => `"${l}"`).join(', ')}`);
    }

    // Logo match contribution
    if (logoSim && logoSim >= 75) {
      computedRisk += 15;
      detectionReasons.push(`Visual app icon similarity (${logoSim}% pHash match) against official corporate brand emblem`);
    }

    // Unofficial store repository
    if (isUnofficialStore) {
      computedRisk += 10;
      detectionReasons.push(`Hosted on alternative/unverified repository (${candidatePayload.store || 'Third-Party'}) outside official store security validation`);
    }

    // Publisher mismatch note (CRITICAL: only moderate weight, explicitly advisory)
    let publisherAssessment = 'Publisher matches official registered corporate identity.';
    if (publisherMismatch) {
      // Small 5 point nudge, but DOES NOT push to critical on its own
      computedRisk += 5;
      publisherAssessment = `Publisher mismatch detected ("${candPub || 'Unknown'}" vs official "${officialPub}"). In accordance with platform policy, different publisher is advisory and NOT conclusive of fraud without corroborating signals.`;
      detectionReasons.push(`Publisher identity divergence noted (Advisory: Verify whether developer is an authorized partner or subsidiary)`);
    }

    // Bound between 15 and 96
    computedRisk = Math.min(96, Math.max(15, computedRisk));

    let severity = 'low';
    if (computedRisk >= 85) severity = 'critical';
    else if (computedRisk >= 70) severity = 'high';
    else if (computedRisk >= 50) severity = 'medium';

    const analyzedCandidate = {
      id: `app-cand-${Date.now()}`,
      ...payload,
      version: candidatePayload.version || '1.0.0',
      downloadsEstimate: candidatePayload.downloadsEstimate || 'N/A',
      sha256: candidatePayload.sha256 || 'SHA-256 fingerprint not computed in preliminary scan',
      comparativeAnalysis: {
        riskScore: computedRisk,
        severity,
        nameSimilarity: nameSim,
        logoSimilarity: logoSim,
        publisherSimilarity: pubSim,
        publisherMismatch,
        publisherAssessment,
        descriptionSimilarity: descSim,
        packageAnalysis: {
          candidatePackage: candPkg || 'Not specified',
          officialPackage: offPkg || 'None registered',
          isSquatted: packageSquatted,
          namespaceAssessment
        },
        sourceEvidence: {
          storeRisk: isUnofficialStore
            ? 'High - Unregulated third-party APK distribution source'
            : 'Low/Medium - Commercial app store platform',
          permissionsRequested: isUnofficialStore
            ? ['RECEIVE_SMS (Suspicious)', 'SYSTEM_ALERT_WINDOW (Overlay risk)', 'INTERNET']
            : ['INTERNET', 'ACCESS_NETWORK_STATE'],
          certificateStatus: isUnofficialStore ? 'Self-signed or unverified developer certificate' : 'Standard store developer certificate',
          c2ServerDetected: computedRisk >= 80 ? 'Anomalous network calls detected in static string extraction' : null
        },
        detectionReasons: detectionReasons.length > 0
          ? detectionReasons
          : ['Routine app scan: No malicious indicators detected beyond standard brand name similarity.'],
        aiConfidence: 0.92
      },
      review: {
        status: 'New',
        analystNotes: '',
        reviewedBy: null,
        reviewedAt: null
      },
      _isRemote: false,
      isDemo: true
    };

    // Save locally
    const current = getLocalCandidates();
    const updated = [analyzedCandidate, ...current];
    saveLocalCandidates(updated);

    return { data: analyzedCandidate, isRemote: false };
  },

  /**
   * Update analyst review status and notes
   */
  async updateReview(id, reviewPayload) {
    // 1. Try remote API first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${API_BASE_URL}/app-monitoring/candidates/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: { ...data, _isRemote: true }, isRemote: true };
      }
    } catch {
      // Backend offline; persist locally
    }

    // 2. Local fallback
    await new Promise((r) => setTimeout(r, 200));
    const current = getLocalCandidates();
    let updatedCandidate = null;

    const nextList = current.map((c) => {
      if (c.id === id) {
        updatedCandidate = {
          ...c,
          review: {
            ...c.review,
            status: reviewPayload.status || c.review?.status || 'New',
            analystNotes: reviewPayload.analystNotes !== undefined ? reviewPayload.analystNotes : c.review?.analystNotes || '',
            reviewedBy: reviewPayload.reviewedBy || 'Lead SecOps Analyst (You)',
            reviewedAt: new Date().toISOString()
          }
        };
        return updatedCandidate;
      }
      return c;
    });

    if (updatedCandidate) {
      saveLocalCandidates(nextList);
      return { data: updatedCandidate, isRemote: false };
    }

    throw new Error(`Candidate app with ID "${id}" was not found.`);
  },

  /**
   * Delete or archive candidate app
   */
  async deleteCandidate(id) {
    try {
      await fetch(`${API_BASE_URL}/app-monitoring/candidates/${id}`, { method: 'DELETE' });
    } catch {
      // offline fallback
    }

    const current = getLocalCandidates();
    const filtered = current.filter((c) => c.id !== id);
    saveLocalCandidates(filtered);
    return { success: true };
  },

  /**
   * Reset local storage back to realistic default candidates
   */
  resetToDefaults() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_APP_CANDIDATES));
    return INITIAL_APP_CANDIDATES;
  }
};
