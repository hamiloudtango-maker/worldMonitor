import { useState, type FormEvent } from 'react';
import { Globe } from 'lucide-react';
import { useTheme } from '@/v2/lib/theme';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, org: string) => Promise<void>;
}

export default function AuthPage({ onLogin, onRegister }: Props) {
  const { t } = useTheme();
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans" style={{ background: t.bgApp }}>
      <div className="absolute inset-0 opacity-[0.08]" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, ${t.accent} 1px, transparent 0)`,
        backgroundSize: '32px 32px',
      }} />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${t.accent}, #6366f1)` }}>
              <Globe size={22} className="text-white" />
            </div>
            <span className="text-2xl font-extrabold tracking-wide" style={{ color: t.textHeading }}>
              WORLDMONITOR
            </span>
          </div>
          <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: t.accent }}>Intelligence Platform</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: t.bgCard, border: `1px solid ${t.border}` }}>
          <h2 className="text-xl font-bold mb-1" style={{ color: t.textHeading }}>
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h2>
          <p className="text-sm mb-6" style={{ color: t.textSecondary }}>
            {isLogin ? 'Accédez à votre espace d\'intelligence' : 'Commencez à surveiller le monde'}
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl border text-sm" style={{ background: t.errorBg, borderColor: t.errorBorder, color: t.errorText }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: t.textSecondary }}>Organisation</label>
                <input name="org" type="text" required placeholder="Nom de l'organisation"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{ background: t.bgSidebar, border: `1px solid ${t.border}`, color: t.textPrimary }} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: t.textSecondary }}>Email</label>
              <input name="email" type="email" required placeholder="analyste@organisation.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: t.bgSidebar, border: `1px solid ${t.border}`, color: t.textPrimary }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: t.textSecondary }}>Mot de passe</label>
              <input name="password" type="password" minLength={6} required placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: t.bgSidebar, border: `1px solid ${t.border}`, color: t.textPrimary }} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 mt-2 text-white font-semibold text-sm rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: t.accent }}>
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

          <div className="mt-6 text-center text-sm" style={{ color: t.textSecondary }}>
            {isLogin ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
            <button onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}
              className="font-semibold transition-colors" style={{ color: t.accent }}>
              {isLogin ? 'S\'inscrire' : 'Se connecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
