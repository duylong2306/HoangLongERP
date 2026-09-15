// html-docx-js-typescript là gói CJS — cách Vite export lại named export
// asBlob() ra ESM (trực tiếp trên module, hay lồng trong .default) không ổn
// định giữa dev-bundle và production-build. Import động NGAY LÚC GỌI hàm và
// tự dò cả 2 hình dạng, thay vì tin vào 1 kiểu import tĩnh cố định ở đầu file.
async function getAsBlob(): Promise<(html: string) => Promise<Blob>> {
  const mod: any = await import('html-docx-js-typescript');
  const fn = mod.asBlob || mod.default?.asBlob;
  if (typeof fn !== 'function') {
    throw new Error('Không tìm thấy hàm asBlob của html-docx-js-typescript');
  }
  return fn;
}

/**
 * Xuất 1 đoạn HTML (bản in Hợp Đồng/Nghiệm Thu/Thanh Lý...) ra file .docx.
 * html-docx-js-typescript đóng gói thẳng HTML+CSS vào 1 file .docx hợp lệ
 * (Word đọc được qua cơ chế MHTML) — giữ nguyên định dạng đã căn chỉnh
 * (bold/italic/căn giữa/bảng...) mà không cần dựng lại cây tài liệu OOXML.
 */
export async function exportHtmlToWord(html: string, fileName: string): Promise<void> {
  // Bọc HTML gốc vào 1 khung tài liệu tối thiểu + giữ lại font Times New Roman/viền
  // bảng đúng như bản in màn hình (class .times-roman-print ở các component gọi
  // hàm này), vì html-docx-js-typescript không tự kế thừa CSS ngoài trang.
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Times New Roman', Times, serif; color: #000000; font-size: 13px; line-height: 1.5; }
    table, th, td { border: 1px solid #000000; border-collapse: collapse; }
    th, td { padding: 6px; }
    ul { list-style-type: disc; padding-left: 20px; }
  </style>
</head>
<body>${html}</body>
</html>`;

  const asBlob = await getAsBlob();
  const blob = await asBlob(fullHtml) as Blob;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.docx') ? fileName : `${fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
