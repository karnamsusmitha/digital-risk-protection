export const NAV_ITEMS = [
  {
    name: 'Overview',
    path: '/overview',
    icon: 'LayoutDashboard',
    description: 'Executive security posture & real-time risk telemetry'
  },
  {
    name: 'Brand Profiles',
    path: '/brand-profiles',
    icon: 'Shield',
    description: 'Protected corporate assets, VIPs & registered trademarks'
  },
  {
    name: 'Social Monitoring',
    path: '/social-monitoring',
    icon: 'Share2',
    description: 'Impersonation & rogue accounts across social platforms'
  },
  {
    name: 'App Monitoring',
    path: '/app-monitoring',
    icon: 'Smartphone',
    description: 'Rogue app listings, fake APKs & mobile store compliance'
  },
  {
    name: 'Findings',
    path: '/findings',
    icon: 'AlertTriangle',
    description: 'Investigate, triage and issue takedowns on detected threats'
  }
];

export const INTEGRATION_ITEMS = [
  {
    name: 'Registrar Abuse APIs',
    path: '/registrar-abuse',
    icon: 'Radio',
    description: 'Automated registrar takedown gateways, RDAP/WHOIS abuse lookup & RFC 2822 notice dispatch'
  },
  {
    name: 'Threat Intelligence Feed',
    path: '/threat-intelligence',
    icon: 'ExternalLink',
    description: 'Real-time threat feeds, active IoCs, phishing infrastructure tracking & perimeter defense telemetry'
  }
];

export const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-600',
    bgClass: 'bg-rose-500',
    borderClass: 'border-rose-200'
  },
  high: {
    label: 'High',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-600',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-200'
  },
  medium: {
    label: 'Medium',
    badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900',
    dotClass: 'bg-yellow-500',
    textClass: 'text-yellow-600',
    bgClass: 'bg-yellow-500',
    borderClass: 'border-yellow-200'
  },
  low: {
    label: 'Low',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
    dotClass: 'bg-blue-500',
    textClass: 'text-blue-600',
    bgClass: 'bg-blue-500',
    borderClass: 'border-blue-200'
  },
  info: {
    label: 'Info',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-600',
    bgClass: 'bg-slate-400',
    borderClass: 'border-slate-200'
  }
};

export const STATUS_CONFIG = {
  open: {
    label: 'Open',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500'
  },
  investigating: {
    label: 'Investigating',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500'
  },
  'takedown-requested': {
    label: 'Takedown Requested',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClass: 'bg-indigo-500'
  },
  'takedown-in-progress': {
    label: 'Takedown In Progress',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClass: 'bg-purple-500'
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  'false-positive': {
    label: 'False Positive',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400'
  },
  active: {
    label: 'Active Protection',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500'
  },
  monitoring: {
    label: 'Monitoring',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500'
  }
};

export const RISK_CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'domain-typosquat', label: 'Domain Typosquatting' },
  { id: 'social-impersonation', label: 'Social Impersonation' },
  { id: 'rogue-app', label: 'Rogue Mobile App' },
  { id: 'phishing-lure', label: 'Phishing Campaign' },
  { id: 'credential-leak', label: 'Dark Web Credential Leak' },
  { id: 'executive-spoof', label: 'Executive VIP Spoofing' }
];

export const TIMEFRAMES = [
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last Quarter' }
];
