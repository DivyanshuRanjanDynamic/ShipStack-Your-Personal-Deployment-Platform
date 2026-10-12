import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeployProvider } from './context/DeployContext';
import DeploymentModal from './components/DeploymentModal';
import CreateProjectModal from './components/CreateProjectModal';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import './App.css';

// ── Shared QueryClient Configuration ──
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: (failureCount, error) => {
        if (error?.status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

// ── Target Product Flow Pages ──
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const NewProjectPage = lazy(() => import('./pages/NewProjectPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const DeploymentPage = lazy(() => import('./pages/DeploymentPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// ── Preserved & Auxiliary Views ──
const HomePage = lazy(() => import('./pages/HomePage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const DeploymentsPage = lazy(() => import('./pages/DeploymentsPage'));
const DeploymentDetailPage = lazy(() => import('./pages/DeploymentDetailPage'));
const LogsPage = lazy(() => import('./pages/LogsPage'));
const ObservabilityPage = lazy(() => import('./pages/ObservabilityPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const EnvVariablesPage = lazy(() => import('./pages/EnvVariablesPage'));
const DiagnosisPage = lazy(() => import('./pages/DiagnosisPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: '#888',
      }}
    >
      <Loader2 size={28} className="spin-icon" color="#00dfd8" />
      <span style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Loading view...</span>
    </div>
  );
}

export default function App() {
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deployRepoUrl, setDeployRepoUrl] = useState('');

  const handleOpenDeploy = (repo = '') => {
    setDeployRepoUrl(repo || '');
    setIsDeployModalOpen(true);
  };

  const handleCloseDeploy = () => {
    setIsDeployModalOpen(false);
  };

  return (
    <ErrorBoundary title="ShipStack Application Error">
      <QueryClientProvider client={queryClient}>
        <DeployProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* ── 1. Target Flow: Dashboard (/) ── */}
                <Route
                  path="/"
                  element={
                    <ErrorBoundary title="Dashboard View Error">
                      <DashboardPage />
                    </ErrorBoundary>
                  }
                />

                {/* ── 2. Target Flow: New Project (/new) ── */}
                <Route
                  path="/new"
                  element={
                    <ErrorBoundary title="New Project Error">
                      <NewProjectPage />
                    </ErrorBoundary>
                  }
                />

                {/* ── 3. Target Flow: Project Page (/projects/:projectId) ── */}
                <Route
                  path="/projects/:projectId"
                  element={
                    <ErrorBoundary title="Project View Error">
                      <ProjectDetailPage />
                    </ErrorBoundary>
                  }
                />

                {/* ── 4. Target Flow: Deployment Page (/projects/:projectId/deployments/:deploymentId) ── */}
                <Route
                  path="/projects/:projectId/deployments/:deploymentId"
                  element={
                    <ErrorBoundary title="Deployment View Error">
                      <DeploymentPage />
                    </ErrorBoundary>
                  }
                />

                {/* Backward-compatible alias for deployment by ID */}
                <Route
                  path="/deployment/:deploymentId"
                  element={
                    <ErrorBoundary title="Deployment Details Error">
                      <DeploymentPage />
                    </ErrorBoundary>
                  }
                />

                {/* Legacy /projects path redirects to Dashboard */}
                <Route path="/projects" element={<Navigate to="/" replace />} />

                {/* Marketing Landing Page */}
                <Route
                  path="/marketing"
                  element={
                    <ErrorBoundary title="Marketing View Error">
                      <HomePage onOpenDeploy={handleOpenDeploy} />
                    </ErrorBoundary>
                  }
                />

                {/* About Page */}
                <Route
                  path="/about"
                  element={
                    <ErrorBoundary title="About View Error">
                      <AboutPage />
                    </ErrorBoundary>
                  }
                />

                {/* Pricing Page */}
                <Route
                  path="/pricing"
                  element={
                    <ErrorBoundary title="Pricing View Error">
                      <PricingPage />
                    </ErrorBoundary>
                  }
                />

                {/* Auxiliary Console Pages */}
                <Route
                  path="/overview"
                  element={
                    <ErrorBoundary title="Overview Error">
                      <OverviewPage onOpenDeploy={handleOpenDeploy} />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/deployments"
                  element={
                    <ErrorBoundary title="Deployments Error">
                      <DeploymentsPage onOpenDeploy={handleOpenDeploy} />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/logs"
                  element={
                    <ErrorBoundary title="Logs Console Error">
                      <LogsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/observability"
                  element={
                    <ErrorBoundary title="Observability Error">
                      <ObservabilityPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ErrorBoundary title="Analytics Error">
                      <AnalyticsPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/env"
                  element={
                    <ErrorBoundary title="Environment Variables Error">
                      <EnvVariablesPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/settings/environment-variables"
                  element={
                    <ErrorBoundary title="Environment Variables Error">
                      <EnvVariablesPage />
                    </ErrorBoundary>
                  }
                />

                {/* AI Diagnosis Pages */}
                <Route
                  path="/diagnosis"
                  element={
                    <ErrorBoundary title="AI Diagnosis Error">
                      <DiagnosisPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/diagnosis/:deploymentId"
                  element={
                    <ErrorBoundary title="AI Diagnosis Error">
                      <DiagnosisPage />
                    </ErrorBoundary>
                  }
                />

                {/* Catch-all 404 handler */}
                <Route
                  path="*"
                  element={
                    <ErrorBoundary title="Not Found">
                      <NotFoundPage />
                    </ErrorBoundary>
                  }
                />
              </Routes>
            </Suspense>

            {/* Global Interactive Deploy Modal */}
            <DeploymentModal
              isOpen={isDeployModalOpen}
              onClose={handleCloseDeploy}
              initialRepo={deployRepoUrl}
            />

            {/* Global Interactive Create Project Modal */}
            <CreateProjectModal />
          </BrowserRouter>
        </DeployProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
