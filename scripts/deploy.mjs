#!/usr/bin/env node
// DEPLOY lên Vercel — 2 môi trường tách biệt (xem scripts/lib/deploy-core.mjs).
//   npm run deploy:dev            → môi trường THỬ NGHIỆM (project Vercel + Supabase riêng, dữ liệu giả), mọi nhánh, kể cả sửa dở
//   npm run deploy:prod           → môi trường THẬT (nhân viên đang dùng): chỉ nhánh multi-tenant, sạch sẽ, phải gõ DEPLOY để xác nhận
//   npm run deploy:staging        → tên cũ, tương đương deploy:prod (nên dùng deploy:prod cho rõ nghĩa)
// Tùy chọn: --check (chỉ kiểm tra, không deploy) · --yes (bỏ bước gõ xác nhận, chỉ dùng khi chạy tự động)
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import readline from 'node:readline/promises';
import { resolveTarget, checkRules, vercelEnv, confirmOk, ENVS, CONFIRM_WORD } from './lib/deploy-core.mjs';

const SO_LAN_THU = 3;   // Vercel CLI thỉnh thoảng báo "Not authorized", chạy lại là hết
const env = process.argv[2];
const chiKiemTra = process.argv.includes('--check'), boQuaXacNhan = process.argv.includes('--yes');
const loi = (m) => { console.error(`\n⛔ DỪNG — ${m}\n`); process.exit(1); };
const git = (a) => execSync(`git ${a}`, { encoding: 'utf8' }).trim();
const docJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);

if (!ENVS[env]) loi(`Dùng: node scripts/deploy.mjs <dev|prod> [--check] [--yes]`);
const envsJson = docJson('.vercel/envs.json');
const linked = docJson('.vercel/project.json');
const r = resolveTarget(env, envsJson, linked);
if (!r.ok) loi(r.error);
const other = resolveTarget(env === 'prod' ? 'dev' : 'prod', envsJson, linked);
const targets = { [env]: r.target, [env === 'prod' ? 'dev' : 'prod']: other.ok ? other.target : null };

const errs = checkRules({ env, branch: git('branch --show-current'), dirty: git('status --porcelain --untracked-files=no'), targets });
if (errs.length) loi(errs.join('\n   • '));

const commit = git('rev-parse --short HEAD');
console.log(`✅ ${ENVS[env].label} | Project: ${r.target.projectName || r.target.projectId} | nhánh ${git('branch --show-current')} @ ${commit}`);
if (env === 'prod') {
  const chuaPush = git('rev-list --count origin/multi-tenant..HEAD');
  if (chuaPush !== '0') console.log(`⚠️  Có ${chuaPush} commit chưa push lên origin/multi-tenant (vẫn deploy được, nhớ push sau khi kiểm tra xong).`);
}
if (chiKiemTra) { console.log('Chế độ --check: mọi kiểm tra đều đạt, KHÔNG deploy.'); process.exit(0); }

if (ENVS[env].needConfirm && !boQuaXacNhan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await rl.question(`\n⚠️  Đây là ${ENVS[env].label}: nhân viên sẽ dùng bản này NGAY.\n   Gõ  ${CONFIRM_WORD}  để tiếp tục: `);
  rl.close();
  if (!confirmOk(env, ans)) loi('Không khớp — đã hủy, chưa deploy gì.');
}

for (let lan = 1; lan <= SO_LAN_THU; lan++) {
  console.log(`\n🚀 Deploy ${env} (lần ${lan}/${SO_LAN_THU})...\n`);
  const kq = spawnSync('npx', ['vercel', 'deploy', '--prod', '--yes'], { stdio: 'inherit', env: { ...process.env, ...vercelEnv(r.target) } });
  if (kq.status === 0) { console.log(`\n✅ Đã deploy ${env} từ ${commit}`); process.exit(0); }
}
loi(`deploy thất bại sau ${SO_LAN_THU} lần. Nếu báo "Not authorized" liên tục: chạy "npx vercel whoami" / "npx vercel login".`);
