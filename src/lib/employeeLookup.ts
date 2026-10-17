// TRA NHÂN VIÊN THEO TÊN — chỉ dùng khi KHÔNG có mã (nhập Excel, đơn cũ chỉ lưu tên người duyệt).
// Khớp CHÍNH XÁC (bỏ khoảng trắng thừa, không phân biệt hoa/thường) và chỉ trả kết quả khi ĐÚNG 1 người trùng tên.
// Không còn khớp một phần ("includes"): tên "An" từng khớp nhầm "Nguyễn Thị Ánh Ngọc"/"Bảo An"…; trùng tên (≥2 người) → không đoán, trả về rỗng.
const norm = (s?: string | null) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function findUniqueEmployeeByName<E extends { id: string; name?: string }>(employees: E[], name?: string | null): E | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const hits = employees.filter(e => norm(e.name) === n);
  return hits.length === 1 ? hits[0] : undefined;
}
