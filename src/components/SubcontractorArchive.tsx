import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { dbService } from '../lib/dbService';
import { Employee, ArchivedQuote, Supplier } from '../types';
import { FileText, Search, Printer, Trash2, Eye, Calendar, User, Briefcase, ChevronRight, ShieldCheck, Info, CheckCircle2, FileCheck, Save, XCircle, FileDown } from 'lucide-react';
import { useNotification, isUserInRoleGroup } from '../context';
import RichTextEditor from './RichTextEditor';
import { exportHtmlToWord } from '../lib/wordExport';

// Bản in Hợp Đồng Thầu Phụ — trước đây là các ô <input> cố định bind trực tiếp
// vào tempQuote.<field>, nay chuyển sang 1 vùng văn bản tự do (contentEditable)
// giống ContractDocument/AcceptanceDocument/LiquidationDocument, để dùng chung
// toolbar căn chỉnh kiểu Word + xuất Word. Các placeholder {{...}} được thay
// bằng giá trị thật LÚC TẢI hồ sơ (xem generateSubcontractorContractHtml) —
// sau đó người dùng tự gõ/định dạng tự do trong vùng văn bản.
const DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE = `
<div style="text-align:center;">
  <h2 style="margin:0;font-weight:800;text-transform:uppercase;">Hợp Đồng Thầu Phụ Thi Công</h2>
  <p style="margin:2px 0;font-size:11px;color:#64748b;">Số hiệu: {{MA_HOP_DONG}}</p>
</div>

<p style="font-style:italic;color:#64748b;">- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ban hành ngày 24/11/2015;</p>
<p style="font-style:italic;color:#64748b;">- Căn cứ Luật Thương mại số 36/2005/QH11 ban hành ngày 14/06/2005;</p>
<p style="font-style:italic;color:#64748b;">- Căn cứ nhu cầu thi công thực tế và năng lực của các bên;</p>

<p><strong>Hôm nay, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}, tại trụ sở Công ty TNHH Hoàng Long Lâm Đồng, chúng tôi gồm:</strong></p>

<p><strong>Bên A (Bên giao thầu): <span style="color:#2563eb;">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</span></strong></p>
<ul>
  <li>Địa chỉ: Số 4 TDP Trung Vương, TT. Nam Ban, huyện Lâm Hà, tỉnh Lâm Đồng</li>
  <li>MST: 5801452655</li>
  <li>Đại diện: Ông Nguyễn Văn Hoàng - Chức vụ: Giám đốc</li>
  <li>Hotline liên hệ: 0966 545 959</li>
</ul>

<p><strong>Bên B (Bên nhận thầu phụ): <span style="color:#059669;">{{TEN_THAU_PHU}}</span></strong></p>
<ul>
  <li>Mã Thầu Phụ: {{MA_THAU_PHU}}</li>
  <li>Người đại diện: {{DAI_DIEN_THAU_PHU}}</li>
  <li>Điện thoại: {{DIEN_THOAI_THAU_PHU}}</li>
  <li>Địa chỉ: {{DIA_CHI_THAU_PHU}}</li>
  <li>MST/CCCD: {{MST_THAU_PHU}}</li>
</ul>

<p><strong>ĐIỀU 1. PHẠM VI LIÊN KẾT DỰ ÁN &amp; CÔNG VIỆC BÀN GIAO</strong></p>
<p>1.1. Công trình liên kết: {{CONG_TRINH}}</p>
<p>1.2. Chủ đầu tư dự án: {{CHU_DAU_TU}} - SĐT: {{SDT_CHU_DAU_TU}}</p>
<p>1.3. Địa chỉ lắp đặt thi công: {{DIA_CHI_THI_CONG}}</p>
<p>1.4. Nội dung công việc giao thầu: {{NOI_DUNG_CONG_VIEC}}</p>

<p><strong>ĐIỀU 2. THỜI GIAN THỰC HIỆN</strong></p>
<p>- Ngày bắt đầu triển khai: {{NGAY_BAT_DAU}}</p>
<p>- Ngày hoàn thiện bàn giao nghiệm thu: {{NGAY_HOAN_THIEN}}</p>

<p><strong>ĐIỀU 3. GIÁ TRỊ HỢP ĐỒNG &amp; PHƯƠNG THỨC THANH TOÁN</strong></p>
<p>- Giá trị hợp đồng khoán: <strong>{{GIA_TRI_HOP_DONG}}</strong></p>
<p>- Trạng thái ký hợp đồng: {{TRANG_THAI_KY}}</p>
<p>- Trạng thái thanh toán &amp; thi công: {{TRANG_THAI_THANH_TOAN}}</p>

<p><strong>ĐIỀU 4. THỎA ƯỚC PHỤ TRỢ &amp; GHI CHÚ KỸ THUẬT</strong></p>
<p>{{GHI_CHU}}</p>

<table style="width:100%;margin-top:40px;border:none;">
  <tr>
    <td style="width:50%;text-align:center;border:none;padding:0;">
      <p style="font-weight:bold;text-transform:uppercase;margin-bottom:64px;">ĐẠI DIỆN BÊN A (GIAO THẦU)<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">Ký, đóng dấu và ghi rõ họ tên</span></p>
      <p style="font-weight:bold;">Nguyễn Văn Hoàng<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">Giám đốc Hoàng Long Lâm Đồng</span></p>
    </td>
    <td style="width:50%;text-align:center;border:none;padding:0;">
      <p style="font-weight:bold;text-transform:uppercase;margin-bottom:64px;">ĐẠI DIỆN BÊN B (NHẬN THẦU PHỤ)<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">Ký và ghi rõ họ tên</span></p>
      <p style="font-weight:bold;">{{DAI_DIEN_B_KY}}<br/><span style="font-weight:normal;font-size:11px;color:#64748b;">{{TEN_THAU_PHU_KY}}</span></p>
    </td>
  </tr>
</table>
`;

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
  // Nội dung bản in tự do (contentEditable) — thay cho các ô input cố định trước
  // đây. isEditing: hồ sơ đã duyệt (tempQuote.isApproved) thì khóa, phải "Hủy
  // phê duyệt" mới sửa lại được (xem effect load bên dưới + toolbar Duyệt/Sửa).
  const [docHtml, setDocHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);

  // Load suppliers list from Supabase (bảng thầu phụ riêng)
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await dbService.accountingSubcontractors.list();
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
    // 'hl-archived-subcontractor-quotes-updated': tự bắn khi CHÍNH tab này lưu
    // (từ SubcontractorEstimator hoặc chính component này). 'hl-archived-quotes-updated':
    // App.tsx bắn định kỳ 5 phút cho bảng archived_quotes (nhóm "ít đổi") — tên
    // ĐÚNG để nhận biết hợp đồng do tab/người khác lập/duyệt, trước đây bị bỏ sót.
    window.addEventListener('hl-archived-subcontractor-quotes-updated', fetchArchives);
    window.addEventListener('hl-archived-quotes-updated', fetchArchives);
    return () => {
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', fetchArchives);
      window.removeEventListener('hl-archived-quotes-updated', fetchArchives);
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
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  };

  const selectedSupplier = suppliers.find(s => s.id === selectedQuote?.subcontractorId);

  // Thay {{PLACEHOLDER}} bằng giá trị thật từ hồ sơ — gọi 1 LẦN lúc mở/khôi phục
  // bản in (không gọi lại lúc gõ, khác các hàm generateProcessedHtml của 3 hồ sơ
  // kia vì file này không có sẵn "quoteData" tách biệt khỏi state đang sửa).
  const generateSubcontractorContractHtml = (q: ArchivedQuote, supplier?: Supplier): string => {
    let html = DEFAULT_SUBCONTRACTOR_CONTRACT_TEMPLATE;
    const day = q.day || (q.createdAt ? q.createdAt.split('/')[0] : '01');
    const month = q.month || (q.createdAt ? q.createdAt.split('/')[1] : '07');
    const year = q.year || (q.createdAt ? q.createdAt.split('/')[2] : '2026');
    const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : 'Đang cập nhật';
    const signedLabel = q.signedLabel || (q.signedDate ? `Đã ký ngày ${fmtDate(q.signedDate)}` : 'Chưa ký (Sẽ bổ sung ngày ký sau)');
    const replacements: Record<string, string> = {
      '{{MA_HOP_DONG}}': q.code || 'Chưa cập nhật',
      '{{NGAY}}': String(day), '{{THANG}}': String(month), '{{NAM}}': String(year),
      '{{TEN_THAU_PHU}}': q.subcontractorName || 'Chưa cập nhật',
      '{{MA_THAU_PHU}}': q.subcontractorId || 'N/A',
      '{{DAI_DIEN_THAU_PHU}}': q.representative !== undefined ? q.representative : (supplier?.representative || 'Chưa cập nhật'),
      '{{DIEN_THOAI_THAU_PHU}}': q.phone !== undefined ? q.phone : (supplier?.phone || 'Chưa cập nhật'),
      '{{DIA_CHI_THAU_PHU}}': q.address !== undefined ? q.address : (supplier?.address || 'Chưa cập nhật'),
      '{{MST_THAU_PHU}}': q.taxCode !== undefined ? q.taxCode : (supplier?.taxCode || 'Chưa cập nhật'),
      '{{CONG_TRINH}}': q.projectName || 'Chưa cập nhật',
      '{{CHU_DAU_TU}}': q.customerName || 'Chưa cập nhật',
      '{{SDT_CHU_DAU_TU}}': q.customerPhone || 'Chưa cập nhật',
      '{{DIA_CHI_THI_CONG}}': q.customerAddress || 'Chưa cập nhật',
      '{{NOI_DUNG_CONG_VIEC}}': q.workName || 'Chưa cập nhật',
      '{{NGAY_BAT_DAU}}': fmtDate(q.startDate),
      '{{NGAY_HOAN_THIEN}}': fmtDate(q.endDate),
      '{{GIA_TRI_HOP_DONG}}': `${(q.contractValue || 0).toLocaleString('vi-VN')} VND`,
      '{{TRANG_THAI_KY}}': signedLabel,
      '{{TRANG_THAI_THANH_TOAN}}': q.status || 'Đã Lập',
      '{{GHI_CHU}}': q.notes || 'Không có',
      '{{DAI_DIEN_B_KY}}': q.representative || supplier?.representative || 'Chưa ký',
      '{{TEN_THAU_PHU_KY}}': q.subcontractorName || 'Tổ thợ thầu phụ',
    };
    Object.entries(replacements).forEach(([placeholder, value]) => {
      html = html.split(placeholder).join(value);
    });
    return html;
  };

  // Nạp lại bản in mỗi khi mở 1 hồ sơ khác — ưu tiên contractHtml đã lưu tùy
  // chỉnh trước đó, nếu chưa có thì generate mới từ dữ liệu cấu trúc sẵn có
  // (áp dụng đúng cho cả hồ sơ CŨ trước khi có tính năng này — không mất dữ liệu).
  useEffect(() => {
    if (!showPrintPreview || !tempQuote) return;
    setDocHtml(tempQuote.contractHtml || generateSubcontractorContractHtml(tempQuote, selectedSupplier));
    setIsEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPrintPreview, tempQuote?.id]);

  const handleUnapproveSubcontractorContract = async () => {
    if (!tempQuote) return;
    if (!window.confirm('Hủy phê duyệt để chỉnh sửa lại Hợp Đồng Thầu Phụ?\nSau khi sửa xong cần Duyệt Hợp Đồng lại từ đầu.\nLưu ý: hợp đồng này sẽ tạm thời không còn tính vào Công Nợ Trả cho tới khi được duyệt lại.')) return;
    try {
      const updated = { ...tempQuote, isApproved: false } as ArchivedQuote;
      setTempQuote(updated);
      await dbService.archivedQuotes.save({ ...updated, sector: 'subcontractor' });
      setSelectedQuote(updated);
      setArchivedList(prev => prev.map(q => q.id === updated.id ? updated : q));
      addToast({ title: '🔓 Đã hủy phê duyệt', message: 'Hợp đồng đã được mở khóa để chỉnh sửa.', type: 'info' });
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
    } catch (err) {
      console.error('Lỗi khi hủy phê duyệt hợp đồng thầu phụ:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi hủy phê duyệt.', type: 'error' });
    }
  };

  const handleSaveSubcontractorDoc = async () => {
    if (!tempQuote) return;
    setSavingDoc(true);
    try {
      const updated = { ...tempQuote, contractHtml: docHtml };
      await dbService.archivedQuotes.save({ ...updated, sector: 'subcontractor' });
      setTempQuote(updated);
      setSelectedQuote(updated);
      setArchivedList(prev => prev.map(q => q.id === updated.id ? updated : q));
      setIsEditing(false);
      addToast({ title: '💾 Đã lưu', message: 'Đã lưu bản in hợp đồng thầu phụ thành công!', type: 'success' });
      window.dispatchEvent(new CustomEvent('hl-archived-subcontractor-quotes-updated'));
    } catch (err) {
      console.error('Lỗi khi lưu bản in hợp đồng thầu phụ:', err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi lưu.', type: 'error' });
    } finally {
      setSavingDoc(false);
    }
  };

  const handleExportSubcontractorWord = () => {
    if (!docHtml || !tempQuote) return;
    exportHtmlToWord(docHtml, `HopDongThauPhu_${tempQuote.code || tempQuote.id}`);
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 p-6 space-y-6 text-left" id="subcontractor_archive_workspace">
      <div>
        <h3 className="font-black text-lg text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <span className="p-1 px-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-xs">📝 CONTRACT ARCHIVE</span>
          Hồ Sơ Lưu Trữ Hợp Đồng Thầu Phụ
        </h3>
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
                          className="p-1.5 bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-100 transition shadow cursor-pointer"
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
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

      {/* PRINT PREVIEW MODAL — dùng React Portal render thẳng vào document.body, tách hoàn
          toàn khỏi cây component của ứng dụng để tránh lỗi in đè chữ ở các trang sau. */}
      {showPrintPreview && selectedQuote && tempQuote && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4 select-text text-left print-portal-backdrop">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl text-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 print-portal-card">
            {/* Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 print-hide">
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
                  #root {
                    display: none !important;
                  }
                  .print-portal-backdrop {
                    position: static !important;
                    display: block !important;
                    background: none !important;
                    padding: 0 !important;
                  }
                  .print-portal-card {
                    max-width: 100% !important;
                    max-height: none !important;
                    box-shadow: none !important;
                    border: none !important;
                    border-radius: 0 !important;
                    overflow: visible !important;
                  }
                  #print-area-archive {
                    max-height: none !important;
                    overflow: visible !important;
                    padding: 0 !important;
                  }
                  .print-hide {
                    display: none !important;
                  }
                  /* Chrome có lỗi phân trang với CSS Grid/Flex: khi 1 khối grid (VD: khối
                     ký tên 2 cột cuối văn bản) rơi đúng ranh giới giữa 2 trang, nội dung
                     bị vẽ đè/lặp lên trang sau. Ép về dạng khối xếp dọc (block) khi in để
                     tránh lỗi này — chấp nhận đánh đổi 2 cột xếp chồng thành 1 cột khi in. */
                  #print-area-archive .grid {
                    display: block !important;
                  }
                }
              `}</style>

              {/* Approval Watermark Stamp — chỉ hiện trên màn hình, KHÔNG in ra bản in/PDF */}
              {tempQuote.isApproved && (
                <div className="absolute top-20 right-10 md:right-16 transform rotate-12 border-4 border-emerald-500/40 text-emerald-500/50 font-extrabold uppercase px-4 py-2 rounded-lg text-xs tracking-widest font-sans flex items-center gap-1 bg-white/10 shadow-md pointer-events-none select-none z-50 print:hidden print-hide">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/50 animate-pulse" />
                  ĐÃ PHÊ DUYỆT
                </div>
              )}

              {/* Inline Action Buttons at Top (Hidden on Print) */}
              <div className="absolute top-6 right-6 flex items-center gap-2 print-hide no-print z-45">
                {tempQuote.isApproved ? (
                  <div className="flex items-center gap-1">
                    <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-bold font-sans flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Hợp Đồng Đã Duyệt
                    </span>
                    <button
                      onClick={handleUnapproveSubcontractorContract}
                      title="Hủy phê duyệt để mở khóa chỉnh sửa"
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Hủy phê duyệt
                    </button>
                  </div>
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

                {/* Hồ sơ đã duyệt: khóa nút "Chỉnh sửa" — phải Hủy phê duyệt ở trên mới sửa lại được. */}
                {tempQuote.isApproved ? (
                  <span className="px-2 text-[9px] text-slate-400 font-sans italic">🔒 Đã duyệt — hủy phê duyệt để sửa</span>
                ) : !isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Chỉnh sửa bản in
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-sm">
                    <span className="text-[9px] font-bold font-sans text-amber-400 px-1.5">🔓 ĐANG SỬA</span>
                    <button
                      onClick={handleSaveSubcontractorDoc}
                      disabled={savingDoc}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-all rounded-lg text-[10px] font-bold font-sans flex items-center gap-1 cursor-pointer"
                    >
                      {savingDoc ? 'Đang lưu...' : 'Lưu'}
                    </button>
                    <button
                      onClick={() => { setIsEditing(false); setDocHtml(tempQuote.contractHtml || generateSubcontractorContractHtml(tempQuote, selectedSupplier)); }}
                      disabled={savingDoc}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-slate-200 transition-all rounded-lg text-[10px] font-bold font-sans flex items-center gap-1 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}

                <button
                  onClick={handleExportSubcontractorWord}
                  title="Xuất file Word"
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5 text-blue-600" />
                  Xuất Word
                </button>
              </div>

              <div className="max-w-3xl mx-auto space-y-6 pt-4">
                {/* Giá trị hợp đồng — GIỮ dạng ô nhập số RIÊNG (không nằm trong vùng
                    văn bản tự do), vì Công Nợ Trả (Tài Chính) tính trực tiếp từ
                    field contractValue này (mergedLiabilities → sub.contractValue).
                    Nếu gộp vào bên trong bản in tự do, sửa số ở đó sẽ KHÔNG cập nhật
                    đúng Công Nợ Trả — xem ghi chú tương tự ở FinanceManagement.tsx. */}
                <div className="flex items-center gap-2 print-hide no-print bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">Giá trị hợp đồng khoán:</span>
                  <input
                    type="number"
                    disabled={tempQuote.isApproved || !isEditing}
                    value={tempQuote.contractValue || 0}
                    onChange={(e) => setTempQuote({ ...tempQuote, contractValue: Number(e.target.value) })}
                    className="bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:border-blue-500 font-bold text-emerald-600 disabled:opacity-60 disabled:bg-slate-100 w-40"
                  />
                  <span className="text-[10px] text-slate-400 italic">Đồng bộ trực tiếp với Công Nợ Trả</span>
                </div>

                {/* Header Title */}
                <div className="text-center space-y-1">
                  <h2 className="font-extrabold text-sm uppercase tracking-wide">CÔNG TY TNHH HOÀNG LONG LÂM ĐỒNG</h2>
                  <h3 className="font-bold text-xs uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h3>
                  <p className="text-xs font-bold">Độc lập – Tự do – Hạnh phúc</p>
                  <div className="border-b border-slate-300 w-36 mx-auto pt-1"></div>
                </div>

                {/* Nội dung hợp đồng — vùng văn bản tự do (contentEditable), thay cho
                    toàn bộ các ô input cố định phía trên trước đây. Toolbar căn
                    chỉnh kiểu Word chỉ hiện khi isEditing=true; khi chỉ xem/in,
                    toolbar tự ẩn (hideToolbarWhenDisabled) và nội dung không sửa
                    được (disabled) — khớp đúng khóa "đã duyệt thì không sửa được". */}
                <RichTextEditor
                  value={docHtml}
                  onChange={setDocHtml}
                  disabled={tempQuote.isApproved || !isEditing}
                  hideToolbarWhenDisabled
                  editorHeightClassName="min-h-[300px] max-h-none prose max-w-none text-left text-sm leading-relaxed"
                />
              </div>
            </div>

            {/* Print Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0 print-hide">
              <span className="text-[10px] text-slate-500 italic">
                💡 Bấm "Chỉnh sửa bản in" ở trên để soạn thảo tự do (căn chỉnh, giãn dòng, danh sách...).
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
        </div>,
        document.body
      )}
    </div>
  );
}
