import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Palette } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  themeColor?: 'indigo' | 'emerald' | 'pink' | 'orange';
}

const COLORS = [
  { name: 'Mặc định', hex: '#1e293b' },
  { name: 'Xanh lục', hex: '#10b981' },
  { name: 'Xanh lam', hex: '#3b82f6' },
  { name: 'Đỏ', hex: '#ef4444' },
  { name: 'Cam', hex: '#f97316' },
  { name: 'Tím', hex: '#4f46e5' },
];

export default function RichTextEditor({ value, onChange, disabled = false, themeColor = 'indigo' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#1e293b');

  // Load initial value or when value changes externally (e.g. loading a saved quote)
  useEffect(() => {
    if (editorRef.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '<p><br></p>';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, value: string = '') => {
    if (disabled) return;
    document.execCommand(command, false, value);
    handleInput();
  };

  const themeClasses = {
    indigo: {
      border: 'focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500',
      activeBtn: 'text-indigo-600 bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    emerald: {
      border: 'focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500',
      activeBtn: 'text-emerald-600 bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    pink: {
      border: 'focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500',
      activeBtn: 'text-pink-600 bg-pink-50',
      iconColor: 'text-pink-600',
    },
    orange: {
      border: 'focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500',
      activeBtn: 'text-orange-600 bg-orange-50',
      iconColor: 'text-orange-600',
    }
  };

  const selectedTheme = themeClasses[themeColor];

  return (
    <div className={`w-full border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all ${selectedTheme.border} ${disabled ? 'opacity-70 pointer-events-none' : ''}`}>
      {/* Format Menu Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3 py-1.5 gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('bold');
            }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="In đậm (Bold)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('italic');
            }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="In nghiêng (Italic)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onMouseDown={(e) => {
              e.preventDefault();
              executeCommand('underline');
            }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Gạch chân (Underline)"
          >
            <Underline className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          {/* Color Menu */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
              title="Màu chữ (Text Color)"
            >
              <Palette className="w-4 h-4" />
              <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: customColor }}></span>
            </button>

            {showColorPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50 grid grid-cols-3 gap-1 w-36">
                {COLORS.map((col) => (
                  <button
                    key={col.hex}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomColor(col.hex);
                      executeCommand('foreColor', col.hex);
                      setShowColorPicker(false);
                    }}
                    className="w-full text-[10px] py-1 px-1.5 rounded hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700 cursor-pointer text-left"
                    style={{ borderLeft: `3px solid ${col.hex}` }}
                  >
                    {col.name}
                  </button>
                ))}
                <div className="col-span-3 border-t border-slate-100 my-1 pt-1.5 flex items-center gap-1">
                  <span className="text-[9px] font-semibold text-slate-500 whitespace-nowrap">Tự chọn:</span>
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      executeCommand('foreColor', e.target.value);
                    }}
                    className="w-full h-5 p-0 border-0 cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="text-[10px] text-slate-400 italic pr-1">
          Bôi đen chữ để áp dụng định dạng
        </div>
      </div>

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        className="w-full p-3 min-h-[140px] max-h-[280px] overflow-y-auto text-xs text-slate-800 outline-none leading-relaxed text-left font-sans prose prose-sm focus:prose-indigo"
        style={{ direction: 'ltr' }}
      />
    </div>
  );
}
