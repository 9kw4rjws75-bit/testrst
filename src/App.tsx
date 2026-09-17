import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthPage } from '@/pages/AuthPage';
import { ClientApp } from '@/pages/ClientApp';
import { CashierApp } from '@/pages/CashierApp';
import { DeliveryApp } from '@/pages/DeliveryApp';
import { AdminApp } from '@/pages/AdminApp';
import { LoadingSpinner } from '@/components/ui/Feedback';

type PublicView = 'client' | 'auth';

function AppRouter() {
  const { session, profile, loading, signOut } = useAuth();
  const [publicView, setPublicView] = useState<PublicView>('client');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (!session || !profile) {
    if (publicView === 'auth') {
      return <AuthPage onBack={() => setPublicView('client')} />;
    }
    return <ClientApp onStaffLogin={() => setPublicView('auth')} />;
  }

  if (profile.status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Compte en attente de validation</h1>
          <p className="text-sm text-slate-500 mt-2">
            Votre compte {profile.role} est en attente de validation par l'administrateur.
            Vous recevrez une notification dès qu'il sera activé.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  if (profile.status === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Compte suspendu</h1>
          <p className="text-sm text-slate-500 mt-2">
            Votre compte a été suspendu. Contactez l'administrateur pour plus d'informations.
          </p>
        </div>
      </div>
    );
  }

  switch (profile.role) {
    case 'admin':
      return <AdminApp />;
    case 'caisse':
      return <CashierApp />;
    case 'livreur':
      return <DeliveryApp />;
    case 'client':
    default:
      return <ClientApp onStaffLogin={() => setPublicView('auth')} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
