// ============================================================================
// PunchMediaList — hiển thị ẢNH FaceID + TỌA ĐỘ GPS của TỪNG LƯỢT chấm công
// (Vào sáng, Ra sáng, Vào chiều, Ra chiều, Vào tăng ca, Ra tăng ca).
//
// Dùng chung cho modal "NHẬT KÝ FACEID & GPS CHI TIẾT" và modal "CHI TIẾT NGÀY"
// để 2 nơi không bị lệch cách hiển thị.
//
// Bản ghi CŨ (ghi trước migration 024) không có metadata theo slot — chỉ có 1 cặp
// ảnh vào/ra cho cả ngày. Với những bản ghi đó, component hiển thị phần "dữ liệu
// cũ" kèm chú thích rõ ràng thay vì gán bừa ảnh vào một ca cụ thể.
// ============================================================================
import React from 'react';
import {
  getSlotViews,
  getLegacyMedia,
  mapsUrl,
  type SlotView,
} from '../../lib/attendanceMeta';

interface Props {
  log: any;
  /** Mở ảnh phóng to (modal zoom sẵn có của màn hình cha) */
  onZoomImage: (src: string) => void;
  /** 'full' = card dọc trong CHI TIẾT NGÀY, 'compact' = chip ngang trong bảng nhật ký */
  variant?: 'full' | 'compact';
  /** Địa điểm mặc định khi bản ghi không lưu tên địa điểm */
  fallbackLocation?: string;
}

const PunchMediaList: React.FC<Props> = ({
  log,
  onZoomImage,
  variant = 'full',
  fallbackLocation = 'Công trình',
}) => {
  const slots = getSlotViews(log);
  const legacy = getLegacyMedia(log);
  const slotsWithMedia = slots.filter(s => s.photo || s.coords);

  if (slotsWithMedia.length === 0 && !legacy) {
    if (variant === 'compact') return null;
    return (
      <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850/60 mt-2">
        <span className="text-[10px] font-bold text-slate-500 block uppercase mb-1">
          Hình ảnh &amp; địa điểm xác thực
        </span>
        <span className="text-[11px] text-slate-500 italic">
          Không có ảnh FaceID / tọa độ GPS cho ngày này.
        </span>
      </div>
    );
  }

  // ─── Biến thể COMPACT: chip ngang, dùng trong ô bảng nhật ký ───
  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        {slotsWithMedia.map((s: SlotView) => (
          <div
            key={s.key}
            className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
          >
            <span className="text-[9px] font-black text-slate-400 uppercase">
              {s.icon} {s.shortLabel}
            </span>
            <span className="text-[9px] font-mono text-slate-300">{s.time}</span>
            {s.photo && (
              <button
                type="button"
                onClick={() => onZoomImage(s.photo!)}
                className="cursor-zoom-in hover:opacity-80 transition-opacity"
                title={`Ảnh FaceID ${s.label} lúc ${s.time}`}
              >
                <img
                  src={s.photo}
                  className="w-4.5 h-4.5 rounded object-cover border border-slate-705"
                  alt={`Ảnh ${s.label}`}
                  referrerPolicy="no-referrer"
                />
              </button>
            )}
            {s.coords && (
              <a
                href={mapsUrl(s.coords)}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline font-mono text-[9px]"
                title={`Vị trí ${s.label}: ${s.location || fallbackLocation} (${s.coords})`}
              >
                🗺️
              </a>
            )}
          </div>
        ))}

        {legacy && (
          <div className="flex flex-wrap items-center gap-1.5">
            {legacy.photoIn && (
              <button
                type="button"
                onClick={() => onZoomImage(legacy.photoIn!)}
                className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] cursor-zoom-in hover:border-sky-500/50 transition-colors"
                title="Bản ghi cũ: ảnh lượt VÀO gần nhất trong ngày"
              >
                <img src={legacy.photoIn} className="w-4.5 h-4.5 rounded object-cover border border-slate-705" alt="Ảnh Vào" referrerPolicy="no-referrer" />
                <span className="text-slate-400">Ảnh Vào</span>
              </button>
            )}
            {legacy.photoOut && (
              <button
                type="button"
                onClick={() => onZoomImage(legacy.photoOut!)}
                className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] cursor-zoom-in hover:border-sky-500/50 transition-colors"
                title="Bản ghi cũ: ảnh lượt RA gần nhất trong ngày"
              >
                <img src={legacy.photoOut} className="w-4.5 h-4.5 rounded object-cover border border-slate-705" alt="Ảnh Ra" referrerPolicy="no-referrer" />
                <span className="text-slate-400">Ảnh Ra</span>
              </button>
            )}
            {legacy.coordsIn && (
              <a
                href={mapsUrl(legacy.coordsIn)}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[9px]"
                title="Bản ghi cũ: tọa độ lượt VÀO gần nhất"
              >
                🗺️ Vào: {legacy.locationIn || fallbackLocation} ({legacy.coordsIn})
              </a>
            )}
            {legacy.coordsOut && (
              <a
                href={mapsUrl(legacy.coordsOut)}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono text-[9px]"
                title="Bản ghi cũ: tọa độ lượt RA gần nhất"
              >
                🗺️ Ra: {legacy.locationOut || fallbackLocation} ({legacy.coordsOut})
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Biến thể FULL: danh sách card, dùng trong modal CHI TIẾT NGÀY ───
  return (
    <div className="bg-slate-950/45 p-3.5 rounded-xl border border-slate-850/60 space-y-2 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase">
          Hình ảnh &amp; địa điểm xác thực theo từng lượt chấm
        </span>
        <span className="text-[9px] text-slate-600 font-mono">
          {slotsWithMedia.length}/6 lượt có dữ liệu
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {slotsWithMedia.map((s: SlotView) => (
          <div
            key={s.key}
            className="bg-slate-900/70 border border-slate-800 rounded-lg p-2 flex items-start gap-2"
          >
            {s.photo ? (
              <button
                type="button"
                onClick={() => onZoomImage(s.photo!)}
                className="shrink-0 cursor-zoom-in hover:opacity-80 transition-opacity"
                title={`Phóng to ảnh ${s.label}`}
              >
                <img
                  src={s.photo}
                  className="w-11 h-11 rounded-md object-cover border border-slate-700"
                  alt={`Ảnh ${s.label}`}
                  referrerPolicy="no-referrer"
                />
              </button>
            ) : (
              <div
                className="w-11 h-11 rounded-md border border-dashed border-slate-700 flex items-center justify-center shrink-0"
                title="Lượt chấm này không có ảnh FaceID"
              >
                <span className="text-[8px] text-slate-600 font-bold text-center leading-tight">
                  Không<br />ảnh
                </span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] font-black text-slate-200 uppercase tracking-wide truncate">
                  {s.icon} {s.label}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                  {s.time}
                </span>
              </div>
              {s.coords ? (
                <a
                  href={mapsUrl(s.coords)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline text-[9px] font-mono block truncate mt-0.5"
                  title={`Xem trên Google Maps: ${s.location || fallbackLocation} (${s.coords})`}
                >
                  🗺️ {s.location || fallbackLocation}
                </a>
              ) : (
                <span className="text-[9px] text-slate-600 italic block mt-0.5">
                  Không có tọa độ GPS
                </span>
              )}
              {s.coords && (
                <span className="text-[8px] text-slate-600 font-mono block truncate">
                  {s.coords}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {legacy && (
        <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
          <span className="text-[9px] text-amber-500/80 font-bold block">
            ⚠️ Bản ghi cũ — chỉ lưu 1 cặp ảnh Vào/Ra cho cả ngày, không xác định được thuộc ca nào.
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {legacy.photoIn && (
              <button
                type="button"
                className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 cursor-zoom-in hover:border-sky-500/50 transition-all"
                onClick={() => onZoomImage(legacy.photoIn!)}
              >
                <img src={legacy.photoIn} className="w-8 h-8 rounded-md object-cover border border-slate-700" alt="Ảnh Vào" referrerPolicy="no-referrer" />
                <span className="text-slate-300 font-medium text-[10px]">Ảnh Vào</span>
              </button>
            )}
            {legacy.photoOut && (
              <button
                type="button"
                className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 cursor-zoom-in hover:border-sky-500/50 transition-all"
                onClick={() => onZoomImage(legacy.photoOut!)}
              >
                <img src={legacy.photoOut} className="w-8 h-8 rounded-md object-cover border border-slate-700" alt="Ảnh Ra" referrerPolicy="no-referrer" />
                <span className="text-slate-300 font-medium text-[10px]">Ảnh Ra</span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1 text-[10px]">
            {legacy.coordsIn && (
              <a
                href={mapsUrl(legacy.coordsIn)}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-sky-400"
              >
                🗺️ Vào: {legacy.locationIn || fallbackLocation} ({legacy.coordsIn})
              </a>
            )}
            {legacy.coordsOut && (
              <a
                href={mapsUrl(legacy.coordsOut)}
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-sky-400"
              >
                🗺️ Ra: {legacy.locationOut || fallbackLocation} ({legacy.coordsOut})
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PunchMediaList;
