/** Inventory item (vật tư tồn kho) */
export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  minAlert: number;
  location: string;
}

/** Warehouse transaction log (nhập/xuất kho) */
export interface WarehouseLog {
  id: string;
  time: string;
  type: 'in' | 'out';
  matName: string;
  qty: number;
  target: string;
  note: string;
}

/** Supplier / vendor (nhà cung cấp) */
export interface Supplier {
  id: string;
  name: string;
  representative: string;
  phone: string;
  email: string;
  address: string;
  field: string;
  bankAccount: string;
  bankName: string;
  note: string;
  debt: number;
  region?: string;
  bankNo?: string;
  // Accept additional metadata for forward-compat
  [key: string]: any;
}
