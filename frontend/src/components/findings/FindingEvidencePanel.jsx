import React, { useState, useEffect } from 'react';
import SlideOver from '../common/SlideOver';
import Badge from '../common/Badge';
import Button from '../common/Button';
import {
  ExternalLink,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Share2,
  Smartphone,
  Globe,
  Building,
  Calendar,
  Lock,
  Layers,
  Sparkles,
  Radio,
  FileCheck2,
  Copy,
  Check
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

export default function FindingEvidencePanel({
  isOpen,
  onClose,
  finding,
  onUpdateReview,
  onTriggerTakedown
}) {
  const [selectedStatus, setSelectedStatus] = useState('New');
  const [analystNotes, setAnalystNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (finding) {
      setSelectedStatus(finding.review?.status || 'New');
      setAnalystNotes(finding.review?.analystNotes || '');
    }
  }, [finding]);

  if (!finding) return null;

  const isSocial = finding.assetType === 'Social Profile';
  const isApp = finding.assetType === 'Mobile App';

  const handleSave = async (statusOverride = null) => {
    const nextStatus = statusOverride || selectedStatus;
    setIsSaving(true);
    await onUpdateReview(finding, {
      status: nextStatus,
      analystNotes: analystNotes.trim(),
      reviewedBy: 'Lead SecOps Analyst (You)'
    });
    setSelectedStatus(nextStatus);
    setIsSaving(false);
  };

  const copySha256 = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const isSourceAvailable = finding.sourceStatus === 'available' && Boolean(finding.sourceUrl);

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={finding.candidateName}
      subtitle={`${finding.assetType} • Matched Brand: ${finding.matchedBrand}`}
      width="max-w-3xl"
    >
      <div className="space-y-6 text-xs pb-6">
        {/* TOP COMPOSITE RISK BANNER */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              {isSocial ? (
                <Share2 className="w-5 h-5 text-blue-400" />
              ) : isApp ? (
                <Smartphone className="w-5 h-5 text-indigo-400" />
              ) : (
                <Globe className="w-5 h-5 text-sky-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-tight">
                  {finding.candidateName}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {finding.platform}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {finding.identifier}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block">
                Backend Risk Score
              </span>
              <span className="text-2xl font-black text-rose-400 font-mono">
                {finding.riskScore}
                <span className="text-xs text-slate-400 font-normal">/100</span>
              </span>
            </div>
            <Badge severity={finding.severity} size="md" withDot={true} />
          </div>
        </div>

        {/* CANDIDATE IDENTITY & SOURCE AVAILABILITY */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-blue-600" />
              Candidate Identity & Perimeter Source
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isSourceAvailable
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSourceAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {isSourceAvailable ? 'Source Active & Verified' : 'Source Offline / Unavailable'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div>
              <span className="text-slate-400 block">Candidate Identity:</span>
              <span className="font-semibold text-slate-800 font-mono">
                {finding.identifier}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Protected Target Brand:</span>
              <span className="font-semibold text-slate-800">
                {finding.matchedBrand}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Matched Official Asset:</span>
              <span className="font-semibold text-slate-700">
                {finding.matchedOfficialAsset}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Ingestion Source Feed:</span>
              <span className="font-semibold text-slate-700">
                {finding.source}
              </span>
            </div>
          </div>

          {/* Source URL with unavailable handling */}
          <div className="pt-2 border-t border-slate-200/80">
            <span className="text-slate-400 block text-[11px] mb-1">
              External Perimeter URL:
            </span>
            {isSourceAvailable ? (
              <a
                href={finding.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-mono text-[11px] break-all hover:underline"
              >
                <span>{finding.sourceUrl}</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Source Unavailable:</strong> Destination channel or web repository is currently unreachable, suspended by hosting provider, or no direct URL was extracted.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* INDIVIDUAL DETECTION SIGNALS & EVIDENCE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Multi-Factor Model Signals</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Backend Model Confidence: {Math.round((finding.aiConfidence || 0.9) * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Name Similarity Signal */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-center space-y-1">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Name Similarity
              </span>
              {finding.signals?.nameCheckStatus === 'performed' ? (
                <div>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {finding.signals.nameSimilarity}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">Levenshtein match</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic py-1">
                  Check Unavailable
                </div>
              )}
            </div>

            {/* Logo Visual Similarity Signal */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-center space-y-1">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Logo Visual Match
              </span>
              {finding.signals?.logoCheckStatus === 'performed' ? (
                <div>
                  <span className="text-xl font-bold font-mono text-rose-600">
                    {finding.signals.logoSimilarity}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">pHash similarity</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic py-1" title="No candidate logo provided for visual hash comparison">
                  Unavailable (No Icon)
                </div>
              )}
            </div>

            {/* Description / Content Similarity Signal */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-center space-y-1">
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
                Content Similarity
              </span>
              {finding.signals?.descriptionCheckStatus === 'performed' ? (
                <div>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {finding.signals.descriptionSimilarity}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">Lexical token overlap</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic py-1">
                  {isSocial ? 'Not Benchmarked' : 'Unavailable'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DOMAIN EVIDENCE */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Globe className="w-4 h-4 text-blue-600" />
            <span>Domain & Perimeter Host Evidence</span>
          </div>

          {finding.domainEvidence?.status === 'available' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
              <div>
                <span className="text-slate-400 block">Extracted Host / URL:</span>
                <span className="font-mono text-rose-700 font-semibold break-all">
                  {finding.domainEvidence.detectedUrl}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Resolved IP / Perimeter:</span>
                <span className="font-mono text-slate-700">
                  {finding.domainEvidence.ipResolved}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block">Domain Risk Classification:</span>
                <span className="font-semibold text-slate-800">
                  {finding.domainEvidence.domainRisk}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px] text-slate-500 italic">
              {finding.domainEvidence?.note || 'No external domain evidence identified or perimeter scan was unavailable.'}
            </div>
          )}
        </div>

        {/* PUBLISHER EVIDENCE (MOBILE APP ONLY) */}
        {isApp && (
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-indigo-600" />
                <span>Publisher & Binary Verification</span>
              </span>
              {finding.publisherEvidence?.publisherMismatch ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Publisher Mismatch (Advisory)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Publisher Matched
                </span>
              )}
            </div>

            <div className="p-3 bg-amber-50/70 rounded-lg border border-amber-200/70 text-[11px] text-amber-900 leading-relaxed">
              <strong>Analyst Guardrail:</strong> In accordance with platform policy, different publisher alone is <strong>never conclusive evidence of fraud</strong>. Corporate entities routinely operate through subsidiaries, regional vendors, or co-branding partners.
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-slate-400 block">Candidate Developer:</span>
                <span className="font-semibold text-slate-900">
                  {finding.publisherEvidence?.candidatePublisher || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Official Benchmark Publisher:</span>
                <span className="font-semibold text-slate-700">
                  {finding.publisherEvidence?.officialPublisher || 'Protected Brand'}
                </span>
              </div>
            </div>

            {/* SHA-256 Fingerprint */}
            {finding.appTelemetry?.sha256 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">APK SHA-256:</span>
                <button
                  type="button"
                  onClick={() => copySha256(finding.appTelemetry.sha256)}
                  className="text-blue-600 hover:text-blue-800 font-mono text-[10px] flex items-center gap-1"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>{finding.appTelemetry.sha256.substring(0, 16)}...</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* AUTOMATED MODEL DETECTION REASONS */}
        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60 space-y-2.5">
          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Detection Signals & Explanations
          </span>

          <ul className="space-y-1.5 text-[11px] text-slate-700">
            {finding.detectionReasons?.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                <span className="leading-relaxed">{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* TIMESTAMP & AUDIT TELEMETRY */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Ingestion Date: <strong>{formatDate(finding.detectedAt)}</strong> ({formatRelativeTime(finding.detectedAt)})
            </span>
          </div>
          <span className="font-mono text-slate-400">
            Engine: {finding._isRemote ? 'Live REST API' : 'Local Heuristic Sandbox'}
          </span>
        </div>

        {/* ANALYST REVIEW WORKFLOW & ACTIONS */}
        <div className="p-5 rounded-xl border border-slate-300 bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                Analyst Review & Triage
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Human verification overrides model scores. Confirm whether this finding requires takedown or is a false positive.
              </p>
            </div>
            <Badge status={finding.review?.status || 'new'} size="md" />
          </div>

          {/* Quick Review Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-2">
              Update Status Decision:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                variant={selectedStatus === 'New' ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setSelectedStatus('New')}
              >
                New
              </Button>
              <Button
                variant={selectedStatus === 'Needs Review' ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setSelectedStatus('Needs Review')}
                title="Triage candidate for secondary investigation"
              >
                Needs Review (Triage)
              </Button>
              <Button
                variant={selectedStatus === 'Confirmed Suspicious' ? 'danger' : 'outline'}
                size="xs"
                onClick={() => setSelectedStatus('Confirmed Suspicious')}
                title="Confirm malicious infringement and approve takedown"
              >
                Confirmed (Takedown)
              </Button>
              <Button
                variant={selectedStatus === 'False Positive' ? 'secondary' : 'outline'}
                size="xs"
                onClick={() => setSelectedStatus('False Positive')}
                title="Dismiss candidate as false positive or authorized asset"
              >
                False Positive (Dismiss)
              </Button>
            </div>
          </div>

          {/* Analyst Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Analyst Investigation Notes:
            </label>
            <textarea
              rows={3}
              placeholder="Record forensic review justification, evidence links, or affiliate whitelist rationales..."
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Review Audit Trail */}
          {finding.review?.reviewedBy && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Last reviewed by <strong>{finding.review.reviewedBy}</strong> on {formatDate(finding.review.reviewedAt)}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            {selectedStatus === 'Confirmed Suspicious' ? (
              <Button
                variant="danger"
                size="sm"
                leftIcon={ShieldAlert}
                onClick={() => onTriggerTakedown(finding)}
              >
                Dispatch Enforcement Takedown
              </Button>
            ) : (
              <span className="text-[11px] text-slate-400">
                Mark as "Confirmed Suspicious" to file enforcement notices.
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
                onClick={() => handleSave()}
              >
                Save Review
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SlideOver>
  );
}
