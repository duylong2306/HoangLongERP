import { QuoteItem, QuoteConfig } from '../types';

/**
 * Archived quote — a quote that has been saved/archived per sector.
 * Supports all 4 sectors: furniture (cabinet), construction, mechanical, subcontractor.
 */
export interface ArchivedQuote {
  id: string;
  code: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  projectId?: string;
  projectName?: string;
  /** Which sector this archived quote belongs to */
  sector: 'furniture' | 'construction' | 'mechanical' | 'subcontractor';
  totalAmount: number;
  date: string;
  items: QuoteItem[];
  config: QuoteConfig;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  notes?: string;
  // Document HTML fields (generated previews)
  contractHtml?: string;
  acceptanceHtml?: string;
  liquidationHtml?: string;
  finalQuoteHtml?: string;
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  // Metadata
  createdAt: string;
  updatedAt?: string;
  // Optional subcontractor-contract fields (used by SubcontractorEstimator)
  subcontractorId?: string;
  subcontractorName?: string;
  taskId?: string;
  workName?: string;
  contractValue?: number;
  createdDate?: string;
  signedDate?: string;
  startDate?: string;
  endDate?: string;
  // Bên B fields
  hoTenB?: string;
  gioiTinhB?: string;
  ngaySinhB?: string;
  cccdB?: string;
  ngayCapB?: string;
  noiCapB?: string;
  diaChiB?: string;
  sdtB?: string;
  emailB?: string;
  mstCnB?: string;
  stkB?: string;
  nganHangB?: string;
  // Điều khoản fields
  moTaKqBanGiao?: string;
  diaDiemThucHien?: string;
  tyLeKhauTruTncn?: number;
  tienTamUng?: number;
  soNgayTamUng?: number;
  soNgayThanhToan?: number;
  dieuKhoanNghiemThu?: string;
  thoiGianBaoHanh?: string;
  tyLePhatCham?: number;
  mucPhatToiDa?: number;
  // Raw backward-compat fields that some views set dynamically
  [key: string]: any;
}

/** Helper: narrow archived quote to a specific sector */
export type CabinetArchivedQuote = ArchivedQuote & { sector: 'furniture' };
export type ConstructionArchivedQuote = ArchivedQuote & { sector: 'construction' };
export type MechanicalArchivedQuote = ArchivedQuote & { sector: 'mechanical' };
export type SubcontractorArchivedQuote = ArchivedQuote & { sector: 'subcontractor' };

/**
 * Factory: create an empty archived quote stub.
 */
export function createEmptyArchivedQuote(sector: ArchivedQuote['sector']): ArchivedQuote {
  return {
    id: '',
    code: '',
    customerId: '',
    sector,
    totalAmount: 0,
    date: new Date().toISOString().split('T')[0],
    items: [],
    config: {
      discountPercent: 0,
      accessoryPercent: 0,
      laborPercent: 0,
      generalPercent: 0,
      profitPercent: 0,
      wastagePercent: 0,
      vatPercent: 0,
    },
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}
