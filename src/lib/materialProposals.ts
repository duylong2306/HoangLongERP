// Logic tạo Đề Xuất Vật Tư dùng CHUNG giữa 2 nơi tạo đề xuất trong ứng dụng:
//   1) "Tạo Đề Xuất Nhanh" / "Đề Xuất Kho" trên board Điều Phối Vật Tư (MaterialCoordination.tsx)
//   2) "Đề xuất vật tư" mở từ chi tiết Công việc (ConnectedToolsModal.tsx)
// Trước đây 2 nơi tự viết lại y hệt logic tách nhóm theo Mã MUA + tạo bản ghi —
// sửa 1 chỗ (vd thêm field, đổi luật tách nhóm) không tự áp dụng cho chỗ kia.
// Gộp về đây để chỉ có 1 nguồn sự thật duy nhất.
import { dbService } from './dbService';

export interface MaterialProposalItemInput {
  id: string;
  name: string;
  qty: number;
  unit: string;
  spec?: string;
  note?: string;
  maSanPham?: string;
  price?: number;
}

export interface CreateMaterialProposalsParams {
  /** Danh sách dòng vật tư đã hợp lệ (đã lọc tên rỗng ở phía gọi). */
  items: MaterialProposalItemInput[];
  /** Mã gốc của đề xuất — hàm sẽ tự thêm hậu tố "-MUA"/"-TNCC" nếu cần tách 2 nhóm. */
  code: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskName?: string;
  createdBy: string;
  createdByName: string;
  notes?: string;
}

export interface CreateMaterialProposalsResult {
  /** Các đề xuất đã tạo (đã lưu DB) — 1 hoặc 2 bản ghi tuỳ có tách nhóm hay không. */
  created: any[];
  withCodeCount: number;
  withoutCodeCount: number;
}

/**
 * Tạo 1-2 đề xuất vật tư (material_proposals) từ danh sách dòng vật tư, tự tách
 * theo "Mã MUA" (maSanPham):
 *   - Dòng CÓ mã   → 1 đề xuất trạng thái 'waiting_order' (CHỜ ĐẶT HÀNG, bỏ qua bước duyệt)
 *   - Dòng CHƯA có mã → 1 đề xuất trạng thái 'find_supplier' (TÌM NHÀ CUNG CẤP)
 * Nếu cả 2 nhóm đều có dòng, mỗi đề xuất được gắn hậu tố "-MUA"/"-TNCC" vào mã để
 * phân biệt; nếu chỉ 1 nhóm có dữ liệu thì giữ nguyên mã gốc.
 *
 * Không xử lý thông báo/chat/điều hướng — phần đó khác nhau tuỳ nơi gọi (board hay
 * từ Công việc) nên vẫn để phía gọi tự xử lý sau khi có kết quả trả về.
 */
export async function createMaterialProposalsFromItems(
  params: CreateMaterialProposalsParams
): Promise<CreateMaterialProposalsResult> {
  const { items, code, projectId, projectName, taskId, taskName, createdBy, createdByName, notes } = params;
  const now = new Date();
  const withCode = items.filter(it => !!it.maSanPham);
  const withoutCode = items.filter(it => !it.maSanPham);
  const bothGroups = withCode.length > 0 && withoutCode.length > 0;

  const buildProposal = (groupItems: MaterialProposalItemInput[], status: string, suffix: string) => ({
    id: `material_prop_${Date.now()}_${suffix || '0'}`,
    code: `${code}${suffix}`,
    projectId,
    projectName,
    taskId: taskId || undefined,
    taskName: taskName || '',
    proposalType: 'material',
    createdBy,
    createdByName,
    status,
    items: groupItems.map(it => ({
      id: it.id,
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      spec: it.spec || '',
      price: it.price || 0,
      totalPrice: (it.price || 0) * (it.qty || 0),
      note: it.note || '',
      maSanPham: it.maSanPham || '',
    })),
    supplierId: null,
    supplierName: null,
    quotes: [],
    chosenQuoteId: null,
    purchaseOrderIds: [],
    notes: notes || '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const created: any[] = [];
  if (withCode.length) {
    const p = buildProposal(withCode, 'waiting_order', bothGroups ? '-MUA' : '');
    await dbService.materialProposals.create(p);
    created.push(p);
  }
  if (withoutCode.length) {
    const p = buildProposal(withoutCode, 'find_supplier', bothGroups ? '-TNCC' : '');
    await dbService.materialProposals.create(p);
    created.push(p);
  }

  window.dispatchEvent(new CustomEvent('hl-material-proposals-updated'));

  return { created, withCodeCount: withCode.length, withoutCodeCount: withoutCode.length };
}
