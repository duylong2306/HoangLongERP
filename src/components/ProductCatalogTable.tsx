import React, { useState, useEffect, useRef } from 'react';
import { ProductCatalogItem, ProductPriceItem, ProductMaterialItem } from '../types';
import { useNotification } from '../context';
import { dbService } from '../lib/dbService';
import { exportToExcel, importFromExcel, formatDateForFile } from '../lib/excelUtils';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Info,
  Upload,
  Download
} from 'lucide-react';

interface ProductCatalogTableProps {
  searchTerm: string;
}

export const INITIAL_PRODUCTS: ProductCatalogItem[] = [
  {
    id: "SP001",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh Acrylic bóng gương cao cấp (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng từ nhựa PICOMAT cao cấp chống nước cả trên và dưới, cánh MDF THÁI LAN, AN CƯỜNG phủ ACRYLIC Bóng Gương, hậu nhựa alu.",
    donVi: "Mét dài kép",
    donGiaThaiLan: 5400000,
    donGiaAnCuong: 5700000,
    donGiaPlywood: null
  },
  {
    id: "SP002",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh Acrylic bóng gương cao cấp (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng dưới nhựa PICOMAT cao cấp chống nước, thùng trên gỗ MDF THÁI LAN, AN CƯỜNG, cánh MDF phủ ACRYLIC Bóng Gương, hậu nhựa alu.",
    donVi: "Mét dài kép",
    donGiaThaiLan: 4800000,
    donGiaAnCuong: 5400000,
    donGiaPlywood: null
  },
  {
    id: "SP003",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh Acrylic bóng gương cao cấp (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng từ nhựa đặc SUNNY WOOD PHỦ BÓNG cao cấp chống nước cả trên và dưới, cánh MDF THÁI LAN, AN CƯỜNG phủ ACRYLIC Bóng Gương, hậu nhựa alu.",
    donVi: "Mét dài kép",
    donGiaThaiLan: 5400000,
    donGiaAnCuong: 5700000,
    donGiaPlywood: null
  },
  {
    id: "SP004",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh Acrylic bóng gương cao cấp (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng từ nhựa đặc THAN TRE PHỦ BÓNG cao cấp chống nước cả trên và dưới, cánh MDF THÁI LAN, AN CƯỜNG phủ ACRYLIC Bóng Gương, hậu nhựa alu.",
    donVi: "Mét dài kép",
    donGiaThaiLan: 5200000,
    donGiaAnCuong: 5500000,
    donGiaPlywood: null
  },
  {
    id: "SP005",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh melamin (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng từ nhựa Picomat chống nước cả trên và dưới, mặt cánh MDF phủ Melamin THÁI LAN, AN CƯỜNG, PLYWOOD, hậu nhựa alu",
    donVi: "Mét dài kép",
    donGiaThaiLan: 4800000,
    donGiaAnCuong: 5200000,
    donGiaPlywood: 5600000
  },
  {
    id: "SP006",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh melamin (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng dưới nhựa Picomat chống nước, thùng trên mặt cánh MDF phủ Melamin THÁI LAN, AN CƯỜNG, PLYWOOD, hậu nhựa alu",
    donVi: "Mét dài kép",
    donGiaThaiLan: 4500000,
    donGiaAnCuong: 5000000,
    donGiaPlywood: 5400000
  },
  {
    id: "SP007",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ bếp mặt cánh melamin (Tủ cao tiêu chuẩn 2,2 mét)",
    chatLieu: "Thùng từ gỗ MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD cả trên và dưới, mặt cánh MDF phủ Melamin, hậu nhựa alu",
    donVi: "Mét dài kép",
    donGiaThaiLan: 3500000,
    donGiaAnCuong: 4600000,
    donGiaPlywood: 4800000
  },
  {
    id: "SP008",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Đá bàn bếp",
    chatLieu: "Đá kim sa tự nhiên",
    donVi: "Mét dài",
    donGiaThaiLan: 1200000,
    donGiaAnCuong: null,
    donGiaPlywood: null
  },
  {
    id: "SP009",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Đá bàn bếp",
    chatLieu: "Đá nung kết",
    donVi: "Mét dài",
    donGiaThaiLan: 1600000,
    donGiaAnCuong: null,
    donGiaPlywood: null
  },
  {
    id: "SP010",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Kính ốp bếp",
    chatLieu: "Kính cường lực dày 8mm",
    donVi: "Mét dài",
    donGiaThaiLan: 800000,
    donGiaAnCuong: null,
    donGiaPlywood: null
  },
  {
    id: "SP011",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Bếp",
    tenSanPham: "Tủ rượu",
    chatLieu: "Gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD bề mặt phủ Melamin.",
    donVi: "Mét vuông",
    donGiaThaiLan: 1800000,
    donGiaAnCuong: 2400000,
    donGiaPlywood: 2600000
  },
  {
    id: "SP012",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Ngủ",
    tenSanPham: "Tủ quần áo",
    chatLieu: "Gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD bề mặt phủ Melamin.",
    donVi: "Mét vuông",
    donGiaThaiLan: 1800000,
    donGiaAnCuong: 2400000,
    donGiaPlywood: 2600000
  },
  {
    id: "SP013",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Ngủ",
    tenSanPham: "Bàn trang điểm",
    chatLieu: "Loại treo tường. Gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD, bề mặt phủ Melamin",
    donVi: "Chiếc",
    donGiaThaiLan: 2500000,
    donGiaAnCuong: 2800000,
    donGiaPlywood: 3000000
  },
  {
    id: "SP014",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Ngủ",
    tenSanPham: "Bàn học",
    chatLieu: "Sâu 55 cm, gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD, bề mặt phủ Melamin",
    donVi: "Mét dài",
    donGiaThaiLan: 1900000,
    donGiaAnCuong: 2500000,
    donGiaPlywood: 2700000
  },
  {
    id: "SP015",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Ngủ",
    tenSanPham: "Giá sách",
    chatLieu: "Sâu 30cm, cao 80cm, gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD, bề mặt phủ Melamin",
    donVi: "Mét dài",
    donGiaThaiLan: 1700000,
    donGiaAnCuong: 2300000,
    donGiaPlywood: 2500000
  },
  {
    id: "SP016",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Khách",
    tenSanPham: "Tủ giày",
    chatLieu: "Gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD bề mặt phủ Melamin.",
    donVi: "Mét vuông",
    donGiaThaiLan: 1800000,
    donGiaAnCuong: 2400000,
    donGiaPlywood: 2600000
  },
  {
    id: "SP017",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Khách",
    tenSanPham: "Vách nan sóng",
    chatLieu: "Vách nan sóng gỗ MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD bề mặt phủ melamin",
    donVi: "Mét vuông",
    donGiaThaiLan: 1250000,
    donGiaAnCuong: 1500000,
    donGiaPlywood: 1700000
  },
  {
    id: "SP018",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Khách",
    tenSanPham: "Vách gỗ phẳng",
    chatLieu: "Vách phẳng gỗ MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD, bề mặt phủ melamin",
    donVi: "Mét vuông",
    donGiaThaiLan: 850000,
    donGiaAnCuong: 1250000,
    donGiaPlywood: 1450000
  },
  {
    id: "SP019",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Khách",
    tenSanPham: "Vách cột",
    chatLieu: "Hộp cột 5cmx15cm, gỗ MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD, bề mặt phủ Melamin. (Tính theo mét dài của cột)",
    donVi: "Mét dài",
    donGiaThaiLan: 750000,
    donGiaAnCuong: 950000,
    donGiaPlywood: 1150000
  },
  {
    id: "SP020",
    linhVuc: "Nội thất",
    danhMuc: "Phòng Khách",
    tenSanPham: "Kệ tivi",
    chatLieu: "Loại treo tường. Gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG, PLYWOOD, bề mặt phủ Melamin",
    donVi: "Mét dài",
    donGiaThaiLan: 1650000,
    donGiaAnCuong: 2200000,
    donGiaPlywood: 2400000
  },
  // Xây dựng
  {
    id: "SP021",
    linhVuc: "Xây dựng",
    danhMuc: "Đào móng & San lấp",
    tenSanPham: "Đào hố móng bằng máy và thủ công",
    chatLieu: "Đất đồi tự nhiên ôn hòa, rà móng sâu < 1.5m",
    donVi: "Mét khối",
    donGiaThaiLan: 350000,
    donGiaAnCuong: 450000,
    donGiaPlywood: null
  },
  {
    id: "SP022",
    linhVuc: "Xây dựng",
    danhMuc: "Đào móng & San lấp",
    tenSanPham: "San lấp cát nền móng sàng lọc",
    chatLieu: "Cát san lấp đầm chặt tiêu chuẩn K95",
    donVi: "Mét khối",
    donGiaThaiLan: 280000,
    donGiaAnCuong: 320000,
    donGiaPlywood: null
  },
  {
    id: "SP023",
    linhVuc: "Xây dựng",
    danhMuc: "Bê tông & Cốt thép",
    tenSanPham: "Bê tông móng mác 250 thô",
    chatLieu: "Bê tông tươi thương phẩm mác 250, đá 1x2 tiêu chuẩn tuyển chọn",
    donVi: "Mét khối",
    donGiaThaiLan: 1250000,
    donGiaAnCuong: 1350000,
    donGiaPlywood: null
  },
  {
    id: "SP024",
    linhVuc: "Xây dựng",
    danhMuc: "Bê tông & Cốt thép",
    tenSanPham: "Gia công và lắp dựng cốt thép móng",
    chatLieu: "Thép Hòa Phát cường độ cao từ phi 10 đến 22",
    donVi: "Tấn",
    donGiaThaiLan: 15500000,
    donGiaAnCuong: 16200000,
    donGiaPlywood: null
  },
  {
    id: "SP025",
    linhVuc: "Xây dựng",
    danhMuc: "Xây tô & Hoàn thiện",
    tenSanPham: "Xây tường gạch ống 8x8x18",
    chatLieu: "Gạch Tuynel Bình Dương cao cấp, vữa xi măng mác 75",
    donVi: "Mét khối",
    donGiaThaiLan: 1450000,
    donGiaAnCuong: 1600000,
    donGiaPlywood: null
  },
  {
    id: "SP026",
    linhVuc: "Xây dựng",
    danhMuc: "Xây tô & Hoàn thiện",
    tenSanPham: "Tô trát tường mác 75 dày 1.5cm",
    chatLieu: "Cát mịn sàng lọc, xi măng PCB40, vữa mác 75 mịn màng",
    donVi: "Mét vuông",
    donGiaThaiLan: 110000,
    donGiaAnCuong: 130000,
    donGiaPlywood: null
  },
  {
    id: "SP027",
    linhVuc: "Xây dựng",
    danhMuc: "Gạch ốp lát",
    tenSanPham: "Lát gạch nền 80x80",
    chatLieu: "Gạch men Prime granite chống trầy xước cao cấp",
    donVi: "Mét vuông",
    donGiaThaiLan: 280000,
    donGiaAnCuong: 350000,
    donGiaPlywood: null
  },
  // Cơ khí
  {
    id: "SP031",
    linhVuc: "Cơ khí",
    danhMuc: "Khung Thép Tròn/Hộp",
    tenSanPham: "Dầm sườn khung thép hộp mạ kẽm",
    chatLieu: "Thép hộp Hoa Sen tiêu chuẩn 50x100 dày 1.8mm sơn chống rỉ",
    donVi: "Mét dài",
    donGiaThaiLan: 165000,
    donGiaAnCuong: 185000,
    donGiaPlywood: null
  },
  {
    id: "SP032",
    linhVuc: "Cơ khí",
    danhMuc: "Vì kèo & Mái ngói",
    tenSanPham: "Giàn vì kèo thép nhẹ mái ngói",
    chatLieu: "Xà gồ mạ hợp kim nhôm kẽm cường độ cao, bền bỉ",
    donVi: "Mét vuông",
    donGiaThaiLan: 320000,
    donGiaAnCuong: 380000,
    donGiaPlywood: null
  },
  {
    id: "SP033",
    linhVuc: "Cơ khí",
    danhMuc: "Sắt rèn mỹ thuật",
    tenSanPham: "Lan can sắt ban công nghệ thuật",
    chatLieu: "Sắt vuông rèn mỹ thuật uốn hoa văn, sơn lót & sơn tĩnh điện 3 lớp",
    donVi: "Mét dài",
    donGiaThaiLan: 1200000,
    donGiaAnCuong: 1500000,
    donGiaPlywood: null
  },
  {
    id: "SP034",
    linhVuc: "Cơ khí",
    danhMuc: "Cửa sắt & Lan can",
    tenSanPham: "Cổng sắt hộp mỹ thuật 4 cánh",
    chatLieu: "Sắt hộp mạ kẽm Hoa Sen 40x80, sơn tĩnh điện bảo vệ",
    donVi: "Mét vuông",
    donGiaThaiLan: 1450000,
    donGiaAnCuong: 1650000,
    donGiaPlywood: null
  }
];

export const getInitialPrices = (productsList: ProductCatalogItem[]): ProductPriceItem[] => {
  const prices: ProductPriceItem[] = [];
  productsList.forEach(p => {
    if (p.donGiaThaiLan !== undefined && p.donGiaThaiLan !== null) {
      prices.push({
        id: `PR_${p.id}_TL`,
        productId: p.id,
        tenGia: "Thái Lan",
        donGia: Number(p.donGiaThaiLan),
        ghiChu: "Giá vật liệu gỗ Thái Lan"
      });
    }
    if (p.donGiaAnCuong !== undefined && p.donGiaAnCuong !== null) {
      prices.push({
        id: `PR_${p.id}_AC`,
        productId: p.id,
        tenGia: "An Cường",
        donGia: Number(p.donGiaAnCuong),
        ghiChu: "Giá vật liệu gỗ An Cường"
      });
    }
    if (p.donGiaPlywood !== undefined && p.donGiaPlywood !== null) {
      prices.push({
        id: `PR_${p.id}_PW`,
        productId: p.id,
        tenGia: "Plywood",
        donGia: Number(p.donGiaPlywood),
        ghiChu: "Giá vật liệu gỗ Plywood"
      });
    }
  });
  return prices;
};

export const getInitialMaterials = (productsList: ProductCatalogItem[]): ProductMaterialItem[] => {
  const mList: ProductMaterialItem[] = [];
  productsList.forEach(p => {
    if (p.chatLieu) {
      mList.push({
        id: `MAT_${p.id}_DFT`,
        productId: p.id,
        tenChatLieu: p.chatLieu,
        ghiChu: "Chất liệu cấu hình gốc ban đầu"
      });
    }
  });
  return mList;
};

export const INITIAL_PRICES: ProductPriceItem[] = getInitialPrices(INITIAL_PRODUCTS);
export const INITIAL_MATERIALS: ProductMaterialItem[] = getInitialMaterials(INITIAL_PRODUCTS);

export default function ProductCatalogTable({ searchTerm }: ProductCatalogTableProps) {
  const { addToast } = useNotification();
  const [products, setProducts] = useState<ProductCatalogItem[]>(() => {
    const saved = localStorage.getItem('hl_acc_products');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Lỗi đọc dữ liệu sản phẩm", e);
      }
    }
    return INITIAL_PRODUCTS;
  });

  const [pricesList, setPricesList] = useState<ProductPriceItem[]>(() => {
    const saved = localStorage.getItem('hl_acc_product_prices');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Lỗi đọc dữ liệu đơn giá", e);
      }
    }
    const savedProducts = localStorage.getItem('hl_acc_products');
    if (savedProducts) {
      try {
        const parsedProducts: ProductCatalogItem[] = JSON.parse(savedProducts);
        return getInitialPrices(parsedProducts);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_PRICES;
  });

  const [materialsList, setMaterialsList] = useState<ProductMaterialItem[]>(() => {
    const saved = localStorage.getItem('hl_acc_product_materials');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Lỗi đọc dữ liệu chất liệu", e);
      }
    }
    const savedProducts = localStorage.getItem('hl_acc_products');
    if (savedProducts) {
      try {
        const parsedProducts: ProductCatalogItem[] = JSON.parse(savedProducts);
        return getInitialMaterials(parsedProducts);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_MATERIALS;
  });

  // Save to localStorage whenever products change
  useEffect(() => {
    localStorage.setItem('hl_acc_products', JSON.stringify(products));
  }, [products]);

  // Save to localStorage whenever prices change
  useEffect(() => {
    localStorage.setItem('hl_acc_product_prices', JSON.stringify(pricesList));
  }, [pricesList]);

  // Save to localStorage whenever materials change
  useEffect(() => {
    localStorage.setItem('hl_acc_product_materials', JSON.stringify(materialsList));
  }, [materialsList]);

  // ── Load from Supabase on mount & sync prices to Supabase ──
  useEffect(() => {
    dbService.productPrices.list().then((cloudPrices) => {
      if (cloudPrices && cloudPrices.length > 0) {
        setPricesList(cloudPrices);
        localStorage.setItem('hl_acc_product_prices', JSON.stringify(cloudPrices));
      }
    }).catch(err => console.warn('Load giá bán từ Supabase thất bại:', err));

    dbService.productMaterials.list().then((cloudMats) => {
      if (cloudMats && cloudMats.length > 0) {
        setMaterialsList(cloudMats);
        localStorage.setItem('hl_acc_product_materials', JSON.stringify(cloudMats));
      }
    }).catch(err => console.warn('Load chất liệu từ Supabase thất bại:', err));
  }, []);

  // Sync prices to Supabase when changed (only after initial load to avoid overwrite)
  const [pricesLoaded, setPricesLoaded] = useState(false);
  useEffect(() => {
    if (!pricesLoaded) {
      if (pricesList.length >= 0) setPricesLoaded(true);
      return;
    }
    if (pricesList.length > 0) {
      pricesList.forEach(p => dbService.productPrices.save(p).catch(() => {}));
    }
  }, [pricesList, pricesLoaded]);

  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  useEffect(() => {
    if (!materialsLoaded) {
      if (materialsList.length >= 0) setMaterialsLoaded(true);
      return;
    }
    if (materialsList.length > 0) {
      materialsList.forEach(m => dbService.productMaterials.save(m).catch(() => {}));
    }
  }, [materialsList, materialsLoaded]);

  // ── Load from Supabase on mount & sync products to Supabase ──
  useEffect(() => {
    dbService.subcontractorCatalog.list().then((cloudProducts: ProductCatalogItem[]) => {
      if (cloudProducts && cloudProducts.length > 0) {
        setProducts(cloudProducts);
        localStorage.setItem('hl_acc_products', JSON.stringify(cloudProducts));
      }
    }).catch(err => console.warn('Load danh mục sản phẩm từ Supabase thất bại:', err));
  }, []);

  // Sync products to Supabase when changed
  useEffect(() => {
    if (products.length > 0) {
      products.forEach(p => dbService.subcontractorCatalog.save(p).catch(() => {}));
    }
  }, [products]);

  // Price Management modal active states
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState<ProductCatalogItem | null>(null);
  const [priceFormMode, setPriceFormMode] = useState<'add' | 'edit'>('add');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [fTenGia, setFTenGia] = useState('');
  const [fDonGia, setFDonGia] = useState('');
  const [fPriceGhiChu, setFPriceGhiChu] = useState('');

  // Material Management modal active states
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialModalProduct, setMaterialModalProduct] = useState<ProductCatalogItem | null>(null);
  const [materialFormMode, setMaterialFormMode] = useState<'add' | 'edit'>('add');
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [fTenChatLieu, setFTenChatLieu] = useState('');
  const [fMaterialGhiChu, setFMaterialGhiChu] = useState('');

  // Pagging states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Options: 5, 10, 20, 50, 100

  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal active states
  const [showFormModal, setShowFormModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentEditingId, setCurrentEditingId] = useState<string | null>(null);

  // Form Field States
  const [fLinhVuc, setFLinhVuc] = useState('Nội thất');
  const [fDanhMuc, setFDanhMuc] = useState('Phòng Bếp');
  const [fTenSanPham, setFTenSanPham] = useState('');
  const [fChatLieu, setFChatLieu] = useState('');
  const [fDonVi, setFDonVi] = useState('Mét dài');
  const [fDonGiaThaiLan, setFDonGiaThaiLan] = useState<string>('');
  const [fDonGiaAnCuong, setFDonGiaAnCuong] = useState<string>('');
  const [fDonGiaPlywood, setFDonGiaPlywood] = useState<string>('');

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Reset inputs info
  const resetFormFields = () => {
    setFLinhVuc('Nội thất');
    setFDanhMuc('Phòng Bếp');
    setFTenSanPham('');
    setFChatLieu('');
    setFDonVi('Mét dài');
    setFDonGiaThaiLan('');
    setFDonGiaAnCuong('');
    setFDonGiaPlywood('');
    setCurrentEditingId(null);
  };

  // Open modal for Adding
  const handleOpenAdd = () => {
    resetFormFields();
    setModalMode('add');
    setShowFormModal(true);
  };

  // Open modal for Editing
  const handleOpenEdit = (item: ProductCatalogItem) => {
    setModalMode('edit');
    setCurrentEditingId(item.id);
    setFLinhVuc(item.linhVuc || 'Nội thất');
    setFDanhMuc(item.danhMuc || 'Phòng Bếp');
    setFTenSanPham(item.tenSanPham || '');
    setFChatLieu(item.chatLieu || '');
    setFDonVi(item.donVi || 'Mét dài');
    setFDonGiaThaiLan(item.donGiaThaiLan !== null ? String(item.donGiaThaiLan) : '');
    setFDonGiaAnCuong(item.donGiaAnCuong !== null ? String(item.donGiaAnCuong) : '');
    setFDonGiaPlywood(item.donGiaPlywood !== null ? String(item.donGiaPlywood) : '');
    setShowFormModal(true);
  };

  // Auto-generate SP Code sequentially
  const generateNextProductCode = (): string => {
    let maxId = 0;
    products.forEach(p => {
      if (p.id && p.id.startsWith('SP')) {
        const numStr = p.id.substring(2);
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    });
    return `SP${String(maxId + 1).padStart(3, '0')}`;
  };

  // Form Submit Handler
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fTenSanPham.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên sản phẩm.', type: 'warning' });
      return;
    }

    const priceThaiLan = fDonGiaThaiLan.trim() !== '' ? Number(fDonGiaThaiLan) : null;
    const priceAnCuong = fDonGiaAnCuong.trim() !== '' ? Number(fDonGiaAnCuong) : null;
    const pricePlywood = fDonGiaPlywood.trim() !== '' ? Number(fDonGiaPlywood) : null;

    if (modalMode === 'add') {
      const newCode = generateNextProductCode();
      const newItem: ProductCatalogItem = {
        id: newCode,
        linhVuc: fLinhVuc,
        danhMuc: fDanhMuc,
        tenSanPham: fTenSanPham.trim(),
        chatLieu: fChatLieu.trim(),
        donVi: fDonVi,
        donGiaThaiLan: priceThaiLan,
        donGiaAnCuong: priceAnCuong,
        donGiaPlywood: pricePlywood,
      };

      if (fChatLieu.trim()) {
        const initialMat: ProductMaterialItem = {
          id: `MAT_${newCode}_DFT`,
          productId: newCode,
          tenChatLieu: fChatLieu.trim(),
          ghiChu: "Chất liệu ban đầu"
        };
        setMaterialsList(prev => [...prev, initialMat]);
      }

      setProducts([newItem, ...products]);
      setCurrentPage(1);
    } else if (modalMode === 'edit' && currentEditingId) {
      setProducts(prevProducts => prevProducts.map(p => {
        if (p.id === currentEditingId) {
          return {
            ...p,
            linhVuc: fLinhVuc,
            danhMuc: fDanhMuc,
            tenSanPham: fTenSanPham.trim(),
            chatLieu: fChatLieu.trim(),
            donVi: fDonVi,
            donGiaThaiLan: priceThaiLan,
            donGiaAnCuong: priceAnCuong,
            donGiaPlywood: pricePlywood,
          };
        }
        return p;
      }));

      // Also update default material if edited
      if (fChatLieu.trim()) {
        setMaterialsList(prev => {
          const dftMatIndex = prev.findIndex(m => m.productId === currentEditingId && m.id.endsWith('_DFT'));
          if (dftMatIndex > -1) {
            return prev.map((m, idx) => {
              if (idx === dftMatIndex) {
                return { ...m, tenChatLieu: fChatLieu.trim() };
              }
              return m;
            });
          } else {
            // Add if not exist yet
            return [...prev, {
              id: `MAT_${currentEditingId}_DFT`,
              productId: currentEditingId,
              tenChatLieu: fChatLieu.trim(),
              ghiChu: "Chất liệu ban đầu"
            }];
          }
        });
      }
    }

    setShowFormModal(false);
    resetFormFields();
  };

  // Open the Pricing Manager Modal for a specific product
  const handleOpenPriceManager = (product: ProductCatalogItem, selectedPrice: ProductPriceItem | null) => {
    setPriceModalProduct(product);
    if (selectedPrice) {
      setPriceFormMode('edit');
      setEditingPriceId(selectedPrice.id);
      setFTenGia(selectedPrice.tenGia);
      setFDonGia(String(selectedPrice.donGia));
      setFPriceGhiChu(selectedPrice.ghiChu || '');
    } else {
      setPriceFormMode('add');
      setEditingPriceId(null);
      setFTenGia('');
      setFDonGia('');
      setFPriceGhiChu('');
    }
    setShowPriceModal(true);
  };

  const handlePriceFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!priceModalProduct) return;
    if (!fTenGia.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên phân loại giá.', type: 'warning' });
      return;
    }
    if (!fDonGia.trim() || isNaN(Number(fDonGia))) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập đơn giá trị hợp lệ.', type: 'warning' });
      return;
    }

    const priceAmount = Number(fDonGia);

    if (priceFormMode === 'add') {
      const newPriceItem: ProductPriceItem = {
        id: `PR_${priceModalProduct.id}_${Date.now()}`,
        productId: priceModalProduct.id,
        tenGia: fTenGia.trim(),
        donGia: priceAmount,
        ghiChu: fPriceGhiChu.trim() || undefined
      };
      setPricesList(prev => [...prev, newPriceItem]);
    } else if (priceFormMode === 'edit' && editingPriceId) {
      setPricesList(prev => prev.map(pr => {
        if (pr.id === editingPriceId) {
          return {
            ...pr,
            tenGia: fTenGia.trim(),
            donGia: priceAmount,
            ghiChu: fPriceGhiChu.trim() || undefined
          };
        }
        return pr;
      }));
    }

    setPriceFormMode('add');
    setEditingPriceId(null);
    setFTenGia('');
    setFDonGia('');
    setFPriceGhiChu('');
  };

  const handleDeletePrice = (priceId: string) => {
    setPricesList(prev => prev.filter(pr => pr.id !== priceId));
    if (editingPriceId === priceId) {
      setPriceFormMode('add');
      setEditingPriceId(null);
      setFTenGia('');
      setFDonGia('');
      setFPriceGhiChu('');
    }
    // Đồng bộ xóa lên Supabase
    dbService.productPrices.delete(priceId).catch(err => console.warn('Xóa giá bán khỏi Supabase thất bại:', err));
  };

  // Open the Material Manager Modal for a specific product
  const handleOpenMaterialManager = (product: ProductCatalogItem, selectedMaterial: ProductMaterialItem | null) => {
    setMaterialModalProduct(product);
    if (selectedMaterial) {
      setMaterialFormMode('edit');
      setEditingMaterialId(selectedMaterial.id);
      setFTenChatLieu(selectedMaterial.tenChatLieu);
      setFMaterialGhiChu(selectedMaterial.ghiChu || '');
    } else {
      setMaterialFormMode('add');
      setEditingMaterialId(null);
      setFTenChatLieu('');
      setFMaterialGhiChu('');
    }
    setShowMaterialModal(true);
  };

  const handleMaterialFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialModalProduct) return;
    if (!fTenChatLieu.trim()) {
      addToast({ title: '⚠️ Thiếu thông tin', message: 'vui lòng nhập tên chất liệu.', type: 'warning' });
      return;
    }

    if (materialFormMode === 'add') {
      const newMaterialItem: ProductMaterialItem = {
        id: `MAT_${materialModalProduct.id}_${Date.now()}`,
        productId: materialModalProduct.id,
        tenChatLieu: fTenChatLieu.trim(),
        ghiChu: fMaterialGhiChu.trim() || undefined
      };
      setMaterialsList(prev => [...prev, newMaterialItem]);
    } else if (materialFormMode === 'edit' && editingMaterialId) {
      setMaterialsList(prev => prev.map(m => {
        if (m.id === editingMaterialId) {
          return {
            ...m,
            tenChatLieu: fTenChatLieu.trim(),
            ghiChu: fMaterialGhiChu.trim() || undefined
          };
        }
        return m;
      }));
    }

    setMaterialFormMode('add');
    setEditingMaterialId(null);
    setFTenChatLieu('');
    setFMaterialGhiChu('');
  };

  const handleDeleteMaterial = (materialId: string) => {
    setMaterialsList(prev => prev.filter(m => m.id !== materialId));
    if (editingMaterialId === materialId) {
      setMaterialFormMode('add');
      setEditingMaterialId(null);
      setFTenChatLieu('');
      setFMaterialGhiChu('');
    }
    // Đồng bộ xóa lên Supabase
    dbService.productMaterials.delete(materialId).catch(err => console.warn('Xóa chất liệu khỏi Supabase thất bại:', err));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ─── IMPORT / EXPORT EXCEL ───
  const handleExportExcel = () => {
    const data = products.map((p, idx) => ({
      'STT': idx + 1,
      'Mã SP': p.id,
      'Lĩnh vực': p.linhVuc,
      'Danh mục': p.danhMuc,
      'Tên sản phẩm': p.tenSanPham,
      'Chất liệu': p.chatLieu ?? '',
      'Đơn vị': p.donVi,
      'Đơn giá Thái Lan (đ)': p.donGiaThaiLan != null ? p.donGiaThaiLan.toLocaleString('vi-VN') : '',
      'Đơn giá An Cường (đ)': p.donGiaAnCuong != null ? p.donGiaAnCuong.toLocaleString('vi-VN') : '',
      'Đơn giá Plywood (đ)': p.donGiaPlywood != null ? p.donGiaPlywood.toLocaleString('vi-VN') : '',
    }));
    exportToExcel(data, 'DanhMucSanPham', `Danh_Muc_San_Pham_${formatDateForFile()}.xlsx`);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsImporting(true);
    try {
      const rows = await importFromExcel<Record<string, any>>(file, (row) => row);
      if (rows.length === 0) {
        alert('File Excel không có dữ liệu hoặc không đúng định dạng.');
        setIsImporting(false);
        return;
      }
      const mapPrice = (val: any): number | null => {
        if (val === '' || val == null) return null;
        const cleaned = String(val).replace(/[^\d.-]/g, '');
        return cleaned ? Number(cleaned) : null;
      };
      const mapped = rows.map((r, idx) => ({
        id: String(r['Mã SP'] ?? r['Ma SP'] ?? `SP${String(idx + 1).padStart(3, '0')}`).trim(),
        linhVuc: String(r['Lĩnh vực'] ?? r['Linh vuc'] ?? 'Nội thất').trim(),
        danhMuc: String(r['Danh mục'] ?? r['Danh muc'] ?? 'Phòng Bếp').trim(),
        tenSanPham: String(r['Tên sản phẩm'] ?? r['Ten san pham'] ?? '').trim(),
        chatLieu: String(r['Chất liệu'] ?? r['Chat lieu'] ?? '').trim(),
        donVi: String(r['Đơn vị'] ?? r['Don vi'] ?? 'Mét dài').trim(),
        donGiaThaiLan: mapPrice(r['Đơn giá Thái Lan (đ)'] ?? r['Don gia Thai Lan']),
        donGiaAnCuong: mapPrice(r['Đơn giá An Cường (đ)'] ?? r['Don gia An Cuong']),
        donGiaPlywood: mapPrice(r['Đơn giá Plywood (đ)'] ?? r['Don gia Plywood']),
      })).filter(p => p.tenSanPham);
      if (mapped.length === 0) {
        alert('Không tìm thấy cột "Tên sản phẩm" trong file.');
        setIsImporting(false);
        return;
      }
      setProducts(mapped);
      setCurrentPage(1);
      alert(`Đã nhập thành công ${mapped.length} sản phẩm từ file Excel.`);
    } catch (err) {
      console.error('Lỗi import Excel:', err);
      alert('Có lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file.');
    } finally {
      setIsImporting(false);
    }
  };

  // Item deletion
  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setDeleteConfirmId(null);
    // Đồng bộ xóa lên Supabase
    dbService.subcontractorCatalog.delete(id).catch(err => console.warn('Xóa sản phẩm khỏi Supabase thất bại:', err));
  };

  // Categories list
  const uniqueCategories = ['all', ...Array.from(new Set(products.map(p => p.danhMuc).filter(Boolean)))];

  // Filtering based on search and category tab selection
  const filteredProducts = products.filter(p => {
    const sTerm = searchTerm.toLowerCase().trim();
    const matchesSearch = sTerm === '' || 
      p.id.toLowerCase().includes(sTerm) ||
      p.tenSanPham.toLowerCase().includes(sTerm) ||
      (p.chatLieu && p.chatLieu.toLowerCase().includes(sTerm)) ||
      materialsList.some(m => m.productId === p.id && m.tenChatLieu.toLowerCase().includes(sTerm)) ||
      p.danhMuc.toLowerCase().includes(sTerm) ||
      p.linhVuc.toLowerCase().includes(sTerm) ||
      p.donVi.toLowerCase().includes(sTerm);
    
    const matchesCategory = selectedCategory === 'all' || p.danhMuc === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Reset pagination if filtered products count decreases
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  // Paginated items
  const startIndex = (activePage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  return (
    <div className="space-y-4" id="accounting_product_catalog_panel">
      {/* Upper stats bar & Category Filtering */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-3" id="catalog_filters_section">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider mr-2">Bộ lọc danh mục:</span>
          {uniqueCategories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedCategory === cat
                  ? 'bg-orange-600 font-extrabold text-white border border-orange-500/20 shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-transparent'
              }`}
            >
              {cat === 'all' ? 'Tất cả' : cat}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Xem trên trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-extrabold text-orange-400 outline-none cursor-pointer"
            >
              <option value={5} className="bg-slate-950 text-slate-200">5 dòng</option>
              <option value={10} className="bg-slate-950 text-slate-200">10 dòng</option>
              <option value={20} className="bg-slate-950 text-slate-200">20 dòng</option>
              <option value={50} className="bg-slate-950 text-slate-200">50 dòng</option>
              <option value={100} className="bg-slate-950 text-slate-200">100 dòng</option>
            </select>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1 bg-orange-600 hover:bg-orange-550 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg transition-all shadow hover:shadow-orange-600/10 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm sản phẩm</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-3 py-2 rounded-lg transition-all shadow hover:shadow-indigo-600/10 active:scale-[0.98] cursor-pointer"
            title="Xuất Excel danh mục sản phẩm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất Excel</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs px-3 py-2 rounded-lg transition-all shadow hover:shadow-amber-600/10 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Nhập Excel danh mục sản phẩm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isImporting ? 'Đang nhập...' : 'Nhập Excel'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportExcel}
            className="hidden"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm" id="product_catalog_table_container">
        <div className="overflow-x-auto">
          <table className="w-full text-[10.5px] border-collapse" id="product_catalog_data_table">
            <thead>
              <tr className="bg-slate-50 text-slate-700 uppercase tracking-wider font-extrabold text-[9.5px] border-b border-slate-200">
                <th className="px-3 py-3 text-left w-[80px]">Mã SP</th>
                <th className="px-3 py-3 text-left w-[90px]">Lĩnh vực</th>
                <th className="px-3 py-3 text-left w-[110px]">Danh mục</th>
                <th className="px-4 py-3 text-left w-[180px]">Tên sản phẩm</th>
                <th className="px-4 py-3 text-left w-[280px]">Bảng chất liệu liên kết (Nhấn để quản lý)</th>
                <th className="px-3 py-3 text-center w-[90px]">Đơn vị</th>
                <th className="px-4 py-3 text-left min-w-[280px]">Bảng đơn giá liên kết (Nhấn để quản lý)</th>
                <th className="px-3 py-3 text-center w-[90px] sticky right-0 bg-slate-50 z-10 shadow-[-3px_0_6px_rgba(0,0,0,0.03)] border-l border-slate-200">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((p, idx) => {
                  const isEvenRow = idx % 2 === 1;
                  const rowBgClass = isEvenRow ? 'bg-slate-50/60' : 'bg-white';
                  const stickyBgClass = isEvenRow ? 'bg-slate-50/95' : 'bg-white/95';

                  return (
                    <tr 
                      key={p.id} 
                      className={`border-b border-slate-200 hover:bg-slate-100/40 transition-colors ${rowBgClass}`}
                    >
                      {/* ID - Mã SP */}
                      <td className="px-3 py-3 font-mono font-bold text-orange-600 text-[11px] border-r border-slate-100">{p.id}</td>
                      
                      {/* Lĩnh vực */}
                      <td className="px-3 py-3 font-semibold text-slate-700">{p.linhVuc}</td>
                      
                      {/* Danh mục */}
                      <td className="px-3 py-3">
                        <span className="bg-orange-50 font-extrabold text-orange-700 text-[9.5px] px-2 py-0.5 rounded border border-orange-200">
                          {p.danhMuc}
                        </span>
                      </td>
                      
                      {/* Tên sản phẩm */}
                      <td className="px-4 py-3 font-extrabold text-slate-900 text-[11px] leading-relaxed select-text">{p.tenSanPham}</td>
                      
                      {/* Bảng chất liệu liên kết */}
                      <td className="px-4 py-3 border-l border-slate-100">
                        {(() => {
                          const pMaterials = materialsList.filter(m => m.productId === p.id);
                          return (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {pMaterials.length > 0 ? (
                                pMaterials.map(m => {
                                  return (
                                    <button
                                      key={m.id}
                                      onClick={() => handleOpenMaterialManager(p, m)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-extrabold transition-all duration-150 cursor-pointer shadow-sm text-sky-850 bg-sky-50 hover:bg-sky-100 border-sky-200/85 max-w-[240px] text-left leading-normal"
                                      title={m.ghiChu || `Chất liệu ${m.tenChatLieu}. Nhấn để nhanh chóng sửa.`}
                                    >
                                      <span>{m.tenChatLieu}</span>
                                    </button>
                                  );
                                })
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">Chưa cấu hình chất liệu</span>
                              )}
                              
                              <button
                                onClick={() => handleOpenMaterialManager(p, null)}
                                className="inline-flex items-center gap-0.5 px-2 py-1.5 rounded-lg border border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-50 text-orange-750 text-[10px] font-extrabold cursor-pointer transition-colors"
                              >
                                <span>+ Thêm chất liệu</span>
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* Đơn vị */}
                      <td className="px-3 py-3 text-center font-bold text-slate-700">{p.donVi}</td>
                      
                      {/* Bảng đơn giá liên kết */}
                      <td className="px-4 py-3 border-l border-slate-100">
                        {(() => {
                          const productPrices = pricesList.filter(pr => pr.productId === p.id);
                          return (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {productPrices.length > 0 ? (
                                productPrices.map(pr => {
                                  let badgeClass = "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300";
                                  if (pr.tenGia === "Thái Lan") badgeClass = "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200";
                                  else if (pr.tenGia === "An Cường") badgeClass = "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200";
                                  else if (pr.tenGia === "Plywood") badgeClass = "bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200";
                                  
                                  return (
                                    <button
                                      key={pr.id}
                                      onClick={() => handleOpenPriceManager(p, pr)}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-extrabold transition-all duration-150 cursor-pointer shadow-sm ${badgeClass}`}
                                      title={pr.ghiChu || `Đơn giá ${pr.tenGia}. Nhấn để nhanh chóng sửa.`}
                                    >
                                      <span>{pr.tenGia}:</span>
                                      <span className="font-mono">{pr.donGia.toLocaleString('vi-VN')} đ</span>
                                    </button>
                                  );
                                })
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">Chưa cấu hình đơn giá</span>
                              )}
                              
                              <button
                                onClick={() => handleOpenPriceManager(p, null)}
                                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded border border-dashed border-orange-300 bg-orange-50/50 hover:bg-orange-50 text-orange-700 text-[10px] font-extrabold cursor-pointer transition-colors animate-pulse"
                              >
                                <span>+ Thêm</span>
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      
                      {/* Thao tác (Edit / Delete) */}
                      <td className={`px-3 py-3 text-center sticky right-0 z-10 border-l border-slate-200 shadow-[-3px_0_6px_rgba(0,0,0,0.03)] ${stickyBgClass}`}>
                        {deleteConfirmId === p.id ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="bg-red-650 hover:bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded text-[9.5px] cursor-pointer"
                              title="Xác nhận xóa"
                            >
                              Xóa
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold px-1.5 py-0.5 rounded text-[9.5px] cursor-pointer"
                              title="Hủy"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="p-1 text-slate-500 hover:text-orange-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Sửa thông tin"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="p-1 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500 italic">
                    Không tìm thấy sản phẩm nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Controls */}
        {totalItems > 0 && (
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-600 text-xs text-[10.5px]">
            <div>
              Hiển thị từ <span className="font-bold text-slate-900">{startIndex + 1}</span> đến{' '}
              <span className="font-bold text-slate-900">
                {Math.min(startIndex + pageSize, totalItems)}
              </span>{' '}
              trong tổng số <span className="font-bold text-slate-900">{totalItems}</span> sản phẩm 
              {selectedCategory !== 'all' && (
                <span> thuộc <span className="text-orange-600 font-bold">{selectedCategory}</span></span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] px-2 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer"
              >
                Đầu
              </button>
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(activePage - 1)}
                className="p-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - activePage) <= 1) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-6 h-6 text-center text-[10.5px] font-bold rounded transition cursor-pointer ${
                          activePage === pageNum
                            ? 'bg-orange-600 text-white font-black border border-orange-600 shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className="text-slate-450 text-[10px] px-0.5">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(activePage + 1)}
                className="p-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] px-2 hover:bg-slate-100 hover:border-slate-400 transition cursor-pointer"
              >
                Cuối
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Styled Add/Edit Modal (Hộp thoại Popup) */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden text-[11.5px] animate-scale-up">
            
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase">
                  {modalMode === 'add' ? '✨ Thêm Sản Phẩm Nội Thất Mới' : '⚙️ Cập Nhật Sản Phẩm Nội Thất'}
                </h3>
              </div>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
 
            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 text-slate-800">
              
              {/* Product Code if editing */}
              {modalMode === 'edit' && (
                <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60 mb-1 flex items-center gap-1.5 font-mono text-[10px]">
                  <Info className="w-3.5 h-3.5 text-orange-600 mr-0.5" />
                  <span className="text-slate-600">Đang hiệu chỉnh hóa sản phẩm:</span>
                  <span className="font-extrabold text-orange-600 text-xs">{currentEditingId}</span>
                </div>
              )}
 
              {/* Lĩnh vực & Danh mục */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Lĩnh vực</label>
                  <select
                    value={fLinhVuc}
                    onChange={(e) => setFLinhVuc(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none cursor-pointer"
                  >
                    <option value="Nội thất">Nội thất</option>
                    <option value="Cơ khí">Cơ khí</option>
                    <option value="Xây dựng">Xây dựng</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Danh mục phòng / mảng</label>
                  <select
                    value={fDanhMuc}
                    onChange={(e) => setFDanhMuc(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none cursor-pointer"
                  >
                    <option value="Phòng Bếp">Phòng Bếp</option>
                    <option value="Phòng Ngủ">Phòng Ngủ</option>
                    <option value="Phòng Khách">Phòng Khách</option>
                    <option value="Phòng Thờ">Phòng Thờ</option>
                    <option value="Ngoại thất">Ngoại thất</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>
 
              {/* Tên sản phẩm */}
              <div>
                <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Tên sản phẩm *</label>
                <input
                  type="text"
                  required
                  value={fTenSanPham}
                  onChange={(e) => setFTenSanPham(e.target.value)}
                  placeholder="Ví dụ: Tủ bếp gỗ Melamine phủ bóng mờ"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none"
                />
              </div>
 
              {/* Chất liệu */}
              <div>
                <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Mô tả chi tiết chất liệu</label>
                <textarea
                  value={fChatLieu}
                  onChange={(e) => setFChatLieu(e.target.value)}
                  rows={2.5}
                  placeholder="Ví dụ: Gỗ CN MDF lõi xanh chống ẩm THÁI LAN, AN CƯỜNG phủ Melamin cả trên cả dưới..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none resize-none"
                />
              </div>
 
              {/* Đơn vị */}
              <div>
                <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Đơn vị tính</label>
                <select
                  value={fDonVi}
                  onChange={(e) => setFDonVi(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none cursor-pointer"
                >
                  <option value="Mét dài kép">Mét dài kép</option>
                  <option value="Mét dài">Mét dài</option>
                  <option value="Mét vuông">Mét vuông</option>
                  <option value="Chiếc">Chiếc</option>
                  <option value="Bộ">Bộ</option>
                </select>
              </div>

              {/* Hướng dẫn đơn giá riêng biệt */}
              <div className="bg-orange-50 border border-orange-200/80 p-3.5 rounded-xl text-xs text-orange-850 leading-relaxed font-medium">
                ⚡ <strong>Cấu hình đơn giá riêng:</strong> Sau khi sản phẩm được lưu, bạn có thể tự do thêm, sửa, xóa vô hạn các mức đơn giá liên kết phù hợp với từng chất liệu (như Thái Lan, An Cường, Plywood, Vân gỗ...) bằng cách click nút <strong>"+ Thêm"</strong> hoặc click trực tiếp vào nhãn đơn giá trên dòng sản phẩm ngoài bảng chính.
              </div>
 
              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-3.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-4.5 py-2.5 rounded-xl transition cursor-pointer"
                >
                  Đóng/Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-550 text-white font-black px-5 py-2.5 rounded-xl transition shadow shadow-orange-600/10 cursor-pointer"
                >
                  {modalMode === 'add' ? '✨ Nạp thêm mới' : '✅ Áp dụng thay đổi'}
                </button>
              </div>
 
            </form>
          </div>
        </div>
      )}

      {/* Price Management Modal */}
      {showPriceModal && priceModalProduct && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden text-[11.5px] animate-scale-up">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase">
                  💲 Quản lý bảng đơn giá riêng liên kết
                </h3>
              </div>
              <button 
                onClick={() => setShowPriceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product description header */}
            <div className="bg-slate-900 text-slate-150 px-5 py-3 border-b border-slate-850 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Sản phẩm áp dụng</div>
                <div className="text-xs font-black text-white mt-0.5">{priceModalProduct.id} - {priceModalProduct.tenSanPham}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Đơn vị</div>
                <div className="text-xs font-bold text-orange-400 mt-0.5">{priceModalProduct.donVi}</div>
              </div>
            </div>

            {/* Content Body: Left = Table, Right = Form */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5">
              
              {/* Left Column: Current Price Table */}
              <div className="md:col-span-7 space-y-3">
                <div className="text-xs font-extrabold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                  📁 Danh sách đơn giá hiện có ({pricesList.filter(pr => pr.productId === priceModalProduct.id).length})
                </div>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <th className="px-3 py-2 w-[120px]">Phân loại</th>
                        <th className="px-3 py-2 text-right w-[130px]">Đơn giá</th>
                        <th className="px-3 py-2 text-left">Ghi chú</th>
                        <th className="px-3 py-2 text-center w-[80px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const subPrices = pricesList.filter(pr => pr.productId === priceModalProduct.id);
                        if (subPrices.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} className="px-3 py-8 text-center text-slate-450 italic">
                                Chưa có đơn giá nào được liên kết. Hãy thêm bằng khung bên phải.
                              </td>
                            </tr>
                          );
                        }
                        return subPrices.map((pr) => (
                          <tr key={pr.id} className="border-b border-slate-200 hover:bg-slate-100/60 bg-white transition-colors">
                            <td className="px-3 py-2.5 font-extrabold text-slate-800">
                              <span className={`px-2 py-0.5 rounded text-[10px] inline-block ${
                                pr.tenGia === "Thái Lan" ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                pr.tenGia === "An Cường" ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                pr.tenGia === "Plywood" ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                                {pr.tenGia}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-700">
                              {pr.donGia.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-[10.5px] truncate max-w-[120px]" title={pr.ghiChu}>
                              {pr.ghiChu || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenPriceManager(priceModalProduct, pr)}
                                  className="p-1 hover:bg-slate-100 text-slate-500 hover:text-orange-600 rounded transition cursor-pointer"
                                  title="Sửa"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePrice(pr.id)}
                                  className="p-1 hover:bg-slate-100 text-slate-700 hover:text-red-600 rounded transition cursor-pointer"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Add/Edit Price Form */}
              <div className="md:col-span-12 lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
                <div className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  {priceFormMode === 'add' ? '➕ Thêm đơn giá liên kết' : '⚙️ Sửa đơn giá liên kết'}
                </div>
                
                <form onSubmit={handlePriceFormSubmit} className="space-y-3">
                  {/* Suggestion fast-click buttons */}
                  {priceFormMode === 'add' && (
                    <div>
                      <span className="block text-slate-500 font-bold mb-1 uppercase text-[8.5px]">Chọn mẫu nhanh</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['Thái Lan', 'An Cường', 'Plywood', 'MFC', 'Chống ẩm'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setFTenGia(tag)}
                            className="px-2 py-0.5 text-[9.5px] font-bold bg-white border border-slate-200 rounded hover:border-orange-500 hover:text-orange-600 transition cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Phân loại đơn giá *</label>
                    <input
                      type="text"
                      required
                      value={fTenGia}
                      onChange={(e) => setFTenGia(e.target.value)}
                      placeholder="Ví dụ: Thái Lan, An Cường, Plywood..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-950 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Số tiền đơn giá (đ/đơn vị) *</label>
                    <input
                      type="number"
                      required
                      value={fDonGia}
                      onChange={(e) => setFDonGia(e.target.value)}
                      placeholder="Ví dụ: 5400000"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-950 font-semibold text-right font-mono text-emerald-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Ghi chú phân loại</label>
                    <input
                      type="text"
                      value={fPriceGhiChu}
                      onChange={(e) => setFPriceGhiChu(e.target.value)}
                      placeholder="Ví dụ: MDF lõi xanh..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-950 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 bg-orange-600 hover:bg-orange-550 text-white font-extrabold p-2 rounded-lg text-center transition cursor-pointer text-xs"
                    >
                      {priceFormMode === 'add' ? '✨ Nạp đơn giá' : '✅ Lưu thay đổi'}
                    </button>
                    {priceFormMode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => {
                          setPriceFormMode('add');
                          setEditingPriceId(null);
                          setFTenGia('');
                          setFDonGia('');
                          setFPriceGhiChu('');
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold p-2 rounded-lg transition text-xs cursor-pointer"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </form>
              </div>

            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPriceModal(false)}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer text-xs"
              >
                Hoàn thành & Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Material Management Modal */}
      {showMaterialModal && materialModalProduct && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in text-[11.5px]">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden leading-relaxed animate-scale-up">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase">
                  🛠️ Quản lý bảng chất liệu liên kết
                </h3>
              </div>
              <button 
                onClick={() => setShowMaterialModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product description header */}
            <div className="bg-slate-900 text-slate-150 px-5 py-3 border-b border-slate-850 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Sản phẩm áp dụng</div>
                <div className="text-xs font-black text-white mt-0.5">{materialModalProduct.id} - {materialModalProduct.tenSanPham}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-450">Đơn vị</div>
                <div className="text-xs font-bold text-orange-400 mt-0.5">{materialModalProduct.donVi}</div>
              </div>
            </div>

            {/* Content Body: Left = Table, Right = Form */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5">
              
              {/* Left Column: Current Materials Table */}
              <div className="md:col-span-7 space-y-3">
                <div className="text-xs font-extrabold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                  📁 Danh sách chất liệu ({materialsList.filter(m => m.productId === materialModalProduct.id).length})
                </div>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                        <th className="px-3 py-2">Chi tiết chất liệu</th>
                        <th className="px-3 py-2 text-left w-[140px]">Ghi chú</th>
                        <th className="px-3 py-2 text-center w-[80px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const subMaterials = materialsList.filter(m => m.productId === materialModalProduct.id);
                        if (subMaterials.length === 0) {
                          return (
                            <tr>
                              <td colSpan={3} className="px-3 py-8 text-center text-slate-450 italic">
                                Chưa liên kết chất liệu nào. Hãy bổ sung bằng khung bên phải.
                              </td>
                            </tr>
                          );
                        }
                        return subMaterials.map((m) => (
                          <tr key={m.id} className="border-b border-slate-200 hover:bg-slate-100/60 bg-white transition-colors">
                            <td className="px-3 py-2.5 text-slate-800 font-medium">
                              <div className="whitespace-normal break-words max-w-[280px]">
                                {m.tenChatLieu}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-500 text-[10.5px]">
                              {m.ghiChu || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMaterialManager(materialModalProduct, m)}
                                  className="p-1 hover:bg-slate-100 text-slate-500 hover:text-orange-600 rounded transition cursor-pointer"
                                  title="Sửa"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMaterial(m.id)}
                                  className="p-1 hover:bg-slate-100 text-slate-700 hover:text-red-600 rounded transition cursor-pointer"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Add/Edit Material Form */}
              <div className="md:col-span-12 lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
                <div className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  {materialFormMode === 'add' ? '➕ Thêm chất liệu liên kết' : '⚙️ Sửa chất liệu liên kết'}
                </div>
                
                <form onSubmit={handleMaterialFormSubmit} className="space-y-3">
                  {/* Suggestion fast-click buttons */}
                  {materialFormMode === 'add' && (
                    <div>
                      <span className="block text-slate-500 font-bold mb-1 uppercase text-[8.5px]">Mẫu nhanh có sẵn</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'NHỰA PICOMAT CHỐNG NƯỚC',
                          'MDF THÁI LAN CHỐNG ẨM',
                          'MDF AN CƯỜNG CAO CẤP',
                          'PLYWOOD CAO CẤP',
                          'ACRYLIC BÓNG GƯƠNG',
                          'MELAMIN CAO CẤP',
                          'ĐÁ KIM SA TỰ NHIÊN',
                          'KÍNH CƯỜNG LỰC 8MM',
                          'SẮT HỘP MẠ KẼM'
                        ].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setFTenChatLieu(prev => prev ? prev + ', ' + tag : tag);
                            }}
                            className="px-2 py-0.5 text-[9px] font-bold bg-white border border-slate-200 rounded hover:border-orange-500 hover:text-orange-600 transition cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Chi tiết chất liệu *</label>
                    <textarea
                      required
                      rows={4}
                      value={fTenChatLieu}
                      onChange={(e) => setFTenChatLieu(e.target.value)}
                      placeholder="Mô tả chất liệu chi tiết cụ thể tủ trên/dưới, vách ngăn..."
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-950 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-extrabold mb-1.5 uppercase tracking-wider text-[9px]">Ghi chú phân loại</label>
                    <input
                      type="text"
                      value={fMaterialGhiChu}
                      onChange={(e) => setFMaterialGhiChu(e.target.value)}
                      placeholder="Ví dụ: Chỉ áp dụng cho tủ cao tiêu chuẩn"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-950 font-semibold focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 font-bold">
                    <button
                      type="submit"
                      className="flex-1 bg-orange-600 hover:bg-orange-550 text-white font-extrabold p-2 rounded-lg text-center transition cursor-pointer text-xs"
                    >
                      {materialFormMode === 'add' ? '✨ Nạp chất liệu' : '✅ Lưu thay đổi'}
                    </button>
                    {materialFormMode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMaterialFormMode('add');
                          setEditingMaterialId(null);
                          setFTenChatLieu('');
                          setFMaterialGhiChu('');
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold p-2 rounded-lg transition text-xs cursor-pointer"
                      >
                        Hủy
                      </button>
                    )}
                  </div>
                </form>
              </div>

            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="bg-slate-900 hover:bg-slate-850 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer text-xs"
              >
                Hoàn thành & Đóng
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
