import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Search,
  CheckCircle2,
  RefreshCw,
  Building,
  Database,
  Code2,
  ChevronRight
} from 'lucide-react';
import { brandProfileService } from '../services/brandProfileService';
import Card, { CardHeader, CardTitle, CardDescription, CardFooter } from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import LoadingState from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorMessage';
import BrandProfileForm from '../components/brand/BrandProfileForm';
import BrandProfileDetail from '../components/brand/BrandProfileDetail';

export default function BrandProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isBackendOnline, setIsBackendOnline] = useState(false);

  // Selection & UI Mode: 'view' | 'edit' | 'create'
  const [selectedId, setSelectedId] = useState(null);
  const [uiMode, setUiMode] = useState('view'); // 'view' | 'edit' | 'create'
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  // Modals & Feedback
  const [isApiContractModalOpen, setIsApiContractModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Load profiles from dedicated frontend service
  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const [backendCheck, result] = await Promise.all([
        brandProfileService.checkBackendConnection(),
        brandProfileService.getProfiles()
      ]);
      setIsBackendOnline(backendCheck);
      setProfiles(result.data);

      // Select first profile if none selected
      if (!selectedId && result.data.length > 0) {
        setSelectedId(result.data[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load brand profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    const handleUpdate = () => {
      loadProfiles();
    };
    window.addEventListener('drp_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('drp_data_updated', handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProfile = profiles.find((p) => p.id === selectedId) || profiles[0] || null;

  // Handle switching selected brand
  const handleSelectProfile = (id) => {
    if (isFormDirty) {
      if (
        !window.confirm(
          'You have unsaved form changes on the current profile. Discard changes and switch?'
        )
      ) {
        return;
      }
    }
    setSelectedId(id);
    setUiMode('view');
    setIsFormDirty(false);
  };

  // Handle starting Creation Mode
  const handleStartCreate = () => {
    if (isFormDirty) {
      if (
        !window.confirm(
          'You have unsaved form changes. Discard them to register a new brand profile?'
        )
      ) {
        return;
      }
    }
    setUiMode('create');
    setIsFormDirty(false);
  };

  // Handle starting Edit Mode
  const handleStartEdit = () => {
    setUiMode('edit');
    setIsFormDirty(false);
  };

  // Handle cancelling Form
  const handleCancelForm = () => {
    if (isFormDirty) {
      if (!window.confirm('Discard unsaved changes?')) {
        return;
      }
    }
    setUiMode('view');
    setIsFormDirty(false);
  };

  // Handle Form Submission (Create or Update)
  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      if (uiMode === 'create') {
        const result = await brandProfileService.createProfile(formData);
        setProfiles((prev) => [result.data, ...prev]);
        setSelectedId(result.data.id);
        setUiMode('view');
        setIsFormDirty(false);
        showToast(
          result.isRemote
            ? `Brand "${formData.name}" saved to remote backend database.`
            : `Brand "${formData.name}" stored in local sandbox (Backend API not connected).`
        );
      } else if (uiMode === 'edit') {
        const result = await brandProfileService.updateProfile(selectedId, formData);
        setProfiles((prev) =>
          prev.map((p) => (p.id === selectedId ? result.data : p))
        );
        setUiMode('view');
        setIsFormDirty(false);
        showToast(
          result.isRemote
            ? `Updated brand profile for "${formData.name}" via backend API.`
            : `Updated brand profile for "${formData.name}" in local sandbox.`
        );
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drp_data_updated', { detail: { type: 'brand_saved' } }));
      }
    } catch (err) {
      alert(`Error saving brand profile: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id, name) => {
    if (
      window.confirm(
        `Are you sure you want to retire perimeter protection for "${name}"?\nAll associated social and mobile asset monitors will be archived.`
      )
    ) {
      await brandProfileService.deleteProfile(id);
      const remaining = profiles.filter((p) => p.id !== id);
      setProfiles(remaining);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
      } else {
        setSelectedId(null);
        setUiMode('create');
      }
      showToast(`Removed brand profile: ${name}`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('drp_data_updated', { detail: { type: 'brand_deleted' } }));
      }
    }
  };

  // Filtered profiles list
  const filteredProfiles = profiles.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.officialDomain.toLowerCase().includes(q) ||
      (p.identifiers?.trademarkNumber &&
        p.identifiers.trademarkNumber.toLowerCase().includes(q));
    const matchesTier =
      tierFilter === 'all' || p.tier.toLowerCase().includes(tierFilter.toLowerCase());
    return matchesSearch && matchesTier;
  });

  if (loading && profiles.length === 0) {
    return <LoadingState message="Loading registered brand profiles and official perimeter assets..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadProfiles} />;
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-slide-up"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Backend API Contract Coordination Banner */}
      <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Database className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-100">Backend API Integration Status:</span>
              {isBackendOnline ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REST API Connected
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Local Sandbox Cache (Backend Awaiting Member 2)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Contract prepared for endpoints <code className="text-blue-300 font-mono">/api/v1/brand-profiles</code>.
              Data is preserved locally in browser storage when backend is offline.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsApiContractModalOpen(true)}
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-slate-800 hover:bg-slate-750 px-2.5 py-1.5 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>View API Contract</span>
          </button>
          <button
            onClick={loadProfiles}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh backend status"
            aria-label="Refresh backend status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Page Title & Main Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Protected Brand Profiles & Official Assets
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Register and manage authorized apex domains, official social handles, and verified mobile applications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartCreate}
            leftIcon={Plus}
          >
            Register Brand Profile
          </Button>
        </div>
      </div>

      {/* Main Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: List of Saved Brands (5 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader
              action={
                <span className="text-xs font-mono font-bold text-slate-500">
                  {profiles.length} Total
                </span>
              }
            >
              <CardTitle className="text-sm">Saved Brand Profiles</CardTitle>
              <CardDescription>Select a profile to view or edit official assets.</CardDescription>
            </CardHeader>

            {/* Search & Tier Filters */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 space-y-2">
              <Input
                placeholder="Search brand, domain, trademark..."
                startIcon={Search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
                {['all', 'Tier 1', 'Tier 2', 'Tier 3'].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setTierFilter(tier.toLowerCase())}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors whitespace-nowrap ${
                      tierFilter === tier.toLowerCase()
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Brand Profiles List */}
            <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((p) => {
                  const isSelected = selectedId === p.id && uiMode !== 'create';

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProfile(p.id)}
                      className={`p-3.5 transition-all cursor-pointer flex items-start gap-3 select-none ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-blue-600'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Logo Thumbnail */}
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                        {p.logoUrl ? (
                          <img
                            src={p.logoUrl}
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Building className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{p.name}</h4>
                          <ChevronRight
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected ? 'text-blue-600' : 'text-slate-300'
                            }`}
                          />
                        </div>

                        <p className="text-[11px] font-mono text-blue-600 truncate">
                          {p.officialDomain}
                        </p>

                        <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                            {p.socialAccounts?.length || 0} Social
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-medium">
                            {p.mobileApps?.length || 0} Apps
                          </span>
                          {p.tier.includes('Tier 1') && (
                            <span className="text-rose-600 font-semibold">Tier 1</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>No matching brand profiles.</p>
                </div>
              )}
            </div>

            <CardFooter className="justify-between text-[11px]">
              <span className="text-slate-400">
                {isBackendOnline ? 'Synced with API' : 'Cached in Local Storage'}
              </span>
              <button
                onClick={handleStartCreate}
                className="text-blue-600 hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Profile</span>
              </button>
            </CardFooter>
          </Card>
        </div>

        {/* RIGHT COLUMN: Detail Viewer OR Interactive Form (8 cols) */}
        <div className="lg:col-span-8">
          {uiMode === 'create' ? (
            /* Creation Mode */
            <BrandProfileForm
              initialData={null}
              isEditMode={false}
              onSubmit={handleFormSubmit}
              onCancel={() => {
                if (profiles.length > 0) {
                  setUiMode('view');
                }
              }}
              isSubmitting={isSubmitting}
              onDirtyChange={(dirty) => setIsFormDirty(dirty)}
            />
          ) : uiMode === 'edit' && selectedProfile ? (
            /* Edit Mode */
            <BrandProfileForm
              initialData={selectedProfile}
              isEditMode={true}
              onSubmit={handleFormSubmit}
              onCancel={handleCancelForm}
              isSubmitting={isSubmitting}
              onDirtyChange={(dirty) => setIsFormDirty(dirty)}
            />
          ) : selectedProfile ? (
            /* View Mode */
            <BrandProfileDetail
              profile={selectedProfile}
              onEdit={handleStartEdit}
              onDelete={handleDelete}
            />
          ) : (
            /* Empty State */
            <Card className="p-12 text-center">
              <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <CardTitle>No Brand Profile Selected</CardTitle>
              <CardDescription>
                Register your enterprise brand identity and official assets to activate digital risk surveillance.
              </CardDescription>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartCreate}
                className="mt-4"
                leftIcon={Plus}
              >
                Create Brand Profile
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Backend API Contract Specification Modal (For Member 2 Coordination) */}
      <Modal
        isOpen={isApiContractModalOpen}
        onClose={() => setIsApiContractModalOpen(false)}
        title="Brand Profiles REST API Contract Specification"
        description="Agreed REST endpoints and schema definition for Member 2 (Backend Developer)."
        maxWidth="max-w-2xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsApiContractModalOpen(false)}>
            Close Specification
          </Button>
        }
      >
        <div className="space-y-4 text-xs font-sans text-slate-700">
          <p className="text-slate-600 leading-relaxed">
            The frontend service is fully wired to consume these agreed endpoints. When your Express / FastAPI / NestJS backend is deployed, configure <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-700">VITE_API_BASE_URL</code> in the frontend environment.
          </p>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              1. Agreed REST Endpoints
            </h4>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-600 mr-2">GET</span>
                  <span className="text-slate-800">/api/v1/brand-profiles</span>
                </div>
                <span className="text-slate-400">List all brand profiles</span>
              </div>
              <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-600 mr-2">POST</span>
                  <span className="text-slate-800">/api/v1/brand-profiles</span>
                </div>
                <span className="text-slate-400">Create brand profile</span>
              </div>
              <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-600 mr-2">GET</span>
                  <span className="text-slate-800">/api/v1/brand-profiles/:id</span>
                </div>
                <span className="text-slate-400">Get profile details</span>
              </div>
              <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-600 mr-2">PUT</span>
                  <span className="text-slate-800">/api/v1/brand-profiles/:id</span>
                </div>
                <span className="text-slate-400">Update brand profile</span>
              </div>
              <div className="p-2 rounded bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-600 mr-2">DELETE</span>
                  <span className="text-slate-800">/api/v1/brand-profiles/:id</span>
                </div>
                <span className="text-slate-400">Delete brand profile</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              2. JSON Entity Payload Schema
            </h4>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto leading-relaxed">
{`{
  "id": "string (uuid / slug)",
  "name": "string (required)",
  "officialDomain": "string (required)",
  "officialWebsite": "string (url)",
  "logoUrl": "string (url / base64)",
  "type": "Corporate Entity | Consumer FinTech Product | B2B Enterprise SaaS | Executive VIP",
  "tier": "Tier 1 - Mission Critical | Tier 2 - High Priority | Tier 3 - Standard",
  "status": "active | monitoring | suspended",
  "primaryContact": "string (email)",
  "socialAccounts": [
    { "platform": "string", "handle": "string", "url": "string", "verified": boolean }
  ],
  "mobileApps": [
    { "name": "string", "packageId": "string", "platform": "string", "publisher": "string" }
  ],
  "identifiers": {
    "trademarkNumber": "string",
    "stockTicker": "string",
    "regulatoryLicense": "string",
    "alternateAliases": ["string"]
  },
  "notes": "string"
}`}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
