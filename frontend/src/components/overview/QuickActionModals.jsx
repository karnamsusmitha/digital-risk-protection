import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { Shield, Share2, Smartphone, AlertCircle } from 'lucide-react';

export function AddBrandQuickModal({ isOpen, onClose, onAddBrand }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Corporate Entity',
    tier: 'Tier 1 - Mission Critical',
    monitoredDomains: '',
    trademarkNumber: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please provide a brand or asset name.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    setTimeout(() => {
      onAddBrand({
        name: formData.name.trim(),
        type: formData.type,
        tier: formData.tier,
        monitoredDomains: formData.monitoredDomains
          ? formData.monitoredDomains.split(',').map((d) => d.trim()).filter(Boolean)
          : [],
        trademarkNumber: formData.trademarkNumber || 'DEMO-TM-PENDING'
      });
      setIsSubmitting(false);
      setFormData({
        name: '',
        type: 'Corporate Entity',
        tier: 'Tier 1 - Mission Critical',
        monitoredDomains: '',
        trademarkNumber: ''
      });
      onClose();
    }, 400);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Action: Add Monitored Brand"
      description="Register an enterprise brand, trademark, or VIP asset to digital perimeter surveillance."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            leftIcon={Shield}
          >
            Add Brand to Surveillance
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Brand or Asset Name"
          placeholder="e.g. Acme Pay UK"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Asset Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'Corporate Entity', label: 'Corporate Entity' },
              { value: 'Consumer FinTech Product', label: 'Consumer FinTech Product' },
              { value: 'B2B Enterprise SaaS', label: 'B2B Enterprise SaaS' },
              { value: 'Executive VIP', label: 'Executive VIP' }
            ]}
          />
          <Select
            label="Protection Priority Tier"
            value={formData.tier}
            onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
            options={[
              { value: 'Tier 1 - Mission Critical', label: 'Tier 1 - Mission Critical' },
              { value: 'Tier 2 - High Priority', label: 'Tier 2 - High Priority' },
              { value: 'Tier 3 - Standard Surveillance', label: 'Tier 3 - Standard' }
            ]}
          />
        </div>

        <Input
          label="Root Domains to Protect (comma-separated)"
          placeholder="e.g. acmepay.uk, acme-checkout.com"
          value={formData.monitoredDomains}
          onChange={(e) => setFormData({ ...formData, monitoredDomains: e.target.value })}
          helperText="Typosquatting and homoglyph detection algorithms will benchmark against these apex roots."
        />

        <Input
          label="Trademark Registration / Serial ID"
          placeholder="e.g. UK-TM-481920"
          value={formData.trademarkNumber}
          onChange={(e) => setFormData({ ...formData, trademarkNumber: e.target.value })}
        />
      </form>
    </Modal>
  );
}

export function AnalyzeSocialQuickModal({ isOpen, onClose, onAnalyzeSocial }) {
  const [formData, setFormData] = useState({
    platform: 'Telegram',
    handle: '',
    brand: 'Acme Financial Global',
    violation: 'Phishing Lure & Bot Scam'
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (!formData.handle.trim()) {
      setError('Please provide a profile handle or URL to analyze.');
      return;
    }
    setError('');
    setIsAnalyzing(true);

    setTimeout(() => {
      onAnalyzeSocial({
        platform: formData.platform,
        handle: formData.handle.trim(),
        brand: formData.brand,
        violation: formData.violation
      });
      setIsAnalyzing(false);
      setFormData({
        platform: 'Telegram',
        handle: '',
        brand: 'Acme Financial Global',
        violation: 'Phishing Lure & Bot Scam'
      });
      onClose();
    }, 1100);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Action: Analyze Social Profile"
      description="Run simulated forensic heuristics to identify brand impersonation and scam bot activity."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isAnalyzing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAnalyze}
            isLoading={isAnalyzing}
            leftIcon={Share2}
          >
            {isAnalyzing ? 'Scoring Profile Heuristics...' : 'Run Profile Analysis'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleAnalyze} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Social Platform"
            value={formData.platform}
            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
            options={[
              { value: 'Telegram', label: 'Telegram' },
              { value: 'X (Twitter)', label: 'X (Twitter)' },
              { value: 'LinkedIn', label: 'LinkedIn' },
              { value: 'Instagram', label: 'Instagram' },
              { value: 'Facebook', label: 'Facebook' },
              { value: 'TikTok', label: 'TikTok' }
            ]}
          />
          <Select
            label="Associated Protected Brand"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            options={[
              { value: 'Acme Financial Global', label: 'Acme Financial Global' },
              { value: 'AcmePay Mobile', label: 'AcmePay Mobile' },
              { value: 'Acme Cloud Infrastructure', label: 'Acme Cloud Infrastructure' },
              { value: 'Jane Doe (CEO & Founder)', label: 'Jane Doe (CEO)' }
            ]}
          />
        </div>

        <Input
          label="Profile Handle or Public URL"
          placeholder="e.g. @AcmePay_Support_Desk or t.me/AcmePayHelp"
          required
          value={formData.handle}
          onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
          helperText="Simulated pipeline will extract bio metadata, creation date, and logo similarity."
        />

        <Select
          label="Suspected Infringement Pattern"
          value={formData.violation}
          onChange={(e) => setFormData({ ...formData, violation: e.target.value })}
          options={[
            { value: 'Phishing Lure & Bot Scam', label: 'Phishing Lure & Bot Scam' },
            { value: 'Trademark Logo & Identity Squatting', label: 'Trademark Logo & Identity Squatting' },
            { value: 'Executive VIP Impersonation', label: 'Executive VIP Impersonation' },
            { value: 'Malicious Attachment Distribution', label: 'Malicious Attachment Distribution' }
          ]}
        />
      </form>
    </Modal>
  );
}

export function AnalyzeAppQuickModal({ isOpen, onClose, onAnalyzeApp }) {
  const [formData, setFormData] = useState({
    appName: '',
    store: 'APKPure',
    packageId: '',
    sha256: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (!formData.appName.trim() || !formData.packageId.trim()) {
      setError('Please provide both the app name and package identifier.');
      return;
    }
    setError('');
    setIsAnalyzing(true);

    setTimeout(() => {
      onAnalyzeApp({
        appName: formData.appName.trim(),
        store: formData.store,
        packageId: formData.packageId.trim(),
        sha256: formData.sha256.trim() || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      });
      setIsAnalyzing(false);
      setFormData({
        appName: '',
        store: 'APKPure',
        packageId: '',
        sha256: ''
      });
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Action: Analyze Mobile App / APK"
      description="Scan candidate application packages across alternative repositories for trojan overlays and permission abuse."
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isAnalyzing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleAnalyze}
            isLoading={isAnalyzing}
            leftIcon={Smartphone}
          >
            {isAnalyzing ? 'Inspecting Binary Manifest...' : 'Run App Sandbox Analysis'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleAnalyze} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Candidate App Name"
            placeholder="e.g. Acme Quick Loans"
            required
            value={formData.appName}
            onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
          />
          <Select
            label="App Repository / Store"
            value={formData.store}
            onChange={(e) => setFormData({ ...formData, store: e.target.value })}
            options={[
              { value: 'APKPure', label: 'APKPure Mirror' },
              { value: 'Aptoide', label: 'Aptoide Marketplace' },
              { value: 'APKMirror', label: 'APKMirror Archive' },
              { value: 'Google Play Copycat', label: 'Google Play Clone Store' },
              { value: 'Direct Torrent Mirror', label: 'Direct Torrent Mirror' }
            ]}
          />
        </div>

        <Input
          label="Android Package ID"
          placeholder="e.g. com.acmepay.quickloan.secure"
          required
          value={formData.packageId}
          onChange={(e) => setFormData({ ...formData, packageId: e.target.value })}
          helperText="Reverse DNS package namespace from the app manifest."
        />

        <Input
          label="SHA-256 Checksum Hash (Optional)"
          placeholder="e.g. 9f83ab2140d398a87612f0e01869e8b93902187b5a83b271891a030182ec79b1"
          value={formData.sha256}
          onChange={(e) => setFormData({ ...formData, sha256: e.target.value })}
        />
      </form>
    </Modal>
  );
}
