// YHCT 15 phút – service worker: chạy offline, ưu tiên bản mới khi có mạng,
// ảnh từ kho luong-y-pictures chỉ giữ tối đa GIOI_HAN_ANH ảnh gần nhất để không làm đầy máy.
const CACHE = "yhct15-v4";
const CACHE_ANH = "yhct15-anh";
const GIOI_HAN_ANH = 300;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(CORE).then(() => c.add("./anh-luoi.js").catch(() => {})))   // ảnh lưỡi: lưu sẵn nếu có, thiếu file vẫn cài được
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CACHE_ANH).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function catBotAnh() {
  const c = await caches.open(CACHE_ANH);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - GIOI_HAN_ANH; i++) await c.delete(keys[i]);   // xóa ảnh cũ nhất
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Trang app: lấy bản mới nhất, mất mạng thì dùng bản đã lưu.
  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }

  // Danh mục kho ảnh: lấy bản mới khi có mạng, lưu riêng (không bị xóa khi dọn ảnh).
  if (url.pathname.includes("/luong-y-pictures/") && url.pathname.endsWith(".json")) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req)));
    return;
  }

  // Ảnh từ kho ảnh: có sẵn thì dùng, chưa có thì tải rồi lưu, giữ tối đa 300 ảnh.
  if (url.pathname.includes("/luong-y-pictures/")) {
    e.respondWith(caches.open(CACHE_ANH).then(c => c.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.ok) { c.put(req, r.clone()).then(catBotAnh); }
      return r;
    }))));
    return;
  }

  // File tĩnh của app (anh-luoi.js, icon, phông chữ): dùng bản đã lưu, cập nhật ngầm.
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => hit);
    return hit || net;
  }));
});
