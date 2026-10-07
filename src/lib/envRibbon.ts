// NHÃN "MÔI TRƯỜNG THỬ NGHIỆM" — hiện ở góc màn hình khi build được đặt VITE_APP_ENV=dev (project Vercel dev), để không ai nhầm
// bản thử nghiệm (dữ liệu giả) với bản thật. Môi trường thật không đặt biến này nên không hiện gì.
// Gắn thẳng vào <body> (ngoài cây React) và không bắt chuột (pointer-events: none) nên không ảnh hưởng giao diện.
export function mountEnvRibbon(env: string | undefined = import.meta.env.VITE_APP_ENV as string | undefined, doc: Document = document): HTMLElement | null {
  if (env !== 'dev') return null;
  if (doc.getElementById('env_ribbon')) return doc.getElementById('env_ribbon');
  const el = doc.createElement('div');
  el.id = 'env_ribbon';
  el.textContent = 'THỬ NGHIỆM — dữ liệu giả';
  el.setAttribute('role', 'note');
  el.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483000;background:#f59e0b;color:#1f2937;font:700 11px/1 system-ui,sans-serif;'
    + 'padding:3px 8px;border-bottom-right-radius:6px;pointer-events:none;letter-spacing:.02em;';
  doc.body.appendChild(el);
  return el;
}
