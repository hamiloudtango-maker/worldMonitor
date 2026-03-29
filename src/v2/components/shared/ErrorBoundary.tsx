import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Label shown in the error card (e.g. widget title) */
  label?: string;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
          <AlertTriangle size={20} className="text-amber-400" />
          <p className="text-[11px] font-semibold text-slate-500">
            {this.props.label ? `${this.props.label} — ` : ''}Erreur d'affichage
          </p>
          <p className="text-[10px] text-slate-400 max-w-[200px] truncate">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="mt-1 flex items-center gap-1 px-2 py-1 text-[10px] text-slate-500 border border-slate-200 rounded hover:bg-slate-50"
          >
            <RefreshCw size={10} /> Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
