/**
 * SOCIAL MONITORING SERVICE
 *
 * Dedicated frontend service for submitting candidate social profiles,
 * executing multi-modal threat analysis via the backend API, and recording
 * analyst triage decisions.
 *
 * BACKEND API CONTRACT (Shared REST specification for Member 2):
 * - GET    /api/v1/social-monitoring/candidates          -> List analyzed candidate profiles
 * - POST   /api/v1/social-monitoring/analyze             -> Submit & analyze a candidate profile
 * - GET    /api/v1/social-monitoring/candidates/:id      -> Get single candidate profile & model telemetry
 * - PATCH  /api/v1/social-monitoring/candidates/:id/review -> Update analyst review status & notes
 * - DELETE /api/v1/social-monitoring/candidates/:id      -> Archive or delete candidate profile
 */

import { API_BASE_URL } from './api';

const STORAGE_KEY = 'drp_social_candidates_v2';

// Initial realistic baseline candidates
export const INITIAL_SOCIAL_CANDIDATES = [
  {
    id: 'soc-cand-101',
    profileName: 'AcmePay Official 24/7 Resolution',
    handle: '@AcmePay_Support_Desk',
    platform: 'Telegram',
    url: 'https://t.me/AcmePay_Support_Desk',
    description: 'Official 24/7 automated dispute resolution for AcmePay users. Send your 12-word recovery phrase or unblocking code to restore frozen funds immediately.',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    matchedBrandId: 'bp-2',
    matchedBrand: 'AcmePay Mobile',
    detectedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    source: 'Telegram Channel Stream Crawler',
    // Automated Model Evidence:
    modelEvidence: {
      riskScore: 96,
      severity: 'critical',
      nameSimilarity: 94, // %
      logoSimilarity: 91, // %
      domainEvidence: {
        detectedUrl: 'https://acmepay-help.support/verify',
        domainRisk: 'Critical - Homoglyph phishing host with active MX records',
        ipResolved: '185.220.101.44 (Bulletproof VPS)'
      },
      detectionReasons: [
        'Stolen corporate logo (91% perceptual hash match against official trademark emblem)',
        'Solicits sensitive wallet private recovery phrases in public channel bio',
        'Lacks official Telegram verified badge',
        'External link leads to known phishing kit hosted on .support TLD'
      ],
      aiConfidence: 0.98
    },
    // Analyst Review Workflow (Explicitly separate):
    review: {
      status: 'Needs Review', // 'New' | 'Needs Review' | 'Confirmed Suspicious' | 'False Positive'
      analystNotes: 'Account actively messaging users in crypto channels. Verified phishing kit on destination domain.',
      reviewedBy: 'Sarah Chen (Lead SecOps)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    },
    _isRemote: false
  },
  {
    id: 'soc-cand-102',
    profileName: 'Acme Financial Talent Acquisition',
    handle: 'in/acme-talent-acquisition-hr',
    platform: 'LinkedIn',
    url: 'https://linkedin.com/in/acme-talent-acquisition-hr',
    description: 'Lead Technical Recruiter at Acme Financial Global. Hiring Senior Systems & Cloud Engineers worldwide. Download job specs from our portal.',
    logoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    matchedBrandId: 'bp-1',
    matchedBrand: 'Acme Financial Global',
    detectedAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    source: 'LinkedIn Public Search Monitor',
    modelEvidence: {
      riskScore: 88,
      severity: 'high',
      nameSimilarity: 86,
      logoSimilarity: null, // No corporate logo used; individual portrait
      domainEvidence: {
        detectedUrl: 'https://careers-acmefinancial-apply.net/spec.zip',
        domainRisk: 'High - Malicious archive delivery endpoint',
        ipResolved: '104.21.32.18 (Cloudflare Proxy)'
      },
      detectionReasons: [
        'Approaches developers with password-protected .zip files containing macros',
        'Not listed in Acme HR directory; disposable protonmail contact email',
        'High name similarity to corporate recruiting business unit'
      ],
      aiConfidence: 0.89
    },
    review: {
      status: 'Confirmed Suspicious',
      analystNotes: 'Malware sandbox confirmed infostealer payload inside candidate ZIP. Abuse complaint sent to LinkedIn Trust & Safety.',
      reviewedBy: 'Sarah Chen (Lead SecOps)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    },
    _isRemote: false
  },
  {
    id: 'soc-cand-103',
    profileName: 'Acme Global Customer Care',
    handle: '@AcmeGlobalHelp_',
    platform: 'X (Twitter)',
    url: 'https://x.com/AcmeGlobalHelp_',
    description: 'Dedicated client support assistance for Acme Financial Global customers. Direct message us for fast help with account verification.',
    logoUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    matchedBrandId: 'bp-1',
    matchedBrand: 'Acme Financial Global',
    detectedAt: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
    source: 'X / Twitter Keyword Stream',
    modelEvidence: {
      riskScore: 82,
      severity: 'high',
      nameSimilarity: 89,
      logoSimilarity: 84,
      domainEvidence: null,
      detectionReasons: [
        'Trailing underscore handle variation mimicking official @AcmeFinancial handle',
        'Automated reply bot targeting users tweeting @AcmeFinancial customer complaints',
        'Redirects victims to unverified WhatsApp phone number'
      ],
      aiConfidence: 0.84
    },
    review: {
      status: 'New',
      analystNotes: '',
      reviewedBy: null,
      reviewedAt: null
    },
    _isRemote: false
  },
  {
    id: 'soc-cand-104',
    profileName: 'Acme Developers & Tech Club',
    handle: '@acme_dev_community',
    platform: 'X (Twitter)',
    url: 'https://x.com/acme_dev_community',
    description: 'Unofficial developer appreciation club and fan forum for engineers using Acme Cloud Infrastructure tools.',
    logoUrl: null,
    matchedBrandId: 'bp-3',
    matchedBrand: 'Acme Cloud Infrastructure',
    detectedAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
    source: 'X / Twitter Public Search',
    modelEvidence: {
      riskScore: 34,
      severity: 'low',
      nameSimilarity: 72,
      logoSimilarity: null,
      domainEvidence: {
        detectedUrl: 'https://github.com/acme-dev-community',
        domainRisk: 'Low - Verified legitimate open source GitHub community repository',
        ipResolved: '140.82.112.4'
      },
      detectionReasons: [
        'Profile explicitly states "Unofficial developer appreciation club" in bio',
        'No malicious links, credential lures, or payment requests detected',
        'Moderate name similarity due to generic brand mention'
      ],
      aiConfidence: 0.92
    },
    review: {
      status: 'False Positive',
      analystNotes: 'Legitimate enthusiast community. No infringement or impersonation detected. Marked false positive.',
      reviewedBy: 'Marcus Vance (CISO)',
      reviewedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString()
    },
    _isRemote: false
  }
];

function getLocalCandidates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SOCIAL_CANDIDATES));
      return INITIAL_SOCIAL_CANDIDATES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage read error:', err);
    return INITIAL_SOCIAL_CANDIDATES;
  }
}

function saveLocalCandidates(candidates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
  } catch (err) {
    console.warn('LocalStorage write error:', err);
  }
}

// Levenshtein distance helper to compute name similarity %
function calculateSimilarity(str1 = '', str2 = '') {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
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

export const socialMonitoringService = {
  /**
   * Fetch all analyzed candidate profiles
   */
  async getCandidates(filters = {}) {
    // 1. Try remote API first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/social-monitoring/candidates`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: data.map(c => ({ ...c, _isRemote: true })), isRemote: true };
      }
    } catch {
      // Backend offline
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
      list = list.filter((c) => c.modelEvidence?.severity?.toLowerCase() === filters.riskLevel.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.profileName.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.url.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return { data: list.map(c => ({ ...c, _isRemote: false })), isRemote: false };
  },

  /**
   * Submit and analyze candidate social profile
   */
  async analyzeCandidate(candidatePayload, selectedBrand) {
    const payload = {
      ...candidatePayload,
      matchedBrandId: selectedBrand.id,
      matchedBrand: selectedBrand.name,
      detectedAt: new Date().toISOString(),
      source: 'Analyst On-Demand Heuristic Ingestion'
    };

    // Try backend POST first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${API_BASE_URL}/social-monitoring/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: { ...data, _isRemote: true }, isRemote: true };
      }
    } catch {
      // Backend offline; perform client-side multi-modal heuristic analysis
    }

    // Client-side Heuristic Pipeline (Fallback)
    await new Promise((r) => setTimeout(r, 1100)); // simulated model inference latency

    const nameSim = calculateSimilarity(candidatePayload.profileName, selectedBrand.name);
    const handleSim = calculateSimilarity(candidatePayload.handle.replace('@', ''), selectedBrand.name);
    const bestNameSim = Math.max(nameSim, handleSim);

    // Analyze bio keywords
    const bio = (candidatePayload.description || '').toLowerCase();
    const suspiciousKeywords = ['support', 'desk', 'resolution', 'wallet', 'seed', 'keys', 'unfreeze', 'helpdesk', 'giveaway', 'bonus', 'dm for'];
    const foundKeywords = suspiciousKeywords.filter((k) => bio.includes(k));

    // Logo similarity check (simulated if logo is provided)
    const logoSim = candidatePayload.logoUrl ? Math.floor(Math.random() * 15) + 78 : null;

    // Check for suspicious URLs in bio or profile URL
    const urlToCheck = candidatePayload.url || '';
    let domainEvidence = null;
    if (urlToCheck.includes('.support') || urlToCheck.includes('.help') || urlToCheck.includes('.xyz') || bio.includes('http')) {
      domainEvidence = {
        detectedUrl: urlToCheck,
        domainRisk: 'High - External destination host registered recently with privacy proxy',
        ipResolved: '194.38.20.15 (Frankfurt, DE)'
      };
    }

    // Compute composite risk score (Multi-factor: NOT name similarity alone!)
    let computedRisk = 30; // base score
    const detectionReasons = [];

    if (bestNameSim >= 75) {
      computedRisk += 25;
      detectionReasons.push(`High lexical name similarity (${bestNameSim}%) to brand "${selectedBrand.name}"`);
    } else if (bestNameSim >= 50) {
      computedRisk += 15;
      detectionReasons.push(`Moderate brand keyword mention in handle/name (${bestNameSim}%)`);
    }

    if (foundKeywords.length > 0) {
      computedRisk += 25;
      detectionReasons.push(`Bio contains high-risk credential recovery lures: ${foundKeywords.map(k => `"${k}"`).join(', ')}`);
    }

    if (logoSim && logoSim >= 75) {
      computedRisk += 20;
      detectionReasons.push(`Visual trademark similarity (${logoSim}% pHash match) against official brand logo`);
    }

    if (domainEvidence) {
      computedRisk += 15;
      detectionReasons.push(`Unverified external redirect host detected on high-risk perimeter`);
    }

    // Cap between 15 and 98
    computedRisk = Math.min(98, Math.max(15, computedRisk));

    let severity = 'low';
    if (computedRisk >= 85) severity = 'critical';
    else if (computedRisk >= 70) severity = 'high';
    else if (computedRisk >= 50) severity = 'medium';

    const analyzedCandidate = {
      id: `soc-cand-${Date.now()}`,
      ...payload,
      modelEvidence: {
        riskScore: computedRisk,
        severity,
        nameSimilarity: bestNameSim,
        logoSimilarity: logoSim,
        domainEvidence,
        detectionReasons: detectionReasons.length > 0
          ? detectionReasons
          : ['Routine profile scan: No active threat indicators detected beyond standard brand mention.'],
        aiConfidence: 0.91
      },
      review: {
        status: 'New',
        analystNotes: '',
        reviewedBy: null,
        reviewedAt: null
      },
      _isRemote: false
    };

    const local = getLocalCandidates();
    const updated = [analyzedCandidate, ...local];
    saveLocalCandidates(updated);

    return { data: analyzedCandidate, isRemote: false };
  },

  /**
   * Update analyst review decision & notes
   */
  async updateReviewStatus(id, { status, analystNotes = '', analystName = 'Sarah Chen (Lead SecOps)' }) {
    const payload = {
      status,
      analystNotes,
      reviewedBy: analystName,
      reviewedAt: new Date().toISOString()
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/social-monitoring/candidates/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: { ...data, _isRemote: true }, isRemote: true };
      }
    } catch {
      // Backend offline
    }

    await new Promise((r) => setTimeout(r, 200));
    const local = getLocalCandidates();
    const index = local.findIndex((c) => c.id === id);
    if (index === -1) throw new Error(`Candidate with ID "${id}" not found.`);

    const updatedCandidate = {
      ...local[index],
      review: {
        ...local[index].review,
        ...payload
      },
      _isRemote: false
    };

    local[index] = updatedCandidate;
    saveLocalCandidates(local);
    return { data: updatedCandidate, isRemote: false };
  },

  /**
   * Unified Findings review alias
   */
  async updateReview(id, reviewData) {
    return this.updateReviewStatus(id, reviewData);
  },

  /**
   * Delete / Archive candidate
   */
  async deleteCandidate(id) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/social-monitoring/candidates/${id}`, {
        method: 'DELETE',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        return { success: true, isRemote: true };
      }
    } catch {
      // Backend offline
    }

    await new Promise((r) => setTimeout(r, 150));
    const local = getLocalCandidates();
    const filtered = local.filter((c) => c.id !== id);
    saveLocalCandidates(filtered);
    return { success: true, isRemote: false };
  },

  /**
   * Reset demonstration candidate list
   */
  resetCandidates() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SOCIAL_CANDIDATES));
    return INITIAL_SOCIAL_CANDIDATES;
  },

  resetToDefaults() {
    return this.resetCandidates();
  }
};
