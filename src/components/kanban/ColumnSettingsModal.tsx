import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { KanbanColumn } from '../../lib/kanbanLogic';

interface ColumnSettingsModalProps {
  column: KanbanColumn;
  onSave: (edits: { name: string; color: string; ruleType: string; ruleParam: string }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const COLUMN_COLORS = [
  { id: 'bg-emerald-500', label: 'Xanh lá' },
  { id: 'bg-sky-500', label: 'Xanh dương' },
  { id: 'bg-violet-500', label: 'Tím nhạt' },
  { id: 'bg-pink-500', label: 'Hồng sen' },
  { id: 'bg-amber-500', label: 'Vàng cam' },
  { id: 'bg-rose-500', label: 'Đỏ tươi' },
  { id: 'bg-teal-500', label: 'Xanh lục' },
  { id: 'bg-slate-500', label: 'Xám khói' }
];

const ColumnSettingsModal: React.FC<ColumnSettingsModalProps> = ({
  column,
  onSave,
  onDelete,
  onClose,
}) => {
  const [editColName, setEditColName] = useState(column.name);
  const [editColColor, setEditColColor] = useState(column.color);
  const [editColRuleType, setEditColRuleType] = useState<string>(column.automation?.type || 'none');
  const [editColRuleParam, setEditColRuleParam] = useState<string>(String(column.automation?.param || ''));

  // Sync internal state when a different column is opened
  useEffect(() => {
    setEditColName(column.name);
    setEditColColor(column.color);
    setEditColRuleType(column.automation?.type || 'none');
    setEditColRuleParam(String(column.automation?.param || ''));
  }, [column.id]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[60] p-4 font-sans text-slate-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs text-left">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h3 className="font-extrabold text-white text-sm">Cấu hình bước phân đoạn Kanban</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Tên bước phân đoạn</label>
            <input
              type="text"
              value={editColName}
              onChange={(e) => setEditColName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none font-bold uppercase"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Màu sắc trực quan</label>
            <div className="grid grid-cols-4 gap-2">
              {COLUMN_COLORS.map((colorOpt) => (
                <button
                  key={colorOpt.id}
                  type="button"
                  onClick={() => setEditColColor(colorOpt.id)}
                  className={`p-1.5 rounded text-[10px] font-bold text-white transition-all cursor-pointer ${colorOpt.id} ${
                    editColColor === colorOpt.id ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 border border-transparent' : 'border border-slate-800 hover:opacity-90'
                  }`}
                >
                  {colorOpt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-850 pt-3">
            <label className="block text-slate-450 font-bold mb-1">Cấu hình tự động chuyển bước (Trực hệ)</label>
            <select
              value={editColRuleType}
              onChange={(e) => {
                setEditColRuleType(e.target.value);
                if (e.target.value === 'auto_progress') setEditColRuleParam('50');
                else if (e.target.value === 'auto_comment') setEditColRuleParam('');
                else if (e.target.value === 'auto_approval') setEditColRuleParam('director');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none cursor-pointer mb-2.5"
            >
              <option value="none">Không kích hoạt hoạt động tự trị</option>
              <option value="auto_progress">Cập nhật % tiến độ tự động</option>
              <option value="auto_approval">Cưỡng chế phân cấp duyệt</option>
              <option value="auto_comment">Tự động phát sinh ghi chú và nhật trình</option>
            </select>

            <div className="bg-slate-950/50 border border-slate-850 rounded-lg p-2.5">
              {editColRuleType === 'none' && (
                <p className="text-slate-500 italic">Mốc thi công phân đoạn này hoàn toàn thủ công.</p>
              )}

              {editColRuleType === 'auto_progress' && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Cưỡng chế % tiến độ thi công đạt được</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editColRuleParam}
                    onChange={(e) => setEditColRuleParam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none font-mono"
                  />
                </div>
              )}

              {editColRuleType === 'auto_approval' && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Phê duyệt trực hệ bởi</label>
                  <select
                    value={editColRuleParam}
                    onChange={(e) => setEditColRuleParam(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none cursor-pointer"
                  >
                    <option value="director">Cấp Giám Đốc (Trương Hữu Long)</option>
                    <option value="accountant">Kế Toán trưởng (Lê Thị Mai)</option>
                    <option value="pm">PM Quản lý nhánh</option>
                  </select>
                </div>
              )}

              {editColRuleType === 'auto_comment' && (
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Nội dung ghi chú tự động phát sinh</label>
                  <input
                    type="text"
                    value={editColRuleParam}
                    onChange={(e) => setEditColRuleParam(e.target.value)}
                    placeholder="vd: Hồ sơ kết cấu thô được chuyển bước tự động"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-white outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            onClick={() => onDelete(column.id)}
            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1.8 rounded font-black cursor-pointer flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa Cột
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-850 hover:bg-slate-80 border border-slate-800 px-3 py-1.8 rounded font-bold cursor-pointer text-slate-400"
            >
              Bỏ qua
            </button>
            <button
              type="button"
              onClick={() => onSave({ name: editColName, color: editColColor, ruleType: editColRuleType, ruleParam: editColRuleParam })}
              className="bg-emerald-600 hover:bg-emerald-550 text-white px-4 py-1.8 rounded font-black cursor-pointer"
            >
              Lưu thiết lập
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnSettingsModal;
