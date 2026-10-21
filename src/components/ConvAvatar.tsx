import React from 'react';
import { Building2, ClipboardList } from 'lucide-react';
import type { Conversation, Employee } from '../types';
import UserAvatar from './UserAvatar';

// ẢNH ĐẠI DIỆN HỘI THOẠI (học Zalo nhưng phân biệt rõ để đỡ rối mắt):
//  • CÁ NHÂN  = hình TRÒN (ảnh hoặc chữ cái đầu) — như avatar tài khoản.
//  • NHÓM     = hình VUÔNG BO GÓC ghép chữ cái các thành viên (1/2/3/4 ô, ô cuối "+n" nếu đông) — số ô cho biết quy mô nhóm.
//  • CÔNG TRÌNH = vuông bo góc nền xanh LoLo + biểu tượng tòa nhà. • CÔNG VIỆC = vuông bo góc nền xanh lá + biểu tượng bảng việc.
//    Hai loại này (không ghép ô) có thêm huy hiệu SỐ THÀNH VIÊN ở góc dưới phải; nhóm ghép ô thì không để khỏi che ô cuối.
// Hình dạng khác nhau nên liếc qua là biết đâu là người, đâu là nhóm.
const PAL = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316', '#ef4444', '#64748b'];
const colorOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; };
const initials = (n: string) => { const p = (n || '?').replace('📁', '').trim().split(/\s+/); return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
export type ConvKind = 'personal' | 'project' | 'task' | 'group';
export const convKind = (c: Pick<Conversation, 'type' | 'id' | 'projectId'>): ConvKind =>
  c.type === 'personal' ? 'personal' : c.type === 'task' ? 'task' : (c.projectId || String(c.id).startsWith('conv_project_')) ? 'project' : 'group';

const WHITE = '#ffffff';   // dùng mã màu trực tiếp vì index.css đang ép lớp text-white thành chữ tối
const Tile = ({ bg, children, fs, style }: { bg: string; children: React.ReactNode; fs: number; style?: React.CSSProperties }) => (
  <i style={{ background: bg, color: WHITE, fontSize: fs, fontStyle: 'normal', fontWeight: 700, display: 'grid', placeItems: 'center', lineHeight: 1, ...style }}>{children}</i>
);

export default function ConvAvatar({ conv, employees, me, size, showCount = true }: { conv: Conversation; employees: Employee[]; me: string; size: number; showCount?: boolean }) {
  const kind = convKind(conv);
  if (kind === 'personal') {
    const other = employees.find(e => e.id === conv.participantIds.find(i => i !== me));
    return <UserAvatar employee={other || null} name={conv.name} size={size >= 56 ? 'xl' : size >= 44 ? 'lg' : 'md'} noRing />;
  }
  const radius = size * 0.3;
  const total = Array.from(new Set(conv.participantIds)).length;
  const badge = showCount && (kind === 'project' || kind === 'task') && total > 0 && (
    <b data-testid="conv-count" style={{ position: 'absolute', right: -3, bottom: -3, minWidth: Math.max(16, size * 0.34), height: Math.max(16, size * 0.34), padding: '0 4px', borderRadius: 999, background: '#475569', color: WHITE, fontSize: Math.max(9, size * 0.22), fontWeight: 700, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px #fff', lineHeight: 1 }}>{total > 99 ? '99+' : total}</b>
  );
  const frame = (inner: React.ReactNode, extra?: React.CSSProperties) => (
    <span data-testid={`conv-avatar-${kind}`} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span style={{ display: 'grid', width: size, height: size, borderRadius: radius, overflow: 'hidden', background: '#fff', gap: 1.5, ...extra }}>{inner}</span>
      {badge}
    </span>
  );
  if (kind === 'project' || kind === 'task') {
    const bg = kind === 'project' ? 'linear-gradient(135deg,#1f6bff,#0a4fd8)' : 'linear-gradient(135deg,#10b981,#059669)';
    const Icon = kind === 'project' ? Building2 : ClipboardList;
    return frame(<Tile bg={bg} fs={size}><Icon style={{ width: size * 0.5, height: size * 0.5, color: WHITE }} strokeWidth={1.9} /></Tile>);
  }
  // Nhóm thường: ghép tối đa 4 ô theo số thành viên
  const ids = Array.from(new Set(conv.participantIds));
  const names = ids.map(id => employees.find(e => e.id === id)?.name || conv.name);
  const n = Math.min(ids.length, 4) || 1;
  const fs = size / (n === 1 ? 2.4 : n === 2 ? 3 : 3.6);
  const more = ids.length > 4 ? ids.length - 3 : 0;   // đông hơn 4 người: ô thứ 4 hiện "+n" người còn lại
  const cell = (i: number, style?: React.CSSProperties) => (more && i === 3
    ? <Tile key={i} bg="#94a3b8" fs={fs} style={style}>+{more > 99 ? 99 : more}</Tile>
    : <Tile key={i} bg={colorOf(names[i] || conv.name)} fs={fs} style={style}>{initials(names[i] || conv.name)}</Tile>);
  if (n === 1) return frame(cell(0));
  if (n === 2) return frame([cell(0), cell(1)], { gridTemplateColumns: '1fr 1fr' });
  if (n === 3) return frame([cell(0, { gridRow: '1 / span 2' }), cell(1), cell(2)], { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' });
  return frame([0, 1, 2, 3].map(i => cell(i)), { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' });
}
