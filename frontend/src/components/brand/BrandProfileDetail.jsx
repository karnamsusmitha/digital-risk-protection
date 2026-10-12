import React from 'react';
import Card, { CardHeader, CardTitle, CardContent, CardFooter } from '../common/Card';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Globe,
  ExternalLink,
  Share2,
  Smartphone,
  Edit,
  Trash2,
  Mail,
  CheckCircle2,
  Layers,
  Database,
  Calendar,
  Building
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

export default function BrandProfileDetail({
  profile,
  onEdit,
  onDelete
}) {
  if (!profile) return null;

  return (
    <Card className="border-slate-200/90 shadow-xs">
      {/* Detail Header */}
      <CardHeader
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(profile)}
              leftIcon={Edit}
            >
              Edit Profile
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(profile.id, profile.name)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              leftIcon={Trash2}
            >
              Delete
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-4">
          {/* Brand Logo or Placeholder */}
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt={`${profile.name} Logo`}
                className="w-full h-full object-contain"
              />
            ) : (
              <Building className="w-7 h-7 text-slate-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <CardTitle className="text-lg">{profile.name}</CardTitle>
              <Badge status={profile.status} size="xs" />
              <Badge variant="blue" size="xs">
                {profile.tier}
              </Badge>
              {profile._isRemote ? (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Remote API Synced
                </span>
              ) : (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Local Sandbox Cache
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="font-medium text-slate-700">{profile.type}</span>
              <span>&bull;</span>
              <a
                href={profile.officialWebsite}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 font-mono"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{profile.officialDomain}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {profile.primaryContact && (
                <>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{profile.primaryContact}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Metric Badges Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Official Domain</span>
            <span className="font-mono font-bold text-slate-900 truncate block">
              {profile.officialDomain}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Social Channels</span>
            <span className="font-bold text-slate-900 font-mono">
              {profile.socialAccounts?.length || 0} Registered
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Mobile Packages</span>
            <span className="font-bold text-slate-900 font-mono">
              {profile.mobileApps?.length || 0} Verified
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Trademark Serial</span>
            <span className="font-mono font-semibold text-slate-700 truncate block">
              {profile.identifiers?.trademarkNumber || 'N/A'}
            </span>
          </div>
        </div>

        {/* Section: Official Social Accounts */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <Share2 className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Verified Social Accounts ({profile.socialAccounts?.length || 0})
            </h4>
          </div>

          {profile.socialAccounts && profile.socialAccounts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.socialAccounts.map((acc, i) => (
                <div
                  key={acc.id || i}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{acc.platform}</span>
                      {acc.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                    </div>
                    <p className="font-mono text-slate-600 text-[11px] truncate">{acc.handle}</p>
                  </div>

                  {acc.url && (
                    <a
                      href={acc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                      title="Open profile in new tab"
                      aria-label={`Open ${acc.handle} in new tab`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No official social accounts registered.</p>
          )}
        </div>

        {/* Section: Official Mobile Applications */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Authorized Mobile Applications ({profile.mobileApps?.length || 0})
            </h4>
          </div>

          {profile.mobileApps && profile.mobileApps.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {profile.mobileApps.map((app, i) => (
                <div
                  key={app.id || i}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{app.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-600">
                      {app.platform}
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-blue-600 truncate">{app.packageId}</p>
                  {app.publisher && (
                    <p className="text-[11px] text-slate-400">
                      Publisher: <span className="text-slate-600">{app.publisher}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No mobile application packages registered.</p>
          )}
        </div>

        {/* Section: Additional Identifiers */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
            <Layers className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Additional Corporate & Trademark Identifiers
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Trademark Serial</span>
              <span className="font-mono font-semibold text-slate-800">
                {profile.identifiers?.trademarkNumber || 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Stock Ticker</span>
              <span className="font-mono font-semibold text-slate-800">
                {profile.identifiers?.stockTicker || 'Private / Unlisted'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 block text-[11px]">Regulatory License</span>
              <span className="font-mono font-semibold text-slate-800">
                {profile.identifiers?.regulatoryLicense || 'N/A'}
              </span>
            </div>
          </div>

          {profile.identifiers?.alternateAliases && profile.identifiers.alternateAliases.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <span className="text-slate-400 block text-[11px] mb-1.5">
                Protected Aliases & Trademarks:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(profile.identifiers.alternateAliases)
                  ? profile.identifiers.alternateAliases
                  : [profile.identifiers.alternateAliases]
                ).map((alias, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-xs font-medium"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.notes && (
            <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-100 text-xs">
              <span className="font-semibold text-blue-900 block mb-0.5">SOC Operational Context</span>
              <p className="text-blue-800 leading-relaxed text-[11px]">{profile.notes}</p>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          Enrolled {formatDate(profile.createdAt)} &bull; Updated {formatDate(profile.updatedAt)}
        </span>
        <span className="font-mono text-[11px]">ID: {profile.id}</span>
      </CardFooter>
    </Card>
  );
}
