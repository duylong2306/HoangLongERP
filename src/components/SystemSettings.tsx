import { useState, useEffect } from 'react';
import { Save, Settings, Calendar, Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { SystemConfig } from '../types';
import { dbService } from '../lib/dbService';

interface SystemSettingsProps {
  currentConfig: SystemConfig;
  onConfigUpdate: (newConfig: Partial<SystemConfig>) => void;
  isAdmin: boolean;
}

export default function SystemSettings({ currentConfig, onConfigUpdate, isAdmin }: SystemSettingsProps) {
  const [config, setConfig] = useState<SystemConfig>(currentConfig);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Update local state when parent config changes
  useEffect(() => {
    setConfig(currentConfig);
  }, [currentConfig]);

  const handleChange = <K extends keyof SystemConfig>(field: K, value: SystemConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Bạn không có quyền thay đổi cài đặt hệ thống!' });
      return;
    }

    setIsLoading(true);
    try {
      await dbService.shiftConfig.save(config);
      onConfigUpdate(config);
      setMessage({ type: 'success', text: 'Đã lưu cài đặt hệ thống thành công!' });

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('hl_system_settings_updated'));
    } catch (error) {
      console.error('Lỗi khi lưu cài đặt:', error);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi lưu cài đặt. Vui lòng thử lại!' });
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

  return (
    <>
      {showMessage}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" />
          <h2 className="text-white font-bold text-lg">Cài đặt hệ thống chấm công</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Ca sáng */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Ca Sáng
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Giờ vào chuẩn</label>
                <input
                  type="time"
                  value={config.morningIn}
                  onChange={(e) => handleChange('morningIn', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Giờ ra chuẩn</label>
                <input
                  type="time"
                  value={config.morningOut}
                  onChange={(e) => handleChange('morningOut', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ca chiều */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <h3 className="text-sky-400 font-bold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Ca Chiều
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Giờ vào chuẩn</label>
                <input
                  type="time"
                  value={config.afternoonIn}
                  onChange={(e) => handleChange('afternoonIn', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Giờ ra chuẩn</label>
                <input
                  type="time"
                  value={config.afternoonOut}
                  onChange={(e) => handleChange('afternoonOut', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Ca tăng ca */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <h3 className="text-orange-400 font-bold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Tăng Ca
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Giờ vào chuẩn</label>
                <input
                  type="time"
                  value={config.overtimeIn}
                  onChange={(e) => handleChange('overtimeIn', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Giờ ra chuẩn</label>
                <input
                  type="time"
                  value={config.overtimeOut}
                  onChange={(e) => handleChange('overtimeOut', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Cài đặt khác */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <h3 className="text-violet-400 font-bold mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Cài đặt chung
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Cho phép muộn (phút)</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={config.allowedLateMinutes}
                  onChange={(e) => handleChange('allowedLateMinutes', parseInt(e.target.value) || 15)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Hệ số tăng ca</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="3"
                  value={config.otMultiplier}
                  onChange={(e) => handleChange('otMultiplier', parseFloat(e.target.value) || 1.5)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Bán kính GPS cho phép (mét)</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={config.gpsRadiusAllowed}
                  onChange={(e) => handleChange('gpsRadiusAllowed', parseInt(e.target.value) || 50)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Weekends */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <h3 className="text-rose-400 font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Ngày nghỉ tuần
            </h3>
            <div className="flex flex-wrap gap-2">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, idx) => (
                <label key={idx} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.weekendDays.includes(idx)}
                    onChange={(e) => {
                      const newDays = e.target.checked
                        ? [...config.weekendDays, idx]
                        : config.weekendDays.filter((d: number) => d !== idx);
                      handleChange('weekendDays', newDays);
                    }}
                    className="w-4 h-4 text-emerald-500 border-slate-600 rounded focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-300">{day}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Cấu hình chấm công tự động */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <h3 className="text-pink-400 font-bold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> TỰ ĐỘNG CHẤM CÔNG
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Số ngày tự động chốt công</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={config.autoAttendanceDays}
                  onChange={(e) => handleChange('autoAttendanceDays', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ngày bắt đầu tự động chấm công</label>
                <input
                  type="date"
                  value={config.autoAttendanceStartDate ? (config.autoAttendanceStartDate instanceof Date ? config.autoAttendanceStartDate.toISOString().split('T')[0] : config.autoAttendanceStartDate) : ''}
                  onChange={(e) => handleChange('autoAttendanceStartDate', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isLoading || !isAdmin}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Lưu cài đặt
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}