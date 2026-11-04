import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ChatImageEditor from '../ChatImageEditor';

// jsdom không có canvas/Image thật → giả lập vừa đủ: ảnh 800×600, getContext trả về ctx ghi lại lệnh vẽ, toBlob trả Blob rỗng.
const ctx = { clearRect: vi.fn(), drawImage: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), strokeRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn() } as any;
let lastCanvas: { w: number; h: number }[] = [];
beforeEach(() => {
  Object.values(ctx).forEach((f: any) => f.mockClear?.());
  lastCanvas = [];
  (URL as any).createObjectURL = vi.fn(() => 'blob:x'); (URL as any).revokeObjectURL = vi.fn();
  vi.stubGlobal('Image', class { onload: any; naturalWidth = 800; naturalHeight = 600; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, cb: any) { lastCanvas.push({ w: this.width, h: this.height }); cb(new Blob(['png'], { type: 'image/png' })); });
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as any);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const file = () => new File(['x'], 'a.png', { type: 'image/png' });
const open = async (props: any = {}) => {
  const onDone = vi.fn(), onCancel = vi.fn();
  render(<ChatImageEditor file={file()} onDone={onDone} onCancel={onCancel} {...props} />);
  const canvas = await screen.findByTestId('editor-canvas') as HTMLCanvasElement;
  return { canvas, onDone, onCancel };
};
const drag = (c: HTMLElement, a: [number, number], b: [number, number]) => {
  fireEvent.pointerDown(c, { clientX: a[0], clientY: a[1], pointerId: 1 });
  fireEvent.pointerMove(c, { clientX: b[0], clientY: b[1], pointerId: 1 });
  fireEvent.pointerUp(c, { clientX: b[0], clientY: b[1], pointerId: 1 });
};

describe('ChatImageEditor', () => {
  it('mở ảnh, hiện đủ công cụ; Hủy / Esc → onCancel, không trả ảnh', async () => {
    const { onCancel, onDone } = await open();
    for (const n of ['Cắt', 'Bút', 'Khung', 'Chữ', 'Làm mờ', 'Hoàn tác', 'Xong']) expect(screen.getByLabelText(n)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Hủy')); expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' }); expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onDone).not.toHaveBeenCalled();
  });
  it('vẽ bút rồi Xong → trả tệp PNG đúng cỡ ảnh gốc, tên man-hinh-…', async () => {
    const { canvas, onDone } = await open();
    drag(canvas, [10, 10], [100, 80]);
    expect(ctx.lineTo).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Xong'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const f = onDone.mock.calls[0][0] as File;
    expect(f.type).toBe('image/png'); expect(f.name).toMatch(/^man-hinh-\d{8}-\d{6}\.png$/);
    expect(lastCanvas.at(-1)).toEqual({ w: 800, h: 600 });
  });
  it('cắt vùng 200×100 rồi Xong → ảnh xuất ra đúng 200×100', async () => {
    const { canvas, onDone } = await open();
    fireEvent.click(screen.getByLabelText('Cắt'));
    drag(canvas, [100, 100], [300, 200]);
    fireEvent.click(screen.getByLabelText('Xong'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(lastCanvas.at(-1)).toEqual({ w: 200, h: 100 });
  });
  it('hoàn tác bỏ thao tác cắt vừa làm → ảnh xuất lại nguyên cỡ', async () => {
    const { canvas, onDone } = await open();
    fireEvent.click(screen.getByLabelText('Cắt'));
    drag(canvas, [100, 100], [300, 200]);
    fireEvent.click(screen.getByLabelText('Hoàn tác'));
    fireEvent.click(screen.getByLabelText('Xong'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(lastCanvas.at(-1)).toEqual({ w: 800, h: 600 });
  });
  it('kéo quá nhỏ (bấm nhầm) với Khung không tạo khung', async () => {
    const { canvas, onDone } = await open();
    fireEvent.click(screen.getByLabelText('Khung'));
    drag(canvas, [50, 50], [52, 52]);
    ctx.strokeRect.mockClear();   // bỏ qua khung xem trước lúc đang kéo; chỉ xét ảnh XUẤT RA
    fireEvent.click(screen.getByLabelText('Xong'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
  it('Chữ: bấm vào ảnh, gõ chữ, Enter → vẽ chữ lên ảnh', async () => {
    const { canvas } = await open();
    fireEvent.click(screen.getByLabelText('Chữ'));
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 40, pointerId: 1 });
    const input = await screen.findByLabelText('Nhập chữ');
    fireEvent.change(input, { target: { value: 'Sai số liệu' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(ctx.fillText).toHaveBeenCalledWith('Sai số liệu', 40, 40));
  });
  it('đổi màu chọn đúng nút màu', async () => {
    await open();
    const colors = screen.getAllByTestId('editor-color');
    fireEvent.click(colors[2]);
    expect(colors[2]).toHaveAttribute('aria-pressed', 'true'); expect(colors[0]).toHaveAttribute('aria-pressed', 'false');
  });
  it('chế độ khoanh vùng (snip): chưa khoanh thì cả ảnh mờ + gợi ý; khoanh 300×200 rồi Xong → ảnh xuất đúng 300×200', async () => {
    const { canvas, onDone } = await open({ variant: 'snip', initialTool: 'crop' });
    expect(screen.getByTestId('chat-image-editor').textContent).toContain('Kéo chuột để khoanh vùng cần chụp');
    expect(screen.getByTestId('snip-dim')).toBeInTheDocument();      // lớp mờ phủ toàn ảnh trước khi khoanh (phần tử HTML, không vẽ lên canvas)
    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());   // chờ lần vẽ đầu xong rồi mới đo, tránh chập chờn khi máy bận
    const paints = ctx.drawImage.mock.calls.length;
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 60, pointerId: 1 });
    for (const [x, y] of [[100, 100], [200, 180], [350, 260]]) fireEvent.pointerMove(canvas, { clientX: x, clientY: y, pointerId: 1 });
    // Đang KÉO khoanh vùng không được vẽ lại canvas (nguyên nhân giật trước đây) — chỉ cập nhật khung chọn HTML
    expect(ctx.drawImage.mock.calls.length).toBe(paints);
    fireEvent.pointerUp(canvas, { clientX: 350, clientY: 260, pointerId: 1 });
    expect(screen.queryByTestId('snip-dim')).toBeNull();
    const box = screen.getByTestId('crop-box') as HTMLElement;
    expect(box.style.left).toBe('6.25%'); expect(box.style.width).toBe('37.5%');
    expect(screen.getByTestId('chat-image-editor').textContent).not.toContain('Kéo chuột để khoanh vùng cần chụp');
    fireEvent.click(screen.getByLabelText('Xong'));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(lastCanvas.at(-1)).toEqual({ w: 300, h: 200 });
  });
  it('snip: vùng chọn sát mép trên → thanh công cụ nhảy xuống dưới để không che vùng chụp', async () => {
    const { canvas } = await open({ variant: 'snip', initialTool: 'crop' });
    expect(screen.getByTestId('editor-toolbar').className).toContain('top-3');
    drag(canvas, [50, 10], [350, 260]);
    expect(screen.getByTestId('editor-toolbar').className).toContain('bottom-3');
  });
});
