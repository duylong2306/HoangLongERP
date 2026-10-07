import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2, Pencil, X } from 'lucide-react';
import { platformCall, ApiError } from './platformApi';
import { formatVnd } from './format';

// TAB "GÓI DỊCH VỤ" — cấu hình tên gói, giá theo THÁNG và theo NĂM, số nhân viên tối đa, bật/tắt bán.
// Giá đổi ở đây chỉ áp dụng cho đơn MỚI; đơn đã tạo giữ nguyên số tiền lúc đặt.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (không dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm.
interface Plan { id: string; name: string; description: string; priceMonthly: number; priceYearly: number; maxEmployees: number | null; active: boolean; sortOrder: number }
const EMPTY: Plan = { id: '', name: '', description: '', priceMonthly: 0, priceYearly: 0, maxEmployees: null, active: false, sortOrder: 0 };

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors';
const input = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const label = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1';

export default function PlansTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ plan: Plan; isNew: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try { setPlans((await platformCall<{ plans: Plan[] }>('plans.list')).plans); }
    catch (e: any) { setLoadError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">Gói dịch vụ</h2>
          <p className="text-xs text-slate-500">Chỉ gói đang <b>bật bán</b> và đã có giá mới hiện cho khách mua. Giá 0 = chưa bán theo kỳ hạn đó.</p>
        </div>
        <button onClick={() => { setNotice(null); setEditing({ plan: { ...EMPTY, sortOrder: (plans.at(-1)?.sortOrder ?? 0) + 10 }, isNew: true }); }} className={`${btn} bg-blue-600 hover:bg-blue-700 text-[#ffffff]`}><Plus className="w-4 h-4" /> Thêm gói</button>
      </div>

      {notice && <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2.5 text-sm" role="status"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {notice}</div>}
      {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>}
      {loadError && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {loadError}</div>}

      {!loading && !loadError && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm" id="plans_table">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200 bg-slate-50">
                <th className="py-2.5 px-3">Gói</th><th className="py-2.5 px-3 text-right">Giá / tháng</th><th className="py-2.5 px-3 text-right">Giá / năm</th>
                <th className="py-2.5 px-3">Nhân viên tối đa</th><th className="py-2.5 px-3">Trạng thái</th><th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="py-2.5 px-3"><div className="font-bold text-slate-900">{p.name}</div><div className="font-mono text-xs text-slate-500">{p.id}</div>{p.description && <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{p.priceMonthly > 0 ? formatVnd(p.priceMonthly) : <span className="text-slate-400">Chưa đặt giá</span>}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{p.priceYearly > 0 ? formatVnd(p.priceYearly) : <span className="text-slate-400">Chưa đặt giá</span>}</td>
                  <td className="py-2.5 px-3">{p.maxEmployees ?? 'Không giới hạn'}</td>
                  <td className="py-2.5 px-3"><span className={`inline-block px-2 py-0.5 rounded border text-xs font-bold ${p.active ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>{p.active ? 'Đang bán' : 'Đã tắt'}</span></td>
                  <td className="py-2.5 px-3 text-right"><button onClick={() => { setNotice(null); setEditing({ plan: p, isNew: false }); }} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100`}><Pencil className="w-3.5 h-3.5" /> Sửa</button></td>
                </tr>
              ))}
              {plans.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">Chưa có gói nào.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && <PlanModal initial={editing.plan} isNew={editing.isNew} onClose={() => setEditing(null)} onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }} />}
    </div>
  );
}

function PlanModal({ initial, isNew, onClose, onSaved }: { initial: Plan; isNew: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [f, setF] = useState({
    id: initial.id, name: initial.name, description: initial.description,
    priceMonthly: String(initial.priceMonthly), priceYearly: String(initial.priceYearly),
    maxEmployees: initial.maxEmployees === null ? '' : String(initial.maxEmployees), active: initial.active, sortOrder: String(initial.sortOrder),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setErrors({});
    try {
      await platformCall('plans.save', { ...f, priceMonthly: f.priceMonthly === '' ? null : Number(f.priceMonthly), priceYearly: f.priceYearly === '' ? null : Number(f.priceYearly) });
      onSaved(`Đã lưu gói "${f.name}".`);
    } catch (err: any) {
      setError(err.message);
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
    } finally { setBusy(false); }
  };
  const err = (k: string) => errors[k] && <p className="text-xs text-rose-600 mt-1">{errors[k]}</p>;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={isNew ? 'Thêm gói' : 'Sửa gói'}>
      <form onSubmit={save} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4 my-auto" id="plan_form">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-black text-slate-900">{isNew ? 'Thêm gói dịch vụ' : `Sửa gói: ${initial.name}`}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={label} htmlFor="pl_ma_goi">Mã gói *</label><input id="pl_ma_goi" className={`${input} font-mono`} value={f.id} disabled={!isNew} onChange={e => setF(p => ({ ...p, id: e.target.value.toLowerCase() }))} placeholder="vd: co-ban" required />{err('id')}{!isNew && <p className="text-xs text-slate-500 mt-1">Mã gói không đổi được.</p>}</div>
          <div><label className={label} htmlFor="pl_ten_goi">Tên gói *</label><input id="pl_ten_goi" className={input} value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required />{err('name')}</div>
          <div className="sm:col-span-2"><label className={label} htmlFor="pl_mo_ta_ngan">Mô tả ngắn</label><input id="pl_mo_ta_ngan" className={input} value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} maxLength={300} />{err('description')}</div>
          <div><label className={label} htmlFor="pl_gia_theo_thang_vnd">Giá theo tháng (VNĐ) *</label><input id="pl_gia_theo_thang_vnd" type="number" min={0} className={`${input} font-mono`} value={f.priceMonthly} onChange={e => setF(p => ({ ...p, priceMonthly: e.target.value }))} required />{err('priceMonthly')}<p className="text-xs text-slate-500 mt-1">{formatVnd(Number(f.priceMonthly) || 0)}</p></div>
          <div><label className={label} htmlFor="pl_gia_theo_nam_vnd">Giá theo năm (VNĐ) *</label><input id="pl_gia_theo_nam_vnd" type="number" min={0} className={`${input} font-mono`} value={f.priceYearly} onChange={e => setF(p => ({ ...p, priceYearly: e.target.value }))} required />{err('priceYearly')}<p className="text-xs text-slate-500 mt-1">{formatVnd(Number(f.priceYearly) || 0)}</p></div>
          <div><label className={label} htmlFor="pl_so_nhan_vien_toi_da">Số nhân viên tối đa</label><input id="pl_so_nhan_vien_toi_da" type="number" min={1} className={input} value={f.maxEmployees} onChange={e => setF(p => ({ ...p, maxEmployees: e.target.value }))} placeholder="Để trống = không giới hạn" />{err('maxEmployees')}</div>
          <div><label className={label} htmlFor="pl_thu_tu_hien_thi">Thứ tự hiển thị</label><input id="pl_thu_tu_hien_thi" type="number" className={input} value={f.sortOrder} onChange={e => setF(p => ({ ...p, sortOrder: e.target.value }))} />{err('sortOrder')}</div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={f.active} onChange={e => setF(p => ({ ...p, active: e.target.checked }))} /> Đang bán (hiện cho khách mua)</label>
        {error && <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-100 !px-4 !py-2`}>Hủy</button>
          <button type="submit" disabled={busy} className={`${btn} bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] !px-4 !py-2`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Lưu gói</button>
        </div>
      </form>
    </div>
  );
}
