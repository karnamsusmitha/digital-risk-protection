/**
 * BRAND PROFILE SERVICE
 *
 * Dedicated frontend service for managing protected corporate brand profiles,
 * official digital assets, social media accounts, and mobile applications.
 *
 * BACKEND API CONTRACT (Agreed REST specification for Member 2):
 * - GET    /api/v1/brand-profiles          -> List all brand profiles
 * - POST   /api/v1/brand-profiles          -> Create new brand profile
 * - GET    /api/v1/brand-profiles/:id      -> Get single brand profile by ID
 * - PUT    /api/v1/brand-profiles/:id      -> Update existing brand profile
 * - DELETE /api/v1/brand-profiles/:id      -> Delete brand profile
 *
 * ARCHITECTURAL POLICY:
 * This service attempts live backend connectivity when VITE_API_BASE_URL is configured.
 * When the backend is offline or un-deployed during hackathon development, it falls back
 * to browser LocalStorage with transparent status indicators (_isRemote: false).
 * It NEVER claims that local data is saved on the remote backend server.
 */

import { API_BASE_URL } from './api';

const STORAGE_KEY = 'drp_brand_profiles_v2';

// Initial baseline mock data with full official asset schemas
export const INITIAL_BRAND_PROFILES = [
  {
    id: 'bp-1',
    name: 'Acme Financial Global',
    officialWebsite: 'https://acmefinancial.com',
    officialDomain: 'acmefinancial.com',
    logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    type: 'Corporate Entity',
    tier: 'Tier 1 - Mission Critical',
    status: 'active',
    primaryContact: 'soc-escalations@acmefinancial.com',
    socialAccounts: [
      { id: 'soc-1', platform: 'X (Twitter)', handle: '@AcmeFinancial', url: 'https://x.com/AcmeFinancial', verified: true },
      { id: 'soc-2', platform: 'LinkedIn', handle: 'company/acme-financial', url: 'https://linkedin.com/company/acme-financial', verified: true },
      { id: 'soc-3', platform: 'Telegram', handle: '@Acme_Official_Channel', url: 'https://t.me/Acme_Official_Channel', verified: true }
    ],
    mobileApps: [
      { id: 'app-1', name: 'Acme Financial Mobile', packageId: 'com.acmefinancial.banking', platform: 'Android (Google Play)', publisher: 'Acme Financial Global Inc.' },
      { id: 'app-2', name: 'Acme Financial iOS', packageId: 'com.acmefinancial.ios', platform: 'iOS (App Store)', publisher: 'Acme Financial Global Inc.' }
    ],
    identifiers: {
      trademarkNumber: 'US-TM-90812491',
      stockTicker: 'NYSE: ACMF',
      regulatoryLicense: 'FINRA-CRD-88129',
      alternateAliases: ['Acme Global Bank', 'Acme FinCorp', 'AFG']
    },
    notes: 'Primary multinational banking trademark. Monitored for homoglyphs, typosquats and fake executive recruitment.',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-10-12T14:30:00.000Z',
    _isRemote: false
  },
  {
    id: 'bp-2',
    name: 'AcmePay Mobile',
    officialWebsite: 'https://acmepay.app',
    officialDomain: 'acmepay.app',
    logoUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=200&auto=format&fit=crop&q=80',
    type: 'Consumer FinTech Product',
    tier: 'Tier 1 - Mission Critical',
    status: 'active',
    primaryContact: 'appsec@acmepay.app',
    socialAccounts: [
      { id: 'soc-4', platform: 'Instagram', handle: '@acmepay_official', url: 'https://instagram.com/acmepay_official', verified: true },
      { id: 'soc-5', platform: 'X (Twitter)', handle: '@AcmePay', url: 'https://x.com/AcmePay', verified: true },
      { id: 'soc-6', platform: 'Telegram', handle: '@AcmePay_News', url: 'https://t.me/AcmePay_News', verified: false }
    ],
    mobileApps: [
      { id: 'app-3', name: 'AcmePay Wallet & Cards', packageId: 'com.acmepay.wallet', platform: 'Android (Google Play)', publisher: 'AcmePay FinTech Ltd.' },
      { id: 'app-4', name: 'AcmePay - Send & Spend', packageId: 'com.acmepay.app.ios', platform: 'iOS (App Store)', publisher: 'AcmePay FinTech Ltd.' }
    ],
    identifiers: {
      trademarkNumber: 'EU-TM-4412903',
      stockTicker: '',
      regulatoryLicense: 'ECA-PAY-44910',
      alternateAliases: ['Acme Pay', 'Acme Wallet']
    },
    notes: 'Consumer mobile payment product. Continuous monitoring of third-party APK mirrors and phishing landing pages.',
    createdAt: '2026-09-15T12:00:00.000Z',
    updatedAt: '2026-10-12T13:10:00.000Z',
    _isRemote: false
  },
  {
    id: 'bp-3',
    name: 'Acme Cloud Infrastructure',
    officialWebsite: 'https://acmecloud.net',
    officialDomain: 'acmecloud.net',
    logoUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=200&auto=format&fit=crop&q=80',
    type: 'B2B Enterprise SaaS',
    tier: 'Tier 2 - High Priority',
    status: 'active',
    primaryContact: 'cloud-security@acmecloud.net',
    socialAccounts: [
      { id: 'soc-7', platform: 'LinkedIn', handle: 'company/acme-cloud', url: 'https://linkedin.com/company/acme-cloud', verified: true },
      { id: 'soc-8', platform: 'GitHub', handle: 'acme-cloud-enterprise', url: 'https://github.com/acme-cloud-enterprise', verified: true }
    ],
    mobileApps: [],
    identifiers: {
      trademarkNumber: 'US-TM-87239100',
      stockTicker: '',
      regulatoryLicense: 'SOC2-TypeII-Certified',
      alternateAliases: ['Acme Cloud Ops', 'AcmeCloud']
    },
    notes: 'Developer cloud console, status endpoints, and API services.',
    createdAt: '2026-09-20T08:30:00.000Z',
    updatedAt: '2026-10-10T16:00:00.000Z',
    _isRemote: false
  }
];

function getLocalProfiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BRAND_PROFILES));
      return INITIAL_BRAND_PROFILES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn('LocalStorage read error:', err);
    return INITIAL_BRAND_PROFILES;
  }
}

function saveLocalProfiles(profiles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (err) {
    console.warn('LocalStorage write error:', err);
  }
}

export const brandProfileService = {
  /**
   * Return saved brand profiles synchronously from cache/local storage
   */
  getSavedBrands() {
    return getLocalProfiles();
  },

  /**
   * Alias for backwards compatibility
   */
  getAllBrands() {
    return getLocalProfiles();
  },

  /**
   * Check whether backend REST endpoint is online
   */
  async checkBackendConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Fetch all registered brand profiles
   */
  async getProfiles() {
    // 1. Try remote backend if available
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/brand-profiles`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: data.map(p => ({ ...p, _isRemote: true })), isRemote: true };
      }
    } catch {
      // Backend is unavailable; fallback cleanly to local storage
    }

    // 2. Fallback to local storage cache
    await new Promise((r) => setTimeout(r, 200)); // simulated realistic latency
    const local = getLocalProfiles();
    return { data: local.map(p => ({ ...p, _isRemote: false })), isRemote: false };
  },

  /**
   * Fetch a single brand profile by ID
   */
  async getProfileById(id) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/brand-profiles/${id}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        return { data: { ...data, _isRemote: true }, isRemote: true };
      }
    } catch {
      // Backend offline
    }

    await new Promise((r) => setTimeout(r, 150));
    const local = getLocalProfiles();
    const found = local.find(p => p.id === id);
    if (!found) throw new Error(`Brand Profile with ID "${id}" was not found.`);
    return { data: { ...found, _isRemote: false }, isRemote: false };
  },

  /**
   * Create a new brand profile
   */
  async createProfile(profileData) {
    const payload = {
      ...profileData,
      id: profileData.id || `bp-${Date.now()}`,
      status: profileData.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Try backend POST first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${API_BASE_URL}/brand-profiles`, {
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
      // Backend offline
    }

    // Local storage fallback
    await new Promise((r) => setTimeout(r, 300));
    const local = getLocalProfiles();
    const newProfile = { ...payload, _isRemote: false };
    const updated = [newProfile, ...local];
    saveLocalProfiles(updated);
    return { data: newProfile, isRemote: false };
  },

  /**
   * Update an existing brand profile
   */
  async updateProfile(id, profileData) {
    const payload = {
      ...profileData,
      updatedAt: new Date().toISOString()
    };

    // Try backend PUT first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${API_BASE_URL}/brand-profiles/${id}`, {
        method: 'PUT',
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

    // Local storage fallback
    await new Promise((r) => setTimeout(r, 300));
    const local = getLocalProfiles();
    const index = local.findIndex(p => p.id === id);
    if (index === -1) throw new Error(`Brand Profile with ID "${id}" was not found.`);

    const updatedProfile = { ...local[index], ...payload, _isRemote: false };
    local[index] = updatedProfile;
    saveLocalProfiles(local);
    return { data: updatedProfile, isRemote: false };
  },

  /**
   * Delete a brand profile
   */
  async deleteProfile(id) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${API_BASE_URL}/brand-profiles/${id}`, {
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

    await new Promise((r) => setTimeout(r, 200));
    const local = getLocalProfiles();
    const filtered = local.filter(p => p.id !== id);
    saveLocalProfiles(filtered);
    return { success: true, isRemote: false };
  },

  /**
   * Reset local storage data to initial benchmark
   */
  resetToDefault() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BRAND_PROFILES));
    return INITIAL_BRAND_PROFILES;
  },

  resetToDefaults() {
    return this.resetToDefault();
  }
};
