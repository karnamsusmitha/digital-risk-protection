import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Button from '../common/Button';
import {
  Smartphone,
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Building,
  Box,
  Fingerprint,
  Info,
  Calendar,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const REVIEW_STATUS_OPTIONS = [
  {
    value: 'New',
    label: 'New (Unassigned)',
    description: 'Initial ingestion state, awaiting triage evaluation.'
  },
  {
    value: 'Needs Review',
    label: 'Needs Review',
    description: 'Assigned for reverse engineering, binary sandbox, or manual analyst inspection.'
  },
  {
    value: 'Confirmed Suspicious',
    label: 'Confirmed Suspicious',
    description: 'Verified fraudulent app, trojanized binary, or trademark infringement.'
  },
  {
    value: 'False Positive',
    label: 'False Positive',
    description: 'Legitimate authorized partner, utility, or non-infringing entity.'
  }
];

export default function AppComparisonModal({
  isOpen,
  onClose,
  candidate,
  onUpdateReview,
  onIssueTakedown
}) {
  const [selectedStatus, setSelectedStatus] = useState('New');
  const [analystNotes, setAnalystNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (candidate) {
      setSelectedStatus(candidate.review?.status || 'New');
      setAnalystNotes(candidate.review?.analystNotes || '');
    }
  }, [candidate]);

  if (!candidate) return null;

  const { comparativeAnalysis, review } = candidate;

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdateReview(candidate.id, {
      status: selectedStatus,
      analystNotes: analystNotes.trim()
    });
    setIsSaving(false);
  };

  const copySha256 = () => {
    if (candidate.sha256) {
      navigator.clipboard.writeText(candidate.sha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const isConfirmedSuspicious = selectedStatus === 'Confirmed Suspicious' || review?.status === 'Confirmed Suspicious';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Candidate vs Official App Comparison"
      description={`Comparative analysis against protected brand "${candidate.matchedBrand}" assets.`}
      size="2xl"
    >
      <div className="space-y-6">
        {/* MANDATORY POLICY ALERT BANNER */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider text-[11px] text-amber-800">
              Analyst Policy Notice — Publisher Evaluation Rule
            </span>
            <p className="leading-relaxed">
              <strong>Do not treat a different publisher name alone as conclusive evidence of fraud.</strong> Legitimate corporate brands routinely publish mobile utilities via operating subsidiaries, regional joint-ventures, localization agencies, or authorized co-branding partners. Enforcement takedowns require corroborating signals such as malicious code, unauthorized permissions, package squatting, or deceptive credential lures.
            </p>
          </div>
        </div>

        {/* TOP COMPOSITE RISK BANNER */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {candidate.appName}
                </h3>
                {candidate.storeUrl && (
                  <a
                    href={candidate.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-blue-400 transition-colors"
                    title="Open store listing in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target Brand: <strong className="text-slate-200">{candidate.matchedBrand}</strong> • Store: <span className="text-blue-300 font-medium">{candidate.store}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                Composite Risk
              </span>
              <span className="text-2xl font-black text-rose-400 font-mono">
                {comparativeAnalysis?.riskScore ?? 0}
                <span className="text-xs text-slate-400 font-normal">/100</span>
              </span>
            </div>
            <Badge severity={comparativeAnalysis?.severity || 'low'} size="md" withDot={true} />
          </div>
        </div>

        {/* SECTION 1: DETAILED SIDE-BY-SIDE COMPARISON TABLE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Side-by-Side Asset Comparison</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Comparing Candidate vs Registered Official Baseline
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white text-xs divide-y divide-slate-100">
            {/* Header row */}
            <div className="grid grid-cols-12 bg-slate-50 p-3 font-semibold text-slate-700 text-[11px]">
              <div className="col-span-3">Feature / Asset</div>
              <div className="col-span-4">Candidate Finding</div>
              <div className="col-span-3">Official Brand Baseline</div>
              <div className="col-span-2 text-right">Similarity / Signal</div>
            </div>

            {/* 1. App Title */}
            <div className="grid grid-cols-12 p-3 items-center gap-2 hover:bg-slate-50/50">
              <div className="col-span-3 font-medium text-slate-600 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                <span>App Title</span>
              </div>
              <div className="col-span-4 font-semibold text-slate-900 truncate">
                {candidate.appName}
              </div>
              <div className="col-span-3 text-slate-600 truncate">
                {candidate.officialAppName || 'None registered'}
              </div>
              <div className="col-span-2 text-right">
                <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                  (comparativeAnalysis?.nameSimilarity || 0) >= 80
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {comparativeAnalysis?.nameSimilarity ?? 0}% match
                </span>
              </div>
            </div>

            {/* 2. Logo / Icon */}
            <div className="grid grid-cols-12 p-3 items-center gap-2 hover:bg-slate-50/50">
              <div className="col-span-3 font-medium text-slate-600 flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-slate-400" />
                <span>Icon / Logo</span>
              </div>
              <div className="col-span-4 flex items-center gap-2.5">
                {candidate.logoUrl ? (
                  <img
                    src={candidate.logoUrl}
                    alt={candidate.appName}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                    <Smartphone className="w-4 h-4" />
                  </div>
                )}
                <span className="text-[11px] text-slate-600 truncate">
                  {candidate.logoUrl ? 'Uploaded Icon' : 'Icon not provided'}
                </span>
              </div>
              <div className="col-span-3 text-slate-500 text-[11px]">
                Official Brand Emblem
              </div>
              <div className="col-span-2 text-right">
                {comparativeAnalysis?.logoSimilarity !== null && comparativeAnalysis?.logoSimilarity !== undefined ? (
                  <span className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                    comparativeAnalysis.logoSimilarity >= 80
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {comparativeAnalysis.logoSimilarity}% visual
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">No icon data</span>
                )}
              </div>
            </div>

            {/* 3. Developer / Publisher */}
            <div className="grid grid-cols-12 p-3 items-center gap-2 hover:bg-slate-50/50">
              <div className="col-span-3 font-medium text-slate-600 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span>Publisher</span>
              </div>
              <div className="col-span-4 font-semibold text-slate-900 truncate">
                {candidate.publisher || 'Unknown Publisher'}
              </div>
              <div className="col-span-3 text-slate-600 truncate">
                {candidate.officialPublisher || candidate.matchedBrand}
              </div>
              <div className="col-span-2 text-right">
                {comparativeAnalysis?.publisherMismatch ? (
                  <span className="inline-block px-2 py-0.5 rounded font-medium text-[10px] bg-amber-100 text-amber-800 border border-amber-200" title="Advisory: Mismatch detected, but alone does not constitute fraud">
                    Differs (Advisory)
                  </span>
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded font-medium text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Matched
                  </span>
                )}
              </div>
            </div>

            {/* 4. Package Identifier */}
            <div className="grid grid-cols-12 p-3 items-center gap-2 hover:bg-slate-50/50">
              <div className="col-span-3 font-medium text-slate-600 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                <span>Package ID</span>
              </div>
              <div className="col-span-4 font-mono text-[11px] text-slate-800 truncate">
                {candidate.packageId || (
                  <span className="text-slate-400 italic">Package ID not provided</span>
                )}
              </div>
              <div className="col-span-3 font-mono text-[11px] text-slate-600 truncate">
                {candidate.officialPackageId || 'N/A'}
              </div>
              <div className="col-span-2 text-right">
                {comparativeAnalysis?.packageAnalysis?.isSquatted ? (
                  <span className="inline-block px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-200">
                    Squatted Prefix
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    {candidate.packageId ? 'Independent' : 'Unavailable'}
                  </span>
                )}
              </div>
            </div>

            {/* 5. Store Description */}
            <div className="grid grid-cols-12 p-3 items-start gap-2 hover:bg-slate-50/50">
              <div className="col-span-3 font-medium text-slate-600 flex items-center gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Description</span>
              </div>
              <div className="col-span-7 text-[11px] text-slate-600 leading-relaxed pr-2">
                {candidate.description ? (
                  <p className="line-clamp-2 italic">"{candidate.description}"</p>
                ) : (
                  <span className="text-slate-400 italic">No store description submitted.</span>
                )}
              </div>
              <div className="col-span-2 text-right pt-1">
                <span className="inline-block px-2 py-0.5 rounded font-mono font-medium text-[11px] bg-slate-100 text-slate-700">
                  {comparativeAnalysis?.descriptionSimilarity ?? 0}% text
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: BINARY & SOURCE EVIDENCE */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>Telemetry & Binary Evidence</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Permissions & Static Signatures */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-semibold text-slate-800 block text-[11px]">
                Invasive Android Permissions Requested:
              </span>
              {comparativeAnalysis?.sourceEvidence?.permissionsRequested?.length > 0 ? (
                <ul className="space-y-1 text-[11px] text-slate-700">
                  {comparativeAnalysis.sourceEvidence.permissionsRequested.map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 font-mono text-[10px]">
                      <span className="text-rose-500 font-bold shrink-0">•</span>
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400 italic">No invasive permissions detected.</p>
              )}
            </div>

            {/* Certificate & Store Distribution Risk */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div>
                <span className="font-semibold text-slate-800 block text-[11px]">
                  Store Channel Risk:
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {comparativeAnalysis?.sourceEvidence?.storeRisk || 'Standard App Store Distribution'}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-800 block text-[11px]">
                  Signing Certificate:
                </span>
                <p className="text-[11px] font-mono text-slate-600 mt-0.5">
                  {comparativeAnalysis?.sourceEvidence?.certificateStatus || 'Standard Key'}
                </p>
              </div>

              {comparativeAnalysis?.sourceEvidence?.c2ServerDetected && (
                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  <strong>High-Risk Network Host:</strong> {comparativeAnalysis.sourceEvidence.c2ServerDetected}
                </div>
              )}
            </div>
          </div>

          {/* SHA-256 Fingerprint */}
          {candidate.sha256 && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-700">APK SHA-256 Fingerprint:</span>
                <button
                  type="button"
                  onClick={copySha256}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-mono text-[10px]"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Hash</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2 rounded bg-slate-100 font-mono text-[10px] text-slate-700 break-all select-all">
                {candidate.sha256}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: AUTOMATED MODEL DETECTION REASONS */}
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Automated Model Detection Signals
            </span>
            <span className="text-[11px] font-mono text-blue-700">
              Confidence: {Math.round((comparativeAnalysis?.aiConfidence || 0.9) * 100)}%
            </span>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-700">
            {comparativeAnalysis?.detectionReasons?.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <span className="leading-relaxed">{reason}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-[11px] text-blue-800">
            <span>Detection Source: {candidate.source}</span>
            <span>Analyzed: {formatDate(candidate.detectedAt)}</span>
          </div>
        </div>

        {/* SECTION 4: HUMAN ANALYST REVIEW WORKFLOW (STRICT SEPARATION) */}
        <div className="p-5 rounded-xl border border-slate-300 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                Analyst Review Decision & Triage
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Human review overrides model predictions. Confirm whether the app is unauthorized or an authorized affiliate.
              </p>
            </div>
            <Badge status={review?.status || 'new'} size="md" />
          </div>

          {/* Status Radio / Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-2">
              Select Triage Status:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {REVIEW_STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedStatus === opt.value
                      ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reviewStatus"
                    value={opt.value}
                    checked={selectedStatus === opt.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-slate-800">
                      {opt.label}
                    </span>
                    <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">
                      {opt.description}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Analyst Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Analyst Investigation Notes & Rationale:
            </label>
            <textarea
              rows={3}
              placeholder="Document binary sandbox findings, store communications, or affiliate authorization verification..."
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Last Review Audit */}
          {review?.reviewedBy && (
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Last reviewed by <strong>{review.reviewedBy}</strong> on {formatDate(review.reviewedAt)}
              </span>
            </div>
          )}

          {/* Review Controls Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            {isConfirmedSuspicious ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={ShieldAlert}
                onClick={() => onIssueTakedown(candidate)}
              >
                File Store DMCA Takedown Notice
              </Button>
            ) : (
              <span className="text-[11px] text-slate-400">
                Mark as "Confirmed Suspicious" to unlock takedown escalation.
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={CheckCircle2}
                isLoading={isSaving}
                onClick={handleSave}
              >
                Save Review Decision
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
