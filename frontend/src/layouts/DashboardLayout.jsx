import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <Header onToggleSidebar={() => setSidebarOpen(true)} />

        {/* Page Content View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Enterprise Footer */}
        <footer className="border-t border-slate-200/80 bg-white py-4 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Digital Risk Protection Platform</span>
            <span>&bull;</span>
            <span>SOC Incident Response Console</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Encrypted End-to-End</span>
            <span>&bull;</span>
            <span>API SLA 99.99%</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
