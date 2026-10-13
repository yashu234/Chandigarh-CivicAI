import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <PageContainer maxWidth="sm" className="py-20 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 mb-6 border border-slate-200">
        <ShieldAlert className="h-8 w-8 text-slate-600" />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404</h1>
      <h2 className="text-lg font-semibold text-slate-700 mt-2">Civic Page Not Found</h2>
      <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
        The requested municipal route does not exist or has been relocated within the Chandigarh CivicAI platform.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Link to={ROUTES.HOME}>
          <Button variant="primary" size="sm" leftIcon={<Home className="h-4 w-4" />}>
            Return to Home
          </Button>
        </Link>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center"
        >
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Go Back
          </Button>
        </button>
      </div>
    </PageContainer>
  );
};
