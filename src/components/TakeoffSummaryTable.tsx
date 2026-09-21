import React, { useMemo } from 'react';
import { buildFinalSummary } from '../lib/takeoffCalc';

/**
 * Bảng tổng hợp bóc tách theo từng phần — giống sheet "PL HỢP ĐỒNG" trong file Excel.
 * Dùng chung cho màn Báo giá cuối cùng và bản in Báo giá cuối cùng để hai nơi luôn cùng một số liệu.
 * Chỉ đọc: muốn sửa số liệu thì sửa ở Bảng Bóc Tách Chi Tiết.
 */
const fmt = (v: number, d = 0) => v.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: d });

export default function TakeoffSummaryTable({ rows }: { rows: any }) {
  const { sections, totals } = useMemo(() => buildFinalSummary(rows), [rows]);

  return (
    <table className="w-full text-left border-collapse border border-black font-sans text-slate-800" style={{ fontSize: '11px', lineHeight: '1.3' }}>
      <thead>
        <tr className="bg-[#1e40af] text-white font-extrabold border-b border-black uppercase tracking-wider text-center text-[10px]">
          <th className="px-2 py-2.5 border border-black w-[40px]">STT</th>
          <th className="px-3 py-2.5 border border-black text-left min-w-[220px]">Nội dung công việc</th>
          <th className="px-2 py-2.5 border border-black w-[55px]">ĐVT</th>
          <th className="px-2 py-2.5 border border-black w-[85px] text-right">Khối lượng</th>
          <th className="px-2 py-2.5 border border-black w-[95px] text-right">Đơn giá (đ)</th>
          <th className="px-2 py-2.5 border border-black w-[110px] text-right">Thành tiền vật tư (đ)</th>
          <th className="px-2 py-2.5 border border-black w-[110px] text-right">Thành tiền nhân công (đ)</th>
          <th className="px-2 py-2.5 border border-black w-[120px] text-right">Thành tiền (đ)</th>
        </tr>
      </thead>
      <tbody>
        {sections.length === 0 && (
          <tr>
            <td colSpan={8} className="px-4 py-6 text-center italic text-slate-500 border border-black">
              Chưa có dữ liệu bóc tách. Vui lòng lập Bảng Bóc Tách Chi Tiết trước.
            </td>
          </tr>
        )}
        {sections.map(sec => (
          <React.Fragment key={sec.id}>
            {/* Dòng tên phần + tổng của phần */}
            <tr className="bg-blue-50/60 font-black text-[#1e40af] text-[10.5px] uppercase border-y border-black">
              <td colSpan={5} className="px-3 py-2 text-left tracking-wide">{sec.name}</td>
              <td className="px-2 py-2 text-right font-mono border border-black">{fmt(sec.ttVatTu)}</td>
              <td className="px-2 py-2 text-right font-mono border border-black">{fmt(sec.ttNhanCong)}</td>
              <td className="px-2 py-2 text-right font-mono border border-black">{fmt(sec.total)}</td>
            </tr>
            {sec.items.map(it => (
              <tr key={`${sec.id}_${it.stt}`} className="border-b border-black text-slate-700 text-center">
                <td className="px-2 py-2 border border-black font-medium text-slate-500">{it.stt}</td>
                <td className="px-3 py-2 border border-black text-left font-bold text-slate-900 leading-tight">{it.name}</td>
                <td className="px-2 py-2 border border-black">{it.unit}</td>
                <td className="px-2 py-2 border border-black text-right font-mono">{fmt(it.kl, 3)}</td>
                <td className="px-2 py-2 border border-black text-right font-mono">{fmt(it.donGia)}</td>
                <td className="px-2 py-2 border border-black text-right font-mono">{fmt(it.ttVatTu)}</td>
                <td className="px-2 py-2 border border-black text-right font-mono">{fmt(it.ttNhanCong)}</td>
                <td className="px-2 py-2 border border-black text-right font-mono font-black text-slate-900 bg-slate-50/30">{fmt(it.thanhTien)}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}

        {sections.length > 0 && (
          <>
            <tr className="bg-[#047857] text-white text-[11px] font-black uppercase tracking-wider border-t-2 border-slate-300">
              <td colSpan={5} className="px-3 py-3 text-left border border-emerald-800">TỔNG CỘNG</td>
              <td className="px-2 py-3 text-right border border-emerald-800 font-mono">{fmt(totals.vatTu)}</td>
              <td className="px-2 py-3 text-right border border-emerald-800 font-mono">{fmt(totals.nhanCong)}</td>
              <td className="px-2 py-3 text-right border border-emerald-800 font-mono text-[12.5px]">{fmt(totals.total)}</td>
            </tr>
            <tr className="bg-emerald-50 text-emerald-900 text-[11px] font-black uppercase tracking-wider">
              <td colSpan={7} className="px-3 py-2 text-right border border-black">LÀM TRÒN:</td>
              <td className="px-2 py-2 text-right border border-black font-mono">{fmt(totals.rounded)}</td>
            </tr>
          </>
        )}
      </tbody>
    </table>
  );
}
