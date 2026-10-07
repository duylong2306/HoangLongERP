import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Sự cố 2026-10-07: api/login.ts và api/tenant-info.ts import './_tenant' (không đuôi) → trên Vercel
// (package.json "type":"module" → Node ESM) báo ERR_MODULE_NOT_FOUND, sập đăng nhập staging. Vitest/tsc
// không bắt được lỗi này (chúng tự thêm đuôi). Test này khóa quy tắc: import TƯƠNG ĐỐI trong api/ phải có đuôi .js.
describe('api/ — import tương đối phải có đuôi .js (Node ESM trên Vercel)', () => {
  const dir = join(process.cwd(), 'api');
  const files = readdirSync(dir).filter(f => f.endsWith('.ts'));

  it('có file để kiểm tra', () => { expect(files.length).toBeGreaterThan(0); });

  it.each(files)('%s', (f) => {
    const src = readFileSync(join(dir, f), 'utf8');
    const thieuDuoi = [...src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
      .map(m => m[1])
      .filter(p => !/\.(js|json|mjs|cjs)$/.test(p));
    expect(thieuDuoi, `Thiếu đuôi .js ở import: ${thieuDuoi.join(', ')}`).toEqual([]);
  });
});
