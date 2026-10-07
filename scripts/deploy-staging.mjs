#!/usr/bin/env node
// Deploy bản STAGING (project Vercel "hoanglong-erp-staging") — có chốt chặn để không deploy nhầm.
//
// Vì sao cần: `vercel deploy` đóng gói đúng những file ĐANG có trong thư mục, không quan tâm nhánh nào.
// Đã từng bị deploy nhầm bản của nhánh `main` lên staging (staging mất ô "Mã công ty") vì thư mục
// đang ở nhánh `main` lúc gõ lệnh. Script này chặn các lỗi đó trước khi deploy.
//
// Dùng:  npm run deploy:staging            → kiểm tra rồi deploy
//        npm run deploy:staging -- --check → chỉ kiểm tra, KHÔNG deploy
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const NHANH_STAGING = 'multi-tenant';       // staging luôn là bản đa công ty
const PROJECT_STAGING = 'hoanglong-erp-staging';
const SO_LAN_THU = 3;                        // Vercel CLI thỉnh thoảng báo "Not authorized", chạy lại là hết

const chiKiemTra = process.argv.includes('--check');
const loi = (msg) => { console.error(`\n⛔ DỪNG — ${msg}\n`); process.exit(1); };
const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();

// 1) Phải đang ở đúng nhánh
const nhanh = git('branch --show-current');
if (nhanh !== NHANH_STAGING) {
  loi(`đang ở nhánh "${nhanh}", staging chỉ được deploy từ nhánh "${NHANH_STAGING}".\n   Chạy: git checkout ${NHANH_STAGING}`);
}

// 2) Không được có sửa đổi chưa commit trong file đang theo dõi (Vercel sẽ đóng gói cả chúng)
const thayDoi = git('status --porcelain --untracked-files=no');
if (thayDoi) {
  loi(`còn sửa đổi CHƯA COMMIT (sẽ bị đưa lên staging nhưng không nằm trong lịch sử git):\n${thayDoi}\n   Hãy commit hoặc hoàn tác trước.`);
}

// 3) Thư mục phải đang liên kết đúng project STAGING (tránh deploy nhầm lên production)
if (!existsSync('.vercel/project.json')) {
  loi('chưa liên kết Vercel (thiếu .vercel/project.json). Chạy: npx vercel link');
}
const { projectName } = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (projectName !== PROJECT_STAGING) {
  loi(`thư mục đang liên kết project "${projectName}", không phải "${PROJECT_STAGING}".`);
}

const commit = git('rev-parse --short HEAD');
const chuaPush = git(`rev-list --count origin/${NHANH_STAGING}..HEAD`);
console.log(`✅ Nhánh: ${nhanh} @ ${commit} | Project: ${projectName} | Không có sửa đổi chưa commit`);
if (chuaPush !== '0') {
  console.log(`⚠️  Có ${chuaPush} commit chưa push lên origin/${NHANH_STAGING} (vẫn deploy được, nhớ push sau khi test xong).`);
}

if (chiKiemTra) {
  console.log('Chế độ --check: mọi kiểm tra đều đạt, KHÔNG deploy.');
  process.exit(0);
}

// 4) Deploy (thử lại khi gặp lỗi "Not authorized" thoáng qua của Vercel CLI)
for (let lan = 1; lan <= SO_LAN_THU; lan++) {
  console.log(`\n🚀 Deploy staging (lần ${lan}/${SO_LAN_THU})...\n`);
  const kq = spawnSync('npx', ['vercel', 'deploy', '--prod', '--yes'], { stdio: 'inherit' });
  if (kq.status === 0) {
    console.log(`\n✅ Đã deploy staging từ ${nhanh} @ ${commit}`);
    process.exit(0);
  }
}
loi(`deploy thất bại sau ${SO_LAN_THU} lần. Nếu báo "Not authorized" liên tục: chạy "npx vercel whoami" / "npx vercel login".`);
