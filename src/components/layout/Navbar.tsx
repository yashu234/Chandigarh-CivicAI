import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, APP_CONFIG } from '../../constants';
import {
  Shield,
  Menu,
  X,
  Landmark,
  PlusCircle,
  LayoutDashboard,
  FileText,
  UserCheck,
  LogOut,
  User,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { NotificationBell } from '../notifications/NotificationBell';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isCitizen, user, profile, signOut } = useAuth();

  const [prevPath, setPrevPath] = useState(location.pathname);
  if (prevPath !== location.pathname) {
    setPrevPath(location.pathname);
    setMobileMenuOpen(false);
  }

  const isActive = (path: string) => {
    if (path === '/' && location.pathname !== '/') return false;
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(ROUTES.LOGIN);
  };

  // Dynamic links according to verified role
  const navLinks = [
    { label: 'Home', path: ROUTES.HOME, icon: Landmark, show: true },
    {
      label: 'Report Issue',
      path: ROUTES.REPORT_ISSUE,
      icon: PlusCircle,
      show: isAuthenticated && isCitizen,
    },
    {
      label: 'My Complaints',
      path: ROUTES.MY_COMPLAINTS,
      icon: FileText,
      show: isAuthenticated && isCitizen,
    },
    {
      label: 'Citizen Dashboard',
      path: ROUTES.CITIZEN_DASHBOARD,
      icon: LayoutDashboard,
      show: isAuthenticated && isCitizen,
    },
    {
      label: 'Admin Command Queue',
      path: ROUTES.ADMIN_DASHBOARD,
      icon: UserCheck,
      show: isAuthenticated && isAdmin,
    },
  ].filter((item) => item.show);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Resident';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      {/* Top UT Chandigarh Gov stripe */}
      <div className="bg-slate-900 text-slate-300 text-[11px] py-1 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white tracking-wide">CHANDIGARH ADMINISTRATION</span>
            <span className="text-slate-500">|</span>
            <span className="hidden sm:inline">Municipal Corporation & UT Engineering Departments</span>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold text-[11px]">
                <ShieldCheck className="h-3 w-3" />
                <span>OFFICER SESSION: {displayName}</span>
              </span>
            ) : isAuthenticated ? (
              <span className="inline-flex items-center gap-1.5 text-slate-300 text-[11px]">
                <User className="h-3 w-3 text-sky-400" />
                <span>Verified Citizen: {displayName} ({profile?.sector || 'Chandigarh'})</span>
              </span>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                className="font-semibold inline-flex items-center gap-1.5 transition-colors px-2 py-0.5 rounded text-[11px] text-amber-300 hover:text-amber-200 hover:bg-slate-800"
              >
                <UserCheck className="h-3 w-3" />
                <span>Municipal Officer Login</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand */}
          <Link
            to={ROUTES.HOME}
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
          >
            <div className="h-10 w-10 rounded-md bg-slate-900 text-sky-400 flex items-center justify-center border border-slate-800 shadow-xs">
              <Shield className="h-6 w-6 transition-transform group-hover:scale-105" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  {APP_CONFIG.name}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  Civic AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                Explainable Prioritization Engine
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`text-xs font-semibold px-3 py-2 rounded-md transition-colors inline-flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active
                      ? 'bg-slate-100 text-blue-900 border border-slate-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs & Auth Controls */}
          <div className="hidden md:flex items-center gap-2">
            {!isAuthenticated ? (
              <>
                <Link to={ROUTES.LOGIN}>
                  <Button variant="ghost" size="sm">
                    Log In
                  </Button>
                </Link>
                <Link to={ROUTES.REGISTER}>
                  <Button variant="outline" size="sm">
                    Register
                  </Button>
                </Link>
                <Link to={ROUTES.REPORT_ISSUE}>
                  <Button variant="primary" size="sm" leftIcon={<PlusCircle className="h-4 w-4" />}>
                    Report Issue
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <NotificationBell />

                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1 justify-end">
                    {isAdmin ? (
                      <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold">
                        Admin
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Citizen
                      </span>
                    )}
                    <span>{displayName}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate max-w-[160px]">
                    {user?.email}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  leftIcon={<LogOut className="h-3.5 w-3.5" />}
                  className="text-slate-700 hover:text-red-700 hover:border-red-300"
                >
                  Log Out
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex items-center gap-1 md:hidden">
            {isAuthenticated && <NotificationBell />}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={mobileMenuOpen ? 'Close main navigation' : 'Open main navigation'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Accessible Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-5 space-y-2 shadow-lg">
          {isAuthenticated && (
            <div className="p-3 mb-2 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs font-semibold text-slate-800">
                Logged in as: <span className="text-blue-900">{displayName}</span>
              </div>
              <div className="text-[11px] text-slate-500">{user?.email}</div>
              <div className="text-[10px] uppercase font-bold text-slate-600 mt-1">
                Role: {isAdmin ? 'Municipal Administrator' : 'Verified Resident'}
              </div>
            </div>
          )}

          <nav aria-label="Mobile Navigation" className="space-y-1">
            {navLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.icon className="h-4 w-4 text-slate-500" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {!isAuthenticated ? (
              <>
                <Link to={ROUTES.REPORT_ISSUE}>
                  <Button variant="primary" size="md" className="w-full" leftIcon={<PlusCircle className="h-4 w-4" />}>
                    Report an Issue
                  </Button>
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link to={ROUTES.LOGIN}>
                    <Button variant="outline" size="sm" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to={ROUTES.REGISTER}>
                    <Button variant="secondary" size="sm" className="w-full">
                      Register
                    </Button>
                  </Link>
                </div>
              </>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={handleSignOut}
                className="w-full text-red-700 border-red-200 hover:bg-red-50"
                leftIcon={<LogOut className="h-4 w-4" />}
              >
                Log Out of Account
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
export default Navbar;
