import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { SummaryCards } from "./components/SummaryCards";
import { FindingsTable } from "./components/FindingsTable";
import { CompanyRegistrationModal } from "./components/CompanyRegistrationModal";
import { FindingDetailModal } from "./components/FindingDetailModal";
import { BrandsView } from "./components/BrandsView";
import { AssetsView } from "./components/AssetsView";
import { QuickScanner } from "./components/QuickScanner";
import { ToastContainer } from "./components/Toast";
import {
  getBackendHealth,
  getDashboardSummary,
  getCompanies,
  getFindings,
  getProtectedAssets,
} from "./api/client";

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Core Data States
  const [health, setHealth] = useState({ healthy: false });
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [protectedAssets, setProtectedAssets] = useState([]);

  // Findings State
  const [findings, setFindings] = useState([]);
  const [findingsPagination, setFindingsPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Loading & Error States
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingFindings, setIsLoadingFindings] = useState(true);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [findingsError, setFindingsError] = useState(null);

  // Modals & UI States
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Check Backend Health
  const checkHealth = useCallback(async () => {
    const h = await getBackendHealth();
    setHealth(h);
  }, []);

  // 2. Fetch Companies
  const fetchCompanies = useCallback(async () => {
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    } finally {
      setIsLoadingCompanies(false);
    }
  }, []);

  // 3. Fetch Summary Metrics
  const fetchSummary = useCallback(async () => {
    try {
      const data = await getDashboardSummary(selectedCompanyId);
      setSummary(data);
    } catch (err) {
      setSummaryError(err.message);
      console.error("Failed to fetch summary:", err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [selectedCompanyId]);

  // 4. Fetch Findings
  const fetchFindings = useCallback(async () => {
    try {
      const res = await getFindings({
        page,
        pageSize: 10,
        companyId: selectedCompanyId,
        severity: severityFilter,
        status: statusFilter,
        search: searchQuery,
      });
      setFindings(res.items);
      setFindingsPagination(res.pagination);
    } catch (err) {
      setFindingsError(err.message);
      console.error("Failed to fetch findings:", err);
    } finally {
      setIsLoadingFindings(false);
    }
  }, [page, selectedCompanyId, severityFilter, statusFilter, searchQuery]);

  // 5. Fetch Protected Assets
  const fetchAssets = useCallback(async () => {
    setIsLoadingAssets(true);
    try {
      const data = await getProtectedAssets(selectedCompanyId);
      setProtectedAssets(data);
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    } finally {
      setIsLoadingAssets(false);
    }
  }, [selectedCompanyId]);

  // Initial Load
  useEffect(() => {
    Promise.resolve().then(() => {
      checkHealth();
      fetchCompanies();
    });
  }, [checkHealth, fetchCompanies]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSummary();
      fetchFindings();
      if (activeTab === "assets") {
        fetchAssets();
      }
    });
  }, [fetchSummary, fetchFindings, fetchAssets, activeTab]);

  // Health ping interval
  useEffect(() => {
    const interval = setInterval(checkHealth, 25000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Refresh All Data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      checkHealth(),
      fetchCompanies(),
      fetchSummary(),
      fetchFindings(),
      fetchAssets(),
    ]);
    setIsRefreshing(false);
    addToast("Data updated from live security feeds", "info");
  };

  // Callback when company is registered
  const handleCompanyRegistered = (newCompany) => {
    fetchCompanies();
    fetchSummary();
    fetchAssets();
    addToast(`Company "${newCompany.name}" successfully enrolled in monitoring`, "success");
  };

  // Callback when company is deleted
  const handleCompanyDeleted = () => {
    fetchCompanies();
    fetchSummary();
    fetchFindings();
    addToast("Brand removed from active monitoring", "info");
  };

  // Callback when threat scan is completed
  const handleScanCompleted = (scanResult) => {
    fetchSummary();
    fetchFindings();
    addToast(
      `Analysis completed! Finding converted with severity: ${scanResult.recommended_severity.toUpperCase()}`,
      "success"
    );
  };

  // Filter severity helper
  const handleFilterSeverity = (sev) => {
    setSeverityFilter(sev);
    setActiveTab("findings");
  };

  return (
    <div className="app-layout" id="dpr-app-root">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        summary={summary}
        health={health}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        <Header
          activeTab={activeTab}
          companies={companies}
          selectedCompanyId={selectedCompanyId}
          setSelectedCompanyId={(id) => {
            setSelectedCompanyId(id);
            setPage(1);
          }}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="content-body" id="main-content-view">
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === "overview" && (
            <>
              {/* Summary Metrics Cards */}
              <SummaryCards
                summary={summary}
                onFilterSeverity={handleFilterSeverity}
                isLoading={isLoadingSummary}
                error={summaryError}
              />

              {/* Findings Table */}
              <FindingsTable
                findings={findings}
                pagination={findingsPagination}
                isLoading={isLoadingFindings}
                error={findingsError}
                onPageChange={(p) => setPage(p)}
                severityFilter={severityFilter}
                setSeverityFilter={(s) => {
                  setSeverityFilter(s);
                  setPage(1);
                }}
                statusFilter={statusFilter}
                setStatusFilter={(st) => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                searchQuery={searchQuery}
                setSearchQuery={(q) => {
                  setSearchQuery(q);
                  setPage(1);
                }}
                onFindingClick={(f) => setSelectedFinding(f)}
                onRefresh={fetchFindings}
                onFindingUpdated={() => {
                  fetchFindings();
                  fetchSummary();
                  addToast("Finding status successfully updated", "success");
                }}
              />
            </>
          )}

          {/* TAB 2: FINDINGS CENTER */}
          {activeTab === "findings" && (
            <FindingsTable
              findings={findings}
              pagination={findingsPagination}
              isLoading={isLoadingFindings}
              error={findingsError}
              onPageChange={(p) => setPage(p)}
              severityFilter={severityFilter}
              setSeverityFilter={(s) => {
                setSeverityFilter(s);
                setPage(1);
              }}
              statusFilter={statusFilter}
              setStatusFilter={(st) => {
                setStatusFilter(st);
                setPage(1);
              }}
              searchQuery={searchQuery}
              setSearchQuery={(q) => {
                setSearchQuery(q);
                setPage(1);
              }}
              onFindingClick={(f) => setSelectedFinding(f)}
              onRefresh={fetchFindings}
              onFindingUpdated={() => {
                fetchFindings();
                fetchSummary();
                addToast("Finding status updated", "success");
              }}
            />
          )}

          {/* TAB 3: MONITORED BRANDS */}
          {activeTab === "brands" && (
            <BrandsView
              companies={companies}
              isLoading={isLoadingCompanies}
              onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
              onCompanyDeleted={handleCompanyDeleted}
              onSelectBrand={(id) => {
                setSelectedCompanyId(id);
                setActiveTab("findings");
              }}
            />
          )}

          {/* TAB 4: PROTECTED DIGITAL ASSETS */}
          {activeTab === "assets" && (
            <AssetsView
              assets={protectedAssets}
              companies={companies}
              isLoading={isLoadingAssets}
              onAssetAdded={() => {
                fetchAssets();
                fetchSummary();
                addToast("Asset whitelisted successfully", "success");
              }}
              onAssetDeleted={() => {
                fetchAssets();
                fetchSummary();
                addToast("Protected asset removed", "info");
              }}
            />
          )}

          {/* TAB 5: THREAT RADAR & SCANNER */}
          {activeTab === "scanner" && (
            <QuickScanner
              companies={companies}
              onScanCompleted={handleScanCompleted}
            />
          )}
        </main>
      </div>

      {/* Register Brand Modal */}
      <CompanyRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onCompanyRegistered={handleCompanyRegistered}
      />

      {/* Finding Detail Inspection Modal */}
      <FindingDetailModal
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />

      {/* Floating Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
