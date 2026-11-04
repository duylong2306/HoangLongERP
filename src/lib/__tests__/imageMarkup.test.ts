import { describe, it, expect, vi } from 'vitest';
import { normRect, clampRect, cropOf, fitEdge, strokeWidthFor, fontSizeFor, paintOps, screenshotName, MAX_EDGE, type Op } from '../imageMarkup';

describe('imageMarkup — hình học', () => {
  it('normRect: kéo ngược hướng vẫn ra w,h dương', () => {
    expect(normRect({ x: 50, y: 40 }, { x: 10, y: 10 })).toEqual({ x: 10, y: 10, w: 40, h: 30 });
  });
  it('clampRect: kéo lố ra ngoài ảnh thì cắt lại trong ảnh', () => {
    expect(clampRect({ x: -10, y: 5, w: 50, h: 500 }, 100, 80)).toEqual({ x: 0, y: 5, w: 40, h: 75 });
    expect(clampRect({ x: 90, y: 0, w: 50, h: 10 }, 100, 80)).toEqual({ x: 90, y: 0, w: 10, h: 10 });
  });
  it('cropOf: lấy thao tác cắt GẦN NHẤT (cắt lại thì thay vùng cũ); không cắt → null', () => {
    const ops: Op[] = [{ k: 'crop', r: { x: 0, y: 0, w: 10, h: 10 } }, { k: 'blur', r: { x: 1, y: 1, w: 5, h: 5 } }, { k: 'crop', r: { x: 2, y: 2, w: 30, h: 30 } }];
    expect(cropOf(ops)).toEqual({ x: 2, y: 2, w: 30, h: 30 });
    expect(cropOf([{ k: 'blur', r: { x: 1, y: 1, w: 5, h: 5 } }])).toBeNull();
  });
  it('fitEdge: ảnh lớn thu về MAX_EDGE giữ tỉ lệ, ảnh nhỏ giữ nguyên (không phóng to)', () => {
    expect(fitEdge(6400, 3200)).toEqual({ w: MAX_EDGE, h: MAX_EDGE / 2 });
    expect(fitEdge(800, 600)).toEqual({ w: 800, h: 600 });
  });
  it('nét vẽ/chữ tỉ lệ theo bề rộng ảnh nhưng có mức tối thiểu', () => {
    expect(strokeWidthFor(100)).toBe(3); expect(strokeWidthFor(2800)).toBe(10);
    expect(fontSizeFor(100)).toBe(18); expect(fontSizeFor(3800)).toBe(100);
  });
  it('screenshotName theo giờ địa phương', () => {
    expect(screenshotName(new Date(2026, 10, 4, 9, 5, 7))).toBe('man-hinh-20261104-090507.png');
    expect(screenshotName(new Date(2026, 10, 4, 9, 5, 7), 'jpg')).toMatch(/\.jpg$/);
  });
});

describe('paintOps', () => {
  const ctx = () => ({ clearRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), set strokeStyle(_v: string) {}, set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set lineJoin(_v: string) {}, set fillStyle(_v: string) {}, set font(_v: string) {}, set textBaseline(_v: string) {} } as any);
  const img = {} as CanvasImageSource;
  it('vẽ ảnh nền trước, rồi bút/khung/chữ; thao tác crop KHÔNG được vẽ', () => {
    const c = ctx();
    paintOps(c, img, 400, 300, [
      { k: 'pen', color: '#f00', pts: [{ x: 1, y: 1 }, { x: 5, y: 5 }] },
      { k: 'rect', color: '#f00', r: { x: 10, y: 10, w: 50, h: 40 } },
      { k: 'text', color: '#00f', x: 20, y: 20, text: 'Lỗi ở đây\ndòng 2' },
      { k: 'crop', r: { x: 0, y: 0, w: 100, h: 100 } },
    ]);
    expect(c.drawImage).toHaveBeenCalledTimes(1);          // chỉ ảnh nền
    expect(c.stroke).toHaveBeenCalledTimes(1); expect(c.lineTo).toHaveBeenCalledWith(5, 5);
    expect(c.strokeRect).toHaveBeenCalledWith(10, 10, 50, 40);
    expect(c.fillText).toHaveBeenCalledTimes(2);           // chữ nhiều dòng → mỗi dòng một lần
  });
  it('bút chỉ một điểm (bấm không kéo) vẫn vẽ được một chấm', () => {
    const c = ctx();
    paintOps(c, img, 400, 300, [{ k: 'pen', color: '#f00', pts: [{ x: 9, y: 9 }] }]);
    expect(c.lineTo).toHaveBeenCalledTimes(1); expect(c.stroke).toHaveBeenCalled();
  });
});
