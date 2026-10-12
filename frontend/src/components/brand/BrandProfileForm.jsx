import React, { useState, useEffect, useMemo } from 'react';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../common/Card';
import LogoUploader from './LogoUploader';
import {
  Shield,
  Globe,
  Share2,
  Smartphone,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  Layers
} from 'lucide-react';

const SOCIAL_PLATFORMS = [
  'X (Twitter)',
  'LinkedIn',
  'Telegram',
  'Instagram',
  'Facebook',
  'YouTube',
  'TikTok',
  'GitHub',
  'Discord',
  'Other'
];

const MOBILE_PLATFORMS = [
  'Android (Google Play)',
  'iOS (App Store)',
  'Huawei AppGallery',
  'Alternative APK Repository',
  'Other'
];

const DEFAULT_FORM_STATE = {
  name: '',
  officialWebsite: '',
  officialDomain: '',
  logoUrl: '',
  type: 'Corporate Entity',
  tier: 'Tier 1 - Mission Critical',
  primaryContact: '',
  socialAccounts: [],
  mobileApps: [],
  identifiers: {
    trademarkNumber: '',
    stockTicker: '',
    regulatoryLicense: '',
    alternateAliases: ''
  },
  notes: ''
};

export default function BrandProfileForm({
  initialData = null,
  isEditMode = false,
  onSubmit,
  onCancel,
  isSubmitting = false,
  onDirtyChange
}) {
  // Initialize form state
  const [formData, setFormData] = useState(() => {
    if (!initialData) return DEFAULT_FORM_STATE;
    return {
      name: initialData.name || '',
      officialWebsite: initialData.officialWebsite || '',
      officialDomain: initialData.officialDomain || '',
      logoUrl: initialData.logoUrl || '',
      type: initialData.type || 'Corporate Entity',
      tier: initialData.tier || 'Tier 1 - Mission Critical',
      primaryContact: initialData.primaryContact || '',
      socialAccounts: initialData.socialAccounts ? [...initialData.socialAccounts] : [],
      mobileApps: initialData.mobileApps ? [...initialData.mobileApps] : [],
      identifiers: {
        trademarkNumber: initialData.identifiers?.trademarkNumber || '',
        stockTicker: initialData.identifiers?.stockTicker || '',
        regulatoryLicense: initialData.identifiers?.regulatoryLicense || '',
        alternateAliases: Array.isArray(initialData.identifiers?.alternateAliases)
          ? initialData.identifiers.alternateAliases.join(', ')
          : initialData.identifiers?.alternateAliases || ''
      },
      notes: initialData.notes || ''
    };
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Baseline JSON string to detect unsaved changes
  const baselineString = useMemo(() => {
    if (!initialData) return JSON.stringify(DEFAULT_FORM_STATE);
    return JSON.stringify({
      name: initialData.name || '',
      officialWebsite: initialData.officialWebsite || '',
      officialDomain: initialData.officialDomain || '',
      logoUrl: initialData.logoUrl || '',
      type: initialData.type || 'Corporate Entity',
      tier: initialData.tier || 'Tier 1 - Mission Critical',
      primaryContact: initialData.primaryContact || '',
      socialAccounts: initialData.socialAccounts || [],
      mobileApps: initialData.mobileApps || [],
      identifiers: {
        trademarkNumber: initialData.identifiers?.trademarkNumber || '',
        stockTicker: initialData.identifiers?.stockTicker || '',
        regulatoryLicense: initialData.identifiers?.regulatoryLicense || '',
        alternateAliases: Array.isArray(initialData.identifiers?.alternateAliases)
          ? initialData.identifiers.alternateAliases.join(', ')
          : initialData.identifiers?.alternateAliases || ''
      },
      notes: initialData.notes || ''
    });
  }, [initialData]);

  // Check if form is dirty (unsaved changes exist)
  const isDirty = useMemo(() => {
    return JSON.stringify(formData) !== baselineString;
  }, [formData, baselineString]);

  // Notify parent component about dirty state
  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange]);

  // Client-side Validation function
  const validate = () => {
    const errs = {};

    // 1. Brand name validation
    if (!formData.name.trim()) {
      errs.name = 'Company or brand name is required.';
    } else if (formData.name.trim().length < 2) {
      errs.name = 'Brand name must be at least 2 characters.';
    }

    // 2. Official domain validation
    if (!formData.officialDomain.trim()) {
      errs.officialDomain = 'Official apex domain is required (e.g. acmefinancial.com).';
    } else {
      const cleanDomain = formData.officialDomain.trim().toLowerCase();
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9-_]{1,61})+\.?$/;
      if (!domainPattern.test(cleanDomain)) {
        errs.officialDomain = 'Please enter a valid domain format without protocol (e.g. acmefinancial.com).';
      }
    }

    // 3. Official website URL validation
    if (formData.officialWebsite.trim()) {
      try {
        const url = new URL(formData.officialWebsite.trim());
        if (!['http:', 'https:'].includes(url.protocol)) {
          errs.officialWebsite = 'URL must start with https:// or http://';
        }
      } catch {
        errs.officialWebsite = 'Please enter a valid URL (e.g. https://acmefinancial.com).';
      }
    }

    // 4. Primary contact email
    if (formData.primaryContact.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.primaryContact.trim())) {
        errs.primaryContact = 'Please enter a valid contact email address.';
      }
    }

    // 5. Social accounts validation
    formData.socialAccounts.forEach((acc, idx) => {
      if (!acc.handle.trim()) {
        errs[`social_${idx}_handle`] = 'Account handle is required.';
      }
    });

    // 6. Mobile apps validation
    formData.mobileApps.forEach((app, idx) => {
      if (!app.name.trim()) {
        errs[`app_${idx}_name`] = 'App name is required.';
      }
      if (!app.packageId.trim()) {
        errs[`app_${idx}_packageId`] = 'Package ID is required.';
      }
    });

    return errs;
  };

  const handleChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleIdentifierChange = (key, val) => {
    setFormData((prev) => ({
      ...prev,
      identifiers: {
        ...prev.identifiers,
        [key]: val
      }
    }));
  };

  // Social account dynamic rows
  const handleAddSocial = () => {
    setFormData((prev) => ({
      ...prev,
      socialAccounts: [
        ...prev.socialAccounts,
        {
          id: `soc-${Date.now()}`,
          platform: 'X (Twitter)',
          handle: '',
          url: '',
          verified: true
        }
      ]
    }));
  };

  const handleUpdateSocial = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.socialAccounts];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, socialAccounts: updated };
    });
  };

  const handleRemoveSocial = (index) => {
    setFormData((prev) => {
      const updated = prev.socialAccounts.filter((_, i) => i !== index);
      return { ...prev, socialAccounts: updated };
    });
  };

  // Mobile apps dynamic rows
  const handleAddApp = () => {
    setFormData((prev) => ({
      ...prev,
      mobileApps: [
        ...prev.mobileApps,
        {
          id: `app-${Date.now()}`,
          name: '',
          packageId: '',
          platform: 'Android (Google Play)',
          publisher: ''
        }
      ]
    }));
  };

  const handleUpdateApp = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.mobileApps];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, mobileApps: updated };
    });
  };

  const handleRemoveApp = (index) => {
    setFormData((prev) => {
      const updated = prev.mobileApps.filter((_, i) => i !== index);
      return { ...prev, mobileApps: updated };
    });
  };

  // Submit Handler
  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      // Scroll to first error
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    // Format alternate aliases as array
    const aliasesArray = formData.identifiers.alternateAliases
      ? formData.identifiers.alternateAliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

    const payload = {
      ...formData,
      officialDomain: formData.officialDomain.trim().toLowerCase(),
      officialWebsite: formData.officialWebsite.trim() || `https://${formData.officialDomain.trim()}`,
      identifiers: {
        ...formData.identifiers,
        alternateAliases: aliasesArray
      }
    };

    onSubmit(payload);
  };

  return (
    <Card className="border-slate-200/90 shadow-xs">
      {/* Form Header */}
      <CardHeader
        action={
          <div className="flex items-center gap-2">
            {isDirty ? (
              <Badge variant="amber" size="sm" withDot={true} pulse={true}>
                Unsaved Form Edits
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Clean State (Synced)
              </Badge>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <CardTitle>
              {isEditMode ? `Edit Brand Profile: ${initialData?.name}` : 'Register New Brand Profile'}
            </CardTitle>
            <CardDescription>
              {isEditMode
                ? 'Update official assets, social footprints, and verified application packages.'
                : 'Enroll corporate trademarks, domains, and official digital assets into perimeter surveillance.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="p-6 space-y-8">
          {/* General Error Summary */}
          {Object.keys(errors).length > 0 && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">
                  Please resolve the following required fields before saving:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 text-rose-700">
                  {Object.values(errors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* SECTION 1: Core Company & Brand Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Core Company & Brand Identity
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Company or Brand Name"
                placeholder="e.g. Acme Financial Global"
                required
                value={formData.name}
                error={touched.name && errors.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                helperText="Primary brand trademark name used in homoglyph detection."
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Asset Classification"
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  options={[
                    { value: 'Corporate Entity', label: 'Corporate Entity' },
                    { value: 'Consumer FinTech Product', label: 'Consumer Product' },
                    { value: 'B2B Enterprise SaaS', label: 'B2B Enterprise SaaS' },
                    { value: 'Executive VIP', label: 'Executive VIP' }
                  ]}
                />

                <Select
                  label="Surveillance Tier"
                  value={formData.tier}
                  onChange={(e) => handleChange('tier', e.target.value)}
                  options={[
                    { value: 'Tier 1 - Mission Critical', label: 'Tier 1 - Mission Critical' },
                    { value: 'Tier 2 - High Priority', label: 'Tier 2 - High Priority' },
                    { value: 'Tier 3 - Standard Surveillance', label: 'Tier 3 - Standard' }
                  ]}
                />
              </div>
            </div>

            {/* Official Website & Domain */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Official Apex Domain"
                placeholder="e.g. acmefinancial.com"
                required
                startIcon={Globe}
                value={formData.officialDomain}
                error={touched.officialDomain && errors.officialDomain}
                onChange={(e) => handleChange('officialDomain', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, officialDomain: true }))}
                helperText="Root domain without www or http. Used to calculate Levenshtein distance."
              />

              <Input
                label="Official Website URL"
                placeholder="https://acmefinancial.com"
                value={formData.officialWebsite}
                error={touched.officialWebsite && errors.officialWebsite}
                onChange={(e) => handleChange('officialWebsite', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, officialWebsite: true }))}
                helperText="Full landing page address with SSL scheme (https://)."
              />
            </div>

            {/* Official Logo Upload with Preview */}
            <LogoUploader
              value={formData.logoUrl}
              onChange={(val) => handleChange('logoUrl', val)}
            />

            <Input
              label="Designated Security Escalation Contact"
              placeholder="soc-escalations@acmefinancial.com"
              value={formData.primaryContact}
              error={touched.primaryContact && errors.primaryContact}
              onChange={(e) => handleChange('primaryContact', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, primaryContact: true }))}
              helperText="SOC inbox notified when high-severity impersonations are flagged."
            />
          </div>

          {/* SECTION 2: Official Social-Media Accounts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  2. Official Social-Media Footprint ({formData.socialAccounts.length})
                </h4>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleAddSocial}
                leftIcon={Plus}
              >
                Add Social Account
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Register verified corporate channels. The crawler compares discovered accounts against these authorized handles.
            </p>

            {formData.socialAccounts.length > 0 ? (
              <div className="space-y-3">
                {formData.socialAccounts.map((account, idx) => (
                  <div
                    key={account.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-3">
                      <Select
                        label={idx === 0 ? 'Network Platform' : ''}
                        value={account.platform}
                        onChange={(e) => handleUpdateSocial(idx, 'platform', e.target.value)}
                        options={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Input
                        label={idx === 0 ? 'Handle / Username' : ''}
                        placeholder="@AcmeFinancial"
                        value={account.handle}
                        error={errors[`social_${idx}_handle`]}
                        onChange={(e) => handleUpdateSocial(idx, 'handle', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-4">
                      <Input
                        label={idx === 0 ? 'Official Profile URL' : ''}
                        placeholder="https://x.com/AcmeFinancial"
                        value={account.url}
                        onChange={(e) => handleUpdateSocial(idx, 'url', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2 flex items-center justify-between gap-2 h-9 pb-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={account.verified}
                          onChange={(e) => handleUpdateSocial(idx, 'verified', e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Verified</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveSocial(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove social account"
                        aria-label={`Remove social account ${idx + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                <p className="text-xs text-slate-500 mb-2">No official social accounts registered yet.</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={handleAddSocial}
                  leftIcon={Plus}
                >
                  Add First Social Channel
                </Button>
              </div>
            )}
          </div>

          {/* SECTION 3: Official Mobile Applications */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Official Mobile Applications ({formData.mobileApps.length})
                </h4>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={handleAddApp}
                leftIcon={Plus}
              >
                Add Mobile App
              </Button>
            </div>

            <p className="text-xs text-slate-500">
              Legitimate store listings and package identifiers used to identify trojan overlays, repackaged APKs, and fake publisher clones.
            </p>

            {formData.mobileApps.length > 0 ? (
              <div className="space-y-3">
                {formData.mobileApps.map((app, idx) => (
                  <div
                    key={app.id || idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                  >
                    <div className="md:col-span-3">
                      <Input
                        label={idx === 0 ? 'Application Name' : ''}
                        placeholder="Acme Pay Mobile"
                        value={app.name}
                        error={errors[`app_${idx}_name`]}
                        onChange={(e) => handleUpdateApp(idx, 'name', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Input
                        label={idx === 0 ? 'Package Identifier (Reverse DNS)' : ''}
                        placeholder="com.acmefinancial.banking"
                        value={app.packageId}
                        error={errors[`app_${idx}_packageId`]}
                        onChange={(e) => handleUpdateApp(idx, 'packageId', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Select
                        label={idx === 0 ? 'Store / Ecosystem' : ''}
                        value={app.platform}
                        onChange={(e) => handleUpdateApp(idx, 'platform', e.target.value)}
                        options={MOBILE_PLATFORMS.map((p) => ({ value: p, label: p }))}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Input
                        label={idx === 0 ? 'Publisher / Dev Name' : ''}
                        placeholder="Acme Global Inc."
                        value={app.publisher}
                        onChange={(e) => handleUpdateApp(idx, 'publisher', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-1 flex items-center justify-end pb-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveApp(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove app"
                        aria-label={`Remove mobile app ${idx + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-5 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
                <p className="text-xs text-slate-500 mb-2">No official mobile apps registered yet.</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={handleAddApp}
                  leftIcon={Plus}
                >
                  Add Official App Package
                </Button>
              </div>
            )}
          </div>

          {/* SECTION 4: Additional Brand Identifiers */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Layers className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                4. Additional Trademark & Corporate Identifiers
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Registered Trademark Serial #"
                placeholder="US-TM-90812491"
                value={formData.identifiers.trademarkNumber}
                onChange={(e) => handleIdentifierChange('trademarkNumber', e.target.value)}
                helperText="Cited in legal DMCA registrar takedown notices."
              />

              <Input
                label="Stock Ticker / Symbol"
                placeholder="NYSE: ACMF"
                value={formData.identifiers.stockTicker}
                onChange={(e) => handleIdentifierChange('stockTicker', e.target.value)}
              />

              <Input
                label="Regulatory License / CRD / LEI"
                placeholder="FINRA-CRD-88129"
                value={formData.identifiers.regulatoryLicense}
                onChange={(e) => handleIdentifierChange('regulatoryLicense', e.target.value)}
              />
            </div>

            <Input
              label="Alternate Aliases & Subsidiaries (comma-separated)"
              placeholder="Acme Global Bank, Acme FinCorp, AFG"
              value={formData.identifiers.alternateAliases}
              onChange={(e) => handleIdentifierChange('alternateAliases', e.target.value)}
              helperText="Alternate business names and abbreviations screened for typo-squatting variants."
            />

            <Input
              label="Operational Notes & SOC Context"
              placeholder="e.g. Critical customer payment app launching in EU. Escalate homoglyphs to SOC Tier 3."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>
        </CardContent>

        {/* Footer Actions */}
        <CardFooter className="justify-between">
          <div className="flex items-center gap-2 text-xs">
            {isDirty && (
              <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved edits will be lost if you navigate away.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              leftIcon={Save}
            >
              {isEditMode ? 'Update Brand Profile' : 'Save Brand Profile'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
