import React, { useState } from 'react';
import { isUserInRoleGroup } from '../context';
import {
   Project,
   Employee,
   ProjectDoc,
   Customer,
   ProjectDocCustomField,
   Supplier,
   InventoryItem
} from '../types';
import { dbService } from '../lib/dbService';
import { 
  Boxes, 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  User, 
  ChevronRight, 
  Check, 
  X, 
  Layers, 
  Plus, 
  Trash2, 
  FileText, 
  Printer, 
  UserCheck, 
  TrendingUp, 
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Info,
  Share2,
  Download,
  ExternalLink,
  Copy
} from 'lucide-react';

interface MaterialCoordinationProps {
  projects: Project[];
  employees: Employee[];
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onUpdateMultipleProjects?: (updatedProjectsList: Project[]) => Promise<void>;
  currentUser?: Employee;
  customers?: Customer[];
}

export default function MaterialCoordination({
  projects,
  employees,
  onUpdateProject,
  onUpdateMultipleProjects,
  currentUser,
  customers
}: MaterialCoordinationProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [coordTypeFilter, setCoordTypeFilter] = useState<string>('all');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Custom dialog states to replace window.confirm and window.alert in iframe environments
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const [customAlert, setCustomAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'warning' | 'info';
  } | null>(null);

  // Print & share preview state
  const [printPreviewDoc, setPrintPreviewDoc] = useState<{ project: Project; doc: any } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const showNotification = (message: string, title: string = 'Thông báo', type: 'success' | 'warning' | 'info' = 'success') => {
    setCustomAlert({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const askConfirmation = (message: string, title: string, onConfirm: () => void, confirmText: string = 'Xác nhận', cancelText: string = 'Hủy bỏ') => {
    setCustomConfirm({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setCustomConfirm(null);
      },
      confirmText,
      cancelText
    });
  };

  // Form states for editing/viewing details
  const [editMaterials, setEditMaterials] = useState<{ id: string; name: string; qty: number; unit: string; spec: string; note?: string; supplierId?: string; supplierName?: string; price?: number; totalPrice?: number }[]>([]);
  const [editCoordType, setEditCoordType] = useState<'self' | 'assign'>('self');
  const [editCoordinatorId, setEditCoordinatorId] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Tải từ Supabase khi mount
  React.useEffect(() => {
    dbService.suppliers.list().then(list => setSuppliers(list)).catch(() => {});
    dbService.inventory.list().then(list => setInventory(list)).catch(() => {});
  }, []);

  React.useEffect(() => {
    const handleSuppliersUpdated = () => {
      dbService.suppliers.list().then(list => setSuppliers(list)).catch(() => {});
    };
    const handleInventoryUpdated = () => {
      dbService.inventory.list().then(list => setInventory(list)).catch(() => {});
    };
    window.addEventListener('hl-suppliers-updated', handleSuppliersUpdated);
    window.addEventListener('hl-inventory-updated', handleInventoryUpdated);
    return () => {
      window.removeEventListener('hl-suppliers-updated', handleSuppliersUpdated);
      window.removeEventListener('hl-inventory-updated', handleInventoryUpdated);
    };
  }, []);

  // Helper to detect if a document is a Material Coordination document
  const isMaterialDoc = (d: any) => {
    if (!d) return false;
    const codeLower = d.code?.toLowerCase() || '';
    const idLower = d.id?.toLowerCase() || '';
    return (
      codeLower.includes('mat-') ||
      idLower.includes('doc_mat_') ||
      (d.materials && Array.isArray(d.materials)) ||
      d.templateName === 'Bản thô đặt sản xuất phôi Hoàng Long'
    );
  };

  // Extract all Material Documents across all projects
  const materialDocs: { project: Project; doc: any }[] = [];
  projects.forEach(p => {
    if (p.documents) {
      p.documents.forEach((d: any) => {
        if (isMaterialDoc(d)) {
          // Rule 1: If coordinationType is 'self' or empty, only the creator (d.creatorId) sees/approves.
          // Rule 2: If coordinationType is 'assign', only the selected coordinator (d.coordinatorId) sees/approves.
          // Fallback: If currentUser is null/undefined, or is admin (role_admin), accountant (role_accounting), pm, purchasing, or warehouse, allow viewing/coordinating everything.
          const isAssign = d.coordinationType === 'assign';
          const isManagerOrAdmin = !currentUser ||
                                   isUserInRoleGroup(currentUser.id, 'role_admin') ||
                                   isUserInRoleGroup(currentUser.id, 'role_accounting') ||
                                   isUserInRoleGroup(currentUser.id, 'role_office') ||
                                   isUserInRoleGroup(currentUser.id, 'role_technical') ||
                                   currentUser.username === 'admin';

          const allowedUser = isManagerOrAdmin || (
            isAssign
              ? (!d.coordinatorId || d.coordinatorId === currentUser?.id)
              : (!d.creatorId || d.creatorId === currentUser?.id)
          );

          if (allowedUser) {
            materialDocs.push({
              project: p,
              doc: d
            });
          }
        }
      });
    }
  });

  // Filter lists
  const filteredDocs = materialDocs.filter(item => {
    const docName = item.doc.name?.toLowerCase() || '';
    const docCode = item.doc.code?.toLowerCase() || '';
    const projName = item.project.name?.toLowerCase() || '';
    const projCode = item.project.code?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();

    const matchesSearch = docName.includes(search) || 
                          docCode.includes(search) || 
                          projName.includes(search) || 
                          projCode.includes(search);

    const matchesStatus = statusFilter === 'all' || item.doc.status === statusFilter;
    
    // Coordination type filter
    const coordinationType = item.doc.coordinationType || 'self';
    const matchesCoord = coordTypeFilter === 'all' || coordinationType === coordTypeFilter;

    return matchesSearch && matchesStatus && matchesCoord;
  });

  // Calculate statistics
  const totalCount = materialDocs.length;
  const draftCount = materialDocs.filter(item => item.doc.status === 'draft').length;
  const approvedCount = materialDocs.filter(item => item.doc.status === 'approved').length;
  const activeCount = materialDocs.filter(item => item.doc.status === 'active').length;
  const rejectedCount = materialDocs.filter(item => item.doc.status === 'rejected').length;

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    const found = materialDocs.find(item => item.doc.id === docId);
    if (found) {
      setEditMaterials(found.doc.materials ? [...found.doc.materials] : []);
      setEditCoordType(found.doc.coordinationType || 'self');
      setEditCoordinatorId(found.doc.coordinatorId || '');
      setIsEditing(false);
    }
  };

  const handleClearAllMaterialDocs = () => {
    askConfirmation(
      "⚠️ Hành động này sẽ XÓA VĨNH VIỄN toàn bộ danh sách Đề xuất điều phối vật tư của tất cả các dự án trên hệ thống!\n\nBạn có thực sự muốn tiếp tục dọn dẹp dữ liệu kiểm thử không?",
      "CẢNH BÁO QUAN TRỌNG",
      () => {
        setTimeout(() => {
          askConfirmation(
            "‼️ Dữ liệu sau khi xóa sẽ KHÔNG THỂ KHÔI PHỤC. Bạn chắc chắn muốn xóa sạch dữ liệu đề xuất vật tư chứ?",
            "XÁC NHẬN LẦN CUỐI",
            async () => {
              const nextProjects = projects.map(p => {
                const remainingDocs = (p.documents || []).filter((d: any) => !isMaterialDoc(d));
                return {
                  ...p,
                  documents: remainingDocs
                };
              });

              if (onUpdateMultipleProjects) {
                await onUpdateMultipleProjects(nextProjects);
              } else {
                for (const p of nextProjects) {
                  const orig = projects.find(o => o.id === p.id);
                  if (orig && JSON.stringify(orig.documents) !== JSON.stringify(p.documents)) {
                    onUpdateProject(p.id, { documents: p.documents });
                  }
                }
              }

              setSelectedDocId(null);
              showNotification("Đã dọn dẹp sạch toàn bộ dữ liệu Đề xuất điều phối vật tư!", "Thành công", "success");
            },
            "Xóa sạch vĩnh viễn",
            "Hủy bỏ"
          );
        }, 200);
      },
      "Tiếp tục",
      "Hủy bỏ"
    );
  };

  const handleSaveDocChanges = () => {
    if (!selectedDocId) return;
    const found = materialDocs.find(item => item.doc.id === selectedDocId);
    if (!found) return;

    const coordinatorName = editCoordType === 'assign'
      ? (employees.find(e => e.id === editCoordinatorId)?.name || 'Người điều phối')
      : 'Tự điều phối';

    // Build the updated document
    const updatedDocs = (found.project.documents || []).map((doc: any) => {
      if (doc.id === selectedDocId) {
        return {
          ...doc,
          materials: editMaterials,
          coordinationType: editCoordType,
          coordinatorId: editCoordinatorId,
          coordinatorName: coordinatorName,
          name: `Đề xuất cấp vật tư thô: ${editMaterials.length} chủng loại mọc gỗ (${coordinatorName})`
        };
      }
      return doc;
    });

    onUpdateProject(found.project.id, { documents: updatedDocs });
    setIsEditing(false);
    showNotification('Cập nhật thông tin điều phối vật tư thành công!', 'Thành công', 'success');
  };

  const handleUpdateStatus = async (docId: string, newStatus: 'draft' | 'active' | 'approved' | 'archived' | 'rejected') => {
    const found = materialDocs.find(item => item.doc.id === docId);
    if (!found) return;

    let notificationMsg = '';
    let hasAlertedForApproved = false;

    // Automated warehouse deduction & Supplier debt accumulation when moving to 'approved' (ĐÃ NHẬN HÀNG)
    if (newStatus === 'approved') {
      const isSupplier = found.doc.proposalType === 'supplier' ||
                         !!found.doc.supplierId ||
                         found.doc.templateName?.includes('nhà cung cấp') ||
                         found.doc.templateName?.includes('NCC');

      if (!isSupplier) {
        // CASE A: Đề xuất vật tư trong kho — load từ Supabase
        const currentInv: any[] = await dbService.inventory.list();
        const docMaterials = found.doc.materials || [];
        let stockUpdatedCount = 0;
        const addedLogs: any[] = [];

        for (const m of docMaterials) {
          const matchedStock = currentInv.find(
            (i: any) => i.code?.toLowerCase() === m.name?.toLowerCase() || i.name?.toLowerCase() === m.name?.toLowerCase()
          );
          if (matchedStock) {
            matchedStock.qty = Math.max(0, matchedStock.qty - (m.qty || 0));
            stockUpdatedCount++;

            addedLogs.push({
              id: `log_auto_${Date.now()}_${Math.random()}`,
              time: new Date().toISOString(),
              type: 'out',
              matName: matchedStock.name,
              qty: m.qty,
              target: `Dự án ${found.project.name || 'Nội bộ'} (Phiếu ${found.doc.code || 'DXVT'})`,
              note: `Xuất kho hoàn tất đề xuất cấp vật tư`
            });

            // Lưu từng vật tư đã trừ kho lên Supabase
            await dbService.inventory.save(matchedStock).catch(() => {});
          }
        }

        // Lưu toàn bộ log xuất kho lên Supabase
        for (const log of addedLogs) {
          await dbService.warehouseLogs.save(log).catch(() => {});
        }

        if (stockUpdatedCount > 0) {
          // Trigger realtime listeners
          window.dispatchEvent(new CustomEvent('hl-inventory-updated'));
          window.dispatchEvent(new CustomEvent('hl-warehouse-logs-updated'));
        }

        notificationMsg = `Đã hoàn tất nhận hàng từ Kho và chuyển thành ĐÃ NHẬN HÀNG!\n- Đã cập nhật trừ kho ${stockUpdatedCount} mặt hàng.`;
        hasAlertedForApproved = true;
      } else {
        // CASE B: Đề xuất vật tư từ nhà cung cấp — load từ Supabase
        const supplierIdToUse = found.doc.supplierId || 'SUP_001';
        const currentSups: any[] = await dbService.suppliers.list();
        const docMaterials = found.doc.materials || [];
        let debtUpdatedTotal = 0;

        const matchedSup = currentSups.find((s: any) => s.id === supplierIdToUse || s.name === found.doc.supplierName);
        if (matchedSup) {
          docMaterials.forEach((m: any) => {
            const totalCost = (m.qty || 0) * (m.price || 150000);
            debtUpdatedTotal += totalCost;
          });
          matchedSup.debt = (matchedSup.debt || 0) + debtUpdatedTotal;

          // Lưu công nợ nhà cung cấp lên Supabase
          await dbService.suppliers.save(matchedSup).catch(() => {});
          window.dispatchEvent(new CustomEvent('hl-suppliers-updated'));
          notificationMsg = `Đã hoàn tất nhận hàng từ Nhà cung cấp ${matchedSup.name} và chuyển thành ĐÃ NHẬN HÀNG!\n- Đã cập nhật tăng công nợ nhà cung cấp: +${debtUpdatedTotal.toLocaleString('vi-VN')} đ.`;
        } else {
          notificationMsg = `Đã hoàn tất nhận hàng và chuyển thành ĐÃ NHẬN HÀNG!\n(Không tìm thấy nhà cung cấp khớp mã trong danh mục công nợ)`;
        }
        hasAlertedForApproved = true;
      }
    }

    const updatedDocs = (found.project.documents || []).map((doc: any) => {
      if (doc.id === docId) {
        return {
          ...doc,
          status: newStatus
        };
      }
      return doc;
    });

    onUpdateProject(found.project.id, { documents: updatedDocs });
    
    if (hasAlertedForApproved) {
      showNotification(notificationMsg, 'Hoàn tất quy trình cung ứng', 'success');
    } else {
      showNotification(`Đã chuyển trạng thái đề xuất thành: ${
        newStatus === 'draft' ? 'CHỜ NCC / KHO' : 
        newStatus === 'active' ? 'ĐÃ XUẤT KHO' : 
        newStatus === 'approved' ? 'ĐÃ NHẬN HÀNG' : 'Lưu trữ'
      }`, 'Cập nhật trạng thái', 'success');
    }
  };

  const handleDeleteDoc = (docId: string) => {
    const found = materialDocs.find(item => item.doc.id === docId);
    if (!found) return;

    askConfirmation(
      "⚠️ Bạn có chắc chắn muốn XÓA vĩnh viễn đề xuất điều phối vật tư này không? Hành động này sẽ không thể hoàn tác.",
      "Xác nhận xóa vĩnh viễn",
      () => {
        const updatedDocs = (found.project.documents || []).filter((doc: any) => doc.id !== docId);

        onUpdateProject(found.project.id, { documents: updatedDocs });
        setSelectedDocId(null);
        setIsEditing(false);
        showNotification('Đã xóa đề xuất điều phối vật tư thành công!', 'Xóa thành công', 'success');
      },
      "Xóa vĩnh viễn",
      "Hủy bỏ"
    );
  };

  const handleAddMaterialRow = () => {
    const newRow = {
      id: `mat_${Date.now()}`,
      name: '',
      qty: 1,
      unit: 'Tấm',
      spec: ''
    };
    setEditMaterials([...editMaterials, newRow]);
  };

  const handleRemoveMaterialRow = (id: string) => {
    setEditMaterials(editMaterials.filter(m => m.id !== id));
  };

  // Find currently selected detail item
  const activeDetail = materialDocs.find(item => item.doc.id === selectedDocId);

  const columns = [
    {
      id: 'draft',
      title: 'CHỜ NCC / KHO',
      color: 'amber',
      borderColor: 'border-amber-200/80',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      icon: Clock,
    },
    {
      id: 'active',
      title: 'ĐÃ XUẤT KHO',
      color: 'sky',
      borderColor: 'border-sky-200/80',
      bgColor: 'bg-sky-50',
      textColor: 'text-sky-700',
      icon: TrendingUp,
    },
    {
      id: 'approved',
      title: 'ĐÃ NHẬN HÀNG',
      color: 'emerald',
      borderColor: 'border-emerald-200/80',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      icon: CheckCircle,
    }
  ];

  return (
    <>
      <div className="space-y-6 animate-fadeIn font-sans pb-12 text-slate-700 print:hidden">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <Boxes className="w-5 h-5 animate-pulse" />
            </span>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
              Điều Phối Cung Ứng Vật Tư & Vân Gỗ
            </h1>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            Phê duyệt liên thông nhu cầu ván dán gỗ công nghiệp, phụ kiện xưởng mộc từ phòng Kế Toán
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-[10.5px] font-mono bg-white border border-slate-200 rounded-lg p-2.5 text-slate-600 flex flex-col items-end">
            <span>Phiên điều phối: <strong className="text-amber-600">ACTIVE</strong></span>
            <span>Tài khoản kiểm duyệt: <strong className="text-slate-800">{currentUser?.name || 'Kế Toán'}</strong></span>
          </div>
        </div>
      </div>



      {/* FILTER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo mã dự án, tên công trình, vật tư..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white transition-all font-sans"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer focus:border-slate-400 font-sans"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">CHỜ NCC / KHO</option>
            <option value="active">ĐÃ XUẤT KHO</option>
            <option value="approved">ĐÃ NHẬN HÀNG</option>
            <option value="rejected">Từ chối</option>
            <option value="archived">Lưu trữ</option>
          </select>
        </div>

        {/* Coordination Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Hình thức:</span>
          <select
            value={coordTypeFilter}
            onChange={(e) => setCoordTypeFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 outline-none cursor-pointer focus:border-slate-400 font-sans"
          >
            <option value="all">Tất cả hình thức</option>
            <option value="self">Tự điều phối</option>
            <option value="assign">Người điều phối chỉ định</option>
          </select>
        </div>
      </div>

      {/* MAIN KANBAN BOARD - ALWAYS FULL WIDTH */}
      <div className="w-full">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map(col => {
              const colDocs = filteredDocs.filter(item => {
                const docStatus = item.doc.status || 'draft';
                return docStatus === col.id;
              });

              return (
                <div
                  key={col.id}
                  className={`flex flex-col h-[680px] rounded-3xl bg-white/50 border ${col.borderColor} overflow-hidden shadow-2xl relative transition-all duration-300 hover:shadow-xl hover:shadow-slate-100`}
                >
                  {/* Column Header */}
                  <div className={`p-4 border-b border-slate-200/80 flex items-center justify-between ${col.bgColor}`}>
                    <div className="flex items-center gap-2">
                      <col.icon className={`w-4.5 h-4.5 ${col.textColor}`} />
                      <h3 className="font-extrabold text-[12.5px] uppercase tracking-wider text-slate-900">{col.title}</h3>
                    </div>
                    <span className={`text-[11px] font-mono font-black px-2.5 py-0.5 rounded-full ${col.textColor} bg-white/80 border border-slate-200/80`}>
                      {colDocs.length}
                    </span>
                  </div>

                  {/* Column Cards Container */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar">
                    {colDocs.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                        <Boxes className="w-10 h-10 opacity-15 mb-3 text-slate-600" />
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Trống</p>
                        <p className="text-[10px] text-slate-600 mt-1 max-w-[150px]">Không có đề xuất nào ở trạng thái này</p>
                      </div>
                    ) : (
                      colDocs.map(item => {
                        const dateStr = item.doc.createdAt || 'N/A';
                        const materialsCount = item.doc.materials?.length || 0;
                        const isSelected = selectedDocId === item.doc.id;

                        // Type identification for display
                        const isSupDoc = item.doc.proposalType === 'supplier' || 
                                         !!item.doc.supplierId || 
                                         item.doc.templateName?.includes('nhà cung cấp') || 
                                         item.doc.templateName?.includes('NCC');

                        return (
                          <div
                            key={item.doc.id}
                            onClick={() => handleSelectDoc(item.doc.id)}
                            className={`border rounded-xl p-2 cursor-pointer transition-all duration-200 space-y-1.5 relative group overflow-hidden ${
                              isSelected 
                                ? 'bg-white border-amber-500/60 shadow-md ring-1 ring-amber-500/20' 
                                : 'bg-slate-950/60 border-slate-850 hover:border-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {/* Header card details: Source in top-left, Materials count in top-right */}
                            <div className="flex items-center justify-between text-[9px]">
                              {isSupDoc ? (
                                <span className="font-mono text-teal-400 font-extrabold bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-900/30 truncate max-w-[130px]" title={item.doc.supplierName || 'Nhà cung cấp'}>
                                  ✈️ {item.doc.supplierName || 'NCC'}
                                </span>
                              ) : (
                                <span className="font-mono text-amber-400 font-extrabold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-900/30">
                                  🏢 Tồn Kho
                                </span>
                              )}
                              <span className="font-mono font-black text-amber-400 text-[9px] bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/20">
                                📦 {materialsCount} VT
                              </span>
                            </div>

                            {/* Project title */}
                            <div>
                              <h4 className={`font-extrabold text-[11.5px] leading-snug transition-colors line-clamp-2 ${
                                isSelected ? 'text-amber-400' : 'text-slate-200 group-hover:text-amber-400'
                              }`}>
                                {item.project.name}
                              </h4>
                            </div>

                            {/* Info Block: Date with Time (No border, very compact) */}
                            <div className="flex items-center justify-end text-[9px] text-slate-500 pt-0.5">
                              <span className="font-mono text-slate-600">{formatVietnameseDateTime(item.doc.createdAt)}</span>
                            </div>

                            {/* Quick Action Buttons */}
                            <div 
                              className="flex gap-1 mt-1.5 justify-end items-center flex-wrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* In Phiếu Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  // Set selected doc to trigger printable layout
                                  setSelectedDocId(item.doc.id);
                                  setTimeout(() => {
                                    window.print();
                                  }, 150);
                                }}
                                className="px-1.5 py-1 bg-white hover:bg-slate-100 text-slate-300 rounded text-[9px] font-extrabold border border-slate-800 flex items-center gap-1 cursor-pointer transition-all"
                                title="In Phiếu Đề Xuất"
                              >
                                <Printer className="w-2.5 h-2.5 text-slate-600" />
                                <span>In Phiếu</span>
                              </button>

                              {/* Draft actions: Xuất Kho & Xóa */}
                              {col.id === 'draft' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      askConfirmation(
                                        `Bạn có chắc chắn muốn xác nhận XUẤT KHO cho đề xuất ${item.doc.code || ''} không?`,
                                        "Xác nhận xuất kho",
                                        () => handleUpdateStatus(item.doc.id, 'active')
                                      );
                                    }}
                                    className="px-1.5 py-1 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 rounded text-[9px] font-extrabold border border-indigo-900/30 flex items-center gap-0.5 cursor-pointer transition-all"
                                  >
                                    <span>Xuất Kho</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDoc(item.doc.id);
                                    }}
                                    className="px-1.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 rounded text-[9px] font-extrabold border border-red-900/30 flex items-center gap-0.5 cursor-pointer transition-all"
                                  >
                                    <span>Xóa</span>
                                  </button>
                                </>
                              )}

                              {/* Active actions: Đã Nhận & Xóa */}
                              {col.id === 'active' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      askConfirmation(
                                        "Xác nhận ĐÃ NHẬN HÀNG và hoàn tất quy trình cung ứng? Thao tác này sẽ tự động trừ kho hoặc tích lũy công nợ.",
                                        "Xác nhận đã nhận hàng",
                                        () => handleUpdateStatus(item.doc.id, 'approved')
                                      );
                                    }}
                                    className="px-1.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 rounded text-[9px] font-extrabold border border-emerald-900/30 flex items-center gap-0.5 cursor-pointer transition-all"
                                  >
                                    <span>Đã Nhận</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteDoc(item.doc.id);
                                    }}
                                    className="px-1.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 rounded text-[9px] font-extrabold border border-red-900/30 flex items-center gap-0.5 cursor-pointer transition-all"
                                  >
                                    <span>Xóa</span>
                                  </button>
                                </>
                              )}
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PREMIUM OVERLAY SLIDING DRAWER: CHI TIẾT ĐỀ XUẤT (BẢNG TIN ĐỀ XUẤT CÔNG TRÌNH) */}
      {selectedDocId && activeDetail && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-xs flex justify-end z-50 animate-fade-in" 
          onClick={() => {
            setSelectedDocId(null);
            setIsEditing(false);
          }}
        >
          <div 
            className="w-full max-w-5xl bg-white border-l border-slate-200 h-full flex flex-col text-xs text-slate-800 overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center shadow-md shrink-0">
                  <Boxes className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-extrabold text-[10px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {activeDetail.doc.code || 'MAT-NEW'}
                    </span>
                    <span className="font-bold text-[9.5px] uppercase tracking-wider text-slate-600">
                      PHÂN HỆ NỘI THẤT / ĐIỀU PHỐI VẬT TƯ
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-base mt-0.5">
                    {activeDetail.project.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5 text-slate-500">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Khách hàng / Chủ nhà:</span>
                    <span className="text-teal-600 font-extrabold text-[11px]">
                      {customers?.find(c => c.id === activeDetail.project.customerId)?.name || 'Lê Thị Diễm'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setSelectedDocId(null);
                    setIsEditing(false);
                  }}
                  className="p-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-300 font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <X className="w-4 h-4" />
                  Đóng Chi tiết
                </button>
              </div>
            </div>

            {/* Drawer Body split in left card area & right sidebar tool area */}
            <div className="flex-1 overflow-y-auto flex bg-slate-50" id="drawer_scrollable_body">
              {/* Left major side detail (75% width) */}
              <div className="flex-1 p-5 space-y-5 overflow-y-auto h-full border-r border-slate-200" id="drawer_left_pane">
                
                {/* CARD 1: THÔNG TIN CHI TIẾT & TIẾN ĐỘ CÔNG TRÌNH */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
                  <span className="font-extrabold text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4" />
                    Mô Tả & Thông tin gốc công trình
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700">
                    {/* Địa điểm thi công */}
                    <div className="col-span-2">
                      <span className="text-slate-500 block font-semibold mb-1">Địa điểm thi công:</span>
                      <input
                        type="text"
                        disabled
                        value={activeDetail.project.address || 'Không ghi nhận'}
                        className="bg-slate-50 border border-slate-200 text-slate-600 outline-none px-2.5 py-1.5 font-medium text-[11px] w-full rounded select-none cursor-not-allowed opacity-85"
                      />
                    </div>

                    {/* Ngày đề nghị & Mã dự án */}
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Ngày lập đề xuất:</span>
                      <input
                        type="text"
                        disabled
                        value={activeDetail.doc.createdAt || 'Chưa ghi nhận'}
                        className="bg-slate-50 border border-slate-200 text-slate-600 outline-none px-2.5 py-1.5 font-mono text-[11px] w-full rounded select-none cursor-not-allowed opacity-85"
                      />
                    </div>

                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Mã dự án liên kết:</span>
                      <input
                        type="text"
                        disabled
                        value={activeDetail.project.code || 'Chưa ghi nhận'}
                        className="bg-slate-50 border border-slate-200 text-slate-600 outline-none px-2.5 py-1.5 font-mono text-[11px] w-full rounded select-none cursor-not-allowed opacity-85"
                      />
                    </div>

                    {/* Người tạo & Trạng thái */}
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Người tạo đề xuất:</span>
                      <input
                        type="text"
                        disabled
                        value={activeDetail.doc.creatorName || 'hoanglong_group'}
                        className="bg-slate-50 border border-slate-200 text-slate-600 outline-none px-2.5 py-1.5 font-medium text-[11px] w-full rounded select-none cursor-not-allowed opacity-85"
                      />
                    </div>

                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Trạng thái phê duyệt:</span>
                      <div className="pt-0.5">
                        <span className={`font-extrabold uppercase text-[9.5px] px-2.5 py-1 rounded inline-block ${
                          activeDetail.doc.status === 'draft' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          activeDetail.doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          activeDetail.doc.status === 'active' ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                          activeDetail.doc.status === 'rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {activeDetail.doc.status === 'draft' ? 'CHỜ NCC / KHO' : 
                           activeDetail.doc.status === 'approved' ? 'ĐÃ NHẬN HÀNG' : 
                           activeDetail.doc.status === 'active' ? 'ĐÃ XUẤT KHO' : 
                           activeDetail.doc.status === 'rejected' ? 'Từ chối' : 'Lưu trữ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: CẤU HÌNH ĐIỀU PHỐI VÀ PHÂN CÔNG */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
                  <span className="font-extrabold text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-2">
                    <UserCheck className="w-4 h-4" />
                    Nhân sự công triển & cấu hình điều phối
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-700">
                    {/* Coordination Type */}
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Hình thức điều phối:</span>
                      {isEditing ? (
                        <select
                          value={editCoordType}
                          onChange={(e) => {
                            const val = e.target.value as 'self' | 'assign';
                            setEditCoordType(val);
                            if (val === 'self') {
                              setEditCoordinatorId('');
                            } else {
                              const firstGd = employees.find(emp => emp.department === 'Ban Giám Đốc' || emp.role === 'director');
                              if (firstGd) setEditCoordinatorId(firstGd.id);
                            }
                          }}
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 outline-none focus:border-teal-500"
                        >
                          <option value="self">Tự điều phối (mặc định)</option>
                          <option value="assign">Người điều phối chỉ định</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled
                          value={activeDetail.doc.coordinationType === 'assign' ? 'Chỉ định người điều phối' : 'Tự điều phối (mặc định)'}
                          className="bg-slate-50 border border-slate-200 text-slate-600 outline-none px-2.5 py-1.5 font-medium text-[11px] w-full rounded select-none cursor-not-allowed opacity-85"
                        />
                      )}
                    </div>

                    {/* Coordinator name */}
                    <div>
                      <span className="text-slate-500 block font-semibold mb-1">Cán bộ phê duyệt / Điều hành:</span>
                      {isEditing && editCoordType === 'assign' ? (
                        <select
                          value={editCoordinatorId}
                          onChange={(e) => setEditCoordinatorId(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800 outline-none focus:border-teal-500"
                        >
                          {employees.filter(emp => emp.department === 'Ban Giám Đốc' || emp.role === 'director').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled
                          value={activeDetail.doc.coordinatorName || 'Tự điều phối'}
                          className="bg-slate-50 border border-slate-200 text-slate-600 outline-none px-2.5 py-1.5 font-medium text-[11px] w-full rounded select-none cursor-not-allowed opacity-85"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* CARD 3: DANH MỤC VẬT TƯ ĐỀ XUẤT */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                    <span className="font-extrabold text-[11.5px] text-teal-600 flex items-center gap-1.5 uppercase tracking-wide">
                      <Boxes className="w-4 h-4" />
                      Danh mục vật tư đề xuất lắp ráp mộc xưởng
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditMaterials(activeDetail.doc.materials ? [...activeDetail.doc.materials] : []);
                          setEditCoordType(activeDetail.doc.coordinationType || 'self');
                          setEditCoordinatorId(activeDetail.doc.coordinatorId || '');
                          setIsEditing(true);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 text-[10px] font-bold px-2.5 py-1 rounded border border-slate-300 cursor-pointer transition-all"
                      >
                        Chỉnh sửa danh mục
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      {/* Edit Materials Table */}
                      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[300px]">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 text-slate-600 uppercase text-[9px] font-black border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="p-2.5 text-center w-12">STT</th>
                              <th className="p-2.5 min-w-[150px]">Tên vật tư gỗ / Phụ kiện mộc</th>
                              <th className="p-2.5 w-16 text-center">Số lượng</th>
                              <th className="p-2.5 w-16 text-center">ĐVT</th>
                              <th className="p-2.5 min-w-[150px]">Quy cách / Vân mộc</th>
                              <th className="p-2.5 min-w-[150px]">Nhà Cung Cấp</th>
                              <th className="p-2.5 w-24 text-center">Đơn giá (đ)</th>
                              <th className="p-2.5 w-24 text-center">Thành tiền</th>
                              <th className="p-2.5 text-center w-12">Xóa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {editMaterials.map((m, idx) => (
                              <tr key={m.id || idx} className="hover:bg-slate-50/50">
                                <td className="p-2 text-center font-bold text-slate-600">{idx + 1}</td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={m.name}
                                    onChange={(e) => {
                                      const next = [...editMaterials];
                                      next[idx].name = e.target.value;
                                      setEditMaterials(next);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 font-semibold"
                                    placeholder="Tên vật tư..."
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    value={m.qty}
                                    onChange={(e) => {
                                      const next = [...editMaterials];
                                      next[idx].qty = parseFloat(e.target.value) || 0;
                                      setEditMaterials(next);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 text-center font-mono font-bold"
                                    min="0.1"
                                    step="any"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={m.unit}
                                    onChange={(e) => {
                                      const next = [...editMaterials];
                                      next[idx].unit = e.target.value;
                                      setEditMaterials(next);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 text-center"
                                    placeholder="Tấm"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={m.spec}
                                    onChange={(e) => {
                                      const next = [...editMaterials];
                                      next[idx].spec = e.target.value;
                                      setEditMaterials(next);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800"
                                    placeholder="Quy cách..."
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={m.supplierId || ''}
                                    onChange={(e) => {
                                      const next = [...editMaterials];
                                      const sId = e.target.value;
                                      const sName = suppliers.find(s => s.id === sId)?.name || '';
                                      next[idx].supplierId = sId;
                                      next[idx].supplierName = sName;
                                      setEditMaterials(next);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800"
                                  >
                                    <option value="">-- Chọn NCC --</option>
                                    {suppliers.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="number"
                                    value={m.price || 0}
                                    onChange={(e) => {
                                      const next = [...editMaterials];
                                      next[idx].price = parseFloat(e.target.value) || 0;
                                      setEditMaterials(next);
                                    }}
                                    className="w-full bg-white border border-slate-300 rounded p-1 text-xs text-slate-800 text-right font-mono"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="p-2 text-right font-mono text-slate-600 font-bold">
                                  {((m.qty || 0) * (m.price || 0)).toLocaleString('vi-VN')} đ
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMaterialRow(m.id)}
                                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex justify-between items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleAddMaterialRow}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-750 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5 transition"
                        >
                          <Plus className="w-3.5 h-3.5 text-teal-600" /> Thêm dòng vật tư
                        </button>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditing(false)}
                            className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Hủy bỏ
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveDocChanges}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-sm"
                          >
                            Lưu cấu hình
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-slate-50/50">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-[9px] font-black border-b border-slate-200 sticky top-0">
                          <tr>
                            <th className="p-2.5 text-center w-12">STT</th>
                            <th className="p-2.5">Tên vật tư gỗ / Phụ kiện mộc xưởng</th>
                            <th className="p-2.5 w-16 text-center">Số lượng</th>
                            <th className="p-2.5 w-16 text-center">Đơn vị</th>
                            <th className="p-2.5">Quy cách kỹ thuật / Vân mộc</th>
                            <th className="p-2.5">Nhà Cung Cấp</th>
                            <th className="p-2.5 text-right w-24">Đơn giá</th>
                            <th className="p-2.5 text-right w-28">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {!activeDetail.doc.materials || activeDetail.doc.materials.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-slate-600 font-medium">
                                Chưa có vật tư nào trong danh mục đề xuất này.
                              </td>
                            </tr>
                          ) : (
                            activeDetail.doc.materials.map((m: any, idx: number) => {
                              const price = m.price || 0;
                              const total = m.qty * price;
                              return (
                                <tr key={m.id || idx} className="hover:bg-slate-50/40">
                                  <td className="p-2.5 text-center font-mono font-bold text-slate-600">{idx + 1}</td>
                                  <td className="p-2.5 font-semibold text-slate-800">{m.name}</td>
                                  <td className="p-2.5 text-center font-bold text-teal-600 font-mono">{m.qty}</td>
                                  <td className="p-2.5 text-center text-slate-600 font-medium">{m.unit}</td>
                                  <td className="p-2.5 text-slate-500 italic">{m.spec || 'Mặc định tiêu chuẩn xưởng'}</td>
                                  <td className="p-2.5 text-slate-750 font-bold">{m.supplierName || 'Vãng lai'}</td>
                                  <td className="p-2.5 text-right font-mono text-slate-600">{price.toLocaleString('vi-VN')} đ</td>
                                  <td className="p-2.5 text-right font-mono font-black text-teal-600">{total.toLocaleString('vi-VN')} đ</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Side Tools Column ("CÔNG CỤ LIÊN THÔNG") */}
              <div className="w-[280px] shrink-0 p-5 bg-slate-50 border-l border-slate-200 space-y-4 h-full overflow-y-auto" id="drawer_right_pane">
                <span className="font-extrabold text-[10px] text-slate-600 block uppercase tracking-wider mb-1">
                  CÔNG CỤ ĐIỀU PHỐI LIÊN THÔNG
                </span>

                {/* Primary actions */}
                <div className="space-y-2.5 text-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintPreviewDoc({ project: activeDetail.project, doc: activeDetail.doc });
                    }}
                    className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-2.5 rounded-xl font-bold text-[11.5px] transition flex items-center justify-between shadow-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-slate-600">
                      <Printer className="w-4 h-4 text-slate-500" />
                      <span>In phiếu đề xuất</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>

                  {activeDetail.doc.status === 'draft' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          askConfirmation(
                            "Bạn có chắc chắn muốn xác nhận XUẤT KHO cho đề xuất vật tư này không?",
                            "Xác nhận xuất kho",
                            () => handleUpdateStatus(activeDetail.doc.id, 'active')
                          );
                        }}
                        className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-3 py-2.5 rounded-xl font-bold text-[11.5px] transition flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-4 h-4 text-indigo-600" />
                          <span>Xác nhận Xuất Kho</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteDoc(activeDetail.doc.id);
                        }}
                        className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-2.5 rounded-xl font-bold text-[11.5px] transition flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-600" />
                          <span>Xóa đề xuất</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </>
                  )}

                  {activeDetail.doc.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          askConfirmation(
                            "Xác nhận ĐÃ NHẬN HÀNG và hoàn tất quy trình cung ứng? Thao tác này sẽ tự động trừ kho hoặc tích lũy công nợ.",
                            "Xác nhận đã nhận hàng",
                            () => handleUpdateStatus(activeDetail.doc.id, 'approved')
                          );
                        }}
                        className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3 py-2.5 rounded-xl font-bold text-[11.5px] transition flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Xác nhận Đã Nhận</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteDoc(activeDetail.doc.id);
                        }}
                        className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-2.5 rounded-xl font-bold text-[11.5px] transition flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-red-600" />
                          <span>Xóa đề xuất</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </>
                  )}

                  {activeDetail.doc.status === 'approved' && (
                    <div className="w-full bg-slate-100 border border-slate-200 text-slate-600 px-3 py-3 rounded-xl font-black text-[11.5px] text-center uppercase tracking-wide">
                      🎉 ĐÃ NHẬN HÀNG HOÀN TẤT
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* PRINT-ONLY CORPORATE VOUCHER */}
      {activeDetail && (
        <div className="hidden print:block bg-white text-black p-8 text-xs font-serif leading-relaxed max-w-2xl mx-auto" id="corporate_material_proposal_printout">
          <div className="flex justify-between items-start border-b-2 border-black pb-4">
            <div className="text-left font-sans">
              <h3 className="font-bold text-[11px] tracking-wider uppercase">CÔNG TY CỔ PHẦN NỘI THẤT HOÀNG LONG</h3>
              <p className="text-[9px] text-gray-650">Địa chỉ: Số 12 Ba Tháng Hai, Đà Lạt, Lâm Đồng</p>
              <p className="text-[9px] text-gray-650">SĐT: 091.234.5678 | MST: 5801234567</p>
            </div>
            <div className="text-center font-sans">
              <h4 className="font-extrabold text-[10px] tracking-widest uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
              <p className="font-bold text-[9px]">Độc lập - Tự do - Hạnh phúc</p>
              <div className="w-24 h-0.5 bg-black mx-auto mt-1"></div>
            </div>
          </div>

          <div className="text-center my-8">
            <h2 className="text-lg font-black tracking-wider uppercase">PHIẾU ĐỀ XUẤT CUNG CẤP VẬT TƯ CHỈ ĐỊNH</h2>
            <p className="font-mono text-[10px] text-gray-500 mt-1">Mã DXVT: {activeDetail.doc.code || activeDetail.doc.id}</p>
            <p className="italic text-[10px] text-gray-650">Ngày giờ đề xuất: {new Date(activeDetail.doc.createdAt || Date.now()).toLocaleString('vi-VN')}</p>
          </div>

          <div className="grid grid-cols-2 gap-y-2 mb-6 text-[11px] font-sans">
            <div><strong>Dự Án:</strong> {activeDetail.project.name} ({activeDetail.project.code})</div>
            <div><strong>Công việc con:</strong> {activeDetail.doc.taskName || 'Liên quan toàn dự án'}</div>
            <div><strong>Người yêu cầu:</strong> {activeDetail.doc.creatorName || 'Bộ phận Kỹ thuật'}</div>
            <div><strong>Người duyệt chỉ định:</strong> {activeDetail.doc.coordinatorName || 'Tự duyệt'}</div>
            <div className="col-span-2"><strong>Diễn giải lý do:</strong> {activeDetail.doc.description || 'Mua sắm vật tư phôi gỗ phục vụ gia công xưởng nội thất Hoàng Long.'}</div>
            <div className="col-span-2"><strong>Trạng thái phê duyệt:</strong> <span className="font-bold uppercase text-slate-900">{
              activeDetail.doc.status === 'draft' ? 'CHỜ NCC / KHO' :
              activeDetail.doc.status === 'approved' ? 'ĐÃ NHẬN HÀNG' :
              activeDetail.doc.status === 'active' ? 'ĐÃ XUẤT KHO' : 
              activeDetail.doc.status === 'rejected' ? 'Từ chối' : 'Lưu trữ'
            }</span></div>
          </div>

          <table className="w-full text-left border-collapse border border-black my-6 font-sans">
            <thead>
              <tr className="bg-gray-100 text-[9px] font-bold border-b border-black">
                <th className="border border-black p-2 text-center w-10">STT</th>
                <th className="border border-black p-2">Chủng Loại Vật Tư Gỗ / Sắt / Phụ Kiện</th>
                <th className="border border-black p-2 text-center w-16">Số lượng</th>
                <th className="border border-black p-2 text-center w-12">ĐVT</th>
                <th className="border border-black p-2">Nhà Cung Cấp Chỉ Định</th>
                <th className="border border-black p-2 text-right w-20">Đơn giá</th>
                <th className="border border-black p-2 text-right w-24">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {(!activeDetail.doc.materials || activeDetail.doc.materials.length === 0) ? (
                <tr>
                  <td colSpan={7} className="border border-black p-4 text-center">Chưa khai báo vật tư</td>
                </tr>
              ) : (
                activeDetail.doc.materials.map((m: any, idx: number) => {
                  const price = m.price || 0;
                  const total = m.qty * price;
                  return (
                    <tr key={m.id || idx}>
                      <td className="border border-black p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-black p-2">
                        <div className="font-bold">{m.name}</div>
                        {m.spec && <div className="text-[9px] text-gray-500 italic">Quy cách: {m.spec}</div>}
                      </td>
                      <td className="border border-black p-2 text-center font-mono font-bold">{m.qty}</td>
                      <td className="border border-black p-2 text-center">{m.unit}</td>
                      <td className="border border-black p-2 font-bold">{m.supplierName || 'Vãng lai'}</td>
                      <td className="border border-black p-2 text-right font-mono">{price.toLocaleString('vi-VN')} đ</td>
                      <td className="border border-black p-2 text-right font-mono font-bold">{total.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  );
                })
              )}
              <tr className="font-bold bg-gray-50">
                <td colSpan={6} className="border border-black p-2 text-right text-[10px]">TỔNG CỘNG GIÁ TRỊ VẬT TƯ:</td>
                <td className="border border-black p-2 text-right font-mono text-xs border-l border-black">
                  {(() => {
                    const sum = (activeDetail.doc.materials || []).reduce((acc: number, cur: any) => acc + (cur.qty * (cur.price || 0)), 0);
                    return sum.toLocaleString('vi-VN');
                  })()} đ
                </td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-4 text-center mt-12 mb-16 font-sans">
            <div className="space-y-12">
              <strong>NGƯỜI LẬP PHIẾU</strong>
              <p className="italic text-gray-400 text-[9px]">(Ký, ghi rõ họ tên)</p>
              <div className="mt-8 font-bold text-[11px]">{activeDetail.doc.creatorName || 'Nhân viên đề xuất'}</div>
            </div>
            <div className="space-y-12">
              <strong>NGƯỜI THẨM TRA</strong>
              <p className="italic text-gray-400 text-[9px]">(Ký, ghi rõ họ tên)</p>
              <div className="mt-8 font-bold text-[11px]">Lê Văn Thẩm</div>
            </div>
            <div className="space-y-12">
              <strong>GIÁM ĐỐC PHÊ DUYỆT</strong>
              <p className="italic text-gray-400 text-[9px]">(Ký, đóng dấu)</p>
              <div className="mt-8 font-bold text-[11px]">Ban Giám Đốc</div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {customConfirm && customConfirm.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-100/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-amber-100 bg-amber-100 text-amber-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {customConfirm.title}
                </h3>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {customConfirm.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCustomConfirm(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                {customConfirm.cancelText || 'Hủy bỏ'}
              </button>
              <button
                type="button"
                onClick={customConfirm.onConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-650 hover:bg-red-700 rounded-xl shadow-md transition cursor-pointer"
              >
                {customConfirm.confirmText || 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Dialog */}
      {customAlert && customAlert.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-100/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`p-3 rounded-full shrink-0 ${
                customAlert.type === 'warning' ? 'bg-amber-100 bg-amber-100 text-amber-500' :
                customAlert.type === 'info' ? 'bg-sky-100 bg-sky-100 text-sky-500' :
                'bg-emerald-100 bg-emerald-100 text-emerald-500'
              }`}>
                {customAlert.type === 'warning' ? (
                  <AlertTriangle className="w-8 h-8" />
                ) : customAlert.type === 'info' ? (
                  <Info className="w-8 h-8" />
                ) : (
                  <CheckCircle className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  {customAlert.title}
                </h3>
                <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {customAlert.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="w-full mt-4 py-2.5 bg-white hover:bg-slate-100 bg-slate-50 hover:bg-white text-white text-slate-50 rounded-xl font-bold text-xs transition shadow-md cursor-pointer"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview & Share Dialog Modal */}
      {printPreviewDoc && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[90vh] max-h-[850px] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Left Section: Printable Document Sheet (Voucher) */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-100 bg-slate-100 border-r border-slate-200 border-slate-200 flex justify-center items-start">
              <div 
                id="printable-voucher-content" 
                className="w-full max-w-[210mm] bg-white text-slate-900 p-8 shadow-md rounded-lg border border-slate-200 font-sans text-xs leading-relaxed"
              >
                {/* Header */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-4 mb-4">
                  <div>
                    <h4 className="font-extrabold uppercase text-[11px] tracking-wider text-teal-600">CÔNG TY CỔ PHẦN GỖ HOÀNG LONG</h4>
                    <p className="text-[9px] text-slate-500">VP: Số 45 Trần Phú, Lộc Sơn, Bảo Lộc, Lâm Đồng</p>
                    <p className="text-[9px] text-slate-500">Xưởng sản xuất: Khu công nghiệp Lộc Sơn, Bảo Lộc</p>
                    <p className="text-[9px] text-slate-500">Hotline: 0966.54.59.59 - Email: contact@hoanglonggroup.vn</p>
                  </div>
                  <div className="text-right font-mono">
                    <p className="font-bold text-slate-800">Mã phiếu: {printPreviewDoc.doc.code || 'MAT-NEW'}</p>
                    <p className="text-[10px] text-slate-500">Ngày lập: {printPreviewDoc.doc.createdAt || 'Hôm nay'}</p>
                    <p className="text-[9px] px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded font-bold uppercase inline-block mt-1">
                      {printPreviewDoc.doc.status === 'draft' ? 'CHỜ NCC / KHO' : 
                       printPreviewDoc.doc.status === 'active' ? 'ĐÃ XUẤT KHO' : 
                       printPreviewDoc.doc.status === 'approved' ? 'ĐÃ NHẬN HÀNG' : 'Lưu trữ'}
                    </p>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center my-6">
                  <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">PHIẾU ĐỀ XUẤT ĐIỀU PHỐI VẬT TƯ</h2>
                  <p className="text-[10px] italic text-slate-500 mt-1">(Liên hợp cấp phát nội bộ & tổng hợp công nợ nhà cung ứng)</p>
                </div>

                {/* Info Fields */}
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-6 my-6 border-b border-slate-200 pb-4">
                  <div>
                    <span className="text-slate-500 font-medium">Tên công trình:</span>{' '}
                    <span className="font-bold text-slate-800">{printPreviewDoc.project.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Mã công trình:</span>{' '}
                    <span className="font-mono font-bold text-slate-800">{printPreviewDoc.project.code}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 font-medium">Địa điểm thi công:</span>{' '}
                    <span className="font-medium text-slate-800">{printPreviewDoc.project.address || 'Không ghi nhận'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Người lập đề xuất:</span>{' '}
                    <span className="font-semibold text-slate-800">{printPreviewDoc.doc.creatorName || 'hoanglong_group'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Hình thức cấp:</span>{' '}
                    <span className="font-bold text-teal-600">
                      {printPreviewDoc.doc.coordinationType === 'self' ? 'Tự điều phối vật tư' : 'Nhân sự chỉ định điều phối'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Cán bộ điều phối:</span>{' '}
                    <span className="font-semibold text-slate-800">{printPreviewDoc.doc.coordinatorName || 'Tự điều phối'}</span>
                  </div>
                </div>

                {/* Materials List */}
                <div className="my-6">
                  <h3 className="font-bold text-[10px] uppercase text-slate-500 tracking-wide mb-2">Chi tiết danh mục vật tư cấp phát:</h3>
                  <table className="w-full text-[10px] border border-slate-400 border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-400 p-2 text-center w-8 font-bold">STT</th>
                        <th className="border border-slate-400 p-2 font-bold text-left">Vật tư gỗ / Linh kiện phụ kiện</th>
                        <th className="border border-slate-400 p-2 text-center w-12 font-bold">SL</th>
                        <th className="border border-slate-400 p-2 text-center w-12 font-bold">ĐVT</th>
                        <th className="border border-slate-400 p-2 font-bold text-left">Thông số kỹ thuật / Mã vân</th>
                        <th className="border border-slate-400 p-2 font-bold text-left">Đơn vị cung ứng</th>
                        <th className="border border-slate-400 p-2 font-bold text-right w-20">Đơn giá</th>
                        <th className="border border-slate-400 p-2 font-bold text-right w-24">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!printPreviewDoc.doc.materials || printPreviewDoc.doc.materials.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="border border-slate-400 p-6 text-center text-slate-600 italic">
                            Chưa ghi nhận vật tư đề xuất
                          </td>
                        </tr>
                      ) : (
                        printPreviewDoc.doc.materials.map((m: any, idx: number) => {
                          const price = m.price || 0;
                          const total = (m.qty || 0) * price;
                          return (
                            <tr key={idx}>
                              <td className="border border-slate-400 p-2 text-center font-mono font-bold text-slate-500">{idx + 1}</td>
                              <td className="border border-slate-400 p-2 font-bold text-slate-800">{m.name}</td>
                              <td className="border border-slate-400 p-2 text-center font-bold font-mono">{m.qty}</td>
                              <td className="border border-slate-400 p-2 text-center">{m.unit}</td>
                              <td className="border border-slate-400 p-2 text-slate-600 italic">{m.spec || 'Mộc tiêu chuẩn'}</td>
                              <td className="border border-slate-400 p-2 font-semibold text-slate-700">{m.supplierName || 'Kho Hoàng Long'}</td>
                              <td className="border border-slate-400 p-2 text-right font-mono">{price.toLocaleString('vi-VN')} đ</td>
                              <td className="border border-slate-400 p-2 text-right font-mono font-bold text-teal-600">{total.toLocaleString('vi-VN')} đ</td>
                            </tr>
                          );
                        })
                      )}
                      
                      {/* Summary Row */}
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="border border-slate-400 p-2.5 font-bold uppercase text-right text-slate-700">TỔNG CỘNG GIÁ TRỊ VẬT TƯ ĐỀ XUẤT:</td>
                        <td colSpan={2} className="border border-slate-400 p-2.5 text-right font-black text-teal-600 font-mono text-[11.5px]">
                          {(printPreviewDoc.doc.materials?.reduce((sum: number, m: any) => sum + ((m.qty || 0) * (m.price || 0)), 0) || 0).toLocaleString('vi-VN')} đ
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={8} className="border border-slate-400 p-2.5 italic text-slate-600">
                          <span className="font-semibold text-slate-700">Bằng chữ:</span>{' '}
                          {numberToVietnameseWords(printPreviewDoc.doc.materials?.reduce((sum: number, m: any) => sum + ((m.qty || 0) * (m.price || 0)), 0) || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-4 gap-2 text-center mt-12 mb-4">
                  <div>
                    <span className="font-extrabold text-slate-800 block text-[10px] uppercase">Thủ kho bàn giao</span>
                    <span className="text-[8px] text-slate-600 block mt-0.5">(Ký, ghi rõ họ tên)</span>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-mono text-[9px] text-slate-600 italic">Đã duyệt điện tử</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 block text-[10px] uppercase">Kế toán tổng hợp</span>
                    <span className="text-[8px] text-slate-600 block mt-0.5">(Ký, ghi rõ họ tên)</span>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-mono text-[9px] text-slate-600 italic">Đã duyệt điện tử</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 block text-[10px] uppercase">Người đề xuất lập</span>
                    <span className="text-[8px] text-slate-600 block mt-0.5">(Ký, ghi rõ họ tên)</span>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-bold text-slate-700 italic font-mono text-[11px]">
                        {printPreviewDoc.doc.creatorName || 'hoanglong_group'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 block text-[10px] uppercase">Giám đốc phê duyệt</span>
                    <span className="text-[8px] text-slate-600 block mt-0.5">(Ký, ghi rõ họ tên, đóng dấu)</span>
                    <div className="h-16 flex items-end justify-center">
                      <span className="font-bold text-red-650 italic font-mono text-[11px]">Trương Hữu Long</span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center text-[8.5px] text-slate-600">
                  <p>Phiếu được kết xuất trực tiếp từ hệ thống ERP Nội Thất Hoàng Long. Các chữ ký được công nhận tính hợp lệ nội bộ.</p>
                </div>
              </div>
            </div>

            {/* Right Section: Action Center & Fast Sharing */}
            <div className="w-full md:w-[320px] shrink-0 p-6 bg-slate-50 bg-white flex flex-col justify-between h-full overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 border-slate-200">
                  <span className="font-black text-xs text-slate-800 uppercase tracking-wide">
                    CÔNG CỤ IN & CHIA SẺ
                  </span>
                  <button 
                    type="button"
                    onClick={() => setPrintPreviewDoc(null)}
                    className="p-1.5 hover:bg-slate-200 hover:bg-slate-100 rounded-full text-slate-600 hover:text-slate-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Document Information Card */}
                <div className="mt-5 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">Mã đề xuất:</span>
                    <span className="font-mono font-bold text-slate-800">{printPreviewDoc.doc.code || 'MAT-NEW'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600 font-medium">Dự án:</span>
                    <span className="font-bold text-slate-800 max-w-[160px] truncate text-right" title={printPreviewDoc.project.name}>
                      {printPreviewDoc.project.name}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-2 border-t border-slate-100 border-slate-200">
                    <span className="text-slate-600 font-black">Tổng giá trị vật tư:</span>
                    <span className="font-mono font-black text-teal-600 text-teal-600">
                      {(printPreviewDoc.doc.materials?.reduce((sum: number, m: any) => sum + ((m.qty || 0) * (m.price || 0)), 0) || 0).toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>

                {/* Primary Actions Group */}
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      const printContent = document.getElementById('printable-voucher-content');
                      if (!printContent) return;
                      const winPrint = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
                      if (!winPrint) return;
                      winPrint.document.write(`
                        <html>
                          <head>
                            <title>In Phiếu Đề Xuất Vật Tư - ${printPreviewDoc.doc.code || ''}</title>
                            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                            <style>
                              body { font-family: 'Inter', sans-serif; padding: 25px; background: white; color: black; }
                              table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
                              th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 11px; }
                              th { background-color: #f3f4f6; font-weight: bold; }
                              .text-center { text-align: center; }
                              .text-right { text-align: right; }
                              .font-bold { font-weight: bold; }
                              @media print {
                                body { padding: 0; }
                                .no-print { display: none; }
                              }
                            </style>
                          </head>
                          <body>
                            ${printContent.innerHTML}
                            <script>
                              window.onload = function() {
                                window.print();
                                window.close();
                              }
                            </script>
                          </body>
                        </html>
                      `);
                      winPrint.document.close();
                      winPrint.focus();
                    }}
                    className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    In phiếu đề xuất (A4)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      // Trigger a mock file download representing the PDF export
                      const fileContent = `PDF VOUCHER MOCKUP\n==================\nCode: ${printPreviewDoc.doc.code || 'MAT-NEW'}\nProject: ${printPreviewDoc.project.name}\nTotal: ${(printPreviewDoc.doc.materials?.reduce((sum: number, m: any) => sum + ((m.qty || 0) * (m.price || 0)), 0) || 0).toLocaleString('vi-VN')} VND`;
                      const blob = new Blob([fileContent], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Phieu_De_Xuat_Vat_Tu_${printPreviewDoc.doc.code || 'mat'}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      showNotification('Tệp PDF đang được đóng gói và tải xuống máy tính của bạn thành công!', 'Xuất file thành công', 'success');
                    }}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer border border-slate-700"
                  >
                    <Download className="w-4 h-4" />
                    Tải file PDF kết quả
                  </button>
                </div>

                {/* FAST SHARING SECTION */}
                <div className="mt-8 border-t border-slate-200 border-slate-200 pt-6 space-y-4">
                  <span className="font-extrabold text-[11px] text-slate-600 block uppercase tracking-wider">
                    CHIA SẺ NHANH LIÊN THÔNG QUA MXH
                  </span>

                  {/* Copy link button */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`https://erp.hoanglonggroup.vn/pdf-viewer/mat-coor/${printPreviewDoc.doc.id}`}
                        className="flex-1 bg-slate-100 bg-white border border-slate-250 border-slate-200 p-2 rounded-xl text-[10px] font-mono text-slate-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://erp.hoanglonggroup.vn/pdf-viewer/mat-coor/${printPreviewDoc.doc.id}`);
                          setIsCopied(true);
                          setTimeout(() => setIsCopied(false), 2000);
                          showNotification('Đã sao chép liên kết tải phiếu PDF thành công!', 'Sao chép thành công', 'success');
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition cursor-pointer shadow-xs"
                        title="Sao chép liên kết"
                      >
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Share to Zalo */}
                    <a
                      href={`https://sp.zalo.me/share_to_zalo?url=${encodeURIComponent(`https://erp.hoanglonggroup.vn/pdf-viewer/mat-coor/${printPreviewDoc.doc.id}`)}&text=${encodeURIComponent(`Chia sẻ Phiếu đề xuất vật tư ${printPreviewDoc.doc.code || ''} dự án ${printPreviewDoc.project.name}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 bg-[#0068FF] hover:bg-[#005AD5] text-white rounded-xl font-extrabold text-[10px] flex items-center justify-center gap-1.5 transition shadow-xs text-center cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      Gửi Zalo nhanh
                    </a>

                    {/* Share to Facebook */}
                    <a
                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://erp.hoanglonggroup.vn/pdf-viewer/mat-coor/${printPreviewDoc.doc.id}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl font-extrabold text-[10px] flex items-center justify-center gap-1.5 transition shadow-xs text-center cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 shrink-0" />
                      Gửi Facebook
                    </a>
                  </div>

                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl">
                    <p className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                      💡 <strong>Chia sẻ tức thời:</strong> Bạn có thể chia sẻ liên kết trực tiếp này cho nhà cung ứng hoặc tổ thợ xưởng để họ tải file PDF về ngay lập tức trên mọi thiết bị di động mà không cần đăng nhập tài khoản hệ thống.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={() => setPrintPreviewDoc(null)}
                  className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Đóng cửa sổ xem trước
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

// Helper to convert number to Vietnamese text
function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  
  function readGroup(group: number): string {
    let result = '';
    const hundreds = Math.floor(group / 100);
    const tens = Math.floor((group % 100) / 10);
    const ones = group % 10;
    
    if (hundreds > 0) {
      result += digits[hundreds] + ' trăm ';
    } else if (tens > 0 || ones > 0) {
      result += 'không trăm ';
    }
    
    if (tens > 1) {
      result += digits[tens] + ' mươi ';
      if (ones === 1) result += 'mốt';
      else if (ones === 5) result += 'lăm';
      else if (ones > 0) result += digits[ones];
    } else if (tens === 1) {
      result += 'mười ';
      if (ones === 5) result += 'lăm';
      else if (ones > 0) result += digits[ones];
    } else if (ones > 0) {
      result += 'lẻ ' + digits[ones];
    }
    return result.trim();
  }
  
  let str = '';
  let groupIdx = 0;
  let remaining = num;
  
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group > 0) {
      const groupStr = readGroup(group);
      str = groupStr + ' ' + units[groupIdx] + ' ' + str;
    }
    remaining = Math.floor(remaining / 1000);
    groupIdx++;
  }
  
  str = str.trim().replace(/\s+/g, ' ');
  // Clean up leading "không trăm lẻ" if total starts with it
  if (str.toLowerCase().startsWith('không trăm lẻ')) {
    str = str.substring(13).trim();
  } else if (str.toLowerCase().startsWith('không trăm')) {
    str = str.substring(10).trim();
  }
  
  return str.charAt(0).toUpperCase() + str.slice(1) + ' đồng';
}

// Helper to format Date with time nicely
function formatVietnameseDateTime(dateStr: string | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    
    // Check if original string contains time elements
    const hasTime = dateStr.includes('T') || dateStr.includes(':');
    if (hasTime) {
      return `${hours}:${minutes} - ${day}/${month}/${year}`;
    }
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
}
