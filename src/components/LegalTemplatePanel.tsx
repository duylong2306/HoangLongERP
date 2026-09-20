import React, { useEffect, useState } from 'react';
import RichTextEditor from './RichTextEditor';
import { dbService } from '../lib/dbService';
import { LEGAL_PLACEHOLDER_GROUPS } from '../lib/docPlaceholders';
import {
  LegalSector,
  getDefaultLegalTemplate,
  legalConfigKey,
  legalConfigDefaultKey,
} from '../lib/legalTemplates';

/**
 * Tab "Mẫu hồ sơ pháp lý" dùng chung cho Nội thất / Xây dựng / Cơ khí (trong tab "Mẫu hồ sơ").
 * Tự quản lý dữ liệu: mẫu đang dùng lưu ở quotation_configs khóa legal_<lĩnh vực>,
 * mẫu "mặc định do người dùng đặt" ở khóa legal_<lĩnh vực>_default — tách riêng khỏi
 * config báo giá của lĩnh vực nên không bị các nút "Lưu" của Estimator ghi đè.
 */

interface LegalTemplatePanelProps {
  sector: LegalSector;
  themeColor?: 'indigo' | 'emerald' | 'pink' | 'orange';
}

const SECTOR_LABEL: Record<LegalSector, string> = {
  furniture: 'Nội Thất',
  construction: 'Xây Dựng',
  mechanical: 'Cơ Khí',
};

export default function LegalTemplatePanel({ sector, themeColor = 'indigo' }: LegalTemplatePanelProps) {
  const builtIn = getDefaultLegalTemplate(sector);
  const [template, setTemplate] = useState<string>(builtIn);
  const [editable, setEditable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Tải mẫu đã lưu của lĩnh vực này
  useEffect(() => {
    let cancelled = false;
    setEditable(false);
    dbService.quotationConfigs.get(legalConfigKey(sector)).then(cfg => {
      if (!cancelled) setTemplate(cfg?.legalTemplate || builtIn);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sector]);

  // Chèn {{TOKEN}} tại vị trí con trỏ trong trình soạn thảo. Nút dùng onMouseDown +
  // preventDefault để bấm nút KHÔNG làm mất vùng chọn/con trỏ của trình soạn thảo
  // (RichTextEditor là contentEditable, dùng execCommand nên insertText chèn đúng chỗ).
  const insertToken = (token: string) => {
    if (!editable) return;
    document.execCommand('insertText', false, `{{${token}}}`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await dbService.quotationConfigs.save(legalConfigKey(sector), { legalTemplate: template });
      setEditable(false);
      showMessage('success', `Đã lưu mẫu Hồ sơ pháp lý ${SECTOR_LABEL[sector]} lên hệ thống.`);
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Lỗi khi lưu lên Supabase');
    } finally {
      setSaving(false);
    }
  };

  const handleSetAsDefault = async () => {
    setSaving(true);
    try {
      await dbService.quotationConfigs.save(legalConfigDefaultKey(sector), { legalTemplate: template });
      showMessage('success', 'Đã đặt mẫu hiện tại làm mẫu mặc định (dùng khi bấm "Khôi phục mặc định").');
    } catch (e) {
      showMessage('error', e instanceof Error ? e.message : 'Lỗi khi lưu mặc định');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (!window.confirm('Khôi phục mẫu Hồ sơ pháp lý về mẫu mặc định? Nội dung đang soạn (chưa lưu) sẽ mất.')) return;
    setSaving(true);
    try {
      const def = await dbService.quotationConfigs.get(legalConfigDefaultKey(sector));
      setTemplate(def?.legalTemplate || builtIn);
      showMessage('success', 'Đã khôi phục mẫu mặc định — bấm "Lưu" để áp dụng cho các hồ sơ mới.');
    } catch (e) {
      setTemplate(builtIn);
      showMessage('error', 'Không đọc được mẫu mặc định đã đặt, đã dùng mẫu gốc của hệ thống.');
    } finally {
      setSaving(false);
    }
  };

  const disabledBtn = 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-50';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="mb-2 border-b border-slate-200 pb-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h4 className="font-extrabold text-base text-rose-700 uppercase tracking-wider">
            ⚖️ Soạn thảo Mẫu Hồ Sơ Pháp Lý Dự Án {SECTOR_LABEL[sector]}
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Thiết kế bộ hồ sơ pháp lý (danh mục giấy tờ, cam kết...) cho dự án. Chèn tham số có sẵn bằng nút bên phải — khi lập hồ sơ, tham số được tự điền từ báo giá và thông tin công ty.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || !editable}
            onClick={handleSetAsDefault}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
              saving || !editable ? disabledBtn : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 cursor-pointer active:scale-95'
            }`}
          >
            ⭐ Đặt làm mặc định
          </button>
          <button
            type="button"
            disabled={saving || !editable}
            onClick={handleRestoreDefault}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
              saving || !editable ? disabledBtn : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 cursor-pointer active:scale-95'
            }`}
          >
            🔄 Khôi phục mặc định
          </button>
          <button
            type="button"
            onClick={() => setEditable(e => !e)}
            className={`px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg cursor-pointer transition-all shadow-sm active:scale-95 ${
              editable ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-indigo-600/15 text-indigo-700 hover:bg-indigo-600/25 border border-indigo-500/30'
            }`}
          >
            {editable ? '🔒 Khóa' : '✍️ Chỉnh sửa'}
          </button>
          <button
            type="button"
            disabled={saving || !editable}
            onClick={handleSave}
            className={`px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-all shadow-sm ${
              saving || !editable ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
            }`}
          >
            {saving ? 'Đang lưu...' : '💾 Lưu'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`mt-3 p-3 rounded-xl text-xs font-semibold border ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6 mt-4">
        <div className="col-span-12 lg:col-span-8">
          <RichTextEditor
            value={template}
            onChange={setTemplate}
            disabled={!editable}
            themeColor={themeColor}
            editorHeightClassName="min-h-[1123px] max-h-none prose max-w-none text-left"
          />
        </div>

        {/* Bảng tham số: bấm để chèn tại vị trí con trỏ */}
        <div className="col-span-12 lg:col-span-4 bg-slate-50 border border-slate-200 rounded-xl p-4 self-start">
          <h5 className="font-bold text-xs text-rose-700 uppercase tracking-wider mb-1">
            Chèn tham số (Placeholders)
          </h5>
          <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
            {editable
              ? 'Đặt con trỏ vào vị trí muốn chèn trong mẫu, rồi bấm vào tham số bên dưới.'
              : 'Bấm "Chỉnh sửa" để bật chèn tham số.'}
          </p>
          <div className="space-y-3">
            {LEGAL_PLACEHOLDER_GROUPS.map(group => (
              <div key={group.title}>
                <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">{group.title}</div>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(item => (
                    <button
                      key={item.token}
                      type="button"
                      disabled={!editable}
                      title={`{{${item.token}}}`}
                      // preventDefault ở onMouseDown để giữ nguyên con trỏ trong trình soạn thảo
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertToken(item.token)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        editable
                          ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 cursor-pointer active:scale-95'
                          : 'bg-white text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
