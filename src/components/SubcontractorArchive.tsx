import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, ArchivedQuote, Supplier } from '../types';
import { FileText, Search, Printer, Trash2, Eye, Calendar, User, Briefcase, ChevronRight, ShieldCheck, Info, CheckCircle2, FileCheck, Save } from 'lucide-react';
import { useNotification, isUserInRoleGroup } from '../context';

interface SubcontractorArchiveProps {
  currentUser: Employee;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Khi được truyền vào, component sẽ tự động mở print preview cho HĐ này. Dùng khi redirect từ Menu Thầu Phụ (chi tiết công việc / Kanban). */
  viewContractId?: string;
}

export default function SubcontractorArchive({ currentUser, canEdit = true, canDelete = true, viewContractId: propViewContractId }: SubcontractorArchiveProps) {
  const { addToast } = useNotification();
  const [archivedList, setArchivedList] = useState<ArchivedQuote[]>([]);
  const [projectsList, setProjectsList] = useState<{ id: string; name?: string }[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedQuote, setSelectedQuote] = useState<ArchivedQuote | null>(null);
  const [tempQuote, setTempQuote] = useState<ArchivedQuote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedQuote | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Load suppliers list from Supabase
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await dbService.suppliers.list();
        setSuppliers(data);
      } catch (err) {
        console.error("Lỗi load thầu phụ từ Supabase:", err);
      }
    };
    loadSuppliers();
    window.addEventListener('hl-suppliers-updated', loadSuppliers);
    return () => {
      window.removeEventListener('hl-suppliers-updated', loadSuppliers);
    };
  }, []);

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const data = await dbService.archivedQuotes.list('subcontractor');
      setArchivedList(data);
      const projs = await dbService.projects.list();
      setProjectsList(projs);
    } catch (error) {
      console.error("Lỗi khi tải hồ sơ thầu phụ:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
    // Listening to custom event from the estimator when saved
    window.addEventListener('hl-archived-subcontractor-quotes-updated', fetchArchives);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', fetchArchives);
    };
  }, []);

  // ── TỰ ĐỘNG MỞ PRINT PREVIEW KHI ĐƯỢC REDIRECT TỪ MENU THẦU PHỤ ──
  useEffect(() => {
    if (archivedList.length === 0) return;

    // Ưu tiên prop viewContractId, fallback sang localStorage (từ TaskDetailModal / Kanban)
    const targetId = propViewContractId || localStorage.getItem('hl_view_contract_id');
    if (!targetId) return;

    const found = archivedList.find(q => q.id === targetId);
    if (found) {
      setSelectedQuote(found);
      setTempQuote({ ...found });
      setShowPrintPreview(true);
    }
    // Chỉ dùng 1 lần — xoá ngay sau khi consume
    if (!propViewContractId) {
      localStorage.removeItem('hl_view_contract_id');
    }
  }, [archivedList, propViewContractId]);

  const filteredList = useMemo(() => {
    return archivedList.filter(item => {
      const isCreator = item.creatorId === currentUser.id;
      // Allow viewing if creator, or if user has admin/accountant privileges, but fallback to simple filter
      if (!isCreator && !isUserInRoleGroup(currentUser.id, 'role_admin') && !isUserInRoleGroup(currentUser.id, 'role_accounting')) return false;

      const matchesSearch = 
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.subcontractorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.workName || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [archivedList, searchTerm, currentUser]);

  const handleDeleteClick = (item: ArchivedQuote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA hợp đồng thầu phụ.', type: 'error' });
      return;
    }
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dbService.archivedQuotes.delete(deleteTarget.id);
      setArchivedList(prev => prev.filter(q => q.id !== deleteTarget.id));
      if (selectedQuote?.id === deleteTarget.id) {
        setSelectedQuote(null);
      }
      setDeleteTarget(null);
      
      // Dispatch custom event to sync drop-downs
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
    } catch (error) {
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi xóa hồ sơ.', type: 'error' });
    }
  };

  const getStatusBadge = (status: string, isApproved?: boolean) => {
    const statusNormalized = (status || '').trim().toLowerCase();
    if (isApproved || statusNormalized === 'hoàn thành') {
      return 'bg-emerald-950/45 text-emerald-400 border border-emerald-900/30';
    }
    return 'bg-amber-950/45 text-amber-400 border border-amber-900/30';
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedQuote?.subcontractorId);

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 space-y-6 text-left" id="subcontractor_archive_workspace">
      <div>
        <h3 className="font-black text-lg text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <span className="p-1 px-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-xs">📝 CONTRACT ARCHIVE</span>
          Hồ Sơ Lưu Trữ Hợp Đồng Thầu Phụ
        </h3>
        <p className="text-[11px] text-slate-400 mt-1 max-w-2xl">
          Lịch sử lưu vết các hợp đồng thầu phụ thi công xây dựng, cơ khí lắp đặt và tổ thợ khoán liên kết dự án Hoàng Long.
        </p>
      </div>

      <div className="flex gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Tìm theo Mã hợp đồng, Thầu phụ, Công việc, Dự án..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 pl-10 pr-4 py-2.5 rounded-lg text-xs outline-none focus:border-emerald-500 text-slate-100 placeholder-slate-500 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse font-bold uppercase tracking-wider">
          Đang tải dữ liệu hồ sơ thầu phụ...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <h5 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Không tìm thấy hợp đồng nào</h5>
          <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
            Vui lòng chọn tab "Lập HĐ Thầu Phụ" để khởi tạo hợp đồng mới.
          </p>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950 shadow-lg">
          <table className="w-full text-slate-300 text-xs text-left">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="px-4 py-3 text-center w-[50px]">STT</th>
                <th className="px-4 py-3">Mã Hợp Đồng</th>
                <th className="px-4 py-3">Dự Án Liên Kết</th>
                <th className="px-4 py-3">Thầu Phụ Nhận Khoán</th>
                <th className="px-4 py-3">Nội Dung Công Việc</th>
                <th className="px-4 py-3">Ngày Lập</th>
                <th className="px-4 py-3 text-right">Giá Trị Khoán</th>
                <th className="px-4 py-3 text-center">Trạng Thái</th>
                <th className="px-4 py-3 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredList.map((item, idx) => {
                return (
                  <tr 
                    key={item.id}
                    onClick={() => {
                      setSelectedQuote(item);
                      setTempQuote({ ...item });
                      setShowPrintPreview(true);
                    }}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-center font-mono text-slate-500 font-bold border-r border-slate-900">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3.5 font-bold font-mono text-emerald-400 uppercase">
                      {item.code || 'BÁO GIÁ LẺ'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-semibold block text-slate-200 line-clamp-1">{item.projectName}</span>
                        <span className="text-[10px] text-slate-500">Chủ đầu tư: {item.customerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-semibold block text-slate-200">{item.subcontractorName}</span>
                        <span className="text-[10px] text-emerald-500 font-mono font-bold">Mã: {item.subcontractorId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[200px] truncate text-[11px] text-slate-350" title={item.workName}>
                      {item.workName}
                    </td>
                    <td className="px-4 py-3.5 text-slate-400 font-medium font-mono">
                      {item.createdAt || 'Chưa cập nhật'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-100">
                      {(item.contractValue || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {(() => {
                        const statusNormalized = (item.status || "").trim().toLowerCase();
                        const isApproved = item.isApproved === true || statusNormalized === 'hoàn thành';
                        const displayStatus = isApproved ? 'Đã Duyệt' : 'Chưa Duyệt';
                        const badgeStyle = getStatusBadge(item.status || 'Đã Lập', item.isApproved);
                        return (
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${badgeStyle}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuote(item);
                            setTempQuote({ ...item });
                            setShowPrintPreview(true);
                          }}
                          className="p-1.5 bg-slate-900 text-slate-300 hover:text-white rounded-lg border border-slate-800 hover:bg-slate-800 transition shadow cursor-pointer"
                          title="Xem & In Hợp Đồng"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(item, e)}
                          className="p-1.5 bg-rose-950/20 text-rose-400 hover:text-rose-300 rounded-lg border border-rose-950/30 hover:bg-rose-950/40 transition shadow cursor-pointer"
                          title="Xóa Hợp Đồng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[120] p-4 text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h4 className="text-sm font-extrabold uppercase text-rose-500">Xác Nhận Xóa Hợp Đồng</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa hợp đồng thầu phụ <strong className="text-white">{deleteTarget.code}</strong> khỏi hệ thống lưu trữ? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {showPrintPreview && selectedQuote && tempQuote && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 select-text text-left">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Xem &amp; Chỉnh Sửa Hợp Đồng Thầu Phụ
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium font-mono">
                    Mã HĐ: {tempQuote.code} {(tempQuote.isApproved || (tempQuote.status || '').trim().toLowerCase() === 'hoàn thành') ? (
                      <span className="ml-2 text-emerald-600 font-bold">● ĐÃ DUYỆT</span>
                    ) : (
                      <span className="ml-2 text-amber-500 font-bold">● CHƯA DUYỆT</span>
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedQuote(null);
                  setTempQuote(null);
                  setShowPrintPreview(false);
                }}
                className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Print Body */}
            <div className="p-8 bg-white overflow-y-auto flex-1 font-sans text-xs leading-relaxed text-slate-900 print-agreement relative" id="print-area-archive">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #print-area-archive, #print-area-archive * {
                    visibility: visible;
                  }
                  #print-area-archive {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    padding: 0;
                    margin: 0;
                  }
                  .print-hide {
                    display: none !important;
                  }
                }
              `}</style>

              {/* Approval Watermark Stamp */}
              {tempQuote.isApproved && (
                <div className="absolute top-24 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500 text-emerald-500 font-extrabold uppercase px-4 py-2 rounded-lg text-xs tracking-widest font-sans flex items-center gap-1 bg-white/95 shadow-md pointer-events-none select-none z-50">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-pulse" />
                  ĐÃ PHÊ DUYỆT
                </div>
              )}

              {/* Inline Action Buttons at Top (Hidden on Print) */}
              <div className="absolute top-6 right-6 flex items-center gap-2 print-hide no-print z-45">
                {tempQuote.isApproved ? (
                  <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-bold font-sans flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Hợp Đồng Đã Duyệt
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      const updated = {
                        ...tempQuote,
                        isApproved: true,
                        approvedAt: new Date().toLocaleString('vi-VN'),
                        approvedBy: currentUser.name || 'Ban Giám Đốc',
                        status: 'Hoàn thành'
                      } as unknown as ArchivedQuote;
                      setTempQuote(updated);
                      try {
                        await dbService.archivedQuotes.save({ ...updated, sector: 'subcontractor' });
                        setSelectedQuote(updated);
                        setArchivedList(prev => prev.map(q => q.id === updated.id ? updated : q));
                        addToast({ title: '✅ Thành công', message: '🎉 Phê duyệt hợp đồng thầu phụ thành công! Hợp đồng này đã được đưa sang Công nợ Trả.', type: 'success' });
                        window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
                        window.dispatchEvent(new CustomEvent('hl-subcontractor-contract-approved', { detail: updated }));
                      } catch (err) {
                        console.error("Lỗi duyệt hợp đồng:", err);
                        addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi phê duyệt hợp đồng.', type: 'error' });
                      }
                    }}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm animate-pulse"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Duyệt Hợp Đồng
                  </button>
                )}
                
                <button
                  onClick={async () => {
                    try {
                      await dbService.archivedQuotes.save({ ...tempQuote, sector: 'subcontractor' });
                      setSelectedQuote(tempQuote);
                      setArchivedList(prev => prev.map(q => q.id === tempQuote.id ? tempQuote : q));
                      addToast({ title: '✅ Thành công', message: '💾 Đã lưu thay đổi nội dung hợp đồng thành công!', type: 'success' });
                      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
                    } catch (err) {
                      console.error("Lỗi khi lưu hợp đồng:", err);
                      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi lưu thay đổi.', type: 'error' });
                    }
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-750 text-white transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Lưu Nội Dung Chỉnh Sửa"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu Hợp Đồng
                </button>
              </div>

              <div className="max-w-3xl mx-auto space-y-6 pt-4">
                {/* Header Title */}
                <div className="text-center space-y-1">
                  <h2 className="font-extrabold text-sm uppercase tracking-wide">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</h2>
                  <h3 className="font-bold text-xs uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
                  <p className="text-xs font-bold">Độc lập – Tự do – Hạnh phúc</p>
                  <div className="border-b border-slate-300 w-36 mx-auto pt-1"></div>
                </div>

                <div className="text-center pt-2">
                  <h1 className="font-black text-lg uppercase tracking-wider text-slate-900">HỢP ĐỒNG THẦU PHỤ THI CÔNG</h1>
                  <p className="font-mono text-slate-500 text-[10px] mt-0.5">Số hiệu: {tempQuote.code}</p>
                </div>

                {/* Base reference info */}
                <div className="space-y-1 text-slate-600 italic">
                  <p>- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ban hành ngày 24/11/2015;</p>
                  <p>- Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005;</p>
                  <p>- Căn cứ nhu cầu thi công thực tế và năng lực của các bên;</p>
                </div>

                {/* Contract Entities */}
                <div className="space-y-4">
                  <p className="font-bold text-slate-900 flex flex-wrap items-center gap-1">
                    <span>Hôm nay, ngày</span>
                    <input
                      type="text"
                      value={tempQuote.day || tempQuote.createdAt?.split('/')[0] || '01'}
                      onChange={(e) => setTempQuote({ ...tempQuote, day: e.target.value })}
                      className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 outline-none font-bold text-slate-800 w-8 text-center print:border-none"
                    />
                    <span>tháng</span>
                    <input
                      type="text"
                      value={tempQuote.month || tempQuote.createdAt?.split('/')[1] || '07'}
                      onChange={(e) => setTempQuote({ ...tempQuote, month: e.target.value })}
                      className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 outline-none font-bold text-slate-800 w-8 text-center print:border-none"
                    />
                    <span>năm</span>
                    <input
                      type="text"
                      value={tempQuote.year || tempQuote.createdAt?.split('/')[2] || '2026'}
                      onChange={(e) => setTempQuote({ ...tempQuote, year: e.target.value })}
                      className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 outline-none font-bold text-slate-800 w-12 text-center print:border-none"
                    />
                    <span>, tại trụ sở Công ty TNHH Hoàng Long Lâm Đồng, chúng tôi gồm:</span>
                  </p>
                  
                  {/* BÊN GIAO THẦU */}
                  <div className="space-y-1">
                    <h4 className="font-bold uppercase text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                      <span>Bên A (Bên giao thầu):</span>
                      <span className="font-extrabold text-blue-600">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</span>
                    </h4>
                    <p>• Địa chỉ: Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</p>
                    <p>• MST: 5801452655</p>
                    <p>• Đại diện: Ông Nguyễn Văn Hoàng - Chức vụ: Giám đốc</p>
                    <p>• Hotline liên hệ: 0966 545 959</p>
                  </div>

                  {/* BÊN NHẬN THẦU PHỤ */}
                  <div className="space-y-1 pt-1">
                    <h4 className="font-bold uppercase text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-1">
                      <span>Bên B (Bên nhận thầu phụ):</span>
                      <input
                        type="text"
                        value={tempQuote.subcontractorName || ''}
                        onChange={(e) => setTempQuote({ ...tempQuote, subcontractorName: e.target.value })}
                        className="bg-transparent border-b border-dashed border-slate-400 focus:border-emerald-500 outline-none font-extrabold text-emerald-600 transition-colors print:border-none print:p-0 print:bg-transparent flex-1 max-w-sm"
                        placeholder="Tên thầu phụ..."
                      />
                    </h4>
                    <p>• Mã Thầu Phụ: <span className="font-mono font-bold text-emerald-600">{tempQuote.subcontractorId || 'N/A'}</span></p>
                    
                    <p className="flex items-center gap-1">
                      <span>• Người đại diện:</span>
                      <input
                        type="text"
                        value={tempQuote.representative !== undefined ? tempQuote.representative : (selectedSupplier?.representative || '')}
                        onChange={(e) => setTempQuote({ ...tempQuote, representative: e.target.value })}
                        className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent w-full max-w-xs"
                        placeholder="Họ tên người đại diện..."
                      />
                    </p>

                    <p className="flex items-center gap-1">
                      <span>• Điện thoại:</span>
                      <input
                        type="text"
                        value={tempQuote.phone !== undefined ? tempQuote.phone : (selectedSupplier?.phone || '')}
                        onChange={(e) => setTempQuote({ ...tempQuote, phone: e.target.value })}
                        className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent w-full max-w-xs"
                        placeholder="Số điện thoại liên hệ..."
                      />
                    </p>

                    <p className="flex items-center gap-1">
                      <span>• Địa chỉ:</span>
                      <input
                        type="text"
                        value={tempQuote.address !== undefined ? tempQuote.address : (selectedSupplier?.address || '')}
                        onChange={(e) => setTempQuote({ ...tempQuote, address: e.target.value })}
                        className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent w-full max-w-md"
                        placeholder="Địa chỉ thầu phụ..."
                      />
                    </p>

                    <p className="flex items-center gap-1">
                      <span>• MST/CCCD:</span>
                      <input
                        type="text"
                        value={tempQuote.taxCode !== undefined ? tempQuote.taxCode : (selectedSupplier?.taxCode || '')}
                        onChange={(e) => setTempQuote({ ...tempQuote, taxCode: e.target.value })}
                        className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent w-full max-w-xs"
                        placeholder="Mã số thuế hoặc CCCD..."
                      />
                    </p>
                  </div>
                </div>

                {/* Contract Content clauses */}
                <div className="space-y-4 pt-1">
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase">Điều 1. Phạm vi liên kết dự án &amp; công việc bàn giao</h4>
                    <div className="pl-4 space-y-2 mt-1">
                      <div className="flex items-center gap-1">
                        <strong>1.1. Công trình liên kết:</strong>
                        <input
                          type="text"
                          value={tempQuote.projectName || ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, projectName: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent flex-1 max-w-md"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <strong>1.2. Chủ đầu tư dự án:</strong>
                        <input
                          type="text"
                          value={tempQuote.customerName || ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, customerName: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent max-w-xs"
                        />
                        <span>- SĐT:</span>
                        <input
                          type="text"
                          value={tempQuote.customerPhone || ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, customerPhone: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent max-w-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <strong>1.3. Địa chỉ lắp đặt thi công:</strong>
                        <input
                          type="text"
                          value={tempQuote.customerAddress || ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, customerAddress: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:border-none print:p-0 print:bg-transparent flex-1 max-w-md"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <strong>1.4. Nội dung công việc giao thầu:</strong>
                        <input
                          type="text"
                          value={tempQuote.workName || ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, workName: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-bold text-blue-600 transition-all print:border-none print:p-0 print:bg-transparent flex-1 max-w-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase">Điều 2. Thời gian thực hiện</h4>
                    <div className="pl-4 space-y-2 mt-1">
                      <div className="flex items-center gap-2">
                        <span>• Ngày bắt đầu triển khai:</span>
                        <input
                          type="date"
                          value={tempQuote.startDate ? new Date(tempQuote.startDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, startDate: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:hidden"
                        />
                        <span className="hidden print:inline font-bold">
                          {tempQuote.startDate ? new Date(tempQuote.startDate).toLocaleDateString('vi-VN') : 'Đang cập nhật'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>• Ngày hoàn thiện bàn giao nghiệm thu:</span>
                        <input
                          type="date"
                          value={tempQuote.endDate ? new Date(tempQuote.endDate).toISOString().split('T')[0] : ''}
                          onChange={(e) => setTempQuote({ ...tempQuote, endDate: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-semibold text-slate-800 transition-all print:hidden"
                        />
                        <span className="hidden print:inline font-bold">
                          {tempQuote.endDate ? new Date(tempQuote.endDate).toLocaleDateString('vi-VN') : 'Đang cập nhật'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase">Điều 3. Giá trị hợp đồng &amp; Phương thức thanh toán</h4>
                    <div className="pl-4 space-y-2 mt-1">
                      <div className="flex items-center gap-1">
                        <span>• Giá trị hợp đồng khoán:</span>
                        <input
                          type="number"
                          value={tempQuote.contractValue || 0}
                          onChange={(e) => setTempQuote({ ...tempQuote, contractValue: Number(e.target.value) })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-bold text-emerald-600 transition-all w-28 print:hidden"
                        />
                        <span className="hidden print:inline font-black text-emerald-600">
                          {(tempQuote.contractValue || 0).toLocaleString('vi-VN')} VND
                        </span>
                        <span className="print:hidden text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-2">
                          👉 {(tempQuote.contractValue || 0).toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>• Trạng thái ký hợp đồng:</span>
                        <input
                          type="text"
                          value={tempQuote.signedLabel || (tempQuote.signedDate ? `Đã ký ngày ${new Date(tempQuote.signedDate).toLocaleDateString('vi-VN')}` : 'Chưa ký (Sẽ bổ sung ngày ký sau)')}
                          onChange={(e) => setTempQuote({ ...tempQuote, signedLabel: e.target.value })}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-bold text-slate-800 transition-colors print:border-none print:p-0 print:bg-transparent flex-1 max-w-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span>• Trạng thái thanh toán &amp; thi công:</span>
                        <input
                          type="text"
                          value={tempQuote.status || 'Đã Lập'}
                          onChange={(e) => setTempQuote({ ...tempQuote, status: e.target.value } as ArchivedQuote)}
                          className="bg-transparent border-b border-dashed border-slate-400 focus:border-blue-500 px-1 py-0.5 outline-none font-bold text-blue-600 transition-colors print:border-none print:p-0 print:bg-transparent max-w-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-900 uppercase">Điều 4. Thỏa ước phụ trợ &amp; Ghi chú kỹ thuật</h4>
                    <div className="pl-4 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 font-semibold print:border-none print:p-0 print:bg-transparent">
                      <textarea
                        value={tempQuote.notes || ''}
                        onChange={(e) => setTempQuote({ ...tempQuote, notes: e.target.value })}
                        rows={3}
                        className="w-full bg-transparent outline-none border border-slate-300 focus:border-blue-500 rounded p-1 text-slate-800 font-medium transition-all print:border-none print:p-0 print:resize-none print:outline-none"
                        placeholder="Nội dung thỏa ước phụ trợ hoặc ghi chú kỹ thuật bàn giao thầu..."
                      />
                    </div>
                  </div>
                </div>

                {/* Footer signatures */}
                <div className="grid grid-cols-2 text-center pt-8 gap-6 font-bold text-xs">
                  <div className="space-y-16">
                    <div>
                      <p className="uppercase text-slate-500">ĐẠI DIỆN BÊN A (GIAO THẦU)</p>
                      <p className="text-[10px] text-slate-400 font-medium">Ký, đóng dấu và ghi rõ họ tên</p>
                    </div>
                    <div className="text-slate-800">
                      <p>Nguyễn Văn Hoàng</p>
                      <p className="text-[10px] text-slate-400 font-normal">Giám đốc Hoàng Long Lâm Đồng</p>
                    </div>
                  </div>
                  <div className="space-y-16">
                    <div>
                      <p className="uppercase text-slate-500">ĐẠI DIỆN BÊN B (NHẬN THẦU PHỤ)</p>
                      <p className="text-[10px] text-slate-400 font-medium">Ký và ghi rõ họ tên</p>
                    </div>
                    <div className="text-slate-800">
                      <p>{tempQuote.representative || selectedSupplier?.representative || 'Chưa ký'}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{tempQuote.subcontractorName || 'Tổ thợ thầu phụ'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
              <span className="text-[10px] text-slate-500 italic">
                💡 Tip: Click directly on fields with dashed lines to edit the contract directly on printout.
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuote(null);
                    setTempQuote(null);
                    setShowPrintPreview(false);
                  }}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Hợp Đồng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
