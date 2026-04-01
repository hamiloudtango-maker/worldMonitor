import { useAuth } from '@/v2/hooks/useAuth';
import AuthPage from '@/v2/components/AuthPage';
import Dashboard from '@/v2/components/Dashboard';
import { ThemeProvider, useTheme } from '@/v2/lib/theme';

function AppInner() {
  const auth = useAuth();
  const { t } = useTheme();

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans" style={{ background: t.bgApp }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 rounded-full animate-spin" style={{ borderColor: t.border, borderTopColor: t.accent }} />
          <span className="text-sm font-medium tracking-wide" style={{ color: t.textSecondary }}>Chargement...</span>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return <AuthPage onLogin={auth.login} onRegister={auth.register} />;
  }

  return <Dashboard user={auth.user} onLogout={auth.logout} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
