import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Users, Wallet, Warehouse, HardHat, FolderKanban, CheckCircle2, AlertCircle,
  Eye, EyeOff, ArrowRight, Loader2, ExternalLink,
} from 'lucide-react';
import { slugify } from '../../lib/slug';
import { getBaseDomainForDisplay, getTenantUrl } from '../../lib/tenant';

// TRANG GIỚI THIỆU + ĐĂNG KÝ DOANH NGHIỆP (Giai đoạn 2) — hiện ở địa chỉ gốc (www.lolo.io.vn), kiểu KiotViet:
// khách nhập thông tin → hệ thống tạo doanh nghiệp + tài khoản quản trị và cấp địa chỉ riêng <tên>.lolo.io.vn.
// ⚠️ Chữ trắng dùng `text-[#ffffff]` (KHÔNG dùng `text-white`): src/index.css ghi đè mọi `.text-white` thành xám đậm
// (!important) cho giao diện ERP nền sáng → chữ trắng trên nền xanh sẽ thành chữ tối, khó đọc.
// Được main.tsx chọn khi tên miền là "root" (xem src/lib/tenant.ts); KHÔNG nạp ứng dụng ERP/Supabase ở trang này.

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const FEATURES = [
  { icon: FolderKanban, title: 'Quản lý dự án', text: 'Theo dõi dự án, công việc, tiến độ và báo cáo công trình trên bảng Kanban.' },
  { icon: Users, title: 'Nhân sự & chấm công', text: 'Hồ sơ nhân sự, chấm công, nghỉ phép, bảng lương và phân quyền theo vai trò.' },
  { icon: Wallet, title: 'Kế toán – Tài chính', text: 'Thu chi, công nợ phải thu/phải trả, đề xuất chi, quỹ tiền mặt và báo giá.' },
  { icon: Warehouse, title: 'Kho & vật tư', text: 'Điều phối vật tư, đơn mua hàng, nhập kho, tồn kho và nhà cung cấp.' },
  { icon: HardHat, title: 'Thầu phụ', text: 'Hợp đồng thầu phụ, tạm ứng, thanh toán công nợ và hồ sơ nghiệm thu.' },
  { icon: Building2, title: 'Mỗi doanh nghiệp một địa chỉ riêng', text: 'Dữ liệu tách biệt hoàn toàn, truy cập qua địa chỉ riêng của doanh nghiệp bạn.' },
];

interface PublicPlan { id: string; name: string; description: string; priceMonthly: number; priceYearly: number; maxEmployees: number | null }
const vnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(Math.round(n))} đ`;

interface FieldErrors { [k: string]: string | undefined }
type SlugState = { status: 'idle' | 'checking' | 'ok' | 'bad'; message?: string };

declare global { interface Window { turnstile?: any } }

// Địa chỉ đầy đủ của 1 doanh nghiệp (dùng chung với màn quản trị — src/lib/tenant.ts). Landing chỉ chạy ở địa chỉ gốc nên
// luôn có tên miền gốc; dự phòng ghép tay nếu thiếu cấu hình.
function tenantUrl(slug: string): string {
  return getTenantUrl(slug) ?? `${window.location.protocol}//${slug}.${getBaseDomainForDisplay()}`;
}

export default function LandingPage() {
  const baseDomain = useMemo(() => getBaseDomainForDisplay(), []);

  // ── Form đăng ký ──
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);     // đã tự sửa địa chỉ → thôi tự gợi ý theo tên
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [website, setWebsite] = useState('');               // honeypot: người thật không thấy/không điền
  const [captchaToken, setCaptchaToken] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>({ status: 'idle' });
  const [done, setDone] = useState<{ slug: string; name: string; username: string; trialEndsAt: string | null } | null>(null);
  // Bảng giá + số ngày dùng thử: lấy từ api/subscription (cấu hình ở trang quản trị). Lỗi → ẩn bảng giá, dùng mặc định 7 ngày.
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [trialDays, setTrialDays] = useState(7);

  useEffect(() => {
    fetch('/api/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'plans' }) })
      .then(r => (r.ok ? r.json() : null))
      .then(b => { if (b) { setPlans(b.plans || []); if (Number.isInteger(b.trialDays)) setTrialDays(b.trialDays); } })
      .catch(() => { /* không có bảng giá thì thôi */ });
  }, []);

  // ── "Vào doanh nghiệp của tôi" ──
  const [goSlug, setGoSlug] = useState('');

  // Tên → tự gợi ý địa chỉ, cho tới khi người dùng tự sửa ô địa chỉ.
  useEffect(() => {
    if (!slugEdited) setSlug(slugify(companyName));
  }, [companyName, slugEdited]);

  // Kiểm tra địa chỉ còn trống (trễ 400ms sau lần gõ cuối để không gọi API từng phím).
  useEffect(() => {
    if (!slug) { setSlugState({ status: 'idle' }); return; }
    setSlugState({ status: 'checking' });
    let active = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/check-slug?slug=${encodeURIComponent(slug)}`);
        const b = await r.json();
        if (!active) return;
        if (!r.ok) setSlugState({ status: 'idle' });   // lỗi máy chủ: không chặn, máy chủ sẽ kiểm tra lại khi đăng ký
        else setSlugState(b.available ? { status: 'ok' } : { status: 'bad', message: b.message });
      } catch { if (active) setSlugState({ status: 'idle' }); }
    }, 400);
    return () => { active = false; clearTimeout(t); };
  }, [slug]);

  // ── CAPTCHA Cloudflare Turnstile (chỉ khi có VITE_TURNSTILE_SITE_KEY) ──
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || done) return;
    const render = () => {
      if (!captchaRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(captchaRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(''),
        'error-callback': () => setCaptchaToken(''),
      });
    };
    if (window.turnstile) { render(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [done]);

  const resetCaptcha = () => {
    setCaptchaToken('');
    try { if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current); } catch { /* bỏ qua */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setFormError('Vui lòng hoàn thành bước xác minh "Tôi không phải người máy".');
      return;
    }
    if (slugState.status === 'bad') {
      setErrors({ slug: slugState.message });
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const r = await fetch('/api/register-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, slug, adminName, email, phone, password, website, captchaToken }),
      });
      const b = await r.json().catch(() => ({}));
      if (r.status === 201) {
        setDone({ slug: b.company.slug, name: b.company.name, username: b.adminUsername || 'admin', trialEndsAt: b.trial?.endsAt ?? null });
        return;
      }
      if (b?.errors) setErrors(b.errors);
      setFormError(b?.error || 'Không đăng ký được. Vui lòng thử lại.');
      resetCaptcha();
    } catch {
      setFormError('Không kết nối được tới máy chủ. Vui lòng thử lại.');
      resetCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const s = slugify(goSlug);
    if (s) window.location.href = tenantUrl(s);
  };

  const inputCls = (err?: string) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${err ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300 bg-white'}`;
  const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1';
  const errCls = 'text-xs text-rose-600 mt-1';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* Đầu trang */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/lolo-icon-192.png" alt="LoLo" className="w-9 h-9 rounded-lg" />
            <span className="font-black text-lg tracking-wide text-slate-900">LoLo</span>
          </div>
          <a href="#vao" className="text-sm font-semibold text-blue-700 hover:text-blue-800">Đã có doanh nghiệp? Đăng nhập</a>
        </div>
      </header>

      {/* Giới thiệu */}
      <section className="bg-gradient-to-b from-blue-700 to-blue-600 text-[#ffffff]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <h1 className="text-3xl sm:text-5xl font-black leading-tight">Quản trị doanh nghiệp<br className="hidden sm:block" /> trên một nền tảng</h1>
          <p className="mt-4 text-blue-100 text-base sm:text-lg max-w-2xl mx-auto">
            Dự án, nhân sự, kế toán, kho vật tư và thầu phụ trong cùng một hệ thống. Đăng ký trong vài phút,
            nhận ngay địa chỉ riêng cho doanh nghiệp của bạn và <b>dùng thử miễn phí {trialDays} ngày</b>.
          </p>
          <a href="#dang-ky" className="inline-flex items-center gap-2 mt-8 bg-white text-blue-700 font-bold px-6 py-3 rounded-lg shadow hover:bg-blue-50">
            Dùng thử {trialDays} ngày <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Tính năng */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 text-center">Mọi nghiệp vụ trong một nơi</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
              <h3 className="mt-3 font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bảng giá — chỉ hiện khi quản trị đã mở bán ít nhất 1 gói */}
      {plans.length > 0 && (
        <section id="bang-gia" className="bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 text-center">Bảng giá</h2>
            <p className="text-center text-sm text-slate-600 mt-1">Dùng thử miễn phí {trialDays} ngày, sau đó chọn gói phù hợp. Thanh toán theo tháng hoặc theo năm.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map(p => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-5 flex flex-col">
                  <h3 className="font-black text-slate-900 text-lg">{p.name}</h3>
                  {p.description && <p className="text-sm text-slate-500 mt-1">{p.description}</p>}
                  <div className="mt-4 space-y-1">
                    {p.priceMonthly > 0 && <div><span className="text-2xl font-black text-slate-900 font-mono">{vnd(p.priceMonthly)}</span> <span className="text-sm text-slate-500">/ tháng</span></div>}
                    {p.priceYearly > 0 && <div className="text-sm text-slate-600"><b className="font-mono">{vnd(p.priceYearly)}</b> / năm{p.priceMonthly > 0 && p.priceYearly < p.priceMonthly * 12 ? <span className="ml-1 text-emerald-700 font-bold">(tiết kiệm {vnd(p.priceMonthly * 12 - p.priceYearly)})</span> : null}</div>}
                  </div>
                  <div className="mt-3 text-sm text-slate-700 inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {p.maxEmployees === null ? 'Không giới hạn nhân viên' : `Tối đa ${p.maxEmployees} nhân viên`}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Đăng ký */}
      <section id="dang-ky" className="bg-white border-y border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
          {done ? (
            <div className="text-center space-y-4" id="register_success">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
              <h2 className="text-2xl font-black text-slate-900">Đăng ký thành công!</h2>
              <p className="text-slate-600">Doanh nghiệp <b>{done.name}</b> đã sẵn sàng. Địa chỉ riêng của bạn:</p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 font-mono font-bold text-blue-800 break-all">
                {tenantUrl(done.slug)}
              </div>
              <p className="text-sm text-slate-600">
                Đăng nhập bằng tên đăng nhập <b className="font-mono">{done.username}</b> và mật khẩu bạn vừa đặt. Hãy lưu lại địa chỉ này.
              </p>
              {done.trialEndsAt && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" id="register_trial_note">
                  Bạn đang <b>dùng thử miễn phí</b> đến hết ngày <b>{new Date(done.trialEndsAt).toLocaleDateString('vi-VN')}</b>. Sau ngày này hãy chọn gói để tiếp tục sử dụng
                  (dữ liệu của bạn được giữ nguyên).
                </p>
              )}
              <a href={tenantUrl(done.slug)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-[#ffffff] font-bold px-6 py-3 rounded-lg">
                Vào hệ thống <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 text-center">Đăng ký doanh nghiệp</h2>
              <p className="text-center text-sm text-slate-600 mt-1">Dùng thử miễn phí {trialDays} ngày, không cần thanh toán trước. Tài khoản quản trị được tạo ngay sau khi đăng ký.</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4" id="register_form" noValidate>
                <div>
                  <label className={labelCls} htmlFor="reg_company">Tên doanh nghiệp *</label>
                  <input id="reg_company" className={inputCls(errors.companyName)} value={companyName}
                    onChange={e => setCompanyName(e.target.value)} placeholder="Ví dụ: Công ty TNHH Đại Phát" maxLength={100} autoComplete="organization" />
                  {errors.companyName && <p className={errCls}>{errors.companyName}</p>}
                </div>

                <div>
                  <label className={labelCls} htmlFor="reg_slug">Địa chỉ truy cập *</label>
                  <div className="flex items-stretch">
                    <input id="reg_slug" className={`${inputCls(errors.slug || (slugState.status === 'bad' ? 'x' : undefined))} rounded-r-none font-mono`}
                      value={slug} onChange={e => { setSlugEdited(true); setSlug(e.target.value.toLowerCase()); }}
                      placeholder="ten-doanh-nghiep" maxLength={40} autoCapitalize="none" spellCheck={false} />
                    <span className="inline-flex items-center px-3 text-sm font-mono text-slate-500 bg-slate-100 border border-l-0 border-slate-300 rounded-r-lg whitespace-nowrap">.{baseDomain}</span>
                  </div>
                  <div className="min-h-[1.25rem] mt-1 text-xs">
                    {slugState.status === 'checking' && <span className="inline-flex items-center gap-1 text-slate-500"><Loader2 className="w-3 h-3 animate-spin" /> Đang kiểm tra...</span>}
                    {slugState.status === 'ok' && <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Địa chỉ này dùng được: <b className="font-mono">{slug}.{baseDomain}</b></span>}
                    {slugState.status === 'bad' && <span className="inline-flex items-center gap-1 text-rose-600"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {slugState.message}</span>}
                    {errors.slug && slugState.status !== 'bad' && <span className="text-rose-600">{errors.slug}</span>}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls} htmlFor="reg_admin">Họ tên người quản trị *</label>
                    <input id="reg_admin" className={inputCls(errors.adminName)} value={adminName} onChange={e => setAdminName(e.target.value)} maxLength={80} autoComplete="name" />
                    {errors.adminName && <p className={errCls}>{errors.adminName}</p>}
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="reg_phone">Số điện thoại *</label>
                    <input id="reg_phone" className={inputCls(errors.phone)} value={phone} onChange={e => setPhone(e.target.value)} placeholder="0912345678" inputMode="tel" autoComplete="tel" />
                    {errors.phone && <p className={errCls}>{errors.phone}</p>}
                  </div>
                </div>

                <div>
                  <label className={labelCls} htmlFor="reg_email">Email *</label>
                  <input id="reg_email" type="email" className={inputCls(errors.email)} value={email} onChange={e => setEmail(e.target.value)} maxLength={120} autoComplete="email" />
                  {errors.email && <p className={errCls}>{errors.email}</p>}
                </div>

                <div>
                  <label className={labelCls} htmlFor="reg_password">Mật khẩu quản trị *</label>
                  <div className="relative">
                    <input id="reg_password" type={showPassword ? 'text' : 'password'} className={`${inputCls(errors.password)} pr-10`} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự, có cả chữ và số" maxLength={72} autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className={errCls}>{errors.password}</p>}
                  <p className="text-xs text-slate-500 mt-1">Tên đăng nhập quản trị mặc định là <b className="font-mono">admin</b>.</p>
                </div>

                {/* Honeypot: ẩn khỏi người dùng thật; bot tự điền sẽ bị máy chủ từ chối */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                  <label>Website <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
                </div>

                {TURNSTILE_SITE_KEY && <div ref={captchaRef} className="flex justify-center" />}

                {formError && (
                  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{formError}</span>
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-[#ffffff] font-bold py-3 rounded-lg transition-colors">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang tạo doanh nghiệp...</> : 'Đăng ký doanh nghiệp'}
                </button>
                <p className="text-xs text-slate-500 text-center">Bằng việc đăng ký, bạn đồng ý sử dụng nền tảng cho mục đích quản trị doanh nghiệp hợp pháp.</p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* Vào doanh nghiệp đã có */}
      <section id="vao" className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
        <h2 className="text-xl font-black text-slate-900">Vào doanh nghiệp của tôi</h2>
        <p className="text-sm text-slate-600 mt-1">Nhập địa chỉ doanh nghiệp bạn đã đăng ký.</p>
        <form onSubmit={handleGo} className="mt-5 flex items-stretch max-w-md mx-auto" id="go_form">
          <input className={`${inputCls()} rounded-r-none font-mono`} value={goSlug} onChange={e => setGoSlug(e.target.value)}
            placeholder="ten-doanh-nghiep" maxLength={40} autoCapitalize="none" spellCheck={false} aria-label="Địa chỉ doanh nghiệp" />
          <span className="inline-flex items-center px-3 text-sm font-mono text-slate-500 bg-slate-100 border border-l-0 border-slate-300 whitespace-nowrap">.{baseDomain}</span>
          <button type="submit" className="px-4 bg-blue-600 hover:bg-blue-700 text-[#ffffff] font-bold rounded-r-lg">Vào</button>
        </form>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} LoLo. Công nghệ tạo giá trị – Quản trị nâng tầm.
        </div>
      </footer>
    </div>
  );
}
