import React, { useState } from 'react';
import { Users, X } from 'lucide-react';
import { Customer } from '../types';

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onSuccess: (generatedId: string, address: string) => void;
}

const getAbbrev = (nameStr: string): string => {
  if (!nameStr) return '';
  const norm = nameStr
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const words = norm.trim().split(/\s+/).filter(Boolean);
  return words.map(w => w[0].toUpperCase()).join('');
};

export const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({
  isOpen,
  onClose,
  customers,
  onAddCustomer,
  onSuccess
}) => {
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustType, setQuickCustType] = useState<'individual' | 'organization'>('individual');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');
  const [quickCustRep, setQuickCustRep] = useState('');
  const [quickCustTax, setQuickCustTax] = useState('');
  const [quickCustNotes, setQuickCustNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;

    const abbrev = getAbbrev(quickCustName);
    const orderIndex = customers.length + 1;
    const generatedId = `KH_${abbrev}_${orderIndex}`;

    const newCust: Customer = {
      id: generatedId,
      name: quickCustName,
      type: quickCustType,
      phone: quickCustPhone,
      email: `${abbrev.toLowerCase()}@example.com`,
      address: quickCustAddress,
      representative: quickCustRep,
      taxOrIdNumber: quickCustTax,
      notes: quickCustNotes
    };

    onAddCustomer(newCust);
    onSuccess(generatedId, quickCustAddress);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[60] p-4 font-sans text-slate-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs text-left animate-scaleIn">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            <h3 className="font-extrabold text-white text-sm">Thêm nhanh Khách hàng mới</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-450 font-semibold mb-1">Mã khách hàng tự sinh</label>
            <input
              type="text"
              disabled
              value={quickCustName ? `KH_${getAbbrev(quickCustName)}_${customers.length + 1}` : 'KH_[Tên viết tắt]_[STT]'}
              className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-orange-400 font-mono font-bold cursor-not-allowed outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-350 font-bold mb-1">Tên khách hàng <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              placeholder="Nhập tên khách hàng..."
              value={quickCustName}
              onChange={(e) => setQuickCustName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-855 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-350 font-bold mb-1">Loại khách hàng</label>
              <select
                value={quickCustType}
                onChange={(e) => setQuickCustType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-white outline-none cursor-pointer focus:border-orange-500 font-bold"
              >
                <option value="individual">👤 Cá nhân</option>
                <option value="organization">🏢 Tổ chức</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-350 font-bold mb-1">Số điện thoại (* kiểu số)</label>
              <input
                type="text"
                required
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="ví dụ: 0912345678"
                value={quickCustPhone}
                onChange={(e) => setQuickCustPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
              />
            </div>
          </div>

          {quickCustType === 'organization' && (
            <div>
              <label className="block text-slate-350 font-bold mb-1">Người đại diện <span className="text-red-400">*</span></label>
              <input
                type="text"
                required={quickCustType === 'organization'}
                placeholder="Nhập họ tên người đại diện pháp nhân..."
                value={quickCustRep}
                onChange={(e) => setQuickCustRep(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
              />
            </div>
          )}

          <div>
            <label className="block text-slate-350 font-bold mb-1">Địa chỉ</label>
            <input
              type="text"
              placeholder="Địa chỉ liên hệ nhà thô..."
              value={quickCustAddress}
              onChange={(e) => setQuickCustAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-855 rounded px-2.5 py-1.5 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-slate-350 font-bold mb-1">MST / CMND (* kiểu số)</label>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Mã số thuế hoặc Mã CMND..."
              value={quickCustTax}
              onChange={(e) => setQuickCustTax(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-white outline-none font-mono focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-slate-350 font-bold mb-1">Ghi chú lưu ý</label>
            <textarea
              rows={2}
              placeholder="Nhật trình hoặc vật tư gỗ ván mong muốn..."
              value={quickCustNotes}
              onChange={(e) => setQuickCustNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded p-1.5 text-white outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 rounded cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-1.5 rounded cursor-pointer transition-colors"
            >
              Thêm & Chọn
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
