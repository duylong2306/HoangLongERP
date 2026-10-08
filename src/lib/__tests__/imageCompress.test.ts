import { describe, it, expect } from 'vitest';
import { planSize, compressImageFile, SKIP_BELOW } from '../imageCompress';

const mk = (name: string, type: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type });

describe('Nén ảnh khi tải lên — tính kích thước', () => {
  it('ảnh nhỏ hơn giới hạn → giữ nguyên, không phóng to', () => expect(planSize(800, 600, 1920)).toEqual({ w: 800, h: 600, scaled: false }));
  it('ảnh ngang lớn → cạnh dài về 1920, giữ tỉ lệ', () => expect(planSize(4000, 3000, 1920)).toEqual({ w: 1920, h: 1440, scaled: true }));
  it('ảnh dọc lớn → cạnh dài (chiều cao) về 1920', () => expect(planSize(3000, 4000, 1920)).toEqual({ w: 1440, h: 1920, scaled: true }));
  it('không bao giờ ra 0 điểm ảnh', () => expect(planSize(10000, 1, 1920).h).toBe(1));
});

describe('Nén ảnh khi tải lên — chọn tệp để nén', () => {
  // Môi trường test (jsdom) không có createImageBitmap/canvas thật nên mọi nhánh "nén" đều phải trả về tệp gốc an toàn
  it('GIF, PDF, Word, video → giữ nguyên đúng đối tượng', async () => {
    for (const [n, t] of [['a.gif', 'image/gif'], ['b.pdf', 'application/pdf'], ['c.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['d.mp4', 'video/mp4'], ['e.svg', 'image/svg+xml']]) {
      const f = mk(n, t, SKIP_BELOW * 5);
      expect(await compressImageFile(f)).toBe(f);
    }
  });
  it('ảnh JPEG khi trình duyệt không hỗ trợ nén → trả về tệp gốc (không làm hỏng việc tải lên)', async () => {
    const f = mk('x.jpg', 'image/jpeg', SKIP_BELOW * 5);
    expect(await compressImageFile(f)).toBe(f);
  });
});
