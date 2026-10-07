// ============================================================================
// Quản lý Doanh nghiệp (Giai đoạn 7 — multi-tenant).
// ============================================================================
// Chỉ hiển thị cho admin của công ty "chủ nền tảng" (Hoàng Long) — xem gate
// điều kiện ở App.tsx (nơi render component này). Gọi thẳng API server
// api/admin-companies.ts (KHÔNG qua dbService/Supabase client trực tiếp) vì
// bảng companies bị khoá hoàn toàn với anon/authenticated (Giai đoạn 3, chỉ
// service_role đọc/ghi) — server tự xác minh quyền qua JWT rồi mới dùng
// service role thay mặt.
import React, { useEffect, useState } from 'react';
import { Building2, Plus, Loader2, AlertCircle, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { getCurrentAccessToken } from '../lib/supabase';
import { getTenantUrl } from '../lib/tenant';

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  created_at: string;
}

async function callAdminCompaniesApi(method: 'GET' | 'POST', body?: any) {
  const token = getCurrentAccessToken();
  const res = await fetch('/api/admin-companies', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Có lỗi xảy ra, vui lòng thử lại.');
  return json;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadCompanies = () => {
    setIsLoading(true);
    setLoadError(null);
    callAdminCompaniesApi('GET')
      .then((json) => setCompanies(json.companies || []))
      .catch((e) => setLoadError(e.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await callAdminCompaniesApi('POST', { slug, name, adminUsername, adminPassword });
      // Địa chỉ riêng của công ty vừa tạo (null nếu chưa cấu hình tên miền gốc → chỉ nhắc mã công ty như trước)
      const url = getTenantUrl(slug);
      setSuccessMsg(
        `Đã tạo công ty "${name}" (mã: ${slug}). Tài khoản quản trị: ${adminUsername}.` +
        (url ? ` Địa chỉ riêng: ${url}` : '')
      );
      setSlug(''); setName(''); setAdminUsername(''); setAdminPassword('');
      setShowForm(false);
      loadCompanies();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg max-w-4xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">
            Quản Lý Doanh Nghiệp (Multi-tenant)
          </h3>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setFormError(null); setSuccessMsg(null); }}
          className="px-3 py-1.5 text-[11px] font-black rounded-lg bg-blue-600 text-white flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? 'Đóng' : 'Tạo công ty mới'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        Mỗi công ty dùng chung 1 hệ thống, dữ liệu tách biệt hoàn toàn theo <code className="text-slate-300">company_id</code>.
        Mỗi công ty có <b>địa chỉ riêng</b> dạng <code className="text-slate-300">ma-cong-ty.&lt;tên-miền&gt;</code> — gửi đúng địa chỉ này cho công ty để họ đăng nhập
        vào đúng dữ liệu của mình. Mã công ty chỉ gồm chữ thường không dấu, số, dấu gạch ngang (2–40 ký tự) và không trùng tên dành cho hệ thống (www, api, admin...).
      </p>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">MÃ CÔNG TY (SLUG) *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="vd: congtyxyz (sẽ thành congtyxyz.<tên-miền>)"
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 px-3 text-xs text-slate-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">TÊN CÔNG TY *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="vd: Công Ty TNHH XYZ"
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 px-3 text-xs text-slate-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">TÀI KHOẢN QUẢN TRỊ ĐẦU TIÊN *</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value.toLowerCase())}
                placeholder="vd: admin"
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 px-3 text-xs text-slate-200 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 font-bold mb-1">MẬT KHẨU (TỐI THIỂU 4 KÝ TỰ) *</label>
              <input
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2 px-3 text-xs text-slate-200 outline-none"
                required
              />
            </div>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 text-xs font-black rounded-lg bg-blue-600 text-white flex items-center gap-2 transition-all ${isSubmitting ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}`}
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSubmitting ? 'Đang tạo...' : 'Tạo công ty'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        <h4 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Danh sách công ty</h4>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải...
          </div>
        )}
        {loadError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        {!isLoading && !loadError && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] text-slate-500 uppercase border-b border-slate-800">
                  <th className="py-2 pr-3">Mã công ty</th>
                  <th className="py-2 pr-3">Tên công ty</th>
                  <th className="py-2 pr-3">Địa chỉ riêng</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2 pr-3">Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5 font-mono text-slate-200">
                        {c.slug}
                        <button
                          type="button"
                          title="Sao chép mã công ty"
                          onClick={() => navigator.clipboard?.writeText(c.slug).catch(() => {})}
                          className="text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{c.name}</td>
                    <td className="py-2 pr-3">
                      {(() => {
                        const url = getTenantUrl(c.slug);
                        if (!url) return <span className="text-slate-500 italic" title="Chưa đặt VITE_BASE_DOMAIN">Chưa cấu hình tên miền</span>;
                        return (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all" title="Mở địa chỉ riêng của công ty">
                              {url.replace(/^https?:\/\//, '')}
                            </a>
                            <a href={url} target="_blank" rel="noopener noreferrer" title="Mở trong tab mới" className="text-slate-500 hover:text-slate-300">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              type="button"
                              title="Sao chép địa chỉ để gửi cho công ty"
                              onClick={() => navigator.clipboard?.writeText(url).catch(() => {})}
                              className="text-slate-500 hover:text-slate-300 cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/30 text-slate-400'}`}>
                        {c.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-500">Chưa có công ty nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
