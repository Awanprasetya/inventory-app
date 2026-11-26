import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 p-8 text-center">
          <div className="rounded-full bg-red-100 p-3 text-red-600 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Terjadi Kesalahan pada Halaman Ini</h2>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            {this.state.error?.message || 'Gagal memuat komponen halaman. Silakan coba segarkan kembali.'}
          </p>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" />
              Segarkan Halaman
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              Ke Dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

