import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../lib/dbService';
import { Employee, Quote, Project, ArchivedQuote, ProjectType } from '../types';
import { useNotification } from '../context';
import { isUserInRoleGroup } from '../context';

/** Map a quote sector to a project type */
function sectorToProjectType(sector?: string): ProjectType {
  if (sector === 'construction') return 'construction';
  if (sector === 'furniture') return 'furniture';
  if (sector === 'mechanical') return 'mechanical';
  return 'general';
}
import { 
  FileText, 
  Search, 
  Printer, 
  Trash2, 
  Layers, 
  Clock, 
  User, 
  Compass, 
  Eye, 
  Building2, 
  ChevronRight,
  Sparkles,
  ArrowLeft,
  AlertTriangle,
  Briefcase,
  Sliders,
  Plus
} from 'lucide-react';
import QuotationTableSheet from './QuotationTableSheet';
import DocumentTemplatesEditor from './DocumentTemplatesEditor';

interface QuoteArchiveProps {
  currentUser: Employee;
}

export default function QuoteArchive({ currentUser }: QuoteArchiveProps) {
  const { addToast } = useNotification();
  const [activeMainTab, setActiveMainTab] = useState<'dossiers' | 'templates'>('dossiers');
  const [archivedList, setArchivedList] = useState<ArchivedQuote[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sectorFilter, setSectorFilter] = useState<'all' | 'furniture' | 'construction' | 'mechanical'>('all');
  const [selectedQuote, setSelectedQuote] = useState<ArchivedQuote | null>(null);
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
                            `Dự án ${selectedQuote.customerName || 'vãng lai'} - Lập ${selectedQuote.sector === 'furniture' ? 'Nội thất gỗ' : selectedQuote.sector === 'construction' ? 'Xây dựng' : 'Cơ khí'}`;
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
      const generatedCode = `DA-${selectedQuote.sector === 'furniture' ? 'NT' : selectedQuote.sector === 'construction' ? 'XD' : 'CK'}-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 101)}`;

      const newProjPayload: Project = {
        id: generatedProjId,
        code: generatedCode,
        name: quickProjName.trim(),
        customerId: selectedQuote.customerId || `cust_${Date.now()}`,
        address: selectedQuote.customerAddress || 'Chưa cập nhật',
        type: sectorToProjectType(selectedQuote?.sector),
        contractValue: selectedQuote.totalAmount || 0,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // default 45 days
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

      // Link quote to this newly created project in archive
      const updatedQuote = { ...selectedQuote, projectId: generatedProjId };
      await dbService.archivedQuotes.save(updatedQuote);
      window.dispatchEvent(new CustomEvent('hl-archived-quotes-updated'));
      setSelectedQuote(updatedQuote);

      // Refresh files list
      const data = await dbService.archivedQuotes.list();
      setArchivedList(data);

      setShowQuickCreateProj(false);
    } catch (e) {
      console.error(e);
      addToast({ title: '❌ Lỗi', message: 'Lỗi khi tạo dự án nhanh.', type: 'error' });
    }
  };

  // Load archived quotes
  const fetchArchives = async () => {
    setLoading(true);
    try {
      const data = await dbService.archivedQuotes.list();
      setArchivedList(data);
      const projs = await dbService.projects.list();
      setProjectsList(projs);
    } catch (error) {
      console.error("Lỗi khi tải hồ sơ báo giá:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
    const handleArchivesUpdated = () => fetchArchives();
    window.addEventListener('hl-archived-quotes-updated', handleArchivesUpdated);
    window.addEventListener('hl-archived-subcontractor-quotes-updated', handleArchivesUpdated);
    return () => {
      window.removeEventListener('hl-archived-quotes-updated', handleArchivesUpdated);
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', handleArchivesUpdated);
    };
  }, []);

  // Filter archived quotes:
  // - Show only quotes created by the logged-in user
  // - Filter by search term (code, customer name)
  // - Filter by sector/domain
  const filteredList = useMemo(() => {
    return archivedList.filter(item => {
      // Allow privileged roles to view all, other users can only view what they created
      const isPrivileged = isUserInRoleGroup(currentUser.id, 'role_admin') || isUserInRoleGroup(currentUser.id, 'role_office') || isUserInRoleGroup(currentUser.id, 'role_technical');
      const isCreator = item.creatorId === currentUser.id || !item.creatorId;
      if (!isPrivileged && !isCreator) return false;

      // Filter by sector
      if (sectorFilter !== 'all' && item.sector !== sectorFilter) {
        return false;
      }

      // Filter by search text
      const matchesSearch = 
        (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.customerPhone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.projectName || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [archivedList, sectorFilter, searchTerm, currentUser]);

  const handleDeleteClick = (item: ArchivedQuote, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const getSectorLabel = (sector?: string) => {
    switch (sector) {
      case 'furniture': return { label: 'Nội Thất Gỗ', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'construction': return { label: 'Xây Dựng', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'mechanical': return { label: 'Cơ Khí Hàn', color: 'bg-pink-100 text-pink-800 border-pink-200' };
      default: return { label: 'Chưa phân loại', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl p-6 space-y-6 text-left" id="quote_archive_workspace">
      
      {/* Header section with instructions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="font-black text-xl text-slate-50 uppercase tracking-wider flex items-center gap-2">
            <span className="p-1 px-2.5 bg-emerald-500/10 text-[#00a651] rounded-lg border border-[#00a651]/20 text-sm">📁 ARCHIVE</span>
            Quản Lý Hồ Sơ Lưu Trữ
          </h3>
          <p className="text-[11px] text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
            Hệ thống tự động lưu vết toàn bộ hồ sơ thiết kế (bao gồm Báo giá, Hợp đồng, Nghiệm thu, và Thanh lý) khi người dùng thao tác <strong className="text-emerald-400">"Lưu & In"</strong> thiết kế báo giá liên quan.
          </p>
        </div>
        
        {/* User Badge Info */}
        <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-xs">
          <div className="w-7 h-7 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <span className="block font-bold text-slate-200">{currentUser.name}</span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest">{currentUser.department}</span>
          </div>
        </div>
      </div>

      {/* Mini Visual Sub-tabs of Archive Panel */}
      <div className="flex gap-2.5 border-b border-slate-800 pb-1">
        <button
          type="button"
          onClick={() => setActiveMainTab('dossiers')}
          className={`px-4.5 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${activeMainTab === 'dossiers' ? 'border-[#00a651] text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          📂 Danh Sách Hồ Sơ
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('templates')}
          className={`px-4.5 py-2 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 ${activeMainTab === 'templates' ? 'border-[#00a651] text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          ⚙️ Mẫu Hồ Sơ Thiết Kế
        </button>
      </div>

      {activeMainTab === 'templates' ? (
        <DocumentTemplatesEditor />
      ) : (
        <>
          {/* Filter and search bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800" id="archive_filters">
            
            {/* Search input */}
            <div className="md:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Tìm theo Mã hồ sơ, Tên khách hàng, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 rounded-lg text-xs outline-none focus:border-[#00a651] text-slate-100 placeholder-slate-500 transition-all font-medium"
              />
            </div>

        {/* Categories/Sectors tabs */}
        <div className="md:col-span-2 flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setSectorFilter('all')}
            className={`flex-1 py-1.5 px-2 rounded text-[10px] font-extrabold uppercase transition-all tracking-wider ${sectorFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Tất Cả
          </button>
          <button
            type="button"
            onClick={() => setSectorFilter('furniture')}
            className={`flex-1 py-1.5 px-2 rounded text-[10px] font-extrabold uppercase transition-all tracking-wider ${sectorFilter === 'furniture' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/10' : 'text-slate-400 hover:text-white'}`}
          >
            Nội Thất Gỗ
          </button>
          <button
            type="button"
            onClick={() => setSectorFilter('construction')}
            className={`flex-1 py-1.5 px-2 rounded text-[10px] font-extrabold uppercase transition-all tracking-wider ${sectorFilter === 'construction' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/10' : 'text-slate-400 hover:text-white'}`}
          >
            Xây Dựng
          </button>
          <button
            type="button"
            onClick={() => setSectorFilter('mechanical')}
            className={`flex-1 py-1.5 px-2 rounded text-[10px] font-extrabold uppercase transition-all tracking-wider ${sectorFilter === 'mechanical' ? 'bg-pink-600/20 text-pink-400 border border-pink-500/10' : 'text-slate-400 hover:text-white'}`}
          >
            Cơ Khí Hàn
          </button>
        </div>

      </div>

      {/* Main Grid/Table area */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 animate-pulse font-bold uppercase tracking-widest">
          Đang truy vấn kho hồ sơ lưu trữ cốt cán...
        </div>
      ) : filteredList.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 space-y-2">
          <FileText className="w-8 h-8 text-slate-600 mx-auto" />
          <h5 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider">Không tìm thấy hồ sơ nào</h5>
          <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
            Hồ sơ trống hoặc không khớp từ khóa lọc. Bấn "Lưu & In" tại bảng lập báo giá để khởi tạo bản ghi mới tự động.
          </p>
        </div>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950 shadow-inner">
          <table className="w-full text-slate-300 text-xs text-left">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <th className="px-4 py-3.5">Mã Hồ Sơ</th>
                <th className="px-4 py-3.5">Lĩnh vực</th>
                <th className="px-4 py-3.5">Khách Hàng</th>
                <th className="px-4 py-3.5">Dự Án Liên Kết</th>
                <th className="px-4 py-3.5">Ngày Lập</th>
                <th className="px-4 py-3.5 text-right">Tổng Tiền (Gồm VAT)</th>
                <th className="px-4 py-3.5 text-center">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredList.map((item) => {
                const badge = getSectorLabel(item.sector);
                const linkedProj = projectsList.find(p => p.id === item.projectId);
                
                // Calculate total including VAT (or fall back to totalAmount)
                const originalTotal = item.totalAmount || 0;
                const grandTotal = originalTotal * 1.08; // Include VAT just in case

                return (
                  <tr 
                    key={item.id}
                    onClick={() => setSelectedQuote(item)}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 font-bold font-mono text-[#00a651] uppercase">
                      {item.code || 'BÁO GIÁ LẺ'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <span className="font-semibold block text-slate-100">{item.customerName}</span>
                        <span className="text-[10px] text-slate-500">{item.customerPhone || 'Chưa có SĐT'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {linkedProj ? (
                        <div>
                          <span className="font-semibold block text-slate-100 line-clamp-1">{linkedProj.name}</span>
                          <span className="text-[10px] text-indigo-400 font-mono font-bold">{linkedProj.code}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px] italic">Tự do - Chưa liên kết</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-450 font-medium font-sans">
                      {item.createdAt || new Date(Number(item.id.replace('archived_quote_', ''))).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-100">
                      {(item.totalAmount || 0).toLocaleString('vi-VN')} đ
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex justify-center items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuote(item);
                          }}
                          className="p-1.5 bg-slate-900 text-slate-300 hover:text-white rounded border border-slate-800 hover:bg-slate-800 transition shadow cursor-pointer"
                          title="Xem Chi Tiết & In"
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )}

      {/* Document print dynamic window preview popup */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-fadeIn select-text text-left">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Header of Popup */}
            <div className="bg-slate-50 px-6 py-4.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-250">
                  <FileText className="w-4 h-4 text-[#00a651]" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Xem chi tiết hồ sơ lưu trữ
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">Hồ sơ lưu trữ chính thức - HOANG LONG ERP</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedQuote(null)}
                className="text-slate-400 hover:text-slate-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 w-7 h-7 rounded-full flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 md:p-6 bg-slate-100 max-h-[70vh] overflow-y-auto">
              <QuotationTableSheet quoteData={selectedQuote} />
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center gap-4">
              <div>
                {!projectsList.some(p => p.id === selectedQuote.projectId) ? (
                  <button
                    type="button"
                    onClick={() => setShowQuickCreateProj(true)}
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
                  onClick={() => {
                    window.print();
                  }}
                  className="px-5 py-2.5 bg-[#00a651] hover:bg-[#008f45] text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all hover:scale-[1.01]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Báo Giá
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* QUICK PROJECT CREATION MODAL */}
      {showQuickCreateProj && selectedQuote && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[220] p-4 text-left select-text font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 text-slate-100 shadow-2xl relative animate-scaleIn">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-base uppercase text-indigo-400 tracking-wide">
                  Tạo Dự Án Nhanh Từ Báo Giá
                </h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                  Khởi tạo Kanban Dự Án trong Phòng Dự Án
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-350 leading-relaxed mb-4 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              Hệ thống tự động liên kết tài liệu báo giá hiện tại vào thư viện hồ sơ của dự án mới. Quý khách chỉ cần đặt tên dự án và chọn cột Kanban mong muốn.
            </p>

            <div className="space-y-4">
              {/* Dự án (pre-populated) */}
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                  Tên Dự Án (Có Thể Chỉnh Sửa) <span className="text-rose-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={quickProjName}
                  onChange={(e) => setQuickProjName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-xs text-slate-100 focus:border-indigo-500 font-bold"
                  placeholder="Nhập tên dự án..."
                />
              </div>

              {/* Tên khách hàng (locked) */}
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                  Tên Khách Hàng (Tự động nạp)
                </label>
                <input
                  type="text"
                  value={selectedQuote.customerName || ''}
                  disabled={true}
                  className="w-full bg-slate-950/50 border border-slate-850 rounded-xl p-3 outline-none text-xs text-slate-400 font-medium cursor-not-allowed"
                />
              </div>

              {/* Số điện thoại / Địa chỉ (locked) */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="text"
                    value={selectedQuote.customerPhone || ''}
                    disabled={true}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-xl p-3 outline-none text-xs text-slate-400 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                    Địa Chỉ Thi Công
                  </label>
                  <input
                    type="text"
                    value={selectedQuote.customerAddress || ''}
                    disabled={true}
                    className="w-full bg-slate-950/50 border border-slate-850 rounded-xl p-3 outline-none text-xs text-slate-400 font-medium cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Chọn cột Kanban (Interactive dropdown selector) */}
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider text-[9px] mb-1">
                  Chọn vị trí cột Kanban <span className="text-rose-500 font-bold">*</span>
                </label>
                <select
                  value={quickProjKanbanColId}
                  onChange={(e) => setQuickProjKanbanColId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 outline-none text-xs text-slate-100 focus:border-indigo-500 font-bold cursor-pointer"
                >
                  <option value="col_design" className="font-bold">1. Yêu Cầu Thiết Kế (Khởi tạo mặc định)</option>
                  <option value="col_bid" className="font-bold">2. Đấu Thầu / Khảo Sát Thần Tốc</option>
                  <option value="col_waiting" className="font-bold">3. Chờ Kết Quả Phê Duyệt</option>
                  <option value="col_active" className="font-bold">4. Giai Đoạn Thi Công Thực Địa</option>
                  <option value="col_accept" className="font-bold">5. Nghiệm Thu & Bàn Giao</option>
                  <option value="col_fix" className="font-bold">6. Xử Lý - Khắc Phục Lỗi Kỹ Thuật</option>
                  <option value="col_done" className="font-bold">7. Hoàn Thành Ký Biên Bản</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 border-t border-slate-800/65 pt-3.5">
              <button
                type="button"
                onClick={() => setShowQuickCreateProj(false)}
                className="px-4.5 py-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleQuickCreateProject}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Khởi Tạo Dự Án
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WARNING CONFIRMATION MODAL BEFORE DELETE */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[120] p-4 text-left font-sans">
          <div className="bg-slate-900 border border-rose-500/35 rounded-2xl w-full max-w-md text-slate-200 shadow-2xl overflow-hidden animate-scaleIn">
            
            {/* Upper alert block */}
            <div className="bg-rose-950/20 px-6 py-5 border-b border-slate-800 flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30 text-rose-500 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-rose-400 uppercase tracking-widest">
                  Cảnh Báo Xóa Nghiêm Trọng
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Vui lòng đọc kỹ thông tin dưới đây trước khi thực hiện thao tác xóa vĩnh viễn.
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Mã hồ sơ cần xóa:</span>
                  <span className="text-slate-300 font-mono font-black">{deleteTarget.code || 'BÁO GIÁ LẺ'}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Khách hàng:</span>
                  <span className="text-slate-300 font-bold">{deleteTarget.customerName}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                  <span>Trị giá:</span>
                  <span className="text-slate-300 font-mono font-black text-rose-400">
                    {(deleteTarget.totalAmount || 0).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              </div>

              <div className="text-rose-300/90 text-xs border border-rose-500/20 bg-rose-500/5 p-3 rounded-lg leading-relaxed space-y-1 font-medium">
                <p className="font-bold flex items-center gap-1.5 text-rose-400 uppercase tracking-wider text-[10px]">
                  📌 HÀNH ĐỘNG PHÁ HỦY THÔNG TIN VĨNH VIỄN!
                </p>
                <p className="text-[11px]">
                  Cơ sở dữ liệu của hệ thống HOANG LONG ERP sẽ <strong className="text-white underline">xóa sạch toàn bộ dữ liệu lưu vết</strong> của báo giá này. Việc này không thể được hoàn tác hoặc khôi phục bằng bất kỳ phương thức nào.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-950/60 border-t border-slate-800 px-6 py-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Hủy thao tác
              </button>
              
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all shadow-lg shadow-rose-950/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xác Nhận Xóaa
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
