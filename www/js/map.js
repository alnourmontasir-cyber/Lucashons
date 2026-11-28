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
    /* طبقات MapTiler: بلاطات @2x (512 بكسل) مرسومة لشاشات الهواتف الدقيقة، وتحتاج مفتاحًا يُدخله المستخدم ويُحفظ على هاتفه فقط
       (لا يُكتب أي مفتاح في ملفات التطبيق). شروطهم: حفظ شخصي على الجهاز مسموح، والتنزيل الجماعي ممنوع → bulk:false */
    var MT_KEY = 'MrqN14UQN4hlsOYqcuZ6';
    var SRC = {
        mttopo: { name: 'تضاريس فائقة الدقة — MapTiler (خطوط كنتور وظلال وأسماء)', url: 'https://api.maptiler.com/maps/topo-v4/256/{z}/{x}/{y}@2x.png?key={key}', max: 20, hi: true, key: true, attr: '© MapTiler · © مساهمو OpenStreetMap', bulk: false },
        mthyb: { name: 'قمر صناعي فائق الدقة + أسماء — MapTiler', url: 'https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}@2x.jpg?key={key}', max: 20, hi: true, key: true, sat: true, attr: '© MapTiler · © مساهمو OpenStreetMap', bulk: false },
        mtstr: { name: 'شوارع وأسماء فائقة الوضوح — MapTiler', url: 'https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}@2x.png?key={key}', max: 20, hi: true, key: true, attr: '© MapTiler · © مساهمو OpenStreetMap', bulk: false },
        osm: { name: 'طرق — OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© مساهمو OpenStreetMap', bulk: false },
        /* صور أقمار Sentinel-2 الخالية من السحب (EOX): مجانية دون مفتاح للاستخدام غير التجاري، دقتها الفعلية 10 م للبكسل
           لذلك أقصى تكبير 15 (لا نعرض تفاصيل غير موجودة). img = صورة بلا نصوص، فتُجلب بمستوى أدق يناسب دقة الشاشة */
        sat: { name: 'قمر صناعي — Sentinel-2 (دقة 10 م)', url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg', max: 15, img: true, attr: 'EOxCloudless 2024 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024) · CC BY-NC-SA 4.0', bulk: false },
        topo: { name: 'تضاريس — OpenTopoMap', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', sub: 'abc', max: 17, attr: '© OpenStreetMap · SRTM · OpenTopoMap (CC-BY-SA)', bulk: false },
        custom: { name: 'مصدر مخصّص (يدعم {r} لبلاطات @2x)', url: '', max: 19, attr: 'مصدر مخصّص', bulk: true },
        none: { name: 'بدون خلفية (شبكة إحداثيات فقط)', url: '', max: 20, attr: '', bulk: false }
    };
    var cfg = load(); saveCfg();
    function load() {
        var d = { src: 'osm', custom: '', lat: null, lng: null, z: 13, up: 'north', follow: true, hd: false, mtkey: '' };
        var o = null;
        try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && typeof o === 'object') Object.assign(d, o); else o = null; } catch (e) { o = null; }
        /* مفتاح MapTiler المدمج بطلب صاحب التطبيق. أول تشغيل بعد التحديث: يُضبط المفتاح وتُختار طبقة القمر الصناعي + الأسماء.
           يمكن تغييره أو حذفه من زر «الطبقة» (القيمة المحفوظة على الهاتف لها الأولوية). */
        /* v2: تفتح الخريطة على «تضاريس فائقة الدقة» بأعلى دقة (مرة واحدة بعد التحديث؛ بعدها يُحترم اختيار المستخدم) */
        /* v3: تفتح على «قمر صناعي فائق الدقة + أسماء» بطلب صاحب التطبيق (مرة واحدة بعد التحديث؛ بعدها يُحترم اختيار المستخدم) */
        if (!o || !(o.v >= 3)) { if (!o || !('mtkey' in o)) d.mtkey = MT_KEY; d.src = 'mthyb'; d.hd = true; d.v = 3; }
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

    /* ---------- البلاطات: ذاكرة + Cache API ----------
       [الوضوح] أسباب التشويش السابقة وإصلاحها:
       1) التكبير الكسري (مثل 13.9) كان يرسم بلاطات المستوى 13 مكبّرة حتى ضعفين ← الآن يُختار أقرب مستوى بلاطات
          ويُثبَّت التكبير على رقم صحيح بعد كل إيماءة، فتُعرض البلاطة بحجمها الحقيقي.
       2) الرسم بإحداثيات كسرية كان يمرّر البلاطة بفلترة إضافية ← الآن تُرسم على حدود بكسلات الشاشة الفعلية (devicePixelRatio) بلا فواصل.
       3) شاشة الهاتف 2.5–3 أضعاف ← صور الأقمار (بلا نصوص) تُجلب بمستوى أدق بحسب دقة الشاشة، وخيار «فائقة» لبقية الطبقات،
          والمصدر المخصّص يدعم {r} → @2x.
       4) مربعات فارغة عند التحريك/التكبير ← بديل مؤقت من البلاطة الأم أو البلاطات الأبناء، ظهور تدريجي، تحميل الأقرب للمركز أولًا،
          وحلقة تحميل مسبق حول الشاشة. */
    var mem = new Map(), memPx = 0, PXMAX = 30e6, inflight = 0, queue = [], cacheP = null, cacheOk = !!window.caches, FR = 0, FADE = 150;
    function cache() { if (!cacheOk) return Promise.reject(new Error('no cache')); return cacheP || (cacheP = caches.open(CACHE)); }
    function retina(s) { return !!(s.hi || (s.url && s.url.indexOf('{r}') >= 0 && dpr >= 1.5)); }
    /* مفتاح الحفظ في ذاكرة الهاتف بدون المفتاح السرّي: البلاطات المحفوظة تبقى صالحة لو تغيّر المفتاح، ولا يُخزَّن المفتاح مع كل بلاطة */
    function ck(u) { return u.replace(/([?&]key=)[^&]*/, '$1_'); }
    var keyErr = 0;
    function tileURL(s, z, x, y, r2) {
        if (!s.url) return '';
        if (s.key && !cfg.mtkey) return '';
        var sub = s.sub ? s.sub[(x + y) % s.sub.length] : 'a';
        var r = r2 === undefined ? retina(s) : r2;
        return s.url.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{s}', sub).replace('{r}', r ? '@2x' : '').replace('{key}', encodeURIComponent(cfg.mtkey || ''));
    }
    /* مستوى البلاطات المناسب: أقرب مستوى صحيح؛ وصور الأقمار (أو خيار «فائقة») بمستوى أدق بحسب دقة الشاشة */
    function tileZ(s, z) {
        var boost = s.hi ? (cfg.hd ? Math.log2(Math.max(1, dpr / 2)) : 0) : (!retina(s) && (s.img || cfg.hd)) ? Math.log2(Math.max(1, dpr)) : 0;
        return Math.max(0, Math.min(s.max, Math.round(z + boost - 0.2)));
    }
    function release(t) { if (t.px) { memPx -= t.px; t.px = 0; } if (t.img && t.img.close) try { t.img.close(); } catch (e) { } t.img = null; }
    function evict() {
        if (memPx <= PXMAX && mem.size <= 700) return;
        var it = mem.keys(), k;
        while ((memPx > PXMAX || mem.size > 700) && !(k = it.next()).done) {
            var t = mem.get(k.value);
            if (t.seen >= FR - 1 || t.st === 'load') continue; /* لا نحذف ما يُرسم الآن */
            release(t); mem.delete(k.value);
        }
    }
    function setImg(t, im) { t.img = im; t.st = 'ok'; t.lt = performance.now(); t.px = (im.width || 256) * (im.height || 256); memPx += t.px; evict(); }
    function toImg(blob) {
        if (window.createImageBitmap) return createImageBitmap(blob);
        return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = URL.createObjectURL(blob); });
    }
    function peek(s, z, x, y) { var u = tileURL(s, z, x, y); return u ? mem.get(u) : null; }
    function getTile(s, z, x, y, pri, base) {
        var u = tileURL(s, z, x, y);
        if (!u) return null;
        var now = performance.now(), t = mem.get(u);
        if (t) {
            mem.delete(u); mem.set(u, t); /* الأحدث استعمالًا في آخر القائمة */
            if ((t.st === 'miss' || t.st === 'err') && navigator.onLine && Date.now() - t.at > 15000) { t.st = 'load'; queue.push({ u: u, t: t }); }
            t.seen = FR; t.pri = pri; t.want = now;
            if (t.st === 'load') pump();
            return t;
        }
        t = { st: 'load', at: Date.now(), seen: FR, pri: pri, want: now, z: z, x: x, y: y, base: !!base };
        mem.set(u, t);
        queue.push({ u: u, t: t });
        pump();
        return t;
    }
    function pump() {
        var now = performance.now();
        /* إسقاط ما لم يعد ظاهرًا (حرّكت الخريطة بعيدًا) حتى لا يتأخر ما تراه الآن */
        for (var i = queue.length - 1; i >= 0; i--) if (now - queue[i].t.want > 2500) { var q = queue[i]; queue.splice(i, 1); if (q.t.st === 'load') mem.delete(q.u); }
        while (inflight < 6 && queue.length) {
            var bi = 0;
            for (var j = 1; j < queue.length; j++) if (queue[j].t.pri < queue[bi].t.pri) bi = j; /* الأقرب لمركز الشاشة أولًا */
            var job = queue.splice(bi, 1)[0];
            inflight++;
            fetchTile(job.u, job.t).catch(function () { }).then(function () { inflight--; redraw(); pump(); });
        }
    }
    /* بديل دون اتصال: نفس البلاطة من طبقة أخرى محفوظة سابقًا (مثلًا مناطق تصفحتها على OpenStreetMap قبل تغيير الطبقة) */
    function altFromCache(c, t) {
        if (!t.base) return Promise.resolve(false);
        var cands = [];
        Object.keys(SRC).forEach(function (k) {
            if (k === cfg.src || k === 'none') return;
            var s = k === 'custom' ? Object.assign({}, SRC.custom, { url: cfg.custom || '' }) : SRC[k];
            if (!s.url || t.z > s.max) return;
            var a1 = s.key ? s.url.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y).replace('{key}', '_') : tileURL(s, t.z, t.x, t.y, false);
            cands.push(a1); if (s.url.indexOf('{r}') >= 0) cands.push(tileURL(s, t.z, t.x, t.y, true));
        });
        var i = 0;
        function next() {
            if (i >= cands.length) return Promise.resolve(false);
            return c.match(cands[i++]).then(function (h) { return h ? h.blob().then(toImg).then(function (im) { setImg(t, im); t.alt = true; return true; }) : next(); });
        }
        return next().catch(function () { return false; });
    }
    function fetchTile(u, t) {
        return cache().then(function (c) {
            return c.match(ck(u)).then(function (hit) {
                if (hit) return hit.blob().then(toImg).then(function (im) { setImg(t, im); t.cached = true; });
                var miss = function () { return altFromCache(c, t).then(function (ok) { if (!ok) { t.st = 'miss'; t.at = Date.now(); } }); };
                if (!navigator.onLine) return miss();
                return fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) {
                    if (!r.ok) { if (r.status === 404) { t.st = 'none'; return; } if ((r.status === 401 || r.status === 403 || r.status === 429) && src().key) keyErr = r.status; t.at = Date.now(); return altFromCache(c, t).then(function (ok) { if (!ok) t.st = 'err'; }); }
                    var cp = r.clone();
                    if (src().key) keyErr = 0;
                    return c.put(ck(u), cp).catch(function () { }).then(function () { return r.blob(); }).then(toImg).then(function (im) { setImg(t, im); t.cached = true; });
                }, miss);
            });
        }).catch(function () {
            /* بدون Cache API (أو CORS مرفوض): عرض مباشر دون حفظ */
            return new Promise(function (res) {
                if (!navigator.onLine) { t.st = 'miss'; t.at = Date.now(); return res(); }
                var i = new Image(); i.crossOrigin = 'anonymous';
                i.onload = function () { setImg(t, i); t.cached = false; res(); };
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
        dpr = Math.min(window.devicePixelRatio || 1, 4); /* الدقة الكاملة لشاشة الهاتف (كان الحد 2.5 فيُمدّ الرسم مرة أخرى على شاشات 3x) */
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
    /* رسم بلاطة (أو جزء منها) في مستطيل بإحداثيات عالم مستوى البلاطات نسبةً للمركز.
       دون تدوير: تُحوَّل الحواف إلى بكسلات الشاشة الحقيقية وتُقرَّب ← بلا فواصل ولا فلترة نصف بكسل. */
    var G = null;
    function put(img, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (!G.r) {
            var a = Math.round((W / 2 + dx * G.sc) * dpr), b = Math.round((H / 2 + dy * G.sc) * dpr),
                e = Math.round((W / 2 + (dx + dw) * G.sc) * dpr), f = Math.round((H / 2 + (dy + dh) * G.sc) * dpr);
            if (e > a && f > b) ctx.drawImage(img, sx, sy, sw, sh, a, b, e - a, f - b);
        } else ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw + 0.7 / G.sc, dh + 0.7 / G.sc);
    }
    function whole(t, dx, dy, dw, dh) { put(t.img, 0, 0, t.img.width, t.img.height, dx, dy, dw, dh); }
    function setLayerTransform() {
        if (!G.r) ctx.setTransform(1, 0, 0, 1, 0, 0);
        else { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.translate(W / 2, H / 2); ctx.rotate(-G.r); ctx.scale(G.sc, G.sc); }
        ctx.imageSmoothingEnabled = true; try { ctx.imageSmoothingQuality = 'high'; } catch (e) { }
    }
    /* بديل مؤقت حتى تصل البلاطة: الأم المكبّرة ثم ما توفر من الأبناء (عند التصغير) */
    function fallback(s, zt, X, ty, dx, dy, t) {
        var drew = false, prevNone = t && t.st === 'none';
        for (var up = 1; up <= 6 && zt - up >= 0; up++) {
            var f = Math.pow(2, up), px = Math.floor(X / f), py = Math.floor(ty / f), pt = peek(s, zt - up, px, py);
            if (!pt && prevNone) pt = getTile(s, zt - up, px, py, 0, true); /* المصدر لا يملك هذا المستوى هنا: نطلب الأم صراحة */
            if (pt && pt.st === 'ok') {
                var iw = pt.img.width / f, ih = pt.img.height / f;
                pt.seen = FR; put(pt.img, (X % f) * iw, (ty % f) * ih, iw, ih, dx, dy, TS, TS); drew = true; break;
            }
            prevNone = pt && pt.st === 'none';
        }
        if (zt + 1 <= s.max) for (var j = 0; j < 4; j++) {
            var ct = peek(s, zt + 1, X * 2 + (j & 1), ty * 2 + (j >> 1));
            if (ct && ct.st === 'ok') { ct.seen = FR; whole(ct, dx + (j & 1) * TS / 2, dy + (j >> 1) * TS / 2, TS / 2, TS / 2); drew = true; }
        }
        return drew;
    }
    function drawTiles(s, c, r, now) {
        var zt = tileZ(s, cfg.z), sc = Math.pow(2, cfg.z - zt), n = Math.pow(2, zt);
        var cx = wx(c.lng, zt), cy = wy(c.lat, zt);
        G = { r: r, sc: sc };
        setLayerTransform();
        var hw = (r ? Math.sqrt(W * W + H * H) / 2 : W / 2) / sc, hh = (r ? Math.sqrt(W * W + H * H) / 2 : H / 2) / sc;
        var x0 = Math.floor((cx - hw) / TS), x1 = Math.floor((cx + hw) / TS), y0 = Math.max(0, Math.floor((cy - hh) / TS)), y1 = Math.min(n - 1, Math.floor((cy + hh) / TS));
        var st = { missing: 0, shown: 0, alt: 0, fading: false, zt: zt };
        var ccx = cx / TS - 0.5, ccy = cy / TS - 0.5;
        for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
            var X = ((tx % n) + n) % n, dx = tx * TS - cx, dy = ty * TS - cy;
            var t = getTile(s, zt, X, ty, Math.hypot(tx - ccx, ty - ccy), true);
            var ok = t && t.st === 'ok', a = ok ? Math.min(1, (now - t.lt) / FADE) : 0;
            if (a < 1) {
                var drew = fallback(s, zt, X, ty, dx, dy, t);
                if (!drew && !ok) {
                    var bad = t && (t.st === 'miss' || t.st === 'err');
                    ctx.fillStyle = bad ? hatchPat() : '#0d1424';
                    if (!r) { ctx.save(); ctx.setTransform(dpr * sc, 0, 0, dpr * sc, (W / 2) * dpr, (H / 2) * dpr); ctx.fillRect(dx, dy, TS, TS); ctx.restore(); }
                    else ctx.fillRect(dx, dy, TS, TS);
                    if (bad) st.missing++;
                }
            }
            if (ok) {
                if (a < 1) { ctx.globalAlpha = a; st.fading = true; }
                whole(t, dx, dy, TS, TS); ctx.globalAlpha = 1; st.shown++;
                if (t.alt) st.alt++;
            }
        }
        /* حلقة تحميل مسبق ببلاطة واحدة حول الشاشة (أولوية أقل) حتى يكون التحريك سلسًا */
        if (queue.length < 6) for (var ry = y0 - 1; ry <= y1 + 1; ry++) for (var rx = x0 - 1; rx <= x1 + 1; rx++) {
            if (ry < 0 || ry >= n || (ry >= y0 && ry <= y1 && rx >= x0 && rx <= x1)) continue;
            getTile(s, zt, ((rx % n) + n) % n, ry, 50 + Math.hypot(rx - ccx, ry - ccy), true);
        }
        return st;
    }
    function drawMap() {
        if (!ctx || !cv.isConnected) return;
        FR++;
        var now = performance.now(), again = false;
        if (zAnim) {
            var p = Math.min(1, (now - zAnim.t0) / 200), e = 1 - Math.pow(1 - p, 3);
            cfg.z = zAnim.from + (zAnim.to - zAnim.from) * e;
            if (p < 1) again = true; else { cfg.z = zAnim.to; zAnim = null; saveCfg(); }
        }
        var s = src();
        if (cfg.z > (s.max || 19)) cfg.z = s.max || 19;
        var c = center(), z = cfg.z, zi = Math.floor(z), sc = Math.pow(2, z - zi), r = rot();
        var cx = wx(c.lng, zi), cy = wy(c.lat, zi);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#070a12'; ctx.fillRect(0, 0, cv.width, cv.height);
        var ts = s.url ? drawTiles(s, c, r, now) : { missing: 0, shown: 0, alt: 0, fading: false, zt: zi };
        if (ts.fading) again = true;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.save();
        ctx.translate(W / 2, H / 2); ctx.rotate(-r); ctx.scale(sc, sc);
        var rad = Math.sqrt(W * W + H * H) / 2 / sc, missing = ts.missing, shown = ts.shown;
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
        /* أداة القياس */
        if (meas && meas.pts.length) {
            var mq = meas.pts.map(function (q) { return P(q.lat, q.lng); });
            ctx.save(); ctx.lineJoin = ctx.lineCap = 'round';
            if (mq.length >= 3) { ctx.fillStyle = 'rgba(255,204,51,.14)'; ctx.beginPath(); mq.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); ctx.fill(); }
            ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 6 * k; ctx.beginPath(); mq.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
            ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 3 * k; ctx.setLineDash([10 * k, 6 * k]); ctx.stroke(); ctx.setLineDash([]);
            ctx.restore();
            mq.forEach(function (q, i) {
                upright(q, k, r, function () {
                    ctx.fillStyle = i === 0 ? '#2bd47d' : '#ffcc33'; ctx.strokeStyle = '#1f1500'; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill(); ctx.stroke();
                    if (i && i === mq.length - 1) {
                        var tx = fmtD(measLen());
                        ctx.font = '900 13px Tajawal, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineWidth = 3.5;
                        ctx.strokeText(tx, 0, -14); ctx.fillText(tx, 0, -14);
                    }
                });
            });
        }
        /* نقطة الضغط المطوّل / نتيجة البحث بالإحداثيات */
        if (lp) upright(P(lp.lat, lp.lng), k, r, function () {
            ctx.fillStyle = '#52c7ff'; ctx.strokeStyle = '#03131f'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-11, -13, -11, -26, 0, -28); ctx.bezierCurveTo(11, -26, 11, -13, 0, 0); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#03131f'; ctx.beginPath(); ctx.arc(0, -18, 4, 0, 7); ctx.fill();
        });
        ctx.restore();
        /* علامة وسط الخريطة (عند تحريكها يدويًا) */
        if (!cfg.follow) {
            ctx.save(); ctx.translate(W / 2, H / 2); ctx.lineCap = 'round';
            [['rgba(0,0,0,.75)', 4.5], ['#ffcc33', 2]].forEach(function (st) {
                ctx.strokeStyle = st[0]; ctx.lineWidth = st[1]; ctx.beginPath();
                ctx.moveTo(-17, 0); ctx.lineTo(-6, 0); ctx.moveTo(6, 0); ctx.lineTo(17, 0); ctx.moveTo(0, -17); ctx.lineTo(0, -6); ctx.moveTo(0, 6); ctx.lineTo(0, 17); ctx.stroke();
            });
            ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, 7); ctx.fill(); ctx.restore();
        }
        hud(c, zi, missing, shown, L, ts);
        if (again) redraw();
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
    function hud(c, zi, missing, shown, L, ts) {
        var set = function (id, v) { var el = host && host.querySelector('#' + id); if (el && el.textContent !== v) el.textContent = v; };
        var zr = Math.round(cfg.z * 10) / 10;
        set('mpZ', 'تكبير ' + zr.toFixed(zr % 1 ? 1 : 0) + (ts && src().url && ts.zt !== Math.round(cfg.z) ? ' · بلاطات ' + ts.zt + (ts.zt > Math.round(cfg.z) ? ' (أدق)' : ' (أقصى المتاح)') : ''));
        set('mpAttr', src().attr ? src().attr + ' · ' : '');
        set('mpC', c.lat.toFixed(5) + ', ' + c.lng.toFixed(5));
        var m = mpp(c.lat, cfg.z), lens = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000], tgt = m * 90;
        var sl = lens.find(function (x) { return x >= tgt; }) || 500000, bar = host && host.querySelector('#mpScale');
        if (bar) { bar.style.width = Math.round(sl / m) + 'px'; bar.setAttribute('data-l', sl >= 1000 ? (sl / 1000) + ' كم' : sl + ' م'); }
        var s = src(), msg = '';
        if (!s.url) msg = 'بدون خلفية: الشبكة والمسار والوجهات فقط';
        else if (src().key && !cfg.mtkey) msg = 'أدخل مفتاح MapTiler من زر «الطبقة» لعرض هذه الطبقة';
        else if (keyErr === 429 && src().key) msg = 'انتهى الحد المجاني لهذا الشهر في MapTiler — تُعرض البلاطات المحفوظة فقط';
        else if (keyErr && src().key) msg = 'MapTiler رفض المفتاح — تأكد منه في زر «الطبقة»';
        else if (missing) msg = (navigator.onLine ? 'تعذّر تحميل بعض البلاطات' : 'دون اتصال') + ' — المناطق المخطّطة غير منزّلة';
        else if (src().sat && cfg.z >= 18) msg = 'دقة صور الأقمار المتوفرة هنا حوالي 1–2 م: التكبير أكثر يُكبّر الصورة فقط ولا يضيف تفاصيل';
        else if (ts && ts.alt) msg = 'تُعرض بلاطات محفوظة من طبقة أخرى لهذه المنطقة';
        else if (!navigator.onLine) msg = 'دون اتصال — تُعرض البلاطات المحفوظة فقط';
        set('mpMsg', msg);
        toolsHud(c, L);
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
    var ptrs = new Map(), pinch = null, lastTap = 0, press = null, lpTimer = 0;
    function panBy(dx, dy) {
        var r = rot(), cs = Math.cos(r), sn = Math.sin(r);
        var rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
        var zi = Math.floor(cfg.z), sc = Math.pow(2, cfg.z - zi), c = center();
        var x = wx(c.lng, zi) - rx / sc, y = wy(c.lat, zi) - ry / sc;
        cfg.lat = latOf(y, zi); cfg.lng = ((lngOf(x, zi) + 540) % 360) - 180;
        if (cfg.follow) { cfg.follow = false; }
        redraw();
    }
    function clampZ(z) { return Math.max(2, Math.min(src().max || 19, z)); }
    var zAnim = null;
    /* أثناء القرص بإصبعين: تكبير حر. بعد انتهاء الإيماءة وبالأزرار: انتقال سلس إلى رقم صحيح حتى تُعرض البلاطات بحجمها الحقيقي (أوضح صورة) */
    function zoomTo(z) { zAnim = null; cfg.z = clampZ(z); redraw(); }
    function animZoom(to) { to = clampZ(Math.round(to)); if (Math.abs(to - cfg.z) < 0.01) { cfg.z = to; zAnim = null; saveCfg(); redraw(); return; } zAnim = { from: cfg.z, to: to, t0: performance.now() }; redraw(); }
    function bindCanvas() {
        cv.addEventListener('pointerdown', function (e) {
            try { cv.setPointerCapture(e.pointerId); } catch (er) { } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (ptrs.size === 2) { var a = Array.from(ptrs.values()); pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), z: cfg.z }; }
            if (ptrs.size === 1) {
                var t = Date.now(); if (!meas && t - lastTap < 300) animZoom(Math.round(cfg.z) + 1); lastTap = t;
                var rc = cv.getBoundingClientRect();
                press = { x: e.clientX, y: e.clientY, px: e.clientX - rc.left, py: e.clientY - rc.top, t: t, moved: false };
                clearTimeout(lpTimer);
                lpTimer = setTimeout(function () { if (press && !press.moved && ptrs.size === 1) { var q = ptLL(press.px, press.py); press = null; lp = q; redraw(); try { navigator.vibrate && navigator.vibrate(25); } catch (er) { } ptSheet(q, 'نقطة على الخريطة'); } }, 550);
            } else { clearTimeout(lpTimer); press = null; }
        });
        cv.addEventListener('pointermove', function (e) {
            var p = ptrs.get(e.pointerId); if (!p) return;
            if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 9) { press.moved = true; clearTimeout(lpTimer); }
            if (press && !press.moved) return; /* لا تحريك قبل تجاوز 9 بكسل: الضغطة تبقى ضغطة */
            if (ptrs.size === 1) { panBy(e.clientX - p.x, e.clientY - p.y); }
            p.x = e.clientX; p.y = e.clientY;
            if (ptrs.size === 2 && pinch) { var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pinch.d > 10) zoomTo(pinch.z + Math.log2(d / pinch.d)); }
        });
        var up = function (e) {
            clearTimeout(lpTimer);
            if (press && !press.moved && e.type === 'pointerup' && ptrs.size === 1 && Date.now() - press.t < 450) {
                if (meas) { meas.pts.push(ptLL(press.px, press.py)); redraw(); }
                else if (lp) { lp = null; redraw(); }
            }
            press = null;
            ptrs.delete(e.pointerId); if (ptrs.size < 2 && pinch) { pinch = null; animZoom(cfg.z); } saveCfg(); };
        cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
        cv.addEventListener('wheel', function (e) { e.preventDefault(); animZoom(Math.round(cfg.z) - Math.sign(e.deltaY)); }, { passive: false });
    }

    /* ---------- أدوات الخريطة: الوسط، الضغط المطوّل، القياس، البحث بالإحداثيات، فحص الحفظ ---------- */
    var meas = null, lp = null;
    function G2(a, b) { return GEO.geodesic(a.lat, a.lng, b.lat, b.lng); }
    function fmtD(m) { var A = api(); return A ? A.fmtD(m) : Math.round(m) + ' م'; }
    function dirL(b) { var A = api(); return A ? A.dirLbl(b) : ''; }
    function fmtC(p) { var A = api(); return A && A.fmtCoord ? A.fmtCoord(p.lat, true) + ', ' + A.fmtCoord(p.lng, false) : p.lat.toFixed(6) + ', ' + p.lng.toFixed(6); }
    /* نقطة على الشاشة (بكسل CSS داخل الخريطة) ← خط عرض/طول، مع مراعاة التدوير */
    function ptLL(px, py) {
        var r = rot(), cs = Math.cos(r), sn = Math.sin(r), dx = px - W / 2, dy = py - H / 2;
        var rx = dx * cs - dy * sn, ry = dx * sn + dy * cs;
        var zi = Math.floor(cfg.z), sc = Math.pow(2, cfg.z - zi), c = center();
        return { lat: latOf(wy(c.lat, zi) + ry / sc, zi), lng: ((lngOf(wx(c.lng, zi) + rx / sc, zi) + 540) % 360) - 180 };
    }
    function measLen() { var m = 0; if (meas) for (var i = 1; i < meas.pts.length; i++) m += G2(meas.pts[i - 1], meas.pts[i]).m; return m; }
    function measArea() {
        if (!meas || meas.pts.length < 3) return 0;
        var R = 6371008.8, la0 = meas.pts[0].lat * Math.PI / 180, lo0 = meas.pts[0].lng, a = 0;
        var xy = meas.pts.map(function (q) { return [R * ((((q.lng - lo0) + 540) % 360) - 180) * Math.PI / 180 * Math.cos(la0), R * (q.lat - meas.pts[0].lat) * Math.PI / 180]; });
        for (var i = 0; i < xy.length; i++) { var j = (i + 1) % xy.length; a += xy[i][0] * xy[j][1] - xy[j][0] * xy[i][1]; }
        return Math.abs(a) / 2;
    }
    function fmtA(m2) { return m2 < 10000 ? Math.round(m2) + ' م²' : m2 < 1e6 ? (m2 / 1e4).toFixed(2) + ' هكتار' : (m2 / 1e6).toFixed(2) + ' كم²'; }
    function fromMe(p) {
        var L = api() && api().live();
        if (!L || !L.fix) return '';
        var g = GEO.geodesic(L.fix.lat, L.fix.lng, p.lat, p.lng);
        return fmtD(g.m) + ' · ' + Math.round(g.brg) + '° ' + dirL(g.brg);
    }
    function toolsHud(c, L) {
        if (!host) return;
        var x = host.querySelector('#mpX'), mm = host.querySelector('#mpMeas');
        if (x) {
            x.hidden = !!(cfg.follow || meas);
            if (!x.hidden) { var f = fromMe(c); setT(x.querySelector('#mpXt'), f ? 'الوسط يبعد ' + f : 'وسط الخريطة: ' + c.lat.toFixed(5) + ', ' + c.lng.toFixed(5)); }
        }
        if (mm) {
            mm.hidden = !meas;
            if (meas) {
                var n = meas.pts.length, ar = measArea();
                setT(mm.querySelector('#mpMt'), n < 2 ? (n ? 'اضغط نقطة أخرى على الخريطة' : 'اضغط على الخريطة لإضافة نقاط') : 'المسافة ' + fmtD(measLen()) + ' · ' + n + ' نقاط' + (ar ? ' · المساحة ' + fmtA(ar) : ''));
                var ub = mm.querySelector('[data-m="mundo"]'); if (ub) ub.disabled = !n;
            }
        }
        var mb = host.querySelector('[data-m="meas"]'); if (mb) mb.classList.toggle('on', !!meas);
    }
    function setT(el, t) { if (el && el.textContent !== t) el.textContent = t; }
    function navTo(p, name) {
        var A = api(); if (!A) return;
        var d = A.upsertDest({ id: 'gbs-mappt', name: name || 'نقطة من الخريطة', emoji: '🎯', lat: p.lat, lng: p.lng });
        closeSheet(); A.pickDest(d.id); toast('السهم الآن يشير إلى النقطة');
    }
    function saveAs(p, def) {
        var nm = prompt('اسم الوجهة\n' + p.lat.toFixed(6) + ', ' + p.lng.toFixed(6), def || 'نقطة من الخريطة');
        if (!nm || !nm.trim()) return;
        api().upsertDest({ name: nm.trim().slice(0, 60), emoji: '📍', lat: p.lat, lng: p.lng });
        closeSheet(); toast('حُفظت في الوجهات'); redraw();
    }
    function closeSheet() { var s = document.getElementById('sheetBackdrop'); if (s) s.classList.remove('active'); }
    function ptSheet(p, title) {
        var f = fromMe(p);
        var b = sheet(title, '<div class="lx-pt"><b dir="ltr">' + esc(fmtC(p)) + '</b>'
            + (f ? '<span>من موقعك: ' + esc(f) + '</span>' : '<span>موقعك غير متاح الآن لحساب المسافة</span>') + '</div>'
            + '<div class="lx-ptb">'
            + '<button type="button" class="btn btn-primary" data-p="go">🎯 توجّه إليها</button>'
            + '<button type="button" class="btn btn-ghost" data-p="save">📍 حفظ كوجهة</button>'
            + '<button type="button" class="btn btn-ghost" data-p="copy">📋 نسخ الإحداثيات</button>'
            + '<button type="button" class="btn btn-ghost" data-p="meas">📏 قياس من هنا</button>'
            + '<button type="button" class="btn btn-ghost" data-p="ctr">⊕ توسيط الخريطة هنا</button>'
            + '</div><p class="hint">«توجّه إليها» تجعل السهم في الرئيسية يشير إلى النقطة مباشرة (خط مستقيم وليس طريقًا).</p>');
        b.onclick = function (e) {
            var k = e.target.closest('[data-p]'); if (!k) return;
            switch (k.getAttribute('data-p')) {
                case 'go': lp = null; navTo(p); break;
                case 'save': saveAs(p); break;
                case 'copy': api().copyCoords(p); break;
                case 'meas': lp = null; meas = { pts: [p] }; closeSheet(); redraw(); break;
                case 'ctr': cfg.follow = false; cfg.lat = p.lat; cfg.lng = p.lng; saveCfg(); closeSheet(); redraw(); break;
            }
        };
    }
    function findSheet() {
        var b = sheet('الذهاب إلى إحداثيات', '<input id="mpFind" dir="ltr" autocomplete="off" placeholder="15.500700, 32.559900">'
            + '<p class="hint">يقبل: أرقامًا عشرية (15.5007, 32.5599)، أو درجات ودقائق وثوانٍ (15°30\'02"N 32°33\'35"E)، أو رابط خرائط Google أو أي رابط فيه الإحداثيات، بالأرقام العربية أو الإنجليزية. يعمل دون إنترنت.</p>'
            + '<div class="row"><button type="button" class="btn btn-primary" id="mpFindGo">اذهب</button></div>');
        var inp = b.querySelector('#mpFind');
        function goFind() {
            var A = api(), q = A && A.parseLL ? A.parseLL(inp.value) : null;
            if (!q) { toast('لم أتعرف على الإحداثيات — راجع الصيغة'); return; }
            cfg.follow = false; cfg.lat = q.lat; cfg.lng = q.lng; lp = q; saveCfg();
            if (cfg.z < 15) animZoom(15); else redraw();
            ptSheet(q, 'الإحداثيات');
        }
        b.querySelector('#mpFindGo').onclick = goFind;
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') goFind(); });
        setTimeout(function () { try { inp.focus(); } catch (e) { } }, 50);
    }
    /* فحص الحفظ: نسبة بلاطات المنطقة الظاهرة المحفوظة على الهاتف لكل مستوى تكبير (نفس البلاطات التي سيعرضها التطبيق دون اتصال) */
    function coverage() {
        var s = src();
        var b = sheet('فحص الحفظ للعمل دون إنترنت', '<p class="hint">جارٍ فحص المنطقة الظاهرة…</p>');
        if (!s.url || !tileURL(s, 0, 0, 0)) { b.innerHTML = '<p>هذه الطبقة لا تستخدم بلاطات محفوظة.</p>'; return Promise.resolve(); }
        if (!cacheOk) { b.innerHTML = '<p>هذا الجهاز لا يدعم حفظ البلاطات.</p>'; return Promise.resolve(); }
        var c = center(), z0 = Math.round(cfg.z), levels = [];
        for (var Z = Math.max(2, z0 - 3); Z <= Math.min(s.max, z0 + 2); Z++) levels.push(Z);
        var rows = [];
        return cache().then(function (cc) {
            return levels.reduce(function (pr, Z) {
                return pr.then(function () {
                    var zt = tileZ(s, Z), sc = Math.pow(2, Z - zt), n = Math.pow(2, zt), cx = wx(c.lng, zt), cy = wy(c.lat, zt), hw = W / 2 / sc, hh = H / 2 / sc, us = [];
                    for (var y = Math.max(0, Math.floor((cy - hh) / TS)); y <= Math.min(n - 1, Math.floor((cy + hh) / TS)); y++)
                        for (var x = Math.floor((cx - hw) / TS); x <= Math.floor((cx + hw) / TS); x++) us.push(tileURL(s, zt, ((x % n) + n) % n, y));
                    return Promise.all(us.map(function (u) { return cc.match(ck(u)).then(function (h) { return h ? 1 : 0; }, function () { return 0; }); }))
                        .then(function (r) { rows.push({ Z: Z, ok: r.reduce(function (a, v) { return a + v; }, 0), tot: us.length }); });
                });
            }, Promise.resolve());
        }).then(function () {
            var html = '<p class="hint">الطبقة: <b>' + esc(s.name) + '</b> — المنطقة الظاهرة الآن على الشاشة.</p><div class="lx-cov">';
            rows.forEach(function (r) {
                var pc = r.tot ? Math.round(r.ok * 100 / r.tot) : 0, cl = pc >= 100 ? 'ok' : pc >= 50 ? 'mid' : 'no';
                html += '<div class="lx-covr' + (r.Z === z0 ? ' cur' : '') + '"><span>تكبير ' + r.Z + (r.Z === z0 ? ' (الحالي)' : '') + '</span><i class="' + cl + '"><b style="width:' + pc + '%"></b></i><em>' + pc + '%</em></div>';
            });
            var full = rows.filter(function (r) { return r.ok === r.tot; }).map(function (r) { return r.Z; });
            html += '</div><p class="hint">' + (full.length ? 'محفوظة بالكامل في مستويات التكبير: ' + full.join('، ') + '.' : 'المنطقة غير محفوظة بالكامل في أي مستوى.')
                + ' لحفظ ما ينقص: وأنت متصل، كبّر وصغّر وحرّك الخريطة فوق المنطقة حتى تكتمل النسب، ثم أعد الفحص.</p>'
                + '<div class="row"><button type="button" class="btn btn-ghost" id="mpCovAgain">إعادة الفحص</button></div>';
            b.innerHTML = html;
            b.querySelector('#mpCovAgain').onclick = coverage;
        }).catch(function () { b.innerHTML = '<p>تعذّر الفحص على هذا الجهاز.</p>'; });
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
            sheet('تنزيل منطقة', '<p>شروط <b>' + esc(s.name) + '</b> لا تسمح بالتنزيل الجماعي المسبق للبلاطات، لذلك لا يقوم التطبيق به.</p>'
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
                    c.match(ck(u)).then(function (h) {
                        if (h) return;
                        return fetch(u, { mode: 'cors', credentials: 'omit' }).then(function (r) { if (!r.ok) throw 0; return c.put(ck(u), r); });
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
            + '<div class="lx-sec" id="mpKeyBox" style="margin-top:10px"><b>مفتاح MapTiler</b>'
            + '<div class="row" style="gap:6px;align-items:center"><input id="mpKey" dir="ltr" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="الصق المفتاح هنا" value="' + esc(cfg.mtkey || '') + '" style="flex:1;min-width:0">'
            + '<button type="button" class="btn btn-ghost" id="mpKeySave" style="flex:0 0 auto">حفظ</button></div>'
            + '<p class="hint" id="mpKeySt">' + (cfg.mtkey ? 'المفتاح محفوظ على هذا الهاتف فقط.' : 'المفتاح مجاني من cloud.maptiler.com ← API keys. يُحفظ على هذا الهاتف فقط ولا يُرسل إلا إلى MapTiler مع طلب البلاطات.') + '</p>'
            + '<p class="hint">ما تتصفّحه بهذه الطبقات يُحفظ تلقائيًا ويعمل دون إنترنت. شروط MapTiler تمنع تنزيل مناطق كاملة دفعة واحدة، فتصفّح مسارك قبل السفر.</p></div>'
            + '<div class="lx-sec" style="margin-top:10px"><b>دقة البلاطات</b>'
            + '<label class="lx-radio"><input type="radio" name="mphd" value="0"' + (cfg.hd ? '' : ' checked') + '> عادية — نصوص الشوارع بحجم كبير</label>'
            + '<label class="lx-radio"><input type="radio" name="mphd" value="1"' + (cfg.hd ? ' checked' : '') + '> فائقة — تفاصيل أدق بحسب دقة شاشتك (النصوص أصغر، وتُنزَّل بلاطات أكثر)</label>'
            + '<p class="hint">صور القمر الصناعي تُعرض دائمًا بالدقة الأعلى المناسبة لشاشتك.</p></div>'
            + '<p class="hint">ملاحظة: بيانات الطرق والتضاريس في كثير من مناطق السودان والصحراء ناقصة أو غير موجودة. غياب طريق على الخريطة لا يعني عدم وجوده، ووجوده لا يعني أنه صالح.</p>'
            + '<div class="row"><button type="button" class="btn btn-ghost" id="mpClear">مسح البلاطات المحفوظة</button></div><p class="hint" id="mpCnt"></p>');
        b.addEventListener('change', function (e) {
            if (e.target.name === 'mpsrc') { cfg.src = e.target.value; b.querySelector('#mpCust').hidden = cfg.src !== 'custom'; queue.length = 0; saveCfg(); redraw(); }
            if (e.target.name === 'mphd') { cfg.hd = e.target.value === '1'; queue.length = 0; saveCfg(); redraw(); }
        });
        b.querySelector('#mpKeySave').addEventListener('click', function () {
            var v = b.querySelector('#mpKey').value.replace(/\s+/g, '');
            if (v && !/^[A-Za-z0-9_-]{8,64}$/.test(v)) { toast('المفتاح غير صحيح — انسخه كما هو من موقع MapTiler'); return; }
            cfg.mtkey = v; keyErr = 0; queue.length = 0;
            if (v && !SRC[cfg.src].key) { cfg.src = 'mthyb'; var rb = b.querySelector('input[name="mpsrc"][value="mthyb"]'); if (rb) rb.checked = true; b.querySelector('#mpCust').hidden = true; }
            saveCfg(); redraw();
            b.querySelector('#mpKeySt').textContent = v ? 'تم الحفظ على هذا الهاتف — الطبقة الآن: قمر صناعي فائق الدقة + أسماء.' : 'حُذف المفتاح من الهاتف.';
            toast(v ? 'تم حفظ المفتاح' : 'حُذف المفتاح');
        });
        b.querySelector('#mpUrl').addEventListener('change', function () {
            var v = this.value.trim();
            if (v && !/^https:\/\/.+\{z\}.+\{x\}.+\{y\}/.test(v)) { toast('الرابط يجب أن يبدأ بـ https ويحتوي {z} و {x} و {y}'); return; }
            cfg.custom = v; queue.length = 0; saveCfg(); redraw();
        });
        b.querySelector('#mpClear').addEventListener('click', function () {
            showConfirm('مسح البلاطات', 'حذف كل بلاطات الخريطة المحفوظة على الهاتف؟', function () { if (window.caches) caches.delete(CACHE).then(function () { cacheP = null; mem.forEach(release); mem.clear(); memPx = 0; count(); redraw(); toast('تم المسح'); }); });
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
        cfg.z = Math.min(z, src().max || 19); zAnim = null;
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
                + '<div class="lx-mtool" id="mpX" hidden><span id="mpXt"></span><button type="button" data-m="xgo">🎯 توجّه</button><button type="button" data-m="xmenu" aria-label="خيارات الوسط">⋯</button></div>'
                + '<div class="lx-mtool lx-mmeas" id="mpMeas" hidden><span id="mpMt"></span><button type="button" data-m="mundo">تراجع</button><button type="button" data-m="mclr">مسح</button><button type="button" data-m="mend">إنهاء</button></div>'
                + '<div class="lx-mbot"><span id="mpScale" class="lx-scale"></span><span id="mpMsg" hidden></span></div>'
                + '<div id="mpDl" class="lx-mdl" hidden></div></div>'
                + '<div class="lx-mbar">'
                + '<button type="button" data-m="layers">🗺 الطبقة</button><button type="button" data-m="save">📍 حفظ المركز</button>'
                + '<button type="button" data-m="dl">⬇️ تنزيل المنطقة</button><button type="button" data-m="trip">〰 المسار</button>'
                + '<button type="button" data-m="meas">📏 قياس</button><button type="button" data-m="find">🔎 إحداثيات</button>'
                + '<button type="button" data-m="cov">✅ فحص الحفظ</button><button type="button" data-m="ccopy">📋 نسخ الوسط</button>'
                + '</div>'
                + '<p class="lx-attr"><span id="mpAttr"></span>الخط الأصفر المتقطع = اتجاه مباشر وليس طريقًا. الخريطة للمساعدة فقط؛ البوصلة والسهم يعملان دونها.</p>';
            body.appendChild(host);
            cv = host.querySelector('canvas'); ctx = cv.getContext('2d');
            bindCanvas();
            host.addEventListener('click', function (e) {
                var b = e.target.closest('[data-m]'); if (!b) return;
                switch (b.getAttribute('data-m')) {
                    case 'zin': animZoom(Math.round(cfg.z) + 1); break;
                    case 'zout': animZoom(Math.round(cfg.z) - 1); break;
                    case 'follow': cfg.follow = !cfg.follow; if (cfg.follow && cfg.z < 12) cfg.z = 15; saveCfg(); redraw(); break;
                    case 'up': cfg.up = cfg.up === 'head' ? 'north' : 'head'; saveCfg(); redraw(); break;
                    case 'layers': layers(); break;
                    case 'save': saveCenter(); break;
                    case 'dl': startDownload(); break;
                    case 'dlstop': if (dl) dl.stop = true; break;
                    case 'meas': meas = meas ? null : { pts: [] }; lp = null; if (meas) toast('اضغط على الخريطة لإضافة نقاط القياس'); redraw(); break;
                    case 'mundo': if (meas) { meas.pts.pop(); redraw(); } break;
                    case 'mclr': if (meas) { meas.pts = []; redraw(); } break;
                    case 'mend': meas = null; redraw(); break;
                    case 'find': findSheet(); break;
                    case 'cov': coverage(); break;
                    case 'ccopy': api().copyCoords(center()); break;
                    case 'xgo': navTo(center()); break;
                    case 'xmenu': ptSheet(center(), 'وسط الخريطة'); break;
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
        _proj: { wx: wx, wy: wy, latOf: latOf, lngOf: lngOf },
        _tools: { ptLL: ptLL, measLen: measLen, measArea: measArea, coverage: coverage }
    };
    window.addEventListener('online', redraw);
    window.addEventListener('offline', redraw);
})();
