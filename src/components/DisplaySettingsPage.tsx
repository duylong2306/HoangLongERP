import React, { useState, useEffect } from 'react';
import { Save, Palette, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { dbService } from '../lib/dbService';

// Định nghĩa interface cho DisplaySettingsConfig
interface DisplaySettingsConfig {
  primaryAccent: string;
  logoText: string;
  brandName: string;
  brandSlogan: string;
  dashboardTitle: string;
  motivationQuote: string;
  fontFamily: string;
}

// Giá trị mặc định cho DisplaySettings
const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsConfig = {
  primaryAccent: 'emerald',
  logoText: 'HL',
  brandName: 'Hoàng Long',
  brandSlogan: 'Lâm Đồng ERP',
  dashboardTitle: 'Hệ Thống Chỉ Số Doanh Nghiệp',
  motivationQuote: '"May mắn đứng về phía người dám đương đầu."',
  fontFamily: 'Inter',
};

// Props cho DisplaySettingsPage
interface DisplaySettingsPageProps {
  isAdmin: boolean;
}

export default function DisplaySettingsPage({ isAdmin }: DisplaySettingsPageProps) {
  const [displaySettings, setDisplaySettings] = useState<DisplaySettingsConfig>(() => {
    const saved = localStorage.getItem('hl_display_settings');
    return saved ? JSON.parse(saved) : DEFAULT_DISPLAY_SETTINGS;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local states for text inputs
  const [editLogoText, setEditLogoText] = useState(displaySettings.logoText);
  const [editBrandName, setEditBrandName] = useState(displaySettings.brandName);
  const [editBrandSlogan, setEditBrandSlogan] = useState(displaySettings.brandSlogan);
  const [editDashboardTitle, setEditDashboardTitle] = useState(displaySettings.dashboardTitle);
  const [editMotivationQuote, setEditMotivationQuote] = useState(displaySettings.motivationQuote);
  const [editFontFamily, setEditFontFamily] = useState(displaySettings.fontFamily);


  // Update local states when displaySettings changes
  useEffect(() => {
    setEditLogoText(displaySettings.logoText);
    setEditBrandName(displaySettings.brandName);
    setEditBrandSlogan(displaySettings.brandSlogan);
    setEditDashboardTitle(displaySettings.dashboardTitle);
    setEditMotivationQuote(displaySettings.motivationQuote);
    setEditFontFamily(displaySettings.fontFamily);
  }, [displaySettings]);

  // Load display settings from Supabase on mount
  useEffect(() => {
    dbService.displaySettings.get().then((settings) => {
      if (settings) {
        setDisplaySettings(prev => ({ ...prev, ...settings }));
        localStorage.setItem('hl_display_settings', JSON.stringify(settings));
      }
    }).catch(e => console.error('Lỗi tải cài đặt hiển thị từ Supabase:', e));
  }, []);

  // Sync display settings to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('hl_display_settings', JSON.stringify(displaySettings));
  }, [displaySettings]);

  const handleSave = async () => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Bạn không có quyền thay đổi cài đặt hiển thị!' });
      return;
    }

    setIsLoading(true);
    const updatedSettings = {
      ...displaySettings,
      logoText: editLogoText,
      brandName: editBrandName,
      brandSlogan: editBrandSlogan,
      dashboardTitle: editDashboardTitle,
      motivationQuote: editMotivationQuote,
      fontFamily: editFontFamily,
    };

    try {
      await dbService.displaySettings.save(updatedSettings);
      setDisplaySettings(updatedSettings);
      setMessage({ type: 'success', text: 'Đã lưu cài đặt hiển thị thành công!' });
      window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
    } catch (error) {
      console.error('Lỗi khi lưu cài đặt hiển thị:', error);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi lưu cài đặt hiển thị. Vui lòng thử lại!' });
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = message ? (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all ${
      message.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
    } flex items-center gap-2`}>
      {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <span>{message.text}</span>
    </div>
  ) : null;

  // Helper cho Màu chủ đạo hiển thị động
  const accentTextClass =
    displaySettings.primaryAccent === 'emerald' ? 'text-emerald-400' :
    displaySettings.primaryAccent === 'sky' ? 'text-sky-400' :
    displaySettings.primaryAccent === 'indigo' ? 'text-indigo-400' :
    displaySettings.primaryAccent === 'amber' ? 'text-amber-400' :
    displaySettings.primaryAccent === 'rose' ? 'text-rose-400' : 'text-violet-400';

  return (
    <>
      {showMessage}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-fuchsia-500" />
          <h2 className="text-white font-bold text-lg">Cấu hình Giao Diện, Sắc Màu Chủ Đạo & Phông Chữ Hệ Thống</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
          {/* CHỌN TONE MÀU & FONT */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">

            {/* 🎨 CHỌN MÀU SẮC CHỦ ĐẠO */}
            <div className="pt-3.5 border-t border-slate-900">
              <label className="block text-[11px] text-slate-300 font-black uppercase font-mono mb-2">
                🎨 TÔNG MÀU CHỦ ĐẠO HỆ THỐNG
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'emerald', label: 'Emerald Green', desc: 'Lâm Đồng', style: 'bg-emerald-500' },
                  { key: 'sky', label: 'Sky Blue', desc: 'Mây Đà Lạt', style: 'bg-sky-500' },
                  { key: 'indigo', label: 'Marine Blue', desc: 'Xanh thẳm', style: 'bg-indigo-500' },
                  { key: 'amber', label: 'Mộc Amber', desc: 'Vân gỗ sồi', style: 'bg-amber-500' },
                  { key: 'rose', label: 'Rose Gold', desc: 'Ấm áp', style: 'bg-rose-500' },
                  { key: 'violet', label: 'Amethyst', desc: 'Thủy chung', style: 'bg-violet-500' }
                ].map((clProps) => (
                  <button
                    key={clProps.key}
                    type="button"
                    onClick={() => {
                      setDisplaySettings({
                        ...displaySettings,
                        primaryAccent: clProps.key
                      });
                    }}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer group flex flex-col items-center justify-center ${
                      displaySettings.primaryAccent === clProps.key
                        ? 'bg-slate-900 border-slate-500 text-white shadow font-bold scale-101'
                        : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 text-slate-400'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${clProps.style} mb-1.5 ring-2 ring-slate-950 block`}></span>
                    <span className="text-[9.5px] font-black tracking-wide block leading-tight">{clProps.label}</span>
                    <span className="text-[7.5px] text-slate-500 block">{clProps.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ✍️ CHỌN FONT CHỮ */}
            <div className="pt-3.5 border-t border-slate-900">
              <label className="block text-[11px] text-slate-300 font-black uppercase font-mono mb-2">
                ✍️ CHỌN PHÔNG CHỮ ĐỒNG NHẤT (GOOGLE FONTS VIỆT)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'Inter', label: '1. Inter', desc: 'Sắc nét, đa năng' },
                  { key: 'Roboto', label: '2. Roboto', desc: 'Hiện đại, dễ nhìn' },
                  { key: 'Be Vietnam Pro', label: '3. Be Vietnam Pro', desc: 'Thiết kế cho tiếng Việt' },
                  { key: 'Nunito', label: '4. Nunito', desc: 'Tròn trịa, thanh tao' },
                  { key: 'Lora', label: '5. Lora (Serif)', desc: 'Có chân, chữ sách' },
                  { key: 'Fira Sans', label: '6. Fira Sans', desc: 'Rõ ràng, chuyên nghiệp' }
                ].map((fontOpt) => (
                  <button
                    key={fontOpt.key}
                    type="button"
                    onClick={() => {
                      setDisplaySettings({
                        ...displaySettings,
                        fontFamily: fontOpt.key
                      });
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      (displaySettings.fontFamily || 'Inter') === fontOpt.key
                        ? 'bg-slate-900 border-slate-500 text-white shadow font-bold scale-101'
                        : 'bg-slate-950/60 border-slate-850 hover:bg-slate-900 text-slate-400'
                    }`}
                    style={{ fontFamily: fontOpt.key }}
                  >
                    <span className="text-[10px] font-bold block">{fontOpt.label}</span>
                    <span className="text-[7.5px] text-slate-500 block leading-tight">{fontOpt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* chỉnh sửa text thương hiệu */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-4">
            <label className="block text-[11px] text-slate-300 font-black uppercase font-mono">
              📝 Thay Đổi Danh Xưng & Khẩu Hiệu Bảng Biển
            </label>

            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Viết Tắt Logo (2 Ký Tự)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={editLogoText}
                  onChange={(e) => setEditLogoText(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 w-full font-mono font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Tên Thương Hiệu Chính (Sidebar)</label>
                <input
                  type="text"
                  value={editBrandName}
                  onChange={(e) => setEditBrandName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Slogan Thương Hiệu Kèm Theo</label>
                <input
                  type="text"
                  value={editBrandSlogan}
                  onChange={(e) => setEditBrandSlogan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-white rounded p-1.5 px-2.5 outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Khẩu Hiện Động Có Sức Truyền Cảm Hứng (Chân Sidebar)</label>
                <textarea
                  value={editMotivationQuote}
                  onChange={(e) => setEditMotivationQuote(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-805 text-xs text-slate-300 rounded p-1.5 px-2.5 outline-none resize-none font-semibold leading-normal"
                />
              </div>

              <div>
                <label className="block text-[9px] text-slate-400 font-bold mb-1 uppercase">Tiêu Đề Trang Tổng Quan (Dashboard Title Banner)</label>
                <input
                  type="text"
                  value={editDashboardTitle}
                  onChange={(e) => setEditDashboardTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-805 text-xs text-slate-300 rounded p-1.5 px-2.5 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isLoading || !isAdmin}
            className="px-6 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu cài đặt hiển thị
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}