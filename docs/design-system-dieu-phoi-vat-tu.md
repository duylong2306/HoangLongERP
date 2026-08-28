# Định nghĩa thiết kế "Điều Phối Vật Tư" — dùng tái sử dụng cho các menu khác

> Nguồn gốc: toàn bộ mẫu dưới đây được rút ra nguyên văn từ
> `src/components/MaterialCoordination.tsx` (menu **Điều phối vật tư**) — module
> được đánh giá là có ngôn ngữ thiết kế tốt nhất hiện tại của hệ thống. Mỗi mục có
> kèm số dòng tham chiếu để tra lại bản gốc khi cần.
>
> **Cách dùng tài liệu này**: khi làm mới hoặc sửa 1 màn hình/menu khác (Nhân sự,
> Tài chính, Kanban dự án...), copy nguyên văn các class Tailwind bên dưới thay vì
> tự nghĩ ra màu/kiểu mới — tránh tình trạng "mỗi task một kiểu thiết kế khác nhau"
> (đúng quy tắc trong `CLAUDE.md`).
>
> **Đính chính (28/08/2026)**: nhận định ban đầu "các menu khác nền tối, Điều phối
> vật tư nền sáng" là **sai** — đã kiểm tra trực tiếp trên trình duyệt. `src/index.css`
> (dòng ~238-296) có 1 khối CSS override toàn cục ép mọi class `bg-slate-800/900/950`
> trong TOÀN BỘ app thành `background-color: #ffffff` (hoặc xám rất nhạt) bằng
> `!important`. Vì vậy Nhân sự/Tài chính/Kanban dù code dùng `bg-slate-950` vẫn hiển
> thị nền trắng/xám nhạt giống hệt Điều phối vật tư trong thực tế — **không cần đổi
> nền** khi áp tài liệu này sang menu khác.
>
> Khác biệt **thật sự còn tồn tại** (không nằm trong danh sách override, nên vẫn hiển
> thị khác) chỉ còn: kiểu badge trạng thái (mục 3), shade hover tùy biến (mục 4),
> nút CTA gradient (mục 2 & 4), animation modal (mục 8), và bố cục input/bảng/PDF
> (mục 5-7, 11) — đây mới là các mục cần đối chiếu/copy khi sửa menu khác.

---

## 1. Màu nền tổng thể

| Vị trí | Class | Ghi chú |
|---|---|---|
| Nền trang gốc | *(không set màu — kế thừa nền trắng của layout cha)* | Không có `bg-slate-900/950` |
| Card / panel chính | `bg-white border border-slate-200 rounded-2xl` | (`MaterialCoordination.tsx:1629`) |
| Card phụ / khối thông tin | `bg-white border border-slate-200 p-3 sm:p-5 rounded-2xl shadow-xs` | (`:1939, 1992, 2009, 2175, 2241, 2334, 2431`) |
| Cột Kanban (board) | `rounded-2xl sm:rounded-3xl bg-white/50 border ... shadow-lg sm:shadow-2xl` | (`:1676`) |
| Header modal / thanh công cụ phụ | `bg-slate-50 border-b border-slate-200` | (`:2902`) |
| Vùng hover nhẹ trên card | `hover:bg-amber-50/40` | (`:5705` — cũng dùng lại đúng pattern này ở Tài chính) |

**Bảng màu cột Kanban theo trạng thái** (định nghĩa 1 chỗ, dùng lại cho mọi cột — `:1541-1547`):

```ts
{ borderColor: 'border-amber-200/80', bgColor: 'bg-amber-50', textColor: 'text-amber-700' }
```
→ Công thức chung cho 1 "trạng thái" bất kỳ: `border-{màu}-200/80` + `bg-{màu}-50` + `text-{màu}-700`.

## 2. Màu nhấn (accent) & gradient

- Màu nhấn chính: **amber/orange** (`amber-500` → `orange-500`).
- Nút CTA quan trọng nhất dùng **gradient** thay vì màu đặc:
```html
class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600
       text-white rounded-xl px-3 py-2 text-[11px] font-black shadow-md shadow-amber-500/20"
```
(`:1609`) — đổ bóng cùng tông màu (`shadow-amber-500/20`) tạo cảm giác "cao cấp", chỉ dùng cho 1-2 nút quan trọng nhất trên màn hình, không lạm dụng.

## 3. Bảng màu Badge / trạng thái (pill)

**Công thức chuẩn — nền pastel nhạt, viền + chữ cùng tông, đậm hơn nền:**
```html
class="text-{màu}-600 bg-{màu}-50 border border-{màu}-200 rounded-full font-bold text-[10px] px-2.5 py-1"
```
Ví dụ thật (`:1711-1719, 1781`):
```html
<span class="text-emerald-600 bg-emerald-50 border border-emerald-200 ...">Đã duyệt</span>
<span class="text-teal-600 bg-teal-50 border border-teal-200 ...">...</span>
<span class="text-amber-600 bg-amber-50 border border-amber-200 ...">Chờ duyệt</span>
<span class="text-rose-600 bg-white border border-rose-200 rounded-full ...">Sắp xóa</span>
```
**KHÔNG dùng** kiểu nền tối trong suốt (`bg-{màu}-500/10 text-{màu}-400 border-{màu}-500/20`) — đó là kiểu cũ của Tài chính/Nhân sự/Kanban, đã xác nhận không đồng bộ và vừa được dọn ở Đề Xuất Chi (xem lịch sử commit `fix(finance): thống nhất kiểu badge trạng thái Đề Xuất Chi theo Điều phối vật tư`).

## 4. Nút bấm (Button)

**Nút chính (submit / hành động chính trong modal)** — full-width, khối màu đặc, chữ trắng, bo `rounded-lg`, chữ `font-black`:
```html
class="w-full bg-{màu}-600 hover:bg-{màu}-500 text-white text-[11px] font-black
       py-2.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-all"
```
Ví dụ theo ngữ nghĩa hành động (`:2412, 2571, 2578, 2597, 2604, 2611, 2710`):
- Xác nhận / tiếp tục: `bg-indigo-600 hover:bg-indigo-500`
- Duyệt / đồng ý (nhẹ nhàng hơn): `bg-sky-600 hover:bg-sky-500`
- Từ chối / xóa: `bg-rose-600 hover:bg-rose-500`
- Hoàn tất / thành công: `bg-emerald-600 hover:bg-emerald-500`
- Cảnh báo / chờ: `bg-orange-500 hover:bg-orange-400`
- Trạng thái disabled: thêm `disabled:bg-slate-300 disabled:cursor-not-allowed`

**Nút phụ (hủy / đóng)**:
```html
class="w-full py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs
       transition shadow-md cursor-pointer"
```
(`:2889`)

**Nút icon tròn (đóng modal)**:
```html
class="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all"
```
(`:2907`)

**Quy ước hover**: luôn dùng shade Tailwind chuẩn `-500`/`-600` (KHÔNG dùng shade tùy biến kiểu `-550`/`-650` như Nhân sự/Tài chính đang làm — đó là điểm lệch chuẩn cần tránh khi viết code mới).

## 5. Input / Select / Textarea

**Input thường trong form/modal:**
```html
class="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800
       outline-none focus:border-indigo-500"
```
(`:2921, 2949`)

**Input tìm kiếm (có icon bên trái)** — nền `slate-50` thay vì trắng để phân biệt với vùng nội dung xung quanh, đổi sang trắng khi focus:
```html
class="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs
       text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400
       focus:bg-white transition-all font-sans"
```
(`:1637`)

**Input số nhỏ trong bảng (số lượng, đơn giá)**:
```html
class="w-14 bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] text-right
       text-slate-800 outline-none"
```
(`:2958, 2961`)

**Nhãn (label) phía trên input** — luôn tách riêng dòng, viết hoa, cỡ nhỏ, màu xám:
```html
class="block text-slate-500 font-bold text-[10px] uppercase"
```
(`:2914, 2948`)

**Dropdown tìm kiếm gợi ý (autocomplete)** — input thường + panel nổi bên dưới:
```html
<!-- input giữ nguyên style input thường ở trên -->
<div class="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200
            rounded-lg shadow-xl max-h-52 overflow-y-auto">
  <button class="w-full text-left px-3 py-2 text-[11px] hover:bg-indigo-50
                 text-slate-700 flex items-center gap-2 transition-all">...</button>
</div>
```
(`:2923-2944`)

## 6. Bố cục form (sắp xếp input)

- Mỗi field = `<div className="space-y-1">` bọc `label` + `input` (khoảng cách dọc rất nhỏ, gọn).
- Nhiều field cùng hàng: `grid grid-cols-1 sm:grid-cols-2 gap-3` — 1 cột trên mobile, 2 cột từ `sm` trở lên (`:2912`).
- Nhiều field liên quan xếp thành khối card riêng, cách khối form chính bằng `space-y-4` (`:2911`).
- Danh sách dòng lặp (item list) trong form: bọc trong `border border-slate-200 rounded-xl divide-y divide-slate-100`, mỗi dòng `p-2.5` (`:2952-2954`).

## 7. Thiết kế bảng (Table)

```html
<table class="w-full text-left border-collapse border border-black my-6 font-sans">
```
(`:2769` — bảng cho in ấn, viền đen đậm)

```html
<table class="w-full text-xs text-left">
```
(`:2093` — bảng hiển thị thường trong drawer chi tiết, không viền ngoài, dựa vào `divide-y` giữa các dòng)

Quy ước chung: bảng dữ liệu số dùng `text-right font-mono`, cột tên/mô tả dùng `text-left`, header cột dùng chữ hoa nhỏ `text-[10px] uppercase font-bold text-slate-500`.

## 8. Modal

**Khung modal chuẩn** (4 kích cỡ tùy nội dung, đều theo 1 công thức):
```html
class="w-full max-w-{sm|md|2xl|4xl} bg-white rounded-2xl border border-slate-200
       shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
```
(`:1776, 2834, 2867, 2901, 2988, 3030, 3106`) — **luôn có animation vào** `animate-in fade-in zoom-in-95 duration-200`, đây là điểm Điều phối vật tư làm nhất quán còn 3 module kia thì không (đa số modal ở Nhân sự/Tài chính/Kanban không có animation vào, hoặc dùng class tự chế khác nhau).

**Overlay nền sau modal:**
```html
class="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50"
```

**Header modal** (icon + tiêu đề + nút đóng, luôn cùng 1 hàng):
```html
<div class="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center shrink-0">
  <div class="flex items-center gap-2 min-w-0">
    <Icon class="w-5 h-5 text-indigo-600 shrink-0" />
    <span class="font-black text-xs sm:text-sm text-slate-900 uppercase truncate">Tiêu đề</span>
  </div>
  <button class="p-1.5 hover:bg-slate-200 rounded-full text-slate-600 cursor-pointer transition-all">
    <X class="w-5 h-5" />
  </button>
</div>
```
(`:2902-2909`)

**Thân modal:** `p-4 sm:p-5 space-y-4 overflow-y-auto flex-1` (co giãn, cuộn riêng khi nội dung dài, header/footer đứng yên — `:2911`).

## 9. Bo góc & khoảng cách (radius/spacing) — bảng tra nhanh

| Thành phần | Radius |
|---|---|
| Cột Kanban (board) | `rounded-2xl` / `rounded-3xl` (desktop) |
| Card, modal | `rounded-2xl` |
| Input, nút, card nhỏ trong danh sách | `rounded-lg` / `rounded-xl` |
| Badge (pill) | `rounded-full` |

Khoảng cách card: `p-3`/`p-3.5` (card nhỏ), `p-4`/`p-5` (card chính, thân modal). Khoảng cách giữa các khối: `space-y-3` đến `space-y-6`. Khoảng cách trong 1 hàng flex: `gap-1.5` đến `gap-3`.

## 10. Chữ (Typography)

- Cỡ chữ dùng giá trị tùy biến theo px thay vì thang chuẩn Tailwind, để căn chỉnh chi tiết: `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[11.5px]`... — chỉ dùng `text-lg/xl/2xl` cho tiêu đề `<h1>` cấp trang.
- Trọng lượng chữ thiên về đậm: `font-bold` cho nhãn/label, `font-extrabold`/`font-black` cho tiêu đề card và nút bấm quan trọng.
- Nhãn/label luôn `uppercase` + `tracking-wide`/`tracking-wider` để phân biệt với nội dung.

## 11. Thiết kế file PDF / In ấn

Điều phối vật tư có sẵn 1 template PDF hoàn chỉnh, đúng chuẩn hành chính Việt Nam (`buildPurchaseOrderHtml`, `MaterialCoordination.tsx:862-975`) — nên **dùng lại nguyên khối `<style>` này** cho bất kỳ chứng từ PDF mới nào (phiếu chi, phiếu thu, hợp đồng...) thay vì viết CSS in ấn mới mỗi lần:

```css
@page { size: A4; margin: 15mm 18mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body, .pdf-export-root { font-family: 'Times New Roman', serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }

/* Header 2 cột: thông tin công ty (trái) + quốc hiệu/tiêu đề (phải) — DÙNG TABLE,
   không dùng flex (flex render lệch khi chụp html2canvas để xuất PDF chia sẻ). */
table.header { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
.company-info { width: 58%; }
.company-info .name { font-size: 14px; font-weight: bold; }
.center-title { text-align: center; width: 42%; }
.center-title .country { font-size: 12px; font-weight: bold; letter-spacing: 0.5px; }
.center-title .doc-title { font-size: 18px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }

/* Bảng thông tin (nhãn + giá trị) — table-layout: fixed để tránh lệch cột khi
   có colspan (VD dòng "Dự án" chiếm cả hàng), nhất là lúc xuất PDF. */
table.info { width: 100%; border-collapse: collapse; margin: 6px 0; table-layout: fixed; }
table.info .lbl { font-weight: bold; white-space: nowrap; width: 130px; }

/* Bảng danh mục (vật tư/dòng chi tiết) — viền đậm, header nền xám nhạt */
table.items th, table.items td { border: 1px solid #222; padding: 5px 7px; font-size: 11px; }
table.items th { background: #e8e8e8; font-weight: bold; text-align: center; }

.total-row { text-align: right; font-weight: bold; font-size: 13px; }
.total-words { font-size: 11px; color: #333; }

/* Khối ký tên 3 cột (người lập / người điều phối / bên đối tác) */
table.signatures td { text-align: center; width: 33.33%; }
.signatures .sig-name { font-weight: bold; margin-top: 40px; }
```

**Cấu trúc nội dung chuẩn cho 1 chứng từ PDF:**
1. Header 2 cột (thông tin doanh nghiệp | quốc hiệu + tên chứng từ + mã + ngày).
2. `<hr/>` phân cách.
3. 1-2 bảng `table.info` (label + value) chứa thông tin đối tác/người liên quan.
4. `table.items` — bảng danh mục chi tiết (STT, tên, SL, ĐVT, đơn giá, thành tiền).
5. Dòng tổng cộng (`total-row`) + tổng bằng chữ (`total-words`, dùng `numberToVietnameseWords`).
6. `table.signatures` — 3 cột ký tên.

**Cách xuất PDF** (`MaterialCoordination.tsx:1015-1023` in trực tiếp, `:1026+` xuất Blob để chia sẻ/tải):
- In trực tiếp: mở `window.open('', '_blank')`, `w.document.write(html)`, sau đó `w.print()` sau 400ms.
- Xuất Blob (chia sẻ/tải file): render HTML vào 1 `<div>` ẩn của chính document đang chạy (không dùng `<iframe>` — `html2canvas` không đọc được CSS của document khác), chụp bằng `html2canvas` rồi ghép ảnh vào `jsPDF` (tự chia trang nếu nội dung dài hơn 1 trang A4).

## 12. Vấn đề cần tránh khi áp dụng sang menu khác

1. **Không cần đổi màu nền** (`bg-slate-800/900/950` đã tự động hiển thị trắng/xám nhạt nhờ override trong `src/index.css` — xem đính chính đầu file). Đừng mất công đổi hàng loạt class nền slate sang `bg-white` — không tạo ra khác biệt thị giác nào, chỉ tốn công và tăng rủi ro sửa nhầm.
2. **Không dùng shade Tailwind tùy biến** (`-350`, `-550`, `-650`, `-850`...) khi viết code MỚI — chỉ dùng thang chuẩn (`-50/100/200/.../900`) như Điều phối vật tư đang làm. (Code cũ đang dùng shade tùy biến thì không bắt buộc phải sửa lại nếu không ảnh hưởng thị giác — chỉ tránh dùng tiếp khi viết mới.)
3. **1 trạng thái = 1 kiểu badge duy nhất trong toàn bộ file** — không định nghĩa 2 hàm màu khác nhau cho cùng 1 enum trạng thái (đã xảy ra ở Tài chính, mục 3 phía trên). Đây là khác biệt thật, ưu tiên sửa trước.
4. Khi viết CSS in ấn mới, **luôn dùng `<table>` cho phần header 2 cột**, không dùng `flex` — flex render sai khi chụp bằng `html2canvas`.
