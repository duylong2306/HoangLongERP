import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Test chuyển hướng hệ thống CŨ (nhánh main) sang https://hoanglong.lolo.io.vn:
//   • vercel.json: chuyển hướng mọi đường dẫn TRỪ 2 service worker; giữ đường dẫn + tham số;
//   • public/sw.js + public/web-push-sw.js: "kill switch" (xóa cache, tự gỡ, tải lại cửa sổ), KHÔNG chặn request, KHÔNG xử lý push;
//   • index.html: đoạn script dự phòng tự chuyển hướng (không chạy ở localhost / địa chỉ mới).
const ROOT = path.resolve(__dirname, '../../..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const NEW = 'https://hoanglong.lolo.io.vn';

describe('vercel.json', () => {
  const cfg = JSON.parse(read('vercel.json'));
  const rule = cfg.redirects[0];
  // Vercel biên dịch "source" bằng path-to-regexp; nhóm (...) là biểu thức chính quy → tương đương ^<source>$ với nhóm bắt số 1 ($1)
  const re = new RegExp(`^${rule.source}$`);
  const test = (p: string) => { const m = re.exec(p); return m ? `${NEW}/${m[1] ?? ''}` : null; };

  it('chỉ có 1 quy tắc chuyển hướng TẠM THỜI (không vĩnh viễn → hoàn tác được), đích là địa chỉ mới', () => {
    expect(cfg.redirects).toHaveLength(1);
    expect(rule.permanent).toBe(false);
    expect(rule.destination).toBe(`${NEW}/$1`);
  });
  it('chuyển hướng trang chủ, đường dẫn con, tài nguyên và manifest — giữ nguyên đường dẫn', () => {
    expect(test('/')).toBe(`${NEW}/`);
    expect(test('/messages')).toBe(`${NEW}/messages`);
    expect(test('/assets/index-abc123.js')).toBe(`${NEW}/assets/index-abc123.js`);
    expect(test('/manifest.webmanifest')).toBe(`${NEW}/manifest.webmanifest`);
    expect(test('/a/b/c')).toBe(`${NEW}/a/b/c`);
  });
  it('KHÔNG chuyển hướng 2 service worker (để trình duyệt tải được bản kill switch); tên tương tự vẫn được chuyển', () => {
    expect(test('/sw.js')).toBeNull();
    expect(test('/web-push-sw.js')).toBeNull();
    expect(test('/sw.json')).toBe(`${NEW}/sw.json`);
    expect(test('/xsw.js')).toBe(`${NEW}/xsw.js`);
  });
});

// Môi trường giả cho service worker
function chayServiceWorker(file: string, opts: { cacheKeys?: string[]; windows?: { url: string }[] } = {}) {
  const handlers: Record<string, Function> = {};
  const deleted: string[] = [];
  const navigated: string[] = [];
  const unregister = vi.fn(async () => true);
  const skipWaiting = vi.fn();
  const self: any = {
    addEventListener: (ev: string, fn: Function) => { handlers[ev] = fn; },
    skipWaiting, registration: { unregister },
    clients: { matchAll: vi.fn(async () => (opts.windows ?? []).map(w => ({ url: w.url, navigate: (u: string) => { navigated.push(u); } }))) },
  };
  const caches: any = { keys: async () => opts.cacheKeys ?? [], delete: async (k: string) => { deleted.push(k); return true; } };
  new Function('self', 'caches', read(file))(self, caches);
  return { handlers, deleted, navigated, unregister, skipWaiting, self };
}
const kichHoat = async (h: Record<string, Function>) => { let p: Promise<any> = Promise.resolve(); await h.activate({ waitUntil: (x: Promise<any>) => { p = x; } }); await p; };

describe.each(['public/sw.js', 'public/web-push-sw.js'])('kill switch %s', (file) => {
  it('cài đặt thì kích hoạt ngay (skipWaiting)', () => {
    const r = chayServiceWorker(file); r.handlers.install(); expect(r.skipWaiting).toHaveBeenCalled();
  });
  it('kích hoạt: xóa MỌI bộ nhớ đệm, tự gỡ đăng ký, tải lại từng cửa sổ đang mở bằng đúng địa chỉ của nó', async () => {
    const r = chayServiceWorker(file, { cacheKeys: ['hl-erp-v3', 'hl-erp-static-v3', 'khac'], windows: [{ url: 'https://hoang-long-erp.vercel.app/' }, { url: 'https://hoang-long-erp.vercel.app/?conversation=abc' }] });
    await kichHoat(r.handlers);
    expect(r.deleted.sort()).toEqual(['hl-erp-static-v3', 'hl-erp-v3', 'khac']);
    expect(r.unregister).toHaveBeenCalled();
    expect(r.navigated).toEqual(['https://hoang-long-erp.vercel.app/', 'https://hoang-long-erp.vercel.app/?conversation=abc']);
  });
  it('bền: một bước lỗi không chặn các bước sau (vd xóa cache lỗi vẫn gỡ đăng ký)', async () => {
    const handlers: Record<string, Function> = {}; const unregister = vi.fn(async () => true);
    const self: any = { addEventListener: (e: string, f: Function) => { handlers[e] = f; }, skipWaiting() {}, registration: { unregister }, clients: { matchAll: async () => { throw new Error('x'); } } };
    new Function('self', 'caches', read(file))(self, { keys: async () => { throw new Error('hỏng'); }, delete: async () => true });
    await kichHoat(handlers);
    expect(unregister).toHaveBeenCalled();
  });
  it('KHÔNG có trình xử lý fetch (mọi request đi thẳng ra mạng) và KHÔNG xử lý push/notificationclick', () => {
    const r = chayServiceWorker(file);
    expect(Object.keys(r.handlers).sort()).toEqual(['activate', 'install']);
  });
});

describe('index.html — chuyển hướng dự phòng', () => {
  const html = read('index.html');
  const m = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  const run = (host: string, pathname = '/x', search = '?a=1', hash = '#h') => {
    const replace = vi.fn(); new Function('location', m![1])({ hostname: host, pathname, search, hash, replace }); return replace;
  };
  it('có đoạn script chuyển hướng, nằm TRƯỚC script nạp ứng dụng', () => {
    expect(m).toBeTruthy();
    expect(html.indexOf(m![0])).toBeLessThan(html.indexOf('type="module"'));
  });
  it('địa chỉ cũ → chuyển sang địa chỉ mới, giữ nguyên đường dẫn, tham số và phần #', () => {
    expect(run('hoang-long-erp.vercel.app')).toHaveBeenCalledWith(`${NEW}/x?a=1#h`);
    expect(run('erp.hoanglonglamdong.vn', '/', '', '')).toHaveBeenCalledWith(`${NEW}/`);
  });
  it('KHÔNG chuyển hướng ở localhost và ở chính địa chỉ mới (tránh vòng lặp)', () => {
    for (const h of ['localhost', '127.0.0.1', 'hoanglong.lolo.io.vn']) expect(run(h)).not.toHaveBeenCalled();
  });
});
