/* ================= تسجيل الرحلات + العودة إلى نقطة الانطلاق =================
   - يستقبل نفس القراءات المقبولة التي تعرضها الشاشة الرئيسية (حدث gbs:pos) — لا يشغّل متتبّع GPS ثانيًا في المتصفح.
   - داخل تطبيق أندرويد: إن وُجدت إضافة BackgroundGeolocation تُشغَّل خدمة موقع أمامية بإشعار أثناء التسجيل فقط
     حتى يستمر التسجيل عند الخروج من التطبيق أو قفل الشاشة.
   - الحفظ التلقائي في IndexedDB كل بضع ثوانٍ، والاستئناف بعد العودة أو إعادة تشغيل الهاتف.
   - لا بيانات وهمية: النقاط ضعيفة الدقة أو القفزات المستحيلة تُرفض ولا تُرسم.
   ========================================================================== */
(function () {
    'use strict';
    var F = window.FUN, esc = function (s) { return F.esc(s); };
    var Store = window.GBS_STORE;
    var ACC_MAX = 50;          /* أسوأ دقة تُقبل في المسار (م) */
    var GAP_SEG = 180;         /* انقطاع أطول من هذا (ث) يبدأ مقطعًا جديدًا */
    var V_MAX = 97;            /* 350 كم/س: أي إزاحة أسرع قفزة مستحيلة */
    var LG_KEY = 'gbs.lastgood', TB_KEY = 'gbs.trackback';

    var cur = null;            /* الرحلة الجارية */
    var list = null;           /* سجل الرحلات (بدون الجارية) */
    var lastSave = 0, dirty = false, hidAt = 0, bgSeen = 0;
    var bg = { st: 'off', id: null, err: '' };
    var stats = { rej: 0, jump: 0 };
    var view = { open: null };  /* الرحلة المفتوحة في التفاصيل */

    function now() { return Date.now(); }
    function geo(a, b, c, d) { return GEO.geodesic(a, b, c, d); }
    function fin(x) { return typeof x === 'number' && isFinite(x); }
    function api() { return window.GBS_API || null; }
    function fmtD(m) { if (!isFinite(m)) return '—'; if (m < 1000) return Math.round(m) + ' م'; return (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' كم'; }
    function fmtT(ms) {
        if (!fin(ms) || ms < 0) return '—';
        var s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
    }
    function fmtDate(t) { try { return new Date(t).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return new Date(t).toISOString(); } }
    function kmh(v) { return fin(v) ? Math.round(v * 3.6) : null; }
    function coordTxt(la, lo) { return la.toFixed(6) + ', ' + lo.toFixed(6); }
    function newId() { return 't' + now().toString(36) + Math.random().toString(36).slice(2, 5); }

    /* ---------- آخر موقع موثوق (يُحفظ حتى بعد إغلاق التطبيق) ---------- */
    var lgAt = 0;
    function saveLastGood(p) {
        if (p.acc > 30 || now() - lgAt < 5000) return;
        lgAt = now();
        try { localStorage.setItem(LG_KEY, JSON.stringify({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), acc: Math.round(p.acc), t: p.ts })); } catch (e) { }
    }
    function lastGood() { try { var o = JSON.parse(localStorage.getItem(LG_KEY) || 'null'); return o && fin(o.lat) ? o : null; } catch (e) { return null; } }

    /* ================= المسجّل ================= */
    function lastPt() { return cur && cur.pts.length ? cur.pts[cur.pts.length - 1] : null; }
    function accept(p, src) {
        if (!cur || cur.status !== 'rec') return;
        if (!(fin(p.lat) && fin(p.lng))) return;
        var acc = fin(p.acc) ? p.acc : 999;
        if (acc > ACC_MAX) { stats.rej++; return; }
        var ts = fin(p.ts) ? p.ts : now();
        if (now() - ts > 60000) { stats.rej++; return; }       /* قراءة قديمة متأخرة */
        var L = lastPt();
        var alt = fin(p.alt) ? Math.round(p.alt) : null;
        var spd = fin(p.spd) && p.spd >= 0 && p.spd <= V_MAX ? +p.spd.toFixed(2) : null;
        if (!L) { push(p.lat, p.lng, ts, alt, spd, acc, cur.seg); return; }
        if (ts <= L[2]) return;                                   /* مكرّرة (من مصدرين) أو أقدم */
        var dt = (ts - L[2]) / 1000, g = geo(L[0], L[1], p.lat, p.lng);
        var newSeg = cur.newSeg || dt > GAP_SEG;
        if (!newSeg && g.m / dt > V_MAX) { stats.jump++; return; }
        var minD = Math.max(5, 0.5 * Math.max(acc, L[5]));
        if (!newSeg && g.m < minD) {                              /* واقف: لا نضيف نقاطًا متكررة */
            cur.t1 = ts;
            if (dt >= 60) push(p.lat, p.lng, ts, alt, 0, acc, cur.seg); /* نقطة كل دقيقة أثناء التوقف لحفظ الزمن */
            return;
        }
        if (newSeg) {
            cur.seg++;
            if (cur.newSeg === 'gap' || dt > GAP_SEG) cur.gapDist = (cur.gapDist || 0) + g.m;
            cur.newSeg = false;
        } else {
            cur.dist += g.m;
            if (g.m / dt >= 0.5) cur.moving += dt * 1000;
            var v = spd != null ? spd : g.m / dt;
            if (acc <= 25 && dt >= 1 && v <= V_MAX) cur.maxSpd = Math.max(cur.maxSpd || 0, v);
        }
        push(p.lat, p.lng, ts, alt, spd, acc, cur.seg);
        if (src === 'bg') bgSeen = now();
    }
    function push(la, lo, t, alt, spd, acc, seg) {
        cur.pts.push([+la.toFixed(6), +lo.toFixed(6), t, alt, spd, Math.round(acc), seg]);
        cur.t1 = t;
        dirty = true;
        if (now() - lastSave > 8000 || cur.pts.length % 25 === 0) save();
    }
    function save() {
        if (!cur) return Promise.resolve();
        lastSave = now(); dirty = false;
        cur.saved = now();
        return Store.put(cur).catch(function (e) { console.warn('trip save', e); });
    }
    function start() {
        if (cur) return;
        var t = now();
        cur = { id: newId(), v: 1, name: 'رحلة ' + fmtDate(t), status: 'rec', t0: t, t1: t, pts: [], seg: 0, dist: 0, gapDist: 0, moving: 0, maxSpd: 0, newSeg: false };
        var a = api(), L = a && a.live();
        if (L && L.fix && !L.stale && L.fix.acc <= ACC_MAX) push(L.fix.lat, L.fix.lng, L.fix.ts, L.fix.alt, L.spd, L.fix.acc, 0);
        Store.persist();
        save();
        bgStart();
        toast('بدأ تسجيل الرحلة');
        refresh();
    }
    function pause() { if (!cur || cur.status !== 'rec') return; cur.status = 'pause'; save(); bgStop(); toast('أُوقف التسجيل مؤقتًا'); refresh(); }
    function resume() { if (!cur || cur.status !== 'pause') return; cur.status = 'rec'; cur.newSeg = true; save(); bgStart(); toast('استُؤنف التسجيل'); refresh(); }
    function stop() {
        if (!cur) return;
        showConfirm('إنهاء الرحلة', 'سيُحفظ المسار في سجل الرحلات. متابعة؟', function () {
            cur.status = 'done';
            cur.t1 = Math.max(cur.t1, cur.pts.length ? cur.pts[cur.pts.length - 1][2] : cur.t0);
            var done = cur; cur = null;
            bgStop();
            Store.put(done).then(function () { if (list) list.unshift(done); toast('حُفظت الرحلة'); refresh(); });
        });
    }

    /* استقبال القراءات من الشاشة الرئيسية */
    window.addEventListener('gbs:pos', function (e) {
        var p = e.detail; if (!p) return;
        saveLastGood(p);
        accept(p, 'fg');
        tbStep(p);
    });
    /* الخروج إلى الخلفية في المتصفح: لا توجد قراءات، فلا نصل النقاط بخط مستقيم كأنه مسار حقيقي */
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') { hidAt = now(); if (cur && dirty) save(); return; }
        if (cur && cur.status === 'rec' && hidAt && now() - hidAt > 20000 && bgSeen < hidAt) cur.newSeg = 'gap';
        hidAt = 0;
    });
    window.addEventListener('pagehide', function () { if (cur && dirty) save(); });

    /* ---------- خدمة الموقع في الخلفية (أندرويد فقط) ---------- */
    function bgPlugin() {
        var C = window.Capacitor;
        if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
        return (C.Plugins && C.Plugins.BackgroundGeolocation) || null;
    }
    function bgStart() {
        var P = bgPlugin();
        if (!P) { bg.st = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() ? 'missing' : 'web'; return; }
        if (bg.id) return;
        bg.st = 'starting';
        Promise.resolve(P.addWatcher({
            backgroundTitle: 'GBS المنتصر — تسجيل الرحلة',
            backgroundMessage: 'يسجّل مسارك الآن. اضغط للعودة إلى التطبيق.',
            requestPermissions: true, stale: false, distanceFilter: 5
        }, function (loc, err) {
            if (err) {
                bg.st = 'err'; bg.err = err.code === 'NOT_AUTHORIZED' ? 'لم يُمنح إذن الموقع للخدمة' : (err.message || String(err));
                if (err.code === 'NOT_AUTHORIZED') showConfirm('إذن الموقع', 'لتسجيل الرحلة في الخلفية امنح التطبيق إذن الموقع (ويفضّل «السماح طوال الوقت»). فتح الإعدادات؟', function () { try { P.openSettings(); } catch (e) { } });
                refresh(); return;
            }
            if (!loc) return;
            bg.st = 'on';
            accept({ lat: loc.latitude, lng: loc.longitude, acc: loc.accuracy, alt: loc.altitude, spd: loc.speed, ts: loc.time || now() }, 'bg');
        })).then(function (id) { bg.id = id; if (bg.st === 'starting') bg.st = 'on'; refresh(); })
          .catch(function (e) { bg.st = 'err'; bg.err = (e && e.message) || String(e); refresh(); });
    }
    function bgStop() {
        var P = bgPlugin();
        if (P && bg.id) { try { P.removeWatcher({ id: bg.id }); } catch (e) { } }
        bg.id = null; bg.st = 'off';
    }
    function bgText() {
        switch (bg.st) {
            case 'on': return { c: 'ok', t: 'خدمة التسجيل في الخلفية تعمل (يظهر إشعار ثابت)' };
            case 'starting': return { c: 'warn', t: 'جارٍ تشغيل خدمة الخلفية…' };
            case 'err': return { c: 'bad', t: 'خدمة الخلفية لا تعمل: ' + bg.err };
            case 'missing': return { c: 'warn', t: 'إضافة الخلفية غير مضمّنة في هذه النسخة: يتوقف التسجيل عند الخروج من التطبيق' };
            case 'web': return { c: 'warn', t: 'في المتصفح يتوقف التسجيل عند الخروج من التطبيق أو قفل الشاشة. اترك التطبيق مفتوحًا (وضع الصحراء يبقي الشاشة مضاءة)' };
            default: return { c: 'warn', t: 'الخدمة متوقفة' };
        }
    }

    /* ---------- الاستئناف بعد إعادة الفتح / إعادة تشغيل الهاتف ---------- */
    var ready = Store.all().then(function (a) {
        a.sort(function (x, y) { return y.t0 - x.t0; });
        var act = a.filter(function (t) { return t.status === 'rec' || t.status === 'pause'; });
        /* أحدث رحلة غير منتهية تُستأنف؛ أي رحلة أقدم معلّقة تُغلق كي لا تضيع */
        act.slice(1).forEach(function (t) { t.status = 'done'; Store.put(t); });
        cur = act[0] || null;
        list = a.filter(function (t) { return t !== cur; }).map(function (t) { if (t.status !== 'done') t.status = 'done'; return t; });
        if (cur) {
            cur.newSeg = cur.status === 'rec' ? 'gap' : cur.newSeg;
            if (cur.status === 'rec') { bgStart(); setTimeout(function () { toast('استُؤنف تسجيل الرحلة الجارية'); }, 1200); }
        }
        refresh();
    }).catch(function (e) { console.warn(e); list = []; });
    setInterval(function () { if (cur && dirty && now() - lastSave > 8000) save(); }, 4000);

    /* ================= العودة إلى نقطة الانطلاق ================= */
    function srcTrip() { return cur && cur.pts.length ? cur : (list && list.find(function (t) { return t.pts.length; })) || null; }
    function startPt(t) { t = t || srcTrip(); return t && t.pts.length ? t.pts[0] : null; }
    function goDirect(t) {
        var a = api(), s = startPt(t); if (!a || !s) { toast('لا توجد نقطة انطلاق مسجّلة بعد'); return; }
        tbCancel(true);
        a.upsertDest({ id: 'gbs-start', name: 'نقطة الانطلاق (خط مستقيم)', emoji: '🏁', lat: s[0], lng: s[1], acc: s[5] });
        a.pickDest('gbs-start');
        toast('السهم يشير الآن مباشرة إلى نقطة الانطلاق — خط مستقيم وليس طريقًا');
    }
    /* المسار العكسي: نتبع النقاط المسجّلة نفسها رجوعًا، فالهدف دائمًا نقطة على المسار أمامك بنحو 150 م */
    var tb = null;
    function tbLoad() { try { var o = JSON.parse(localStorage.getItem(TB_KEY) || 'null'); return o && o.id ? o : null; } catch (e) { return null; } }
    function tbBuild(t) {
        var p = t.pts.map(function (x) { return [x[0], x[1]]; }), cum = [0];
        for (var i = 1; i < p.length; i++) cum.push(cum[i - 1] + (t.pts[i][6] === t.pts[i - 1][6] ? geo(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]).m : geo(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]).m));
        return { id: t.id, p: p, cum: cum, idx: p.length - 1, off: null, rem: cum[cum.length - 1], tgt: null };
    }
    function goTrack(t) {
        t = t || srcTrip();
        var a = api();
        if (!a || !t || t.pts.length < 2) { toast('لا يوجد مسار مسجّل كافٍ للعودة عليه'); return; }
        tb = tbBuild(t);
        try { localStorage.setItem(TB_KEY, JSON.stringify({ id: t.id })); } catch (e) { }
        var L = a.live();
        if (L.fix) tbStep({ lat: L.fix.lat, lng: L.fix.lng, acc: L.fix.acc }, true);
        else { var e = tb.p[tb.idx]; a.upsertDest({ id: 'gbs-trackback', name: 'العودة على نفس المسار', emoji: '↩️', lat: e[0], lng: e[1] }); }
        a.pickDest('gbs-trackback');
        toast('العودة على نفس المسار: السهم يتبع نقاط رحلتك رجوعًا');
    }
    function tbCancel(silent) {
        tb = null; try { localStorage.removeItem(TB_KEY); } catch (e) { }
        if (!silent) toast('أُلغيت العودة على المسار');
        refresh();
    }
    function flat(la, lo, a, b) { var k = Math.cos(la * Math.PI / 180), x = (b - lo) * k, y = a - la; return Math.sqrt(x * x + y * y) * 111320; }
    function tbStep(p, force) {
        if (!tb || !fin(p.lat)) return;
        if (!force && p.acc > 80) return;
        /* أقرب نقطة على المسار — نبحث حول آخر موضع أولًا ثم في كل المسار إن ابتعدنا */
        var best = -1, bd = Infinity, lo = Math.max(0, tb.idx - 400), hi = Math.min(tb.p.length - 1, tb.idx + 40), i, d;
        for (i = lo; i <= hi; i++) { d = flat(p.lat, p.lng, tb.p[i][0], tb.p[i][1]); if (d < bd) { bd = d; best = i; } }
        if (bd > 400) for (i = 0; i < tb.p.length; i++) { d = flat(p.lat, p.lng, tb.p[i][0], tb.p[i][1]); if (d < bd) { bd = d; best = i; } }
        tb.idx = best; tb.off = bd; tb.rem = tb.cum[best] + bd;
        var ahead = Math.max(150, (p.acc || 10) * 3), j = best;
        while (j > 0 && tb.cum[best] - tb.cum[j] < ahead) j--;
        var a = api();
        if (best === 0 || tb.cum[best] < 30) { j = 0; }
        if (a && (tb.tgt !== j || force)) {
            tb.tgt = j;
            a.upsertDest({ id: 'gbs-trackback', name: 'العودة على نفس المسار', emoji: '↩️', lat: tb.p[j][0], lng: tb.p[j][1] });
        }
    }
    window.addEventListener('load', function () {
        var o = tbLoad(); if (!o) return;
        ready.then(function () {
            var t = (cur && cur.id === o.id) ? cur : (list || []).find(function (x) { return x.id === o.id; });
            if (t && t.pts.length >= 2) tb = tbBuild(t);
        });
    });

    /* ================= GPX ================= */
    function xmlEsc(s) { return String(s).replace(/[<>&'"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]; }); }
    function toGPX(t) {
        var out = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<gpx version="1.1" creator="GBS Almuntasir" xmlns="http://www.topografix.com/GPX/1/1">',
            '<metadata><name>' + xmlEsc(t.name) + '</name><time>' + new Date(t.t0).toISOString() + '</time></metadata>',
            '<trk><name>' + xmlEsc(t.name) + '</name>'];
        var seg = null;
        t.pts.forEach(function (p) {
            if (p[6] !== seg) { if (seg !== null) out.push('</trkseg>'); out.push('<trkseg>'); seg = p[6]; }
            out.push('<trkpt lat="' + p[0] + '" lon="' + p[1] + '">' + (p[3] != null ? '<ele>' + p[3] + '</ele>' : '') + '<time>' + new Date(p[2]).toISOString() + '</time></trkpt>');
        });
        if (seg !== null) out.push('</trkseg>');
        out.push('</trk></gpx>');
        return out.join('\n');
    }
    function fromGPX(txt) {
        var doc = new DOMParser().parseFromString(txt, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) throw new Error('bad xml');
        var pts = [], seg = 0, t0 = now();
        var segs = doc.getElementsByTagName('trkseg');
        var groups = segs.length ? Array.prototype.slice.call(segs) : [doc];
        groups.forEach(function (g, gi) {
            var nodes = g.getElementsByTagName(segs.length ? 'trkpt' : 'rtept');
            if (!segs.length && !nodes.length) nodes = g.getElementsByTagName('trkpt');
            Array.prototype.forEach.call(nodes, function (n, k) {
                var la = parseFloat(n.getAttribute('lat')), lo = parseFloat(n.getAttribute('lon'));
                if (!fin(la) || !fin(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return;
                var e = n.getElementsByTagName('ele')[0], tm = n.getElementsByTagName('time')[0];
                var t = tm ? Date.parse(tm.textContent) : NaN;
                pts.push([+la.toFixed(6), +lo.toFixed(6), fin(t) ? t : null, e ? Math.round(parseFloat(e.textContent)) || null : null, null, 0, gi]);
            });
        });
        /* بلا أوقات في الملف: لا نخترع أوقاتًا؛ نترك الترتيب فقط */
        var hasT = pts.length && pts.every(function (p) { return p[2] != null; });
        if (!hasT) pts.forEach(function (p, i) { p[2] = i; });
        var dist = 0;
        for (var i = 1; i < pts.length; i++) if (pts[i][6] === pts[i - 1][6]) dist += geo(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]).m;
        var wpts = Array.prototype.map.call(doc.getElementsByTagName('wpt'), function (n) {
            var nm = n.getElementsByTagName('name')[0];
            return { lat: parseFloat(n.getAttribute('lat')), lng: parseFloat(n.getAttribute('lon')), name: nm ? nm.textContent.trim() : '' };
        }).filter(function (w) { return fin(w.lat) && fin(w.lng); });
        var nmEl = doc.querySelector('trk > name') || doc.querySelector('metadata > name');
        return {
            trip: pts.length >= 2 ? { id: newId(), v: 1, name: (nmEl && nmEl.textContent.trim()) || 'مسار مستورد', status: 'done', imported: true, noTime: !hasT,
                t0: hasT ? pts[0][2] : t0, t1: hasT ? pts[pts.length - 1][2] : t0, pts: pts, seg: 0, dist: dist, gapDist: 0, moving: hasT ? null : null, maxSpd: null } : null,
            wpts: wpts
        };
    }
    /* حفظ ملف: داخل أندرويد عبر Filesystem + Share إن وُجدا، وإلا مشاركة نص؛ في المتصفح تنزيل مباشر */
    function saveFile(name, text, mime) {
        var C = window.Capacitor, P = C && C.Plugins, nat = C && C.isNativePlatform && C.isNativePlatform();
        if (nat && P && P.Filesystem && P.Share) {
            return P.Filesystem.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' })
                .then(function (r) { return P.Share.share({ title: name, files: [r.uri] }); })
                .catch(function (e) { console.warn(e); return F.share(text); });
        }
        if (nat) return F.share(text);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: mime }));
        a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        toast('تم التصدير');
        return Promise.resolve();
    }
    window.GBS_SAVEFILE = saveFile;
    function importGPX() {
        var inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.gpx,application/gpx+xml,application/xml,text/xml';
        inp.onchange = function () {
            var f = inp.files && inp.files[0]; if (!f) return;
            f.text().then(function (txt) {
                var r = fromGPX(txt);
                if (!r.trip && !r.wpts.length) throw new Error('empty');
                var jobs = [];
                if (r.trip) jobs.push(Store.put(r.trip).then(function () { (list = list || []).unshift(r.trip); }));
                Promise.all(jobs).then(function () {
                    refresh();
                    var msg = (r.trip ? 'استُورد مسار من ' + r.trip.pts.length + ' نقطة. ' : '');
                    if (r.wpts.length && api()) {
                        showConfirm('نقاط في الملف', msg + 'يحتوي الملف ' + r.wpts.length + ' نقطة طريق. إضافتها إلى الوجهات؟', function () {
                            r.wpts.forEach(function (w, i) { api().upsertDest({ name: w.name || ('نقطة ' + (i + 1)), emoji: '📍', lat: w.lat, lng: w.lng }); });
                            toast('أُضيفت ' + r.wpts.length + ' وجهة');
                        });
                    } else toast(msg || 'تم');
                });
            }).catch(function () { toast('ملف GPX غير صالح'); });
        };
        inp.click();
    }

    /* ================= الإحصاءات والرسوم ================= */
    function tripStats(t) {
        var dur = (t.t1 || t.t0) - t.t0;
        var mv = fin(t.moving) && t.moving > 0 ? t.moving : null;
        var avg = mv ? t.dist / (mv / 1000) : null;
        return { dur: t.noTime ? null : dur, moving: mv, avg: avg, max: fin(t.maxSpd) && t.maxSpd > 0 ? t.maxSpd : null, dist: t.dist, gap: t.gapDist || 0, n: t.pts.length };
    }
    function svgTrack(t, w, h) {
        if (t.pts.length < 2) return '<div class="hint">لا يوجد مسار كافٍ للرسم</div>';
        var mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9, k = Math.cos(t.pts[0][0] * Math.PI / 180);
        t.pts.forEach(function (p) { var x = p[1] * k, y = p[0]; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); });
        var sx = (mxx - mnx) || 1e-6, sy = (mxy - mny) || 1e-6, s = Math.min((w - 20) / sx, (h - 20) / sy);
        var ox = (w - sx * s) / 2, oy = (h - sy * s) / 2;
        var P = function (p) { return (ox + (p[1] * k - mnx) * s).toFixed(1) + ',' + (h - oy - (p[0] - mny) * s).toFixed(1); };
        var segs = {}, step = Math.max(1, Math.floor(t.pts.length / 800));
        t.pts.forEach(function (p, i) { if (i % step && i !== t.pts.length - 1) return; (segs[p[6]] = segs[p[6]] || []).push(P(p)); });
        var a = t.pts[0], b = t.pts[t.pts.length - 1];
        return '<svg class="lx-trk" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="رسم المسار">'
            + Object.keys(segs).map(function (k2) { return '<polyline points="' + segs[k2].join(' ') + '"/>'; }).join('')
            + '<circle class="s" cx="' + P(a).split(',')[0] + '" cy="' + P(a).split(',')[1] + '" r="6"/><circle class="e" cx="' + P(b).split(',')[0] + '" cy="' + P(b).split(',')[1] + '" r="6"/></svg>';
    }
    function svgChart(vals, unit, label) {
        vals = vals.filter(function (v) { return fin(v.y); });
        if (vals.length < 3) return '<div class="lx-chart-empty">' + esc(label) + ': لا توجد بيانات كافية</div>';
        var step = Math.max(1, Math.floor(vals.length / 240)), pts = vals.filter(function (_, i) { return i % step === 0; });
        var mn = Math.min.apply(null, pts.map(function (v) { return v.y; })), mx = Math.max.apply(null, pts.map(function (v) { return v.y; }));
        var x0 = pts[0].x, x1 = pts[pts.length - 1].x || 1, W = 320, H = 90, rng = (mx - mn) || 1;
        var d = pts.map(function (v, i) { return (i ? 'L' : 'M') + ((v.x - x0) / ((x1 - x0) || 1) * W).toFixed(1) + ' ' + (H - 6 - (v.y - mn) / rng * (H - 18)).toFixed(1); }).join('');
        return '<figure class="lx-chart"><figcaption>' + esc(label) + ' <b>' + Math.round(mn) + '–' + Math.round(mx) + ' ' + unit + '</b></figcaption>'
            + '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="' + d + '"/></svg></figure>';
    }
    function speedSeries(t) {
        var out = [];
        for (var i = 1; i < t.pts.length; i++) {
            var a = t.pts[i - 1], b = t.pts[i];
            if (a[6] !== b[6] || t.noTime) continue;
            var v = b[4] != null ? b[4] : geo(a[0], a[1], b[0], b[1]).m / Math.max(1, (b[2] - a[2]) / 1000);
            if (v <= V_MAX) out.push({ x: b[2], y: v * 3.6 });
        }
        return out;
    }

    /* ================= الواجهة ================= */
    var host = null;
    function card(title, inner, cls) { return '<section class="lx-sec ' + (cls || '') + '"><h3 class="lx-h">' + title + '</h3>' + inner + '</section>'; }
    function curHTML() {
        if (!cur) {
            return card('تسجيل رحلة', '<p class="hint">يسجّل مسارك بالزمن والسرعة والارتفاع، ويحفظه تلقائيًا كل بضع ثوانٍ، ويُستأنف لو أُغلق التطبيق.</p>'
                + '<button type="button" class="lx-btn lx-btn-gold lx-big" data-a="start">⏺ بدء تسجيل رحلة</button>', 'lx-rec-card');
        }
        var s = tripStats(cur), rec = cur.status === 'rec', b = bgText();
        return card(rec ? '<i class="lx-recdot"></i> التسجيل جارٍ' : '⏸ التسجيل متوقف مؤقتًا',
            '<div class="lx-tstats">'
            + '<div><small>المسافة</small><b id="trD">' + fmtD(s.dist) + '</b></div>'
            + '<div><small>المدة</small><b id="trT">' + fmtT(now() - cur.t0) + '</b></div>'
            + '<div><small>زمن الحركة</small><b id="trM">' + fmtT(s.moving || 0) + '</b></div>'
            + '<div><small>متوسط السرعة</small><b id="trA">' + (s.avg ? kmh(s.avg) + ' كم/س' : '—') + '</b></div>'
            + '<div><small>أقصى سرعة</small><b id="trX">' + (s.max ? kmh(s.max) + ' كم/س' : '—') + '</b></div>'
            + '<div><small>النقاط</small><b id="trN">' + s.n + '</b></div></div>'
            + (s.gap > 0 ? '<p class="hint" id="trG">+ ' + fmtD(s.gap) + ' قُطعت أثناء انقطاع التسجيل (غير مرسومة — خط مستقيم تقديري فقط)</p>' : '')
            + '<p class="lx-badge-line ' + b.c + '" id="trBg">' + esc(b.t) + '</p>'
            + '<div class="lx-btns">' + (rec ? '<button type="button" class="lx-btn" data-a="pause">⏸ إيقاف مؤقت</button>' : '<button type="button" class="lx-btn lx-btn-gold" data-a="resume">⏺ متابعة</button>')
            + '<button type="button" class="lx-btn lx-btn-bad" data-a="stop">⏹ إنهاء وحفظ</button>'
            + '<button type="button" class="lx-btn" data-a="map">🗺 على الخريطة</button></div>', 'lx-rec-card ' + (rec ? 'on' : ''));
    }
    function backHTML() {
        var t = srcTrip(), s = startPt(t), lg = lastGood();
        var inner = '';
        if (s) {
            inner += '<div class="lx-kv"><span>نقطة الانطلاق' + (t === cur ? ' (الرحلة الجارية)' : ' (آخر رحلة)') + '</span><b class="lx-ltr">' + coordTxt(s[0], s[1]) + '</b></div>'
                + '<div class="lx-kv"><span>المسافة المباشرة / الاتجاه</span><b id="bkDist">—</b></div>'
                + (tb ? '<div class="lx-kv"><span>المتبقي على المسار</span><b id="bkRem">' + fmtD(tb.rem) + '</b></div><div class="lx-kv"><span>بُعدك عن المسار</span><b id="bkOff">' + (tb.off != null ? fmtD(tb.off) : '—') + '</b></div>' : '')
                + '<div class="lx-choice">'
                + '<button type="button" class="lx-opt" data-a="track"><b>↩️ على نفس المسار</b><span>يتبع نقاط رحلتك المسجّلة رجوعًا — الطريق الذي سلكته فعلًا. الأنسب للسيارة.</span></button>'
                + '<button type="button" class="lx-opt warn" data-a="direct"><b>🏁 مباشر (خط مستقيم)</b><span>أقصر مسافة على الأرض. <u>ليس طريق سيارات مؤكدًا</u> وقد يعبر كثبانًا أو أودية أو عوائق.</span></button>'
                + '</div>'
                + '<div class="lx-btns">' + (tb ? '<button type="button" class="lx-btn" data-a="tbcancel">إلغاء العودة على المسار</button>' : '')
                + '<button type="button" class="lx-btn" data-a="cpstart">📋 نسخ إحداثيات البداية</button><button type="button" class="lx-btn" data-a="mapstart">🗺 على الخريطة</button></div>';
        } else inner += '<p class="hint">ابدأ تسجيل رحلة لتُحفظ نقطة الانطلاق، ثم يمكنك العودة إليها بخط مستقيم أو على نفس المسار.</p>';
        inner += '<div class="lx-kv lx-lg"><span>آخر موقع موثوق (±30 م أو أفضل)</span><b>' + (lg ? '<span class="lx-ltr">' + coordTxt(lg.lat, lg.lng) + '</span><small>' + fmtDate(lg.t) + ' · ±' + lg.acc + ' م</small>' : '—') + '</b></div>'
            + (lg ? '<button type="button" class="lx-btn" data-a="cplg">📋 نسخ آخر موقع موثوق</button>' : '');
        return card('العودة إلى نقطة الانطلاق', inner, 'lx-back-card');
    }
    function histHTML() {
        if (!list) return card('سجل الرحلات', '<p class="hint">جارٍ التحميل…</p>');
        var items = list.map(function (t) {
            var s = tripStats(t);
            return '<button type="button" class="lx-trip" data-id="' + esc(t.id) + '"><span class="lx-trip-n">' + esc(t.name) + (t.imported ? ' <em>مستورد</em>' : '') + '</span>'
                + '<span class="lx-trip-m">' + fmtD(s.dist) + (s.dur != null ? ' · ' + fmtT(s.dur) : '') + (t.noTime ? '' : ' · ' + fmtDate(t.t0)) + '</span></button>';
        }).join('');
        return card('سجل الرحلات <small>(' + list.length + ')</small>', (items || '<p class="hint">لا توجد رحلات محفوظة بعد.</p>')
            + '<div class="lx-btns"><button type="button" class="lx-btn" data-a="import">⬆️ استيراد GPX</button></div>');
    }
    function detailHTML(t) {
        var s = tripStats(t), alt = t.pts.filter(function (p) { return p[3] != null; }).map(function (p) { return { x: p[2], y: p[3] }; });
        return '<div class="lx-detail"><button type="button" class="lx-btn" data-a="back">→ رجوع للسجل</button>'
            + card(esc(t.name), svgTrack(t, 320, 200)
                + '<div class="lx-tstats">'
                + '<div><small>المسافة</small><b>' + fmtD(s.dist) + '</b></div>'
                + '<div><small>المدة</small><b>' + (s.dur != null ? fmtT(s.dur) : '—') + '</b></div>'
                + '<div><small>زمن الحركة</small><b>' + (s.moving ? fmtT(s.moving) : '—') + '</b></div>'
                + '<div><small>متوسط السرعة</small><b>' + (s.avg ? kmh(s.avg) + ' كم/س' : '—') + '</b></div>'
                + '<div><small>أقصى سرعة</small><b>' + (s.max ? kmh(s.max) + ' كم/س' : '—') + '</b></div>'
                + '<div><small>النقاط</small><b>' + s.n + '</b></div></div>'
                + '<div class="lx-kv"><span>البداية</span><b class="lx-ltr">' + coordTxt(t.pts[0][0], t.pts[0][1]) + '</b></div>'
                + '<div class="lx-kv"><span>النهاية</span><b class="lx-ltr">' + coordTxt(t.pts[t.pts.length - 1][0], t.pts[t.pts.length - 1][1]) + '</b></div>'
                + (t.noTime ? '' : '<div class="lx-kv"><span>التاريخ</span><b>' + fmtDate(t.t0) + '</b></div>')
                + svgChart(speedSeries(t), 'كم/س', 'السرعة')
                + svgChart(alt, 'م', 'الارتفاع')
                + '<div class="lx-btns">'
                + '<button type="button" class="lx-btn lx-btn-gold" data-a="dmap">🗺 على الخريطة</button>'
                + '<button type="button" class="lx-btn" data-a="dtrack">↩️ العودة على المسار</button>'
                + '<button type="button" class="lx-btn" data-a="ddirect">🏁 إلى البداية مباشرة</button>'
                + '<button type="button" class="lx-btn" data-a="gpx">⬇️ تصدير GPX</button>'
                + '<button type="button" class="lx-btn" data-a="rename">✏️ إعادة تسمية</button>'
                + '<button type="button" class="lx-btn lx-btn-bad" data-a="del">🗑 حذف</button></div>')
            + '</div>';
    }
    function draw() {
        if (!host || !host.isConnected) { host = null; return; }
        if (view.open) {
            var t = (list || []).find(function (x) { return x.id === view.open; }) || (cur && cur.id === view.open ? cur : null);
            if (t) { host.innerHTML = detailHTML(t); return; }
            view.open = null;
        }
        host.innerHTML = curHTML() + backHTML() + histHTML();
        upd();
    }
    function refresh() { if (host && host.isConnected) draw(); }
    function upd() {
        if (!host || !host.isConnected) return;
        var set = function (id, v) { var el = host.querySelector('#' + id); if (el && el.textContent !== v) el.textContent = v; };
        if (cur) {
            var s = tripStats(cur);
            set('trD', fmtD(s.dist)); set('trT', fmtT(now() - cur.t0)); set('trM', fmtT(s.moving || 0));
            set('trA', s.avg ? kmh(s.avg) + ' كم/س' : '—'); set('trX', s.max ? kmh(s.max) + ' كم/س' : '—'); set('trN', String(s.n));
        }
        var a = api(), L = a && a.live(), sp = startPt();
        if (sp) {
            if (L && L.fix && !L.stale) { var g = geo(L.fix.lat, L.fix.lng, sp[0], sp[1]); set('bkDist', fmtD(g.m) + ' · ' + Math.round(g.brg) % 360 + '° ' + a.dirLbl(g.brg)); }
            else set('bkDist', 'بانتظار موقع حالي');
        }
        if (tb) { set('bkRem', fmtD(tb.rem)); set('bkOff', tb.off != null ? fmtD(tb.off) : '—'); }
    }
    function onClick(e) {
        var b = e.target.closest('[data-a],[data-id]'); if (!b || !host.contains(b)) return;
        var A = b.getAttribute('data-a'), a = api();
        var t = view.open ? ((list || []).find(function (x) { return x.id === view.open; }) || cur) : null;
        if (!A && b.hasAttribute('data-id')) { view.open = b.getAttribute('data-id'); draw(); host.scrollIntoView({ block: 'start' }); return; }
        switch (A) {
            case 'start': start(); break;
            case 'pause': pause(); break;
            case 'resume': resume(); break;
            case 'stop': stop(); break;
            case 'map': if (window.GBS_MAP) window.GBS_MAP.focus('live'); a.go('map'); break;
            case 'track': goTrack(); break;
            case 'direct': goDirect(); break;
            case 'tbcancel': tbCancel(); break;
            case 'cpstart': { var s = startPt(); if (s) F.copy(coordTxt(s[0], s[1])); break; }
            case 'cplg': { var lg = lastGood(); if (lg) F.copy(coordTxt(lg.lat, lg.lng)); break; }
            case 'mapstart': if (window.GBS_MAP) window.GBS_MAP.focus('trip', srcTrip()); a.go('map'); break;
            case 'import': importGPX(); break;
            case 'back': view.open = null; draw(); break;
            case 'dmap': if (window.GBS_MAP) window.GBS_MAP.focus('trip', t); a.go('map'); break;
            case 'dtrack': goTrack(t); break;
            case 'ddirect': goDirect(t); break;
            case 'gpx': saveFile('gbs-' + new Date(t.t0).toISOString().slice(0, 10) + '-' + t.id.slice(-4) + '.gpx', toGPX(t), 'application/gpx+xml'); break;
            case 'rename': {
                var n = prompt('اسم الرحلة', t.name);
                if (n && n.trim()) { t.name = n.trim().slice(0, 80); Store.put(t).then(draw); }
                break;
            }
            case 'del':
                showConfirm('حذف الرحلة', 'حذف «' + t.name + '» نهائيًا؟', function () {
                    Store.del(t.id).then(function () { list = list.filter(function (x) { return x !== t; }); if (tb && tb.id === t.id) tbCancel(true); view.open = null; draw(); toast('حُذفت'); });
                });
                break;
        }
    }

    window.GBS_TRIPS = {
        render: function (body) {
            host = document.createElement('div');
            host.className = 'lx-trips';
            body.appendChild(host);
            host.addEventListener('click', onClick);
            draw();
        },
        update: function () { upd(); },
        /* للخريطة ووضع الصحراء والنسخ الاحتياطي */
        current: function () { return cur; },
        list: function () { return list || []; },
        ready: function () { return ready; },
        tb: function () { return tb; },
        startPt: startPt, srcTrip: srcTrip,
        start: start, pause: pause, resume: resume, stop: stop,
        goDirect: goDirect, goTrack: goTrack, lastGood: lastGood, bg: function () { return bgText(); },
        stats: function () { return { rej: stats.rej, jump: stats.jump, mode: Store.mode }; },
        exportAll: function () { return Store.all(); },
        importAll: function (arr) {
            if (!Array.isArray(arr)) return Promise.resolve(0);
            var have = {}; (list || []).forEach(function (t) { have[t.id] = 1; }); if (cur) have[cur.id] = 1;
            var add = arr.filter(function (t) { return t && typeof t.id === 'string' && Array.isArray(t.pts) && !have[t.id]; })
                .map(function (t) { if (t.status !== 'done') t.status = 'done'; return t; });
            return Promise.all(add.map(function (t) { return Store.put(t); })).then(function () { list = (list || []).concat(add).sort(function (x, y) { return y.t0 - x.t0; }); refresh(); return add.length; });
        },
        _toGPX: toGPX, _fromGPX: fromGPX
    };
})();
