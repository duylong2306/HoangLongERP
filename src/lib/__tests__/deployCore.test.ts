import { describe, it, expect } from 'vitest';
import { mountEnvRibbon } from '../envRibbon';
// @ts-ignore — tệp .mjs ở thư mục scripts (không có kiểu)
import { resolveTarget, checkRules, vercelEnv, confirmOk, ENVS, PROD_PROJECT_NAME, CONFIRM_WORD } from '../../../scripts/lib/deploy-core.mjs';

const prodLink = { projectId: 'prj_ProdProjectId0001', orgId: 'team_orgthat1', projectName: PROD_PROJECT_NAME };
const cfg = { prod: prodLink, dev: { projectId: 'prj_DevProjectId00002', orgId: 'team_orgthat1', projectName: 'lolo-dev' } };

describe('resolveTarget', () => {
  it('prod: dùng envs.json, hoặc liên kết cũ .vercel/project.json nếu chưa có envs.json', () => {
    expect(resolveTarget('prod', cfg, null)).toEqual({ ok: true, target: { projectName: PROD_PROJECT_NAME, orgId: 'team_orgthat1', projectId: 'prj_ProdProjectId0001' } });
    expect(resolveTarget('prod', null, prodLink).ok).toBe(true);
    expect(resolveTarget('prod', null, null).ok).toBe(false);
  });
  it('dev: bắt buộc có cấu hình riêng (KHÔNG bao giờ tự rơi về project thật); báo hướng dẫn khi thiếu', () => {
    const r = resolveTarget('dev', null, prodLink);
    expect(r.ok).toBe(false); expect(r.error).toMatch(/setup-dev-env/);
    expect(resolveTarget('dev', cfg, prodLink)).toMatchObject({ ok: true, target: { projectName: 'lolo-dev', projectId: 'prj_DevProjectId00002' } });
  });
  it('từ chối mã định danh sai định dạng và môi trường lạ', () => {
    expect(resolveTarget('dev', { dev: { orgId: 'team_x1y2z3', projectId: 'khong-phai-prj' } }, null).ok).toBe(false);
    expect(resolveTarget('dev', { dev: { orgId: '', projectId: 'prj_DevProjectId00002' } }, null).ok).toBe(false);
    expect(resolveTarget('staging', cfg, null).ok).toBe(false);
  });
});

describe('checkRules', () => {
  const targets = { prod: cfg.prod, dev: cfg.dev };
  it('prod: chỉ nhánh multi-tenant, không sửa đổi chưa commit; đạt khi đủ điều kiện', () => {
    expect(checkRules({ env: 'prod', branch: 'multi-tenant', dirty: '', targets })).toEqual([]);
    expect(checkRules({ env: 'prod', branch: 'main', dirty: '', targets })[0]).toMatch(/nhánh "main".*multi-tenant/);
    expect(checkRules({ env: 'prod', branch: 'multi-tenant', dirty: ' M src/App.tsx', targets })[0]).toMatch(/CHƯA COMMIT/);
  });
  it('dev: mọi nhánh, được phép còn sửa dở (đó là mục đích của môi trường thử)', () => {
    expect(checkRules({ env: 'dev', branch: 'tinh-nang-thu', dirty: ' M a.ts\n M b.ts', targets })).toEqual([]);
    expect(checkRules({ env: 'dev', branch: 'main', dirty: '', targets })).toEqual([]);
  });
  it('CHỐT CHẶN: dev và prod trỏ cùng project (cùng id hoặc cùng tên) → chặn cả hai môi trường', () => {
    for (const env of ['dev', 'prod']) {
      const trungId = { prod: cfg.prod, dev: { ...cfg.dev, projectId: cfg.prod.projectId } };
      expect(checkRules({ env, branch: 'multi-tenant', dirty: '', targets: trungId }).join(' ')).toMatch(/CÙNG một project/);
      const trungTen = { prod: cfg.prod, dev: { ...cfg.dev, projectName: cfg.prod.projectName } };
      expect(checkRules({ env, branch: 'multi-tenant', dirty: '', targets: trungTen }).join(' ')).toMatch(/CÙNG một project/);
    }
  });
  it('project dev không được mang tên của môi trường thật', () => {
    expect(checkRules({ env: 'dev', branch: 'x', dirty: '', targets: { prod: { ...cfg.prod, projectName: 'khac', projectId: 'prj_Khac00000000001' }, dev: { ...cfg.dev, projectName: PROD_PROJECT_NAME } } }).join(' ')).toMatch(/không được đặt tên/);
  });
  it('môi trường lạ → lỗi', () => { expect(checkRules({ env: 'qa', branch: 'x', dirty: '', targets })[0]).toMatch(/không hợp lệ/); });
});

describe('xác nhận và biến môi trường Vercel', () => {
  it('prod phải gõ đúng "DEPLOY"; dev không cần', () => {
    expect(confirmOk('prod', CONFIRM_WORD)).toBe(true); expect(confirmOk('prod', ' DEPLOY ')).toBe(true);
    for (const a of ['', 'deploy', 'yes', 'DEPLOY!']) expect(confirmOk('prod', a)).toBe(false);
    expect(confirmOk('dev', '')).toBe(true);
    expect(ENVS.prod.needConfirm && !ENVS.dev.needConfirm).toBe(true);
  });
  it('vercelEnv trả đúng 2 biến để chọn project mà không cần liên kết lại thư mục', () => {
    expect(vercelEnv(cfg.dev)).toEqual({ VERCEL_ORG_ID: 'team_orgthat1', VERCEL_PROJECT_ID: 'prj_DevProjectId00002' });
  });
});

describe('nhãn môi trường thử nghiệm', () => {
  it('chỉ hiện khi VITE_APP_ENV=dev; không bắt chuột; gọi lại không nhân đôi', () => {
    document.body.innerHTML = '';
    expect(mountEnvRibbon(undefined)).toBeNull(); expect(mountEnvRibbon('prod')).toBeNull();
    expect(document.getElementById('env_ribbon')).toBeNull();
    const el = mountEnvRibbon('dev')!;
    expect(el.textContent).toContain('THỬ NGHIỆM'); expect(el.style.pointerEvents).toBe('none');
    mountEnvRibbon('dev'); expect(document.querySelectorAll('#env_ribbon')).toHaveLength(1);
  });
});
