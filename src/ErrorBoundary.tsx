import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep app alive and log full details for debugging.
    console.error("Dashboard runtime error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="panel-dark p-6 text-slate-100">
          <h3 className="text-xl font-semibold text-rose-300 mb-2">UI Recovery Mode</h3>
          <p className="text-sm text-slate-300 mb-2">
            A rendering error occurred. The dashboard did not crash completely.
          </p>
          <p className="text-xs text-slate-400">Error: {this.state.message || "Unknown error"}</p>
          <button
            type="button"
            className="action-btn action-btn-secondary mt-4"
            onClick={() => window.location.reload()}
          >
            Reload Dashboard
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

