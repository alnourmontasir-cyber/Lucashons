/* ================= إضافات الرئيسية والحالة + وضع الصحراء =================
   كلها تقرأ من GBS_API.live() فقط — لا تغيّر منطق GPS أو البوصلة.
   قاعدة: لا تُعرض قيمة غير متاحة كصفر، ولا قيمة قديمة كأنها مباشرة.
   ======================================================================= */
(function () {
    'use strict';
    var F = window.FUN, esc = function (s) { return F.esc(s); };
    var DKEY = 'gbs.desert';
    function fin(x) { return typeof x === 'number' && isFinite(x); }
    function api() { return window.GBS_API; }
    function T() { return window.GBS_TRIPS; }
    function deg(h) { return (Math.round(h) % 360) + '°'; }
    function ago(ms) {
        if (ms == null) return '—';
        var s = Math.round(ms / 1000);
        if (s < 2) return 'الآن';
        if (s < 60) return 'قبل ' + s + ' ث';
        if (s < 3600) return 'قبل ' + Math.round(s / 60) + ' د';
        return 'قبل ' + Math.round(s / 3600) + ' س';
    }

    /* ---------- مؤشر الثقة: أخضر / برتقالي / أحمر مع السبب ---------- */
    function confidence(L) {
        if (!L.fix) return { c: 'bad', t: 'لا يوجد موقع بعد', r: L.err || 'بانتظار إشارة GPS' };
        if (L.stale) return { c: 'bad', t: 'ثقة منخفضة', r: 'آخر قراءة ' + ago(L.age) + ' — القيم ليست مباشرة' };
        var acc = L.fix.acc, why = [];
        if (acc > 50) return { c: 'bad', t: 'ثقة منخفضة', r: 'دقة الموقع ضعيفة (±' + Math.round(acc) + ' م)' };
        if (acc > 15) why.push('الدقة ±' + Math.round(acc) + ' م');
        if (L.age > 3000) why.push('القراءة ' + ago(L.age));
        if (!L.heading) why.push('الاتجاه غير متاح');
        else if (L.heading.src === 's' && L.sensor.offN === 0) why.push('البوصلة غير مُعايَرة من الحركة بعد');
        if (L.resumed && Date.now() - L.resumed < 8000) why.push('عودة من الخلفية للتو');
        if (why.length) return { c: 'warn', t: 'ثقة متوسطة', r: why.join(' · ') };
        return { c: 'ok', t: 'ثقة عالية', r: 'دقة ±' + Math.round(acc) + ' م · قراءة حديثة · الاتجاه ' + (L.heading.src === 'g' ? 'من مسار الحركة' : 'من البوصلة المُعايَرة') };
    }
    function compassState(L) {
        var s = L.sensor;
        if (s.ori === 'denied') return { c: 'bad', t: 'إذن الحساس مرفوض' };
        if (s.ori === 'unsupported' || s.ori === 'nodata') return { c: 'bad', t: 'لا يوجد حساس اتجاه — يُستعمل مسار الحركة فقط' };
        if (!s.live) return { c: 'warn', t: 'الحساس لا يرسل الآن' };
        var kind = s.rel ? 'نسبية' : 'مطلقة';
        if (s.offN > 0) return { c: 'ok', t: 'بوصلة ' + kind + ' · مُعايَرة من الحركة (شمال حقيقي)' };
        if (s.rel) return { c: 'bad', t: 'بوصلة نسبية غير مُعايَرة — امشِ أو قُد دقيقة' };
        var d = +api().opt('decl') || 0;
        return { c: 'warn', t: 'بوصلة مطلقة · غير مُعايَرة · ' + (d ? 'شمال حقيقي بانحراف يدوي ' + d + '°' : 'شمال مغناطيسي') };
    }
    function interference(L) {
        /* أثناء الحركة السريعة: فرق كبير بين البوصلة واتجاه الحركة = تداخل مغناطيسي أو الهاتف غير موجّه للأمام */
        if (!L.course || L.course.sp < 4 || L.phone == null) return null;
        var d = Math.abs(((L.phone - L.course.h) % 360 + 540) % 360 - 180);
        return d > 25 ? Math.round(d) : null;
    }

    /* ---------- لوحة البوصلة الذكية (الرئيسية) ----------
       لا نكرر أي حساب: ننقل خانات الأداة نفسها (السرعة، الدقة، الإشارة، الإحداثيات، الارتفاع) إلى زوايا اللوحة،
       فتبقى الأداة هي من يحدّثها كما كانت. نضيف فقط اتجاه الهاتف ومسار الحركة وعمر القراءة والمعايرة من live(). */
    var homeEl = null, dashEl = null, ZKEY = 'gbs.dialz';
    function dialZ() { try { var z = +localStorage.getItem(ZKEY); return z >= 1 && z <= 3 ? z : 1; } catch (e) { return 1; } }
    var TRAVEL = { auto: { i: '🔄', t: 'تلقائي' }, car: { i: '🚗', t: 'سيارة' }, walk: { i: '🚶', t: 'مشي' } };
    function cellOf(body, id) { var b = body.querySelector('#' + id); return b ? b.closest('.gps-cell') : null; }
    function buildDash(body) {
        var panel = body.querySelector(':scope > .gps-panel'), dial = panel && panel.querySelector('.gps-dial');
        if (!panel || !dial) return null;
        panel.classList.add('lx-dash');
        var mid = document.createElement('div');
        mid.className = 'lx-mid lx-z' + dialZ();
        dial.parentNode.insertBefore(mid, dial);
        mid.appendChild(dial);
        var tr = api().opt('travel') || 'auto', T0 = TRAVEL[tr] || TRAVEL.auto;
        var A = api(), sel = A.live().sel;
        mid.insertAdjacentHTML('beforeend',
            '<div class="lx-k k1"><small>اتجاه الهاتف</small><b id="xPhone">—</b></div>'
            + '<div class="lx-k k2" id="xK2"></div>'
            + '<div class="lx-k k3" id="xK3"></div>'
            + '<div class="lx-k k4"><small>مسار الحركة</small><b id="xCourse">—</b></div>'
            + '<div class="lx-rail r1">'
            + '<button type="button" data-x="zoom" title="حجم البوصلة" aria-label="حجم البوصلة"><i>⤢</i><span>الحجم</span></button>'
            + '<button type="button" data-x="travel" title="وضع التنقل (لتقدير الوقت)" aria-label="وضع التنقل"><i id="xTrI">' + T0.i + '</i><span id="xTrT">' + T0.t + '</span></button>'
            + '<button type="button" data-x="reset" title="إعادة ضبط معايرة البوصلة" aria-label="إعادة ضبط البوصلة"><i>↺</i><span>معايرة</span></button>'
            + '</div><div class="lx-rail r2">'
            + '<button type="button" data-x="desert" title="وضع الصحراء" aria-label="وضع الصحراء"><i>🏜</i><span>صحراء</span></button>'
            + '<button type="button" data-x="nav" class="' + (sel ? 'on' : '') + '" title="' + (sel ? 'إيقاف التوجيه' : 'بدء التوجيه') + '" aria-label="التوجيه"><i>' + (sel ? '⏹' : '▶') + '</i><span>' + (sel ? 'إيقاف' : 'توجيه') + '</span></button>'
            + '<button type="button" data-x="dests" title="الوجهات" aria-label="الوجهات"><i>📍</i><span>وجهات</span></button>'
            + '<button type="button" data-x="trips" title="الرحلات" aria-label="الرحلات"><i>〰</i><span>رحلات</span></button>'
            + '</div>');
        var k2 = cellOf(body, 'gpsSpd'), k3 = cellOf(body, 'gpsAcc');
        if (k2) mid.querySelector('#xK2').appendChild(k2);
        if (k3) mid.querySelector('#xK3').appendChild(k3);
        /* شريط المعلومات أسفل الدائرة داخل اللوحة */
        var strip = document.createElement('div');
        strip.className = 'lx-strip';
        strip.innerHTML = '<div class="lx-sgrid" id="xSG"></div>'
            + '<div class="lx-sline"><span class="lx-conf" id="xConf"><i></i><b></b></span><span id="xAge">—</span><span class="lx-sat" title="أندرويد والمتصفح لا يتيحان عدد الأقمار لتطبيقات الويب">الأقمار: غير متاح</span><span class="lx-cmp" id="xCmp"></span></div>'
            + '<p class="lx-confr" id="xConfR"></p>';
        panel.appendChild(strip);
        var sg = strip.querySelector('#xSG');
        ['gpsLat', 'gpsAlt', 'gpsSig'].forEach(function (id) { var c = cellOf(body, id); if (c) sg.appendChild(c); });
        /* ما تبقى في الشبكة (اتجاه الأداة المعتمد للسهم) يبقى مخفيًا لكنه يُحدَّث كما كان */
        var grid = body.querySelector(':scope > .gps-grid'); if (grid) grid.classList.add('lx-emptied');
        mid.addEventListener('click', onDash);
        return panel;
    }
    function onDash(e) {
        var b = e.target.closest('[data-x]'); if (!b) return;
        var A = api(), k = b.getAttribute('data-x');
        if (k === 'zoom') {
            var z = dialZ() % 3 + 1; try { localStorage.setItem(ZKEY, String(z)); } catch (er) { }
            var m = b.closest('.lx-mid'); m.classList.remove('lx-z1', 'lx-z2', 'lx-z3'); m.classList.add('lx-z' + z);
        } else if (k === 'travel') {
            var order = ['auto', 'car', 'walk'], cur = A.opt('travel') || 'auto', nx = order[(order.indexOf(cur) + 1) % 3];
            A.setOpt('travel', nx === 'auto' ? null : nx);
            set2(b.querySelector('#xTrI'), TRAVEL[nx].i); set2(b.querySelector('#xTrT'), TRAVEL[nx].t);
            toast('وضع التنقل: ' + TRAVEL[nx].t + ' — يُستعمل لتقدير الوقت حين لا تتوفر سرعتك الحالية');
        } else if (k === 'reset') {
            showConfirm('إعادة ضبط البوصلة', 'سيُمسح تصحيح الاتجاه المحفوظ، ويعاير التطبيق البوصلة من جديد بعد دقيقة مشي أو قيادة. متابعة؟', function () { A.resetCal(); updHome(); });
        } else if (k === 'desert') openDesert();
        else if (k === 'nav') { if (A.live().sel) showConfirm('إيقاف التوجيه', 'إيقاف التوجيه إلى الوجهة الحالية؟ (الوجهة تبقى محفوظة)', function () { A.stopNav(); }); else A.go('dest'); }
        else if (k === 'dests') A.go('dest');
        else if (k === 'trips') A.go('trip');
    }
    function homeHTML() {
        return '<p class="lx-warnline" id="xInt" hidden></p>'
            + '<div class="lx-xbtns"><button type="button" data-x="rec" id="xRec">⏺ تسجيل رحلة</button><button type="button" data-x="back">↩️ العودة للبداية</button></div>';
    }
    function updHome() {
        if (!homeEl || !homeEl.isConnected) return;
        var A = api(); if (!A) return;
        var L = A.live(), root = homeEl.parentNode, set = function (id, v) { var e = root.querySelector('#' + id); if (e && e.textContent !== v) e.textContent = v; };
        var c = confidence(L), ce = root.querySelector('#xConf');
        if (ce) { ce.className = 'lx-conf ' + c.c; set2(ce.querySelector('b'), c.t); }
        set('xConfR', c.r); var cr = root.querySelector('#xConfR'); if (cr) cr.className = 'lx-confr ' + c.c;
        set('xCourse', L.course && !L.stale ? deg(L.course.h) + ' ' + A.dirLbl(L.course.h) : (L.stale ? '—' : 'واقف'));
        set('xPhone', L.phone != null ? deg(L.phone) + ' ' + A.dirLbl(L.phone) : 'غير متاح');
        set('xAge', 'آخر تحديث: ' + (L.fixAt ? ago(L.age) : '—'));
        var cs = compassState(L), cm = root.querySelector('#xCmp'); if (cm) { cm.className = 'lx-cmp ' + cs.c; set2(cm, 'البوصلة: ' + cs.t); }
        var it = interference(L), ie = homeEl.querySelector('#xInt');
        ie.hidden = !it; if (it) set2(ie, '⚠ فرق ' + it + '° بين البوصلة واتجاه الحركة: تداخل مغناطيسي محتمل أو الهاتف غير موجّه للأمام. السهم يعتمد الآن مسار الحركة.');
        var cur = T() && T().current(), rb = homeEl.querySelector('#xRec');
        set2(rb, cur ? (cur.status === 'rec' ? '● يسجّل — الرحلات' : '⏸ متوقف — الرحلات') : '⏺ تسجيل رحلة');
        rb.classList.toggle('on', !!(cur && cur.status === 'rec'));
    }
    function set2(el, v) { if (el && el.textContent !== v) el.textContent = v; }

    /* ---------- إضافات «الحالة» ---------- */
    function infoHTML() {
        var A = api(), d = +A.opt('decl') || 0;
        return '<section class="lx-sec lx-info-x"><h3 class="lx-h">الشمال الحقيقي والمغناطيسي</h3>'
            + '<p class="hint">الاتجاه إلى الوجهة محسوب من <b>الشمال الحقيقي</b>. حساس الهاتف يقيس <b>الشمال المغناطيسي</b>. بعد دقيقة حركة يعاير التطبيق البوصلة من مسار GPS فيصحّح الفرق تلقائيًا. قبل ذلك يمكنك إدخال الانحراف المغناطيسي لمنطقتك يدويًا (شرقًا موجب، غربًا سالب). اتركه 0 إن لم تعرفه.</p>'
            + '<div class="lx-kv"><span>الانحراف المغناطيسي اليدوي</span><b><input id="xDecl" type="number" step="0.5" min="-30" max="30" inputmode="decimal" dir="ltr" value="' + d + '" style="width:90px;padding:6px 8px;text-align:center"> °</b></div>'
            + '</section>'
            + '<section class="lx-sec lx-info-x"><h3 class="lx-h">الرحلات والخريطة والتخزين</h3><div id="xStore"></div></section>'
            + '<section class="lx-sec lx-info-x"><h3 class="lx-h">الخصوصية</h3><p class="hint">كل المواقع والوجهات والرحلات تُحفظ على هاتفك فقط ولا تُرسل لأي خادم. الإنترنت يُستعمل فقط لتحميل بلاطات الخريطة وللبحث عن مكان بالاسم إن طلبته. الملاحة والسهم والتسجيل تعمل دون إنترنت.</p></section>';
    }
    var infoEl = null, infoAt = 0;
    function updInfo() {
        if (!infoEl || !infoEl.isConnected || Date.now() - infoAt < 3000) return;
        infoAt = Date.now();
        var box = infoEl.querySelector('#xStore'); if (!box) return;
        var t = T(), st = t ? t.stats() : null, bgt = t ? t.bg() : null;
        Promise.all([window.GBS_STORE ? GBS_STORE.estimate() : null, window.GBS_MAP ? GBS_MAP.tileCount() : null,
            navigator.storage && navigator.storage.persisted ? navigator.storage.persisted().catch(function () { return null; }) : null]).then(function (r) {
            var est = r[0], tiles = r[1], pers = r[2];
            var rows = [
                ['الرحلات المحفوظة', t ? String(t.list().length) + (t.current() ? ' + رحلة جارية' : '') : '—'],
                ['مكان التخزين', st ? (st.mode === 'idb' ? 'قاعدة بيانات الهاتف (IndexedDB)' : 'تخزين بديل (localStorage)') : '—'],
                ['تخزين دائم محمي من الحذف التلقائي', pers == null ? 'غير معروف' : (pers ? 'نعم' : 'لا (قد يحذفه النظام عند امتلاء المساحة — صدّر نسخة احتياطية)')],
                ['المساحة المستعملة', est && est.usage != null ? (est.usage / 1048576).toFixed(1) + ' م.ب' + (est.quota ? ' من ' + Math.round(est.quota / 1048576) + ' م.ب' : '') : 'غير متاح'],
                ['بلاطات الخريطة المحفوظة', tiles == null ? 'غير متاح' : String(tiles)],
                ['نقاط مرفوضة في التسجيل (دقة ضعيفة / قفزات)', st ? st.rej + ' / ' + st.jump : '—'],
                ['التسجيل في الخلفية', bgt ? bgt.t : '—']
            ];
            box.innerHTML = rows.map(function (x) { return '<div class="lx-kv"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
        });
    }

    /* ================= وضع الصحراء ================= */
    var ds = loadD(), dEl = null, dTimer = 0, dWl = null, lostBuzz = false;
    function loadD() { var d = { theme: 'sun', dim: 0, eco: false, open: false }; try { Object.assign(d, JSON.parse(localStorage.getItem(DKEY) || '{}')); } catch (e) { } return d; }
    function saveD() { try { localStorage.setItem(DKEY, JSON.stringify(ds)); } catch (e) { } }
    function openDesert() {
        if (dEl) return;
        ds.open = true; saveD();
        dEl = document.createElement('div');
        dEl.id = 'lxDesert';
        dEl.setAttribute('role', 'dialog'); dEl.setAttribute('aria-label', 'وضع الصحراء');
        dEl.innerHTML = '<div class="dz-top">'
            + '<button type="button" data-d="close" aria-label="إغلاق">✕</button>'
            + '<button type="button" data-d="theme" id="dzTheme"></button>'
            + '<button type="button" data-d="eco" id="dzEco"></button>'
            + '<label class="dz-dim">🔅<input type="range" min="0" max="70" step="5" id="dzDim" aria-label="تعتيم الشاشة"></label></div>'
            + '<div class="dz-alert" id="dzAlert" hidden></div>'
            + '<div class="dz-nav"><svg viewBox="0 0 100 100" id="dzArrowSvg"><g id="dzArrow"><path d="M50 6 L76 78 L50 64 L24 78 Z"/></g></svg>'
            + '<div class="dz-dist"><b id="dzDist">—</b><span id="dzName"></span><small id="dzNote"></small></div></div>'
            + '<div class="dz-grid">'
            + '<div><small>السرعة كم/س</small><b id="dzSpd">—</b></div>'
            + '<div><small>الدقة</small><b id="dzAcc">—</b></div>'
            + '<div><small>الاتجاه</small><b id="dzHdg">—</b></div>'
            + '<div><small>آخر قراءة</small><b id="dzAge">—</b></div>'
            + '<div class="dz-crd"><small>الإحداثيات</small><b id="dzCrd" dir="ltr">—</b></div>'
            + '<div class="dz-trip"><small>الرحلة</small><b id="dzTrip">—</b></div>'
            + '</div>'
            + '<div class="dz-bot"><button type="button" data-d="back">↩️ العودة للبداية</button><button type="button" data-d="rec" id="dzRec"></button><button type="button" data-d="copy">📋 نسخ موقعي</button></div>'
            + '<div class="dz-shade" id="dzShade"></div>';
        document.body.appendChild(dEl);
        dEl.addEventListener('click', onD);
        dEl.querySelector('#dzDim').addEventListener('input', function () { ds.dim = +this.value; saveD(); paintD(); });
        document.documentElement.classList.add('lx-desert-on');
        wake();
        paintD();
        updD();
        loopD();
    }
    function closeDesert() {
        if (!dEl) return;
        ds.open = false; saveD();
        clearInterval(dTimer); dTimer = 0;
        dEl.remove(); dEl = null;
        document.documentElement.classList.remove('lx-desert-on');
        try { if (dWl) dWl.release(); } catch (e) { } dWl = null;
    }
    function loopD() { clearInterval(dTimer); dTimer = setInterval(updD, ds.eco ? 2000 : 250); }
    function wake() {
        try {
            if (navigator.wakeLock && !dWl && document.visibilityState === 'visible')
                navigator.wakeLock.request('screen').then(function (w) { dWl = w; w.addEventListener('release', function () { dWl = null; }); }).catch(function () { });
        } catch (e) { }
    }
    document.addEventListener('visibilitychange', function () { if (dEl && document.visibilityState === 'visible') wake(); });
    function paintD() {
        if (!dEl) return;
        dEl.className = 'dz-' + ds.theme + (ds.eco ? ' dz-eco' : '');
        dEl.querySelector('#dzTheme').textContent = ds.theme === 'sun' ? '☀ نهار' : '🌙 ليل';
        dEl.querySelector('#dzEco').textContent = ds.eco ? '🔋 توفير: يعمل' : '🔋 توفير';
        dEl.querySelector('#dzDim').value = ds.dim;
        dEl.querySelector('#dzShade').style.opacity = String(ds.dim / 100);
    }
    var lastRot = null;
    function updD() {
        if (!dEl) return;
        var A = api(); if (!A) return;
        var L = A.live(), set = function (id, v) { var e = dEl.querySelector('#' + id); if (e && e.textContent !== v) e.textContent = v; };
        var ok = L.fix && !L.stale;
        set('dzSpd', ok && fin(L.spd) ? String(Math.round(L.spd * 3.6)) : '—');
        set('dzAcc', L.fix ? '±' + Math.round(L.fix.acc) + ' م' : '—');
        set('dzHdg', L.heading ? deg(L.heading.h) + ' ' + A.dirLbl(L.heading.h) : '—');
        set('dzAge', L.fixAt ? ago(L.age) : '—');
        set('dzCrd', L.fix ? L.fix.lat.toFixed(5) + '\n' + L.fix.lng.toFixed(5) : '—');
        var cur = T() && T().current();
        set('dzTrip', cur ? (cur.status === 'rec' ? '● ' : '⏸ ') + A.fmtD(cur.dist) : 'لا تسجيل');
        set('dzRec', cur ? (cur.status === 'rec' ? '⏸ إيقاف مؤقت' : '⏺ متابعة') : '⏺ تسجيل');
        /* السهم إلى الوجهة */
        var arrow = dEl.querySelector('#dzArrow'), sel = L.sel, rotv = null;
        if (sel && L.fix) {
            var g = GEO.geodesic(L.fix.lat, L.fix.lng, sel.lat, sel.lng);
            set('dzDist', A.fmtD(g.m)); set('dzName', (sel.emoji || '📍') + ' ' + sel.name);
            if (L.heading) { rotv = g.brg - L.heading.h; set('dzNote', (sel.id === 'gbs-start' ? 'خط مستقيم — ليس طريق سيارات · ' : '') + 'الاتجاه ' + deg(g.brg)); }
            else { rotv = g.brg; set('dzNote', 'اتجاه الهاتف غير متاح: السهم بالنسبة للشمال (' + deg(g.brg) + ')'); }
        } else {
            set('dzDist', L.heading ? deg(L.heading.h) : '—'); set('dzName', sel ? 'بانتظار الموقع' : 'لا توجد وجهة محددة'); set('dzNote', sel ? '' : 'اختر وجهة من «الوجهات»');
            if (L.heading) rotv = -L.heading.h; /* شمال */
        }
        if (rotv != null) {
            var cur2 = lastRot == null ? rotv : lastRot, d = ((rotv - cur2) % 360 + 540) % 360 - 180;
            lastRot = cur2 + d;
            arrow.setAttribute('transform', 'rotate(' + lastRot.toFixed(1) + ' 50 50)');
        }
        dEl.querySelector('#dzArrowSvg').classList.toggle('dim', !ok || rotv == null);
        /* التنبيهات */
        var al = null, tb = T() && T().tb();
        if (!L.fix) al = { c: 'bad', t: 'بانتظار إشارة GPS…' };
        else if (L.age > 10000) al = { c: 'bad', t: '⚠ انقطعت إشارة GPS ' + ago(L.age) + ' — القيم المعروضة قديمة' };
        else if (L.fix.acc > 50) al = { c: 'warn', t: '⚠ دقة الموقع ضعيفة (±' + Math.round(L.fix.acc) + ' م)' };
        else if (tb && tb.off > 300 && sel && sel.id === 'gbs-trackback') al = { c: 'warn', t: '⚠ ابتعدت ' + A.fmtD(tb.off) + ' عن مسارك المسجّل' };
        else if (sel && L.fix && GEO.geodesic(L.fix.lat, L.fix.lng, sel.lat, sel.lng).m < Math.max(30, L.fix.acc)) al = { c: 'ok', t: '✔ وصلت تقريبًا إلى ' + sel.name };
        var ae = dEl.querySelector('#dzAlert');
        ae.hidden = !al; if (al) { ae.className = 'dz-alert ' + al.c; set('dzAlert', al.t); }
        var lost = L.fix && L.age > 10000;
        if (lost && !lostBuzz) { lostBuzz = true; try { if (A.opt('vibrate') && navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) { } }
        if (!lost) lostBuzz = false;
    }
    function onD(e) {
        var b = e.target.closest('[data-d]'); if (!b) return;
        var t = T(), A = api();
        switch (b.getAttribute('data-d')) {
            case 'close': closeDesert(); break;
            case 'theme': ds.theme = ds.theme === 'sun' ? 'night' : 'sun'; saveD(); paintD(); break;
            case 'eco': ds.eco = !ds.eco; saveD(); paintD(); loopD(); break;
            case 'rec': if (!t) break; var c = t.current(); if (!c) t.start(); else if (c.status === 'rec') t.pause(); else t.resume(); updD(); break;
            case 'back': backChooser(); break;
            case 'copy': { var L = A.live(); if (L.fix) F.copy(L.fix.lat.toFixed(6) + ', ' + L.fix.lng.toFixed(6)); else toast('لا يوجد موقع بعد'); break; }
        }
    }
    function backChooser() {
        var t = T(); if (!t || !t.startPt()) { toast('لا توجد نقطة انطلاق مسجّلة — ابدأ تسجيل رحلة أولًا'); return; }
        var b = document.getElementById('sheetBody');
        document.getElementById('sheetTitle').textContent = 'العودة إلى نقطة الانطلاق';
        b.innerHTML = '<div class="lx-choice">'
            + '<button type="button" class="lx-opt" data-k="track"><b>↩️ على نفس المسار</b><span>يتبع نقاط رحلتك المسجّلة رجوعًا. الأنسب للسيارة.</span></button>'
            + '<button type="button" class="lx-opt warn" data-k="direct"><b>🏁 مباشر (خط مستقيم)</b><span>أقصر مسافة، لكنه <u>ليس طريق سيارات مؤكدًا</u>.</span></button></div>';
        var bd = document.getElementById('sheetBackdrop');
        bd.classList.add('active');
        b.onclick = function (e) {
            var o = e.target.closest('[data-k]'); if (!o) return;
            bd.classList.remove('active'); b.onclick = null;
            if (o.getAttribute('data-k') === 'track') t.goTrack(); else t.goDirect();
            if (dEl) { /* البقاء في وضع الصحراء: السهم يشير الآن للهدف الجديد */ }
        };
    }

    /* ---------- الربط مع الأداة ---------- */
    window.GBS_EXT = {
        home: function (body) {
            try { dashEl = buildDash(body); } catch (e) { console.error(e); }
            homeEl = document.createElement('div');
            homeEl.className = 'lx-x';
            homeEl.innerHTML = homeHTML();
            body.appendChild(homeEl);
            homeEl.addEventListener('click', function (e) {
                var b = e.target.closest('[data-x]'); if (!b) return;
                var k = b.getAttribute('data-x');
                if (k === 'rec') api().go('trip');
                else if (k === 'back') backChooser();
            });
            updHome();
        },
        info: function (body) {
            infoEl = document.createElement('div');
            infoEl.className = 'lx-infox';
            infoEl.innerHTML = infoHTML();
            body.appendChild(infoEl);
            infoEl.querySelector('#xDecl').addEventListener('change', function () {
                var v = parseFloat(this.value);
                if (!fin(v) || Math.abs(v) > 30) { toast('أدخل رقمًا بين -30 و 30'); this.value = +api().opt('decl') || 0; return; }
                api().setOpt('decl', Math.round(v * 2) / 2); toast('حُفظ الانحراف');
            });
            infoAt = 0; updInfo();
        },
        update: function (tab) { if (tab === 'home') updHome(); else if (tab === 'info') updInfo(); if (dEl && ds.eco) updD(); },
        openDesert: openDesert, closeDesert: closeDesert, confidence: function () { return confidence(api().live()); }
    };
    window.addEventListener('gbs:pos', function () { if (dEl) updD(); });
    /* إن كان وضع الصحراء مفتوحًا عند إغلاق التطبيق نعيد فتحه */
    if (ds.open) window.addEventListener('load', function () { setTimeout(function () { if (api()) openDesert(); }, 300); });
})();
