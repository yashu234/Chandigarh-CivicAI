import React from 'react';
import { APP_CONFIG, ROUTES } from '../../constants';
import { Link } from 'react-router-dom';
import { Cpu, ShieldCheck, FileText, ExternalLink } from 'lucide-react';

const CURRENT_YEAR = 2026;

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-[#0a1628] text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">

          {/* Column 1: Brand Identity */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#0f2040] border border-sky-500/20 flex items-center justify-center">
                <Cpu className="h-5 w-5 text-sky-400" />
              </div>
              <div>
                <div className="text-white font-extrabold tracking-tight text-base leading-tight">
                  {APP_CONFIG.name}
                </div>
                <div className="text-[10px] text-sky-400/70 font-semibold tracking-widest uppercase">
                  Explainable Prioritization Engine
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              Transparent digital public infrastructure empowering Chandigarh citizens to report civic
              issues with photographic evidence — and empowering municipal authorities with deterministic,
              explainable AI-assisted priority intelligence.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <ShieldCheck className="h-3 w-3 text-sky-400" />
                Human-in-the-Loop
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <FileText className="h-3 w-3 text-emerald-400" />
                Explainable AI
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
                <ExternalLink className="h-3 w-3 text-amber-400" />
                Phase 13 Ready
              </span>
            </div>
          </div>

          {/* Column 2: Citizen Portals */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">
              Citizen Portals
            </h4>
            <ul className="space-y-2.5 text-xs">
              {[
                { to: ROUTES.REPORT_ISSUE, label: 'Report a Civic Problem' },
                { to: ROUTES.MY_COMPLAINTS, label: 'Track My Complaints' },
                { to: ROUTES.CITIZEN_DASHBOARD, label: 'Citizen Dashboard' },
                { to: ROUTES.LOGIN, label: 'Citizen & Officer Login' },
                { to: ROUTES.REGISTER, label: 'Register as Resident' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-slate-400 hover:text-sky-400 transition-colors font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Governance */}
          <div className="md:col-span-4 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">
              Governance &amp; Principles
            </h4>
            <ul className="space-y-3 text-xs">
              <li>
                <Link
                  to={ROUTES.ADMIN_DASHBOARD}
                  className="text-slate-400 hover:text-sky-400 transition-colors font-medium"
                >
                  Municipal Priority Command Queue
                </Link>
              </li>
              <li className="text-slate-500 leading-relaxed">
                <span className="text-sky-400/80 font-semibold block mb-0.5">Transparency Policy</span>
                AI generates explainable recommendations. Human officers retain full final authority
                on all dispatch, override, and closure decisions.
              </li>
              <li className="text-slate-500 leading-relaxed">
                <span className="text-emerald-400/80 font-semibold block mb-0.5">Evidence Standard</span>
                Evidence Support Score represents visual corroboration confidence, not forensic
                authenticity guarantees.
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-white/8 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] text-slate-500">
          <p>© {CURRENT_YEAR} Chandigarh CivicAI. Designed for transparent municipal administration.</p>
          <p className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Union Territory of Chandigarh · Digital Public Infrastructure
          </p>
        </div>
      </div>
    </footer>
  );
};
