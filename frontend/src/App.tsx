import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { SearchModal } from './components/SearchModal';
import { ProfileDrawer } from './components/ProfileDrawer';
import { NodeClusterModal } from './components/NodeClusterModal';
import { ReportModal } from './components/ReportModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ToastContainer } from './components/ToastContainer';
import { ProblemOverview } from './pages/ProblemOverview';
import { FederatedSimulator } from './pages/FederatedSimulator';
import { CentralizedBenchmark } from './pages/CentralizedBenchmark';
import { ClientTelemetry } from './pages/ClientTelemetry';
import { CommunicationAnalysis } from './pages/CommunicationAnalysis';
import { FeaturesBenefits } from './pages/FeaturesBenefits';
import { Experiments } from './pages/Experiments';

const MainLayout: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    userProfile,
  } = useApp();

  // Dynamically synchronize theme color variables into CSS
  useEffect(() => {
    const root = document.documentElement;
    const themes = {
      ocean: {
        '--color-secondary': '#006398',
        '--color-primary': '#0b1c30',
        '--color-on-tertiary-container': '#009668',
      },
      emerald: {
        '--color-secondary': '#009668',
        '--color-primary': '#064e3b',
        '--color-on-tertiary-container': '#0284c7',
      },
      violet: {
        '--color-secondary': '#7c3aed',
        '--color-primary': '#1e1b4b',
        '--color-on-tertiary-container': '#10b981',
      },
      amber: {
        '--color-secondary': '#d97706',
        '--color-primary': '#451a03',
        '--color-on-tertiary-container': '#2563eb',
      },
    };
    const currentTheme = themes[userProfile.themeColor] || themes.ocean;
    Object.entries(currentTheme).forEach(([k, v]) => {
      root.style.setProperty(k, v);
    });
  }, [userProfile.themeColor]);

  // Dynamic theme accent border or subtle glow class
  const themeAccentGlow = {
    ocean: 'selection:bg-secondary/20 selection:text-secondary',
    emerald: 'selection:bg-emerald-500/20 selection:text-emerald-700',
    violet: 'selection:bg-purple-500/20 selection:text-purple-700',
    amber: 'selection:bg-amber-500/20 selection:text-amber-700',
  }[userProfile.themeColor];

  return (
    <div className={`min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased ${themeAccentGlow}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <Header
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Dynamic Route View */}
        <main className="w-full pt-16 bg-surface flex-1">
          {activeTab === 'problem-and-overview' && (
            <ProblemOverview onNavigate={setActiveTab} />
          )}
          {activeTab === 'federated-simulator' && <FederatedSimulator />}
          {activeTab === 'centralized-vs-fedavg-benchmark' && (
            <CentralizedBenchmark />
          )}
          {activeTab === 'client-non-iid-telemetry' && <ClientTelemetry />}
          {activeTab === 'communication-and-convergence-analysis' && (
            <CommunicationAnalysis />
          )}
          {activeTab === 'experiments' && <Experiments />}
          {activeTab === 'features-benefits-and-sources' && (
            <FeaturesBenefits />
          )}
        </main>
      </div>

      {/* Global Modals & Drawers */}
      <SearchModal />
      <ProfileDrawer />
      <NodeClusterModal />
      <ReportModal />
      <KeyboardShortcutsModal />
      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
