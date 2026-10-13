import React from 'react';
import { APP_CONFIG, ROUTES } from '../../constants';
import { Link } from 'react-router-dom';
import { ShieldCheck, Info, FileText } from 'lucide-react';

const CURRENT_YEAR = 2026;

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Identity */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck className="h-5 w-5 text-sky-400" />
              <span className="font-bold tracking-tight text-base">{APP_CONFIG.name}</span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              A transparent digital public infrastructure platform empowering citizens of Chandigarh to submit
              civic issues with photographic evidence and empowering municipal authorities with deterministic,
              explainable priority intelligence.
            </p>
            <div className="pt-2 text-[11px] text-slate-500">
              <span>Jurisdiction: </span>
              <strong className="text-slate-400">{APP_CONFIG.jurisdiction}</strong>
              <span className="mx-2">•</span>
              <span>Version: </span>
              <strong className="text-slate-400">Phase 2 — Frontend Implementation</strong>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Citizen Portals</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to={ROUTES.REPORT_ISSUE} className="hover:text-white transition-colors">
                  Report a Civic Problem
                </Link>
              </li>
              <li>
                <Link to={ROUTES.MY_COMPLAINTS} className="hover:text-white transition-colors">
                  Track My Complaints
                </Link>
              </li>
              <li>
                <Link to={ROUTES.CITIZEN_DASHBOARD} className="hover:text-white transition-colors">
                  Citizen Dashboard
                </Link>
              </li>
              <li>
                <Link to={ROUTES.LOGIN} className="hover:text-white transition-colors">
                  Citizen & Officer Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Administration */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Governance & Principles</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to={ROUTES.ADMIN_DASHBOARD} className="hover:text-white transition-colors">
                  Municipal Priority Queue
                </Link>
              </li>
              <li className="flex items-start gap-1.5 text-slate-400">
                <Info className="h-3.5 w-3.5 shrink-0 text-sky-400 mt-0.5" />
                <span>Evidence Support Standard (Corroboration Rating)</span>
              </li>
              <li className="flex items-start gap-1.5 text-slate-400">
                <FileText className="h-3.5 w-3.5 shrink-0 text-sky-400 mt-0.5" />
                <span>Deterministic Explainable Priority Scoring</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 text-center sm:flex sm:justify-between sm:text-left text-xs text-slate-500">
          <p>© {CURRENT_YEAR} Chandigarh CivicAI. Designed for transparent municipal administration.</p>
          <p className="mt-2 sm:mt-0">Union Territory of Chandigarh • Digital Public Infrastructure</p>
        </div>
      </div>
    </footer>
  );
};
