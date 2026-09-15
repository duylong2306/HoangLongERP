import React, { useState, useRef, useEffect } from 'react';
import { Customer } from '../types';
import { Search, ChevronDown, X, User, Phone, MapPin } from 'lucide-react';

interface SearchableCustomerSelectProps {
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
  placeholder: string;
  id?: string;
  disabled?: boolean;
  onSelectionChange?: (customer: Customer | null) => void;
}

export default function SearchableCustomerSelect({
  value,
  onChange,
  customers,
  placeholder,
  id,
  disabled = false,
  onSelectionChange
}: SearchableCustomerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset search when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Notify parent when selection changes
  useEffect(() => {
    const selectedCustomer = customers.find(c => c.id === value) || null;
    onSelectionChange?.(selectedCustomer);
  }, [value, customers, onSelectionChange]);

  const selectedCustomer = customers.find(c => c.id === value);

  // Filter customers based on search query (name, phone, address, email)
  const filteredCustomers = customers.filter(c => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      c.name.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      (c.address?.toLowerCase().includes(query) ?? false) ||
      (c.email?.toLowerCase().includes(query) ?? false) ||
      (c.company?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="relative w-full" ref={dropdownRef} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-slate-950 border rounded-lg px-3 py-2 outline-none text-[11px] font-medium flex items-center justify-between text-left transition-colors duration-150 ${
          disabled
            ? 'border-slate-800/60 text-slate-400 cursor-not-allowed opacity-80'
            : 'border-slate-700 text-slate-200 cursor-pointer hover:bg-slate-900'
        }`}
      >
        <span className="truncate flex items-center gap-2">
          {selectedCustomer ? (
            <>
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{selectedCustomer.name}</span>
              {selectedCustomer.phone && (
                <span className="ml-2 text-[9px] text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">{selectedCustomer.phone}</span>
              )}
            </>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </span>
        {disabled ? (
          <svg className="w-4 h-4 ml-1 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        ) : (
          <ChevronDown className="w-4 h-4 ml-1 text-slate-500 shrink-0" />
        )}
      </button>

      {/* Popover List */}
      {isOpen && !disabled && (
        <div className="absolute z-[100] left-0 right-0 mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-72">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-700 flex items-center gap-1.5 bg-slate-900">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tên, SĐT, địa chỉ, email..."
              className="w-full bg-transparent text-[11px] text-slate-200 outline-none placeholder-slate-550 border-none p-0 focus:ring-0"
              autoFocus
            />
          </div>

          {/* Options Scroll Container */}
          <div className="overflow-y-auto max-h-56 custom-scrollbar">
            {/* Clear Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 ${
                !value ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>{placeholder}</span>
            </button>

            {/* Customer List */}
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map(cust => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => {
                    onChange(cust.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-slate-800 transition-colors flex items-start gap-2 ${
                    value === cust.id ? 'bg-slate-800 text-sky-400' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">{cust.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-500">
                      {cust.phone && (
                        <>
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="truncate">{cust.phone}</span>
                        </>
                      )}
                      {cust.address && (
                        <>
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[180px]">{cust.address}</span>
                        </>
                      )}
                      {cust.company && (
                        <>
                          <span className="px-1.5 py-0.5 bg-amber-900/30 text-amber-400 rounded text-[8px]">{cust.company}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-[11px] text-slate-500 text-center">
                Không tìm thấy khách hàng
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}