import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2, ExternalLink, Search, Pencil, Lock, Unlock, X } from 'lucide-react';
import CopyButton from '../CopyButton';
import { getTenantUrl } from '../../lib/tenant';
import { platformCall } from './platformApi';
import ConfirmDialog from './ConfirmDialog';
import { formatDate, toDateInput, fromDateInputEndOfDay, STATUS_BADGE, STATUS_LABEL, type SubStatus } from './format';

// TAB "DOANH NGHIỆP" — thay cho "Quản Lý Doanh Nghiệp" cũ nằm trong ERP: xem mọi doanh nghiệp, trạng thái gói/ngày hết hạn,
// tạo doanh nghiệp mới, chỉnh gói/ngày hết hạn thủ công, khóa/mở doanh nghiệp.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.

interface Company {
  id: string; slug: string; name: string; active: boolean; createdAt: string;
  planId: string | null; planName: string | null; maxEmployees: number | null;
  expiresAt: string | null; isTrial: boolean; status: SubStatus; daysLeft: number | null; employeeCount: number;
}
interface PlanOpt { id: string; name: string }

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1';

export default function CompaniesTab() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SubStatus | 'locked'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [c, p] = await Promise.all([platformCall<{ companies: Company[] }>('companies.list'), platformCall<{ plans: PlanOpt[] }>('plans.list')]);
      setCompanies(c.companies); setPlans(p.plans);
    } catch (e: any) { setLoadError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return companies.filter(c => {
      if (statusFilter === 'locked' ? c.active : statusFilter !== 'all' && c.status !== statusFilter) return false;
      return !kw || c.name.toLowerCase().includes(kw) || c.slug.includes(kw);
    });
  }, [companies, search, statusFilter]);

  // Khóa/mở doanh nghiệp: bấm nút chỉ MỞ HỘP CẢNH BÁO (ConfirmDialog); chỉ khi bấm xác nhận mới gọi máy chủ.
  const [lockTarget, setLockTarget] = useState<Company | null>(null);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const toggleActive = (c: Company) => { setLockError(null); setLockTarget(c); };
  const doToggle = async () => {
    const c = lockTarget;
    if (!c || lockBusy) return;
    setLockBusy(true); setLockError(null);
    try {
      await platformCall('companies.update', { id: c.id, active: !c.active });
      setNotice(`Đã ${c.active ? 'khóa' : 'mở lại'} "${c.name}".`); setLockTarget(null); load();
    } catch (e: any) { setLockError(e.message); } finally { setLockBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-900">Doanh nghiệp ({companies.length})</h2>
        <button onClick={() => { setShowCreate(v => !v); setNotice(null); }} className={`${btn} bg-blue-600 hover:bg-blue-700 text-[#ffffff]`}>
          <Plus className="w-4 h-4" /> {showCreate ? 'Đóng' : 'Tạo doanh nghiệp'}
        </button>
      </div>

      {notice && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2.5 text-sm" role="status">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span className="break-all">{notice}</span>
        </div>
      )}

      {showCreate && <CreateForm onDone={(msg) => { setShowCreate(false); setNotice(msg); load(); }} />}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input className={`${input} pl-9`} placeholder="Tìm theo tên hoặc mã doanh nghiệp..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={`${input} !w-auto`} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} aria-label="Lọc theo trạng thái">
          <option value="all">Tất cả trạng thái</option>
          <option value="trial">Dùng thử</option>
          <option value="active">Đang dùng</option>
          <option value="expired">Hết hạn</option>
          <option value="unlimited">Không giới hạn</option>
          <option value="locked">Đã khóa</option>
        </select>
      </div>

      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>}
      {loadError && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {loadError}</div>}

      {!loading && !loadError && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm" id="companies_table">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                <th className="py-2.5 px-3">Doanh nghiệp</th><th className="py-2.5 px-3">Trạng thái</th><th className="py-2.5 px-3">Gói</th>
                <th className="py-2.5 px-3">Hết hạn</th><th className="py-2.5 px-3">Nhân viên</th><th className="py-2.5 px-3">Địa chỉ riêng</th><th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map(c => {
                const url = getTenantUrl(c.slug);
                const limitHit = c.maxEmployees !== null && c.employeeCount >= c.maxEmployees;
                return (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="font-mono text-xs text-slate-500">{c.slug} · tạo {formatDate(c.createdAt)}</div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                      {!c.active && <span className="inline-block ml-1 px-2 py-0.5 rounded border text-xs font-bold bg-slate-800 border-slate-800 text-[#ffffff]">Đã khóa</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{c.planName || (c.isTrial ? 'Dùng thử' : '—')}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {c.expiresAt ? (
                        <>
                          <div className="font-semibold text-slate-800">{formatDate(c.expiresAt)}</div>
                          <div className={`text-xs ${c.status === 'expired' ? 'text-rose-600 font-bold' : (c.daysLeft ?? 99) <= 3 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                            {c.status === 'expired' ? 'Đã hết hạn' : `Còn ${c.daysLeft} ngày`}
                          </div>
                        </>
                      ) : <span className="text-slate-500">Không giới hạn</span>}
                    </td>
                    <td className={`py-2.5 px-3 whitespace-nowrap ${limitHit ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
                      {c.employeeCount}{c.maxEmployees !== null ? ` / ${c.maxEmployees}` : ''}
                    </td>
                    <td className="py-2.5 px-3">
                      {url ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{url.replace(/^https?:\/\//, '')}</a>
                          <a href={url} target="_blank" rel="noopener noreferrer" title="Mở trong tab mới" className="text-slate-400 hover:text-slate-700"><ExternalLink className="w-3.5 h-3.5" /></a>
                          <CopyButton text={url} label="địa chỉ" iconClass="w-3.5 h-3.5" />
                        </span>
                      ) : <span className="text-xs text-slate-400 italic">Chưa cấu hình tên miền</span>}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right">
                      <button onClick={() => setEditing(c)} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100`}><Pencil className="w-3.5 h-3.5" /> Gói & hạn</button>{' '}
                      <button onClick={() => toggleActive(c)} className={`${btn} border ${c.active ? 'border-rose-300 text-rose-700 hover:bg-rose-50' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>
                        {c.active ? <><Lock className="w-3.5 h-3.5" /> Khóa</> : <><Unlock className="w-3.5 h-3.5" /> Mở</>}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-500">Không có doanh nghiệp nào.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {lockTarget && (
        lockTarget.active ? (
          <ConfirmDialog title={`Khóa doanh nghiệp "${lockTarget.name}"?`} confirmLabel="Khóa doanh nghiệp" danger busy={lockBusy} error={lockError} onConfirm={doToggle} onClose={() => setLockTarget(null)}>
            <p><b>Toàn bộ nhân viên</b> của doanh nghiệp này sẽ <b>không đăng nhập được</b> và <b>không đọc/ghi được dữ liệu ngay lập tức</b>; ai đang mở ERP sẽ thấy thông báo khóa khi tải lại trang. Chặn cho tới khi bạn mở lại.</p>
            <p>Dữ liệu của doanh nghiệp được giữ nguyên, không bị xóa.</p>
          </ConfirmDialog>
        ) : (
          <ConfirmDialog title={`Mở lại doanh nghiệp "${lockTarget.name}"?`} confirmLabel="Mở lại" busy={lockBusy} error={lockError} onConfirm={doToggle} onClose={() => setLockTarget(null)}>
            <p>Nhân viên của doanh nghiệp này sẽ đăng nhập và sử dụng lại được (nếu gói còn hạn).</p>
          </ConfirmDialog>
        )
      )}

      {editing && <EditModal company={editing} plans={plans} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }} />}
    </div>
  );
}

// ─── Tạo doanh nghiệp ───────────────────────────────────────────────────────────────────────────
function CreateForm({ onDone }: { onDone: (msg: string) => void }) {
  const [f, setF] = useState({ slug: '', name: '', adminName: '', adminUsername: 'admin', adminPassword: '', subscription: 'trial' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await platformCall('companies.create', f);
      const url = getTenantUrl(f.slug.trim().toLowerCase());
      onDone(`Đã tạo "${f.name}". Tài khoản quản trị: ${f.adminUsername}.${url ? ` Địa chỉ riêng: ${url}` : ''}`);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3" id="create_company_form">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label} htmlFor="cm_ma_doanh_nghiep_dia_chi">Mã doanh nghiệp (địa chỉ) *</label><input id="cm_ma_doanh_nghiep_dia_chi" className={`${input} font-mono`} value={f.slug} onChange={e => setF(p => ({ ...p, slug: e.target.value.toLowerCase() }))} placeholder="vd: dai-phat" required /></div>
        <div><label className={label} htmlFor="cm_ten_doanh_nghiep">Tên doanh nghiệp *</label><input id="cm_ten_doanh_nghiep" className={input} value={f.name} onChange={set('name')} required /></div>
        <div><label className={label} htmlFor="cm_ho_ten_nguoi_quan_tri">Họ tên người quản trị</label><input id="cm_ho_ten_nguoi_quan_tri" className={input} value={f.adminName} onChange={set('adminName')} /></div>
        <div><label className={label} htmlFor="cm_ten_dang_nhap_quan_tri">Tên đăng nhập quản trị *</label><input id="cm_ten_dang_nhap_quan_tri" className={input} value={f.adminUsername} onChange={e => setF(p => ({ ...p, adminUsername: e.target.value.toLowerCase() }))} required /></div>
        <div><label className={label} htmlFor="cm_mat_khau_toi_thieu_4_ky_tu">Mật khẩu (tối thiểu 4 ký tự) *</label><input id="cm_mat_khau_toi_thieu_4_ky_tu" className={input} type="text" value={f.adminPassword} onChange={set('adminPassword')} required /></div>
        <div>
          <label className={label} htmlFor="cm_han_dung_ban_dau">Hạn dùng ban đầu</label>
          <select id="cm_han_dung_ban_dau" className={input} value={f.subscription} onChange={set('subscription')}>
            <option value="trial">Dùng thử (theo cấu hình ngày dùng thử)</option>
            <option value="unlimited">Không giới hạn</option>
          </select>
        </div>
      </div>
      {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
      <button type="submit" disabled={busy} className={`${btn} bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] !px-4 !py-2`}>
        {busy && <Loader2 className="w-4 h-4 animate-spin" />} {busy ? 'Đang tạo...' : 'Tạo doanh nghiệp'}
      </button>
    </form>
  );
}

// ─── Sửa gói / ngày hết hạn thủ công ────────────────────────────────────────────────────────────
function EditModal({ company, plans, onClose, onSaved }: { company: Company; plans: PlanOpt[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [planId, setPlanId] = useState(company.planId || '');
  const [expires, setExpires] = useState(toDateInput(company.expiresAt));
  const [isTrial, setIsTrial] = useState(company.isTrial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cộng nhanh vào ngày hết hạn: tính từ hạn hiện tại nếu còn hạn, ngược lại từ hôm nay.
  const addMonths = (n: number) => {
    const base = expires ? new Date(`${expires}T00:00:00`) : new Date();
    const from = base.getTime() > Date.now() ? base : new Date();
    from.setMonth(from.getMonth() + n);
    setExpires(toDateInput(from.toISOString()));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await platformCall('companies.update', { id: company.id, planId: planId || null, expiresAt: fromDateInputEndOfDay(expires), isTrial });
      onSaved(`Đã cập nhật gói và hạn dùng của "${company.name}".`);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Sửa gói và ngày hết hạn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div><h3 className="font-black text-slate-900">Gói & ngày hết hạn</h3><p className="text-xs text-slate-500">{company.name} · <span className="font-mono">{company.slug}</span></p></div>
          <button onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <div><label className={label} htmlFor="cm_goi">Gói</label>
          <select id="cm_goi" className={input} value={planId} onChange={e => setPlanId(e.target.value)}>
            <option value="">— Không gán gói —</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="cm_ngay_het_han_den_het_ngay_nay">Ngày hết hạn (đến hết ngày này)</label>
          <input id="cm_ngay_het_han_den_het_ngay_nay" type="date" className={input} value={expires} onChange={e => setExpires(e.target.value)} />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" onClick={() => addMonths(1)} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100`}>+1 tháng</button>
            <button type="button" onClick={() => addMonths(12)} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100`}>+1 năm</button>
            <button type="button" onClick={() => setExpires('')} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100`}>Không giới hạn</button>
          </div>
          <p className="text-xs text-slate-500 mt-1">{expires ? 'Quá ngày này doanh nghiệp bị khóa, chỉ vào được trang gia hạn.' : 'Để trống = không bao giờ hết hạn.'}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={isTrial} onChange={e => setIsTrial(e.target.checked)} /> Đang trong thời gian dùng thử</label>

        {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100 !px-4 !py-2`}>Hủy</button>
          <button onClick={save} disabled={busy} className={`${btn} bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] !px-4 !py-2`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Lưu</button>
        </div>
      </div>
    </div>
  );
}
