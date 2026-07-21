import React, { useState, useRef, useEffect } from 'react';
import { Employee } from '../types';
import { Search, ChevronDown, Lock } from 'lucide-react';

interface SearchableEmployeeSelectProps {
  value: string;
  onChange: (value: string) => void;
  employees: Employee[];
  placeholder: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
}

export default function SearchableEmployeeSelect({
  value,
  onChange,
  employees,
  placeholder,
  id,
  disabled = false
}: SearchableEmployeeSelectProps) {
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

  const selectedEmployee = employees.find(emp => emp.id === value);
  
  const getRoleLabel = (role?: string) => {
    if (!role) return '';
    switch (role) {
      case 'director': return 'Giám đốc';
      case 'pm': return 'Trưởng Dự Án';
      case 'accountant': return 'Kế Toán';
      default: return role;
    }
  };

  // Filter employees based on search query
  const filteredEmployees = employees.filter(emp => {
    const nameMatch = emp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const roleLabel = getRoleLabel(emp.role);
    const roleMatch = roleLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || roleMatch;
  });

  return (
    <div className="relative w-full" ref={dropdownRef} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1.5 outline-none text-[10px] font-medium flex items-center justify-between text-left transition-colors duration-150 ${
          disabled
            ? 'border-slate-800/60 text-slate-400 cursor-not-allowed opacity-80'
            : 'border-slate-800 text-slate-300 cursor-pointer hover:bg-slate-900'
        }`}
      >
        <span className="truncate">
          {selectedEmployee
            ? `${selectedEmployee.name}${selectedEmployee.role ? ` (${getRoleLabel(selectedEmployee.role)})` : ''}`
            : placeholder
          }
        </span>
        {disabled ? (
          <Lock className="w-3.5 h-3.5 ml-1 text-slate-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-500 shrink-0" />
        )}
      </button>

      {/* Popover List */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-56">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-800 flex items-center gap-1.5 bg-slate-900">
            <Search className="w-3 h-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm nhân viên..."
              className="w-full bg-transparent text-[10px] text-slate-200 outline-none placeholder-slate-550 border-none p-0 focus:ring-0"
              autoFocus
            />
          </div>

          {/* Options Scroll Container */}
          <div className="overflow-y-auto max-h-44 custom-scrollbar">
            {/* Default/Placeholder Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-[10px] font-medium hover:bg-slate-900 transition-colors ${
                !value ? 'bg-slate-900 text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {placeholder}
            </button>

            {/* Employee List */}
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    onChange(emp.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 text-[10px] font-medium hover:bg-slate-900 transition-colors flex items-center justify-between ${
                    value === emp.id ? 'bg-slate-900 text-sky-400' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="truncate">{emp.name}</span>
                  <span className="text-[9px] text-slate-500 font-normal shrink-0">
                    {getRoleLabel(emp.role)}
                  </span>
                </button>
              ))
            ) : (
              <div className="p-3 text-[10px] text-slate-500 text-center">
                Không tìm thấy nhân viên
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
