import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Overview from './pages/Overview';
import BrandProfiles from './pages/BrandProfiles';
import SocialMonitoring from './pages/SocialMonitoring';
import AppMonitoring from './pages/AppMonitoring';
import Findings from './pages/Findings';
import RegistrarAbuse from './pages/RegistrarAbuse';
import ThreatIntelligence from './pages/ThreatIntelligence';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="brand-profiles" element={<BrandProfiles />} />
          <Route path="social-monitoring" element={<SocialMonitoring />} />
          <Route path="app-monitoring" element={<AppMonitoring />} />
          <Route path="findings" element={<Findings />} />
          <Route path="registrar-abuse" element={<RegistrarAbuse />} />
          <Route path="integrations/registrar-abuse" element={<Navigate to="/registrar-abuse" replace />} />
          <Route path="threat-intelligence" element={<ThreatIntelligence />} />
          <Route path="threat-intelligence-feed" element={<Navigate to="/threat-intelligence" replace />} />
          <Route path="integrations/threat-intelligence" element={<Navigate to="/threat-intelligence" replace />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
