import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import LogoUploader from '../brand/LogoUploader';
import { Sparkles } from 'lucide-react';

const SOCIAL_PLATFORMS = [
  'Telegram',
  'X (Twitter)',
  'LinkedIn',
  'Instagram',
  'Facebook',
  'YouTube',
  'TikTok',
  'Discord',
  'Reddit',
  'Other'
];

export default function CandidateSubmissionModal({
  isOpen,
  onClose,
  brands = [],
  onAnalyze,
  isAnalyzing = false
}) {
  const [formData, setFormData] = useState({
    brandId: brands[0]?.id || '',
    platform: 'Telegram',
    profileName: '',
    handle: '',
    url: '',
    description: '',
    logoUrl: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (brands.length > 0 && !formData.brandId) {
      setFormData((prev) => ({ ...prev, brandId: brands[0].id }));
    }
  }, [brands, formData.brandId]);

  const validate = () => {
    const errs = {};
    if (!formData.brandId) {
      errs.brandId = 'Please select a registered brand.';
    }
    if (!formData.profileName.trim()) {
      errs.profileName = 'Candidate profile name is required.';
    }
    if (!formData.handle.trim()) {
      errs.handle = 'Account handle or username is required.';
    }
    if (formData.url.trim()) {
      try {
        const u = new URL(formData.url.trim());
        if (!['http:', 'https:'].includes(u.protocol)) {
          errs.url = 'Profile URL must start with http:// or https://';
        }
      } catch {
        errs.url = 'Please enter a valid URL (e.g. https://t.me/example).';
      }
    }
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const selectedBrand = brands.find((b) => b.id === formData.brandId) || brands[0];
    onAnalyze(formData, selectedBrand);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Candidate Social Profile for Analysis"
      description="Run automated multi-modal threat analysis against registered brand trademarks and authorized perimeters."
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isAnalyzing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isAnalyzing}
            leftIcon={Sparkles}
          >
            {isAnalyzing ? 'Evaluating Heuristics...' : 'Analyze Candidate Profile'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Brand Selector */}
        <Select
          label="Target Protected Brand"
          required
          value={formData.brandId || brands[0]?.id || ''}
          error={errors.brandId}
          onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
          options={brands.map((b) => ({
            value: b.id,
            label: `${b.name} (${b.officialDomain})`
          }))}
          helperText="Candidate profile heuristics will be benchmarked against this brand's official assets."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Social Network Platform"
            required
            value={formData.platform}
            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
            options={SOCIAL_PLATFORMS.map((p) => ({ value: p, label: p }))}
          />

          <Input
            label="Candidate Account Handle"
            placeholder="e.g. @AcmePay_Support_Desk"
            required
            value={formData.handle}
            error={errors.handle}
            onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
            helperText="Include leading @ or username identifier."
          />
        </div>

        <Input
          label="Candidate Display Name"
          placeholder="e.g. AcmePay Official Support"
          required
          value={formData.profileName}
          error={errors.profileName}
          onChange={(e) => setFormData({ ...formData, profileName: e.target.value })}
          helperText="Public screen name used to calculate lexical Levenshtein distance."
        />

        <Input
          label="Candidate Public Profile URL"
          placeholder="https://t.me/AcmePay_Support_Desk"
          value={formData.url}
          error={errors.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Profile Bio / Description</span>
            <span className="text-[11px] text-slate-400 font-normal">Optional</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Official 24/7 customer service. DM for assistance or seed phrase recovery."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full text-xs rounded-lg border border-slate-300 p-2.5 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
          <p className="text-[10px] text-slate-400">
            Natural language parser will extract suspicious credential lures and recovery keywords.
          </p>
        </div>

        {/* Candidate Logo */}
        <LogoUploader
          value={formData.logoUrl}
          onChange={(val) => setFormData({ ...formData, logoUrl: val })}
        />

        {/* Model Disclaimer Notice */}
        <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            The analysis combines lexical distance, bio credential indicators, external domain checks, and logo perceptual hashing. Accounts are not classified as fraudulent based on name similarity alone.
          </span>
        </div>
      </form>
    </Modal>
  );
}
