import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Globe,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  UserCheck,
  Send,
  Calendar,
  Image as ImageIcon,
  Save
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const REVIEW_STATUS_OPTIONS = [
  {
    id: 'New',
    label: 'New (Unreviewed)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Raw automated detection requiring initial assessment.'
  },
  {
    id: 'Needs Review',
    label: 'Needs Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Escalated for secondary forensic investigation.'
  },
  {
    id: 'Confirmed Suspicious',
    label: 'Confirmed Suspicious',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Confirmed malicious impersonator. Ready for platform abuse takedown.'
  },
  {
    id: 'False Positive',
    label: 'False Positive',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Legitimate fan account, unaffiliated entity, or authorized partner.'
  }
];

export default function CandidateDetailModal({
  isOpen,
  onClose,
  candidate,
  onUpdateReview,
  onIssueTakedown
}) {
  const [selectedStatus, setSelectedStatus] = useState('New');
  const [analystNotes, setAnalystNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (candidate) {
      setSelectedStatus(candidate.review?.status || 'New');
      setAnalystNotes(candidate.review?.analystNotes || '');
    }
  }, [candidate]);

  if (!candidate) return null;

  const { modelEvidence, review } = candidate;

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdateReview(candidate.id, {
      status: selectedStatus,
      analystNotes: analystNotes.trim()
    });
    setIsSaving(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Candidate Profile: ${candidate.profileName}`}
      description={`Matched against protected perimeter of "${candidate.matchedBrand}"`}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              Analyst: {review?.reviewedBy || 'Sarah Chen (Lead SecOps)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>

            {selectedStatus === 'Confirmed Suspicious' && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onIssueTakedown(candidate)}
                leftIcon={Send}
              >
                Issue Platform Takedown
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={Save}
            >
              Save Review Decision
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6 text-xs font-sans text-slate-700">
        {/* Candidate Profile Summary Header */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
              {candidate.logoUrl ? (
                <img
                  src={candidate.logoUrl}
                  alt={candidate.profileName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-300" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-900">{candidate.profileName}</h4>
                <span className="px-1.5 py-0.5 rounded bg-slate-200/80 font-mono text-[10px] font-semibold text-slate-700">
                  {candidate.platform}
                </span>
              </div>
              <p className="font-mono text-blue-600 font-semibold mt-0.5">{candidate.handle}</p>
              {candidate.url && (
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 mt-0.5 underline"
                >
                  <span className="truncate max-w-xs">{candidate.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] text-slate-400 block mb-1">Composite Risk Rating</span>
            <div className="flex items-center gap-2 justify-end">
              <span className="font-mono text-xl font-bold text-rose-600">
                {modelEvidence?.riskScore || 0}/100
              </span>
              <Badge severity={modelEvidence?.severity || 'info'} size="xs" withDot={true} />
            </div>
          </div>
        </div>

        {/* Bio / Description */}
        {candidate.description && (
          <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Profile Bio Content
            </span>
            <p className="leading-relaxed text-xs">{candidate.description}</p>
          </div>
        )}

        {/* SECTION 1: AI / HEURISTIC MODEL RESULTS (Explicitly Separated) */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                1. Automated Model Evidence & Heuristic Signals
              </h4>
            </div>
            <span className="text-[10px] text-blue-700 font-medium bg-blue-100/80 px-2 py-0.5 rounded-full">
              Automated Telemetry
            </span>
          </div>

          {/* Critical Policy Notice */}
          <div className="p-2.5 rounded-lg bg-blue-100/40 border border-blue-200 text-[11px] text-blue-900 leading-normal">
            <strong>Evaluation Standard:</strong> High name similarity alone does not constitute fraud. This model evaluates multi-factor signals (lexical distance, visual trademark pHash, bio keyword extraction, and destination domain risk).
          </div>

          {/* Model Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Name Similarity */}
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-slate-400 block text-[11px] mb-1">Name Similarity</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-slate-900">
                  {modelEvidence?.nameSimilarity}%
                </span>
                <span className="text-[10px] text-slate-500">Levenshtein match</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Compared to "{candidate.matchedBrand}"
              </p>
            </div>

            {/* Logo Similarity */}
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-slate-400 block text-[11px] mb-1">Logo Visual Similarity</span>
              {modelEvidence?.logoSimilarity !== null && modelEvidence?.logoSimilarity !== undefined ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold font-mono text-rose-600">
                    {modelEvidence.logoSimilarity}%
                  </span>
                  <span className="text-[10px] text-slate-500">pHash emblem match</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic block mt-1">
                  N/A (No logo provided)
                </span>
              )}
              <p className="text-[10px] text-slate-400 mt-1">Trademark perceptual hash</p>
            </div>

            {/* Source & AI Confidence */}
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <span className="text-slate-400 block text-[11px] mb-1">Model Confidence</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-emerald-600">
                  {Math.round((modelEvidence?.aiConfidence || 0.9) * 100)}%
                </span>
                <span className="text-[10px] text-slate-500">confidence rating</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                Source: {candidate.source}
              </p>
            </div>
          </div>

          {/* Domain Evidence (When available) */}
          {modelEvidence?.domainEvidence && (
            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>External Domain Evidence Correlated</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400 block">Destination URL:</span>
                  <span className="font-mono font-semibold text-slate-800 break-all">
                    {modelEvidence.domainEvidence.detectedUrl}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Resolved Host / IP:</span>
                  <span className="font-mono text-slate-700">
                    {modelEvidence.domainEvidence.ipResolved}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-rose-700 font-medium mt-1">
                Risk Classification: {modelEvidence.domainEvidence.domainRisk}
              </p>
            </div>
          )}

          {/* Detection Reasons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 block">
              Automated Heuristic Indicators
            </span>
            <ul className="space-y-1">
              {modelEvidence?.detectionReasons?.map((reason, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* SECTION 2: ANALYST REVIEW WORKFLOW (Human Decision Separation) */}
        <div className="p-4 rounded-xl border border-slate-300 bg-white space-y-4 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-slate-900" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Analyst Review Decision & Triage
              </h4>
            </div>
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Human Override
            </span>
          </div>

          {/* Status Radio Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 block">
              Set Review Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {REVIEW_STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatus === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedStatus(opt.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{opt.label}</span>
                      <input
                        type="radio"
                        name="review_status"
                        checked={isSelected}
                        onChange={() => setSelectedStatus(opt.id)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                      {opt.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analyst Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-800 block">
              Analyst Investigation Notes
            </label>
            <textarea
              rows={3}
              placeholder="Record forensic observations, takedown ticket references, or justification for false positive classification..."
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Prior Audit Log */}
          {review?.reviewedAt && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Last updated by <strong>{review.reviewedBy}</strong> on {formatDate(review.reviewedAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
