/**
 * LOADER NHỎ thay các vòng xoay lẻ (trong nút "Đang lưu…", dòng "Đang tải…", biểu tượng làm mới…):
 * 4 ô vuông sáng lần lượt, cùng họ hình với logo LoLo. Lấy màu chữ hiện tại (currentColor) nên không cần đặt màu riêng.
 * size = cạnh (px) — tương ứng w-3 → 12, w-3.5 → 14, w-4 → 16, w-5 → 20, w-6 → 24.
 * Mặc định chỉ là TRANG TRÍ (ẩn khỏi trình đọc màn hình, vì cạnh nó đã có chữ như "Đang lưu…"); truyền `label` khi nó đứng một mình
 * và cần được đọc là "đang tải" (khi đó có vai trò status).
 */
export default function MiniLoader({ size = 16, className = '', label }: { size?: number; className?: string; label?: string }) {
  return (
    <span {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })} data-testid="mini-loader" className={`lolo-mini ${className}`.trim()} style={{ width: size, height: size }}>
      <i /><i /><i /><i />
    </span>
  );
}
