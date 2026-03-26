import { useState, type FormEvent } from 'react';
import { Globe } from 'lucide-react';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, org: string) => Promise<void>;
}

export default function AuthPage({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isLogin = mode === 'login';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      if (isLogin) {
        await onLogin(fd.get('email') as string, fd.get('password') as string);
      } else {
        await onRegister(fd.get('email') as string, fd.get('password') as string, fd.get('org') as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'authentification');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9] relative overflow-hidden font-sans">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.4]" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-[#42d3a5] to-[#3b82f6] rounded-xl flex items-center justify-center shadow-lg shadow-[#42d3a5]/20">
              <Globe size={22} className="text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-wide text-slate-900">
              WORLDMONITOR
            </span>
          </div>
          <p className="text-xs text-[#42d3a5] font-bold tracking-[0.25em] uppercase">Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl shadow-slate-200/50 border border-slate-200/60">
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            {isLogin ? 'Accédez à votre espace d\'intelligence' : 'Commencez à surveiller le monde'}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl border text-sm bg-red-50 border-red-200 text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Organisation</label>
                <input
                  name="org" type="text" required
                  placeholder="Nom de l'organisation"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10 focus:bg-white"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                name="email" type="email" required
                placeholder="analyste@organisation.com"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Mot de passe</label>
              <input
                name="password" type="password" minLength={6} required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-[#42d3a5] focus:ring-2 focus:ring-[#42d3a5]/10 focus:bg-white"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3 mt-2 bg-[#42d3a5] hover:bg-[#38b58d] text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 shadow-md shadow-[#42d3a5]/20"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connexion...
                </span>
              ) : (
                isLogin ? 'Se connecter' : 'Créer le compte'
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {isLogin ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
            <button
              onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}
              className="text-[#42d3a5] hover:text-[#2a9d7e] font-semibold transition-colors"
            >
              {isLogin ? 'S\'inscrire' : 'Se connecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
