#!/usr/bin/env node
// CẤU HÌNH MÔI TRƯỜNG DEV cho lệnh `npm run deploy:dev`: ghi .vercel/envs.json (tệp cục bộ, nằm trong .gitignore).
// Cần 2 giá trị lấy ở Vercel (không phải bí mật, chỉ là mã định danh):
//   Project ID : Vercel → project dev → Settings → General → "Project ID"   (dạng prj_xxxxxxxxxxxx)
//   Org/Team ID: Vercel → Settings (của tài khoản/nhóm) → General → "Team ID" / "Vercel ID"; hoặc xem trong .vercel/project.json (orgId)
//                — nếu project dev nằm CHUNG tài khoản với project thật thì Org ID giống hệt giá trị orgId trong .vercel/project.json.
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { resolveTarget, checkRules, PROD_PROJECT_NAME } from './lib/deploy-core.mjs';

const linked = fs.existsSync('.vercel/project.json') ? JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8')) : null;
if (!linked) { console.error('\n⛔ Chưa có .vercel/project.json (môi trường thật chưa liên kết). Chạy: npx vercel link\n'); process.exit(1); }
const old = fs.existsSync('.vercel/envs.json') ? JSON.parse(fs.readFileSync('.vercel/envs.json', 'utf8')) : {};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const name = (await rl.question('Tên project Vercel dev (vd lolo-dev): ')).trim();
const projectId = (await rl.question('Project ID của project dev (prj_...): ')).trim();
const orgId = (await rl.question(`Org/Team ID [Enter = dùng ${linked.orgId}]: `)).trim() || linked.orgId;
rl.close();

const cfg = { prod: old.prod || { projectName: linked.projectName || PROD_PROJECT_NAME, orgId: linked.orgId, projectId: linked.projectId }, dev: { projectName: name, orgId, projectId } };
const rd = resolveTarget('dev', cfg, linked), rp = resolveTarget('prod', cfg, linked);
if (!rd.ok || !rp.ok) { console.error(`\n⛔ ${rd.error || rp.error}\n`); process.exit(1); }
const errs = checkRules({ env: 'dev', branch: '', dirty: '', targets: { prod: rp.target, dev: rd.target } });
if (errs.length) { console.error(`\n⛔ ${errs.join('\n   • ')}\n`); process.exit(1); }
fs.writeFileSync('.vercel/envs.json', JSON.stringify(cfg, null, 2));
console.log('\n✅ Đã lưu .vercel/envs.json. Kiểm tra: npm run deploy:dev -- --check\n');
