import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 page-enter">
      <PageContainer maxWidth="sm" className="text-center">
        <div className="relative mx-auto h-20 w-20 rounded-2xl bg-[#0a1628] border border-sky-500/30 shadow-glow-sky flex items-center justify-center text-sky-400 mb-6 animate-float">
          <ShieldAlert className="h-10 w-10 text-sky-400" />
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
        </div>

        <span className="section-label border-sky-200 bg-sky-50 text-sky-700 mb-3">
          Error 404 · Route Not Found
        </span>

        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mt-2">
          Municipal Route Not Found
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 mt-3 max-w-sm mx-auto leading-relaxed">
          The requested municipal service address does not exist or has been relocated within the
          Chandigarh CivicAI digital infrastructure.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to={ROUTES.HOME} className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Home className="h-4 w-4" />}
              className="w-full sm:w-auto btn-gradient-sky"
            >
              Return to Portal Home
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto"
          >
            <Button
              variant="outline"
              size="md"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Go Back
            </Button>
          </button>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 text-[11px] text-slate-400">
          Chandigarh Municipal Corporation · Digital Grievance Redressal
        </div>
      </PageContainer>
    </div>
  );
};

export default NotFoundPage;
