import { useState } from 'react';
import { LayoutGrid, User, ChevronLeft, UserCog, Palette, RefreshCw, LogOut, Ruler } from 'lucide-react';
import type { NavTop, NavGroup, NavUser } from './navModel';
import { UserAvatar } from './AppRail';
import './shell.css';

// THANH DƯỚI TRÊN ĐIỆN THOẠI: tối đa 5 mục — Tổng quan, Việc, Tin nhắn, Danh mục (các phòng ban), Tôi (tài khoản).
// Danh mục và Tôi mở thành trang toàn màn hình (nền xanh LoLo phủ cả vùng tai thỏ). Thanh dưới chừa vạch home bằng safe-area.
interface Props {
  tops: NavTop[];          // tối đa 3 mục đầu (Tổng quan / Việc / Tin nhắn) — mục nào không có quyền thì không hiện
  groups: NavGroup[]; user: NavUser; activeTab: string;
}

/** Số đo màn hình ghi lúc khởi động (đoạn mã "vp-probe" trong index.html): để gửi cho kỹ thuật khi giao diện bị lệch kích thước trên điện thoại */
export function ViewportDiag() {
  let text = 'Chưa có số đo (mở lại ứng dụng từ Màn hình chính rồi quay lại đây).';
  try {
    const rows = JSON.parse(localStorage.getItem('lolo_vp_diag') || 'null');
    if (Array.isArray(rows) && rows.length) {
      text = rows.map((r: any) => `${r.t} (${r.ms}ms): trong ${r.innerW}x${r.innerH} · vv ${r.vvH} (+${r.vvTop}) · màn ${r.screenW}x${r.screenH} · client ${r.clientH} · đáy cố định ${r.fixedBottom} · an toàn trên ${r.safeT} dưới ${r.safeB} · cuộn ${r.scrollY} · standalone ${r.standalone}/${r.displayMode}`).join('\n');
    }
  } catch { /* bỏ qua */ }
  return <pre data-testid="vp-diag" style={{ whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.45, background: '#fff', border: '1px solid #e6eaf0', borderRadius: 12, padding: 10, margin: '8px 0', userSelect: 'text' }}>{text}</pre>;
}

export default function MobileNav({ tops, groups, user }: Props) {
  const [sheet, setSheet] = useState<null | 'cat' | 'me'>(null);
  const [grp, setGrp] = useState<string | null>(null);   // đang xem menu con của nhóm nào
  const [diagOpen, setDiagOpen] = useState(false);   // xem số đo màn hình lúc khởi động (đoạn "vp-probe" trong index.html)
  const closeAll = () => { setSheet(null); setGrp(null); };
  const catActive = groups.some(g => g.active);
  const group = grp ? groups.find(g => g.id === grp) : null;
  return (
    <>
      <nav className="lx-bnav" aria-label="Điều hướng nhanh" data-testid="mobile-nav">
        {tops.map(t => (
          <button key={t.id} type="button" className={`lx-bn ${t.active && !sheet ? 'on' : ''}`} onClick={() => { closeAll(); t.onSelect(); }} data-testid={`bn-${t.id}`}>
            {t.icon}<span>{t.label}</span>{!!t.badge && <b className="lx-badge">{t.badge > 99 ? '99+' : t.badge}</b>}
          </button>))}
        {groups.length > 0 && <button type="button" className={`lx-bn ${sheet === 'cat' || (catActive && !sheet) ? 'on' : ''}`} onClick={() => { setGrp(null); setSheet(s => (s === 'cat' ? null : 'cat')); }} data-testid="bn-cat"><LayoutGrid /><span>Danh mục</span></button>}
        <button type="button" className={`lx-bn ${sheet === 'me' ? 'on' : ''}`} onClick={() => { setGrp(null); setSheet(s => (s === 'me' ? null : 'me')); }} data-testid="bn-me"><User /><span>Tôi</span></button>
      </nav>
      {sheet === 'cat' && (
        <div className="lx-sheet" role="dialog" aria-label="Danh mục" data-testid="sheet-cat">
          <div className="lx-sh">
            {group && <button type="button" onClick={() => setGrp(null)} aria-label="Quay lại"><ChevronLeft size={22} /></button>}
            <b>{group ? group.label : 'Danh mục'}</b>
          </div>
          <div className="lx-sb">
            {!group ? (
              <div className="lx-gg">
                {groups.map(g => (
                  <button key={g.id} type="button" className={`lx-gc ${g.active ? 'on' : ''}`} onClick={() => (g.children.length === 1 ? (closeAll(), g.children[0].onSelect()) : setGrp(g.id))} data-testid={`cat-${g.id}`}>
                    <span className="lx-gic">{g.icon}</span><b>{g.label}</b><small>{g.children.length} mục</small>
                  </button>))}
              </div>
            ) : (
              <div className="lx-list">
                {group.children.map(c => <button key={c.id} type="button" className={`lx-li ${c.active ? 'on' : ''}`} onClick={() => { closeAll(); c.onSelect(); }}>{c.label}</button>)}
              </div>)}
          </div>
        </div>)}
      {sheet === 'me' && (
        <div className="lx-sheet" role="dialog" aria-label="Tài khoản" data-testid="sheet-me">
          <div className="lx-sh"><b>Tôi</b></div>
          <div className="lx-sb">
            <div className="lx-me"><UserAvatar user={user} /><div><b>{user.name}</b>{user.subtitle && <small>{user.subtitle}</small>}</div></div>
            <div className="lx-list">
              <button type="button" className="lx-li" onClick={() => { closeAll(); user.onProfile(); }}><UserCog size={20} />Sửa hồ sơ</button>
              {user.onDisplaySettings && <button type="button" className="lx-li" onClick={() => { closeAll(); user.onDisplaySettings!(); }}><Palette size={20} />Giao diện &amp; Màu sắc</button>}
              <button type="button" className="lx-li" onClick={() => { closeAll(); user.onReload(); }}><RefreshCw size={20} />Tải lại trang</button>
              <button type="button" className="lx-li" onClick={() => setDiagOpen(v => !v)} data-testid="vp-diag-toggle"><Ruler size={20} />Chẩn đoán màn hình</button>
              {diagOpen && <ViewportDiag />}
              <button type="button" className="lx-li danger" onClick={() => { closeAll(); user.onLogout(); }}><LogOut size={20} />Đăng xuất</button>
            </div>
          </div>
        </div>)}
    </>
  );
}
