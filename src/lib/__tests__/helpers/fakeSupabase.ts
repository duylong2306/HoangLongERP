// CƠ SỞ DỮ LIỆU GIẢ TRONG BỘ NHỚ cho test các hàm api/ (giả lập đủ phần của supabase-js mà api/ dùng):
//   from(t).select(cols, {count, head}) / insert / update / upsert / delete + eq/neq/gte/in/order/limit/maybeSingle/single, rpc.
// Có ràng buộc unique (23505) và có thể ép lỗi theo bảng/thao tác để thử nhánh "lỗi giữa chừng".
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;
type Op = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export class FakeDb {
  tables: Record<string, Row[]> = {};
  unique: Record<string, string[]> = {};                 // bảng → các cột unique
  autoId = new Set<string>();                            // bảng tự cấp id uuid khi thiếu
  missingColumns: Record<string, string[]> = {};         // bảng → cột "chưa tồn tại": select có nhắc tới cột này → lỗi 42703
  fail: Record<string, string> = {};                     // "bảng.thaoTac" → thông báo lỗi
  rpcs: Record<string, () => any> = {};
  log: string[] = [];                                    // "thaoTac:bảng" theo thứ tự gọi

  table(name: string): Row[] { return (this.tables[name] ||= []); }
  seed(name: string, rows: Row[]) { this.table(name).push(...rows.map(r => ({ ...r }))); return this; }
  client() { return { from: (t: string) => new Query(this, t), rpc: async (n: string) => ({ data: this.rpcs[n]?.() ?? [], error: null }) } as any; }
}

class Query {
  private op: Op = 'select';
  private filters: ((r: Row) => boolean)[] = [];
  private payload: any;
  private opts: any = {};
  private sel = false;
  private ord: { col: string; asc: boolean }[] = [];   // nhiều lần order() = sắp theo cột thứ nhất, hòa thì cột kế tiếp
  private lim = Infinity;
  private single: 'maybe' | 'one' | null = null;
  private countMode = false;
  private headOnly = false;
  private cols = '';
  constructor(private db: FakeDb, private t: string) {}

  select(cols?: string, o?: any) { this.cols = cols || ''; if (this.op === 'select') { this.countMode = !!o?.count; this.headOnly = !!o?.head; } else this.sel = true; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  upsert(p: any, o?: any) { this.op = 'upsert'; this.payload = p; this.opts = o || {}; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push(r => r[c] !== v); return this; }
  gte(c: string, v: any) { this.filters.push(r => r[c] >= v); return this; }
  lt(c: string, v: any) { this.filters.push(r => r[c] < v); return this; }
  ilike(c: string, v: string) { const x = String(v).toLowerCase(); this.filters.push(r => String(r[c] ?? '').toLowerCase() === x); return this; }   // (chỉ so sánh bằng, không có ký tự đại diện %)
  in(c: string, vs: any[]) { this.filters.push(r => vs.includes(r[c])); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.ord.push({ col: c, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.single = 'maybe'; return this; }
  // (single() như maybeSingle nhưng không có dòng → lỗi)
  singleRow() { this.single = 'one'; return this; }
  then(res: any, rej?: any) { return this.run().then(res, rej); }

  private async run(): Promise<any> {
    const db = this.db, key = `${this.t}.${this.op}`;
    db.log.push(`${this.op}:${this.t}`);
    const thieuCot = (db.missingColumns[this.t] || []).find(c => new RegExp(`(^|[ ,])${c}([ ,]|$)`).test(this.cols));
    if (this.op === 'select' && thieuCot) return { data: null, error: { message: `column ${this.t}.${thieuCot} does not exist`, code: '42703' }, count: null };
    if (db.fail[key]) return { data: null, error: { message: db.fail[key], code: 'XX000' }, count: null };
    const rows = db.table(this.t);
    const match = (r: Row) => this.filters.every(f => f(r));
    const dup = (row: Row, ignore?: Row) => (db.unique[this.t] || []).find(c => rows.some(x => x !== ignore && x[c] !== undefined && x[c] === row[c]));
    // Chỉ trả các cột được liệt kê trong select(...) như PostgREST thật ('*' hoặc trống = tất cả).
    const cotChon = this.cols.split(',').map(c => c.trim()).filter(c => c && c !== '*');
    const chieu = (r: Row) => (cotChon.length ? Object.fromEntries(cotChon.filter(c => c in r).map(c => [c, r[c]])) : r);
    const fin = (data: any[]) => {
      data = data.map(chieu);
      if (this.ord.length) {
        data = [...data].sort((a, b) => {
          for (const o of this.ord) {
            if (a[o.col] === b[o.col]) continue;
            return (a[o.col] > b[o.col] ? 1 : -1) * (o.asc ? 1 : -1);
          }
          return 0;
        });
      }
      data = data.slice(0, this.lim);
      if (this.single) return { data: data[0] ?? null, error: this.single === 'one' && !data[0] ? { message: 'no rows' } : null };
      return { data, error: null };
    };

    if (this.op === 'select') {
      const found = rows.filter(match);
      if (this.headOnly) return { data: null, error: null, count: found.length };
      const r: any = fin(found.map(x => ({ ...x })));
      if (this.countMode) r.count = found.length;
      return r;
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      const out: Row[] = [];
      for (const p of list) {
        const row: Row = { ...p };
        if (this.op === 'upsert') {
          const keys = String(this.opts.onConflict || 'id').split(',');
          const ex = rows.find(x => keys.every(k => x[k] === row[k]));
          if (ex) { Object.assign(ex, row); out.push({ ...ex }); continue; }
        }
        if (db.autoId.has(this.t) && row.id === undefined) row.id = randomUUID();
        const d = dup(row);
        if (d) return { data: null, error: { message: `duplicate key value violates unique constraint (${d})`, code: '23505' } };
        row.created_at ??= new Date().toISOString();
        rows.push(row); out.push({ ...row });
      }
      return this.sel ? fin(out) : { data: null, error: null };
    }
    if (this.op === 'update') {
      const hit = rows.filter(match);
      hit.forEach(r => Object.assign(r, this.payload));
      return this.sel ? fin(hit.map(x => ({ ...x }))) : { data: null, error: null };
    }
    // delete
    const keep = rows.filter(r => !match(r));
    db.tables[this.t] = keep;
    return { data: null, error: null };
  }
}
