import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, UserCog, Palette, RefreshCw, LogOut } from 'lucide-react';
import type { NavTop, NavGroup, NavUser } from './navModel';
import { initialOf } from './navModel';
import './shell.css';

// THANH MENU TRÁI (máy tính, kiểu Zalo): thu gọn 68px chỉ có biểu tượng lớn 28px; bấm logo để MỞ RỘNG 268px có nhãn + menu con.
// Khi thu gọn, bấm 1 phòng ban thì menu con bung ra bên cạnh. Trạng thái thu gọn/mở rộng nhớ trong trình duyệt.
interface Props {
  brandName: string; brandSlogan?: string; logoSrc?: string;
  tops: NavTop[]; groups: NavGroup[]; user: NavUser; buildTag?: string;
}
export const RAIL_KEY = 'hl_rail_open';
const readOpen = () => { try { return localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; } };

export function UserAvatar({ user }: { user: Pick<NavUser, 'name' | 'avatar'> }) {
  const a = user.avatar;
  return <span className="lx-av">{a ? (a.startsWith('http') || a.startsWith('data:') ? <img src={a} alt="" referrerPolicy="no-referrer" /> : <span>{a}</span>) : initialOf(user.name)}</span>;
}

export default function AppRail({ brandName, brandSlogan, logoSrc = '/lolo-icon-192.png', tops, groups, user, buildTag }: Props) {
  const [open, setOpen] = useState<boolean>(readOpen);
  const toggle = () => setOpen(v => { const n = !v; try { localStorage.setItem(RAIL_KEY, n ? '1' : '0'); } catch { /* bỏ qua */ } return n; });
  // Nhóm đang xổ ra khi mở rộng: mặc định nhóm đang chứa trang hiện tại
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(groups.filter(g => g.active).map(g => g.id)));
  useEffect(() => { setExpanded(prev => { const n = new Set(prev); groups.filter(g => g.active).forEach(g => n.add(g.id)); return n; }); }, [groups.map(g => `${g.id}:${g.active}`).join('|')]);   // eslint-disable-line react-hooks/exhaustive-deps
  // Menu nổi (khi thu gọn): nhóm hoặc menu tài khoản, đặt cạnh nút được bấm
  const [fly, setFly] = useState<{ kind: 'group' | 'user'; id: string; top: number } | null>(null);
  const flyAt = (e: React.MouseEvent<HTMLElement>, kind: 'group' | 'user', id: string) => {
    const r = e.currentTarget.getBoundingClientRect();
    setFly(f => (f && f.kind === kind && f.id === id ? null : { kind, id, top: Math.max(8, Math.min(r.top - 8, window.innerHeight - 320)) }));
  };
  const railRef = useRef<HTMLElement>(null);
  const flyLeft = (railRef.current?.getBoundingClientRect().right ?? 68) + 8;

  const close = () => setFly(null);
  const flyGroup = fly?.kind === 'group' ? groups.find(g => g.id === fly.id) : null;
  return (
    <>
      <nav ref={railRef} className={`lx-rail ${open ? 'open' : ''}`} id="left_sidebar_flowbite" aria-label="Menu chính">
        <button type="button" className="lx-logo" onClick={toggle} title={open ? 'Thu gọn menu' : 'Mở rộng menu'} aria-expanded={open} data-testid="rail-toggle">
          <img src={logoSrc} alt={brandName} />
          <span className="lx-brand">{brandName}{brandSlogan && <small>{brandSlogan}</small>}</span>
        </button>
        <div className="lx-rg">
          {tops.map(t => (
            <button key={t.id} type="button" className={`lx-ri ${t.active ? 'on' : ''}`} title={t.label} onClick={() => { close(); t.onSelect(); }} data-testid={`rail-${t.id}`}>
              {t.icon}<span className="lx-rl">{t.label}</span>{!!t.badge && <b className="lx-badge">{t.badge > 99 ? '99+' : t.badge}</b>}
            </button>))}
        </div>
        {groups.length > 0 && <div className="lx-sep" />}
        <div className="lx-rg">
          {groups.map(g => {
            const isExp = expanded.has(g.id);
            return (
              <React.Fragment key={g.id}>
                <button type="button" className={`lx-ri ${g.active ? 'grp-on' : ''}`} title={g.label} data-testid={`rail-group-${g.id}`}
                  onClick={e => { if (open) setExpanded(s => { const n = new Set(s); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; }); else flyAt(e, 'group', g.id); }}>
                  {g.icon}<span className="lx-rl">{g.label}</span><i className={`lx-car ${isExp ? 'exp' : ''}`}><ChevronRight /></i>
                </button>
                {open && isExp && (
                  <ul className="lx-subs">
                    {g.children.map(c => <li key={c.id}><button type="button" className={`lx-sub ${c.active ? 'on' : ''}`} onClick={c.onSelect}>{c.label}</button></li>)}
                  </ul>)}
              </React.Fragment>);
          })}
        </div>
        <div className="lx-grow" />
        <button type="button" className="lx-user" title={user.name} onClick={e => (open ? setFly(f => (f?.kind === 'user' ? null : { kind: 'user', id: 'u', top: Math.max(8, e.currentTarget.getBoundingClientRect().top - 160) })) : flyAt(e, 'user', 'u'))} data-testid="rail-user">
          <UserAvatar user={user} /><span className="lx-uname"><b>{user.name}</b>{user.subtitle && <small>{user.subtitle}</small>}</span>
        </button>
        {buildTag && <div className="lx-build">{buildTag}</div>}
      </nav>
      {fly && <div className="lx-scrim" onClick={close} />}
      {flyGroup && (
        <div className="lx-fly" style={{ left: flyLeft, top: fly!.top }} role="menu" data-testid="rail-flyout">
          <h4>{flyGroup.label}</h4>
          {flyGroup.children.map(c => <button key={c.id} type="button" role="menuitem" className={`lx-fi ${c.active ? 'on' : ''}`} onClick={() => { close(); c.onSelect(); }}>{c.label}</button>)}
        </div>)}
      {fly?.kind === 'user' && (
        <div className="lx-fly" style={{ left: flyLeft, top: fly.top }} role="menu" data-testid="rail-usermenu">
          <h4>{user.name}</h4>
          <button type="button" role="menuitem" className="lx-fi" onClick={() => { close(); user.onProfile(); }}><UserCog size={18} />Sửa hồ sơ</button>
          {user.onDisplaySettings && <button type="button" role="menuitem" className="lx-fi" onClick={() => { close(); user.onDisplaySettings!(); }}><Palette size={18} />Giao diện &amp; Màu sắc</button>}
          <button type="button" role="menuitem" className="lx-fi" onClick={() => { close(); user.onReload(); }}><RefreshCw size={18} />Tải lại trang</button>
          <button type="button" role="menuitem" className="lx-fi danger" onClick={() => { close(); user.onLogout(); }}><LogOut size={18} />Đăng xuất</button>
        </div>)}
    </>
  );
}
