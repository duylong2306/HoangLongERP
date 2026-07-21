import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Quote, Customer, Project, QuoteItem, QuoteConfig, ArchivedQuote } from '../types';
import { dbService } from '../lib/dbService';
import {
  useNotification
} from '../context';
import {
  Calculator,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Plus,
  Search,
  Sliders,
  TrendingUp,
  ArrowUpRight,
  Briefcase,
  User,
  Calendar,
  Layers,
  Building2,
  Boxes,
  Compass,
  FileDown,
  Lock,
  Shield,
  Edit,
  Trash2,
  X,
  FolderOpen,
  Upload,
  Download
} from 'lucide-react';
import CabinetEstimator from './CabinetEstimator';
import ConstructionEstimator from './ConstructionEstimator';
import MechanicalEstimator from './MechanicalEstimator';
import ProductCatalogTable from './ProductCatalogTable';
import CabinetArchive from './CabinetArchive';
import ConstructionArchive from './ConstructionArchive';
import ConstructionTakeoff from './ConstructionTakeoff';
import ConstructionFinalQuote from './ConstructionFinalQuote';
import MechanicalArchive from './MechanicalArchive';
import SubcontractorEstimator from './SubcontractorEstimator';
import SubcontractorArchive from './SubcontractorArchive';
import { exportToExcel, importFromExcel, formatDateForFile } from '../lib/excelUtils';

export const HOUSE_ESTIMATE_PRICES = [
  {
    stt: 1,
    type: 'Nhà cấp 4 mái thái',
    avgPrice: 7300000,
    minPrice: 5600000,
    maxPrice: 9300000,
    features: 'Móng đơn/bằng, cột BTCT, tường 200, mái thép + ngói xi măng/đất nung'
  },
  {
    stt: 2,
    type: 'Nhà cấp 4 mái nhật',
    avgPrice: 8000000,
    minPrice: 6200000,
    maxPrice: 10200000,
    features: 'Móng bằng BTCT, cột thép hoặc BTCT, xà gồ thép, tấm lợp cao cấp'
  },
  {
    stt: 3,
    type: 'Nhà cấp 4 mái tôn',
    avgPrice: 5600000,
    minPrice: 4500000,
    maxPrice: 7200000,
    features: 'Móng đơn, tường gạch không cần cột lớn, xà gồ thép mạ kẽm + tôn'
  },
  {
    stt: 4,
    type: 'Nhà cấp 4 mái bằng',
    avgPrice: 7500000,
    minPrice: 5900000,
    maxPrice: 9300000,
    features: 'Móng bằng, cột dầm sàn BTCT M250, chống thấm Sika 2 lớp'
  },
  {
    stt: 5,
    type: 'Nhà phố',
    avgPrice: 11200000,
    minPrice: 8900000,
    maxPrice: 15100000,
    features: 'Móng cọc/bằng, BTCT chịu lực, tường 200, hoàn thiện đá hoa cương'
  },
  {
    stt: 6,
    type: 'Nhà ống',
    avgPrice: 10700000,
    minPrice: 8300000,
    maxPrice: 14000000,
    features: 'Giống nhà phố, chiều ngang 3-5m, chiều sâu 15-20m, 3-5 tầng'
  },
  {
    stt: 7,
    type: 'Biệt thự hiện đại',
    avgPrice: 14800000,
    minPrice: 10800000,
    maxPrice: 21200000,
    features: 'Móng cọc BTCT, khung cột dầm lớn, kính Low-E, đá tự nhiên, nội thất cao cấp'
  },
  {
    stt: 8,
    type: 'Biệt thự tân cổ điển',
    avgPrice: 17500000,
    minPrice: 12100000,
    maxPrice: 24100000,
    features: 'BTCT toàn khối, vữa GRC đúc phào, đá marble, sơn giả đá, cổng sắt nghệ thuật'
  },
  {
    stt: 9,
    type: 'Nhà vườn',
    avgPrice: 12300000,
    minPrice: 8700000,
    maxPrice: 17500000,
    features: 'Kết hợp BTCT + gỗ tự nhiên, mái ngói/mái xanh, cảnh quan sân vườn'
  },
  {
    stt: 10,
    type: 'Biệt thự cổ điển',
    avgPrice: 20100000,
    minPrice: 14300000,
    maxPrice: 28500000,
    features: 'BTCT toàn khối, ốp đá tự nhiên, cửa gỗ cổ điển, đèn chùm, trần thạch cao phào'
  },
  {
    stt: 11,
    type: 'Nhà khung thép tiền chế',
    avgPrice: 7000000,
    minPrice: 5300000,
    maxPrice: 9300000,
    features: 'Cột thép H/I, xà ngang thép, panel tường+mái EPS sandwich, móng đơn'
  }
];

export const MATERIAL_COMPOSITION_NORMS = [
  {
    id: 'AK.11111',
    name: 'Xây tường gạch đặc 105mm (M75#)',
    unit: '1m³',
    brick: 555,
    cement: 212,
    sand: 0.9100,
    stone: null,
    steel: null,
    water: 130,
    notes: 'Tường ngăn trong nhà'
  },
  {
    id: 'AK.11121',
    name: 'Xây tường gạch đặc 200mm (M75#)',
    unit: '1m³',
    brick: 500,
    cement: 190,
    sand: 0.8800,
    stone: null,
    steel: null,
    water: 120,
    notes: 'Tường ngoài chịu lực'
  },
  {
    id: 'AK.11221',
    name: 'Xây gạch rỗng 6 lỗ 105mm (M50#)',
    unit: '1m³',
    brick: 595,
    cement: 185,
    sand: 0.8700,
    stone: null,
    steel: null,
    water: 115,
    notes: 'Tường nhẹ tiết kiệm'
  },
  {
    id: 'AK.11231',
    name: 'Xây gạch rỗng 6 lỗ 200mm (M50#)',
    unit: '1m³',
    brick: 540,
    cement: 170,
    sand: 0.8500,
    stone: null,
    steel: null,
    water: 110,
    notes: 'Tường nhẹ dày hơn'
  },
  {
    id: 'AB.11111',
    name: 'Bê tông lót móng mác 100 (đá 4×6)',
    unit: '1m³',
    brick: null,
    cement: 215,
    sand: 0.5200,
    stone: 0.9200,
    steel: null,
    water: 175,
    notes: 'BT lót không cốt thép'
  },
  {
    id: 'AB.11211',
    name: 'Bê tông móng băng mác 200 (đá 2×4)',
    unit: '1m³',
    brick: null,
    cement: 289,
    sand: 0.4900,
    stone: 0.9000,
    steel: null,
    water: 185,
    notes: 'Móng băng thông dụng'
  },
  {
    id: 'AB.11311',
    name: 'Bê tông móng đơn mác 250 (đá 1×2)',
    unit: '1m³',
    brick: null,
    cement: 342,
    sand: 0.4500,
    stone: 0.8500,
    steel: null,
    water: 195,
    notes: 'Móng đơn biệt thự'
  },
  {
    id: 'AB.21111',
    name: 'Bê tông cột mác 250 (đá 1×2)',
    unit: '1m³',
    brick: null,
    cement: 342,
    sand: 0.4500,
    stone: 0.8500,
    steel: null,
    water: 195,
    notes: 'Cột tầng 1–3'
  },
  {
    id: 'AB.21211',
    name: 'Bê tông cột mác 300 (đá 1×2)',
    unit: '1m³',
    brick: null,
    cement: 380,
    sand: 0.4200,
    stone: 0.8200,
    steel: null,
    water: 200,
    notes: 'Cột tầng cao biệt thự'
  },
  {
    id: 'AB.31111',
    name: 'Bê tông dầm mác 250 (đá 1×2)',
    unit: '1m³',
    brick: null,
    cement: 342,
    sand: 0.4500,
    stone: 0.8500,
    steel: null,
    water: 195,
    notes: 'Dầm sàn thông dụng'
  },
  {
    id: 'AB.41111',
    name: 'Bê tông sàn mác 200 (đá 1×2)',
    unit: '1m³',
    brick: null,
    cement: 289,
    sand: 0.4900,
    stone: 0.9000,
    steel: null,
    water: 185,
    notes: 'Sàn điển hình'
  },
  {
    id: 'AB.41211',
    name: 'Bê tông sàn mác 250 (đá 1×2)',
    unit: '1m³',
    brick: null,
    cement: 342,
    sand: 0.4500,
    stone: 0.8500,
    steel: null,
    water: 195,
    notes: 'Sàn tầng cao, tải lớn'
  },
  {
    id: 'AB.51111',
    name: 'Bê tông cầu thang mác 250',
    unit: '1m³',
    brick: null,
    cement: 342,
    sand: 0.4500,
    stone: 0.8500,
    steel: null,
    water: 195,
    notes: 'Cầu thang trong nhà'
  },
  {
    id: 'AF.11111',
    name: 'Trát tường trong dày 15mm (M50#)',
    unit: '1m²',
    brick: null,
    cement: 3,
    sand: 0.0048,
    stone: null,
    steel: null,
    water: 2,
    notes: 'Trát thô + mịn nội thất'
  },
  {
    id: 'AF.21111',
    name: 'Trát tường ngoài dày 20mm (M75#)',
    unit: '1m²',
    brick: null,
    cement: 5,
    sand: 0.0070,
    stone: null,
    steel: null,
    water: 3,
    notes: 'Trát chống thấm ngoài trời'
  },
  {
    id: 'AF.31111',
    name: 'Trát trần dày 10mm (M50#)',
    unit: '1m²',
    brick: null,
    cement: 3,
    sand: 0.0038,
    stone: null,
    steel: null,
    water: 2,
    notes: 'Trát trần tầng'
  },
  {
    id: 'AD.11111',
    name: 'Ốp gạch ceramic 30×60 (keo+chít)',
    unit: '1m²',
    brick: null,
    cement: null,
    sand: null,
    stone: null,
    steel: null,
    water: null,
    notes: 'VL tính riêng theo đơn giá'
  },
  {
    id: 'AD.21111',
    name: 'Lát gạch granite 60×60 (keo+chít)',
    unit: '1m²',
    brick: null,
    cement: null,
    sand: null,
    stone: null,
    steel: null,
    water: null,
    notes: 'VL tính riêng theo đơn giá'
  }
];

export const MATERIAL_LABOR_PRICES = [
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Xi măng PCB40 (Hà Tiên/Hoàng Thạch/INSEE)',
    unit: 'kg',
    avgPrice: 2185,
    minPrice: 1966,
    maxPrice: 2404,
    notes: 'Giá tại bãi, bao 50kg'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Cát xây (cát vàng, cát sông)',
    unit: 'm³',
    avgPrice: 379500,
    minPrice: 341550,
    maxPrice: 417450,
    notes: 'Phụ thuộc khoảng cách vận chuyển'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Đá dăm 1×2 (đá xanh Biên Hòa/Thủy Nguyên)',
    unit: 'm³',
    avgPrice: 414000,
    minPrice: 372600,
    maxPrice: 455400,
    notes: 'Giá tại công trình'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Đá dăm 2×4 (dùng BT lót, móng)',
    unit: 'm³',
    avgPrice: 391000,
    minPrice: 351900,
    maxPrice: 430100,
    notes: 'Giá tại công trình'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Thép CB240-T phi 6-8 (cuộn)',
    unit: 'kg',
    avgPrice: 18975,
    minPrice: 17077,
    maxPrice: 20873,
    notes: 'Thép cấu tạo, đai'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Thép CB300-V phi 10-12 (thanh)',
    unit: 'kg',
    avgPrice: 20125,
    minPrice: 18112,
    maxPrice: 22138,
    notes: 'Thép chịu lực chính'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Thép CB400-V phi 14-22 (thanh)',
    unit: 'kg',
    avgPrice: 21275,
    minPrice: 19147,
    maxPrice: 23403,
    notes: 'Thép cột, dầm lớn'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Gạch đặc 6×10.5×22cm (đất nung)',
    unit: 'viên',
    avgPrice: 2875,
    minPrice: 2587,
    maxPrice: 3163,
    notes: 'Gạch lò tuynel'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Gạch rỗng 6 lỗ 10.5×10.5×22cm',
    unit: 'viên',
    avgPrice: 2415,
    minPrice: 2173,
    maxPrice: 2657,
    notes: 'Gạch nhẹ hơn 30%'
  },
  {
    group: 'VẬT LIỆU CHÍNH',
    name: 'Nước thi công (nước máy)',
    unit: 'm³',
    avgPrice: 23000,
    minPrice: 20700,
    maxPrice: 25300,
    notes: 'Kể cả phí bơm'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Sơn nước nội thất (Dulux/Jotun/Kansai)',
    unit: 'lít',
    avgPrice: 112700,
    minPrice: 101430,
    maxPrice: 123970,
    notes: '2 lớp lót + 2 lớp phủ'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Sơn nước ngoại thất chống thấm (Dulux WS)',
    unit: 'lít',
    avgPrice: 143750,
    minPrice: 129375,
    maxPrice: 158125,
    notes: 'Chịu thời tiết 5–8 năm'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Gạch ceramic ốp tường 30×60 (Viglacera/TTC)',
    unit: 'm²',
    avgPrice: 155250,
    minPrice: 139725,
    maxPrice: 170775,
    notes: 'Chưa kể keo + chít'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Gạch granite lát sàn 60×60 (Viglacera/Prime)',
    unit: 'm²',
    avgPrice: 241500,
    minPrice: 217350,
    maxPrice: 265650,
    notes: 'Chưa kể keo + chít'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Gạch granite lát sàn 80×80 (cao cấp)',
    unit: 'm²',
    avgPrice: 368000,
    minPrice: 331200,
    maxPrice: 404800,
    notes: 'Nhập khẩu Ý/TQ cao cấp'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Keo dán gạch (Mapei/Bostik/Weber)',
    unit: 'kg',
    avgPrice: 10925,
    minPrice: 9832,
    maxPrice: 12018,
    notes: 'Tiêu hao ~5kg/m²'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Vữa chít mạch (Mapei Ultracolor)',
    unit: 'kg',
    avgPrice: 49450,
    minPrice: 44505,
    maxPrice: 54395,
    notes: 'Tiêu hao ~0.3kg/m²'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Chống thấm Sika (dạng màng)',
    unit: 'kg',
    avgPrice: 74750,
    minPrice: 67275,
    maxPrice: 82225,
    notes: 'Tiêu hao 2–3 kg/m²'
  },
  {
    group: 'HOÀN THIỆN',
    name: 'Thạch cao tấm 12mm (USG/Gyproc)',
    unit: 'm²',
    avgPrice: 124200,
    minPrice: 111780,
    maxPrice: 136220,
    notes: 'Vách + trần thạch cao'
  },
  {
    group: 'CỬA & KẾT CẤU',
    name: 'Cửa nhôm kính 1 cánh Việt Pháp (W800×H2100)',
    unit: 'bộ',
    avgPrice: 3680000,
    minPrice: 3312000,
    maxPrice: 4048000,
    notes: 'Nhôm hệ 65, kính 5mm'
  },
  {
    group: 'CỬA & KẾT CẤU',
    name: 'Cửa nhôm kính 2 cánh (W1200×H2100)',
    unit: 'bộ',
    avgPrice: 5980000,
    minPrice: 5382000,
    maxPrice: 6578000,
    notes: 'Nhôm hệ 65, kính cường lực'
  },
  {
    group: 'CỬA & KẾT CẤU',
    name: 'Cửa đi gỗ HDF chống ẩm (W800×H2100)',
    unit: 'bộ',
    avgPrice: 4600000,
    minPrice: 4140000,
    maxPrice: 5060000,
    notes: 'Phòng ngủ/WC'
  },
  {
    group: 'CỬA & KẾT CẤU',
    name: 'Cửa cuốn thép tự động (W3000×H3000)',
    unit: 'bộ',
    avgPrice: 16100000,
    minPrice: 14490000,
    maxPrice: 17710000,
    notes: 'Cửa garage'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ xây gạch bậc 3/7',
    unit: 'ca',
    avgPrice: 490500,
    minPrice: 441450,
    maxPrice: 539550,
    notes: '8h làm việc/ca'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ đổ bê tông + cốp pha bậc 3.5/7',
    unit: 'ca',
    avgPrice: 545000,
    minPrice: 490500,
    maxPrice: 599500,
    notes: 'Kể cả phụ đồ bê tông'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ cốt thép bậc 4/7',
    unit: 'ca',
    avgPrice: 577700,
    minPrice: 519930,
    maxPrice: 635470,
    notes: 'Uốn+buộc+lắp dựng'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ trát tường bậc 3/7',
    unit: 'ca',
    avgPrice: 490500,
    minPrice: 441450,
    maxPrice: 539550,
    notes: 'Trát 2 lớp thô+mịn'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ lát gạch bậc 4/7',
    unit: 'ca',
    avgPrice: 555900,
    minPrice: 500310,
    maxPrice: 611490,
    notes: 'Lát sàn + ốp tường'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ sơn bậc 3/7',
    unit: 'ca',
    avgPrice: 468700,
    minPrice: 421830,
    maxPrice: 515570,
    notes: 'Sơn 2 lớp lót + 2 phủ'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Thợ mộc/cốp pha bậc 3/7',
    unit: 'ca',
    avgPrice: 523200,
    minPrice: 470880,
    maxPrice: 575520,
    notes: 'Làm+tháo cốp pha'
  },
  {
    group: 'NHÂN CÔNG',
    name: 'Nhân công phổ thông',
    unit: 'ca',
    avgPrice: 381500,
    minPrice: 343350,
    maxPrice: 419650,
    notes: 'Phụ vận chuyển, đào đất'
  },
  {
    group: 'MÁY & THIẾT BỊ',
    name: 'Máy bơm bê tông (thuê theo ca)',
    unit: 'ca',
    avgPrice: 3335000,
    minPrice: 3001500,
    maxPrice: 3668500,
    notes: 'Kể cả nhân công vận hành'
  },
  {
    group: 'MÁY & THIẾT BỊ',
    name: 'Máy trộn bê tông 250L (thuê)',
    unit: 'ca',
    avgPrice: 460000,
    minPrice: 414000,
    maxPrice: 506000,
    notes: 'Trộn bê tông nhỏ'
  },
  {
    group: 'MÁY & THIẾT BỊ',
    name: 'Cẩu tháp (thuê theo tháng)',
    unit: 'tháng',
    avgPrice: 33350000,
    minPrice: 30015000,
    maxPrice: 36685000,
    notes: 'Công trình từ 5 tầng'
  },
  {
    group: 'MÁY & THIẾT BỊ',
    name: 'Đầm dùi bê tông (thuê)',
    unit: 'ca',
    avgPrice: 241500,
    minPrice: 217350,
    maxPrice: 265650,
    notes: 'Kèm theo máy đổ BT'
  }
];

interface QuotationSystemProps {
  quotes: Quote[];
  customers: Customer[];
  projects: Project[];
  onAddQuote: (newQuote: Quote) => void;
  onUpdateQuoteStatus?: (quoteId: string, status: 'approved' | 'rejected' | 'sent' | 'draft') => void;
  preselectedCustomerId?: string;
  preselectedProjectId?: string;
  initialTab?: 'dashboard' | 'furniture' | 'construction' | 'mechanical' | 'subcontractor';
  currentUser?: any;
}

export default function QuotationSystem({
  quotes,
  customers,
  projects,
  onAddQuote,
  onUpdateQuoteStatus,
  preselectedCustomerId,
  preselectedProjectId,
  initialTab = 'construction',
  currentUser
}: QuotationSystemProps) {
  const { addToast } = useNotification();
  // Cấu hình Phân quyền người dùng dựa trên nhóm vai trò từ HRM (từ Supabase cache trước)
  const getPermission = (moduleKey: string, actionKey: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    let rolesList: any[] = [];
    const supCached = localStorage.getItem('hl_cached_hrm_role_groups');
    if (supCached) {
      try { rolesList = JSON.parse(supCached); } catch {}
    }
    if (rolesList.length === 0) {
      const savedRoles = localStorage.getItem('hl_hrm_roles_v2');
      if (!savedRoles) return true;
      try { rolesList = JSON.parse(savedRoles); } catch {}
    }
    if (rolesList.length === 0) return true;
    try {
      
      // Khớp mã NV (emp_1 -> NV001, etc.)
      const nvId = currentUser?.id?.replace('emp_', 'NV').replace('NV', () => {
        const num = currentUser.id.split('_')[1];
        if (!num) return 'NV';
        return 'NV' + num.padStart(3, '0');
      });

      // Tìm nhóm vai trò chứa nhân sự này
      const role = rolesList.find((r: any) => 
        r.memberIds?.includes(currentUser?.id) || 
        r.memberIds?.includes(nvId)
      );

      if (role) {
        const modulePerms = role.permissions[moduleKey];
        if (modulePerms) {
          return !!modulePerms[actionKey];
        }
      } else {
        // Fallback theo vai trò mặc định dựa trên currentUser.role trong App.tsx
        let defaultRoleId = 'role_office';
        if (currentUser?.role === 'director') defaultRoleId = 'role_admin';
        else if (currentUser?.role === 'accountant') defaultRoleId = 'role_accounting';

        const defRole = rolesList.find((r: any) => r.id === defaultRoleId);
        if (defRole && defRole.permissions[moduleKey]) {
          return !!defRole.permissions[moduleKey][actionKey];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return true;
  };

  const canView = getPermission('quotes', 'view');
  const canCreate = getPermission('quotes', 'create');
  const canEdit = getPermission('quotes', 'edit');
  const canDelete = getPermission('quotes', 'delete');

  const handleSaveQuote = (newQuote: Quote) => {
    if (!canCreate) {
      addToast({ title: '⛔ Không có quyền', message: 'Tài khoản của bạn không có quyền THÊM/TẠO báo giá mới.', type: 'error' });
      return;
    }
    onAddQuote(newQuote);
  };

  // We can manage the active subtab in Quotation System
  // 'furniture' | 'construction' | 'mechanical' | 'subcontractor'
  const [activeTab, setActiveTab] = React.useState<'furniture' | 'construction' | 'mechanical' | 'subcontractor'>(
    initialTab === 'dashboard' ? 'construction' : (initialTab as any) || 'construction'
  );

  React.useEffect(() => {
    setActiveTab(initialTab === 'dashboard' ? 'construction' : (initialTab as any) || 'construction');
  }, [initialTab]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'furniture' | 'construction' | 'mechanical' | 'subcontractor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'approved' | 'rejected'>('all');
  const [furnitureSubTab, setFurnitureSubTab] = useState<'estimator' | 'catalog' | 'archive' | 'template'>('estimator');
  const [subcontractorSubTab, setSubcontractorSubTab] = useState<'estimator' | 'archive' | 'template'>('estimator');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [constructionSubTab, setConstructionSubTab] = useState<'quotes_folder' | 'norms' | 'archive' | 'template'>('quotes_folder');
  const [quotesFolderTab, setQuotesFolderTab] = useState<'estimator' | 'takeoff' | 'final_quote'>('estimator');
  const [normsInnerTab, setNormsInnerTab] = useState<'price' | 'composition' | 'material_labor'>('price');
  const [constructionSearchTerm, setConstructionSearchTerm] = useState('');
  const [mechanicalSubTab, setMechanicalSubTab] = useState<'estimator' | 'archive' | 'template'>('estimator');

  // --- SHARED STATES FOR CONSTRUCTION PROJECT & CUSTOMER ---
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(preselectedProjectId || '');
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // --- NEW LOCK & SAVE CONTROL STATES FOR CONSTRUCTION ESTIMATOR, TAKEOFF, AND FINAL QUOTE ---
  const [isConstructionSaved, setIsConstructionSaved] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loadedQuote, setLoadedQuote] = useState<Quote | null>(null);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [isArchiveDropdownOpen, setIsArchiveDropdownOpen] = useState(false);

  // --- NEW LOCK & SAVE CONTROL STATES FOR CABINET/FURNITURE ESTIMATOR ---
  const [isCabinetSaved, setIsCabinetSaved] = useState(false);
  const [isCabinetLocked, setIsCabinetLocked] = useState(false);
  const [loadedCabinetQuote, setLoadedCabinetQuote] = useState<Quote | ArchivedQuote | null>(null);
  const [cabinetArchiveSearchQuery, setCabinetArchiveSearchQuery] = useState('');
  const [isCabinetArchiveDropdownOpen, setIsCabinetArchiveDropdownOpen] = useState(false);
  const [archivedCabinetQuotesList, setArchivedCabinetQuotesList] = useState<ArchivedQuote[]>([]);

  // --- NEW LOCK & SAVE CONTROL STATES FOR MECHANICAL ESTIMATOR ---
  const [isMechanicalSaved, setIsMechanicalSaved] = useState(false);
  const [isMechanicalLocked, setIsMechanicalLocked] = useState(false);
  const [loadedMechanicalQuote, setLoadedMechanicalQuote] = useState<Quote | ArchivedQuote | null>(null);
  const [mechanicalArchiveSearchQuery, setMechanicalArchiveSearchQuery] = useState('');
  const [isMechanicalArchiveDropdownOpen, setIsMechanicalArchiveDropdownOpen] = useState(false);
  const [archivedMechanicalQuotesList, setArchivedMechanicalQuotesList] = useState<ArchivedQuote[]>([]);

  // --- NEW LOCK & SAVE CONTROL STATES FOR SUBCONTRACTOR ESTIMATOR ---
  const [isSubcontractorSaved, setIsSubcontractorSaved] = useState(false);
  const [isSubcontractorLocked, setIsSubcontractorLocked] = useState(false);
  const [loadedSubcontractorQuote, setLoadedSubcontractorQuote] = useState<Quote | ArchivedQuote | null>(null);
  const [subcontractorArchiveSearchQuery, setSubcontractorArchiveSearchQuery] = useState('');
  const [isSubcontractorArchiveDropdownOpen, setIsSubcontractorArchiveDropdownOpen] = useState(false);
  const [archivedSubcontractorQuotesList, setArchivedSubcontractorQuotesList] = useState<ArchivedQuote[]>([]);

  // --- LIFTED ESTIMATOR STATES (Defaults to 0 / empty, avoiding old session restoration unless loading a quote) ---
  const [chieuDai, setChieuDai] = useState<number>(0);
  const [chieuRong, setChieuRong] = useState<number>(0);
  const [soTang, setSoTang] = useState<number>(0);
  const [selectedHouseType, setSelectedHouseType] = useState<string>('');
  const [donGiaKhaiToan, setDonGiaKhaiToan] = useState<number>(0);
  const [nganSachNoiThat, setNganSachNoiThat] = useState<number>(0);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);

  // Keep sessionStorage in sync so that other tabs/sub-components can read them
  useEffect(() => {
    sessionStorage.setItem('hl_construction_house_type', selectedHouseType);
    sessionStorage.setItem('hl_construction_chieu_dai', chieuDai.toString());
    sessionStorage.setItem('hl_construction_chieu_rong', chieuRong.toString());
    sessionStorage.setItem('hl_construction_so_tang', soTang.toString());
    sessionStorage.setItem('hl_construction_don_gia', donGiaKhaiToan.toString());
    sessionStorage.setItem('hl_construction_ngan_sach', nganSachNoiThat.toString());
    sessionStorage.setItem('hl_construction_items', JSON.stringify(quoteItems));
  }, [selectedHouseType, chieuDai, chieuRong, soTang, donGiaKhaiToan, nganSachNoiThat, quoteItems]);

  // Sync loadedQuote to populate other shared states immediately
  useEffect(() => {
    if (loadedQuote) {
      if (loadedQuote.projectName) setProjectName(loadedQuote.projectName);
      if (loadedQuote.customerName) setCustomerName(loadedQuote.customerName);
      if (loadedQuote.customerPhone) setCustomerPhone(loadedQuote.customerPhone);
      if (loadedQuote.customerAddress) setCustomerAddress(loadedQuote.customerAddress);
      if (loadedQuote.projectId) setSelectedProjectId(loadedQuote.projectId);
      if (loadedQuote.customerId) setSelectedCustomerId(loadedQuote.customerId);
      
      if (loadedQuote.chieuDai !== undefined) setChieuDai(loadedQuote.chieuDai);
      if (loadedQuote.chieuRong !== undefined) setChieuRong(loadedQuote.chieuRong);
      if (loadedQuote.soTang !== undefined) setSoTang(loadedQuote.soTang);
      if (loadedQuote.selectedHouseType) setSelectedHouseType(loadedQuote.selectedHouseType);
      if (loadedQuote.donGiaKhaiToan !== undefined) setDonGiaKhaiToan(loadedQuote.donGiaKhaiToan);
      if (loadedQuote.nganSachNoiThat !== undefined) setNganSachNoiThat(loadedQuote.nganSachNoiThat);
      if (loadedQuote.items) setQuoteItems(loadedQuote.items);
      
      setIsConstructionSaved(true);
      setIsLocked(true);
    }
  }, [loadedQuote]);

  // Listener for instant archived quote reloading
  useEffect(() => {
    const handleUpdate = () => {
      dbService.archivedConstructionQuotes.list()
        .then(list => setArchivedQuotesList(list))
        .catch(err => console.error("Lỗi khi tải hồ sơ lưu trữ:", err));
    };
    const handleCabinetUpdate = () => {
      dbService.archivedCabinetQuotes.list()
        .then(list => setArchivedCabinetQuotesList(list))
        .catch(err => console.error("Lỗi khi tải hồ sơ lưu trữ nội thất:", err));
    };
    const handleMechanicalUpdate = () => {
      dbService.archivedMechanicalQuotes.list()
        .then(list => setArchivedMechanicalQuotesList(list))
        .catch(err => console.error("Lỗi khi tải hồ sơ lưu trữ cơ khí:", err));
    };
    const handleSubcontractorUpdate = () => {
      dbService.archivedSubcontractorQuotes.list()
        .then(list => setArchivedSubcontractorQuotesList(list))
        .catch(err => console.error("Lỗi khi tải hồ sơ lưu trữ thầu phụ:", err));
    };
    window.addEventListener('hl-archived-quotes-updated', handleUpdate);
    window.addEventListener('hl-archived-cabinet-quotes-updated', handleCabinetUpdate);
    window.addEventListener('hl-archived-mechanical-quotes-updated', handleMechanicalUpdate);
    window.addEventListener('hl-archived-subcontractor-quotes-updated', handleSubcontractorUpdate);
    return () => {
      window.removeEventListener('hl-archived-quotes-updated', handleUpdate);
      window.removeEventListener('hl-archived-cabinet-quotes-updated', handleCabinetUpdate);
      window.removeEventListener('hl-archived-mechanical-quotes-updated', handleMechanicalUpdate);
      window.removeEventListener('hl-archived-subcontractor-quotes-updated', handleSubcontractorUpdate);
    };
  }, []);

  const handleStartNewCabinetQuote = () => {
    setLoadedCabinetQuote(null);
    setIsCabinetSaved(false);
    setIsCabinetLocked(false);
  };

  const handleStartNewMechanicalQuote = () => {
    setLoadedMechanicalQuote(null);
    setIsMechanicalSaved(false);
    setIsMechanicalLocked(false);
  };

  const handleStartNewSubcontractorQuote = () => {
    setLoadedSubcontractorQuote(null);
    setIsSubcontractorSaved(false);
    setIsSubcontractorLocked(false);
  };

  const handleStartNewQuote = () => {
    setLoadedQuote(null);
    setIsConstructionSaved(false);
    setIsLocked(false);
    
    // Clear shared states
    setSelectedCustomerId('');
    setSelectedProjectId('');
    setProjectName('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');

    // Reset lifted states to 0/empty
    setChieuDai(0);
    setChieuRong(0);
    setSoTang(0);
    setSelectedHouseType('');
    setDonGiaKhaiToan(0);
    setNganSachNoiThat(0);
    setQuoteItems([]);
    
    // Clear sub-component localStorages/sessionStorages if they exist
    localStorage.removeItem('hl_construction_chieu_dai');
    localStorage.removeItem('hl_construction_chieu_rong');
    localStorage.removeItem('hl_construction_so_tang');
    localStorage.removeItem('hl_construction_house_type');
    localStorage.removeItem('hl_construction_don_gia');
    localStorage.removeItem('hl_construction_ngan_sach');
    localStorage.removeItem('hl_construction_items');
    localStorage.removeItem('hl_construction_config');
    localStorage.removeItem('hl_construction_notes');
    localStorage.removeItem('hl_construction_payment_terms');
    localStorage.removeItem('takeoff_rows');
    localStorage.removeItem('hl_final_quote_quantities');
    localStorage.removeItem('hl_final_quote_prices');
    localStorage.removeItem('takeoff_saved_totals');
    
    sessionStorage.removeItem('hl_construction_chieu_dai');
    sessionStorage.removeItem('hl_construction_chieu_rong');
    sessionStorage.removeItem('hl_construction_so_tang');
    sessionStorage.removeItem('hl_construction_house_type');
    sessionStorage.removeItem('hl_construction_don_gia');
    sessionStorage.removeItem('hl_construction_ngan_sach');
    sessionStorage.removeItem('hl_construction_items');
    sessionStorage.removeItem('hl_construction_config');
    sessionStorage.removeItem('hl_construction_notes');
    sessionStorage.removeItem('hl_construction_payment_terms');
    sessionStorage.removeItem('takeoff_rows');
    sessionStorage.removeItem('hl_final_quote_quantities');
    sessionStorage.removeItem('hl_final_quote_prices');
    sessionStorage.removeItem('takeoff_saved_totals');
  };

  // Dropdowns
  const [isProjDropdownOpen, setIsProjDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [showQuickCreateCust, setShowQuickCreateCust] = useState(false);

  // Quick creation inputs
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');

  const [archivedQuotesList, setArchivedQuotesList] = useState<ArchivedQuote[]>([]);

  useEffect(() => {
    let active = true;
    const fetchArchivedQuotes = async () => {
      try {
        const list = await dbService.archivedConstructionQuotes.list();
        if (active) {
          setArchivedQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ:", err);
      }
    };
    const fetchArchivedCabinetQuotes = async () => {
      try {
        const list = await dbService.archivedCabinetQuotes.list();
        if (active) {
          setArchivedCabinetQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ nội thất:", err);
      }
    };
    const fetchArchivedMechanicalQuotes = async () => {
      try {
        const list = await dbService.archivedMechanicalQuotes.list();
        if (active) {
          setArchivedMechanicalQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ cơ khí:", err);
      }
    };
    const fetchArchivedSubcontractorQuotes = async () => {
      try {
        const list = await dbService.archivedSubcontractorQuotes.list();
        if (active) {
          setArchivedSubcontractorQuotesList(list);
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ lưu trữ thầu phụ:", err);
      }
    };
    fetchArchivedQuotes();
    fetchArchivedCabinetQuotes();
    fetchArchivedMechanicalQuotes();
    fetchArchivedSubcontractorQuotes();
    return () => { active = false; };
  }, [projects]);

  // Project update triggers
  useEffect(() => {
    if (preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
    }
  }, [preselectedProjectId]);

  useEffect(() => {
    if (preselectedCustomerId) {
      setSelectedCustomerId(preselectedCustomerId);
    }
  }, [preselectedCustomerId]);

  // Auto-load subcontractor contract for print/view
  useEffect(() => {
    const viewContractId = localStorage.getItem('hl_view_contract_id');
    if (viewContractId && archivedSubcontractorQuotesList.length > 0) {
      const found = archivedSubcontractorQuotesList.find(q => q.id === viewContractId);
      if (found) {
        setLoadedSubcontractorQuote(found);
        setSubcontractorSubTab('estimator');
        localStorage.removeItem('hl_view_contract_id');
      }
    }
  }, [archivedSubcontractorQuotesList]);

  // Synchronize when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj) {
        const cust = customers.find(c => c.id === proj.customerId);
        setCustomerName(cust ? cust.name : '');
        setCustomerAddress(proj.address || (cust ? cust.address : ''));
        setCustomerPhone(cust ? cust.phone : '');
        setSelectedCustomerId(proj.customerId);
        setProjectName(proj.name);
      }
    }
  }, [selectedProjectId, projects, customers]);

  // Handle select customer manually
  const handleSelectCustomer = (cust: Customer) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone || '');
    setCustomerAddress(cust.address || '');
    setIsCustDropdownOpen(false);
    setCustSearchQuery('');

    // If there is an active project, update it
    if (selectedProjectId) {
      const proj = projects.find(p => p.id === selectedProjectId);
      if (proj && proj.customerId !== cust.id) {
        dbService.projects.save({
          ...proj,
          customerId: cust.id,
          address: cust.address || proj.address
        }).then(() => {
          window.dispatchEvent(new CustomEvent('hl-projects-updated'));
        }).catch(err => console.error(err));
      }
    }
  };

  // Handle quick customer creation
  const handleQuickCreateCustomer = async () => {
    if (!quickCustName.trim() || !quickCustPhone.trim() || !quickCustAddress.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập đầy đủ Tên, Số điện thoại và Địa chỉ!', type: 'warning' });
      return;
    }
    const newCustId = `cust_${Date.now()}`;
    const newCust = {
      id: newCustId,
      name: quickCustName.trim(),
      phone: quickCustPhone.trim(),
      address: quickCustAddress.trim(),
      email: '',
    };
    try {
      await dbService.customers.save(newCust);
      window.dispatchEvent(new CustomEvent('hl-customers-updated'));
      
      // Auto select
      setSelectedCustomerId(newCustId);
      setCustomerName(newCust.name);
      setCustomerPhone(newCust.phone);
      setCustomerAddress(newCust.address);
      
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustAddress('');
      setShowQuickCreateCust(false);
    } catch (err) {
      console.error("Lỗi tạo khách hàng nhanh:", err);
      addToast({ title: '❌ Lỗi', message: 'Có lỗi xảy ra khi tạo khách hàng.', type: 'error' });
    }
  };

  // --- LOCAL STATES FOR BUILDING NORMS & PRICING ---
  const [houseEstimatePrices, setHouseEstimatePrices] = useState<{ stt: number; type: string; avgPrice: number; minPrice: number; maxPrice: number; features: string }[]>(() => {
    const local = localStorage.getItem('house_estimate_prices');
    return local ? JSON.parse(local) : HOUSE_ESTIMATE_PRICES;
  });

  const [materialCompositionNorms, setMaterialCompositionNorms] = useState<{ id: string; name: string; unit: string; brick?: number; cement?: number; sand?: number; stone?: number | null; steel?: number | null; water?: number; notes?: string }[]>(() => {
    const local = localStorage.getItem('material_composition_norms');
    return local ? JSON.parse(local) : MATERIAL_COMPOSITION_NORMS;
  });

  const [materialLaborPrices, setMaterialLaborPrices] = useState<{ group: string; name: string; unit: string; avgPrice: number; minPrice: number; maxPrice: number; notes?: string }[]>(() => {
    const local = localStorage.getItem('material_labor_prices');
    return local ? JSON.parse(local) : MATERIAL_LABOR_PRICES;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [editingItem, setEditingItem] = useState<{
    tab: 'price' | 'composition' | 'material_labor';
    action: 'add' | 'edit';
    data: any;
  } | null>(null);

  const updateHouseEstimatePrices = (newData: any[]) => {
    setHouseEstimatePrices(newData);
    localStorage.setItem('house_estimate_prices', JSON.stringify(newData));
  };

  const updateMaterialCompositionNorms = (newData: any[]) => {
    setMaterialCompositionNorms(newData);
    localStorage.setItem('material_composition_norms', JSON.stringify(newData));
  };

  const updateMaterialLaborPrices = (newData: any[]) => {
    setMaterialLaborPrices(newData);
    localStorage.setItem('material_labor_prices', JSON.stringify(newData));
  };

  const handleDeletePrice = (stt: number) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đơn giá khái toán này không?')) {
      const filtered = houseEstimatePrices.filter(p => p.stt !== stt);
      const reindexed = filtered.map((item, idx) => ({ ...item, stt: idx + 1 }));
      updateHouseEstimatePrices(reindexed);
    }
  };

  const handleDeleteNorm = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa định mức cấp phối này không?')) {
      const filtered = materialCompositionNorms.filter(n => n.id !== id);
      updateMaterialCompositionNorms(filtered);
    }
  };

  const handleDeleteMaterialLabor = (name: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đơn giá vật tư/nhân công này không?')) {
      const filtered = materialLaborPrices.filter(p => p.name !== name);
      updateMaterialLaborPrices(filtered);
    }
  };

  const handleSaveEditedItem = (tab: string, action: string, updatedData: any) => {
    if (tab === 'price') {
      if (action === 'add') {
        updateHouseEstimatePrices([...houseEstimatePrices, updatedData]);
      } else {
        updateHouseEstimatePrices(houseEstimatePrices.map(p => p.stt === updatedData.stt ? updatedData : p));
      }
    } else if (tab === 'composition') {
      if (action === 'add') {
        updateMaterialCompositionNorms([...materialCompositionNorms, updatedData]);
      } else {
        updateMaterialCompositionNorms(materialCompositionNorms.map(n => n.id === updatedData.id ? updatedData : n));
      }
    } else if (tab === 'material_labor') {
      if (action === 'add') {
        updateMaterialLaborPrices([...materialLaborPrices, updatedData]);
      } else {
        updateMaterialLaborPrices(materialLaborPrices.map(p => p.name === updatedData.name ? updatedData : p));
      }
    }
    setEditingItem(null);
  };

  // ─── IMPORT / EXPORT EXCEL CHO 3 BẢNG ĐỊNH MỨC & ĐƠN GIÁ ───
  const handleExportExcel = (tab: 'price' | 'composition' | 'material_labor') => {
    if (tab === 'price') {
      const data = houseEstimatePrices.map((p, idx) => ({
        'STT': idx + 1,
        'Loại nhà': p.type,
        'Đơn giá TB (đ/m²)': p.avgPrice,
        'Giá thấp (đ/m²)': p.minPrice,
        'Giá cao (đ/m²)': p.maxPrice,
        'Đặc điểm kết cấu chính': p.features,
      }));
      exportToExcel(data, 'DonGiaKhaiToan', `Don_Gia_Khai_Toan_${formatDateForFile()}.xlsx`);
    } else if (tab === 'composition') {
      const data = materialCompositionNorms.map(n => ({
        'Mã ĐM': n.id,
        'Tên công tác': n.name,
        'Đơn vị': n.unit,
        'Gạch (viên)': n.brick ?? '',
        'XM (kg)': n.cement ?? '',
        'Cát (m³)': n.sand ?? '',
        'Đá (m³)': n.stone ?? '',
        'Thép (kg)': n.steel ?? '',
        'Nước (L)': n.water ?? '',
        'Ghi chú': n.notes ?? '',
      }));
      exportToExcel(data, 'DinhMucCapPhoi', `Dinh_Muc_Cap_Phoi_Vat_Tu_${formatDateForFile()}.xlsx`);
    } else {
      const data = materialLaborPrices.map((p, idx) => ({
        'STT': idx + 1,
        'Nhóm': p.group,
        'Tên vật tư / nhân công': p.name,
        'Đơn vị': p.unit,
        'Đơn giá TB (đ)': p.avgPrice,
        'Giá thấp (đ)': p.minPrice,
        'Giá cao (đ)': p.maxPrice,
        'Nguồn / Ghi chú': p.notes ?? '',
      }));
      exportToExcel(data, 'DonGiaVatTuNhanCong', `Don_Gia_Vat_Tu_Nhan_Cong_${formatDateForFile()}.xlsx`);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset để chọn lại cùng file
    if (!file) return;
    setIsImporting(true);
    try {
      const tab = normsInnerTab;
      const rows = await importFromExcel<Record<string, any>>(file, (row) => row);
      if (rows.length === 0) {
        alert('File Excel không có dữ liệu hoặc không đúng định dạng.');
        setIsImporting(false);
        return;
      }
      if (tab === 'price') {
        const mapped = rows.map((r, idx) => ({
          stt: idx + 1,
          type: String(r['Loại nhà'] ?? r['Loai nha'] ?? '').trim(),
          avgPrice: Number(String(r['Đơn giá TB (đ/m²)'] ?? r['Don gia TB'] ?? '0').replace(/[^\d.-]/g, '')) || 0,
          minPrice: Number(String(r['Giá thấp (đ/m²)'] ?? r['Gia thap'] ?? '0').replace(/[^\d.-]/g, '')) || 0,
          maxPrice: Number(String(r['Giá cao (đ/m²)'] ?? r['Gia cao'] ?? '0').replace(/[^\d.-]/g, '')) || 0,
          features: String(r['Đặc điểm kết cấu chính'] ?? r['Dac diem ket cau'] ?? '').trim(),
        })).filter(p => p.type);
        if (mapped.length === 0) { alert('Không tìm thấy cột "Loại nhà" trong file.'); setIsImporting(false); return; }
        updateHouseEstimatePrices(mapped);
      } else if (tab === 'composition') {
        const mapped = rows.map((r) => ({
          id: String(r['Mã ĐM'] ?? r['Ma DM'] ?? '').trim(),
          name: String(r['Tên công tác'] ?? r['Ten cong tac'] ?? '').trim(),
          unit: String(r['Đơn vị'] ?? r['Don vi'] ?? '').trim(),
          brick: r['Gạch (viên)'] === '' || r['Gạch (viên)'] == null ? null : Number(String(r['Gạch (viên)']).replace(/[^\d.-]/g, '')) || 0,
          cement: r['XM (kg)'] === '' || r['XM (kg)'] == null ? null : Number(String(r['XM (kg)']).replace(/[^\d.-]/g, '')) || 0,
          sand: r['Cát (m³)'] === '' || r['Cát (m³)'] == null ? null : Number(String(r['Cát (m³)']).replace(/[^\d.-]/g, '')) || 0,
          stone: r['Đá (m³)'] === '' || r['Đá (m³)'] == null ? null : Number(String(r['Đá (m³)']).replace(/[^\d.-]/g, '')) || 0,
          steel: r['Thép (kg)'] === '' || r['Thép (kg)'] == null ? null : Number(String(r['Thép (kg)']).replace(/[^\d.-]/g, '')) || 0,
          water: r['Nước (L)'] === '' || r['Nước (L)'] == null ? null : Number(String(r['Nước (L)']).replace(/[^\d.-]/g, '')) || 0,
          notes: String(r['Ghi chú'] ?? r['Ghi chu'] ?? '').trim(),
        })).filter(n => n.id && n.name);
        if (mapped.length === 0) { alert('Không tìm thấy cột "Mã ĐM" hoặc "Tên công tác" trong file.'); setIsImporting(false); return; }
        updateMaterialCompositionNorms(mapped);
      } else {
        const mapped = rows.map((r, idx) => ({
          group: String(r['Nhóm'] ?? r['Nhom'] ?? 'VẬT LIỆU CHÍNH').trim(),
          name: String(r['Tên vật tư / nhân công'] ?? r['Ten vat tu'] ?? '').trim(),
          unit: String(r['Đơn vị'] ?? r['Don vi'] ?? '').trim(),
          avgPrice: Number(String(r['Đơn giá TB (đ)'] ?? r['Don gia TB'] ?? '0').replace(/[^\d.-]/g, '')) || 0,
          minPrice: Number(String(r['Giá thấp (đ)'] ?? r['Gia thap'] ?? '0').replace(/[^\d.-]/g, '')) || 0,
          maxPrice: Number(String(r['Giá cao (đ)'] ?? r['Gia cao'] ?? '0').replace(/[^\d.-]/g, '')) || 0,
          notes: String(r['Nguồn / Ghi chú'] ?? r['Ghi chu'] ?? '').trim(),
        })).filter(p => p.name);
        if (mapped.length === 0) { alert('Không tìm thấy cột "Tên vật tư / nhân công" trong file.'); setIsImporting(false); return; }
        updateMaterialLaborPrices(mapped);
      }
      alert(`Đã nhập thành công ${rows.length} dòng từ file Excel.`);
    } catch (err) {
      console.error('Lỗi import Excel:', err);
      alert('Có lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file.');
    } finally {
      setIsImporting(false);
    }
  };

  // Map customer mapping for quick view
  const customerMap = useMemo(() => {
    return new Map(customers.map(c => [c.id, c]));
  }, [customers]);

  // Map project mapping for quick view
  const projectMap = useMemo(() => {
    return new Map(projects.map(p => [p.id, p]));
  }, [projects]);

  // Classify quotes by type:
  // BG- -> Furniture
  // BGXD- -> Construction
  // BGME- -> Mechanical
  const getQuoteType = (quote: Quote) => {
    if (quote.code.startsWith('BGXD-')) return 'construction';
    if (quote.code.startsWith('BGME-')) return 'mechanical';
    return 'furniture';
  };

  // Filtered quotes list
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const qType = getQuoteType(q);
      const cust = customerMap.get(q.customerId);
      const proj = q.projectId ? projectMap.get(q.projectId) : null;
      
      const matchesSearch = 
        q.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (cust?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proj?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.notes || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === 'all' || qType === typeFilter;
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [quotes, searchTerm, typeFilter, statusFilter, customerMap, projectMap]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalValue = 0;
    
    let approvedCount = 0;
    let approvedValue = 0;

    let rejectedCount = 0;
    let rejectedValue = 0;

    let pendingCount = 0;
    let pendingValue = 0;

    let furnitureCount = 0;
    let constructionCount = 0;
    let mechanicalCount = 0;

    quotes.forEach(q => {
      const type = getQuoteType(q);
      const val = (q.items || []).reduce((sum, item) => sum + (item.totalPrice || 0), 0);
      
      totalValue += val;

      if (type === 'furniture') furnitureCount++;
      else if (type === 'construction') constructionCount++;
      else if (type === 'mechanical') mechanicalCount++;

      if (q.status === 'approved') {
        approvedCount++;
        approvedValue += val;
      } else if (q.status === 'rejected') {
        rejectedCount++;
        rejectedValue += val;
      } else {
        pendingCount++;
        pendingValue += val;
      }
    });

    return {
      totalCount: quotes.length,
      totalValue,
      approvedCount,
      approvedValue,
      rejectedCount,
      rejectedValue,
      pendingCount,
      pendingValue,
      furnitureCount,
      constructionCount,
      mechanicalCount
    };
  }, [quotes]);

  // Trigger export selected list
  const handleExportCSV = () => {
    let csvContent = "Mã Báo Giá,Khách Hàng,Dự Án,Lĩnh Vực,Ngày Lập,Tổng Giá Trị (VND),Trạng Thái\n";
    filteredQuotes.forEach(q => {
      const custName = customerMap.get(q.customerId)?.name || "Khách lẻ";
      const projName = q.projectId ? projectMap.get(q.projectId)?.name || "Không" : "Không";
      const typeStr = getQuoteType(q) === 'furniture' ? 'Nội Thất' : getQuoteType(q) === 'construction' ? 'Xây Dựng' : 'Cơ Khí';
      const totalVal = (q.items || []).reduce((sum, i) => sum + (i.totalPrice || 0), 0);
      const statusStr = q.status === 'approved' ? 'Thành công (Đã duyệt)' : q.status === 'rejected' ? 'Không thành công' : 'Đang thương thảo';
      
      csvContent += `"${q.code}","${custName}","${projName}","${typeStr}","${q.date}",${totalVal},"${statusStr}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_Cao_He_Thong_Bao_Gia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Nếu không có quyền xem → trả về null (menu đã bị ẩn ở App.tsx)
  if (!canView) return null;

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-sans" id="integrated_quotation_system">
      
      {/* CORE DISPLAY WORKSPACE */}
      <div className="p-6">
        
        {/* TAB: CABINET / FURNITURE ESTIMATOR */}
        {activeTab === 'furniture' && (
          <div className="space-y-4">
            {/* SUB-TABS FOR FURNITURE */}
            <div className="flex border-b border-slate-800 gap-6 pb-2 mb-4" id="furniture_sub_tabs">
              <button
                type="button"
                onClick={() => setFurnitureSubTab('estimator')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${furnitureSubTab === 'estimator' ? 'text-amber-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📋 Lập Báo Giá Nội Thất
                {furnitureSubTab === 'estimator' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 rounded-full" id="est_furniture_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setFurnitureSubTab('catalog')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${furnitureSubTab === 'catalog' ? 'text-amber-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                🏷️ Danh mục sản phẩm Nội Thất
                {furnitureSubTab === 'catalog' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 rounded-full" id="cat_furniture_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setFurnitureSubTab('archive')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${furnitureSubTab === 'archive' ? 'text-amber-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Lưu Trữ Hồ Sơ Nội Thất
                {furnitureSubTab === 'archive' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 rounded-full" id="archive_furniture_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setFurnitureSubTab('template')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${furnitureSubTab === 'template' ? 'text-amber-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Mẫu Hồ sơ
                {furnitureSubTab === 'template' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-500 rounded-full" id="template_furniture_tab_indicator" />
                )}
              </button>
            </div>

            {furnitureSubTab === 'estimator' ? (
              <>
                {/* Search Archived Cabinet Quote & Quick Start Top Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4.5 rounded-xl border border-slate-800 text-xs text-left mb-4">
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">
                        Tìm nhanh hồ sơ báo giá nội thất
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Chọn một hồ sơ báo giá nội thất đã lưu để tải lại hoặc bấm "Lập mới" để đặt lại
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative" id="archived_cabinet_quote_search_dropdown_top">
                      <button
                        type="button"
                        onClick={() => setIsCabinetArchiveDropdownOpen(!isCabinetArchiveDropdownOpen)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold hover:border-slate-700 transition-all text-left w-64 justify-between cursor-pointer text-xs"
                      >
                        <span className="truncate">
                          {loadedCabinetQuote ? (
                            <span className="text-[#00a651] font-bold">📂 {loadedCabinetQuote.code} - {loadedCabinetQuote.customerName}</span>
                          ) : (
                            <span className="text-slate-400 font-medium">🔍 Tìm nhanh hồ sơ nội thất...</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">▼</span>
                      </button>

                      {isCabinetArchiveDropdownOpen && (
                        <div className="absolute left-0 md:right-0 mt-2 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-72 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={cabinetArchiveSearchQuery}
                              onChange={(e) => setCabinetArchiveSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-amber-500 font-medium placeholder-slate-500 transition-all"
                              placeholder="Nhập tên, SĐT, mã hồ sơ nội thất..."
                            />
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
                          </div>

                          <div className="space-y-1">
                            {(() => {
                              const userFilteredList = archivedCabinetQuotesList.filter(q => q.creatorId === currentUser?.id);
                              const matches = userFilteredList.filter(q => 
                                (q.customerName || '').toLowerCase().includes(cabinetArchiveSearchQuery.toLowerCase()) ||
                                (q.customerPhone || '').toLowerCase().includes(cabinetArchiveSearchQuery.toLowerCase()) ||
                                (q.code || '').toLowerCase().includes(cabinetArchiveSearchQuery.toLowerCase()) ||
                                (q.projectName || '').toLowerCase().includes(cabinetArchiveSearchQuery.toLowerCase())
                              );

                              if (matches.length === 0) {
                                return (
                                  <div className="text-center py-4 text-slate-500 italic text-xs">
                                    Không có hồ sơ nào khớp
                                  </div>
                                );
                              }

                              return matches.map((q) => (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    setLoadedCabinetQuote(q);
                                    setIsCabinetArchiveDropdownOpen(false);
                                    setCabinetArchiveSearchQuery('');
                                  }}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                    loadedCabinetQuote?.id === q.id 
                                      ? 'bg-amber-950/40 text-amber-400 border border-amber-900 font-bold' 
                                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="font-bold text-slate-200 text-left flex items-center justify-between">
                                    <span>{q.code}</span>
                                    <span className="text-[10px] text-slate-550">{q.createdAt || q.date}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 text-left font-semibold">
                                    {q.customerName} - {q.customerPhone}
                                  </div>
                                  <div className="text-[9px] text-slate-500 truncate text-left mt-0.5 font-mono">
                                    DA: {q.projectName || 'Độc lập'}
                                  </div>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reset to Start fresh button */}
                    <button
                      type="button"
                      onClick={handleStartNewCabinetQuote}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Lập hồ sơ nội thất mới"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Lập mới
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl text-left text-xs mb-4">
                  <span className="font-extrabold text-amber-400 uppercase text-[10px] block mb-1">MÔ HÌNH THẦU BÀN BẾP, KỆ TỦ, GIƯỜNG NGĂN GỖ CÔNG NGHIỆP</span>
                  Định mức hao mòn ván An Cường, gỗ sồi sấy dẻo dai bám dính Acrylic không đường line dính. Tính toán phụ kiện mâm xoay Blum Hafele.
                </div>
                
                <CabinetEstimator 
                  customers={customers}
                  projects={projects}
                  onAddQuote={handleSaveQuote}
                  preselectedCustomerId={preselectedCustomerId}
                  preselectedProjectId={preselectedProjectId}
                  currentUser={currentUser}
                  isCabinetSaved={isCabinetSaved}
                  setIsCabinetSaved={setIsCabinetSaved}
                  isLocked={isCabinetLocked}
                  setIsLocked={setIsCabinetLocked}
                  loadedQuote={loadedCabinetQuote}
                  setLoadedQuote={setLoadedCabinetQuote}
                />
              </>
            ) : furnitureSubTab === 'catalog' ? (
              <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-xl overflow-hidden text-left" id="furniture_product_catalog_container">
                <div className="mb-4 border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black uppercase text-amber-400 tracking-wide">
                      DANH MỤC SẢN PHẨM NỘI THẤT
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Hệ thống cập nhật và lưu trữ sản phẩm nội thất gỗ công nghiệp chất liệu ván phủ Acrylic, Melamin, Plywood Thái Lan & An Cường chính hãng.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Tìm kiếm sản phẩm..."
                      value={catalogSearchTerm}
                      onChange={(e) => setCatalogSearchTerm(e.target.value)}
                      className="bg-slate-950 border border-slate-800 outline-none text-xs text-slate-200 rounded-lg px-3 py-2 pl-8 font-medium focus:border-amber-500 w-52"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <ProductCatalogTable searchTerm={catalogSearchTerm} />
              </div>
            ) : furnitureSubTab === 'template' ? (
              <div className="space-y-4">
                <CabinetEstimator
                  customers={customers}
                  projects={projects}
                  showTemplateOnly={true}
                />
              </div>
            ) : (
              <CabinetArchive currentUser={currentUser} canEdit={canEdit} canDelete={canDelete} />
            )}
          </div>
        )}

        {/* TAB: SUBCONTRACTOR ESTIMATOR */}
        {activeTab === 'subcontractor' && (
          <div className="space-y-4">
            {/* SUB-TABS FOR SUBCONTRACTOR */}
            <div className="flex border-b border-slate-800 gap-6 pb-2 mb-4" id="subcontractor_sub_tabs">
              <button
                type="button"
                onClick={() => setSubcontractorSubTab('estimator')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${subcontractorSubTab === 'estimator' ? 'text-blue-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📋 Lập HĐ Thầu Phụ
                {subcontractorSubTab === 'estimator' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full" id="est_subcontractor_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSubcontractorSubTab('archive')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${subcontractorSubTab === 'archive' ? 'text-blue-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Lưu Trữ Hồ Sơ Thầu Phụ
                {subcontractorSubTab === 'archive' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full" id="archive_subcontractor_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSubcontractorSubTab('template')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${subcontractorSubTab === 'template' ? 'text-blue-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Mẫu Hồ sơ
                {subcontractorSubTab === 'template' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 rounded-full" id="template_subcontractor_tab_indicator" />
                )}
              </button>
            </div>

            {subcontractorSubTab === 'estimator' ? (
              <>
                {/* Search Archived Subcontractor Quote & Quick Start Top Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4.5 rounded-xl border border-slate-800 text-xs text-left mb-4">
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="w-5 h-5 text-blue-500 shrink-0" />
                    <div>
                      <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">
                        Tìm nhanh hợp đồng thầu phụ đã lập
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Chọn một hợp đồng thầu phụ đã lưu để tải lại hoặc bấm "Lập mới" để đặt lại
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative" id="archived_subcontractor_quote_search_dropdown_top">
                      <button
                        type="button"
                        onClick={() => setIsSubcontractorArchiveDropdownOpen(!isSubcontractorArchiveDropdownOpen)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold hover:border-slate-700 transition-all text-left w-64 justify-between cursor-pointer text-xs"
                      >
                        <span className="truncate">
                          {loadedSubcontractorQuote ? (
                            <span className="text-emerald-400 font-bold">📂 {loadedSubcontractorQuote.code} - {loadedSubcontractorQuote.customerName}</span>
                          ) : (
                            <span className="text-slate-400 font-medium">🔍 Tìm nhanh hợp đồng...</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">▼</span>
                      </button>

                      {isSubcontractorArchiveDropdownOpen && (
                        <div className="absolute left-0 md:right-0 mt-2 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-72 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={subcontractorArchiveSearchQuery}
                              onChange={(e) => setSubcontractorArchiveSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-500 font-medium placeholder-slate-500 transition-all"
                              placeholder="Nhập tên, SĐT, mã hợp đồng thầu phụ..."
                            />
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
                          </div>

                          <div className="space-y-1">
                            {(() => {
                              const userFilteredList = archivedSubcontractorQuotesList.filter(q => q.creatorId === currentUser?.id);
                              const matches = userFilteredList.filter(q => 
                                (q.customerName || '').toLowerCase().includes(subcontractorArchiveSearchQuery.toLowerCase()) ||
                                (q.customerPhone || '').toLowerCase().includes(subcontractorArchiveSearchQuery.toLowerCase()) ||
                                (q.code || '').toLowerCase().includes(subcontractorArchiveSearchQuery.toLowerCase()) ||
                                (q.projectName || '').toLowerCase().includes(subcontractorArchiveSearchQuery.toLowerCase())
                              );

                              if (matches.length === 0) {
                                  return (
                                    <div className="text-center py-4 text-slate-500 italic text-xs">
                                      Không có hồ sơ nào khớp
                                    </div>
                                  );
                                }

                                return matches.map((q) => (
                                  <button
                                    key={q.id}
                                    type="button"
                                    onClick={() => {
                                      setLoadedSubcontractorQuote(q);
                                      setIsSubcontractorArchiveDropdownOpen(false);
                                      setSubcontractorArchiveSearchQuery('');
                                    }}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                      loadedSubcontractorQuote?.id === q.id 
                                        ? 'bg-blue-950/40 text-blue-400 border border-blue-900 font-bold' 
                                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                    }`}
                                  >
                                    <div className="font-bold text-slate-200 text-left flex items-center justify-between">
                                      <span>{q.code}</span>
                                      <span className="text-[10px] text-slate-550">{q.createdAt || q.date}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 text-left font-semibold">
                                      {q.customerName} - {q.customerPhone}
                                    </div>
                                    <div className="text-[9px] text-slate-500 truncate text-left mt-0.5 font-mono">
                                      DA: {q.projectName || 'Độc lập'}
                                    </div>
                                  </button>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reset to Start fresh button */}
                      <button
                        type="button"
                        onClick={handleStartNewSubcontractorQuote}
                        className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Lập hồ sơ thầu phụ mới"
                      >
                        <Plus className="w-4 h-4 text-emerald-400" />
                        Lập mới
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-left text-xs mb-4">
                    <span className="font-extrabold text-blue-400 uppercase text-[10px] block mb-1">MÔ HÌNH QUẢN LÝ THẦU PHỤ NHÂN CÔNG & VẬT TƯ</span>
                    Định mức khối lượng nhân công thầu phụ, nhà cung cấp phụ trợ. Kiểm soát dự toán chi phí thực tế và tiến độ nghiệm thu thầu phụ.
                  </div>

                  <SubcontractorEstimator 
                    customers={customers}
                    projects={projects}
                    onAddQuote={handleSaveQuote}
                    preselectedCustomerId={preselectedCustomerId}
                    preselectedProjectId={preselectedProjectId}
                    currentUser={currentUser}
                    isCabinetSaved={isSubcontractorSaved}
                    setIsCabinetSaved={setIsSubcontractorSaved}
                    isLocked={isSubcontractorLocked}
                    setIsLocked={setIsSubcontractorLocked}
                    loadedQuote={loadedSubcontractorQuote}
                    setLoadedQuote={setLoadedSubcontractorQuote}
                  />
              </>
            ) : subcontractorSubTab === 'template' ? (
              <div className="space-y-4">
                <SubcontractorEstimator
                  customers={customers}
                  projects={projects}
                  showTemplateOnly={true}
                />
              </div>
            ) : (
              <SubcontractorArchive currentUser={currentUser} canEdit={canEdit} canDelete={canDelete} />
            )}
          </div>
        )}

        {/* TAB: CONSTRUCTION ESTIMATOR */}
        {activeTab === 'construction' && (
          <div className="space-y-4">
            {/* SUB-TABS FOR CONSTRUCTION */}
            <div className="flex border-b border-slate-800 gap-6 pb-2 mb-4" id="construction_sub_tabs">
              <button
                type="button"
                onClick={() => setConstructionSubTab('quotes_folder')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${constructionSubTab === 'quotes_folder' ? 'text-indigo-400 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📄 Hồ Sơ Báo Giá
                {constructionSubTab === 'quotes_folder' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" id="quotes_folder_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setConstructionSubTab('norms')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${constructionSubTab === 'norms' ? 'text-indigo-400 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📊 Dữ Liệu Định Mức & Đơn Giá
                {constructionSubTab === 'norms' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" id="norms_construction_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setConstructionSubTab('archive')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${constructionSubTab === 'archive' ? 'text-indigo-400 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Lưu Trữ Hồ Sơ Xây Dựng
                {constructionSubTab === 'archive' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" id="archive_construction_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setConstructionSubTab('template')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${constructionSubTab === 'template' ? 'text-indigo-400 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Mẫu Hồ sơ
                {constructionSubTab === 'template' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500 rounded-full" id="template_construction_tab_indicator" />
                )}
              </button>
            </div>

            {constructionSubTab === 'quotes_folder' ? (
              <div className="space-y-4" id="quotes_folder_nested_container">
                {/* Search Archived Quote & Quick Start Top Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4.5 rounded-xl border border-slate-800 text-xs text-left">
                  <div className="flex items-center gap-2.5">
                    <FolderOpen className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">
                        Tìm nhanh hồ sơ báo giá dự án
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Chọn một hồ sơ dự án xây dựng đã lưu để tải lại hoặc bấm "Lập mới" để đặt lại
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative" id="archived_quote_search_dropdown_top">
                      <button
                        type="button"
                        onClick={() => setIsArchiveDropdownOpen(!isArchiveDropdownOpen)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold hover:border-slate-700 transition-all text-left w-64 justify-between cursor-pointer text-xs"
                      >
                        <span className="truncate">
                          {loadedQuote ? (
                            <span className="text-emerald-400 font-bold">📂 {loadedQuote.code} - {loadedQuote.customerName}</span>
                          ) : (
                            <span className="text-slate-400 font-medium">🔍 Tìm nhanh hồ sơ thầu thợ...</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">▼</span>
                      </button>

                      {isArchiveDropdownOpen && (
                        <div className="absolute left-0 md:right-0 mt-2 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-72 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={archiveSearchQuery}
                              onChange={(e) => setArchiveSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-indigo-500 font-medium placeholder-slate-500 transition-all"
                              placeholder="Nhập tên, SĐT, mã hồ sơ thầu..."
                            />
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
                          </div>

                          <div className="space-y-1">
                            {(() => {
                              const userFilteredList = archivedQuotesList.filter(q => q.creatorId === currentUser?.id);
                              const matches = userFilteredList.filter(q => 
                                (q.customerName || '').toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
                                (q.customerPhone || '').toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
                                (q.code || '').toLowerCase().includes(archiveSearchQuery.toLowerCase()) ||
                                (q.projectName || '').toLowerCase().includes(archiveSearchQuery.toLowerCase())
                              );

                              if (matches.length === 0) {
                                return (
                                  <div className="text-center py-4 text-slate-500 italic text-xs">
                                    Không có hồ sơ nào khớp
                                  </div>
                                );
                              }

                              return matches.map((q) => (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    setLoadedQuote(q);
                                    setIsArchiveDropdownOpen(false);
                                    setArchiveSearchQuery('');
                                  }}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                    loadedQuote?.id === q.id 
                                      ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900 font-bold' 
                                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="font-bold text-slate-200 text-left flex items-center justify-between">
                                    <span>{q.code}</span>
                                    <span className="text-[10px] text-slate-550">{q.createdAt || q.date}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 text-left font-semibold">
                                    {q.customerName} - {q.customerPhone}
                                  </div>
                                  <div className="text-[9px] text-slate-500 truncate text-left mt-0.5 font-mono">
                                    DA: {q.projectName || 'Độc lập'}
                                  </div>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reset to Start fresh button */}
                    <button
                      type="button"
                      onClick={handleStartNewQuote}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Lập hồ sơ xây dựng mới"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Lập mới
                    </button>
                  </div>
                </div>

                {/* THÔNG TIN DỰ ÁN VÀ KHÁCH HÀNG DÙNG CHUNG */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-xs text-left" id="shared_project_selector_card">
                  <h3 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    Thông Tin Dự Án & Chủ Đầu Tư (Liên kết Hồ Sơ Báo Giá)
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Dự án (searchable custom selection) */}
                    <div className="relative">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Dự Án <span className="text-rose-500 font-bold">*</span></label>
                      
                      {/* Searchable Custom Trigger Button */}
                      <button
                        type="button"
                        onClick={() => !isLocked && setIsProjDropdownOpen(!isProjDropdownOpen)}
                        disabled={isLocked}
                        className={`w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 outline-none font-semibold text-left hover:border-slate-700 focus:border-indigo-500 transition-all flex items-center justify-between shadow-sm text-xs ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="truncate font-semibold">
                          {selectedProjectId ? (
                            (() => {
                              const activeProj = projects.find(p => p.id === selectedProjectId);
                              return activeProj ? `${activeProj.name}` : selectedProjectId;
                            })()
                          ) : (
                            <span className="text-amber-500 font-bold">Báo giá Độc lập</span>
                          )}
                        </span>
                        <Sliders className="w-3.5 h-3.5 text-indigo-400 shrink-0 ml-2" />
                      </button>

                      {/* Dropdown Popup Panel */}
                      {isProjDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-xl p-2.5 z-55 max-h-72 overflow-y-auto">
                          {/* Search Field inside */}
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()} // stop close dropdown
                              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-medium placeholder-slate-500 transition-all"
                              placeholder="Tìm dự án theo tên hoặc mã..."
                            />
                            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
                          </div>

                          {/* Options list */}
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProjectId('');
                                setProjectName('');
                                setIsProjDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className="w-full text-left px-2.5 py-2 hover:bg-rose-950/40 text-rose-400 font-bold border border-rose-900 rounded-lg text-xs mb-2 transition-colors block"
                            >
                              ❌ Báo giá Độc lập (Nhập tay tên dự án)
                            </button>

                            <div className="text-[9px] uppercase font-bold text-slate-500 px-2.5 py-1">
                              Dự án Đang Làm (Xây dựng)
                            </div>

                            {(() => {
                              const activeProjects = projects.filter(p => p.type === 'construction');
                              const matches = activeProjects.filter(p => 
                                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                p.code.toLowerCase().includes(searchQuery.toLowerCase())
                              );

                              if (matches.length === 0) {
                                return (
                                  <div className="text-center py-3 text-[11px] text-slate-500 italic">
                                    Không tìm thấy dự án hợp lệ
                                  </div>
                                );
                              }

                              return matches.map((p) => {
                                const hasArchive = archivedQuotesList.some(q => q.projectId === p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setIsProjDropdownOpen(false);
                                      setSearchQuery('');
                                    }}
                                    className={`w-full text-left px-2.5 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                      selectedProjectId === p.id 
                                        ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900 font-bold' 
                                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                    }`}
                                  >
                                    <div className="font-bold text-slate-300 text-left flex items-center justify-between">
                                        <span>{p.name}</span>
                                        {hasArchive && (
                                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded font-black border border-indigo-900">
                                            📁 ĐÃ CÓ HS
                                          </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate text-left">{p.code}</div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tên Dự án */}
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Dự án <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="text"
                        value={projectName}
                        disabled={!!selectedProjectId || isLocked}
                        onChange={(e) => setProjectName(e.target.value)}
                        className={`w-full rounded-lg p-2.5 border text-xs font-semibold shadow-sm transition-all outline-none ${
                          (selectedProjectId || isLocked)
                            ? "bg-slate-950 border-slate-800 text-slate-400 cursor-not-allowed border-dashed opacity-60" 
                            : "bg-slate-950 border-slate-800 text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        }`}
                        placeholder={selectedProjectId ? "" : "Nhập tên Dự án thầu... *"}
                      />
                    </div>

                    {/* Tên khách hàng */}
                    <div className="relative">
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tên Chủ Đầu Tư <span className="text-rose-500 font-bold">*</span></label>
                      
                      <button
                        type="button"
                        onClick={() => !isLocked && setIsCustDropdownOpen(!isCustDropdownOpen)}
                        disabled={isLocked}
                        className={`w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2.5 outline-none font-semibold text-xs text-left hover:border-slate-700 focus:border-indigo-500 transition-all flex items-center justify-between shadow-sm ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span className="truncate">
                          {customerName || <span className="text-slate-500 font-normal">Chọn chủ thầu từ danh sách *</span>}
                        </span>
                        <span className="text-[10px] text-slate-500">▼</span>
                      </button>

                      {/* Dropdown list of customers */}
                      {isCustDropdownOpen && (
                        <div className="absolute left-0 mt-1.5 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-xl p-2.5 z-55 max-h-72 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={custSearchQuery}
                              onChange={(e) => setCustSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()} // stop close dropdown
                              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500 font-medium placeholder-slate-500 transition-all"
                              placeholder="Tìm khách hàng theo tên hoặc SĐT..."
                            />
                            <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
                          </div>

                          <div className="space-y-1">
                            {(() => {
                              const matches = customers.filter(c => 
                                (c.name || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                                (c.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase())
                              );

                              if (matches.length === 0) {
                                return (
                                  <div className="text-center py-2.5 text-[11px] text-slate-500 italic">
                                    Chưa có chủ thầu khớp
                                  </div>
                                );
                              }

                              return matches.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => handleSelectCustomer(c)}
                                  className={`w-full text-left px-2.5 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                    selectedCustomerId === c.id 
                                      ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900 font-bold' 
                                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="font-bold text-slate-200 text-left">{c.name}</div>
                                  <div className="text-[10px] text-slate-550 text-left">
                                    SĐT: {c.phone} | {c.address}
                                  </div>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                      
                      {/* Nút tạo khách hàng nhanh */}
                      {!isLocked && (
                        <div className="mt-1 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => setShowQuickCreateCust(true)}
                            className="text-[10px] text-indigo-400 hover:text-indigo-350 font-semibold flex items-center gap-0.5 cursor-pointer hover:underline"
                          >
                            ➕ Tạo khách hàng nhanh
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Số điện thoại */}
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="text"
                        value={customerPhone}
                        disabled={true}
                        className="w-full rounded-lg p-2.5 border border-slate-800 text-slate-400 bg-slate-950 cursor-not-allowed font-semibold text-xs border-dashed"
                        placeholder="Chọn chủ thầu để lấy SĐT *"
                      />
                    </div>

                    {/* Địa chỉ */}
                    <div>
                      <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ thi công <span className="text-rose-500 font-bold">*</span></label>
                      <input
                        type="text"
                        value={customerAddress}
                        disabled={true}
                        className="w-full rounded-lg p-2.5 border border-slate-800 text-slate-400 bg-slate-950 cursor-not-allowed font-semibold text-xs border-dashed"
                        placeholder="Chọn chủ thầu để lấy địa chỉ *"
                      />
                    </div>
                  </div>
                </div>

                {/* QUICK CREATE CUSTOMER MODAL (DARK REGION-SPECIFIC) */}
                {showQuickCreateCust && (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-none">
                      <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest border-b border-slate-800 pb-3 mb-4 flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-400" />
                        Thêm Nhanh Chủ Đầu Tư
                      </h3>
                      
                      <div className="space-y-4 text-left text-xs">
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Tên khách hàng *</label>
                          <input 
                            type="text"
                            value={quickCustName}
                            onChange={(e) => setQuickCustName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Ví dụ: Nguyễn Văn A"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Số điện thoại *</label>
                          <input 
                            type="text"
                            value={quickCustPhone}
                            onChange={(e) => setQuickCustPhone(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Ví dụ: 0912345678"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Địa chỉ thi công *</label>
                          <input 
                            type="text"
                            value={quickCustAddress}
                            onChange={(e) => setQuickCustAddress(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            placeholder="Ví dụ: Số 123 Đường Láng, Hà Nội"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 mt-6 border-t border-slate-800 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowQuickCreateCust(false)}
                          className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickCreateCustomer}
                          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/10 text-xs transition-all cursor-pointer"
                        >
                          Tạo khách hàng
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Selector Group */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800/80 mb-4 text-xs">
                  {/* Left: Tab Selector */}
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 w-fit">
                    <button
                      type="button"
                      onClick={() => setQuotesFolderTab('estimator')}
                      className={`px-4.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        quotesFolderTab === 'estimator'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      📋 Lập Báo Giá Xây Dựng
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuotesFolderTab('takeoff')}
                      className={`px-4.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        quotesFolderTab === 'takeoff'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      📐 Bảng Bóc Tách Chi Tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuotesFolderTab('final_quote')}
                      className={`px-4.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        quotesFolderTab === 'final_quote'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      💰 BÁO GIÁ CUỐI CÙNG
                    </button>
                  </div>
                </div>

                {quotesFolderTab === 'estimator' ? (
                  <>
                    <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-left text-xs mb-1">
                      <span className="font-extrabold text-indigo-400 uppercase text-[10px] block mb-1">DỰ TOÁN KHUNG KẾT CẤU BÊ TÔNG, MÓNG ĐÚC, TRẠT GẠCH CHỈ</span>
                      Lập mốc xi măng bao, cát san lấp vĩ độ dốc chịu tải. Đồng bộ biên bản bàn giao và mác ép thợ móng biệt thự.
                    </div>

                    <ConstructionEstimator 
                      customers={customers}
                      projects={projects}
                      onAddQuote={handleSaveQuote}
                      preselectedCustomerId={preselectedCustomerId}
                      preselectedProjectId={preselectedProjectId}
                      currentUser={currentUser}
                      houseEstimatePrices={houseEstimatePrices}
                      selectedCustomerId={selectedCustomerId}
                      setSelectedCustomerId={setSelectedCustomerId}
                      selectedProjectId={selectedProjectId}
                      setSelectedProjectId={setSelectedProjectId}
                      projectName={projectName}
                      setProjectName={setProjectName}
                      customerName={customerName}
                      setCustomerName={setCustomerName}
                      customerAddress={customerAddress}
                      setCustomerAddress={setCustomerAddress}
                      customerPhone={customerPhone}
                      setCustomerPhone={setCustomerPhone}
                      hideMetadataHeader={true}
                      isConstructionSaved={isConstructionSaved}
                      setIsConstructionSaved={setIsConstructionSaved}
                      isLocked={isLocked}
                      setIsLocked={setIsLocked}
                      loadedQuote={loadedQuote}
                      setLoadedQuote={setLoadedQuote}
                      chieuDai={chieuDai}
                      setChieuDai={setChieuDai}
                      chieuRong={chieuRong}
                      setChieuRong={setChieuRong}
                      soTang={soTang}
                      setSoTang={setSoTang}
                      selectedHouseType={selectedHouseType}
                      setSelectedHouseType={setSelectedHouseType}
                      donGiaKhaiToan={donGiaKhaiToan}
                      setDonGiaKhaiToan={setDonGiaKhaiToan}
                      nganSachNoiThat={nganSachNoiThat}
                      setNganSachNoiThat={setNganSachNoiThat}
                      quoteItems={quoteItems}
                      setQuoteItems={setQuoteItems}
                    />
                  </>
                ) : quotesFolderTab === 'takeoff' ? (
                  <ConstructionTakeoff 
                    materialCompositionNorms={materialCompositionNorms}
                    currentUser={currentUser}
                    onAddQuote={handleSaveQuote}
                    selectedCustomerId={selectedCustomerId}
                    setSelectedCustomerId={setSelectedCustomerId}
                    selectedProjectId={selectedProjectId}
                    setSelectedProjectId={setSelectedProjectId}
                    projectName={projectName}
                    setProjectName={setProjectName}
                    customerName={customerName}
                    setCustomerName={setCustomerName}
                    customerAddress={customerAddress}
                    setCustomerAddress={setCustomerAddress}
                    customerPhone={customerPhone}
                    setCustomerPhone={setCustomerPhone}
                    isConstructionSaved={isConstructionSaved}
                    setIsConstructionSaved={setIsConstructionSaved}
                    isLocked={isLocked}
                    setIsLocked={setIsLocked}
                    loadedQuote={loadedQuote}
                    setLoadedQuote={setLoadedQuote}
                  />
                ) : (
                  <ConstructionFinalQuote 
                    currentUser={currentUser}
                    selectedCustomerId={selectedCustomerId}
                    selectedProjectId={selectedProjectId}
                    projectName={projectName}
                    customerName={customerName}
                    customerAddress={customerAddress}
                    customerPhone={customerPhone}
                    onAddQuote={handleSaveQuote}
                    isConstructionSaved={isConstructionSaved}
                    setIsConstructionSaved={setIsConstructionSaved}
                    isLocked={isLocked}
                    setIsLocked={setIsLocked}
                    loadedQuote={loadedQuote}
                    setLoadedQuote={setLoadedQuote}
                  />
                )}
              </div>
            ) : constructionSubTab === 'norms' ? (
              <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-xl overflow-hidden text-left" id="construction_norms_container">
                
                {/* INNER TABS HEADER AND SELECTOR */}
                <div className="mb-5 border-b border-slate-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNormsInnerTab('price')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${normsInnerTab === 'price' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-800'}`}
                    >
                      📈 Đơn giá Khái toán
                    </button>
                    <button
                      type="button"
                      onClick={() => setNormsInnerTab('composition')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${normsInnerTab === 'composition' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-800'}`}
                    >
                      🧱 Định mức cấp phối vật tư
                    </button>
                    <button
                      type="button"
                      onClick={() => setNormsInnerTab('material_labor')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${normsInnerTab === 'material_labor' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-800'}`}
                    >
                      💰 Đơn giá vật tư & nhân công
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => setEditingItem({ tab: normsInnerTab, action: 'add', data: null })}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm mới
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportExcel(normsInnerTab)}
                      className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                      title="Xuất Excel"
                    >
                      <Download className="w-3.5 h-3.5" /> Xuất Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-600/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Nhập Excel"
                    >
                      <Upload className="w-3.5 h-3.5" /> {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportExcel}
                      className="hidden"
                    />
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={normsInnerTab === 'price' ? "Tìm theo loại nhà..." : normsInnerTab === 'composition' ? "Tìm theo mã, tên công tác..." : "Tìm theo tên vật tư, nhân công..."}
                        value={constructionSearchTerm}
                        onChange={(e) => setConstructionSearchTerm(e.target.value)}
                        className="bg-slate-950 border border-slate-800 outline-none text-xs text-slate-200 rounded-xl px-3 py-2 pl-8 font-semibold focus:border-indigo-500 w-56 transition-all"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {normsInnerTab === 'price' ? (
                  <>
                    <div className="mb-4">
                      <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                        Đơn giá Khái toán
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Tra cứu định mức chi phí và giá thầu khái toán theo các mẫu loại nhà kết cấu thị trường năm 2026.
                      </p>
                    </div>

                    {/* BẢNG ĐƠN GIÁ KHÁI TOÁN */}
                    <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-indigo-300 uppercase tracking-wider font-extrabold text-[10px] border-b border-slate-800/80">
                            <th className="px-3 py-3.5 text-center w-[60px]">STT</th>
                            <th className="px-4 py-3.5 text-left min-w-[180px]">Loại nhà</th>
                            <th className="px-4 py-3.5 text-right w-[150px]">Đơn giá TB (đ/m²)</th>
                            <th className="px-4 py-3.5 text-right w-[150px] text-emerald-400/90">Giá thấp (đ/m²)</th>
                            <th className="px-4 py-3.5 text-right w-[150px] text-rose-400/90">Giá cao (đ/m²)</th>
                            <th className="px-4 py-3.5 text-left min-w-[280px]">Đặc điểm kết cấu chính</th>
                            {(canEdit || canDelete) && <th className="px-4 py-3.5 text-center w-[110px] text-indigo-300">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-sans">
                          {houseEstimatePrices.filter(p => 
                            p.type.toLowerCase().includes(constructionSearchTerm.toLowerCase()) ||
                            p.features.toLowerCase().includes(constructionSearchTerm.toLowerCase())
                          ).map((p) => {
                            return (
                              <tr key={p.stt} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-3 py-3.5 text-center font-mono font-bold text-slate-500 border-r border-slate-800/30">
                                  {p.stt}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-slate-100">
                                  {p.type}
                                </td>
                                <td className="px-4 py-3.5 font-extrabold text-indigo-400 text-right font-mono bg-indigo-500/5">
                                  {p.avgPrice.toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-emerald-400 text-right font-mono">
                                  {p.minPrice.toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-rose-400 text-right font-mono">
                                  {p.maxPrice.toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3.5 text-[11px] text-slate-350 leading-relaxed font-medium">
                                  {p.features}
                                </td>
                                {(canEdit || canDelete) && (
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingItem({ tab: 'price', action: 'edit', data: p })}
                                          className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                          title="Sửa"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeletePrice(p.stt)}
                                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                                          title="Xóa"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4 p-3 bg-slate-950/20 border border-slate-800/40 rounded-xl text-[10.5px] text-slate-400 flex items-center gap-2">
                      <span className="text-amber-400 font-bold">⚠️ Lưu ý:</span>
                      <span>Đơn giá trên mang tính chất khái toán trung bình thị trường năm 2026. Chi phí thi công thực tế có thể dao động tùy theo vị trí địa lý, địa chất nền móng và chất lượng hoàn thiện vật liệu chi tiết.</span>
                    </div>
                  </>
                ) : normsInnerTab === 'composition' ? (
                  <>
                    <div className="mb-4">
                      <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                        ĐỊNH MỨC CẤP PHỐI VẬT TƯ (Căn cứ Thông tư 12/2021/TT-BXD)
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Tra cứu chi tiết hao phí định mức cát, đá, xi măng, gạch, thép, nước phục vụ thi công cho các công tác xây lắp chính.
                      </p>
                    </div>

                    {/* BẢNG ĐỊNH MỨC CẤP PHỐI VẬT TƯ */}
                    <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
                      <table className="w-full text-[11px] border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="bg-slate-950 text-indigo-300 uppercase tracking-wider font-extrabold text-[10px] border-b border-slate-800/80">
                            <th className="px-3 py-3.5 text-center w-[90px]">Mã ĐM</th>
                            <th className="px-4 py-3.5 text-left min-w-[200px]">Tên công tác</th>
                            <th className="px-3 py-3.5 text-center w-[80px]">Đơn vị</th>
                            <th className="px-3 py-3.5 text-center w-[90px] text-sky-400">Gạch (viên)</th>
                            <th className="px-3 py-3.5 text-center w-[90px] text-sky-400">XM (kg)</th>
                            <th className="px-3 py-3.5 text-center w-[90px] text-sky-400">Cát (m³)</th>
                            <th className="px-3 py-3.5 text-center w-[90px] text-sky-400">Đá (m³)</th>
                            <th className="px-3 py-3.5 text-center w-[90px] text-sky-400">Thép (kg)</th>
                            <th className="px-3 py-3.5 text-center w-[90px] text-sky-400">Nước (L)</th>
                            <th className="px-4 py-3.5 text-left min-w-[180px] text-indigo-300">Ghi chú</th>
                            {(canEdit || canDelete) && <th className="px-4 py-3.5 text-center w-[110px] text-indigo-300">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-sans">
                          {materialCompositionNorms.filter(n => {
                            const q = constructionSearchTerm.toLowerCase().trim();
                            if (!q) return true;
                            return (
                              n.id.toLowerCase().includes(q) ||
                              n.name.toLowerCase().includes(q) ||
                              (n.notes && n.notes.toLowerCase().includes(q))
                            );
                          }).map((n) => {
                            return (
                              <tr key={n.id} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-3 py-3 text-center font-mono font-bold text-slate-350 border-r border-slate-800/30 bg-slate-950/20">
                                  {n.id}
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-100">
                                  {n.name}
                                </td>
                                <td className="px-3 py-3 text-center font-semibold text-slate-300">
                                  {n.unit}
                                </td>
                                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400">
                                  {n.brick !== null ? n.brick : '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400 bg-sky-500/5">
                                  {n.cement !== null ? n.cement : '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400">
                                  {n.sand != null ? n.sand.toFixed(4) : '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400 bg-sky-500/5">
                                  {n.stone != null ? n.stone.toFixed(4) : '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400">
                                  {n.steel !== null ? n.steel : '—'}
                                </td>
                                <td className="px-3 py-3 text-center font-mono font-bold text-sky-400">
                                  {n.water !== null ? n.water : '—'}
                                </td>
                                <td className="px-4 py-3 text-xs text-indigo-300 font-medium italic">
                                  {n.notes}
                                </td>
                                {(canEdit || canDelete) && (
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingItem({ tab: 'composition', action: 'edit', data: n })}
                                          className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                          title="Sửa"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteNorm(n.id)}
                                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                                          title="Xóa"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-3 bg-slate-950/20 border border-slate-800/40 rounded-xl text-[10.5px] text-slate-400 flex items-center gap-2">
                      <span className="text-amber-400 font-bold">📘 Ghi chú Quy chuẩn:</span>
                      <span>Hao phí vật liệu trên là hao phí định mức kinh tế kỹ thuật ban hành kèm theo Thông tư số 12/2021/TT-BXD ngày 31/08/2021 của Bộ Xây dựng.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <h3 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
                        ĐƠN GIÁ VẬT TƯ & NHÂN CÔNG (Khảo sát thị trường Việt Nam – Năm 2026)
                      </h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        Tra cứu đơn giá vật liệu xây dựng, vật tư hoàn thiện, nhân công xây lắp chính và máy móc thiết bị thi công mới nhất.
                      </p>
                    </div>

                    {/* BẢNG ĐƠN GIÁ VẬT TƯ & NHÂN CÔNG */}
                    <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
                      <table className="w-full text-xs border-collapse min-w-[900px]">
                        <thead>
                          <tr className="bg-slate-950 text-indigo-300 uppercase tracking-wider font-extrabold text-[10px] border-b border-slate-800/80">
                            <th className="px-4 py-3.5 text-left w-[150px]">Nhóm</th>
                            <th className="px-4 py-3.5 text-left min-w-[200px]">Tên vật tư / nhân công</th>
                            <th className="px-3 py-3.5 text-center w-[80px]">Đơn vị</th>
                            <th className="px-4 py-3.5 text-right w-[140px] text-indigo-300">Đơn giá TB (đ)</th>
                            <th className="px-4 py-3.5 text-right w-[140px] text-emerald-400/90">Giá thấp (đ)</th>
                            <th className="px-4 py-3.5 text-right w-[140px] text-rose-400/90">Giá cao (đ)</th>
                            <th className="px-4 py-3.5 text-left min-w-[180px] text-slate-300">Nguồn / Ghi chú</th>
                            {(canEdit || canDelete) && <th className="px-4 py-3.5 text-center w-[110px] text-indigo-300">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-sans">
                          {materialLaborPrices.filter(p => {
                            const q = constructionSearchTerm.toLowerCase().trim();
                            if (!q) return true;
                            return (
                              p.name.toLowerCase().includes(q) ||
                              p.group.toLowerCase().includes(q) ||
                              (p.notes && p.notes.toLowerCase().includes(q))
                            );
                          }).map((p, idx) => {
                            // Determine badge styling based on group
                            let groupClass = "bg-slate-850 text-slate-400 border border-slate-800";
                            if (p.group === "VẬT LIỆU CHÍNH") {
                              groupClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                            } else if (p.group === "HOÀN THIỆN") {
                              groupClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                            } else if (p.group === "CỬA & KẾT CẤU") {
                              groupClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20";
                            } else if (p.group === "NHÂN CÔNG") {
                              groupClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
                            } else if (p.group === "MÁY & THIẾT BỊ") {
                              groupClass = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                            }

                            return (
                              <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                                <td className="px-4 py-3.5">
                                  <span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase rounded-lg tracking-wider ${groupClass}`}>
                                    {p.group}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 font-bold text-slate-100">
                                  {p.name}
                                </td>
                                <td className="px-3 py-3.5 text-center font-semibold text-slate-300 font-mono">
                                  {p.unit}
                                </td>
                                <td className="px-4 py-3.5 font-extrabold text-indigo-400 text-right font-mono bg-indigo-500/5">
                                  {p.avgPrice.toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-emerald-400 text-right font-mono">
                                  {p.minPrice.toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-rose-400 text-right font-mono">
                                  {p.maxPrice.toLocaleString('vi-VN')}
                                </td>
                                <td className="px-4 py-3.5 text-xs text-indigo-300 font-medium italic">
                                  {p.notes}
                                </td>
                                {(canEdit || canDelete) && (
                                  <td className="px-4 py-3.5 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => setEditingItem({ tab: 'material_labor', action: 'edit', data: p })}
                                          className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                          title="Sửa"
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {canDelete && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMaterialLabor(p.name)}
                                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                                          title="Xóa"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-3 bg-slate-950/20 border border-slate-800/40 rounded-xl text-[10.5px] text-slate-400 flex items-center gap-2">
                      <span className="text-indigo-400 font-bold">📊 Thông tin khảo sát:</span>
                      <span>Mức đơn giá trên được tổng hợp và khảo sát trung bình từ thị trường xây lắp Việt Nam năm 2026. Đơn giá thực tế có thể thay đổi tùy thuộc vào biến động giá nhà máy và khu vực địa lý cụ thể.</span>
                    </div>
                  </>
                )}

              </div>
            ) : constructionSubTab === 'template' ? (
              <div className="space-y-4">
                <ConstructionEstimator
                  customers={customers}
                  projects={projects}
                  showTemplateOnly={true}
                />
              </div>
            ) : (
              <ConstructionArchive currentUser={currentUser} canEdit={canEdit} canDelete={canDelete} />
            )}
          </div>
        )}

        {/* TAB: MECHANICAL ESTIMATOR */}
        {activeTab === 'mechanical' && (
          <div className="space-y-4">
            {/* SUB-TABS FOR MECHANICAL */}
            <div className="flex border-b border-slate-800 gap-6 pb-2 mb-4" id="mechanical_sub_tabs">
              <button
                type="button"
                onClick={() => setMechanicalSubTab('estimator')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${mechanicalSubTab === 'estimator' ? 'text-pink-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📋 Lập Báo Giá Cơ Khí
                {mechanicalSubTab === 'estimator' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-pink-500 rounded-full" id="est_mechanical_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMechanicalSubTab('archive')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${mechanicalSubTab === 'archive' ? 'text-pink-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Lưu Trữ Hồ Sơ Cơ Khí
                {mechanicalSubTab === 'archive' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-pink-500 rounded-full" id="archive_mechanical_tab_indicator" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMechanicalSubTab('template')}
                className={`text-xs font-bold uppercase tracking-wider relative pb-2 transition-all cursor-pointer ${mechanicalSubTab === 'template' ? 'text-pink-500 font-extrabold' : 'text-slate-400 hover:text-white'}`}
              >
                📁 Mẫu Hồ sơ
                {mechanicalSubTab === 'template' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-pink-500 rounded-full" id="template_mechanical_tab_indicator" />
                )}
              </button>
            </div>

            {mechanicalSubTab === 'estimator' ? (
              <>
                {/* TIM NHANH HO SO CO KHI */}
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left shadow-lg mb-4" id="mechanical_quote_search_and_reset_header">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="w-5 h-5 text-pink-500 shrink-0" />
                    <div>
                      <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">
                        Tìm nhanh hồ sơ báo giá nhôm kính / cơ khí
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Chọn một hồ sơ báo giá nhôm kính / cơ khí đã lưu để tải lại hoặc bấm "Lập mới" để đặt lại
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative" id="archived_mechanical_quote_search_dropdown_top">
                      <button
                        type="button"
                        onClick={() => setIsMechanicalArchiveDropdownOpen(!isMechanicalArchiveDropdownOpen)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold hover:border-slate-700 transition-all text-left w-64 justify-between cursor-pointer text-xs"
                      >
                        <span className="truncate">
                          {loadedMechanicalQuote ? (
                            <span className="text-pink-400 font-bold">📂 {loadedMechanicalQuote.code} - {loadedMechanicalQuote.customerName}</span>
                          ) : (
                            <span className="text-slate-400 font-medium">🔍 Tìm nhanh hồ sơ cơ khí...</span>
                          )}
                        </span>
                        <span className="text-[10px] text-slate-500">▼</span>
                      </button>

                      {isMechanicalArchiveDropdownOpen && (
                        <div className="absolute left-0 md:right-0 mt-2 w-72 md:w-80 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2.5 z-55 max-h-72 overflow-y-auto">
                          <div className="relative mb-2">
                            <input
                              type="text"
                              value={mechanicalArchiveSearchQuery}
                              onChange={(e) => setMechanicalArchiveSearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-pink-500 font-medium placeholder-slate-500 transition-all"
                              placeholder="Nhập tên, SĐT, mã hồ sơ cơ khí..."
                            />
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-3" />
                          </div>

                          <div className="space-y-1">
                            {(() => {
                              const userFilteredList = archivedMechanicalQuotesList.filter(q => q.creatorId === currentUser?.id);
                              const matches = userFilteredList.filter(q => 
                                (q.customerName || '').toLowerCase().includes(mechanicalArchiveSearchQuery.toLowerCase()) ||
                                (q.customerPhone || '').toLowerCase().includes(mechanicalArchiveSearchQuery.toLowerCase()) ||
                                (q.code || '').toLowerCase().includes(mechanicalArchiveSearchQuery.toLowerCase()) ||
                                (q.projectName || '').toLowerCase().includes(mechanicalArchiveSearchQuery.toLowerCase())
                              );

                              if (matches.length === 0) {
                                  return (
                                    <div className="text-center py-4 text-slate-500 italic text-xs">
                                      Không có hồ sơ nào khớp
                                    </div>
                                  );
                              }

                              return matches.map((q) => (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    setLoadedMechanicalQuote(q);
                                    setIsMechanicalArchiveDropdownOpen(false);
                                    setMechanicalArchiveSearchQuery('');
                                  }}
                                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs cursor-pointer block transition-all ${
                                    loadedMechanicalQuote?.id === q.id 
                                      ? 'bg-pink-950/40 text-pink-400 border border-pink-900 font-bold' 
                                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                  }`}
                                >
                                  <div className="font-bold text-slate-200 text-left flex items-center justify-between">
                                    <span>{q.code}</span>
                                    <span className="text-[10px] text-slate-550">{q.createdAt || q.date}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5 text-left font-semibold">
                                    {q.customerName} - {q.customerPhone}
                                  </div>
                                  <div className="text-[9px] text-slate-500 truncate text-left mt-0.5 font-mono">
                                    DA: {q.projectName || 'Độc lập'}
                                  </div>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reset to Start fresh button */}
                    <button
                      type="button"
                      onClick={handleStartNewMechanicalQuote}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Lập hồ sơ cơ khí mới"
                    >
                      <Plus className="w-4 h-4 text-pink-400" />
                      Lập mới
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-pink-500/5 border border-pink-500/20 rounded-xl text-left text-xs mb-4">
                  <span className="font-extrabold text-pink-400 uppercase text-[10px] block mb-1">BÓC TÁCH KHỐI LƯỢNG QUE HÀN, THÉP HÌNH SS400, SƠN TĨNH ĐIỆN CNC</span>
                  Ưu thế tính phôi sắt tôn, khối lượng nặng theo kg sắt hoặc theo bệ đo dử sắt. Chắn tia cực tím mắt thợ xưởng Bảo Lộc.
                </div>

                <MechanicalEstimator 
                  customers={customers}
                  projects={projects}
                  onAddQuote={handleSaveQuote}
                  preselectedCustomerId={preselectedCustomerId}
                  preselectedProjectId={preselectedProjectId}
                  currentUser={currentUser}
                  isMechanicalSaved={isMechanicalSaved}
                  setIsMechanicalSaved={setIsMechanicalSaved}
                  isLocked={isMechanicalLocked}
                  setIsLocked={setIsMechanicalLocked}
                  loadedQuote={loadedMechanicalQuote}
                  setLoadedQuote={setLoadedMechanicalQuote}
                />
              </>
            ) : mechanicalSubTab === 'template' ? (
              <div className="space-y-4">
                <MechanicalEstimator
                  customers={customers}
                  projects={projects}
                  showTemplateOnly={true}
                />
              </div>
            ) : (
              <MechanicalArchive currentUser={currentUser} canEdit={canEdit} canDelete={canDelete} />
            )}
          </div>
        )}

      </div>

      {editingItem && (
        <ConstructionNormsModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEditedItem}
          existingPrices={houseEstimatePrices}
          existingNorms={materialCompositionNorms}
          existingMaterials={materialLaborPrices}
        />
      )}

    </div>
  );
}

// ==========================================
// COMPONENT: ConstructionNormsModal
// ==========================================
interface ConstructionNormsModalProps {
  item: { tab: string; action: string; data: any } | null;
  onClose: () => void;
  onSave: (tab: string, action: string, updatedData: any) => void;
  existingPrices: any[];
  existingNorms: any[];
  existingMaterials: any[];
}

function ConstructionNormsModal({
  item,
  onClose,
  onSave,
  existingPrices,
  existingNorms,
  existingMaterials
}: ConstructionNormsModalProps) {
  if (!item) return null;

  const { tab, action, data } = item;
  
  // Tab 1 state
  const [stt, setStt] = useState<number>(1);
  const [houseType, setHouseType] = useState<string>('');
  const [avgPrice, setAvgPrice] = useState<number>(0);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [features, setFeatures] = useState<string>('');

  // Tab 2 state
  const [normId, setNormId] = useState<string>('');
  const [normName, setNormName] = useState<string>('');
  const [normUnit, setNormUnit] = useState<string>('');
  const [brick, setBrick] = useState<string>('');
  const [cement, setCement] = useState<string>('');
  const [sand, setSand] = useState<string>('');
  const [stone, setStone] = useState<string>('');
  const [steel, setSteel] = useState<string>('');
  const [water, setWater] = useState<string>('');
  const [normNotes, setNormNotes] = useState<string>('');

  // Tab 3 state
  const [group, setGroup] = useState<string>('VẬT LIỆU CHÍNH');
  const [itemName, setItemName] = useState<string>('');
  const [itemUnit, setItemUnit] = useState<string>('');
  const [itemAvgPrice, setItemAvgPrice] = useState<number>(0);
  const [itemMinPrice, setItemMinPrice] = useState<number>(0);
  const [itemMaxPrice, setItemMaxPrice] = useState<number>(0);
  const [itemNotes, setItemNotes] = useState<string>('');

  // Error state
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    setError('');
    if (tab === 'price') {
      if (action === 'edit' && data) {
        setStt(data.stt);
        setHouseType(data.type);
        setAvgPrice(data.avgPrice);
        setMinPrice(data.minPrice);
        setMaxPrice(data.maxPrice);
        setFeatures(data.features);
      } else {
        const nextStt = existingPrices.length > 0 ? Math.max(...existingPrices.map(p => p.stt)) + 1 : 1;
        setStt(nextStt);
        setHouseType('');
        setAvgPrice(5000000);
        setMinPrice(4000000);
        setMaxPrice(6000000);
        setFeatures('');
      }
    } else if (tab === 'composition') {
      if (action === 'edit' && data) {
        setNormId(data.id);
        setNormName(data.name);
        setNormUnit(data.unit);
        setBrick(data.brick !== null ? String(data.brick) : '');
        setCement(data.cement !== null ? String(data.cement) : '');
        setSand(data.sand !== null ? String(data.sand) : '');
        setStone(data.stone !== null ? String(data.stone) : '');
        setSteel(data.steel !== null ? String(data.steel) : '');
        setWater(data.water !== null ? String(data.water) : '');
        setNormNotes(data.notes || '');
      } else {
        setNormId('');
        setNormName('');
        setNormUnit('m³');
        setBrick('');
        setCement('');
        setSand('');
        setStone('');
        setSteel('');
        setWater('');
        setNormNotes('');
      }
    } else if (tab === 'material_labor') {
      if (action === 'edit' && data) {
        setGroup(data.group);
        setItemName(data.name);
        setItemUnit(data.unit);
        setItemAvgPrice(data.avgPrice);
        setItemMinPrice(data.minPrice);
        setItemMaxPrice(data.maxPrice);
        setItemNotes(data.notes || '');
      } else {
        setGroup('VẬT LIỆU CHÍNH');
        setItemName('');
        setItemUnit('m³');
        setItemAvgPrice(100000);
        setItemMinPrice(90000);
        setItemMaxPrice(110000);
        setItemNotes('');
      }
    }
  }, [item, existingPrices, existingNorms, existingMaterials]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'price') {
      if (!houseType.trim()) {
        setError('Vui lòng nhập loại nhà.');
        return;
      }
      if (action === 'add' && existingPrices.some(p => p.type.toLowerCase() === houseType.trim().toLowerCase())) {
        setError('Loại nhà này đã tồn tại trong danh mục.');
        return;
      }
      onSave(tab, action, {
        stt,
        type: houseType.trim(),
        avgPrice,
        minPrice,
        maxPrice,
        features: features.trim()
      });
    } else if (tab === 'composition') {
      if (!normId.trim()) {
        setError('Vui lòng nhập mã định mức.');
        return;
      }
      if (!normName.trim()) {
        setError('Vui lòng nhập tên công tác.');
        return;
      }
      if (action === 'add' && existingNorms.some(n => n.id.toLowerCase() === normId.trim().toLowerCase())) {
        setError('Mã định mức này đã tồn tại.');
        return;
      }
      onSave(tab, action, {
        id: normId.trim(),
        name: normName.trim(),
        unit: normUnit.trim(),
        brick: brick === '' ? null : Number(brick),
        cement: cement === '' ? null : Number(cement),
        sand: sand === '' ? null : Number(sand),
        stone: stone === '' ? null : Number(stone),
        steel: steel === '' ? null : Number(steel),
        water: water === '' ? null : Number(water),
        notes: normNotes.trim()
      });
    } else if (tab === 'material_labor') {
      if (!itemName.trim()) {
        setError('Vui lòng nhập tên vật tư / nhân công.');
        return;
      }
      if (action === 'add' && existingMaterials.some(m => m.name.toLowerCase() === itemName.trim().toLowerCase())) {
        setError('Tên vật tư hoặc nhân công này đã tồn tại.');
        return;
      }
      onSave(tab, action, {
        group,
        name: itemName.trim(),
        unit: itemUnit.trim(),
        avgPrice: itemAvgPrice,
        minPrice: itemMinPrice,
        maxPrice: itemMaxPrice,
        notes: itemNotes.trim()
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl text-slate-100 text-left">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase text-indigo-400 tracking-wider">
            {action === 'add' ? '➕ Thêm' : '📝 Sửa'} {
              tab === 'price' ? 'Đơn giá Khái toán' : 
              tab === 'composition' ? 'Định mức cấp phối vật tư' : 
              'Đơn giá vật tư & nhân công'
            }
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold">
              ⚠️ {error}
            </div>
          )}

          {tab === 'price' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">STT:</label>
                  <input
                    type="number"
                    disabled
                    value={stt}
                    className="w-full bg-slate-950 text-slate-400 border border-slate-800 rounded-xl px-3 py-2 outline-none font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Loại nhà:</label>
                  <input
                    type="text"
                    disabled={action === 'edit'}
                    placeholder="VD: Nhà phố tân cổ điển"
                    value={houseType}
                    onChange={(e) => setHouseType(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Đơn giá TB (đ):</label>
                  <input
                    type="number"
                    value={avgPrice}
                    onChange={(e) => setAvgPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Giá thấp (đ):</label>
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Giá cao (đ):</label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Đặc điểm kết cấu chính:</label>
                <textarea
                  rows={3}
                  placeholder="VD: Móng cọc BTCT, Khung bê tông chịu lực..."
                  value={features}
                  onChange={(e) => setFeatures(e.target.value)}
                  className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 leading-relaxed font-semibold"
                />
              </div>
            </div>
          )}

          {tab === 'composition' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Mã Định Mức:</label>
                  <input
                    type="text"
                    disabled={action === 'edit'}
                    placeholder="VD: AF.11112"
                    value={normId}
                    onChange={(e) => setNormId(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Tên công tác:</label>
                  <input
                    type="text"
                    placeholder="VD: Bê tông sản xuất bằng máy trộn..."
                    value={normName}
                    onChange={(e) => setNormName(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Đơn vị:</label>
                  <input
                    type="text"
                    placeholder="VD: m³"
                    value={normUnit}
                    onChange={(e) => setNormUnit(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-sky-400">Gạch (viên):</label>
                  <input
                    type="number"
                    placeholder="—"
                    value={brick}
                    onChange={(e) => setBrick(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-sky-400">XM (kg):</label>
                  <input
                    type="number"
                    placeholder="—"
                    value={cement}
                    onChange={(e) => setCement(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-sky-400">Cát (m³):</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="—"
                    value={sand}
                    onChange={(e) => setSand(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-sky-400">Đá (m³):</label>
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="—"
                    value={stone}
                    onChange={(e) => setStone(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-sky-400">Thép (kg):</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={steel}
                    onChange={(e) => setSteel(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-sky-400">Nước (L):</label>
                  <input
                    type="number"
                    placeholder="—"
                    value={water}
                    onChange={(e) => setWater(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div className="col-span-1">
                  <span className="block text-[10px] text-slate-500 font-bold mt-5 leading-normal">Để trống nếu không hao phí</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ghi chú:</label>
                <input
                  type="text"
                  placeholder="VD: Đá dmax = 20mm; mác vữa M75"
                  value={normNotes}
                  onChange={(e) => setNormNotes(e.target.value)}
                  className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>
          )}

          {tab === 'material_labor' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Nhóm:</label>
                  <select
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 font-bold cursor-pointer"
                  >
                    <option value="VẬT LIỆU CHÍNH">VẬT LIỆU CHÍNH</option>
                    <option value="HOÀN THIỆN">HOÀN THIỆN</option>
                    <option value="CỬA & KẾT CẤU">CỬA & KẾT CẤU</option>
                    <option value="NHÂN CÔNG">NHÂN CÔNG</option>
                    <option value="MÁY & THIẾT BỊ">MÁY & THIẾT BỊ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Đơn vị:</label>
                  <input
                    type="text"
                    placeholder="VD: kg, m³, công"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Tên vật tư / nhân công:</label>
                <input
                  type="text"
                  disabled={action === 'edit'}
                  placeholder="VD: Thép tròn D10"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Đơn giá TB (đ):</label>
                  <input
                    type="number"
                    value={itemAvgPrice}
                    onChange={(e) => setItemAvgPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Giá thấp (đ):</label>
                  <input
                    type="number"
                    value={itemMinPrice}
                    onChange={(e) => setItemMinPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Giá cao (đ):</label>
                  <input
                    type="number"
                    value={itemMaxPrice}
                    onChange={(e) => setItemMaxPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nguồn / Ghi chú:</label>
                <input
                  type="text"
                  placeholder="VD: Khảo sát thị trường, Hòa Phát..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full bg-slate-950 text-white border border-slate-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold"
                />
              </div>
            </div>
          )}

          <div className="p-5 border-t border-slate-800 flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/10"
            >
              Lưu dữ liệu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
