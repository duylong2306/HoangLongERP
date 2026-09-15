/* ==========================================================================
 * pushDeepLink.ts — Điều hướng sâu (deep link) từ thông báo đẩy
 * --------------------------------------------------------------------------
 * Ứng dụng là SPA điều hướng bằng STATE (`activeTab`), không dùng route thật.
 * Vì vậy deep link được mã hoá bằng QUERY STRING trên đường dẫn gốc:
 *
 *     /?taskId=TASK-123          → mở tab Công việc + modal chi tiết công việc
 *     /?taskCode=CV-001          → như trên, nhưng tra theo MÃ công việc
 *     /?conversation=CONV-9      → mở Messenger đúng hội thoại
 *     /?projectId=PRJ-2          → mở tab Dự án
 *
 * Luồng hoàn chỉnh:
 *   1. Nơi gửi push đính kèm `data.url` (build bằng `buildPushUrl`) + các field
 *      rời (taskId/conversationId/…) để service worker khỏi phải parse URL.
 *   2. Service worker (`public/web-push-sw.js`, `public/sw.js`) khi người dùng
 *      bấm vào thông báo:
 *        - Nếu app ĐANG MỞ  → focus tab đó rồi `postMessage` payload sang app.
 *        - Nếu app CHƯA MỞ  → `openWindow(url)` với query string ở trên.
 *   3. App (`App.tsx`) xử lý cả 2 đường:
 *        - Nhận `message` từ service worker  → điều hướng ngay (không reload).
 *        - Lúc khởi động đọc `location.search` → điều hướng rồi dọn URL.
 * ========================================================================== */

/** Kiểu message service worker gửi sang app khi người dùng bấm thông báo. */
export const NOTIFICATION_CLICK_MESSAGE = 'HL_NOTIFICATION_CLICK';

export interface PushDeepLink {
  /** ID công việc (ưu tiên cao nhất — mở thẳng modal chi tiết). */
  taskId?: string;
  /** Mã công việc (VD 'CV-001') — dùng khi thông báo cũ chỉ có `subTaskCode`. */
  taskCode?: string;
  /** ID hội thoại chat. */
  conversationId?: string;
  /** ID dự án. */
  projectId?: string;
  /** Phân loại thông báo — dùng để chọn tab khi không có ID cụ thể. */
  category?: string;
}

/** Có ít nhất một đích đến cụ thể hay không. */
export function hasDeepLinkTarget(link: PushDeepLink): boolean {
  return Boolean(link.taskId || link.taskCode || link.conversationId || link.projectId);
}

/**
 * Dựng URL deep link để đính vào payload push.
 * Thứ tự ưu tiên: công việc → hội thoại → dự án.
 */
export function buildPushUrl(link: PushDeepLink): string {
  const params = new URLSearchParams();

  if (link.taskId) params.set('taskId', link.taskId);
  else if (link.taskCode) params.set('taskCode', link.taskCode);

  if (link.conversationId) params.set('conversation', link.conversationId);

  // Chỉ gắn projectId khi KHÔNG có công việc cụ thể — công việc luôn ưu tiên hơn
  // dự án chứa nó, nếu không người dùng bấm thông báo công việc lại rơi vào dự án.
  if (link.projectId && !link.taskId && !link.taskCode) {
    params.set('projectId', link.projectId);
  }

  if (link.category) params.set('cat', link.category);

  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

/**
 * Đọc deep link từ một query string / URL bất kỳ.
 *
 * Hỗ trợ CẢ định dạng CŨ dạng đường dẫn ('/tasks/<id>', '/projects/<id>',
 * '/messages?conversation=<id>'). Các thông báo đã gửi đi trước đây vẫn nằm
 * trên máy người dùng và mang URL cũ — không thể sửa ngược, nên phải đọc được.
 */
export function parsePushUrl(rawUrl: string): PushDeepLink {
  let search = '';
  let pathname = '';
  try {
    // Chấp nhận cả URL tuyệt đối, đường dẫn tương đối, lẫn query string trần.
    if (rawUrl.startsWith('?')) {
      search = rawUrl;
    } else {
      const u = new URL(rawUrl, 'http://localhost');
      search = u.search;
      pathname = u.pathname;
    }
  } catch {
    return {};
  }

  const p = new URLSearchParams(search);
  const link: PushDeepLink = {
    taskId: p.get('taskId') || undefined,
    taskCode: p.get('taskCode') || undefined,
    // chatStore (bản cũ) gửi dạng `/messages?conversation=<id>` → giữ tương thích
    conversationId: p.get('conversation') || p.get('conversationId') || undefined,
    projectId: p.get('projectId') || undefined,
    category: p.get('cat') || undefined,
  };

  // ── Tương thích ngược: định dạng đường dẫn cũ ──
  const legacy = pathname.match(/^\/(tasks|projects|messages)\/([^/]+)\/?$/);
  if (legacy) {
    const [, kind, rawId] = legacy;
    const id = decodeURIComponent(rawId);
    if (kind === 'tasks' && !link.taskId) link.taskId = id;
    if (kind === 'projects' && !link.projectId) link.projectId = id;
    if (kind === 'messages' && !link.conversationId) link.conversationId = id;
  }

  return link;
}

/**
 * Chuẩn hoá một URL push bất kỳ (kể cả định dạng cũ) về dạng query string an toàn
 * với host tĩnh không có SPA fallback. Dùng trong service worker trước openWindow.
 */
export function normalizePushUrl(rawUrl: string): string {
  const link = parsePushUrl(rawUrl);
  return hasDeepLinkTarget(link) ? buildPushUrl(link) : '/';
}

/**
 * Chuẩn hoá payload `data` của một thông báo đẩy thành PushDeepLink.
 * Ưu tiên các field rời; nếu thiếu thì rơi về parse `data.url`.
 */
export function parsePushData(data: Record<string, any> | null | undefined): PushDeepLink {
  if (!data) return {};

  const fromUrl = typeof data.url === 'string' ? parsePushUrl(data.url) : {};

  // `sourceId` là mã/ID nguồn sinh ra thông báo. Với thông báo công việc nó
  // chính là mã công việc (subTaskCode) → dùng làm phương án cuối.
  const sourceIdAsTaskCode =
    data.sourceModule === 'tasks' || data.type === 'tasks' || data.type === 'approval'
      ? data.sourceId
      : undefined;

  return {
    taskId: data.taskId || fromUrl.taskId || undefined,
    taskCode: data.taskCode || fromUrl.taskCode || sourceIdAsTaskCode || undefined,
    conversationId: data.conversationId || fromUrl.conversationId || undefined,
    projectId: data.projectId || fromUrl.projectId || undefined,
    category: data.category || data.type || fromUrl.category || undefined,
  };
}

/**
 * Đọc deep link từ URL hiện tại của trình duyệt (trường hợp mở app từ đầu).
 *
 * Đọc CẢ pathname, không chỉ query string: service worker có SPA fallback nên
 * '/tasks/CV-1' (thông báo cũ) vẫn tải được app, và khi đó thanh địa chỉ giữ
 * nguyên đường dẫn cũ chứ không có query param nào.
 */
export function readDeepLinkFromLocation(): PushDeepLink {
  if (typeof window === 'undefined') return {};
  return parsePushUrl(window.location.pathname + window.location.search);
}

/**
 * Xoá các tham số deep link khỏi thanh địa chỉ sau khi đã điều hướng xong,
 * để F5 không mở lại modal cũ và để link chia sẻ không dính state lạ.
 */
export function clearDeepLinkFromLocation(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  let touched = false;

  for (const key of ['taskId', 'taskCode', 'conversation', 'conversationId', 'projectId', 'cat']) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      touched = true;
    }
  }

  // Đường dẫn cũ dạng '/tasks/<id>' cũng phải đưa về '/', nếu không F5 sẽ lại
  // phụ thuộc SPA fallback của service worker (và 404 nếu SW chưa kịp active).
  if (/^\/(tasks|projects|messages)\/[^/]+\/?$/.test(url.pathname)) {
    url.pathname = '/';
    touched = true;
  }

  if (touched) {
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
}
