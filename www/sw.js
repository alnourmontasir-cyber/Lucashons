/* عامل الخدمة: يخزّن ملفات التطبيق ليعمل بدون إنترنت. البحث بالاسم (nominatim) يبقى عبر الشبكة دائمًا. */
const CACHE = 'gbs-v6';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/luxe.css',
  'js/shim.js', 'js/geo.js', 'js/store.js', 'js/gps-tool.js', 'js/trips.js', 'js/map.js', 'js/ext.js', 'js/luxe.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).then(() => c.add('fonts/fonts.css').catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && !k.startsWith('gbs-tiles')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  /* بلاطات الخريطة: تديرها الخريطة نفسها في مخزن مستقل (gbs-tiles-v1) — لا يتدخل عامل الخدمة */
  /* الخطوط من Google: تُخزَّن بعد أول تحميل لتعمل بدون إنترنت */
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  /* [إصلاح الشاشة السوداء] كان «الشبكة أولًا» بلا مهلة: مع إنترنت ضعيف تبقى الصفحة فارغة حتى يفشل الطلب.
     الآن: النسخة المخزّنة فورًا، والتحديث من الشبكة في الخلفية (يظهر في الفتح التالي).
     أول تشغيل (لا نسخة مخزّنة): الشبكة مع مهلة 8 ثوانٍ */
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => {
    const net = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { net.catch(() => {}); return hit; }
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
    return Promise.race([net, timeout]).catch(() => (e.request.mode === 'navigate' ? c.match('index.html') : Promise.resolve(null)).then(r => r || Response.error()));
  })));
});
