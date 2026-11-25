/* عامل الخدمة: يخزّن ملفات التطبيق ليعمل بدون إنترنت. البحث بالاسم (nominatim) يبقى عبر الشبكة دائمًا. */
const CACHE = 'gbs-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/luxe.css',
  'js/shim.js', 'js/geo.js', 'js/gps-tool.js', 'js/luxe.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  /* الخطوط من Google: تُخزَّن بعد أول تحميل لتعمل بدون إنترنت */
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  /* الشبكة أولًا (لتصلك التحديثات)، ثم النسخة المخزّنة عند انقطاع الإنترنت */
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
