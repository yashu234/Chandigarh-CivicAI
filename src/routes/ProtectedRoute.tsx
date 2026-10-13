import React from 'react';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../constants';
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';

/**
 * Loading indicator rendered while Supabase session is resolving.
 */
export const AuthLoadingScreen: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-4" />
      <h3 className="text-sm font-semibold text-slate-800">Verifying Civic Credentials...</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">
        Communicating with Chandigarh Municipal Corporation authentication gateway.
      </p>
    </div>
  );
};

/**
 * Route wrapper for Citizen-accessible grievance pages.
 * Redirects unauthenticated users to /login.
 */
export const CitizenRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
};

/**
 * Route wrapper for Municipal Administrator pages.
 * Strictly verifies database profile role = 'admin'.
 * Denies normal citizens and redirects unauthenticated users.
 */
export const AdminRoute: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location.pathname }} replace />;
  }

  if (!isAdmin) {
    // Authenticated user exists, but does not have verified administrative privileges in public.profiles
    return (
      <PageContainer maxWidth="md" className="py-16">
        <Card padding="lg" className="border-red-200 bg-red-50/40 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Municipal Officer Authorization Required</h2>
          <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto">
            Your authenticated account (<span className="font-semibold text-slate-800">{user?.email}</span>)
            is registered as a <strong>Resident/Citizen</strong>. Access to the municipal triage and administrative
            command queue is restricted to verified MCC officers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to={ROUTES.CITIZEN_DASHBOARD}>
              <Button variant="primary" leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Return to Citizen Dashboard
              </Button>
            </Link>
            <Link to={ROUTES.REPORT_ISSUE}>
              <Button variant="outline">
                Report a Civic Issue
              </Button>
            </Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return <Outlet />;
};

/**
 * Route wrapper for public auth pages (/login, /register).
 * Redirects already-authenticated users to their respective dashboard.
 */
export const PublicOnlyRoute: React.FC = () => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to={isAdmin ? ROUTES.ADMIN_DASHBOARD : ROUTES.CITIZEN_DASHBOARD} replace />;
  }

  return <Outlet />;
};
