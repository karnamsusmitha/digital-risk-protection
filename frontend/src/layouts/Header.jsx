import React, { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Menu,
  Bell,
  ChevronRight,
  Shield,
  Radar,
  User,
  Key,
  BookOpen,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { NAV_ITEMS, INTEGRATION_ITEMS } from '../utils/constants';
import { apiService } from '../services/api';

export default function Header({ onToggleSidebar }) {
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const [apiHealth, setApiHealth] = useState({ ok: false, checked: false, isDemo: true });

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    apiService.checkHealth().then((health) => {
      if (isMounted) setApiHealth({ ...health, checked: true });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ALL_ITEMS = [...NAV_ITEMS, ...(INTEGRATION_ITEMS || [])];
  const currentNav =
    ALL_ITEMS.find(
      (item) =>
        item.path === location.pathname ||
        (item.path === '/overview' && location.pathname === '/')
    ) || {
      name: 'Console',
      description: 'Digital Risk Protection Operations'
    };

  const handleRunScan = () => {
    setIsScanning(true);
    setScanMessage('Scanning 1,428 domains, stores & social feeds...');
    setTimeout(() => {
      setIsScanning(false);
      setScanMessage('Live threat scan complete — 0 new critical zero-days.');
      setTimeout(() => setScanMessage(null), 4000);
    }, 1800);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 transition-all">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Button + Breadcrumbs & Title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium leading-none mb-1">
              <Link to="/overview" className="hover:text-blue-600 transition-colors">
                DRP Platform
              </Link>
              <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
              <span className="text-slate-600 font-semibold truncate">{currentNav.name}</span>
            </nav>

            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug truncate">
              {currentNav.name}
            </h1>
          </div>
        </div>

        {/* Right Side: Backend API Status + Global Scan Trigger + Notifications + Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Backend API Health Status */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              apiHealth.ok
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={`FastAPI Gateway: ${apiService.API_BASE_URL} (${
              apiHealth.ok
                ? `Connected (${apiHealth.latencyMs}ms round-trip)`
                : 'Backend offline - Local sandbox active'
            })`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                apiHealth.ok ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-mono text-[10px]">
              {apiHealth.ok ? `API: ${apiHealth.latencyMs}ms` : 'Demo Sandbox'}
            </span>
          </div>

          {/* Quick Scan Action */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunScan}
              disabled={isScanning}
              className="hidden md:inline-flex border-slate-300"
            >
              {isScanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <Radar className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span className="text-xs">{isScanning ? 'Scanning...' : 'Trigger Scan'}</span>
            </Button>

            {scanMessage && (
              <div className="absolute right-0 top-11 z-50 bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-slate-700 whitespace-nowrap animate-fade-in flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{scanMessage}</span>
              </div>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-fade-in">
                <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Security Alerts
                    </span>
                    <Badge severity="critical" size="xs">
                      2 Critical
                    </Badge>
                  </div>
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  <div className="p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        Punycode Phishing Domain Live
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        xn--acm-7la-login.com with MX records active
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block">14 mins ago</span>
                    </div>
                  </div>

                  <div className="p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        Fake Telegram Channel Identified
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        @AcmePay_Support_Desk targeting seed phrases
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block">42 mins ago</span>
                    </div>
                  </div>
                </div>

                <div className="px-4 pt-2.5 border-t border-slate-100 text-center">
                  <Link
                    to="/findings"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View All Threat Findings &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-slate-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors"
              aria-label="User profile menu"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                SC
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-900 leading-tight">Sarah Chen</p>
                <p className="text-[10px] text-slate-500 font-medium">SecOps Lead</p>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">Sarah Chen</p>
                  <p className="text-[11px] text-slate-500 truncate">sarah.chen@acmefinancial.com</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] text-emerald-700 font-medium">SOC Tier 3 Active</span>
                  </div>
                </div>

                <div className="py-1">
                  <a
                    href="#settings"
                    onClick={(e) => {
                      e.preventDefault();
                      setProfileOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>Analyst Profile</span>
                  </a>
                  <a
                    href="#api-keys"
                    onClick={(e) => {
                      e.preventDefault();
                      setProfileOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Key className="w-4 h-4 text-slate-400" />
                    <span>API & Webhook Keys</span>
                  </a>
                  <a
                    href="#docs"
                    onClick={(e) => {
                      e.preventDefault();
                      setProfileOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span>SOC Playbook & Docs</span>
                  </a>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
