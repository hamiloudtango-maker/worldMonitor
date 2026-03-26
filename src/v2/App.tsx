import { useAuth } from '@/v2/hooks/useAuth';
import AuthPage from '@/v2/components/AuthPage';
import Dashboard from '@/v2/components/Dashboard';

export default function App() {
  const auth = useAuth();

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400 font-medium tracking-wide">Chargement...</span>
        </div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated') {
    return <AuthPage onLogin={auth.login} onRegister={auth.register} />;
  }

  return <Dashboard user={auth.user} onLogout={auth.logout} />;
}
