import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Share2,
  Smartphone,
  AlertTriangle,
  ShieldCheck,
  Radio,
  ExternalLink,
  ChevronRight,
  X
} from 'lucide-react';
import { NAV_ITEMS } from '../utils/constants';
import { registrarAbuseService } from '../services/registrarAbuseService';
import { threatIntelService } from '../services/threatIntelService';

const ICON_MAP = {
  LayoutDashboard,
  Shield,
  Share2,
  Smartphone,
  AlertTriangle
};

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const [registrarStatus, setRegistrarStatus] = useState(() =>
    registrarAbuseService.getIntegrationStatusSync()
  );
  const [threatIntelStatus, setThreatIntelStatus] = useState(() =>
    threatIntelService.getFeedStatusSync()
  );

  useEffect(() => {
    let mounted = true;
    registrarAbuseService.getIntegrationStatus().then((status) => {
      if (mounted && status) setRegistrarStatus(status);
    });
    threatIntelService.getFeedStatus().then((status) => {
      if (mounted && status) setThreatIntelStatus(status);
    });

    const handleRegistrarStatusChange = (e) => {
      if (mounted && e.detail) setRegistrarStatus(e.detail);
    };
    const handleThreatIntelStatusChange = (e) => {
      if (mounted && e.detail) setThreatIntelStatus(e.detail);
    };

    window.addEventListener('drp_registrar_status_change', handleRegistrarStatusChange);
    window.addEventListener('drp_threat_intel_status_change', handleThreatIntelStatusChange);
    return () => {
      mounted = false;
      window.removeEventListener('drp_registrar_status_change', handleRegistrarStatusChange);
      window.removeEventListener('drp_threat_intel_status_change', handleThreatIntelStatusChange);
    };
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80 shrink-0 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-1 ring-blue-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white font-mono">
                  DRP PLATFORM
                </span>
                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-[10px] font-semibold uppercase tracking-wider">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-tight">Digital Risk Protection</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Protection Status Ticker */}
        <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-slate-300">Continuous Monitoring</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
            DEFCON 4
          </span>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Core Modules
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const IconComponent = ICON_MAP[item.icon] || Shield;
              const isActive =
                location.pathname === item.path ||
                (item.path === '/overview' && location.pathname === '/');

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30 ring-1 ring-blue-500'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                </NavLink>
              );
            })}
          </nav>

          <div className="pt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            External Integrations
          </div>
          <div className="space-y-1">
            <NavLink
              to="/registrar-abuse"
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30 ring-1 ring-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Radio className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                <span>Registrar Abuse APIs</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  registrarStatus?.isLive
                    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30'
                    : registrarStatus?.isConfigured === false
                    ? 'text-rose-400 bg-rose-950/40 border-rose-900/30'
                    : 'text-amber-400 bg-amber-950/40 border-amber-900/30'
                }`}
              >
                {registrarStatus?.isLive
                  ? 'Connected'
                  : registrarStatus?.isConfigured === false
                  ? 'Config Req'
                  : 'Demo Sandbox'}
              </span>
            </NavLink>
            <NavLink
              to="/threat-intelligence"
              onClick={() => {
                if (window.innerWidth < 1024) onClose();
              }}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/30 ring-1 ring-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
                <span>Threat Intelligence Feed</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                  threatIntelStatus?.isLive
                    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30'
                    : 'text-amber-400 bg-amber-950/40 border-amber-900/30'
                }`}
              >
                {threatIntelStatus?.isLive ? 'Live Feed' : 'Demo Sandbox'}
              </span>
            </NavLink>
          </div>
        </div>

        {/* Footer Workspace Switcher */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400">
              AC
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">Acme Financial Org</p>
              <p className="text-[11px] text-slate-500 truncate">SOC Global Tenant #841</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
