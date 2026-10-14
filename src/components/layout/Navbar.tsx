import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES, APP_CONFIG } from '../../constants';
import {
  Menu,
  X,
  PlusCircle,
  LayoutDashboard,
  FileText,
  UserCheck,
  LogOut,
  User,
  ShieldCheck,
  Home,
  Cpu,
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

  const navLinks = [
    { label: 'Home', path: ROUTES.HOME, icon: Home, show: true },
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
      label: 'Dashboard',
      path: ROUTES.CITIZEN_DASHBOARD,
      icon: LayoutDashboard,
      show: isAuthenticated && isCitizen,
    },
    {
      label: 'Command Queue',
      path: ROUTES.ADMIN_DASHBOARD,
      icon: UserCheck,
      show: isAuthenticated && isAdmin,
    },
  ].filter((item) => item.show);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Resident';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* ── Government identification stripe ── */}
      <div className="bg-[#030d1a] border-b border-white/5 text-slate-400 text-[11px] py-1 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-white tracking-widest text-[10px] uppercase">
              Chandigarh Administration
            </span>
            <span className="text-white/20 hidden sm:inline">|</span>
            <span className="hidden sm:inline text-slate-400">
              Municipal Corporation &amp; UT Engineering Departments
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] tracking-wide">
                <ShieldCheck className="h-3 w-3" />
                Officer: {displayName}
              </span>
            ) : isAuthenticated ? (
              <span className="inline-flex items-center gap-1.5 text-slate-400 text-[11px]">
                <User className="h-3 w-3 text-sky-400" />
                Verified Citizen: {displayName}
                {profile?.sector ? ` · ${profile.sector}` : ''}
              </span>
            ) : (
              <Link
                to={ROUTES.LOGIN}
                className="font-semibold inline-flex items-center gap-1.5 transition-colors px-2.5 py-0.5 rounded-full text-[10px] text-amber-400 hover:text-amber-300 hover:bg-white/5 tracking-wide border border-amber-400/30"
              >
                <UserCheck className="h-3 w-3" />
                Municipal Officer Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main navigation bar ── */}
      <div
        className="bg-white/95 backdrop-blur-md border-b border-slate-200/80"
        style={{ boxShadow: '0 1px 12px 0 rgb(10 22 40 / 0.06)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Brand */}
            <Link
              to={ROUTES.HOME}
              className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg p-1 -ml-1"
            >
              <div className="h-10 w-10 rounded-xl bg-[#0a1628] flex items-center justify-center shadow-md border border-sky-500/20 group-hover:border-sky-400/40 transition-all duration-200">
                <Cpu className="h-5 w-5 text-sky-400 transition-transform group-hover:scale-110 duration-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">
                    {APP_CONFIG.name}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full border border-sky-200">
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5 font-medium tracking-wide">
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
                    className={`text-xs font-semibold px-3 py-2 rounded-lg transition-all duration-150 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                      active
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className={`h-3.5 w-3.5 ${active ? 'text-sky-600' : ''}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Auth Controls */}
            <div className="hidden md:flex items-center gap-2">
              {!isAuthenticated ? (
                <>
                  <Link to={ROUTES.LOGIN}>
                    <Button variant="ghost" size="sm">Log In</Button>
                  </Link>
                  <Link to={ROUTES.REGISTER}>
                    <Button variant="outline" size="sm">Register</Button>
                  </Link>
                  <Link to={ROUTES.REPORT_ISSUE}>
                    <Button variant="sky" size="sm" leftIcon={<PlusCircle className="h-3.5 w-3.5" />}>
                      Report Issue
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <NotificationBell />

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 justify-end">
                      {isAdmin ? (
                        <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200">
                          Admin
                        </span>
                      ) : (
                        <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-sky-200">
                          Citizen
                        </span>
                      )}
                      <span>{displayName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-[160px]">
                      {user?.email}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    leftIcon={<LogOut className="h-3.5 w-3.5" />}
                    className="text-slate-600 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50"
                  >
                    Log Out
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile menu trigger */}
            <div className="flex items-center gap-2 md:hidden">
              {isAuthenticated && <NotificationBell />}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-5 space-y-2 shadow-lg animate-slide-down">
          {isAuthenticated && (
            <div className="p-3 mb-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-[#0a1628] text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">{displayName}</div>
                  <div className="text-[11px] text-slate-500">{user?.email}</div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">
                    {isAdmin ? 'Municipal Administrator' : 'Verified Resident'}
                  </div>
                </div>
              </div>
            </div>
          )}

          <nav aria-label="Mobile Navigation" className="space-y-1">
            {navLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isActive(item.path)
                    ? 'bg-sky-50 text-sky-700 border border-sky-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive(item.path) ? 'text-sky-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {!isAuthenticated ? (
              <>
                <Link to={ROUTES.REPORT_ISSUE}>
                  <Button variant="sky" size="md" className="w-full" leftIcon={<PlusCircle className="h-4 w-4" />}>
                    Report an Issue
                  </Button>
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  <Link to={ROUTES.LOGIN}>
                    <Button variant="outline" size="sm" className="w-full">Sign In</Button>
                  </Link>
                  <Link to={ROUTES.REGISTER}>
                    <Button variant="primary" size="sm" className="w-full">Register</Button>
                  </Link>
                </div>
              </>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={handleSignOut}
                className="w-full text-rose-700 border-rose-200 hover:bg-rose-50"
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
