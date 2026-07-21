import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, Project, ArchivedQuote } from '../types';
import { useNotification } from '../context';
import { isUserInRoleGroup } from '../context';
import {
  FileText,
  Search,
  Printer,
  Trash2,
  Eye,
  Plus
} from 'lucide-react';
import QuotationTableSheet from './QuotationTableSheet';

interface MechanicalArchiveProps {
  currentUser: Employee;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function MechanicalArchive({ currentUser, canEdit = true, canDelete = true }: MechanicalArchiveProps) {
  const { addToast } = useNotification();
  const [archivedList, setArchivedList] = useState<ArchivedQuote[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedQuote, setSelectedQuote] = useState<ArchivedQuote | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'quote' | 'contract' | 'acceptance' | 'liquidation' | 'final_quote'>('quote');
  const [deleteTarget, setDeleteTarget] = useState<ArchivedQuote | null>(null);

  // States for Quick Project Creation from Quote detail
  const [showQuickCreateProj, setShowQuickCreateProj] = useState<boolean>(false);
  const [quickProjName, setQuickProjName] = useState<string>('');
  const [quickProjKanbanColId, setQuickProjKanbanColId] = useState<string>('col_design');

  const getKanbanColName = (colId: string) => {
    switch (colId) {
      case 'col_design': return 'Yêu Cầu Thiết Kế';
      case 'col_bid': return 'Đấu Thầu';
      case 'col_waiting': return 'Chờ Kết Quả';
      case 'col_active': return 'Giai Đoạn Thi Công';
      case 'col_accept': return 'Nghiệm Thu';
      case 'col_fix': return 'Xử Lý - Khắc Phục';
      case 'col_done': return 'Hoàn Thành';
      default: return 'Thiết kế mới';
    }
  };

  useEffect(() => {
    if (selectedQuote) {
      const candidateName = selectedQuote.projectName || 
                            (selectedQuote.projectId && !selectedQuote.projectId.startsWith('proj_') && !selectedQuote.projectId.startsWith('q_') ? selectedQuote.projectId : '') || 
                            `Dự án ${selectedQuote.customerName || 'vãng lai'} - Lập Cơ khí`;
      setQuickProjName(candidateName);
    }
  }, [selectedQuote]);

  const handleQuickCreateProject = async () => {
    if (!selectedQuote) return;
    if (!quickProjName.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên Dự Án!', type: 'warning' });
      return;
    }

    try {
      const generatedProjId = selectedQuote.projectId || `proj_${Date.now()}`;
      const generatedCode = `DA-CK-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 101)}`;

      const newProjPayload: Project = {
        id: generatedProjId,
        code: generatedCode,
        name: quickProjName.trim(),
        customerId: selectedQuote.customerId || `cust_${Date.now()}`,
        address: selectedQuote.customerAddress || 'Chưa cập nhật',
        type: 'mechanical',
        contractValue: selectedQuote.totalAmount || 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days default
        pmId: 'emp_3',
        status: 'new',
        progress: 0,
        kanbanColumnId: quickProjKanbanColId,
        involvedEmployeeIds: ['emp_3', 'emp_1'],
        baoGiaFile: {
          name: `${selectedQuote.code || 'BAO_GIA'}.pdf`,
          size: '1.2 MB',
          createdAt: new Date().toLocaleDateString('vi-VN'),
          totalAmount: selectedQuote.totalAmount || 0,
          discountPercent: selectedQuote.config?.discountPercent || 0,
          items: selectedQuote.items || []
        }
      };

      await dbService.projects.save(newProjPayload);

      const freshProjects = await dbService.projects.list();
      setProjectsList(freshProjects);

      window.dispatchEvent(new CustomEvent('hl-projects-updated'));

      addToast({ title: '✅ Thành công', message: `Khởi tạo dự án "${quickProjName}" thành công và đẩy vào cột Kanban "${getKanbanColName(quickProjKanbanColId)}"!`, type: 'success' });

      const updatedQuote = { ...selectedQuote, projectId: generatedProjId };
      await dbService.archivedQuotes.save({ ...updatedQuote, sector: 'mechanical' });
      window.dispatchEvent(new CustomEvent('hl-archived-mechanical-quotes-updated'));
      setSelectedQuote(updatedQuote);

      const data = await dbService.archivedQuotes.list('mechanical');
      setArchivedList(data);

      setShowQuickCreateProj(false);
    } catch (e) {
      console.error(e);
      addToast({ title: '❌ Lỗi', message: 'Lỗi khi tạo dự án nhanh.', type: 'error' });
    }
  };

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const data = await dbService.archivedQuotes.list('mechanical');
      setArchivedList(data);
      const projs = await dbService.projects.list();
      setProjectsList(projs);
    } catch (error) {
      console.error("Lỗi khi tải hồ sơ báo giá cơ khí:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
    const handleMechanicalUpdated = () => fetchArchives();
    window.addEventListener('hl-archived-mechanical-quotes-updated', handleMechanicalUpdated);
    window.addEventListener('hl-archived-quotes-updated', handleMechanicalUpdated);
    return () => {
      window.removeEventListener('hl-archived-mechanical-quotes-updated', handleMechanicalUpdated);
      window.removeEventListener('hl-archived-quotes-updated', handleMechanicalUpdated);
    };
  }, []);

  const filteredList = useMemo(() => {
    return archivedList.filter(item => {
      const isPrivileged = isUserInRoleGroup(currentUser.id, 'role_admin') || isUserInRoleGroup(currentUser.id, 'role_office') || isUserInRoleGroup(currentUser.id, 'role_technical');
      const isCreator = item.creatorId === currentUser.id || !item.creatorId;
      if (!isPrivileged && !isCreator) return false;

      const matchesSearch = 
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerPhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [archivedList, searchTerm, currentUser]);

  const groupedProjects = useMemo(() => {
    const groups: { [projectId: string]: { project: Project | { id: string } | null; quotes: ArchivedQuote[] } } = {};
    
    filteredList.forEach(quote => {
      const pId = quote.projectId || 'unlinked';
      const proj = projectsList.find(p => p.id === pId);
      
      if (!groups[pId]) {
        groups[pId] = {
          project: proj || (quote.projectId ? { id: quote.projectId, name: quote.projectName || 'Dự án không xác định', code: (quote as any).projectCode || 'DA-UNKNOWN' } : null),
          quotes: []
        };
      }
      groups[pId].quotes.push(quote);
    });
    
    return Object.values(groups);
  }, [filteredList, projectsList]);

  const handleDeleteClick = (item: ArchivedQuote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền XÓA hồ sơ báo giá.', type: 'error' });
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
    } catch (error) {
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi xóa hồ sơ.', type: 'error' });
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 space-y-6 text-left" id="mechanical_archive_workspace">
      <div>
        <h3 className="font-black text-lg text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <span className="p-1 px-2.5 bg-pink-500/10 text-pink-400 rounded-lg border border-pink-500/20 text-xs">⚙️ MECHANICAL ARCHIVE</span>
          Hồ Sơ Lưu Trữ Báo Giá Cơ Khí Hàn
        </h3>
        <p className="text-[11px] text-slate-400 mt-1 max-w-2xl">
          Lịch sử lưu vết các báo giá kết cấu thép hình SS400, bóc tách khối lượng que hàn, sơn tĩnh điện, gia công bản mã thầu CNC.
        </p>
      </div>

      <div className="flex gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Tìm theo Mã hồ sơ, Tên khách hàng, SĐT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 pl-10 pr-4 py-2.5 rounded-lg text-xs outline-none focus:border-pink-500 text-slate-100 placeholder-slate-500 font-medium"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500 animate-pulse font-bold uppercase tracking-wider">
          Đang tải dữ liệu hồ sơ cơ khí...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <h5 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Không tìm thấy hồ sơ nào</h5>
          <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
            Vui lòng nhấn "Lưu & In" tại bảng lập dự toán cơ khí để khởi tạo bản ghi mới tự động.
          </p>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
          <table className="w-full text-slate-300 text-xs text-left">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="px-4 py-3 text-center w-[50px]">STT</th>
                <th className="px-4 py-3">Mã Hồ Sơ</th>
                <th className="px-4 py-3">Loại Hồ Sơ</th>
                <th className="px-4 py-3">Khách Hàng</th>
                <th className="px-4 py-3">Chi Tiết Sản Phẩm Thép / Hàn</th>
                <th className="px-4 py-3 text-right">Tổng Khối Lượng</th>
                <th className="px-4 py-3">Ngày Lập</th>
                <th className="px-4 py-3 text-right">Tổng Tiền (Gồm VAT)</th>
                <th className="px-4 py-3 text-center">Trạng Thái Hồ Sơ</th>
                <th className="px-4 py-3 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {(() => {
                let globalIndex = 0;
                return groupedProjects.map((group, groupIdx) => {
                  const proj = group.project;
                  const quotes = group.quotes;

                  return (
                    <React.Fragment key={proj?.id || `unlinked-${groupIdx}`}>
                      {/* Project Header Row */}
                      <tr className="bg-slate-900/60 border-y border-slate-800/80">
                        <td colSpan={10} className="px-4 py-2 text-indigo-400 text-[11px] uppercase tracking-wider font-extrabold">
                          <div className="flex items-center gap-2">
                            <span>📁 Dự án:</span>
                            <span className="text-slate-100">{proj ? (proj as any).name : 'Vãng lai - Chưa liên kết'}</span>
                            {proj && <span className="px-1.5 py-0.5 text-[9px] bg-indigo-950 text-indigo-300 rounded border border-indigo-900/40 font-mono font-bold">{(proj as any).code}</span>}
                          </div>
                        </td>
                      </tr>

                      {quotes.map((item) => {
                        // Get summary of items
                        const itemSummary = Array.isArray(item.items)
                          ? item.items.map((it) => it.productName || (it as any).name || '').join(', ')
                          : 'Sản phẩm cơ khí chế tạo';

                        // Sum up weight if available
                        const totalWeight = Array.isArray(item.items)
                          ? item.items.reduce((sum: number, it) => sum + ((it as any).weightKg || it.qty || 0), 0)
                          : 0;

                        // 4 kinds of documents
                        const docs = [
                          {
                            type: 'quote' as const,
                            label: 'Báo Giá',
                            code: item.code || 'BÁO GIÁ LẺ',
                            color: 'text-indigo-400 bg-indigo-950/40 border-indigo-900/30',
                            statusLabel: item.isApproved ? 'Đã Duyệt' : 'Chờ Duyệt',
                            statusColor: item.isApproved 
                              ? 'bg-white text-emerald-600 border-emerald-500/30 shadow-sm' 
                              : 'bg-white text-amber-600 border-amber-500/30 shadow-sm'
                          },
                          {
                            type: 'contract' as const,
                            label: 'Hợp Đồng',
                            code: item.code ? 'HĐ-' + item.code.replace('BGCK-', '') : 'HỒ SƠ HỢP ĐỒNG',
                            color: 'text-sky-400 bg-sky-950/40 border-sky-900/30',
                            statusLabel: !item.isApproved
                              ? 'Chờ Duyệt'
                              : (!item.contractHtml ? 'Chưa Lập' : ((item as any).contractApproved ? 'Đã Duyệt' : 'Chờ Duyệt')),
                            statusColor: !item.isApproved
                              ? 'bg-white text-amber-600 border-amber-500/30 shadow-sm'
                              : (!item.contractHtml
                                ? 'bg-white text-slate-500 border-slate-300 shadow-sm'
                                : ((item as any).contractApproved ? 'bg-white text-emerald-600 border-emerald-500/30 shadow-sm' : 'bg-white text-amber-600 border-amber-500/30 shadow-sm'))
                          },
                          {
                            type: 'acceptance' as const,
                            label: 'Nghiệm Thu',
                            code: item.code ? 'NT-' + item.code.replace('BGCK-', '') : 'BIÊN BẢN NGHIỆM THU',
                            color: 'text-amber-400 bg-amber-950/40 border-amber-900/30',
                            statusLabel: !item.isApproved
                              ? 'Chờ Duyệt'
                              : (!item.acceptanceHtml ? 'Chưa Lập' : ((item as any).acceptanceApproved ? 'Đã Duyệt' : 'Chờ Duyệt')),
                            statusColor: !item.isApproved
                              ? 'bg-white text-amber-600 border-amber-500/30 shadow-sm'
                              : (!item.acceptanceHtml
                                ? 'bg-white text-slate-500 border-slate-300 shadow-sm'
                                : ((item as any).acceptanceApproved ? 'bg-white text-emerald-600 border-emerald-500/30 shadow-sm' : 'bg-white text-amber-600 border-amber-500/30 shadow-sm'))
                          },
                          {
                            type: 'liquidation' as const,
                            label: 'Thanh Lý',
                            code: item.code ? 'TL-' + item.code.replace('BGCK-', '') : 'BIÊN BẢN THANH LÝ',
                            color: 'text-purple-400 bg-purple-950/40 border-purple-900/30',
                            statusLabel: !item.isApproved
                              ? 'Chờ Duyệt'
                              : (!item.liquidationHtml ? 'Chưa Lập' : ((item as any).liquidationApproved ? 'Đã Duyệt' : 'Chờ Duyệt')),
                            statusColor: !item.isApproved
                              ? 'bg-white text-amber-600 border-amber-500/30 shadow-sm'
                              : (!item.liquidationHtml
                                ? 'bg-white text-slate-500 border-slate-300 shadow-sm'
                                : ((item as any).liquidationApproved ? 'bg-white text-emerald-600 border-emerald-500/30 shadow-sm' : 'bg-white text-amber-600 border-amber-500/30 shadow-sm'))
                          }
                        ];

                        return docs.map((doc) => {
                          globalIndex++;
                          return (
                            <tr 
                              key={`${item.id}-${doc.type}`}
                              onClick={() => {
                                setSelectedQuote(item);
                                setActiveDetailTab(doc.type);
                              }}
                              className="hover:bg-slate-900/40 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3 text-center font-mono text-slate-500 font-bold border-r border-slate-900">
                                {globalIndex}
                              </td>
                              <td className="px-4 py-3 font-bold font-mono text-pink-500 uppercase">
                                {doc.code}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${doc.color}`}>
                                  {doc.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <span className="font-semibold block text-slate-100">{item.customerName}</span>
                                  <span className="text-[10px] text-slate-500">{item.customerPhone || 'Chưa có SĐT'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 max-w-[200px] truncate text-[11px] text-slate-400" title={itemSummary}>
                                {itemSummary}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold text-pink-400">
                                {totalWeight > 0 ? `${totalWeight.toLocaleString('vi-VN')} kg` : 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-slate-450 font-medium">
                                {item.createdAt || 'Vừa xong'}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
                                {(item.totalAmount || 0).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${doc.statusColor}`}>
                                  {doc.statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-center items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedQuote(item);
                                      setActiveDetailTab(doc.type);
                                    }}
                                    className="p-1.5 bg-slate-900 text-slate-300 hover:text-white rounded border border-slate-800 hover:bg-slate-800 transition shadow cursor-pointer"
                                    title={`Xem ${doc.label}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteClick(item, e)}
                                    className="p-1.5 bg-rose-950/20 text-rose-400 hover:text-rose-300 rounded border border-rose-950/30 hover:bg-rose-950/40 transition shadow cursor-pointer"
                                    title="Xóa Lưu Trữ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })}
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h4 className="text-sm font-extrabold uppercase text-rose-500">Xác Nhận Xóa Hồ Sơ</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa hồ sơ báo giá <strong className="text-white">{deleteTarget.code}</strong> khỏi hệ thống lưu trữ báo giá Cơ Khí? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail & Print Popup */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fadeIn select-text text-left">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-50 flex items-center justify-center border border-pink-250">
                  <FileText className="w-4 h-4 text-pink-600" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Hồ sơ lưu trữ cơ khí hàn
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">Báo giá gia công & thiết kế cơ khí hoàn chỉnh</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedQuote(null)}
                className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 bg-slate-100 max-h-[70vh] overflow-y-auto">
              <QuotationTableSheet quoteData={selectedQuote} initialTab={activeDetailTab} />
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center gap-4">
              <div>
                {!projectsList.some(p => p.id === selectedQuote.projectId) ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canEdit) {
                        addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền LIÊN KẾT/TẠO DỰ ÁN từ báo giá.', type: 'error' });
                        return;
                      }
                      setShowQuickCreateProj(true);
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Tạo Dự Án Nhanh
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1">
                    ✓ Dự án đã liên kết trong Phòng Dự Án
                  </span>
                )}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedQuote(null)}
                  className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Báo Giá
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Create Project Drawer/Modal */}
      {showQuickCreateProj && selectedQuote && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[130] p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-left space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h4 className="text-sm font-extrabold uppercase text-indigo-400">Khởi Tạo Dự Án Nhanh</h4>
              <button 
                onClick={() => setShowQuickCreateProj(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tên Dự Án Cơ Khí</label>
                <input
                  type="text"
                  value={quickProjName}
                  onChange={(e) => setQuickProjName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cột Kanban Chuyển Tới</label>
                <select
                  value={quickProjKanbanColId}
                  onChange={(e) => setQuickProjKanbanColId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                >
                  <option value="col_design">Yêu Cầu Thiết Kế</option>
                  <option value="col_bid">Đấu Thầu</option>
                  <option value="col_waiting">Chờ Kết Quả</option>
                  <option value="col_active">Giai Đoạn Thi Công</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowQuickCreateProj(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleQuickCreateProject}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg"
              >
                Khởi tạo ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
