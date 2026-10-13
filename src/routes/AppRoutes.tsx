import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { ROUTES } from '../constants';
import { AuthProvider } from '../context/AuthContext';
import { CitizenRoute, AdminRoute, PublicOnlyRoute } from './ProtectedRoute';

// Pages
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { CitizenDashboardPage } from '../pages/CitizenDashboardPage';
import { ReportIssuePage } from '../pages/ReportIssuePage';
import { MyComplaintsPage } from '../pages/MyComplaintsPage';
import { ComplaintDetailsPage } from '../pages/ComplaintDetailsPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminComplaintDetailsPage } from '../pages/AdminComplaintDetailsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const AppRoutes: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<RootLayout />}>
          {/* Public Landing Page */}
          <Route path={ROUTES.HOME} element={<LandingPage />} />

          {/* Public Auth Routes (Redirects if already signed in) */}
          <Route element={<PublicOnlyRoute />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          </Route>

          {/* Citizen Protected Grievance Routes */}
          <Route element={<CitizenRoute />}>
            <Route path={ROUTES.CITIZEN_DASHBOARD} element={<CitizenDashboardPage />} />
            <Route path={ROUTES.REPORT_ISSUE} element={<ReportIssuePage />} />
            <Route path={ROUTES.MY_COMPLAINTS} element={<MyComplaintsPage />} />
            <Route path="/complaints/:id" element={<ComplaintDetailsPage />} />
          </Route>

          {/* Municipal Administrator Protected Routes */}
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.ADMIN_DASHBOARD} element={<AdminDashboardPage />} />
            <Route path="/admin/complaints/:id" element={<AdminComplaintDetailsPage />} />
          </Route>

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
};
export default AppRoutes;
