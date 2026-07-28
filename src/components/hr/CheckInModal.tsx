import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, MapPin, X, Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { dbService } from '../../lib/dbService';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  empId: string;
  empName: string;
  onCheckIn: (data: CheckInData) => void;
}

export interface CheckInData {
  empId: string;
  empName: string;
  date: string;
  time: string;
  shift: 'morning' | 'afternoon' | 'overtime';
  photo: string | null;
  coords: string | null;
  locationName: string | null;
  method: string;
  // Server timestamp từ RPC (chống gian lận giờ client)
  _serverTime?: { date: string; time: string; datetime: string; epoch_ms: number } | null;
}

type GeoStatus = 'idle' | 'loading' | 'success' | 'error';
type CameraStatus = 'idle' | 'loading' | 'success' | 'error';

export default function CheckInModal({
  isOpen,
  onClose,
  empId,
  empName,
  onCheckIn,
}: CheckInModalProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoError, setGeoError] = useState<string>('');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState<'morning' | 'afternoon' | 'overtime'>('morning');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update current time every second
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Auto-detect shift based on current time
  useEffect(() => {
    if (!isOpen) return;
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) {
      setSelectedShift('morning');
    } else if (hour >= 12 && hour < 18) {
      setSelectedShift('afternoon');
    } else {
      setSelectedShift('overtime');
    }
  }, [currentTime, isOpen]);

  // Get GPS location
  const requestGeoLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoError('Trình duyệt không hỗ trợ GPS');
      return;
    }
    setGeoStatus('loading');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setLocationName(`Vĩ độ: ${latitude.toFixed(4)}, Kinh độ: ${longitude.toFixed(4)}`);
        setGeoStatus('success');
      },
      (error) => {
        setGeoStatus('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError('Bạn cần cho phép truy cập vị trí');
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError('Không thể xác định vị trí');
            break;
          case error.TIMEOUT:
            setGeoError('Hết thời gian xác định vị trí');
            break;
          default:
            setGeoError('Lỗi xác định vị trí');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Auto-request location when modal opens
  useEffect(() => {
    if (isOpen) {
      requestGeoLocation();
      setPhoto(null);
      setCameraStatus('idle');
    }
  }, [isOpen, requestGeoLocation]);

  // Handle photo capture from file input (camera on mobile)
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraStatus('loading');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 800px width for storage efficiency
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPhoto(canvas.toDataURL('image/jpeg', 0.8));
          setCameraStatus('success');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getShiftLabel = (shift: string) => {
    switch (shift) {
      case 'morning': return 'Ca Sáng';
      case 'afternoon': return 'Ca Chiều';
      case 'overtime': return 'Tăng Ca';
      default: return shift;
    }
  };

  const getShiftTimeRange = (shift: string) => {
    switch (shift) {
      case 'morning': return '06:30 → 11:30';
      case 'afternoon': return '13:00 → 17:30';
      case 'overtime': return '17:30 → 22:00';
      default: return '';
    }
  };

  const handleCheckIn = async () => {
    // Ưu tiên lấy server time từ dbService (chống gian lận giờ client)
    const now = new Date();
    let serverTime: { date: string; time: string; datetime: string; epoch_ms: number } | null = null;
    try {
      serverTime = await dbService.fetchServerTimestamp();
    } catch (err) {
      console.warn('[CheckInModal] Không thể lấy server time:', err);
    }
    const date = serverTime ? serverTime.date : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = serverTime ? serverTime.time : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    onCheckIn({
      empId,
      empName,
      date,
      time,
      shift: selectedShift,
      photo,
      coords,
      locationName,
      method: coords ? `GPS (${locationName || 'Đã xác định'})` : 'Thủ công (Không có GPS)',
      _serverTime: serverTime,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-b border-slate-700 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Chấm công - {empName}</h3>
              <p className="text-[11px] text-slate-400 font-mono">{formatTime(currentTime)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Shift Selection */}
          <div>
            <label className="text-[11px] text-slate-400 font-bold mb-2 block">Chọn ca làm việc:</label>
            <div className="grid grid-cols-3 gap-2">
              {(['morning', 'afternoon', 'overtime'] as const).map((shift) => (
                <button
                  key={shift}
                  onClick={() => setSelectedShift(shift)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    selectedShift === shift
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div>{getShiftLabel(shift)}</div>
                  <div className="text-[9px] font-mono mt-0.5 opacity-70">{getShiftTimeRange(shift)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* GPS Location */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] text-slate-300 font-bold">Vị trí GPS</span>
              </div>
              {geoStatus === 'loading' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              {geoStatus === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {geoStatus === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            </div>
            {geoStatus === 'success' && coords && (
              <div className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
                📍 {coords}
                {locationName && <div className="text-[9px] text-slate-400 mt-1">{locationName}</div>}
              </div>
            )}
            {geoStatus === 'error' && (
              <div className="text-[10px] text-rose-400 bg-rose-500/10 rounded-lg p-2 border border-rose-500/20">
                ⚠️ {geoError}
              </div>
            )}
            {geoStatus === 'idle' && (
              <div className="text-[10px] text-slate-500">Chưa xác định vị trí</div>
            )}
            <button
              onClick={requestGeoLocation}
              disabled={geoStatus === 'loading'}
              className="mt-2 text-[10px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer disabled:opacity-50"
            >
              🔄 Làm mới vị trí
            </button>
          </div>

          {/* Camera / Photo */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span className="text-[11px] text-slate-300 font-bold">Ảnh check-in</span>
              </div>
              {cameraStatus === 'loading' && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
              {cameraStatus === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            </div>

            {photo ? (
              <div className="relative">
                <img
                  src={photo}
                  alt="Ảnh check-in"
                  className="w-full h-40 object-cover rounded-lg border border-slate-600"
                />
                <button
                  onClick={() => { setPhoto(null); setCameraStatus('idle'); }}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-slate-600 hover:border-amber-500 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
              >
                <Camera className="w-8 h-8" />
                <span className="text-[11px] font-bold">Chụp ảnh check-in</span>
                <span className="text-[9px] text-slate-500">Nhấn để mở camera</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
            />
          </div>

          {/* Summary */}
          <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="text-slate-400">Nhân viên:</div>
              <div className="text-white font-bold">{empName} ({empId})</div>
              <div className="text-slate-400">Ngày:</div>
              <div className="text-white font-mono">{currentTime.toLocaleDateString('vi-VN')}</div>
              <div className="text-slate-400">Giờ chấm:</div>
              <div className="text-amber-400 font-mono font-bold">{formatTime(currentTime)}</div>
              <div className="text-slate-400">Ca:</div>
              <div className="text-white font-bold">{getShiftLabel(selectedShift)}</div>
              <div className="text-slate-400">GPS:</div>
              <div className={coords ? 'text-emerald-400' : 'text-rose-400'}>
                {coords ? '✅ Đã có' : '❌ Chưa có'}
              </div>
              <div className="text-slate-400">Ảnh:</div>
              <div className={photo ? 'text-emerald-400' : 'text-rose-400'}>
                {photo ? '✅ Đã chụp' : '❌ Chưa chụp'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 px-5 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleCheckIn}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Chấm công ngay
          </button>
        </div>
      </div>
    </div>
  );
}
