/* مُستخرج من التطبيق الأصلي «منتصر النور» — لا تعديل على المنطق */
/* ================= GEO — طبقة الموقع المشتركة (الأذونات + الدقة) =================
   تُستخدم في أداة «GPS سهم الوجهة» وفي زر «موقعي» داخل البوصلة
   • أذونات: Capacitor (دقيق/تقريبي) + Permissions API + حالات: مرفوض / GPS مغلق / اتصال غير آمن
   • دقة: فلتر كالمان + رفض القفزات + متوسط مرجّح بالدقة + مسافة واتجاه على سطح WGS84 (Vincenty)
   • بوصلة: تعويض ميل الهاتف (مسطّح أو عمودي) + تصحيح الشمال من اتجاه حركتك
   ====================================================================================== */
(function () {
    'use strict';
    if (window.GEO)
        return;
    const R2D = 180 / Math.PI, D2R = Math.PI / 180;
    function capObj() { return window.Capacitor || null; }
    function isNative() { try {
        const c = capObj();
        return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
    }
    catch (e) {
        return false;
    } }
    function plugin(n) { const c = capObj(); return (c && c.Plugins && c.Plugins[n]) || null; }
    function wrap360(a) { return ((a % 360) + 360) % 360; }
    function wrap180(a) { return wrap360(a + 180) - 180; }
    function fin(v) { return typeof v === 'number' && isFinite(v); }
    /* ---------- الحسابات الجيوديسية: Vincenty على WGS84 (والرجوع لـ Haversine عند عدم التقارب) ---------- */
    function haversine(la1, lo1, la2, lo2) {
        const R = 6371008.8, dl = (la2 - la1) * D2R, dn = (lo2 - lo1) * D2R;
        const x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(la1 * D2R) * Math.cos(la2 * D2R) * Math.sin(dn / 2) * Math.sin(dn / 2);
        const m = 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
        const y = Math.sin(dn) * Math.cos(la2 * D2R);
        const xx = Math.cos(la1 * D2R) * Math.sin(la2 * D2R) - Math.sin(la1 * D2R) * Math.cos(la2 * D2R) * Math.cos(dn);
        return { m: m, brg: wrap360(Math.atan2(y, xx) * R2D) };
    }
    function geodesic(la1, lo1, la2, lo2) {
        if (!(fin(la1) && fin(lo1) && fin(la2) && fin(lo2)))
            return { m: NaN, brg: 0 };
        if (la1 === la2 && lo1 === lo2)
            return { m: 0, brg: 0 };
        const a = 6378137, f = 1 / 298.257223563, b = (1 - f) * a;
        const L = (lo2 - lo1) * D2R;
        const U1 = Math.atan((1 - f) * Math.tan(la1 * D2R)), U2 = Math.atan((1 - f) * Math.tan(la2 * D2R));
        const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
        let lam = L, lamP, it = 0, sS, cS, sig, sA, c2A, c2SM, C;
        do {
            const sL = Math.sin(lam), cL = Math.cos(lam);
            sS = Math.sqrt((cU2 * sL) * (cU2 * sL) + (cU1 * sU2 - sU1 * cU2 * cL) * (cU1 * sU2 - sU1 * cU2 * cL));
            if (sS === 0)
                return { m: 0, brg: 0 };
            cS = sU1 * sU2 + cU1 * cU2 * cL;
            sig = Math.atan2(sS, cS);
            sA = cU1 * cU2 * sL / sS;
            c2A = 1 - sA * sA;
            c2SM = c2A !== 0 ? cS - 2 * sU1 * sU2 / c2A : 0;
            C = f / 16 * c2A * (4 + f * (4 - 3 * c2A));
            lamP = lam;
            lam = L + (1 - C) * f * sA * (sig + C * sS * (c2SM + C * cS * (-1 + 2 * c2SM * c2SM)));
            if (Math.abs(lam) > Math.PI)
                return haversine(la1, lo1, la2, lo2);
        } while (Math.abs(lam - lamP) > 1e-12 && ++it < 100);
        if (it >= 100)
            return haversine(la1, lo1, la2, lo2);
        const u2 = c2A * (a * a - b * b) / (b * b);
        const A = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
        const B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
        const dS = B * sS * (c2SM + B / 4 * (cS * (-1 + 2 * c2SM * c2SM) - B / 6 * c2SM * (-3 + 4 * sS * sS) * (-3 + 4 * c2SM * c2SM)));
        const s = b * A * (sig - dS);
        const al1 = Math.atan2(cU2 * Math.sin(lam), cU1 * sU2 - sU1 * cU2 * Math.cos(lam));
        return { m: s, brg: wrap360(al1 * R2D) };
    }
    /* ---------- تنسيق الإحداثيات ---------- */
    function fmtDMS(v, isLat) {
        const h = isLat ? (v >= 0 ? 'ش' : 'ج') : (v >= 0 ? 'ق' : 'غ');
        v = Math.abs(v);
        let d = Math.floor(v), mm = Math.floor((v - d) * 60), s = ((v - d) * 60 - mm) * 60;
        s = Math.round(s * 10) / 10;
        if (s >= 60) {
            s = 0;
            mm += 1;
        }
        if (mm >= 60) {
            mm = 0;
            d += 1;
        }
        return d + '°' + (mm < 10 ? '0' : '') + mm + '\u2032' + (s < 10 ? '0' : '') + s.toFixed(1) + '\u2033 ' + h;
    }
    /* ---------- تصنيف الأخطاء ورسائلها ---------- */
    function classify(e) {
        const code = (e && typeof e.code !== 'undefined') ? Number(e.code) : NaN;
        const m = String((e && (e.message || e.errorMessage || e.error)) || (typeof e === 'string' ? e : '')).toLowerCase();
        if (/permissions? policy|feature policy|disabled in this document/.test(m))
            return 'policy';
        if (/not enabled|services? (are |is )?(disabled|off|not)|turned off|location (is )?(off|disabled)/.test(m))
            return 'disabled';
        if (code === 1 || /denied|not authori[sz]ed|permission|restricted/.test(m))
            return 'denied';
        if (code === 3 || /timeout|timed out/.test(m))
            return 'timeout';
        if (/not supported|unimplemented|not implemented/.test(m))
            return 'unsupported';
        if (code === 0)
            return 'unsupported';
        return 'unavailable';
    }
    const MSG = {
        denied: 'إذن الموقع مرفوض — فعّله من إعدادات الهاتف ← التطبيقات ← هذا التطبيق ← الأذونات ← الموقع',
        disabled: 'خدمة الموقع (GPS) مغلقة في الهاتف — شغّلها من لوحة الإعدادات السريعة ثم ارجع',
        unavailable: 'تعذّر تحديد الموقع — انتقل إلى مكان مكشوف وتأكد أن GPS مشغّل',
        unsupported: 'هذا الجهاز أو المتصفح لا يدعم تحديد الموقع',
        insecure: 'تحديد الموقع يتطلب اتصالًا آمنًا (HTTPS) — افتح التطبيق من الرابط الآمن أو من التطبيق المثبّت',
        policy: 'تحديد الموقع محجوب في هذه الصفحة (سياسة الأذونات) — افتح التطبيق في نافذة مستقلة',
        timeout: ''
    };
    function msg(k) { return Object.prototype.hasOwnProperty.call(MSG, k) ? MSG[k] : MSG.unavailable; }
    /* ---------- حالة الإذن ---------- */
    function fromCap(p) {
        p = p || {};
        const n = function (s) { return s === 'prompt-with-rationale' ? 'prompt' : s; };
        const f = n(p.location), c = n(p.coarseLocation);
        if (f === 'granted')
            return { state: 'granted', precise: true, src: 'cap' };
        if (c === 'granted')
            return { state: 'granted', precise: false, src: 'cap' };
        if (f === 'denied' || c === 'denied')
            return { state: 'denied', precise: null, src: 'cap' };
        return { state: 'prompt', precise: null, src: 'cap' };
    }
    async function check() {
        const G = plugin('Geolocation');
        if (G && typeof G.checkPermissions === 'function') {
            try {
                return fromCap(await G.checkPermissions());
            }
            catch (e) {
                const k = classify(e);
                if (k === 'disabled')
                    return { state: 'disabled', precise: null, src: 'cap' };
            }
        }
        if (!navigator.geolocation)
            return { state: 'unsupported', precise: null, src: 'none' };
        if (window.isSecureContext === false)
            return { state: 'insecure', precise: null, src: 'web' };
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            try {
                const st = await navigator.permissions.query({ name: 'geolocation' });
                return { state: st.state, precise: null, src: 'web' };
            }
            catch (e) { }
        }
        return { state: 'unknown', precise: null, src: 'web' };
    }
    async function request() {
        const G = plugin('Geolocation');
        if (G && typeof G.requestPermissions === 'function') {
            try {
                return fromCap(await G.requestPermissions());
            }
            catch (e) {
                const k = classify(e);
                if (k === 'disabled')
                    return { state: 'disabled', precise: null, src: 'cap', error: e };
                const r = await check();
                r.error = e;
                return r;
            }
        }
        if (!navigator.geolocation)
            return { state: 'unsupported', precise: null, src: 'none' };
        if (window.isSecureContext === false)
            return { state: 'insecure', precise: null, src: 'web' };
        return new Promise(function (res) {
            navigator.geolocation.getCurrentPosition(function () { check().then(res); }, function (err) {
                check().then(function (r) { if (classify(err) === 'denied')
                    r.state = 'denied'; r.error = err; res(r); });
            }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
        });
    }
    function onPermissionChange(cb) {
        let st = null, dead = false;
        try {
            if (navigator.permissions && typeof navigator.permissions.query === 'function') {
                navigator.permissions.query({ name: 'geolocation' }).then(function (s) {
                    if (dead)
                        return;
                    st = s;
                    s.onchange = function () { if (!dead)
                        cb(s.state); };
                }).catch(function () { });
            }
        }
        catch (e) { }
        return function () { dead = true; try {
            if (st)
                st.onchange = null;
        }
        catch (e) { } };
    }
    function hasSettingsOpener() { return !!plugin('NativeSettings'); }
    async function openSettings(kind) {
        const P = plugin('NativeSettings');
        if (!P || typeof P.open !== 'function')
            return false;
        try {
            await P.open({ optionAndroid: kind === 'location' ? 'location' : 'application_details', optionIOS: 'app' });
            return true;
        }
        catch (e) {
            return false;
        }
    }
    /* ---------- مراقبة الموقع: عالية الدقة + احتياط بدقة منخفضة عند تعذّر الإشارة ---------- */
    function watch(onPos, onErr) {
        const G = plugin('Geolocation');
        const h = { dead: false, ids: [], lowOn: false, stop: null };
        let timeouts = 0, gotFix = false;
        function emit(p, tag) { if (h.dead || !p || !p.coords)
            return; if (tag === 'high')
            gotFix = true; onPos(p, tag); }
        function fail(e, tag) {
            if (h.dead)
                return;
            const k = classify(e);
            if (k === 'timeout') {
                timeouts++;
                if (!gotFix && timeouts >= 2 && !h.lowOn) {
                    h.lowOn = true;
                    startOne(false);
                }
            }
            onErr(e, k, tag);
        }
        function startOne(high) {
            const tag = high ? 'high' : 'low';
            const o = high ? { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 } : { enableHighAccuracy: false, timeout: 30000, maximumAge: 15000 };
            const web = function () {
                if (!navigator.geolocation) {
                    onErr({ code: 0 }, 'unsupported', tag);
                    return;
                }
                const id = navigator.geolocation.watchPosition(function (p) { emit(p, tag); }, function (e) { fail(e, tag); }, o);
                h.ids.push({ k: 'web', id: id });
            };
            if (G && typeof G.watchPosition === 'function') {
                let p;
                /* على أندرويد (Capacitor) قيمة timeout في watchPosition تُستخدم كفاصل بين التحديثات، فنجعلها صغيرة لتصل المواقع بسرعة.
                   [ثبات الإشارة] minimumUpdateInterval افتراضيه في Capacitor 6 = 5000 م.ث: كان يحدّ التحديثات بواحد كل ~5 ث
                   فتبدو القراءة «قديمة» وتنقطع. نخفضه إلى ثانية واحدة */
                const oc = high ? { enableHighAccuracy: true, timeout: 1500, maximumAge: 0, interval: 1000, minimumUpdateInterval: 1000 } : { enableHighAccuracy: false, timeout: 5000, maximumAge: 0, minimumUpdateInterval: 2000 };
                try {
                    p = Promise.resolve(G.watchPosition(oc, function (pos, err) { if (err)
                        fail(err, tag);
                    else
                        emit(pos, tag); }));
                }
                catch (e) {
                    p = Promise.reject(e);
                }
                p.then(function (id) {
                    if (h.dead) {
                        try {
                            G.clearWatch({ id: id });
                        }
                        catch (e) { }
                        return;
                    }
                    h.ids.push({ k: 'cap', id: id });
                }).catch(function (e) {
                    const k = classify(e);
                    if (k === 'denied' || k === 'disabled') {
                        fail(e, tag);
                        return;
                    }
                    if (!h.dead)
                        web();
                });
            }
            else
                web();
        }
        h.stop = function () {
            h.dead = true;
            h.ids.forEach(function (x) {
                try {
                    if (x.k === 'cap') {
                        const g = plugin('Geolocation');
                        if (g)
                            g.clearWatch({ id: x.id });
                    }
                    else if (navigator.geolocation)
                        navigator.geolocation.clearWatch(x.id);
                }
                catch (e) { }
            });
            h.ids = [];
        };
        startOne(true);
        return h;
    }
    /* ---------- فلتر كالمان + رفض القفزات ---------- */
    function Filter() { this.reset(); }
    Filter.prototype.reset = function () { this.lat = 0; this.lng = 0; this.v = -1; this.t = 0; this.rej = 0; this.mv = 0; };
    Filter.prototype.update = function (lat, lng, acc, t, speed) {
        acc = Math.max(1, acc);
        if (this.v < 0) {
            this.lat = lat;
            this.lng = lng;
            this.v = acc * acc;
            this.t = t;
            this.rej = 0;
            return { lat: lat, lng: lng, jump: false };
        }
        const dt = Math.max(0, (t - this.t) / 1000);
        const d = geodesic(this.lat, this.lng, lat, lng).m;
        const maxMove = Math.max(Math.sqrt(this.v), acc) * 3 + 40 * Math.max(dt, 1);
        if (d > maxMove && acc >= Math.sqrt(this.v) * 0.7) {
            this.rej++;
            if (this.rej < 2)
                return null;
            this.lat = lat;
            this.lng = lng;
            this.v = acc * acc;
            this.t = t;
            this.rej = 0;
            return { lat: lat, lng: lng, jump: true };
        }
        this.rej = 0;
        const R = acc * acc;
        /* كشف الوقوف: سرعة صغيرة وإزاحة ضمن ضجيج الإشارة → نثبّت الموقع بدل التذبذب (يتوقف الرقم والسهم عن التخبّط) */
        const spd0 = (fin(speed) && speed >= 0) ? speed : null;
        if (d > Math.max(acc * 1.1, 3.5))
            this.mv = (this.mv || 0) + 1;
        else
            this.mv = 0;
        const moving = (spd0 !== null && spd0 >= 0.6) || this.mv >= 2;
        if (!moving) {
            this.lat += 0.08 * (lat - this.lat);
            this.lng += 0.08 * (lng - this.lng);
            this.v = Math.max(1, Math.min(this.v, R));
            this.t = t;
            return { lat: this.lat, lng: this.lng, jump: false };
        }
        /* ضجيج الحركة: كان صغيرًا جدًا (0.8) فيجعل الفلتر "ثقيلًا" ويتأخر عن مشي المستخدم */
        const sp = (fin(speed) && speed >= 0) ? speed : 2;
        const q = Math.max(2.5, 1.5 + sp * 1.2);
        if (dt > 0)
            this.v = Math.min(1e6, this.v + dt * q * q);
        /* تكيّف: لو الإزاحة أكبر من المتوقع بكثير فهذه حركة حقيقية → نرفع التباين ليلحق الفلتر بسرعة */
        const S = this.v + R;
        if (d * d > 2.25 * S)
            this.v += d * d - S;
        let k = this.v / (this.v + R);
        /* حد أدنى للثقة في القراءة الجديدة حسب دقتها: كلما كانت الإشارة أدق قلّ التأخير */
        const kMin = acc <= 5 ? 0.7 : (acc <= 10 ? 0.55 : (acc <= 20 ? 0.4 : 0.25));
        if (k < kMin)
            k = kMin;
        this.lat += k * (lat - this.lat);
        this.lng += k * (lng - this.lng);
        this.v = Math.max(1, (1 - k) * this.v);
        this.t = t;
        return { lat: this.lat, lng: this.lng, jump: false };
    };
    /* ---------- متوسط مرجّح بالدقة (لحفظ المواقع) ---------- */
    function average(samples) {
        let s = (samples || []).filter(function (x) { return x && fin(x.lat) && fin(x.lng) && fin(x.acc) && x.acc > 0; });
        if (!s.length)
            return null;
        const best = Math.min.apply(null, s.map(function (x) { return x.acc; }));
        s = s.filter(function (x) { return x.acc <= Math.max(best * 2.5, best + 8); });
        const lat0 = s[0].lat, lng0 = s[0].lng;
        const mY = 111132.92, mX = 111412.84 * Math.cos(lat0 * D2R);
        function centroid(arr) {
            let sw = 0, sx = 0, sy = 0;
            arr.forEach(function (x) { const w = 1 / (x.acc * x.acc); sw += w; sx += w * (x.lng - lng0) * mX; sy += w * (x.lat - lat0) * mY; });
            return { x: sx / sw, y: sy / sw, sw: sw };
        }
        let c = centroid(s);
        if (s.length >= 4) {
            const keep = s.filter(function (x) {
                const dx = (x.lng - lng0) * mX - c.x, dy = (x.lat - lat0) * mY - c.y;
                return Math.sqrt(dx * dx + dy * dy) <= Math.max(2.5 * x.acc, 10);
            });
            if (keep.length >= 2) {
                s = keep;
                c = centroid(s);
            }
        }
        const acc = Math.max(2, Math.min(best, Math.max(0.7 * best, Math.sqrt(1 / c.sw) * 2)));
        return { lat: lat0 + c.y / mY, lng: lng0 + c.x / mX, acc: acc, n: s.length, best: best };
    }
    /* ---------- تثبيت موقع دقيق لمرة واحدة (يستخدمه زر موقعي في البوصلة) ---------- */
    async function getPrecise(o) {
        o = o || {};
        const maxMs = o.maxMs || 9000, target = o.targetAcc || 12;
        let perm = await check();
        if (perm.state === 'prompt' || perm.state === 'unknown') {
            perm = await request();
        }
        if (perm.state !== 'granted' && !(perm.state === 'unknown' || perm.state === 'prompt')) {
            return { ok: false, kind: perm.state, msg: msg(perm.state === 'disabled' ? 'disabled' : (perm.state === 'denied' ? 'denied' : perm.state)) };
        }
        return new Promise(function (resolve) {
            const buf = [];
            const t0 = Date.now();
            let done = false, lastErr = null, h = null, flt = new Filter();
            function finish() {
                if (done)
                    return;
                done = true;
                try {
                    if (h)
                        h.stop();
                }
                catch (e) { }
                const a = average(buf);
                if (a)
                    resolve({ ok: true, lat: a.lat, lng: a.lng, acc: a.acc, n: a.n });
                else {
                    const k = lastErr || 'unavailable';
                    resolve({ ok: false, kind: k, msg: msg(k) || msg('unavailable') });
                }
            }
            h = watch(function (p, tag) {
                const c = p.coords;
                if (!fin(c.latitude) || !fin(c.longitude))
                    return;
                const acc = fin(c.accuracy) && c.accuracy > 0 ? c.accuracy : 100;
                if (flt.update(c.latitude, c.longitude, acc, p.timestamp || Date.now(), c.speed) === null)
                    return;
                buf.push({ lat: c.latitude, lng: c.longitude, acc: acc });
                const a = average(buf);
                if (o.onProgress)
                    o.onProgress(Date.now() - t0, a);
                if (a && a.n >= 3 && a.acc <= target)
                    finish();
            }, function (e, k) { if (k !== 'timeout')
                lastErr = k; if (k === 'denied' || k === 'disabled' || k === 'unsupported')
                finish(); });
            setTimeout(finish, maxMs);
        });
    }
    /* ---------- بوصلة بتعويض الميل: تعمل والهاتف مسطّح أو منتصب ---------- */
    function headingFromEuler(alpha, beta, gamma, sa) {
        if (!fin(alpha))
            return null;
        const x = (fin(beta) ? beta : 0) * D2R, y = (fin(gamma) ? gamma : 0) * D2R, z = alpha * D2R;
        const cX = Math.cos(x), sX = Math.sin(x), cY = Math.cos(y), sY = Math.sin(y), cZ = Math.cos(z), sZ = Math.sin(z);
        const bE = -(cZ * sY + cY * sX * sZ), bN = -(sZ * sY - cZ * cY * sX); /* اتجاه ظهر الهاتف (الكاميرا الخلفية) */
        const tE = -cX * sZ, tN = cX * cZ; /* اتجاه أعلى الشاشة */
        const tilt = Math.abs(cX * cY);
        let w = (tilt - 0.35) / 0.4;
        w = w < 0 ? 0 : (w > 1 ? 1 : w);
        w = w * w * (3 - 2 * w);
        const bm = Math.hypot(bE, bN), tm = Math.hypot(tE, tN);
        const hb = Math.atan2(bE, bN) * R2D, ht = Math.atan2(tE, tN) * R2D + (fin(sa) ? sa : 0);
        let wt = w, wb = 1 - w;
        if (bm < 0.05) {
            wt = 1;
            wb = 0;
        }
        if (tm < 0.05) {
            wt = 0;
            wb = 1;
        }
        const E = wt * Math.sin(ht * D2R) + wb * Math.sin(hb * D2R);
        const N = wt * Math.cos(ht * D2R) + wb * Math.cos(hb * D2R);
        if (Math.hypot(E, N) < 1e-6)
            return null;
        return { h: wrap360(Math.atan2(E, N) * R2D), flat: wt };
    }
    function screenAngle() {
        try {
            if (window.screen && screen.orientation && fin(screen.orientation.angle))
                return screen.orientation.angle;
            if (fin(window.orientation))
                return wrap360(window.orientation);
        }
        catch (e) { }
        return 0;
    }
    window.GEO = {
        env: function () { return { native: isNative(), secure: window.isSecureContext !== false, hasWeb: !!navigator.geolocation, hasPlugin: !!plugin('Geolocation') }; },
        check: check, request: request, onPermissionChange: onPermissionChange,
        openSettings: openSettings, hasSettingsOpener: hasSettingsOpener,
        watch: watch, Filter: Filter, average: average, getPrecise: getPrecise,
        geodesic: geodesic, headingFromEuler: headingFromEuler, screenAngle: screenAngle,
        classify: classify, msg: msg, fmtDMS: fmtDMS, wrap360: wrap360, wrap180: wrap180
    };
})();
