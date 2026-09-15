import React from 'react';
import { X } from 'lucide-react';

interface GenericModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

const GenericModal: React.FC<GenericModalProps> = ({ isOpen, onClose, title, children, width = 'max-w-4xl' }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-start pt-16 animate-fadeIn">
      <div className={`bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 ${width} w-full flex flex-col animate-scaleIn`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default GenericModal;
