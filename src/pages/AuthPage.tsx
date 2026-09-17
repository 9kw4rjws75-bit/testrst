import { useState } from 'react';
import { ChefHat, LogIn, UserPlus, Utensils, Bike, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import type { UserRole } from '@/types';

type AuthMode = 'login' | 'register';
type RegisterRole = 'client' | 'caisse' | 'livreur';

export function AuthPage({ onBack }: { onBack?: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<RegisterRole>('client');
  const [roleCode, setRoleCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
    } else {
      if ((role === 'caisse' || role === 'livreur') && !roleCode) {
        setError('Un code de validation est requis pour ce rôle.');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp({
        email,
        password,
        fullName,
        phone,
        role: role as UserRole,
        roleCode: roleCode || undefined,
      });
      if (err) {
        setError(err);
      } else {
        setError(null);
        setMode('login');
        setEmail('');
        setPassword('');
        setFullName('');
        setPhone('');
        setRoleCode('');
      }
    }
    setLoading(false);
  };

  const roleIcons: Record<RegisterRole, React.ReactNode> = {
    client: <Utensils size={20} />,
    caisse: <ChefHat size={20} />,
    livreur: <Bike size={20} />,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30 mb-4">
            <ChefHat size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Le Gourmet</h1>
          <p className="text-slate-400 text-sm mt-1">Système de gestion du restaurant</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              <LogIn size={16} /> Connexion
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              <UserPlus size={16} /> Inscription
            </button>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label="Nom complet"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Jean Dupont"
                />
                <Input
                  label="Téléphone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="06 12 34 56 78"
                />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Type de compte</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['client', 'caisse', 'livreur'] as RegisterRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRole(r);
                          setError(null);
                        }}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                          role === r
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {roleIcons[r]}
                        <span className="text-xs font-medium capitalize">{r}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {(role === 'caisse' || role === 'livreur') && (
                  <div className="space-y-1.5">
                    <Input
                      label="Code de validation"
                      value={roleCode}
                      onChange={(e) => setRoleCode(e.target.value)}
                      placeholder="Code fourni par l'administrateur"
                      required
                    />
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                      <Shield size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        Les comptes caissier et livreur doivent être validés par un code fourni par l'administrateur. Votre compte sera en attente de validation.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vous@exemple.com"
            />
            <Input
              label="Mot de passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
            />

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading
                ? 'Chargement...'
                : mode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte'}
            </Button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Pas encore de compte ?{' '}
              <button
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="text-blue-600 font-medium hover:underline"
              >
                Créer un compte
              </button>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Client ? Commandez sans compte depuis la page d'accueil
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="mx-auto block mt-4 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Retour à l'accueil
          </button>
        )}
      </div>
    </div>
  );
}
