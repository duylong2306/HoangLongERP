// BỘ GÕ TIẾNG VIỆT (Telex/VNI/IME): khi chữ cuối còn đang "gạch chân" (đang ghép dấu), phím Enter là để CHỐT chữ đó chứ chưa phải lệnh gửi.
// Nếu ô nhập coi Enter đó là "gửi", tin bị cắt đôi: phần đã gõ đi trước, chữ vừa chốt lọt ra thành tin thứ hai (VD "…a ơi" + "ơi").
// Trình duyệt báo trạng thái này khác nhau: Chrome đặt isComposing=true, Safari chốt chữ trước rồi gửi keydown với keyCode 229 → kiểm tra cả hai.
export function isImeComposing(e: { nativeEvent?: { isComposing?: boolean }; isComposing?: boolean; keyCode?: number }): boolean {
  return !!(e.nativeEvent?.isComposing ?? e.isComposing) || e.keyCode === 229;
}
