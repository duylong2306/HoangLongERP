import React, { useState, useEffect } from 'react';
import { Save, Palette, Loader2, AlertCircle, CheckCircle, Eye, Type, Sparkles } from 'lucide-react';
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
  /** @deprecated Không còn sử dụng — mọi user đều được phép chỉnh sửa giao diện cá nhân */
  isAdmin?: boolean;
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

  const accentBorderClass =
    displaySettings.primaryAccent === 'emerald' ? 'border-emerald-500' :
    displaySettings.primaryAccent === 'sky' ? 'border-sky-500' :
    displaySettings.primaryAccent === 'indigo' ? 'border-indigo-500' :
    displaySettings.primaryAccent === 'amber' ? 'border-amber-500' :
    displaySettings.primaryAccent === 'rose' ? 'border-rose-500' : 'border-violet-500';

  const accentBgClass =
    displaySettings.primaryAccent === 'emerald' ? 'bg-emerald-500' :
    displaySettings.primaryAccent === 'sky' ? 'bg-sky-500' :
    displaySettings.primaryAccent === 'indigo' ? 'bg-indigo-500' :
    displaySettings.primaryAccent === 'amber' ? 'bg-amber-500' :
    displaySettings.primaryAccent === 'rose' ? 'bg-rose-500' : 'bg-violet-500';

  const accentBgLightClass =
    displaySettings.primaryAccent === 'emerald' ? 'bg-emerald-500/10' :
    displaySettings.primaryAccent === 'sky' ? 'bg-sky-500/10' :
    displaySettings.primaryAccent === 'indigo' ? 'bg-indigo-500/10' :
    displaySettings.primaryAccent === 'amber' ? 'bg-amber-500/10' :
    displaySettings.primaryAccent === 'rose' ? 'bg-rose-500/10' : 'bg-violet-500/10';

  return (
    <>
      {showMessage}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-fuchsia-500/15 rounded-xl border border-fuchsia-500/20">
            <Palette className="w-5 h-5 text-fuchsia-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-[15px]">Cấu hình Giao Diện Cá Nhân</h2>
            <p className="text-[10.5px] text-slate-500 font-medium">Tùy chỉnh tông màu và phông chữ theo sở thích của riêng bạn</p>
          </div>
        </div>

        {/* ── Main Layout: Settings + Live Preview ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ═══ LEFT: Cài đặt (3 cols) ═══ */}
          <div className="lg:col-span-3 space-y-5">

            {/* ── 🎨 CHỌN MÀU SẮC ── */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <label className="text-[11px] text-slate-200 font-black uppercase tracking-wider">Tông Màu Chủ Đạo</label>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { key: 'emerald', label: 'Emerald', desc: 'Lâm Đồng', color: '#10b981' },
                  { key: 'sky', label: 'Sky', desc: 'Mây Đà Lạt', color: '#0ea5e9' },
                  { key: 'indigo', label: 'Marine', desc: 'Xanh thẳm', color: '#6366f1' },
                  { key: 'amber', label: 'Amber', desc: 'Gỗ sồi', color: '#f59e0b' },
                  { key: 'rose', label: 'Rose', desc: 'Ấm áp', color: '#f43f5e' },
                  { key: 'violet', label: 'Amethyst', desc: 'Thủy chung', color: '#8b5cf6' },
                ].map((c) => {
                  const selected = displaySettings.primaryAccent === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setDisplaySettings({ ...displaySettings, primaryAccent: c.key })}
                      className={`relative p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col items-center gap-1.5 ${
                        selected
                          ? 'border-white/20 bg-white/5 shadow-lg scale-[1.03]'
                          : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      {selected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-white rounded-full flex items-center justify-center shadow text-[9px]">✓</span>
                      )}
                      <span
                        className="w-5 h-5 rounded-full ring-2 ring-white/10 shadow-inner"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-[10px] font-bold text-white leading-tight">{c.label}</span>
                      <span className="text-[8px] text-slate-500 leading-tight">{c.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── ✍️ CHỌN PHÔNG CHỮ ── */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Type className="w-4 h-4 text-sky-400" />
                <label className="text-[11px] text-slate-200 font-black uppercase tracking-wider">Phông Chữ Hệ Thống</label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { key: 'Inter', label: 'Inter', desc: 'Sắc nét, đa năng', tag: 'Mặc định' },
                  { key: 'Roboto', label: 'Roboto', desc: 'Hiện đại, dễ đọc', tag: '' },
                  { key: 'Be Vietnam Pro', label: 'Be Vietnam Pro', desc: 'Thiết kế cho tiếng Việt', tag: 'Đề xuất' },
                  { key: 'Nunito', label: 'Nunito', desc: 'Tròn trịa, thanh tao', tag: '' },
                  { key: 'Lora', label: 'Lora', desc: 'Serif — có chân, chữ sách', tag: '' },
                  { key: 'Fira Sans', label: 'Fira Sans', desc: 'Rõ ràng, chuyên nghiệp', tag: '' },
                ].map((f) => {
                  const selected = (displaySettings.fontFamily || 'Inter') === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setDisplaySettings({ ...displaySettings, fontFamily: f.key })}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer ${
                        selected
                          ? 'border-white/20 bg-white/5 shadow-lg scale-[1.02]'
                          : 'border-slate-800/60 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                      style={{ fontFamily: f.key }}
                    >
                      {selected && (
                        <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-white rounded-full flex items-center justify-center shadow text-[9px] text-slate-900 font-bold">✓</span>
                      )}
                      {f.tag && (
                        <span className={`absolute top-1.5 right-2 text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${f.tag === 'Đề xuất' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700/60 text-slate-400'}`}>
                          {f.tag}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-white block">{f.label}</span>
                      <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">{f.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ═══ RIGHT: Live Preview (2 cols) ═══ */}
          <div className="lg:col-span-2">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/60 space-y-3 sticky top-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4 text-violet-400" />
                <label className="text-[11px] text-slate-200 font-black uppercase tracking-wider">Xem Trước Trực Tiếp</label>
              </div>

              {/* Mockup Sidebar */}
              <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-950" style={{ fontFamily: displaySettings.fontFamily || 'Inter' }}>
                {/* Sidebar header */}
                <div className={`p-3.5 ${accentBgLightClass} border-b border-slate-800/50 flex items-center gap-2.5`}>
                  <div className={`w-8 h-8 rounded-lg ${accentBgClass} flex items-center justify-center text-[10px] font-black text-white shadow`}>
                    {displaySettings.logoText || 'HL'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10.5px] font-bold text-white truncate">{displaySettings.brandName || 'Hoàng Long'}</div>
                    <div className={`text-[8px] ${accentTextClass} truncate`}>{displaySettings.brandSlogan || 'Lâm Đồng ERP'}</div>
                  </div>
                </div>

                {/* Sidebar items */}
                <div className="p-2 space-y-0.5">
                  {['📊 Dashboard', '📁 Dự Án', '👥 Nhân Sự', '💰 Kế Toán'].map((item, i) => (
                    <div key={i} className={`px-2.5 py-1.5 rounded-lg text-[9.5px] ${i === 0 ? `${accentBgLightClass} ${accentTextClass} font-bold` : 'text-slate-400'}`}>
                      {item}
                    </div>
                  ))}
                </div>

                {/* Motivational quote */}
                <div className="px-3 py-2.5 border-t border-slate-800/50">
                  <p className="text-[7.5px] text-slate-500 italic leading-relaxed line-clamp-2">
                    {displaySettings.motivationQuote || '"May mắn đứng về phía người dám đương đầu."'}
                  </p>
                </div>

                {/* Dashboard preview */}
                <div className="p-3 border-t border-slate-800/50 space-y-2">
                  <div className={`text-[10px] font-bold ${accentTextClass}`}>{displaySettings.dashboardTitle || 'Hệ Thống Chỉ Số Doanh Nghiệp'}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Dự án', val: '12', up: true },
                      { label: 'Nhân viên', val: '24', up: true },
                      { label: 'Doanh thu', val: '3.2B', up: false },
                      { label: 'KPI TB', val: '87%', up: true },
                    ].map((card, i) => (
                      <div key={i} className="bg-slate-900/80 border border-slate-800/40 rounded-lg p-2">
                        <div className="text-[7px] text-slate-500">{card.label}</div>
                        <div className="text-[11px] font-bold text-white">{card.val}</div>
                        <div className={`text-[7px] font-bold ${card.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {card.up ? '↑ +5.2%' : '↓ -1.3%'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Font info */}
              <div className="text-center pt-1">
                <span className="text-[8px] text-slate-600 font-mono">
                  Font: {displaySettings.fontFamily || 'Inter'} · Accent: {displaySettings.primaryAccent}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer: Save ── */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[9.5px] text-slate-600 font-medium">
            Thay đổi sẽ áp dụng ngay sau khi lưu
          </span>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className={`px-6 py-2.5 ${accentBgClass} hover:opacity-90 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg text-[12px]`}
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