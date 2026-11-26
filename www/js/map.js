/* ================= الخريطة دون اتصال =================
   خريطة بلاطات مكتوبة يدويًا على Canvas (بدون مكتبات خارجية) حتى تعمل داخل التطبيق دون إنترنت.
   - كل بلاطة تُعرض تُحفظ في ذاكرة التطبيق (Cache API) وتظهر لاحقًا دون إنترنت.
   - التنزيل المسبق لمنطقة كاملة متاح فقط لمصدر مخصّص يسمح بذلك: سياسة OpenStreetMap و OpenTopoMap تمنع التنزيل الجماعي.
   - الخريطة ليست شرطًا للبوصلة أو GPS: لو لم تتوفر بلاطات تبقى الشبكة والمسار والوجهات وموقعك مرسومة.
   ===================================================== */
(function () {
    'use strict';
    var F = window.FUN, esc = function (s) { return F.esc(s); };
    var KEY = 'gbs.map', CACHE = 'gbs-tiles-v1';
    var SRC = {
        osm: { name: 'طرق — OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© مساهمو OpenStreetMap', bulk: false },
        topo: { name: 'تضاريس — OpenTopoMap', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', max: 17, attr: '© OpenStreetMap · SRTM · OpenTopoMap (CC-BY-SA)', bulk: false },
        custom: { name: 'مصدر مخصّص', url: '', max: 19, attr: 'مصدر مخصّص', bulk: true },
        none: { name: 'بدون خلفية (شبكة إحداثيات فقط)', url: '', max: 20, attr: '', bulk: false }
    };
    var cfg = load();
    function load() {
        var d = { src: 'osm', custom: '', lat: null, lng: null, z: 13, up: 'north', follow: true };
        try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (o && typeof o === 'object') Object.assign(d, o); } catch (e) { }
        if (!SRC[d.src]) d.src = 'osm';
        return d;
    }
    function saveCfg() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { } }
    function src() { var s = SRC[cfg.src]; if (cfg.src === 'custom') s = Object.assign({}, s, { url: cfg.custom || '' }); return s; }
    function fin(x) { return typeof x === 'number' && isFinite(x); }
    function api() { return window.GBS_API; }

    /* ---------- إسقاط مركاتور ---------- */
    var TS = 256;
    function wx(lng, z) { return (lng + 180) / 360 * TS * Math.pow(2, z); }
    function wy(lat, z) { var s = Math.sin(Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TS * Math.pow(2, z); }
    function lngOf(x, z) { return x / (TS * Math.pow(2, z)) * 360 - 180; }
    function latOf(y, z) { var n = Math.PI - 2 * Math.PI * y / (TS * Math.pow(2, z)); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }
    function mpp(lat, z) { return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z); }

    /* ---------- البلاطات: ذاكرة + Cache API ---------- */
    var mem = new Map(), MEMMAX = 220, inflight = 0, queue = [], cacheP = null, cacheOk = !!window.caches;
    function cache() { if (!cacheOk) return Promise.reject(new Error('no cache')); return cacheP || (cacheP = caches.open(CACHE)); }
    function tileURL(s, z, x, y) {
        if (!s.url) return '';
        var sub = s.sub ? s.sub[(x + y) % s.sub.length] : 'a';
        return s.url.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', sub).replace('{r}', '');
    }
    function memPut(k, v) { mem.delete(k); mem.set(k, v); while (mem.size > MEMMAX) { var f = mem.keys().next().value, o = mem.get(f); if (o && o.img && o.img.close) try { o.img.close(); } catch (e) { } mem.delete(f); } }
    function toImg(blob) {
        if (window.createImageBitmap) return createImageBitmap(blob);
        return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = URL.createObjectURL(blob); });
    }
    function getTile(z, x, y) {
        var s = src(), u = tileURL(s, z, x, y);
        if (!u) return null;
        var k = cfg.src + '/' + z + '/' + x + '/' + y, t = mem.get(k);
        if (t) { if (t.st === 'miss' && navigator.onLine && Date.now() - t.at > 15000) { mem.delete(k); } else return t; }
        t = { st: 'load', at: Date.now() };
        memPut(k, t);
        queue.push(function () { return fetchTile(u, t); });
        pump();
        return t;
    }
    function pump() {
        while (inflight < 6 && queue.length) {
            var job = queue.pop(); /* الأحدث أولًا: ما يراه المستخدم الآن */
            inflight++;
            job().catch(function () { }).then(function () { inflight--; redraw(); pump(); });
        }
        if (queue.length > 200) queue.splice(0, queue.length - 200);
    }
    function fetchTile(u, t) {
        return cache().then(function (c) {
            return c.match(u).then(function (hit) {
                if (hit) return hit.blob().then(toImg).then(function (im) { t.img = im; t.st = 'ok'; t.cached = true; });
                if (!navigator.onLine) { t.st = 'miss'; return; }
                return fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) {
                    if (!r.ok) { t.st = r.status === 404 ? 'none' : 'err'; return; }
                    var cp = r.clone();
                    return c.put(u, cp).catch(function () { }).then(function () { return r.blob(); }).then(toImg).then(function (im) { t.img = im; t.st = 'ok'; t.cached = true; });
                }).catch(function () { t.st = 'miss'; t.at = Date.now(); });
            });
        }).catch(function () {
            /* بدون Cache API (أو CORS مرفوض): عرض مباشر دون حفظ */
            return new Promise(function (res) {
                if (!navigator.onLine) { t.st = 'miss'; return res(); }
                var i = new Image(); i.crossOrigin = 'anonymous';
                i.onload = function () { t.img = i; t.st = 'ok'; t.cached = false; res(); };
                i.onerror = function () { t.st = 'miss'; t.at = Date.now(); res(); };
                i.src = u;
            });
        });
    }

    /* ---------- الحالة والرسم ---------- */
    var host = null, cv = null, ctx = null, dpr = 1, W = 0, H = 0, raf = 0, rotTimer = 0;
    var focusTrip = null, pendingFocus = null, hatch = null;
    function redraw() { if (!raf && cv && cv.isConnected) raf = requestAnimationFrame(function () { raf = 0; drawMap(); }); }
    function rot() {
        if (cfg.up !== 'head') return 0;
        var L = api() && api().live(), h = L && L.heading;
        return h ? h.h * Math.PI / 180 : 0;
    }
    function resize() {
        if (!cv) return;
        var r = cv.parentNode.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        redraw();
    }
    function center() {
        var L = api() && api().live();
        if (cfg.follow && L && L.fix) { cfg.lat = L.fix.lat; cfg.lng = L.fix.lng; }
        if (!fin(cfg.lat)) {
            if (L && L.fix) { cfg.lat = L.fix.lat; cfg.lng = L.fix.lng; }
            else { var D = api() && api().db(), d = D && D.dests[0]; if (d) { cfg.lat = d.lat; cfg.lng = d.lng; } else { cfg.lat = 15.5007; cfg.lng = 32.5599; cfg.z = 6; } }
        }
        return { lat: cfg.lat, lng: cfg.lng };
    }
    function hatchPat() {
        if (hatch) return hatch;
        var c = document.createElement('canvas'); c.width = c.height = 16;
        var g = c.getContext('2d'); g.fillStyle = '#0b1120'; g.fillRect(0, 0, 16, 16);
        g.strokeStyle = 'rgba(242,183,5,.13)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 16); g.lineTo(16, 0); g.stroke();
        hatch = ctx.createPattern(c, 'repeat');
        return hatch;
    }
    function drawMap() {
        if (!ctx || !cv.isConnected) return;
        var c = center(), z = cfg.z, zi = Math.floor(z), sc = Math.pow(2, z - zi), r = rot();
        var cx = wx(c.lng, zi), cy = wy(c.lat, zi);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(W / 2, H / 2); ctx.rotate(-r); ctx.scale(sc, sc);
        var s = src(), rad = Math.sqrt(W * W + H * H) / 2 / sc, n = Math.pow(2, zi);
        var x0 = Math.floor((cx - rad) / TS), x1 = Math.floor((cx + rad) / TS), y0 = Math.max(0, Math.floor((cy - rad) / TS)), y1 = Math.min(n - 1, Math.floor((cy + rad) / TS));
        var missing = 0, shown = 0;
        for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
            var X = ((tx % n) + n) % n, px = tx * TS - cx, py = ty * TS - cy;
            var t = s.url ? getTile(zi, X, ty) : null;
            if (t && t.st === 'ok') { ctx.drawImage(t.img, px, py, TS + 0.5, TS + 0.5); shown++; continue; }
            /* بديل مؤقت: البلاطة الأم مكبّرة إن كانت في الذاكرة */
            var drawn = false;
            for (var up = 1; up <= 4 && zi - up >= 0 && s.url; up++) {
                var f = Math.pow(2, up), pt = mem.get(cfg.src + '/' + (zi - up) + '/' + Math.floor(X / f) + '/' + Math.floor(ty / f));
                if (pt && pt.st === 'ok') {
                    var sx = (X % f) * TS / f, sy = (ty % f) * TS / f;
                    ctx.drawImage(pt.img, sx, sy, TS / f, TS / f, px, py, TS + 0.5, TS + 0.5); drawn = true; break;
                }
            }
            if (!drawn) {
                ctx.fillStyle = (t && (t.st === 'miss' || t.st === 'err')) || !s.url ? hatchPat() : '#0d1424';
                ctx.fillRect(px, py, TS, TS);
                if (t && (t.st === 'miss' || t.st === 'err')) missing++;
            }
        }
        if (!s.url) drawGrid(cx, cy, zi, rad);
        var P = function (la, lo) { return [wx(lo, zi) - cx, wy(la, zi) - cy]; };
        var k = 1 / sc;
        /* رحلة من السجل */
        if (focusTrip && focusTrip.pts) line(focusTrip.pts, P, '#52c7ff', 4 * k);
        /* الرحلة الجارية */
        var T = window.GBS_TRIPS, cur = T && T.current();
        if (cur && cur.pts.length) line(cur.pts, P, '#ffcc33', 4.5 * k);
        /* الوجهات */
        var A = api(), L = A && A.live(), D = A && A.db();
        var sp = T && T.startPt(focusTrip || null);
        if (sp) flag(P(sp[0], sp[1]), k, r, !(D && D.dests.some(function (d) { return d.id === 'gbs-start' && Math.abs(d.lat - sp[0]) < 1e-5 && Math.abs(d.lng - sp[1]) < 1e-5; })));
        if (D) D.dests.forEach(function (d) { if (fin(d.lat) && fin(d.lng)) pin(P(d.lat, d.lng), d, d.id === D.sel, k, r); });
        /* خط مستقيم إلى الوجهة المحددة */
        if (L && L.fix && L.sel) {
            var a = P(L.fix.lat, L.fix.lng), b = P(L.sel.lat, L.sel.lng);
            ctx.save(); ctx.setLineDash([10 * k, 8 * k]); ctx.strokeStyle = 'rgba(255,216,74,.85)'; ctx.lineWidth = 2.5 * k;
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.restore();
        }
        /* موقعك */
        if (L && L.fix) {
            var u = P(L.fix.lat, L.fix.lng), ar = L.fix.acc / mpp(L.fix.lat, zi);
            ctx.fillStyle = L.stale ? 'rgba(152,163,187,.15)' : 'rgba(82,199,255,.16)'; ctx.strokeStyle = L.stale ? 'rgba(152,163,187,.5)' : 'rgba(82,199,255,.55)'; ctx.lineWidth = 1.5 * k;
            ctx.beginPath(); ctx.arc(u[0], u[1], Math.max(ar, 0), 0, 7); ctx.fill(); ctx.stroke();
            if (L.heading && !L.stale) {
                ctx.save(); ctx.translate(u[0], u[1]); ctx.rotate(L.heading.h * Math.PI / 180); ctx.scale(k, k);
                var gr = ctx.createLinearGradient(0, 0, 0, -46); gr.addColorStop(0, 'rgba(82,199,255,.55)'); gr.addColorStop(1, 'rgba(82,199,255,0)');
                ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 46, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42); ctx.closePath(); ctx.fill(); ctx.restore();
            }
            ctx.save(); ctx.translate(u[0], u[1]); ctx.scale(k, k);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
            ctx.fillStyle = L.stale ? '#98a3bb' : '#1e9bff'; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, 7); ctx.fill(); ctx.restore();
        }
        ctx.restore();
        hud(c, zi, missing, shown, L);
    }
    function line(pts, P, color, w) {
        ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = w + 3 * w / 4.5; ctx.lineJoin = ctx.lineCap = 'round';
        var pass = function () { var seg = null; ctx.beginPath(); for (var i = 0; i < pts.length; i++) { var q = P(pts[i][0], pts[i][1]); if (pts[i][6] !== seg) { ctx.moveTo(q[0], q[1]); seg = pts[i][6]; } else ctx.lineTo(q[0], q[1]); } ctx.stroke(); };
        pass(); ctx.strokeStyle = color; ctx.lineWidth = w; pass(); ctx.restore();
    }
    function upright(p, k, r, fn) { ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(r); ctx.scale(k, k); fn(); ctx.restore(); }
    function flag(p, k, r, label) {
        upright(p, k, r, function () {
            ctx.fillStyle = '#2bd47d'; ctx.strokeStyle = '#04140b'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.stroke();
            if (!label) return;
            ctx.font = '900 12px Tajawal, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
            ctx.strokeText('البداية', 0, -14); ctx.fillText('البداية', 0, -14);
        });
    }
    function pin(p, d, sel, k, r) {
        upright(p, k, r, function () {
            ctx.fillStyle = sel ? '#ffcc33' : '#ff6b5b'; ctx.strokeStyle = '#1f1500'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-10, -12, -10, -24, 0, -26); ctx.bezierCurveTo(10, -24, 10, -12, 0, 0); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#1f1500'; ctx.beginPath(); ctx.arc(0, -17, 3.5, 0, 7); ctx.fill();
            ctx.font = '800 12.5px Tajawal, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3.2;
            var nm = String(d.name || '').slice(0, 24); ctx.strokeText(nm, 0, -31); ctx.fillText(nm, 0, -31);
        });
    }
    function drawGrid(cx, cy, zi, rad) {
        /* شبكة خطوط طول وعرض بخطوة مناسبة للتكبير */
        var steps = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
        var m = mpp(latOf(cy, zi), zi), want = m * 140 / 111320, st = steps.find(function (s) { return s <= want; }) || 0.001;
        var la0 = latOf(cy + rad, zi), la1 = latOf(cy - rad, zi), lo0 = lngOf(cx - rad, zi), lo1 = lngOf(cx + rad, zi);
        ctx.strokeStyle = 'rgba(242,183,5,.18)'; ctx.lineWidth = 1; ctx.beginPath();
        for (var lo = Math.ceil(lo0 / st) * st; lo <= lo1; lo += st) { var x = wx(lo, zi) - cx; ctx.moveTo(x, -rad); ctx.lineTo(x, rad); }
        for (var la = Math.ceil(la0 / st) * st; la <= la1; la += st) { var y = wy(la, zi) - cy; ctx.moveTo(-rad, y); ctx.lineTo(rad, y); }
        ctx.stroke();
    }
    function hud(c, zi, missing, shown, L) {
        var set = function (id, v) { var el = host && host.querySelector('#' + id); if (el && el.textContent !== v) el.textContent = v; };
        set('mpZ', 'تكبير ' + cfg.z.toFixed(cfg.z % 1 ? 1 : 0));
        set('mpC', c.lat.toFixed(5) + ', ' + c.lng.toFixed(5));
        var m = mpp(c.lat, cfg.z), lens = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000], tgt = m * 90;
        var sl = lens.find(function (x) { return x >= tgt; }) || 500000, bar = host && host.querySelector('#mpScale');
        if (bar) { bar.style.width = Math.round(sl / m) + 'px'; bar.setAttribute('data-l', sl >= 1000 ? (sl / 1000) + ' كم' : sl + ' م'); }
        var s = src(), msg = '';
        if (!s.url) msg = 'بدون خلفية: الشبكة والمسار والوجهات فقط';
        else if (missing) msg = (navigator.onLine ? 'تعذّر تحميل بعض البلاطات' : 'دون اتصال') + ' — المناطق المخطّطة غير منزّلة';
        else if (!navigator.onLine) msg = 'دون اتصال — تُعرض البلاطات المحفوظة فقط';
        set('mpMsg', msg);
        var mm = host && host.querySelector('#mpMsg'); if (mm) mm.hidden = !msg;
        var fb = host && host.querySelector('[data-m="follow"]'); if (fb) fb.classList.toggle('on', !!cfg.follow);
        var ub = host && host.querySelector('[data-m="up"]'); if (ub) { ub.classList.toggle('on', cfg.up === 'head'); ub.textContent = cfg.up === 'head' ? '⬆ الاتجاه' : 'N شمال'; }
        var ni = host && host.querySelector('#mpNorth'); if (ni) ni.style.transform = 'rotate(' + (-rot() * 180 / Math.PI) + 'deg)';
        if (L && L.sel && L.fix) {
            var g = GEO.geodesic(L.fix.lat, L.fix.lng, L.sel.lat, L.sel.lng);
            set('mpDest', (L.sel.emoji || '📍') + ' ' + L.sel.name + ' · ' + api().fmtD(g.m) + ' · ' + Math.round(g.brg) % 360 + '° (خط مستقيم — ليس طريقًا)');
        } else set('mpDest', '');
        var de = host && host.querySelector('#mpDest'); if (de) de.hidden = !(L && L.sel && L.fix);
    }

    /* ---------- التفاعل: سحب / تكبير بإصبعين / عجلة ---------- */
    var ptrs = new Map(), pinch = null, lastTap = 0;
    function panBy(dx, dy) {
        var r = rot(), cs = Math.cos(r), sn = Math.sin(r);
        var rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
        var zi = Math.floor(cfg.z), sc = Math.pow(2, cfg.z - zi), c = center();
        var x = wx(c.lng, zi) - rx / sc, y = wy(c.lat, zi) - ry / sc;
        cfg.lat = latOf(y, zi); cfg.lng = ((lngOf(x, zi) + 540) % 360) - 180;
        if (cfg.follow) { cfg.follow = false; }
        redraw();
    }
    function zoomTo(z) { cfg.z = Math.max(2, Math.min(src().max || 19, Math.round(z * 10) / 10)); saveCfg(); redraw(); }
    function bindCanvas() {
        cv.addEventListener('pointerdown', function (e) {
            cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (ptrs.size === 2) { var a = Array.from(ptrs.values()); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), z: cfg.z }; }
            if (ptrs.size === 1) { var t = Date.now(); if (t - lastTap < 300) zoomTo(cfg.z + 1); lastTap = t; }
        });
        cv.addEventListener('pointermove', function (e) {
            var p = ptrs.get(e.pointerId); if (!p) return;
            if (ptrs.size === 1) { panBy(e.clientX - p.x, e.clientY - p.y); }
            p.x = e.clientX; p.y = e.clientY;
            if (ptrs.size === 2 && pinch) { var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pinch.d > 10) zoomTo(pinch.z + Math.log2(d / pinch.d)); }
        });
        var up = function (e) { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; saveCfg(); };
        cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        cv.addEventListener('wheel', function (e) { e.preventDefault(); zoomTo(cfg.z - Math.sign(e.deltaY) * 0.5); }, { passive: false });
    }

    /* ---------- التنزيل المسبق (للمصدر المخصّص فقط) ---------- */
    var dl = null;
    function viewTiles(zmax) {
        var c = center(), out = [], zi0 = Math.floor(cfg.z);
        var halfW = W / 2 / Math.pow(2, cfg.z - zi0), halfH = H / 2 / Math.pow(2, cfg.z - zi0);
        var la0 = latOf(wy(c.lat, zi0) + halfH, zi0), la1 = latOf(wy(c.lat, zi0) - halfH, zi0), lo0 = lngOf(wx(c.lng, zi0) - halfW, zi0), lo1 = lngOf(wx(c.lng, zi0) + halfW, zi0);
        for (var z = Math.max(2, zi0 - 2); z <= zmax; z++) {
            var xa = Math.floor(wx(lo0, z) / TS), xb = Math.floor(wx(lo1, z) / TS), ya = Math.floor(wy(la1, z) / TS), yb = Math.floor(wy(la0, z) / TS);
            for (var x = xa; x <= xb; x++) for (var y = ya; y <= yb; y++) out.push([z, x, y]);
        }
        return out;
    }
    function startDownload() {
        var s = src();
        if (!s.bulk || !s.url) {
            sheet('تنزيل منطقة', '<p>سياسة <b>' + esc(s.name) + '</b> لا تسمح بالتنزيل الجماعي المسبق للبلاطات، لذلك لا يقوم التطبيق به.</p>'
                + '<p>المتاح: كل منطقة تتصفّحها على الخريطة وأنت متصل تُحفظ تلقائيًا وتعمل لاحقًا دون إنترنت. قبل السفر تصفّح مسارك على مستويات التكبير التي تحتاجها.</p>'
                + '<p>لتنزيل مناطق كاملة: اختر «مصدر مخصّص» من الطبقات وأدخل رابط مزوّد بلاطات تملك حق استخدامه دون اتصال (مثل خادمك الخاص أو اشتراك يسمح بذلك).</p>');
            return;
        }
        if (!cacheOk) { toast('هذا الجهاز لا يدعم حفظ البلاطات'); return; }
        var zmax = Math.min(s.max, Math.floor(cfg.z) + 3), list = viewTiles(zmax);
        while (list.length > 4000 && zmax > Math.floor(cfg.z)) { zmax--; list = viewTiles(zmax); }
        if (list.length > 4000) { toast('المنطقة كبيرة جدًا — قرّب الخريطة أكثر'); return; }
        showConfirm('تنزيل المنطقة الظاهرة', 'سيُنزَّل ' + list.length + ' بلاطة (تكبير ' + Math.max(2, Math.floor(cfg.z) - 2) + '–' + zmax + '). تأكد أن مزوّد البلاطات يسمح بذلك. متابعة؟', function () {
            dl = { total: list.length, done: 0, fail: 0, stop: false };
            var i = 0;
            cache().then(function (c) {
                function next() {
                    if (dl.stop || i >= list.length) { var r = dl; dl = null; paintDl(); toast(r.stop ? 'أُوقف التنزيل' : 'اكتمل التنزيل: ' + (r.done - r.fail) + ' بلاطة' + (r.fail ? ' (فشل ' + r.fail + ')' : '')); return; }
                    var t = list[i++], u = tileURL(s, t[0], ((t[1] % Math.pow(2, t[0])) + Math.pow(2, t[0])) % Math.pow(2, t[0]), t[2]);
                    c.match(u).then(function (h) {
                        if (h) return;
                        return fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) { if (!r.ok) throw 0; return c.put(u, r); });
                    }).catch(function () { dl.fail++; }).then(function () { dl.done++; paintDl(); setTimeout(next, 60); });
                }
                next(); next();
            });
            paintDl();
        });
    }
    function paintDl() {
        var el = host && host.querySelector('#mpDl'); if (!el) return;
        el.hidden = !dl;
        if (dl) el.innerHTML = 'جارٍ التنزيل ' + dl.done + ' / ' + dl.total + ' <button type="button" data-m="dlstop">إيقاف</button>';
    }
    function sheet(title, html) {
        var t = document.getElementById('sheetTitle'), b = document.getElementById('sheetBody');
        t.textContent = title; b.innerHTML = html;
        document.getElementById('sheetBackdrop').classList.add('active');
        return b;
    }
    function layers() {
        var b = sheet('طبقة الخريطة', Object.keys(SRC).map(function (k) {
            return '<label class="lx-radio"><input type="radio" name="mpsrc" value="' + k + '"' + (cfg.src === k ? ' checked' : '') + '> ' + esc(SRC[k].name) + '</label>';
        }).join('') + '<div id="mpCust"' + (cfg.src === 'custom' ? '' : ' hidden') + '><input id="mpUrl" dir="ltr" placeholder="https://example.com/tiles/{z}/{x}/{y}.png" value="' + esc(cfg.custom || '') + '">'
            + '<p class="hint">يُحفظ الرابط على هاتفك فقط. لا تضع مفاتيح سرّية لا تملكها.</p></div>'
            + '<p class="hint">ملاحظة: بيانات الطرق والتضاريس في كثير من مناطق السودان والصحراء ناقصة أو غير موجودة. غياب طريق على الخريطة لا يعني عدم وجوده، ووجوده لا يعني أنه صالح.</p>'
            + '<div class="row"><button type="button" class="btn btn-ghost" id="mpClear">مسح البلاطات المحفوظة</button></div><p class="hint" id="mpCnt"></p>');
        b.addEventListener('change', function (e) {
            if (e.target.name === 'mpsrc') { cfg.src = e.target.value; b.querySelector('#mpCust').hidden = cfg.src !== 'custom'; mem.clear(); saveCfg(); redraw(); }
        });
        b.querySelector('#mpUrl').addEventListener('change', function () {
            var v = this.value.trim();
            if (v && !/^https:\/\/.+\{z\}.+\{x\}.+\{y\}/.test(v)) { toast('الرابط يجب أن يبدأ بـ https ويحتوي {z} و {x} و {y}'); return; }
            cfg.custom = v; mem.clear(); saveCfg(); redraw();
        });
        b.querySelector('#mpClear').addEventListener('click', function () {
            showConfirm('مسح البلاطات', 'حذف كل بلاطات الخريطة المحفوظة على الهاتف؟', function () { if (window.caches) caches.delete(CACHE).then(function () { cacheP = null; mem.clear(); count(); redraw(); toast('تم المسح'); }); });
        });
        count();
        function count() { tileCount().then(function (n) { var el = b.querySelector('#mpCnt'); if (el) el.textContent = n == null ? '' : 'البلاطات المحفوظة على الهاتف: ' + n; }); }
    }
    function tileCount() { if (!cacheOk) return Promise.resolve(null); return cache().then(function (c) { return c.keys(); }).then(function (k) { return k.length; }).catch(function () { return null; }); }
    function saveCenter() {
        var c = center(), A = api();
        var nm = prompt('اسم الوجهة (مركز الخريطة)\n' + c.lat.toFixed(6) + ', ' + c.lng.toFixed(6), 'نقطة من الخريطة');
        if (!nm || !nm.trim()) return;
        A.upsertDest({ name: nm.trim().slice(0, 60), emoji: '📍', lat: c.lat, lng: c.lng });
        toast('حُفظت في الوجهات'); redraw();
    }
    function fitTrip(t) {
        if (!t || !t.pts.length) return;
        var la0 = 90, la1 = -90, lo0 = 180, lo1 = -180;
        t.pts.forEach(function (p) { la0 = Math.min(la0, p[0]); la1 = Math.max(la1, p[0]); lo0 = Math.min(lo0, p[1]); lo1 = Math.max(lo1, p[1]); });
        cfg.lat = (la0 + la1) / 2; cfg.lng = (lo0 + lo1) / 2; cfg.follow = false;
        var z = 18; while (z > 3 && ((wx(lo1, z) - wx(lo0, z)) > W * 0.8 || (wy(la0, z) - wy(la1, z)) > H * 0.8)) z--;
        cfg.z = Math.min(z, src().max || 19);
        saveCfg(); redraw();
    }

    window.GBS_MAP = {
        render: function (body) {
            host = document.createElement('div');
            host.className = 'lx-map';
            host.innerHTML = '<div class="lx-mapwrap"><canvas aria-label="الخريطة"></canvas>'
                + '<div class="lx-mtop"><span id="mpZ"></span><span id="mpC" dir="ltr"></span></div>'
                + '<div class="lx-mdest" id="mpDest" hidden></div>'
                + '<div class="lx-mside">'
                + '<button type="button" data-m="zin" aria-label="تكبير">+</button><button type="button" data-m="zout" aria-label="تصغير">−</button>'
                + '<button type="button" data-m="follow" aria-label="تتبّع موقعي">◎</button>'
                + '<button type="button" data-m="up" class="lx-wide"></button>'
                + '</div>'
                + '<i id="mpNorth" class="lx-north">N</i>'
                + '<div class="lx-mbot"><span id="mpScale" class="lx-scale"></span><span id="mpMsg" hidden></span></div>'
                + '<div id="mpDl" class="lx-mdl" hidden></div></div>'
                + '<div class="lx-mbar">'
                + '<button type="button" data-m="layers">🗺 الطبقة</button><button type="button" data-m="save">📍 حفظ المركز كوجهة</button>'
                + '<button type="button" data-m="dl">⬇️ تنزيل المنطقة</button><button type="button" data-m="trip">〰 المسار</button>'
                + '</div>'
                + '<p class="lx-attr">' + esc(src().attr) + ' · الخط الأصفر المتقطع = اتجاه مباشر وليس طريقًا. الخريطة للمساعدة فقط؛ البوصلة والسهم يعملان دونها.</p>';
            body.appendChild(host);
            cv = host.querySelector('canvas'); ctx = cv.getContext('2d');
            bindCanvas();
            host.addEventListener('click', function (e) {
                var b = e.target.closest('[data-m]'); if (!b) return;
                switch (b.getAttribute('data-m')) {
                    case 'zin': zoomTo(cfg.z + 1); break;
                    case 'zout': zoomTo(cfg.z - 1); break;
                    case 'follow': cfg.follow = !cfg.follow; if (cfg.follow && cfg.z < 12) cfg.z = 15; saveCfg(); redraw(); break;
                    case 'up': cfg.up = cfg.up === 'head' ? 'north' : 'head'; saveCfg(); redraw(); break;
                    case 'layers': layers(); break;
                    case 'save': saveCenter(); break;
                    case 'dl': startDownload(); break;
                    case 'dlstop': if (dl) dl.stop = true; break;
                    case 'trip': {
                        var T = window.GBS_TRIPS, t = focusTrip || (T && (T.current() || T.list()[0]));
                        if (t && t.pts.length) { focusTrip = t === (T && T.current()) ? null : t; fitTrip(t); } else toast('لا يوجد مسار مسجّل لعرضه');
                        break;
                    }
                }
            });
            resize();
            window.addEventListener('resize', resize);
            if (pendingFocus) {
                var pf = pendingFocus; pendingFocus = null;
                if (pf.k === 'live') { cfg.follow = true; if (cfg.z < 12) cfg.z = 15; }
                else if (pf.k === 'trip' && pf.t) { var T = window.GBS_TRIPS; focusTrip = (T && T.current() === pf.t) ? null : pf.t; setTimeout(function () { fitTrip(pf.t); }, 0); }
            }
            clearInterval(rotTimer);
            rotTimer = setInterval(function () { if (!cv || !cv.isConnected) { clearInterval(rotTimer); window.removeEventListener('resize', resize); return; } if (cfg.up === 'head') redraw(); }, 150);
            redraw();
        },
        update: function () { redraw(); },
        focus: function (k, t) { pendingFocus = { k: k, t: t }; },
        tileCount: tileCount,
        _proj: { wx: wx, wy: wy, latOf: latOf, lngOf: lngOf }
    };
    window.addEventListener('online', redraw);
    window.addEventListener('offline', redraw);
})();
