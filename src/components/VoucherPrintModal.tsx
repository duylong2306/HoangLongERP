import React from 'react';
import { Receipt, Payment } from '../types';
import { BusinessInfo } from '../context/SettingsContext';
import { numberToVietnameseWords } from '../lib/numberToWords';

interface VoucherMeta {
  payer?: string;        // Người nộp (phiếu thu) / tên khách hàng
  project?: string;      // Công trình liên đới
  collector?: string;    // Người thu (phiếu thu)
  proposer?: string;     // Người lập phiếu (phiếu chi)
  approver?: string;     // Người duyệt (phiếu chi)
  order?: string;        // Mã đơn hàng liên kết
}

interface VoucherPrintModalProps {
  open: boolean;
  onClose: () => void;
  type: 'receipt' | 'payment';
  data: Receipt | Payment;
  businessInfo: BusinessInfo;
  meta?: VoucherMeta;
}

function formatDateVi(dateStr?: string): string {
  if (!dateStr) return '......';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `Ngày ${day} tháng ${month} năm ${year}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' VNĐ';
}

export default function VoucherPrintModal({
  open,
  onClose,
  type,
  data,
  businessInfo,
  meta,
}: VoucherPrintModalProps) {
  if (!open || !data) return null;

  const isReceipt = type === 'receipt';
  const amount = data.amount || 0;
  const methodText =
    (data as Receipt).paymentMethod === 'transfer'
      ? 'Chuyển khoản'
      : (data as Receipt).paymentMethod === 'cash'
      ? 'Tiền mặt'
      : 'Tiền mặt';

  const words = numberToVietnameseWords(amount);
  const title = isReceipt ? 'PHIẾU THU' : 'PHIẾU CHI';
  const formNo = isReceipt ? 'Mẫu số: 01-TT' : 'Mẫu số: 02-TT';

  return (
    <div className="fixed inset-0 z-[130] flex items-start justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="my-6 w-full max-w-[820px]">
        {/* Thanh tiêu đề cửa sổ (có nền, không in) */}
        <div className="print-hide flex items-center justify-between bg-slate-900 border border-slate-800 rounded-t-2xl px-4 py-3 shadow-2xl">
          <span className="text-white text-sm font-bold">
            Xem {isReceipt ? 'phiếu thu' : 'phiếu chi'} · {data.code}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5"
            >
              🖨️ In phiếu
            </button>
          </div>
        </div>

        {/* Tờ phiếu (nền trắng) */}
        <div
          id="voucher-print-area"
          className="bg-white text-slate-900 shadow-2xl font-sans text-[13px] leading-relaxed p-8 sm:p-10 rounded-b-2xl border-x border-b border-slate-800"
        >
          {/* Tiêu đề doanh nghiệp */}
          <div className="flex items-start justify-between border-b-2 border-slate-300 pb-3">
            <div className="flex-1 pr-4">
              <div className="font-extrabold text-[15px] uppercase tracking-wide text-slate-900">
                {businessInfo.companyName || 'TÊN CÔNG TY'}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Mã số thuế: {businessInfo.taxCode || '...............'}
              </div>
              <div className="text-[11px] text-slate-600">
                Địa chỉ: {businessInfo.address || '.........................................'}
              </div>
              <div className="text-[11px] text-slate-600">
                Điện thoại: {businessInfo.phone || '............'} ・ Email:{' '}
                {businessInfo.email || '.....................'}
              </div>
              {businessInfo.representative ? (
                <div className="text-[11px] text-slate-600">
                  Người đại diện: {businessInfo.representative}
                </div>
              ) : null}
              {businessInfo.bankInfo ? (
                <div className="text-[11px] text-slate-600">
                  Tài khoản: {businessInfo.bankInfo}
                </div>
              ) : null}
            </div>
            <div className="text-right text-[10px] text-slate-500 leading-tight whitespace-nowrap">
              <div className="font-bold text-slate-700">{formNo}</div>
              <div>(Ban hành theo TT số 200/2014/TT-BTC)</div>
            </div>
          </div>

          {/* Tên phiếu */}
          <div className="text-center my-4">
            <div className="text-[26px] font-black uppercase tracking-widest text-slate-900">
              {title}
            </div>
            <div className="text-[11px] italic text-slate-500">
              {formatDateVi((data as any).receiptAt || data.date || (data as any).paymentAt)}
            </div>
          </div>

          {/* Số phiếu */}
          <div className="text-right text-[12px] text-slate-700 mb-3">
            Số: <span className="font-bold font-mono">{data.code}</span>
          </div>

          {/* Nội dung */}
          <div className="space-y-2">
            {isReceipt ? (
              <>
                <Row label="Họ và tên người nộp tiền">
                  {meta?.payer || '..................................................'}
                </Row>
                <Row label="Địa chỉ">
                  {meta?.project
                    ? `Công trình: ${meta.project}`
                    : '..................................................'}
                </Row>
                <Row label="Lý do nộp">
                  {data.notes || meta?.order ? `${data.notes || ''}${meta?.order ? ` (ĐH: ${meta.order})` : ''}` : '..................................................'}
                </Row>
              </>
            ) : (
              <>
                <Row label="Họ và tên người nhận">
                  {(data as Payment).recipient || '..................................................'}
                </Row>
                <Row label="Địa chỉ">
                  {meta?.project
                    ? `Công trình: ${meta.project}`
                    : '..................................................'}
                </Row>
                <Row label="Lý do chi">
                  {data.notes || meta?.order ? `${data.notes || ''}${meta?.order ? ` (ĐH: ${meta.order})` : ''}` : '..................................................'}
                </Row>
              </>
            )}

            <Row label="Số tiền">
              <span className="font-bold">{formatAmount(amount)}</span>
            </Row>
            <Row label="Bằng chữ">
              <span className="italic">{words}</span>
            </Row>
            <Row label="Phương thức">
              {methodText}
              {isReceipt ? '' : (data as Payment).status === 'approved' ? ' (Đã duyệt chi)' : ' (Chờ duyệt chi)'}
            </Row>
            <Row label="Kèm theo">
              {data.attachmentName ? data.attachmentName : '...... chứng từ gốc'}
            </Row>
          </div>

          {/* Chữ ký */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 text-center text-[11px]">
            {isReceipt ? (
              <>
                <SignCol label="Người nộp tiền" name={meta?.payer} />
                <SignCol label="Người thu" name={meta?.collector || (data as Receipt).collector} />
                <SignCol label="Thủ quỹ" name="" />
                <SignCol label="Giám đốc" name={businessInfo.representative} />
              </>
            ) : (
              <>
                <SignCol label="Người nhận" name={(data as Payment).recipient} />
                <SignCol label="Người lập phiếu" name={meta?.proposer || (data as Payment).proposer} />
                <SignCol label="Thủ quỹ" name="" />
                <SignCol label="Giám đốc" name={meta?.approver || businessInfo.representative} />
              </>
            )}
          </div>

          <div className="mt-8 pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400 text-center">
            {businessInfo.companyName} · In lúc {formatDateVi(new Date().toISOString())}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #voucher-print-area, #voucher-print-area * {
            visibility: visible !important;
          }
          #voucher-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none !important;
          }
          .print-hide {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold text-slate-700 whitespace-nowrap">{label}:</span>
      <span className="text-slate-900 flex-1 border-b border-dotted border-slate-300 pb-0.5">
        {children}
      </span>
    </div>
  );
}

function SignCol({ label, name }: { label: string; name?: string }) {
  return (
    <div>
      <div className="font-semibold text-slate-600 mb-8">{label}</div>
      <div className="font-bold text-slate-900 min-h-[18px]">{name || ''}</div>
      <div className="text-[9px] text-slate-400">(Ký, họ tên)</div>
    </div>
  );
}
