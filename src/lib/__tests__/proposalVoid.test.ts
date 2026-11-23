import { describe, it, expect } from 'vitest';
import { ordersToVoidOnProposalDelete } from '../proposalVoid';

// Đề xuất bị xóa; đơn treo của nó chỉ bị hủy khi chắc chắn thừa
const prop = { id: 'P1', purchaseOrderIds: ['PO-LIEN-KET'] };
const base = { status: 'confirmed', thanhToanThucTe: 0, receiptId: null, items: [{ receivedQty: 0 }] };

describe('ordersToVoidOnProposalDelete', () => {
  it('hủy đơn treo theo proposalId', () => {
    const r = ordersToVoidOnProposalDelete(prop, [{ id: 'A', proposalId: 'P1', ...base }]);
    expect(r.map(o => o.id)).toEqual(['A']);
  });

  it('hủy đơn treo theo danh sách purchaseOrderIds của đề xuất', () => {
    const r = ordersToVoidOnProposalDelete(prop, [{ id: 'PO-LIEN-KET', ...base }]);
    expect(r.map(o => o.id)).toEqual(['PO-LIEN-KET']);
  });

  it('không đụng đơn của đề xuất khác', () => {
    expect(ordersToVoidOnProposalDelete(prop, [{ id: 'B', proposalId: 'P2', ...base }])).toEqual([]);
  });

  it('giữ đơn đã hoàn tất, đã chi, đã có phiếu nhập, đã nhận hàng', () => {
    const orders = [
      { id: 'done', proposalId: 'P1', ...base, status: 'completed' },
      { id: 'paid', proposalId: 'P1', ...base, thanhToanThucTe: 1000 },
      { id: 'receipt', proposalId: 'P1', ...base, receiptId: 'R1' },
      { id: 'recv', proposalId: 'P1', ...base, items: [{ receivedQty: 2 }] },
    ];
    expect(ordersToVoidOnProposalDelete(prop, orders)).toEqual([]);
  });

  it('giữ đơn đã ghi nhận vào công nợ NCC', () => {
    const r = ordersToVoidOnProposalDelete(prop, [{ id: 'rec', proposalId: 'P1', ...base }], new Set(['rec']));
    expect(r).toEqual([]);
  });
});
