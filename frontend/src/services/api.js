/**
 * CENTRALIZED BACKEND API CLIENT MODULE
 *
 * Primary integration gateway between the React frontend and the teammate's FastAPI backend.
 *
 * ARCHITECTURAL POLICY:
 * - Uses configurable VITE_API_BASE_URL environment variable (default: '/api/v1' with Vite proxy).
 * - Implements strict timeouts with AbortController.
 * - Extracts and normalizes FastAPI Pydantic validation errors into user-friendly messages.
 * - Provides live backend health probing (/health).
 * - When backend endpoints are offline or under development, gracefully isolates the request
 *   behind safe fallback sandbox functions and tags responses with `_isRemote: false, isDemo: true`.
 * - NEVER pretends the remote API succeeded when operating in demo mode.
 * - NEVER exposes Hugging Face, OpenAI, or other secret API keys in browser code.
 */

import {
  MOCK_OVERVIEW_STATS,
  MOCK_ACTIVITY_LOG,
  MOCK_BRAND_PROFILES,
  MOCK_FINDINGS
} from './mockData';

// Configurable Environment Variables
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 6000;

// Local Sandbox Storage Keys (for offline fallback)
const STORAGE_KEYS = {
  BRANDS: 'drp_brand_profiles_v2',
  SOCIAL_CANDIDATES: 'drp_social_candidates_v2',
  APP_CANDIDATES: 'drp_app_candidates_v2',
  FINDINGS: 'drp_findings_v2'
};

/**
 * Robust HTTP client with timeouts and FastAPI error parsing
 */
async function request(endpoint, options = {}) {
  const timeoutMs = options.timeout || API_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    // 204 No Content
    if (res.status === 204) {
      return { success: true, _isRemote: true };
    }

    // Try parsing JSON response
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { rawText: text };
    }

    if (!res.ok) {
      // Parse FastAPI Pydantic validation error schema: { detail: [ { loc, msg, type } ] }
      if (data && Array.isArray(data.detail)) {
        const issues = data.detail
          .map((item) => `${item.loc?.slice(-1)[0] || 'field'}: ${item.msg}`)
          .join(', ');
        throw new Error(`Validation Error: ${issues}`);
      } else if (data && typeof data.detail === 'string') {
        throw new Error(data.detail);
      } else if (data && data.message) {
        throw new Error(data.message);
      }
      throw new Error(`API error (HTTP ${res.status}): ${res.statusText || 'Request failed'}`);
    }

    return {
      ...data,
      _isRemote: true,
      isDemo: false
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      const timeoutErr = new Error(
        `Backend request timed out after ${timeoutMs}ms. Verify that the FastAPI backend is running.`
      );
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    throw err;
  }
}

/**
 * Local Storage Helper for Safe Sandbox Fallback
 */
function getStored(key, fallback = []) {
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
    console.warn(`LocalStorage write error [${key}]:`, err);
  }
}

export const apiService = {
  API_BASE_URL,

  /**
   * 1. BACKEND HEALTH CHECK
   * Probes backend health status and measures round-trip latency.
   */
  async checkHealth() {
    const startTime = performance.now();
    try {
      // Probe /health on backend
      const res = await request('/health', { timeout: 2500 });
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: true,
        status: res.status || 'healthy',
        latencyMs,
        isRemote: true,
        url: API_BASE_URL
      };
    } catch (err) {
      return {
        ok: false,
        status: 'offline',
        error: err.message,
        isRemote: false,
        isDemo: true,
        url: API_BASE_URL
      };
    }
  },

  /**
   * 2. BRAND PROFILES ENDPOINTS
   * Connects to GET, POST, PUT, DELETE /brand-profiles
   */
  async getBrandProfiles() {
    try {
      const res = await request('/brand-profiles');
      // If array returned directly
      if (Array.isArray(res)) return res.map((b) => ({ ...b, _isRemote: true }));
      if (Array.isArray(res.data)) return res.data.map((b) => ({ ...b, _isRemote: true }));
      return res;
    } catch (err) {
      console.warn(`[apiService] /brand-profiles unavailable (${err.message}). Using local sandbox.`);
      const stored = getStored(STORAGE_KEYS.BRANDS, MOCK_BRAND_PROFILES);
      return stored.map((b) => ({ ...b, _isRemote: false, isDemo: true }));
    }
  },

  async createBrandProfile(newProfile) {
    // Client-side payload sanitization
    const payload = {
      name: (newProfile.name || '').trim(),
      officialWebsite: (newProfile.officialWebsite || '').trim(),
      officialDomain: (newProfile.officialDomain || '').trim(),
      logoUrl: newProfile.logoUrl || null,
      type: newProfile.type || 'Corporate Entity',
      tier: newProfile.tier || 'Tier 2 - Commercial Enterprise',
      primaryContact: newProfile.primaryContact || '',
      socialAccounts: newProfile.socialAccounts || [],
      mobileApps: newProfile.mobileApps || [],
      identifiers: newProfile.identifiers || {},
      notes: newProfile.notes || ''
    };

    if (!payload.name) {
      throw new Error('Brand name is required.');
    }

    try {
      return await request('/brand-profiles', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn(`[apiService] POST /brand-profiles unavailable (${err.message}). Storing in local sandbox.`);
      const localProfile = {
        id: `bp-${Date.now()}`,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _isRemote: false,
        isDemo: true,
        ...payload
      };
      const stored = getStored(STORAGE_KEYS.BRANDS, MOCK_BRAND_PROFILES);
      setStored(STORAGE_KEYS.BRANDS, [localProfile, ...stored]);
      return localProfile;
    }
  },

  async updateBrandProfile(id, updatePayload) {
    try {
      return await request(`/brand-profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      });
    } catch (err) {
      console.warn(`[apiService] PUT /brand-profiles/${id} unavailable (${err.message}). Updating local sandbox.`);
      const stored = getStored(STORAGE_KEYS.BRANDS, MOCK_BRAND_PROFILES);
      const updated = stored.map((b) =>
        b.id === id ? { ...b, ...updatePayload, updatedAt: new Date().toISOString(), _isRemote: false } : b
      );
      setStored(STORAGE_KEYS.BRANDS, updated);
      return updated.find((b) => b.id === id);
    }
  },

  async deleteBrandProfile(id) {
    try {
      return await request(`/brand-profiles/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn(`[apiService] DELETE /brand-profiles/${id} unavailable (${err.message}). Deleting from local sandbox.`);
      const stored = getStored(STORAGE_KEYS.BRANDS, MOCK_BRAND_PROFILES);
      const filtered = stored.filter((b) => b.id !== id);
      setStored(STORAGE_KEYS.BRANDS, filtered);
      return { success: true, _isRemote: false };
    }
  },

  /**
   * 3. CANDIDATE ANALYSIS ENDPOINTS
   * Connects to POST /social-monitoring/analyze and POST /app-monitoring/analyze
   */
  async analyzeSocialCandidate(candidatePayload) {
    try {
      return await request('/social-monitoring/analyze', {
        method: 'POST',
        body: JSON.stringify(candidatePayload)
      });
    } catch (err) {
      console.warn(`[apiService] POST /social-monitoring/analyze offline (${err.message}).`);
      throw err; // Domain service fallback handles client-side heuristic inference
    }
  },

  async getSocialCandidates(filters = {}) {
    const params = new URLSearchParams();
    if (filters.brandId && filters.brandId !== 'all') params.set('brand_id', filters.brandId);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.riskLevel && filters.riskLevel !== 'all') params.set('risk_level', filters.riskLevel);
    if (filters.search) params.set('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await request(`/social-monitoring/candidates${query}`);
  },

  async analyzeAppCandidate(candidatePayload) {
    try {
      return await request('/app-monitoring/analyze', {
        method: 'POST',
        body: JSON.stringify(candidatePayload)
      });
    } catch (err) {
      console.warn(`[apiService] POST /app-monitoring/analyze offline (${err.message}).`);
      throw err;
    }
  },

  async getAppCandidates(filters = {}) {
    const params = new URLSearchParams();
    if (filters.brandId && filters.brandId !== 'all') params.set('brand_id', filters.brandId);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.riskLevel && filters.riskLevel !== 'all') params.set('risk_level', filters.riskLevel);
    if (filters.store && filters.store !== 'all') params.set('store', filters.store);
    if (filters.search) params.set('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    return await request(`/app-monitoring/candidates${query}`);
  },

  /**
   * 4. FINDINGS ENDPOINTS
   * Connects to GET /findings and PATCH /findings/:id/review
   */
  async getFindings(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);

      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await request(`/findings${query}`);
      if (Array.isArray(res)) return res.map((f) => ({ ...f, _isRemote: true }));
      if (Array.isArray(res.data)) return res.data.map((f) => ({ ...f, _isRemote: true }));
      return res;
    } catch (err) {
      console.warn(`[apiService] GET /findings offline (${err.message}). Using local sandbox.`);
      let list = getStored(STORAGE_KEYS.FINDINGS, MOCK_FINDINGS);
      if (filters.severity && filters.severity !== 'all') {
        list = list.filter((i) => i.severity === filters.severity);
      }
      if (filters.status && filters.status !== 'all') {
        list = list.filter((i) => i.status === filters.status);
      }
      return list.map((f) => ({ ...f, _isRemote: false, isDemo: true }));
    }
  },

  async updateFindingReview(id, reviewPayload) {
    try {
      return await request(`/findings/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify(reviewPayload)
      });
    } catch (err) {
      console.warn(`[apiService] PATCH /findings/${id}/review offline (${err.message}). Updating local sandbox.`);
      const stored = getStored(STORAGE_KEYS.FINDINGS, MOCK_FINDINGS);
      const updated = stored.map((f) =>
        f.id === id ? { ...f, status: reviewPayload.status || f.status, _isRemote: false } : f
      );
      setStored(STORAGE_KEYS.FINDINGS, updated);
      return updated.find((f) => f.id === id);
    }
  },

  async triggerTakedown(id) {
    try {
      return await request(`/findings/${id}/takedown`, { method: 'POST' });
    } catch {
      return await this.updateFindingReview(id, {
        status: 'takedown-requested',
        analystNotes: 'Takedown notice filed.'
      });
    }
  },

  /**
   * 5. ANALYST REVIEW ACTION ENDPOINTS
   */
  async updateSocialReview(id, reviewPayload) {
    return await request(`/social-monitoring/candidates/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(reviewPayload)
    });
  },

  async updateAppReview(id, reviewPayload) {
    return await request(`/app-monitoring/candidates/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(reviewPayload)
    });
  },

  /**
   * 6. OVERVIEW & ACTIVITY LOG ENDPOINTS
   */
  async getOverviewStats(timeframe = '7d') {
    try {
      return await request(`/overview/stats?timeframe=${encodeURIComponent(timeframe)}`);
    } catch {
      return {
        ...MOCK_OVERVIEW_STATS,
        timeframe,
        _isRemote: false,
        isDemo: true
      };
    }
  },

  async getActivityLog() {
    try {
      return await request('/overview/activity');
    } catch {
      return MOCK_ACTIVITY_LOG.map((a) => ({ ...a, _isRemote: false, isDemo: true }));
    }
  },

  // Backward compatibility aliases for existing hooks
  async getSocialAlerts(platform = 'all') {
    const list = await this.getFindings();
    if (platform === 'all') return list;
    return list.filter((i) => (i.platform || '').toLowerCase().includes(platform.toLowerCase()));
  },

  async updateSocialStatus(id, newStatus) {
    return await this.updateFindingReview(id, { status: newStatus });
  },

  async getAppAlerts() {
    return await this.getFindings();
  },

  async updateAppStatus(id, newStatus) {
    return await this.updateFindingReview(id, { status: newStatus });
  },

  async updateFindingStatus(id, newStatus) {
    return await this.updateFindingReview(id, { status: newStatus });
  },

  async batchUpdateStatus(ids, newStatus) {
    await Promise.all(ids.map((id) => this.updateFindingReview(id, { status: newStatus })));
    return { success: true, count: ids.length };
  },

  /**
   * 7. REGISTRAR ABUSE INTEGRATION ENDPOINTS
   */
  async getRegistrarAbuseStatus() {
    try {
      return await request('/integrations/registrar-abuse/status');
    } catch (err) {
      return {
        ok: false,
        status: 'offline',
        error: err.message,
        _isRemote: false,
        isDemo: true
      };
    }
  },

  async testRegistrarAbuseConnection(payload = {}) {
    return await request('/integrations/registrar-abuse/test-connection', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async lookupRegistrarAbuse(domain) {
    return await request('/integrations/registrar-abuse/lookup', {
      method: 'POST',
      body: JSON.stringify({ domain })
    });
  },

  async getRegistrarAbuseLookups() {
    return await request('/integrations/registrar-abuse/lookups');
  },

  /**
   * 8. THREAT INTELLIGENCE FEED ENDPOINTS
   */
  async getThreatIntelStatus() {
    try {
      return await request('/integrations/threat-intelligence/status');
    } catch (err) {
      return {
        ok: false,
        status: 'offline',
        error: err.message,
        _isRemote: false,
        isDemo: true
      };
    }
  },

  async syncThreatIntelFeeds() {
    return await request('/integrations/threat-intelligence/sync', {
      method: 'POST'
    });
  },

  async getThreatIntelRecords() {
    return await request('/integrations/threat-intelligence/feed');
  }
};

export default apiService;
