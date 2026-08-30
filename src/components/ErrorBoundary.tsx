import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React Error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearDraftAndReload = () => {
    try {
      localStorage.removeItem("subtranslate_autosave_draft_v1");
    } catch (_) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-heebo" dir="rtl">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 text-right">
            <div className="flex items-center space-x-3 space-x-reverse text-amber-400">
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">אירעה שגיאה בלתי צפויה במערכת</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  ממשק העריכה נתקל בחריגה זמנית. שום מידע לא אבד.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 break-words max-h-32 overflow-y-auto ltr dir-ltr text-left">
                {this.state.error.toString()}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-blue-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                רענן וטען מחדש
              </button>
              <button
                onClick={this.handleClearDraftAndReload}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium rounded-xl flex items-center justify-center gap-2 transition cursor-pointer border border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                אפס טיוטה שמורה
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
