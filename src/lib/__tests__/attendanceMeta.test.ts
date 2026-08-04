import { describe, it, expect } from 'vitest';
import {
  parsePunchMeta,
  mergePunchMeta,
  hasAnyPunchMeta,
  getSlotViews,
  getLegacyMedia,
  PUNCH_SLOTS,
} from '../attendanceMeta';

const PHOTO_A = 'data:image/jpeg;base64,AAAA';
const PHOTO_B = 'data:image/jpeg;base64,BBBB';

describe('parsePunchMeta', () => {
  it('trả về object rỗng cho giá trị null/undefined/chuỗi hỏng', () => {
    expect(parsePunchMeta(null)).toEqual({});
    expect(parsePunchMeta(undefined)).toEqual({});
    expect(parsePunchMeta('không phải json')).toEqual({});
    expect(parsePunchMeta([1, 2, 3])).toEqual({});
  });

  it('đọc được chuỗi JSON (trường hợp jsonb trả về dạng text)', () => {
    const raw = JSON.stringify({ timeInS: { photo: PHOTO_A, coords: '10.7, 106.6' } });
    expect(parsePunchMeta(raw).timeInS).toEqual({
      photo: PHOTO_A, coords: '10.7, 106.6', location: undefined, at: undefined,
    });
  });

  it('loại bỏ slot rỗng và khóa không hợp lệ', () => {
    const meta = parsePunchMeta({
      timeInS: { photo: '', coords: '', location: '' },
      slotLa: { photo: PHOTO_A },
      timeOutC: { coords: '10.1, 106.1' },
    });
    expect(meta.timeInS).toBeUndefined();
    expect((meta as any).slotLa).toBeUndefined();
    expect(meta.timeOutC?.coords).toBe('10.1, 106.1');
  });
});

describe('mergePunchMeta', () => {
  it('GIỮ slot chỉ có ở bản cũ — đây là lỗi gốc khiến chấm chiều xóa ảnh chấm sáng', () => {
    const prev = { timeInS: { photo: PHOTO_A, coords: '10.1, 106.1', at: '07:25' } };
    const next = { timeInC: { photo: PHOTO_B, coords: '10.2, 106.2', at: '13:02' } };
    const merged = mergePunchMeta(prev, next);
    expect(merged.timeInS?.photo).toBe(PHOTO_A);
    expect(merged.timeInC?.photo).toBe(PHOTO_B);
  });

  it('bản mới thắng ở slot trùng nhau', () => {
    const merged = mergePunchMeta(
      { timeInS: { photo: PHOTO_A, at: '07:25' } },
      { timeInS: { photo: PHOTO_B, at: '07:40' } }
    );
    expect(merged.timeInS).toEqual({
      photo: PHOTO_B, at: '07:40', coords: undefined, location: undefined,
    });
  });

  it('trường trống của bản mới không xóa dữ liệu bản cũ cùng slot', () => {
    const merged = mergePunchMeta(
      { timeInS: { photo: PHOTO_A, coords: '10.1, 106.1', location: 'Xưởng' } },
      { timeInS: { photo: PHOTO_B } }
    );
    expect(merged.timeInS?.photo).toBe(PHOTO_B);
    expect(merged.timeInS?.coords).toBe('10.1, 106.1');
    expect(merged.timeInS?.location).toBe('Xưởng');
  });

  it('gộp được đủ 6 lượt chấm trong ngày', () => {
    let meta: any = {};
    for (const slot of PUNCH_SLOTS) {
      meta = mergePunchMeta(meta, { [slot.key]: { photo: PHOTO_A, coords: '10.1, 106.1' } });
    }
    expect(Object.keys(meta)).toHaveLength(6);
  });
});

describe('hasAnyPunchMeta', () => {
  it('phân biệt bản ghi mới và bản ghi cũ', () => {
    expect(hasAnyPunchMeta({ punchMeta: { timeInS: { photo: PHOTO_A } } })).toBe(true);
    expect(hasAnyPunchMeta({ photoIn: PHOTO_A })).toBe(false);
    expect(hasAnyPunchMeta({ punchMeta: {} })).toBe(false);
    expect(hasAnyPunchMeta(null)).toBe(false);
  });
});

describe('getSlotViews', () => {
  it('trả về đúng ảnh/tọa độ cho từng lượt, kèm giờ lấy từ cột thời gian', () => {
    const log = {
      timeInS: '07:25', timeOutS: '11:32',
      timeInC: '13:02', timeOutC: '17:05',
      timeInOT: '--:--', timeOutOT: '--:--',
      punchMeta: {
        timeInS: { photo: PHOTO_A, coords: '10.1, 106.1', location: 'Xưởng' },
        timeOutC: { photo: PHOTO_B, coords: '10.4, 106.4' },
      },
    };
    const views = getSlotViews(log);
    expect(views.map(v => v.key)).toEqual(['timeInS', 'timeOutS', 'timeInC', 'timeOutC']);

    const inS = views.find(v => v.key === 'timeInS')!;
    expect(inS.time).toBe('07:25');
    expect(inS.photo).toBe(PHOTO_A);
    expect(inS.label).toBe('Vào sáng');

    // Lượt đã chấm nhưng không có metadata → vẫn liệt kê, không có ảnh
    const outS = views.find(v => v.key === 'timeOutS')!;
    expect(outS.punched).toBe(true);
    expect(outS.photo).toBeUndefined();

    const outC = views.find(v => v.key === 'timeOutC')!;
    expect(outC.photo).toBe(PHOTO_B);
    expect(outC.label).toBe('Ra chiều');
  });

  it('hiển thị được lượt tăng ca', () => {
    const views = getSlotViews({
      timeInOT: '18:00', timeOutOT: '20:30',
      punchMeta: { timeInOT: { photo: PHOTO_A }, timeOutOT: { coords: '10.9, 106.9' } },
    });
    expect(views.map(v => v.label)).toEqual(['Vào tăng ca', 'Ra tăng ca']);
  });

  it('onlyWithMedia lọc bỏ lượt không có ảnh/tọa độ', () => {
    const views = getSlotViews(
      { timeInS: '07:25', timeOutS: '11:30', punchMeta: { timeInS: { photo: PHOTO_A } } },
      { onlyWithMedia: true }
    );
    expect(views).toHaveLength(1);
    expect(views[0].key).toBe('timeInS');
  });

  it('bỏ qua lượt chưa chấm và không có metadata', () => {
    expect(getSlotViews({ timeInS: '--:--', timeOutS: '' })).toHaveLength(0);
  });
});

describe('getLegacyMedia', () => {
  it('trả dữ liệu cũ cho bản ghi chưa có punchMeta', () => {
    const legacy = getLegacyMedia({ photoIn: PHOTO_A, coordsIn: '10.1, 106.1', photoOut: '' });
    expect(legacy).toEqual({ photoIn: PHOTO_A, coordsIn: '10.1, 106.1' });
  });

  it('trả null khi bản ghi đã có metadata theo lượt (tránh hiển thị trùng ảnh)', () => {
    expect(getLegacyMedia({
      photoIn: PHOTO_A,
      punchMeta: { timeInS: { photo: PHOTO_A } },
    })).toBeNull();
  });

  it('trả null khi không có gì', () => {
    expect(getLegacyMedia({ photoIn: '', coordsOut: '--:--' })).toBeNull();
    expect(getLegacyMedia(null)).toBeNull();
  });
});
