import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, Palette,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, WrapText,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  themeColor?: 'indigo' | 'emerald' | 'pink' | 'orange';
  /**
   * Ẩn hẳn thanh công cụ khi disabled (thay vì chỉ làm mờ) — dùng cho các màn
   * "xem bản in" nơi disabled = đang ở chế độ xem, không cần hiện toolbar thừa.
   */
  hideToolbarWhenDisabled?: boolean;
  /**
   * Class Tailwind cho chiều cao vùng soạn thảo — mặc định giữ nguyên kích
   * thước nhỏ (ghi chú/điều khoản ngắn) như trước đây để không đổi hành vi ở
   * các nơi đang dùng RichTextEditor (TaskDetailModal, các Estimator...). Các
   * màn bản in Hợp Đồng/Nghiệm Thu/Thanh Lý (nội dung dài cả trang) truyền
   * class riêng để không bị giới hạn max-height 280px.
   */
  editorHeightClassName?: string;
}

// Các mức giãn dòng thường dùng trong soạn thảo văn bản (giống Word: 1/1.15/1.5/2).
const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
];

const COLORS = [
  { name: 'Mặc định', hex: '#1e293b' },
  { name: 'Xanh lục', hex: '#10b981' },
  { name: 'Xanh lam', hex: '#3b82f6' },
  { name: 'Đỏ', hex: '#ef4444' },
  { name: 'Cam', hex: '#f97316' },
  { name: 'Tím', hex: '#4f46e5' },
];

export default function RichTextEditor({ value, onChange, disabled = false, themeColor = 'indigo', hideToolbarWhenDisabled = false, editorHeightClassName }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#1e293b');
  const [showLineHeightPicker, setShowLineHeightPicker] = useState(false);

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

  // Giãn dòng (line-height): trình duyệt không có execCommand chuẩn cho việc này
  // (khác Bold/Italic/căn lề đều có sẵn) — phải tự lấy vùng bôi đen, dò lên khối
  // cha gần nhất (thẻ block như p/div/li/h1-h6) rồi gán trực tiếp style.lineHeight
  // cho từng khối nằm trong vùng chọn.
  const applyLineHeight = (lineHeight: string) => {
    if (disabled || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return;

    const BLOCK_TAGS = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'];
    const findBlock = (node: Node | null): HTMLElement | null => {
      let el: HTMLElement | null = node instanceof HTMLElement ? node : node?.parentElement || null;
      while (el && el !== editorRef.current) {
        if (BLOCK_TAGS.includes(el.tagName)) return el;
        el = el.parentElement;
      }
      return null;
    };

    // Vùng chọn có thể trải qua nhiều khối (bôi đen nhiều đoạn) — dùng TreeWalker
    // liệt kê mọi khối giao với range thay vì chỉ lấy 1 khối duy nhất.
    const blocks = new Set<HTMLElement>();
    const startBlock = findBlock(range.startContainer);
    const endBlock = findBlock(range.endContainer);
    if (startBlock) blocks.add(startBlock);
    if (endBlock) blocks.add(endBlock);
    if (startBlock && endBlock && startBlock !== endBlock) {
      const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_ELEMENT);
      let inRange = false;
      let node = walker.nextNode();
      while (node) {
        if (node === startBlock) inRange = true;
        if (inRange && node instanceof HTMLElement && BLOCK_TAGS.includes(node.tagName)) blocks.add(node);
        if (node === endBlock) break;
        node = walker.nextNode();
      }
    }
    if (blocks.size === 0 && editorRef.current) blocks.add(editorRef.current);
    blocks.forEach(b => { b.style.lineHeight = lineHeight; });
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
    <div className={`w-full ${hideToolbarWhenDisabled && disabled ? '' : 'border border-slate-200 rounded-xl shadow-sm'} overflow-hidden bg-white transition-all ${selectedTheme.border} ${disabled && !hideToolbarWhenDisabled ? 'opacity-70 pointer-events-none' : ''}`}>
      {/* Format Menu Bar — ẩn hẳn (không chỉ mờ) khi đang ở chế độ chỉ xem và
          hideToolbarWhenDisabled=true, tránh thanh công cụ thừa trên bản in. */}
      {!(hideToolbarWhenDisabled && disabled) && (
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
              // onMouseDown + preventDefault (thay vì onClick) — giữ nguyên vùng bôi
              // đen đang chọn trong contentEditable khi mở menu màu. onClick thường
              // sẽ khiến trình duyệt xoá lựa chọn NGAY khi mousedown xảy ra trước đó,
              // đến lúc chọn màu thì không còn gì để áp dụng foreColor lên.
              onMouseDown={(e) => { e.preventDefault(); setShowColorPicker(!showColorPicker); }}
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

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          {/* Căn chỉnh đoạn văn — giống Word: trái/giữa/phải/đều 2 bên */}
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyLeft'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Căn trái">
            <AlignLeft className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyCenter'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Căn giữa">
            <AlignCenter className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyRight'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Căn phải">
            <AlignRight className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyFull'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Căn đều 2 bên">
            <AlignJustify className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          {/* Danh sách + thụt lề */}
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('insertUnorderedList'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Danh sách không thứ tự">
            <List className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('insertOrderedList'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Danh sách có thứ tự">
            <ListOrdered className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('outdent'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Giảm thụt lề">
            <Outdent className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('indent'); }}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer" title="Tăng thụt lề">
            <Indent className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1"></div>

          {/* Giãn dòng */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              // Cùng lý do như nút màu chữ ở trên — giữ nguyên vùng bôi đen khi mở menu.
              onMouseDown={(e) => { e.preventDefault(); setShowLineHeightPicker(!showLineHeightPicker); }}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Giãn dòng (Line spacing)"
            >
              <WrapText className="w-4 h-4" />
            </button>
            {showLineHeightPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-20">
                {LINE_HEIGHTS.map((lh) => (
                  <button
                    key={lh.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyLineHeight(lh.value);
                      setShowLineHeightPicker(false);
                    }}
                    className="w-full text-[10px] py-1 px-1.5 rounded hover:bg-slate-50 font-medium text-slate-700 cursor-pointer text-left"
                  >
                    {lh.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-[10px] text-slate-400 italic pr-1">
          Bôi đen chữ để áp dụng định dạng
        </div>
      </div>
      )}

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        className={`w-full p-3 overflow-y-auto text-xs text-slate-800 outline-none leading-relaxed text-left font-sans prose prose-sm focus:prose-indigo ${editorHeightClassName || 'min-h-[140px] max-h-[280px]'}`}
        style={{ direction: 'ltr' }}
      />
    </div>
  );
}
