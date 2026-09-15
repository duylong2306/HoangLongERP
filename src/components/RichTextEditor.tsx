import React, { useRef, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, Palette,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, WrapText,
  Eraser, Strikethrough, Subscript, Superscript, Highlighter,
  ListTree, ArrowDownAZ, Pilcrow, PaintBucket, Square, ChevronDown, CaseSensitive,
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

// Bảng màu tô sáng (Text Highlight Color) — giống bộ màu mặc định của Word.
const HIGHLIGHT_COLORS = [
  { name: 'Không màu', hex: 'transparent' },
  { name: 'Vàng', hex: '#ffff00' },
  { name: 'Xanh lục', hex: '#00ff00' },
  { name: 'Xanh lam nhạt', hex: '#00ffff' },
  { name: 'Hồng', hex: '#ff00ff' },
  { name: 'Xanh lam', hex: '#0000ff' },
  { name: 'Đỏ', hex: '#ff0000' },
  { name: 'Xám', hex: '#c0c0c0' },
];

// Bảng màu tô nền đoạn văn (Shading) — tương đương nút "Shading" trong Word.
const SHADING_COLORS = [
  { name: 'Không tô', hex: 'transparent' },
  { name: 'Xám nhạt', hex: '#f1f5f9' },
  { name: 'Vàng nhạt', hex: '#fef9c3' },
  { name: 'Xanh lục nhạt', hex: '#dcfce7' },
  { name: 'Xanh lam nhạt', hex: '#dbeafe' },
  { name: 'Hồng nhạt', hex: '#fce7f3' },
];

const FONT_FAMILIES = ['Times New Roman', 'Arial', 'Calibri', 'Verdana', 'Tahoma', 'Courier New', 'Georgia'];
const FONT_SIZES = [8, 9, 10, 10.5, 11, 12, 13, 13.5, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72];

// Kiểu chữ hoa/thường (Change Case) — Word có 5 lựa chọn, giữ nguyên đủ 5.
const CASE_OPTIONS: { label: string; mode: 'sentence' | 'lower' | 'upper' | 'title' | 'toggle' }[] = [
  { label: 'Sentence case.', mode: 'sentence' },
  { label: 'lowercase', mode: 'lower' },
  { label: 'UPPERCASE', mode: 'upper' },
  { label: 'Capitalize Each Word', mode: 'title' },
  { label: 'tOGGLE cASE', mode: 'toggle' },
];

// Danh sách nhiều cấp (Multilevel List) — Word cho chọn kiểu đánh số lồng nhau;
// bản đơn giản hoá ở đây chỉ đổi list-style-type của danh sách gần nhất, KHÔNG
// dựng cơ chế tự tăng cấp số nhiều tầng đầy đủ như Word (execCommand không hỗ
// trợ, phải tự viết cả 1 engine đánh số riêng — vượt phạm vi 1 nút bấm nhanh).
const MULTILEVEL_STYLES = [
  { label: '1, 2, 3…', tag: 'OL', listStyle: 'decimal' },
  { label: 'a, b, c…', tag: 'OL', listStyle: 'lower-alpha' },
  { label: 'i, ii, iii…', tag: 'OL', listStyle: 'lower-roman' },
  { label: '• Chấm tròn', tag: 'UL', listStyle: 'disc' },
  { label: '○ Chấm rỗng', tag: 'UL', listStyle: 'circle' },
];

const BLOCK_TAGS = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'];

export default function RichTextEditor({ value, onChange, disabled = false, themeColor = 'indigo', hideToolbarWhenDisabled = false, editorHeightClassName }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#1e293b');
  const [showLineHeightPicker, setShowLineHeightPicker] = useState(false);
  const [showFontFamilyPicker, setShowFontFamilyPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [showMultilevelPicker, setShowMultilevelPicker] = useState(false);
  const [showShadingPicker, setShowShadingPicker] = useState(false);
  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [customHighlight, setCustomHighlight] = useState('#ffff00');
  const [formattingMarksVisible, setFormattingMarksVisible] = useState(false);

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

  // Tìm khối (block) cha gần nhất chứa 1 node — dùng chung cho giãn dòng/tô nền/viền.
  const findBlock = (node: Node | null): HTMLElement | null => {
    if (!editorRef.current) return null;
    let el: HTMLElement | null = node instanceof HTMLElement ? node : node?.parentElement || null;
    while (el && el !== editorRef.current) {
      if (BLOCK_TAGS.includes(el.tagName)) return el;
      el = el.parentElement;
    }
    return null;
  };

  // Liệt kê MỌI khối block giao với vùng đang bôi đen (bôi đen có thể trải qua
  // nhiều đoạn) — dùng chung cho giãn dòng/tô nền/viền khung.
  const getSelectedBlocks = (): HTMLElement[] => {
    if (!editorRef.current) return [];
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return [];

    // Bôi đen "cả dòng" (VD: triple-click) thường đặt điểm kết thúc range ở
    // offset 0 của khối/node KẾ TIẾP (quy ước trình duyệt: ranh giới đoạn văn),
    // KHÔNG có nghĩa là đã chọn nội dung nào trong khối đó — nếu không xử lý,
    // findBlock(range.endContainer) sẽ trả về nhầm khối kế tiếp, khiến hàm này
    // áp dụng định dạng lên cả 1 đoạn văn KHÔNG được chọn (bug thật đã gặp khi
    // test Shading — tô nhầm sang đoạn liền sau). Lùi điểm cuối về node văn bản
    // TRƯỚC đó khi endOffset=0, để tìm đúng khối cuối thực sự nằm trong lựa chọn.
    let endContainer: Node = range.endContainer;
    if (range.endOffset === 0 && range.collapsed === false) {
      const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
      walker.currentNode = endContainer;
      const prevText = walker.previousNode();
      if (prevText) endContainer = prevText;
    }

    const blocks = new Set<HTMLElement>();
    const startBlock = findBlock(range.startContainer);
    const endBlock = findBlock(endContainer);
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
    return Array.from(blocks);
  };

  // Giãn dòng (line-height): trình duyệt không có execCommand chuẩn cho việc này
  // (khác Bold/Italic/căn lề đều có sẵn) — phải tự lấy vùng bôi đen, dò lên khối
  // cha gần nhất (thẻ block như p/div/li/h1-h6) rồi gán trực tiếp style.lineHeight
  // cho từng khối nằm trong vùng chọn.
  const applyLineHeight = (lineHeight: string) => {
    if (disabled) return;
    const blocks = getSelectedBlocks();
    blocks.forEach(b => { b.style.lineHeight = lineHeight; });
    handleInput();
  };

  // Cỡ chữ theo pt (Word dùng pt, không phải thang 1-7 của execCommand fontSize)
  // — mẹo chuẩn: cho execCommand gắn tạm size="7" rồi thay bằng style.fontSize
  // đúng số pt, xoá thuộc tính size cũ đi.
  const applyFontSize = (pt: number) => {
    if (disabled || !editorRef.current) return;
    document.execCommand('fontSize', false, '7');
    editorRef.current.querySelectorAll('font[size="7"]').forEach((f) => {
      f.removeAttribute('size');
      (f as HTMLElement).style.fontSize = `${pt}pt`;
    });
    handleInput();
  };

  // Tăng/giảm cỡ chữ (Grow/Shrink Font) — đọc cỡ chữ HIỆN TẠI của vùng bôi đen
  // (computed style, vì có thể đang kế thừa từ CSS chứ không có style riêng)
  // rồi cộng/trừ 2pt và áp dụng như applyFontSize.
  const stepFontSize = (deltaPt: number) => {
    if (disabled) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const node = selection.getRangeAt(0).commonAncestorContainer;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    const currentPx = el ? parseFloat(window.getComputedStyle(el).fontSize) : 16;
    const currentPt = Math.round((currentPx / 96) * 72); // đổi px (96dpi) → pt
    applyFontSize(Math.max(6, currentPt + deltaPt));
  };

  // Đổi chữ hoa/thường (Change Case) — không có execCommand cho việc này, phải
  // tự lấy text của vùng bôi đen, biến đổi rồi chèn lại bằng insertText. LƯU Ý:
  // insertText thay nguyên vùng chọn bằng text THUẦN — nếu vùng bôi đen có định
  // dạng lồng bên trong (VD: 1 chữ đang bold giữa câu) thì định dạng đó bị mất,
  // chỉ giữ được định dạng áp dụng cho TOÀN vùng chọn.
  const applyTextCase = (mode: 'sentence' | 'lower' | 'upper' | 'title' | 'toggle') => {
    if (disabled) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const text = selection.getRangeAt(0).toString();
    let newText = text;
    if (mode === 'upper') newText = text.toUpperCase();
    else if (mode === 'lower') newText = text.toLowerCase();
    else if (mode === 'title') newText = text.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    else if (mode === 'sentence') newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    else if (mode === 'toggle') newText = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
    document.execCommand('insertText', false, newText);
    handleInput();
  };

  // Tô nền đoạn văn (Shading) — khác Highlight (tô nền CHỮ), Shading tô nền cho
  // cả khối đoạn văn chứa vùng bôi đen.
  const applyShading = (color: string) => {
    if (disabled) return;
    const blocks = getSelectedBlocks();
    blocks.forEach(b => { b.style.backgroundColor = color === 'transparent' ? '' : color; });
    handleInput();
  };

  // Viền khung đoạn văn (Borders) — bản đơn giản hoá: chỉ có 2 lựa chọn "Viền
  // khung" (bọc 1 viền mảnh quanh toàn bộ đoạn) / "Không viền", khác Word có cả
  // bảng lưới chọn từng cạnh (trên/dưới/trái/phải/trong) — vượt phạm vi 1 nút.
  const applyBorder = (on: boolean) => {
    if (disabled) return;
    const blocks = getSelectedBlocks();
    blocks.forEach(b => { b.style.border = on ? '1px solid #64748b' : 'none'; b.style.padding = on ? '4px 6px' : b.style.padding; });
    handleInput();
  };

  // Sắp xếp danh sách A→Z (Sort) — Word mở hộp thoại chọn tiêu chí, ở đây đơn
  // giản hoá thành sắp xếp TĂNG DẦN theo nội dung chữ ngay khi bấm. Ưu tiên sắp
  // xếp danh sách (ul/ol) gần vị trí con trỏ nhất; nếu con trỏ không nằm trong
  // danh sách nào thì không làm gì (không đoán nhầm sang đoạn văn thường).
  const sortListAscending = () => {
    if (disabled || !editorRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const node = selection.getRangeAt(0).commonAncestorContainer;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    const list = el?.closest('ul,ol');
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    if (items.length < 2) return;
    const sorted = [...items].sort((a, b) => (a.textContent || '').localeCompare(b.textContent || '', 'vi'));
    sorted.forEach(item => list.appendChild(item));
    handleInput();
  };

  // Danh sách nhiều cấp (Multilevel List) — đổi list-style-type của ul/ol gần
  // nhất; nếu con trỏ chưa nằm trong danh sách nào thì tạo mới 1 danh sách từ
  // đoạn văn hiện tại (giống hành vi insertOrderedList/insertUnorderedList).
  const applyMultilevelStyle = (opt: typeof MULTILEVEL_STYLES[number]) => {
    if (disabled || !editorRef.current) return;
    const selection = window.getSelection();
    const node = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).commonAncestorContainer : null;
    const el = node instanceof HTMLElement ? node : node?.parentElement || null;
    const existingList = el?.closest('ul,ol') as HTMLElement | null;
    if (existingList) {
      existingList.style.listStyleType = opt.listStyle;
    } else {
      executeCommand(opt.tag === 'OL' ? 'insertOrderedList' : 'insertUnorderedList');
      const list = editorRef.current.querySelector('ul:last-of-type, ol:last-of-type') as HTMLElement | null;
      if (list) list.style.listStyleType = opt.listStyle;
    }
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
  const btnClass = "p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer";
  const Divider = () => <div className="w-px h-5 bg-slate-200 mx-1"></div>;

  return (
    <div className={`w-full ${hideToolbarWhenDisabled && disabled ? '' : 'border border-slate-200 rounded-xl shadow-sm'} overflow-hidden bg-white transition-all ${selectedTheme.border} ${disabled && !hideToolbarWhenDisabled ? 'opacity-70 pointer-events-none' : ''}`}>
      {/* Format Menu Bar — ẩn hẳn (không chỉ mờ) khi đang ở chế độ chỉ xem và
          hideToolbarWhenDisabled=true, tránh thanh công cụ thừa trên bản in.
          Chia 2 dòng giống Word: dòng 1 = nhóm "Font", dòng 2 = nhóm "Paragraph". */}
      {!(hideToolbarWhenDisabled && disabled) && (
      <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-1.5">
        {/* ─── Dòng 1: FONT ─── */}
        <div className="flex flex-wrap items-center gap-1 pb-1.5 mb-1.5 border-b border-slate-100">
          {/* Font chữ */}
          <div className="relative">
            <button type="button" disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); setShowFontFamilyPicker(!showFontFamilyPicker); }}
              className="px-2 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer text-[11px] font-medium w-32"
              title="Phông chữ (Font)">
              <span className="truncate flex-1 text-left">Phông chữ</span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>
            {showFontFamilyPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-40 max-h-52 overflow-y-auto">
                {FONT_FAMILIES.map((f) => (
                  <button key={f} type="button"
                    onMouseDown={(e) => { e.preventDefault(); executeCommand('fontName', f); setShowFontFamilyPicker(false); }}
                    className="w-full text-[11px] py-1.5 px-2 rounded hover:bg-slate-50 text-slate-700 cursor-pointer text-left"
                    style={{ fontFamily: f }}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cỡ chữ */}
          <div className="relative">
            <button type="button" disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); setShowFontSizePicker(!showFontSizePicker); }}
              className="px-2 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer text-[11px] font-medium w-14"
              title="Cỡ chữ (Font Size)">
              <span className="flex-1 text-left">Cỡ</span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>
            {showFontSizePicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-16 max-h-52 overflow-y-auto">
                {FONT_SIZES.map((s) => (
                  <button key={s} type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyFontSize(s); setShowFontSizePicker(false); }}
                    className="w-full text-[11px] py-1 px-2 rounded hover:bg-slate-50 text-slate-700 cursor-pointer text-left">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tăng / Giảm cỡ chữ */}
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); stepFontSize(2); }}
            className={btnClass + " font-black text-[13px]"} title="Tăng cỡ chữ (Grow Font)">A<span className="text-[9px] align-top">+</span></button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); stepFontSize(-2); }}
            className={btnClass + " font-black text-[11px]"} title="Giảm cỡ chữ (Shrink Font)">A<span className="text-[8px] align-top">−</span></button>

          {/* Đổi chữ hoa/thường */}
          <div className="relative">
            <button type="button" disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); setShowCasePicker(!showCasePicker); }}
              className={btnClass + " flex items-center gap-0.5"} title="Đổi chữ Hoa/thường (Change Case)">
              <CaseSensitive className="w-4 h-4" /><ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showCasePicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-44">
                {CASE_OPTIONS.map((c) => (
                  <button key={c.mode} type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyTextCase(c.mode); setShowCasePicker(false); }}
                    className="w-full text-[11px] py-1.5 px-2 rounded hover:bg-slate-50 text-slate-700 cursor-pointer text-left">
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Xoá định dạng */}
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('removeFormat'); }}
            className={btnClass} title="Xoá định dạng (Clear Formatting)">
            <Eraser className="w-4 h-4" />
          </button>

          <Divider />

          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('bold'); }}
            className={btnClass} title="In đậm (Bold)">
            <Bold className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('italic'); }}
            className={btnClass} title="In nghiêng (Italic)">
            <Italic className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('underline'); }}
            className={btnClass} title="Gạch chân (Underline)">
            <Underline className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('strikeThrough'); }}
            className={btnClass} title="Gạch ngang (Strikethrough)">
            <Strikethrough className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('subscript'); }}
            className={btnClass} title="Chỉ số dưới (Subscript)">
            <Subscript className="w-4 h-4" />
          </button>
          <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('superscript'); }}
            className={btnClass} title="Chỉ số trên (Superscript)">
            <Superscript className="w-4 h-4" />
          </button>

          <Divider />

          {/* Tô sáng chữ (Highlight) */}
          <div className="relative">
            <button type="button" disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); setShowHighlightPicker(!showHighlightPicker); }}
              className={btnClass + " flex items-center gap-1"} title="Tô sáng văn bản (Text Highlight Color)">
              <Highlighter className="w-4 h-4" />
              <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: customHighlight }}></span>
            </button>
            {showHighlightPicker && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50 grid grid-cols-2 gap-1 w-40">
                {HIGHLIGHT_COLORS.map((col) => (
                  <button key={col.hex} type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCustomHighlight(col.hex);
                      executeCommand('hiliteColor', col.hex === 'transparent' ? 'inherit' : col.hex);
                      setShowHighlightPicker(false);
                    }}
                    className="w-full text-[10px] py-1 px-1.5 rounded hover:bg-slate-50 flex items-center gap-1 font-medium text-slate-700 cursor-pointer text-left"
                    style={{ borderLeft: `3px solid ${col.hex === 'transparent' ? '#cbd5e1' : col.hex}` }}>
                    {col.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Màu chữ (Font Color) */}
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
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
        </div>

        {/* ─── Dòng 2: PARAGRAPH ─── */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex flex-wrap items-center gap-1">
            {/* Danh sách + thụt lề */}
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('insertUnorderedList'); }}
              className={btnClass} title="Danh sách không thứ tự (Bullets)">
              <List className="w-4 h-4" />
            </button>
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('insertOrderedList'); }}
              className={btnClass} title="Danh sách có thứ tự (Numbering)">
              <ListOrdered className="w-4 h-4" />
            </button>

            {/* Danh sách nhiều cấp */}
            <div className="relative">
              <button type="button" disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); setShowMultilevelPicker(!showMultilevelPicker); }}
                className={btnClass} title="Danh sách nhiều cấp (Multilevel List)">
                <ListTree className="w-4 h-4" />
              </button>
              {showMultilevelPicker && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-32">
                  {MULTILEVEL_STYLES.map((opt) => (
                    <button key={opt.label} type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyMultilevelStyle(opt); setShowMultilevelPicker(false); }}
                      className="w-full text-[11px] py-1.5 px-2 rounded hover:bg-slate-50 text-slate-700 cursor-pointer text-left">
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('outdent'); }}
              className={btnClass} title="Giảm thụt lề (Decrease Indent)">
              <Outdent className="w-4 h-4" />
            </button>
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('indent'); }}
              className={btnClass} title="Tăng thụt lề (Increase Indent)">
              <Indent className="w-4 h-4" />
            </button>

            {/* Sắp xếp A-Z */}
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); sortListAscending(); }}
              className={btnClass} title="Sắp xếp A→Z (Sort) — áp dụng cho danh sách chứa con trỏ">
              <ArrowDownAZ className="w-4 h-4" />
            </button>

            {/* Hiện/ẩn dấu định dạng đoạn văn (¶) */}
            <button type="button" disabled={disabled}
              onMouseDown={(e) => { e.preventDefault(); setFormattingMarksVisible(!formattingMarksVisible); }}
              className={`${btnClass} ${formattingMarksVisible ? selectedTheme.activeBtn : ''}`}
              title="Hiện/Ẩn dấu đoạn văn (¶)">
              <Pilcrow className="w-4 h-4" />
            </button>

            <Divider />

            {/* Căn chỉnh đoạn văn — giống Word: trái/giữa/phải/đều 2 bên */}
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyLeft'); }}
              className={btnClass} title="Căn trái">
              <AlignLeft className="w-4 h-4" />
            </button>
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyCenter'); }}
              className={btnClass} title="Căn giữa">
              <AlignCenter className="w-4 h-4" />
            </button>
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyRight'); }}
              className={btnClass} title="Căn phải">
              <AlignRight className="w-4 h-4" />
            </button>
            <button type="button" disabled={disabled} onMouseDown={(e) => { e.preventDefault(); executeCommand('justifyFull'); }}
              className={btnClass} title="Căn đều 2 bên">
              <AlignJustify className="w-4 h-4" />
            </button>

            {/* Giãn dòng */}
            <div className="relative">
              <button
                type="button"
                disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); setShowLineHeightPicker(!showLineHeightPicker); }}
                className={btnClass}
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

            {/* Tô nền đoạn văn (Shading) */}
            <div className="relative">
              <button type="button" disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); setShowShadingPicker(!showShadingPicker); }}
                className={btnClass} title="Tô nền đoạn văn (Shading)">
                <PaintBucket className="w-4 h-4" />
              </button>
              {showShadingPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-36">
                  {SHADING_COLORS.map((col) => (
                    <button key={col.hex} type="button"
                      onMouseDown={(e) => { e.preventDefault(); applyShading(col.hex); setShowShadingPicker(false); }}
                      className="w-full text-[10px] py-1.5 px-1.5 rounded hover:bg-slate-50 flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer text-left"
                      style={{ borderLeft: `3px solid ${col.hex === 'transparent' ? '#cbd5e1' : col.hex}` }}>
                      {col.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Viền khung (Borders) */}
            <div className="relative">
              <button type="button" disabled={disabled}
                onMouseDown={(e) => { e.preventDefault(); setShowBorderPicker(!showBorderPicker); }}
                className={btnClass} title="Viền khung (Borders)">
                <Square className="w-4 h-4" />
              </button>
              {showBorderPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 w-28">
                  <button type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyBorder(true); setShowBorderPicker(false); }}
                    className="w-full text-[11px] py-1.5 px-2 rounded hover:bg-slate-50 text-slate-700 cursor-pointer text-left">
                    Viền khung
                  </button>
                  <button type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyBorder(false); setShowBorderPicker(false); }}
                    className="w-full text-[11px] py-1.5 px-2 rounded hover:bg-slate-50 text-slate-700 cursor-pointer text-left">
                    Không viền
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-slate-400 italic pr-1 whitespace-nowrap">
            Bôi đen chữ để áp dụng định dạng
          </div>
        </div>
      </div>
      )}

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        className={`w-full p-3 overflow-y-auto text-xs text-slate-800 outline-none leading-relaxed text-left font-sans prose prose-sm focus:prose-indigo ${formattingMarksVisible ? 'rte-formatting-marks' : ''} ${editorHeightClassName || 'min-h-[140px] max-h-[280px]'}`}
        style={{ direction: 'ltr' }}
      />
      {/* Dấu ¶ cuối mỗi đoạn khi bật "Hiện dấu định dạng" — bản đơn giản hoá của
          Word (Word còn hiện dấu chấm giữa mỗi khoảng trắng; bỏ qua phần đó vì
          phải bọc từng khoảng trắng trong 1 span riêng, can thiệp sâu vào nội
          dung người dùng đang gõ). */}
      {formattingMarksVisible && (
        <style>{`
          .rte-formatting-marks p::after,
          .rte-formatting-marks div::after,
          .rte-formatting-marks li::after {
            content: '¶';
            color: #94a3b8;
            margin-left: 2px;
            font-weight: bold;
          }
        `}</style>
      )}
    </div>
  );
}
