import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — bao vây toàn bộ cây React.
 *
 * TRƯỚC ĐÂY: nếu bất kỳ menu nào (Nhân sự, Thầu phụ, Việc của tôi, …) ném lỗi
 * render (ví dụ: temporal-dead-zone ReferenceError, JSON.parse hỏng từ
 * localStorage, props undefined), toàn bộ React root bị unmount → chỉ còn nền
 * xanh đậm của <body> (bg-slate-950). Người dùng không thấy lỗi gì cả.
 *
 * SAU KHI THÊM: lỗi chỉ phá hoại phần được bao bởi boundary này, hiển thị panel
 * báo lỗi rõ ràng (kèm thông điệp thực tế để chẩn đoán) thay vì màn hình xanh
 * trống. Có nút "Thử lại" để reset state và render lại.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Ghi log ra console để dễ dàng chẩn đoán (F12 → Console)
    console.error('[ErrorBoundary] Lỗi render bị bắt:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errMsg = this.state.error?.message || 'Lỗi không xác định';
      return (
        <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-2xl w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <h2 className="text-base font-extrabold text-white">Đã xảy ra lỗi khi hiển thị màn hình này</h2>
            </div>

            <p className="text-[13px] text-slate-400 leading-relaxed">
              Một lỗi không mong muốn đã làm gián đoạn giao diện. Chi tiết lỗi bên dưới — bạn có thể nhấn <strong className="text-slate-200">"Thử lại"</strong> để tải lại, hoặc sao chép thông điệp này báo cho kỹ thuật viên.
            </p>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11.5px] text-rose-300 whitespace-pre-wrap break-words max-h-60 overflow-auto font-mono">
              {errMsg}
              {this.state.error?.stack ? `\n\n${this.state.error.stack}` : ''}
            </pre>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleRetry}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                🔄 Thử lại
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
              >
                🔃 Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
