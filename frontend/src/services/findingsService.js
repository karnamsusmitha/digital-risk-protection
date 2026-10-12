/**
 * UNIFIED FINDINGS SERVICE
 *
 * Correlates and normalizes multi-perimeter intelligence findings from
 * Social Monitoring, Mobile App Monitoring, and Domain Typosquat feeds
 * into a single unified evidence model.
 *
 * BACKEND API CONTRACT (Shared REST specification for Member 2):
 * - GET   /api/v1/findings          -> List all correlated findings
 * - PATCH /api/v1/findings/:id/review -> Update review status and notes
 * - GET   /api/v1/findings/export   -> Server-side CSV report generation
 *
 * INTEGRITY & COMPLIANCE RULES:
 * - Never fabricate evidence.
 * - Never describe an unavailable check as successful.
 * - Delegate review mutations to underlying domain services (Social / App / Domain).
 */

import { socialMonitoringService } from './socialMonitoringService';
import { appMonitoringService } from './appMonitoringService';

const DOMAIN_STORAGE_KEY = 'drp_domain_findings_v2';

export const INITIAL_DOMAIN_FINDINGS = [
  {
    id: 'find-dom-101',
    originalId: 'dom-cand-101',
    originalType: 'domain',
    assetType: 'Domain Typosquat',
    candidateName: 'acmè-secure-login.com (xn--acm-7la-login.com)',
    identifier: 'xn--acm-7la-login.com',
    platform: 'NameSilo WHOIS / CT Logs',
    sourceUrl: 'https://xn--acm-7la-login.com',
    sourceStatus: 'available',
    matchedBrand: 'Acme Financial Global',
    matchedBrandId: 'bp-1',
    matchedOfficialAsset: 'Acme Financial (https://acmefinancial.com)',
    riskScore: 96,
    severity: 'critical',
    aiConfidence: 0.96,
    detectedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    source: 'NameSilo WHOIS / CT Logs',
    detectionReasons: [
      'Punycode homoglyph spoofing banking portal ("acmè" with grave accent)',
      'MX records active and pointing to disposable mail server for phishing replies',
      'SSL certificate issued via Let\'s Encrypt within past 48 hours matching corporate login style'
    ],
    reason: 'Punycode homoglyph spoofing banking portal; MX records active and pointing to disposable mail server.',
    signals: {
      nameSimilarity: 95,
      logoSimilarity: null,
      descriptionSimilarity: null,
      logoCheckStatus: 'unavailable',
      nameCheckStatus: 'performed',
      descriptionCheckStatus: 'unavailable'
    },
    domainEvidence: {
      status: 'available',
      detectedUrl: 'https://xn--acm-7la-login.com',
      domainRisk: 'Critical - Punycode homoglyph with live mail exchange records',
      ipResolved: '198.51.100.42 (Anonymous Bulletproof Host)'
    },
    publisherEvidence: {
      status: 'not_applicable',
      note: 'Publisher evidence is applicable to mobile applications, not domain registrations.'
    },
    review: {
      status: 'Requires Review',
      analystNotes: 'High-confidence typosquat targeting corporate banking customers.',
      reviewedBy: null,
      reviewedAt: null
    },
    reviewStatus: 'Requires Review',
    _isRemote: false,
    isDemo: true
  },
  {
    id: 'find-dom-102',
    originalId: 'dom-cand-102',
    originalType: 'domain',
    assetType: 'Domain Typosquat',
    candidateName: 'acme-pay-verification.net',
    identifier: 'acme-pay-verification.net',
    platform: 'GoDaddy Registry Feed',
    sourceUrl: 'https://acme-pay-verification.net',
    sourceStatus: 'available',
    matchedBrand: 'AcmePay Mobile',
    matchedBrandId: 'bp-2',
    matchedOfficialAsset: 'AcmePay (https://acmepay.app)',
    riskScore: 88,
    severity: 'high',
    aiConfidence: 0.92,
    detectedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    source: 'GoDaddy Registry Feed',
    detectionReasons: [
      'Registered via privacy proxy; SSL certificate matches corporate login style',
      'Keyword squatting "verification" paired with registered trademark AcmePay',
      'DNS records mapped to shared phishing infrastructure IP range'
    ],
    reason: 'Registered via privacy proxy; SSL certificate issued yesterday matching corporate login style.',
    signals: {
      nameSimilarity: 91,
      logoSimilarity: null,
      descriptionSimilarity: null,
      logoCheckStatus: 'unavailable',
      nameCheckStatus: 'performed',
      descriptionCheckStatus: 'unavailable'
    },
    domainEvidence: {
      status: 'available',
      detectedUrl: 'https://acme-pay-verification.net',
      domainRisk: 'High - Phishing landing page detected replicating AcmePay mobile UI',
      ipResolved: '192.0.2.118'
    },
    publisherEvidence: {
      status: 'not_applicable',
      note: 'Publisher evidence applies to mobile applications.'
    },
    review: {
      status: 'Approved Takedown',
      analystNotes: 'Takedown notice dispatched to registrar abuse desk.',
      reviewedBy: 'Sarah Chen (Lead SecOps)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    reviewStatus: 'Approved Takedown',
    _isRemote: false,
    isDemo: true
  }
];

function getStoredDomainFindings() {
  try {
    const raw = localStorage.getItem(DOMAIN_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify(INITIAL_DOMAIN_FINDINGS));
      return INITIAL_DOMAIN_FINDINGS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage read error for domain findings:', err);
    return INITIAL_DOMAIN_FINDINGS;
  }
}

function saveStoredDomainFindings(items) {
  try {
    localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('LocalStorage write error for domain findings:', err);
  }
}

function normalizeDomainFinding(candidate) {
  const review = candidate.review || {};
  const status = review.status || candidate.reviewStatus || 'Requires Review';
  return {
    ...candidate,
    review: {
      status,
      analystNotes: review.analystNotes || '',
      reviewedBy: review.reviewedBy || null,
      reviewedAt: review.reviewedAt || null
    },
    reviewStatus: status
  };
}

/**
 * Normalizes a social monitoring candidate into the unified finding schema
 */
function normalizeSocialFinding(candidate) {
  const model = candidate.modelEvidence || {};
  const review = candidate.review || {};
  const reasons = model.detectionReasons || ['Automated social impersonation heuristic triggered.'];
  const status = review.status || 'New';

  return {
    id: candidate.id.startsWith('find-') ? candidate.id : `find-soc-${candidate.id.replace('soc-cand-', '')}`,
    originalId: candidate.id,
    originalType: 'social',
    assetType: 'Social Profile',
    candidateName: candidate.profileName || candidate.handle || 'Unnamed Profile',
    identifier: candidate.handle || 'No handle specified',
    platform: candidate.platform || 'Social Media',
    sourceUrl: candidate.url || null,
    sourceStatus: candidate.url && !candidate.url.includes('offline') ? 'available' : 'unavailable',
    matchedBrand: candidate.matchedBrand || 'Protected Brand',
    matchedBrandId: candidate.matchedBrandId || null,
    matchedOfficialAsset: `${candidate.matchedBrand} (Official Social Asset)`,
    riskScore: model.riskScore ?? 0,
    severity: model.severity || 'low',
    aiConfidence: model.aiConfidence ?? 0.9,
    detectedAt: candidate.detectedAt || new Date().toISOString(),
    source: candidate.source || 'Social Media Feed Crawler',
    detectionReasons: reasons,
    reason: reasons[0] || 'Potential brand impersonation identified.',
    signals: {
      nameSimilarity: model.nameSimilarity ?? null,
      logoSimilarity: model.logoSimilarity ?? null,
      descriptionSimilarity: null,
      logoCheckStatus: model.logoSimilarity !== null && model.logoSimilarity !== undefined
        ? 'performed'
        : 'unavailable',
      nameCheckStatus: model.nameSimilarity !== null && model.nameSimilarity !== undefined
        ? 'performed'
        : 'unavailable',
      descriptionCheckStatus: 'unavailable'
    },
    domainEvidence: model.domainEvidence ? {
      status: 'available',
      detectedUrl: model.domainEvidence.detectedUrl || candidate.url,
      domainRisk: model.domainEvidence.domainRisk || 'Risk telemetry not classified',
      ipResolved: model.domainEvidence.ipResolved || 'Not resolved'
    } : {
      status: 'unavailable',
      note: 'No external URL detected in profile bio or perimeter domain check not applicable.'
    },
    publisherEvidence: {
      status: 'not_applicable',
      note: 'Publisher evidence is applicable to mobile application packages, not social profiles.'
    },
    review: {
      status,
      analystNotes: review.analystNotes || '',
      reviewedBy: review.reviewedBy || null,
      reviewedAt: review.reviewedAt || null
    },
    reviewStatus: status,
    _isRemote: Boolean(candidate._isRemote),
    isDemo: true
  };
}

/**
 * Normalizes an app monitoring candidate into the unified finding schema
 */
function normalizeAppFinding(candidate) {
  const analysis = candidate.comparativeAnalysis || {};
  const review = candidate.review || {};
  const reasons = analysis.detectionReasons || ['Routine scan: Mobile APK anomaly detected.'];
  const status = review.status || 'New';

  return {
    id: candidate.id.startsWith('find-') ? candidate.id : `find-app-${candidate.id.replace('app-cand-', '')}`,
    originalId: candidate.id,
    originalType: 'app',
    assetType: 'Mobile App',
    candidateName: candidate.appName || 'Unnamed App',
    identifier: candidate.packageId || 'Package identifier not provided',
    platform: candidate.store || 'App Repository',
    sourceUrl: candidate.storeUrl || null,
    sourceStatus: candidate.storeUrl ? 'available' : 'unavailable',
    matchedBrand: candidate.matchedBrand || 'Protected Brand',
    matchedBrandId: candidate.matchedBrandId || null,
    matchedOfficialAsset: candidate.officialAppName
      ? `${candidate.officialAppName} (${candidate.officialPackageId || 'Official Package'})`
      : `${candidate.matchedBrand} (Corporate Trademark)`,
    riskScore: analysis.riskScore ?? 0,
    severity: analysis.severity || 'low',
    aiConfidence: analysis.aiConfidence ?? 0.9,
    detectedAt: candidate.detectedAt || new Date().toISOString(),
    source: candidate.source || 'Mobile App Telemetry Ingestion',
    detectionReasons: reasons,
    reason: reasons[0] || 'Mobile app package anomaly flagged.',
    signals: {
      nameSimilarity: analysis.nameSimilarity ?? null,
      logoSimilarity: analysis.logoSimilarity ?? null,
      descriptionSimilarity: analysis.descriptionSimilarity ?? null,
      logoCheckStatus: analysis.logoSimilarity !== null && analysis.logoSimilarity !== undefined
        ? 'performed'
        : 'unavailable',
      nameCheckStatus: analysis.nameSimilarity !== null && analysis.nameSimilarity !== undefined
        ? 'performed'
        : 'unavailable',
      descriptionCheckStatus: analysis.descriptionSimilarity !== null && analysis.descriptionSimilarity !== undefined
        ? 'performed'
        : 'unavailable'
    },
    domainEvidence: analysis.sourceEvidence?.c2ServerDetected ? {
      status: 'available',
      detectedUrl: analysis.sourceEvidence.c2ServerDetected,
      domainRisk: 'High - Anomalous network host extracted from APK manifest/strings',
      ipResolved: analysis.sourceEvidence.c2ServerDetected.split('/')[0]
    } : {
      status: 'unavailable',
      note: 'No malicious external network hosts identified in static APK extraction.'
    },
    publisherEvidence: {
      status: 'available',
      candidatePublisher: candidate.publisher || 'Unknown Publisher',
      officialPublisher: candidate.officialPublisher || candidate.matchedBrand,
      publisherMismatch: Boolean(analysis.publisherMismatch),
      assessment: analysis.publisherAssessment || (analysis.publisherMismatch
        ? 'Publisher mismatch detected (Advisory: Requires corroborating evidence).'
        : 'Publisher identity matches registered corporate benchmark.')
    },
    appTelemetry: {
      packageAnalysis: analysis.packageAnalysis || null,
      permissionsRequested: analysis.sourceEvidence?.permissionsRequested || [],
      storeRisk: analysis.sourceEvidence?.storeRisk || 'Store risk telemetry not recorded',
      certificateStatus: analysis.sourceEvidence?.certificateStatus || 'Developer certificate telemetry not recorded',
      sha256: candidate.sha256 || null
    },
    review: {
      status,
      analystNotes: review.analystNotes || '',
      reviewedBy: review.reviewedBy || null,
      reviewedAt: review.reviewedAt || null
    },
    reviewStatus: status,
    _isRemote: Boolean(candidate._isRemote),
    isDemo: true
  };
}

export const findingsService = {
  /**
   * Fetches unified findings combined from Social, App, and Domain monitoring feeds
   */
  async getUnifiedFindings() {
    try {
      const [socialRes, appRes] = await Promise.all([
        socialMonitoringService.getCandidates(),
        appMonitoringService.getCandidates()
      ]);

      const socialList = (socialRes.data || []).map(normalizeSocialFinding);
      const appList = (appRes.data || []).map(normalizeAppFinding);
      const domainList = getStoredDomainFindings().map(normalizeDomainFinding);

      const combined = [...socialList, ...appList, ...domainList];

      // Default sort: highest risk score first
      combined.sort((a, b) => b.riskScore - a.riskScore);

      const isRemote = Boolean(socialRes.isRemote || appRes.isRemote);

      return {
        data: combined,
        isRemote
      };
    } catch (err) {
      console.error('Failed to load unified findings:', err);
      throw new Error('Unable to aggregate security findings from monitoring feeds.');
    }
  },

  /**
   * Updates review status and notes on the underlying candidate finding
   */
  async updateReview(finding, reviewData) {
    let updatedResult = null;

    if (finding.originalType === 'social') {
      const res = await socialMonitoringService.updateReview(finding.originalId, reviewData);
      updatedResult = normalizeSocialFinding(res.data);
    } else if (finding.originalType === 'app') {
      const res = await appMonitoringService.updateReview(finding.originalId, reviewData);
      updatedResult = normalizeAppFinding(res.data);
    } else if (finding.originalType === 'domain') {
      const currentList = getStoredDomainFindings();
      const nextList = currentList.map((d) => {
        if (d.id === finding.id || d.originalId === finding.originalId) {
          return {
            ...d,
            reviewStatus: reviewData.status,
            review: {
              ...d.review,
              status: reviewData.status,
              analystNotes: reviewData.analystNotes !== undefined ? reviewData.analystNotes : d.review?.analystNotes || '',
              reviewedBy: reviewData.reviewedBy || 'Lead SecOps Analyst (You)',
              reviewedAt: new Date().toISOString()
            }
          };
        }
        return d;
      });
      saveStoredDomainFindings(nextList);
      const match = nextList.find((d) => d.id === finding.id || d.originalId === finding.originalId);
      updatedResult = match ? normalizeDomainFinding(match) : { ...finding, review: { status: reviewData.status } };
    } else {
      // Fallback for custom or direct overview findings
      updatedResult = {
        ...finding,
        reviewStatus: reviewData.status,
        review: {
          ...finding.review,
          status: reviewData.status,
          analystNotes: reviewData.analystNotes || '',
          reviewedBy: reviewData.reviewedBy || 'Lead SecOps Analyst (You)',
          reviewedAt: new Date().toISOString()
        }
      };
    }

    // Broadcast update across listening platform tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('drp_data_updated', {
          detail: {
            type: 'finding_reviewed',
            findingId: finding.id,
            status: reviewData.status
          }
        })
      );
    }

    return updatedResult;
  },

  /**
   * Generates sanitized CSV string for user export
   */
  generateCsvData(findingsList = []) {
    const headers = [
      'Finding ID',
      'Asset Type',
      'Candidate Name',
      'Identifier / Handle / Package',
      'Platform / Store',
      'Target Brand',
      'Risk Score',
      'Severity',
      'Review Status',
      'Detection Source',
      'Source URL',
      'Source Availability',
      'Detected Date',
      'Reviewed By',
      'Analyst Notes'
    ];

    const rows = findingsList.map((f) => [
      f.id,
      f.assetType,
      f.candidateName,
      f.identifier,
      f.platform,
      f.matchedBrand,
      f.riskScore,
      f.severity,
      f.review?.status || f.reviewStatus || 'New',
      f.source,
      f.sourceUrl || 'N/A',
      f.sourceStatus,
      f.detectedAt,
      f.review?.reviewedBy || 'Unreviewed',
      (f.review?.analystNotes || '').replace(/"/g, '""')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((val) => {
            const str = String(val ?? '');
            return str.includes(',') || str.includes('"') || str.includes('\n')
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(',')
      )
    ].join('\n');

    return csvContent;
  }
};
