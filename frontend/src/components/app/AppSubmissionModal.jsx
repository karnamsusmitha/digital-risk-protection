import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import LogoUploader from '../brand/LogoUploader';
import { Smartphone, Sparkles, AlertCircle, Info } from 'lucide-react';

const APP_STORES = [
  'Google Play',
  'Apple App Store',
  'APKPure',
  'APKMirror',
  'F-Droid',
  'Huawei AppGallery',
  'Xiaomi GetApps',
  'Amazon Appstore',
  'Direct Web APK / Unofficial Host'
];

export default function AppSubmissionModal({
  isOpen,
  onClose,
  brands = [],
  onAnalyze,
  isAnalyzing = false
}) {
  const [formData, setFormData] = useState({
    brandId: '',
    officialAppId: '',
    store: 'Google Play',
    appName: '',
    packageId: '',
    publisher: '',
    storeUrl: '',
    description: '',
    logoUrl: '',
    version: '1.0.0'
  });

  const [errors, setErrors] = useState({});

  // Synchronize default brand selection when brands load
  useEffect(() => {
    if (brands.length > 0 && !formData.brandId) {
      const defaultBrand = brands[0];
      setFormData((prev) => ({
        ...prev,
        brandId: defaultBrand.id,
        officialAppId: defaultBrand.mobileApps?.[0]?.id || ''
      }));
    }
  }, [brands, formData.brandId]);

  // Update selected official app when brand changes
  const handleBrandChange = (e) => {
    const selectedBrandId = e.target.value;
    const selectedBrand = brands.find((b) => b.id === selectedBrandId);
    setFormData((prev) => ({
      ...prev,
      brandId: selectedBrandId,
      officialAppId: selectedBrand?.mobileApps?.[0]?.id || ''
    }));
  };

  const selectedBrand = brands.find((b) => b.id === formData.brandId);
  const availableOfficialApps = selectedBrand?.mobileApps || [];

  const validate = () => {
    const errs = {};
    if (!formData.brandId) {
      errs.brandId = 'Please select a registered target brand.';
    }
    if (!formData.appName.trim()) {
      errs.appName = 'Candidate app name is required.';
    }
    if (!formData.publisher.trim()) {
      errs.publisher = 'Developer / publisher name is required.';
    }
    if (formData.storeUrl.trim()) {
      try {
        const u = new URL(formData.storeUrl.trim());
        if (!['http:', 'https:'].includes(u.protocol)) {
          errs.storeUrl = 'Store URL must start with http:// or https://';
        }
      } catch {
        errs.storeUrl = 'Please enter a valid URL (e.g. https://play.google.com/store/apps/...).';
      }
    }
    if (formData.packageId.trim()) {
      // Basic package id format: e.g. com.something.something
      const pkgRegex = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;
      if (!pkgRegex.test(formData.packageId.trim())) {
        errs.packageId = 'Package ID format should follow standard reverse-DNS (e.g. com.company.app).';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const brand = brands.find((b) => b.id === formData.brandId);
    const officialApp = brand?.mobileApps?.find((a) => a.id === formData.officialAppId) || null;

    onAnalyze(
      {
        appName: formData.appName.trim(),
        packageId: formData.packageId.trim() || null,
        publisher: formData.publisher.trim(),
        store: formData.store,
        storeUrl: formData.storeUrl.trim(),
        description: formData.description.trim(),
        logoUrl: formData.logoUrl || null,
        version: formData.version.trim() || '1.0.0'
      },
      brand,
      officialApp
    );
  };

  const resetForm = () => {
    setFormData({
      brandId: brands[0]?.id || '',
      officialAppId: brands[0]?.mobileApps?.[0]?.id || '',
      store: 'Google Play',
      appName: '',
      packageId: '',
      publisher: '',
      storeUrl: '',
      description: '',
      logoUrl: '',
      version: '1.0.0'
    });
    setErrors({});
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Analyze Candidate Mobile App"
      description="Submit a suspicious app listing, third-party APK, or rogue repository release for automated comparative analysis against official brand assets."
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Brand Target & Benchmark App Selection */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/60 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 uppercase tracking-wider">
            <Smartphone className="w-4 h-4 text-blue-700" />
            <span>Target Protected Brand & Official Baseline</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Registered Brand <span className="text-rose-500">*</span>
              </label>
              <Select
                value={formData.brandId}
                onChange={handleBrandChange}
                error={errors.brandId}
                disabled={isAnalyzing}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type || 'Protected Brand'})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Benchmark Against Official App
              </label>
              {availableOfficialApps.length > 0 ? (
                <Select
                  value={formData.officialAppId}
                  onChange={(e) => setFormData((p) => ({ ...p, officialAppId: e.target.value }))}
                  disabled={isAnalyzing}
                >
                  {availableOfficialApps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.packageId})
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>No official mobile apps registered for this brand. Comparative heuristics will run against brand corporate identity.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Candidate App Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="Candidate App Name"
              required
              placeholder="e.g. Acme Financial Quick Loans"
              value={formData.appName}
              onChange={(e) => setFormData((p) => ({ ...p, appName: e.target.value }))}
              error={errors.appName}
              disabled={isAnalyzing}
            />
          </div>

          <div>
            <Input
              label="Developer / Publisher Name"
              required
              placeholder="e.g. Apex FinTech Media Ltd"
              value={formData.publisher}
              onChange={(e) => setFormData((p) => ({ ...p, publisher: e.target.value }))}
              error={errors.publisher}
              disabled={isAnalyzing}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Store / Distribution Repository <span className="text-rose-500">*</span>
            </label>
            <Select
              value={formData.store}
              onChange={(e) => setFormData((p) => ({ ...p, store: e.target.value }))}
              disabled={isAnalyzing}
            >
              {APP_STORES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Input
              label="Package Identifier (Optional / Where Available)"
              placeholder="e.g. com.acmefinancial.quickloan"
              value={formData.packageId}
              onChange={(e) => setFormData((p) => ({ ...p, packageId: e.target.value }))}
              error={errors.packageId}
              disabled={isAnalyzing}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Leave blank if package ID is unavailable on the listing.
            </p>
          </div>
        </div>

        {/* Store URL & Version */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Store Listing or Download URL"
              placeholder="https://play.google.com/store/apps/details?id=..."
              value={formData.storeUrl}
              onChange={(e) => setFormData((p) => ({ ...p, storeUrl: e.target.value }))}
              error={errors.storeUrl}
              disabled={isAnalyzing}
            />
          </div>
          <div>
            <Input
              label="Listing Version"
              placeholder="1.0.0"
              value={formData.version}
              onChange={(e) => setFormData((p) => ({ ...p, version: e.target.value }))}
              disabled={isAnalyzing}
            />
          </div>
        </div>

        {/* Store Listing Description */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Store Listing Description
          </label>
          <textarea
            rows={3}
            placeholder="Paste candidate app bio or promotional store text to analyze credential harvesting lures and brand claims..."
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            disabled={isAnalyzing}
            className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Candidate App Icon Upload */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Candidate App Icon / Logo (Optional for Visual Matching)
          </label>
          <LogoUploader
            currentLogoUrl={formData.logoUrl}
            onLogoChange={(url) => setFormData((p) => ({ ...p, logoUrl: url }))}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Upload candidate app icon to perform perceptual hash comparison against official trademark graphics.
          </p>
        </div>

        {/* Security Policy Reminder */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Investigation Policy:</strong> Analysis results evaluate name similarity, package squatting, credential lures, and permission risks. In accordance with policy, a different publisher name alone is <strong>never treated as conclusive fraud</strong>.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={isAnalyzing}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            leftIcon={Sparkles}
            isLoading={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing App Binary & Metadata...' : 'Analyze Candidate App'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
