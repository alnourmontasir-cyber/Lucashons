/* مُستخرج من التطبيق الأصلي «منتصر النور» — لا تعديل على المنطق */
/* ================= أداة GPS — سهم الوجهة (على نمط GPS Arrow Navigator) =================
   موقعك الحالي • حفظ المواقع وموقف السيارة • وجهات بالاسم أو الإحداثيات أو رابط خرائط • سهم يدلّك مع المسافة
   الإصدار الدقيق: إدارة كاملة للأذونات • فلتر كالمان • متوسط مرجّح عند الحفظ • بوصلة بتعويض الميل
   ومعايرة تلقائية من اتجاه حركتك • مسافة واتجاه على WGS84 • صفحة «الحالة» للتشخيص
   الـ GPS والسهم يعملان بدون إنترنت؛ الإنترنت مطلوب فقط للبحث بالاسم
   ====================================================================================== */
(function () {
    'use strict';
    if (!window.FUN || typeof window.FUN.register !== 'function' || !window.GEO)
        return;
    const F = window.FUN, GEO = window.GEO;
    const esc = function (s) { return F.esc(s); };
    const q = function (r, s) { return r.querySelector(s); };
    const qa = function (r, s) { return Array.prototype.slice.call(r.querySelectorAll(s)); };
    const fin = function (v) { return typeof v === 'number' && isFinite(v); };
    const MAX = 200;
    const ICONS = ['📍', '🏠', '🚗', '🏨', '🏖️', '🍴', '🕌', '🏥', '⛽', '🏫', '💼', '🛒', '⭐', '❤️'];
    const DIRS = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
    const DEF = { filter: true, keepAwake: true, dms: false, vibrate: true };
    let run = null;
    if (!document.getElementById('gpsStyle')) {
        const st = document.createElement('style');
        st.id = 'gpsStyle';
        st.textContent = ''
            + '#gpsFrame{max-width:520px;margin:0 auto}'
            + '.gps-tabs{display:flex;gap:6px;margin:2px 0 12px;padding:4px;border-radius:16px;background:var(--surface-2);border:1px solid var(--border)}'
            + '.gps-tab{flex:1;padding:11px 4px;border-radius:12px;font-weight:800;font-size:calc(13.5px * var(--font-scale));color:var(--text-dim);text-align:center}'
            + '.gps-tab.on{background:linear-gradient(180deg,#ffe066,#f2b705);color:#1f1500}'
            + '.gps-stat{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);margin-bottom:12px;font-size:calc(13.5px * var(--font-scale));font-weight:700;line-height:1.7}'
            + '.gps-dot{width:11px;height:11px;border-radius:50%;background:#8a8f98;flex-shrink:0}'
            + '.gps-loc{display:flex;align-items:center;gap:10px;padding:4px 6px 10px;font-weight:900;font-size:calc(17px * var(--font-scale));line-height:1.5}'
            + '.gps-loc .gps-dot{width:19px;height:19px;flex-shrink:0}'
            + '.gps-age{font-weight:800;font-size:calc(12.5px * var(--font-scale));padding:2px 10px;border-radius:999px;background:rgba(47,179,107,.18);color:#2fb36b;white-space:nowrap}'
            + '.gps-add{width:100%;display:flex;flex-direction:column;align-items:center;gap:2px;padding:14px 12px;margin:0 0 12px;border-radius:14px;background:#fff;color:#1f1500;border:1px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.08);font-weight:900;font-size:calc(17px * var(--font-scale))}'
            + '.gps-add small{color:#6b6b6b;font-weight:700;font-size:calc(12px * var(--font-scale))}'
            + '.gps-add:active{transform:scale(.98)}'
            + '@keyframes gpsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.6)}}'
            + '@keyframes gpsShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-4px)}30%{transform:translateX(4px)}45%{transform:translateX(-3px)}60%{transform:translateX(3px)}75%{transform:translateX(-1px)}}'
            + '.gps-dot.pulse{animation:gpsPulse 1.3s ease-in-out infinite}'
            + '.gps-dot.shake{animation:gpsShake .6s ease-in-out infinite}'
            + '@media (prefers-reduced-motion:reduce){.gps-dot.pulse,.gps-dot.shake{animation:none}}'
            + '.gps-dot.ok{background:#2fb36b;box-shadow:0 0 0 4px rgba(47,179,107,.22)}'
            + '.gps-dot.warn{background:#e0a83a;box-shadow:0 0 0 4px rgba(224,168,58,.22)}'
            + '.gps-dot.bad{background:var(--danger);box-shadow:0 0 0 4px rgba(198,90,77,.22)}'
            + '.gps-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}'
            + '.gps-cell{padding:11px 12px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border);min-width:0;text-align:right}'
            + '.gps-cell small{display:block;color:var(--text-dim);font-size:calc(13.5px * var(--font-scale));margin-bottom:4px}'
            + '.gps-cell b{display:block;font-size:calc(19px * var(--font-scale));text-align:right;word-break:break-all}'
            + '.gps-big{width:100%;padding:17px;border-radius:16px;font-weight:900;font-size:calc(16.5px * var(--font-scale));color:#1f1500;background:linear-gradient(180deg,#ffe066,#f2b705);display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 6px 18px rgba(242,183,5,.35),inset 0 1px 0 rgba(255,255,255,.55)}'
            + '.gps-big:active{transform:scale(.98)}'
            + '#gpsFrame [disabled]{opacity:.45;pointer-events:none}'
            + '.gps-row{display:flex;gap:8px;margin-top:10px}'
            + '.gps-in{width:100%;min-width:0;padding:13px 14px;border-radius:12px;background:var(--bg-elev);border:1px solid var(--border);color:var(--text);font-size:calc(14.5px * var(--font-scale))}'
            + '.gps-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}'
            + '.gps-item{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:var(--surface-2);border:1px solid var(--border)}'
            + '.gps-item.sel{border-color:#f2b705;box-shadow:0 0 0 1px #f2b705 inset}'
            + '.gps-ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:calc(23px * var(--font-scale));background:var(--bg-elev);flex-shrink:0}'
            + '.gps-main{flex:1;min-width:0;text-align:right}'
            + '.gps-main b{display:block;font-size:calc(14.5px * var(--font-scale));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
            + '.gps-main small{display:block;color:var(--text-dim);font-size:calc(11.5px * var(--font-scale));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
            + '.gps-dist{font-weight:900;color:var(--gold);font-size:calc(14px * var(--font-scale));white-space:nowrap}'
            + '.gps-act{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg-elev);flex-shrink:0;font-size:15px}'
            + '.gps-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}'
            + '.gps-chip{width:42px;height:42px;border-radius:12px;font-size:21px;background:var(--bg-elev);border:1px solid var(--border)}'
            + '.gps-chip.on{border-color:#f2b705;background:rgba(242,183,5,.2)}'
            + '.gps-ed{padding:14px;border-radius:16px;background:var(--surface-2);border:1px solid #f2b705;margin-bottom:12px}'
            + '.gps-ed .gps-grid{margin:0 0 4px}'
            + '.gps-panel{position:relative;padding:14px 14px 12px;overflow:hidden;margin-bottom:12px;border-radius:24px;background:radial-gradient(120% 90% at 50% 0%,#2a2208 0%,#14110a 55%,#0b0905 100%);border:1px solid rgba(242,183,5,.55);box-shadow:0 10px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,224,102,.18)}'
            + '.gps-dial{display:flex;justify-content:center;margin:6px 0 4px;padding:0 10px}'
            + '.gps-dial svg{display:block;width:100%;max-width:360px;height:auto;aspect-ratio:1/1;overflow:visible}'
            + '.gps-far{text-align:center;font-weight:900;font-size:calc(40px * var(--font-scale));margin:0;color:#ffe066;text-shadow:0 2px 14px rgba(242,183,5,.35)}'
            + '.gps-sub{min-height:7.2em;text-align:center;color:#e3d9b4;font-size:calc(13.5px * var(--font-scale));line-height:1.9;margin:4px 0 12px}'
            + '.gps-dst{min-height:1.6em;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:900;font-size:calc(16px * var(--font-scale));margin:2px 0 6px;color:#ffe066}'
            + '.gps-empty{text-align:center;color:var(--text-dim);padding:26px 10px;line-height:2;font-size:calc(14px * var(--font-scale))}'
            + '.gps-note{color:var(--text-dim);font-size:calc(11.5px * var(--font-scale));line-height:1.8;margin:8px 2px 0}'
            + '.gps-perm{padding:13px 14px;border-radius:16px;background:var(--surface-2);border:1px solid var(--border);margin-bottom:12px}'
            + '.gps-perm.bad{border-color:var(--danger)}'
            + '.gps-perm.warn{border-color:#e0a83a}'
            + '#funToolTitle .gbs-title{display:inline-flex;align-items:center;gap:10px;direction:ltr;line-height:1.15;filter:drop-shadow(0 1px 0 rgba(70,45,0,.75)) drop-shadow(0 2px 10px rgba(242,183,5,.4))}'
            + '#funToolTitle .gbs-en,#funToolTitle .gbs-ar{background:linear-gradient(180deg,#fff6bf 0%,#ffe066 28%,#f2b705 50%,#a87400 62%,#ffd84d 82%,#fff0a0 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;font-weight:900}'
            + '#funToolTitle .gbs-en{font-family:\'Maya\',\'Cinzel\',\'Trajan Pro\',\'Playfair Display\',Georgia,\'Times New Roman\',serif;font-size:calc(27px * var(--font-scale));letter-spacing:.14em}'
            + '#funToolTitle .gbs-ar{direction:rtl;font-family:\'Maya\',\'Amiri\',\'Noto Naskh Arabic\',\'Noto Kufi Arabic\',\'Traditional Arabic\',serif;font-size:calc(25px * var(--font-scale));letter-spacing:0;padding-inline-start:10px;border-inline-start:2px solid rgba(242,183,5,.65)}'
            + '#gpsFrame .btn{padding:8px 12px;font-size:calc(12.5px * var(--font-scale));border-radius:999px;font-weight:800;gap:6px}'
            + '#gpsFrame .gps-row{gap:6px;margin-top:8px}'
            + '.gps-tab{padding:8px 4px !important;font-size:calc(13px * var(--font-scale)) !important}'
            + '.gps-pills{display:flex;gap:8px;margin:2px 0 10px}'
            + '.gps-pill{flex:1;min-width:0;padding:11px 12px;border-radius:999px;font-weight:900;font-size:calc(16px * var(--font-scale));display:flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;line-height:1.3}'
            + '.gps-pill-main{color:#1f1500;background:linear-gradient(180deg,#ffe066,#f2b705);box-shadow:0 3px 10px rgba(242,183,5,.32),inset 0 1px 0 rgba(255,255,255,.55)}'
            + '.gps-pill-alt{color:#ffe066;background:linear-gradient(180deg,#2b2409,#14110a);border:1.5px solid rgba(242,183,5,.7);box-shadow:0 3px 10px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,224,102,.15)}'
            + '.gps-pill:active{transform:scale(.97)}'
            + '.gps-stat{padding:8px 12px;border-radius:999px;font-size:calc(12.5px * var(--font-scale));margin-bottom:10px}'
            + '.gps-perm-h{display:flex;align-items:center;gap:8px;font-weight:900;font-size:calc(14.5px * var(--font-scale))}'
            + '.gps-perm p{margin:6px 0 0;line-height:1.9;color:var(--text-dim);font-size:calc(12.5px * var(--font-scale))}'
            + '.gps-perm .gps-row .btn{flex:1;padding:11px 8px;font-size:calc(13px * var(--font-scale))}'
            + '.gps-sec{margin-bottom:12px;padding:12px 14px;border-radius:16px;background:var(--surface-2);border:1px solid var(--border)}'
            + '.gps-sec h5{margin:0 0 6px;font-size:calc(14px * var(--font-scale));font-weight:900;color:var(--gold)}'
            + '.gps-kv{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed var(--border);font-size:calc(12.8px * var(--font-scale));line-height:1.7}'
            + '.gps-kv:last-of-type{border-bottom:0}'
            + '.gps-kv>span{color:var(--text-dim)}'
            + '.gps-kv>b{text-align:left;font-weight:800}'
            + '.gps-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:calc(11.5px * var(--font-scale));font-weight:900;background:var(--bg-elev)}'
            + '.gps-badge.ok{background:rgba(47,179,107,.2);color:#2fb36b}'
            + '.gps-badge.warn{background:rgba(224,168,58,.2);color:#e0a83a}'
            + '.gps-badge.bad{background:rgba(198,90,77,.2);color:var(--danger)}'
            + '.gps-tgl{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 2px;font-weight:700;font-size:calc(13.5px * var(--font-scale));color:var(--text);text-align:right;border-bottom:1px dashed var(--border)}'
            + '.gps-tgl:last-of-type{border-bottom:0}'
            + '.gps-tgl i{width:42px;height:24px;border-radius:999px;background:var(--border);position:relative;flex-shrink:0;transition:background .15s}'
            + '.gps-tgl i:after{content:"";position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:right .15s}'
            + '.gps-tgl[aria-checked="true"] i{background:#2fb36b}'
            + '.gps-tgl[aria-checked="true"] i:after{right:21px}'
            + '.gps-bars{display:inline-flex;gap:2px;align-items:flex-end;height:14px;vertical-align:middle;margin-inline-start:6px}'
            + '.gps-bars u{display:block;width:4px;background:var(--border);border-radius:1px;text-decoration:none}'
            + '.gps-bars u:nth-child(1){height:5px}.gps-bars u:nth-child(2){height:8px}.gps-bars u:nth-child(3){height:11px}.gps-bars u:nth-child(4){height:14px}'
            + '.gps-bars.ok u.on{background:#2fb36b}.gps-bars.warn u.on{background:#e0a83a}.gps-bars.bad u.on{background:var(--danger)}'
            + '.gps-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 2px 10px;font-weight:900;font-size:calc(15px * var(--font-scale));color:var(--text)}'
            + '.gps-h span{display:flex;align-items:center;gap:8px}'
            + '.gps-h span:before{content:"";width:4px;height:18px;border-radius:4px;background:linear-gradient(180deg,#ffe066,#f2b705)}'
            + '.gps-h em{font-style:normal;font-weight:800;font-size:calc(12px * var(--font-scale));padding:2px 10px;border-radius:999px;background:var(--bg-elev);color:var(--text-dim);border:1px solid var(--border)}'
            + '#gpsRecent{margin-bottom:16px}'
            + '.gps-rc{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
            + '.gps-rc::-webkit-scrollbar{display:none}'
            + '.gps-card{position:relative;flex:0 0 78%;max-width:300px;scroll-snap-align:start;padding:12px;border-radius:18px;background:linear-gradient(160deg,var(--surface-2),var(--bg-elev));border:1px solid var(--border);box-shadow:0 4px 14px rgba(0,0,0,.14);text-align:right;cursor:pointer;transition:transform .12s,box-shadow .12s}'
            + '.gps-card:active{transform:scale(.985)}'
            + '.gps-card.sel{border-color:#f2b705;box-shadow:0 0 0 1px #f2b705 inset,0 4px 14px rgba(242,183,5,.22)}'
            + '.gps-card.new:before{content:"";position:absolute;top:0;right:18px;left:18px;height:3px;border-radius:0 0 4px 4px;background:linear-gradient(90deg,#ffe066,#f2b705)}'
            + '.gps-ch{display:flex;align-items:center;gap:10px}'
            + '.gps-ch .gps-ic{width:42px;height:42px}'
            + '.gps-ch .gps-main b{font-size:calc(15px * var(--font-scale))}'
            + '.gps-ch .gps-main small{font-size:calc(12px * var(--font-scale));color:#2fb36b;font-weight:800}'
            + '.gps-cd{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}'
            + '.gps-cd div{padding:7px 9px;border-radius:11px;background:var(--bg-elev);min-width:0}'
            + '.gps-cd div.w{grid-column:1/-1}'
            + '.gps-cd small{display:block;color:var(--text-dim);font-size:calc(10.5px * var(--font-scale));margin-bottom:1px}'
            + '.gps-cd b{display:block;font-size:calc(12.5px * var(--font-scale));font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:right}'
            + '.gps-cd b.rtl{direction:rtl}'
            + '.gps-cf{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}'
            + '.gps-go{flex:1;padding:9px 10px;border-radius:999px;font-weight:900;font-size:calc(13px * var(--font-scale));color:#1f1500;background:linear-gradient(180deg,#ffe066,#f2b705);text-align:center}'
            + '.gps-cp{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--bg-elev);border:1px solid var(--border);font-size:15px;flex-shrink:0}'
            + '.gps-selb{position:absolute;top:10px;left:10px;font-size:calc(10.5px * var(--font-scale));font-weight:900;padding:2px 8px;border-radius:999px;background:#f2b705;color:#1f1500}'
            + '.gps-item{box-shadow:0 2px 8px rgba(0,0,0,.08);transition:transform .12s}'
            + '.gps-item:active{transform:scale(.99)}'
            + '.gps-item .gps-main small{margin-top:2px}'
            + '.gps-item .gps-dist{padding:3px 9px;border-radius:999px;background:var(--bg-elev);font-size:calc(12.5px * var(--font-scale))}'
            + '.gps-add{border-radius:16px;box-shadow:0 4px 14px rgba(0,0,0,.1)}'
            + '.gps-card.new{flex:0 0 100%;max-width:none}'
            + '.gps-big[hidden],.gps-ed[hidden]{display:none !important}';
        document.head.appendChild(st);
    }
    /* ---------- التخزين: داخل الإعدادات حتى يدخل في النسخ الاحتياطي ---------- */
    function db() {
        const s = settings.gpsNav;
        if (s && typeof s === 'object' && Array.isArray(s.dests))
            return s;
        settings.gpsNav = { dests: [], sel: null };
        return settings.gpsNav;
    }
    function persist() { try {
        saveSettingsData();
    }
    catch (e) { } }
    function opt(k) { const D = db(); return (D.opts && D.opts[k] !== undefined) ? D.opts[k] : DEF[k]; }
    function setOpt(k, v) { const D = db(); if (!D.opts || typeof D.opts !== 'object')
        D.opts = {}; D.opts[k] = v; persist(); }
    /* ---------- الحسابات الجغرافية (WGS84) ---------- */
    function dist(a, b, c, d) { return GEO.geodesic(a, b, c, d).m; }
    function bear(a, b, c, d) { return GEO.geodesic(a, b, c, d).brg; }
    function smooth(prev, next, k) { const d = ((next - prev + 540) % 360) - 180; return (prev + d * k + 360) % 360; }
    function dirLbl(h) { return DIRS[Math.round(h / 45) % 8]; }
    function fmtD(m) {
        if (!isFinite(m))
            return '—';
        if (m < 1000)
            return Math.round(m) + ' م';
        return (m / 1000).toFixed(m < 10000 ? 2 : 1) + ' كم';
    }
    function fmtT(min) {
        if (min < 1)
            return 'أقل من دقيقة';
        if (min < 90)
            return Math.round(min) + ' د';
        const h = Math.floor(min / 60);
        if (h < 48)
            return h + ' س ' + Math.round(min - h * 60) + ' د';
        return Math.round(min / 60 / 24) + ' يوم';
    }
    function qual(acc) {
        if (acc <= 8)
            return { t: 'ممتازة', n: 4, c: 'ok' };
        if (acc <= 20)
            return { t: 'جيدة', n: 3, c: 'ok' };
        if (acc <= 50)
            return { t: 'متوسطة', n: 2, c: 'warn' };
        if (acc <= 150)
            return { t: 'ضعيفة', n: 1, c: 'bad' };
        return { t: 'ضعيفة جدًا', n: 1, c: 'bad' };
    }
    function fmtCoord(v, isLat) { return opt('dms') ? GEO.fmtDMS(v, isLat) : v.toFixed(6); }
    /* ---------- قراءة الإحداثيات: أرقام عربية، رابط خرائط، درجات/دقائق/ثوانٍ، نص عادي ---------- */
    function normDigits(s) {
        return String(s == null ? '' : s)
            .replace(/[\u0660-\u0669]/g, function (d) { return d.charCodeAt(0) - 1632; })
            .replace(/[\u06F0-\u06F9]/g, function (d) { return d.charCodeAt(0) - 1776; })
            .replace(/\u066B/g, '.').replace(/\u060C/g, ',');
    }
    function parseNum(v) { const s = normDigits(v).replace(/\s+/g, ''); return s === '' ? NaN : Number(s); }
    function okLL(a, b) { return isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180; }
    function parseDMS(s) {
        const re = /(-?\d{1,3}(?:\.\d+)?)\s*°\s*(?:(\d{1,2}(?:\.\d+)?)\s*['\u2032\u2019]\s*)?(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|\u2033|\u201D|''|\u2032\u2032)\s*)?([NSEWnsewشجقغ])?/g;
        const found = [];
        let m;
        while ((m = re.exec(s)) && found.length < 3) {
            let v = Math.abs(+m[1]) + (m[2] ? +m[2] / 60 : 0) + (m[3] ? +m[3] / 3600 : 0);
            if (m[1].charAt(0) === '-')
                v = -v;
            found.push({ v: v, h: m[4] ? m[4].toUpperCase() : '' });
        }
        if (found.length !== 2)
            return null;
        const isNS = function (h) { return h === 'N' || h === 'S' || h === 'ش' || h === 'ج'; };
        const isEW = function (h) { return h === 'E' || h === 'W' || h === 'ق' || h === 'غ'; };
        const sgn = function (x) { return (x.h === 'S' || x.h === 'W' || x.h === 'ج' || x.h === 'غ') ? -Math.abs(x.v) : x.v; };
        let a = found[0], b = found[1];
        if (isEW(a.h) || isNS(b.h)) {
            const t = a;
            a = b;
            b = t;
        }
        const la = sgn(a), lo = sgn(b);
        return okLL(la, lo) ? { lat: la, lng: lo } : null;
    }
    function parseLL(s) {
        s = normDigits(s).trim();
        try {
            s = decodeURIComponent(s);
        }
        catch (e) { }
        const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
        const pats = [
            new RegExp('@' + N + ',\\s*' + N),
            new RegExp('!3d' + N + '!4d' + N),
            new RegExp('[?&](?:q|ll|query|destination|daddr|center|sll)=' + N + '[,+ ]+\\s*' + N),
            new RegExp('[?&]mlat=' + N + '&mlon=' + N),
            new RegExp('#map=\\d+/' + N + '/' + N),
            new RegExp('^geo:' + N + ',' + N)
        ];
        for (let i = 0; i < pats.length; i++) {
            const m = s.match(pats[i]);
            if (m && okLL(+m[1], +m[2]))
                return { lat: +m[1], lng: +m[2] };
        }
        const d = parseDMS(s);
        if (d)
            return d;
        if (/^https?:\/\//i.test(s))
            return null;
        const m = s.match(new RegExp('^\\s*' + N + '\\s*[,;\\s]\\s*' + N + '\\s*$'));
        if (m && okLL(+m[1], +m[2]))
            return { lat: +m[1], lng: +m[2] };
        return null;
    }
    function stopAll() { if (run) {
        try {
            run.stop();
        }
        catch (e) { }
        run = null;
    } }
    const prevClose = F.close;
    F.close = function () { stopAll(); prevClose(); };
    /* عنوان الأداة: «GBS المنتصر» بشكل ذهبي (يُستبدل تلقائيًا بنص عادي عند فتح أي أداة أخرى) */
    const prevOpen = F.open;
    F.open = function (id) {
        const r = prevOpen.apply(this, arguments);
        if (id === 'gps') {
            const t = document.getElementById('funToolTitle');
            if (t)
                t.innerHTML = '<span class="gbs-title"><span class="gbs-en">GBS</span><span class="gbs-ar">المنتصر</span></span>';
        }
        return r;
    };
    F.register({
        id: 'gps', cat: 'tool', name: 'GBS', desc: 'سهم يدلّك على أي وجهة مع المسافة — دقة عالية وإدارة كاملة للأذونات، يعمل بدون إنترنت، ويحفظ موقف سيارتك وأماكنك', emoji: '🧭', c1: '#f7c21b', c2: '#b98100',
        guide: {
            about: 'يعمل مثل GPS Arrow Navigator: يحدد موقعك بالأقمار الصناعية بدقة عالية، وسهم أصفر يشير إلى وجهتك المحفوظة مع المسافة المتبقية لحظة بلحظة.',
            steps: [
                'عند أول فتح يطلب التطبيق إذن الموقع — اختر «السماح» وفعّل «الموقع الدقيق». إن رفضته ستجد في الأعلى زرًّا لإعادة المحاولة وخطوات التفعيل.',
                'انتظر ظهور «تم تحديد الموقع» وأن تكون الدقة ±20 م أو أقل (الأفضل في مكان مكشوف). تفاصيل الإشارة والأذونات في تبويب «الحالة».',
                'اضغط «حفظ الموقع الحالي» أو «موقف سيارتي»: يجمع التطبيق عدة قراءات ويحسب متوسطها المرجّح لتحصل على أدق نقطة ممكنة.',
                'من «الوجهات» أضف وجهة بالاسم أو بلصق الإحداثيات (عشرية أو درجات ودقائق) أو رابط خرائط، ثم امشِ في اتجاه السهم الأصفر.'
            ],
            tip: 'البوصلة تُضبط تلقائيًا من اتجاه حركتك بعد دقيقة مشي أو قيادة. إن بدا السهم غير دقيق حرّك الهاتف على شكل رقم 8، وابتعد عن المعادن والمغناطيس.'
        },
        render: function (root) {
            stopAll();
            const S = { tab: 'home', pos: null, lastTs: 0, fix: 0, err: '', errKind: '', perm: null, asked: false, ori: 'wait', oriAt: 0, sh: null, shAt: 0, cAcc: null,
                off: 0, offN: 0, spd: null, course: null, prevPos: null, buf: [], flt: new GEO.Filter(), best: null, nAcc: 0, nRej: 0, nJump: 0, restarts: 0, timeouts: 0,
                mode: '', lastHigh: 0, w: null, offPerm: null, wl: null, wlOk: null, lowSince: 0, capBusy: false, angs: {}, editor: null, results: null, arrived: false,
                timer: null, raf: 0, dead: false, started: Date.now(), lastRestart: Date.now(), offLoaded: false };
            run = S;
            root.innerHTML = '<div id="gpsFrame">'
                + '<div class="gps-tabs"><button type="button" class="gps-tab" data-t="dest">الوجهات</button><button type="button" class="gps-tab" data-t="home">الرئيسية</button><button type="button" class="gps-tab" data-t="info">الحالة</button></div>'
                + '<div id="gpsBody"></div></div>';
            const frame = q(root, '#gpsFrame');
            const $ = function (id) { return q(root, '#' + id); };
            const setTxt = function (id, t) { const el = $(id); if (el && el.textContent !== t)
                el.textContent = t; };
            const setHTML = function (id, h) { const el = $(id); if (el && el.__h !== h) {
                el.__h = h;
                el.innerHTML = h;
            } };
            function alive() {
                const bd = document.getElementById('funToolBackdrop');
                return !S.dead && frame.isConnected && q(root, '#gpsFrame') === frame && bd && bd.classList.contains('active');
            }
            function statHTML() { return '<div class="gps-stat"><i class="gps-dot" id="gpsDot"></i><span id="gpsStatTxt"></span></div>'; }
            function selDest() { const D = db(); return D.dests.find(function (x) { return x.id === D.sel; }) || null; }
            function lat() { return S.pos.coords.latitude; }
            function lng() { return S.pos.coords.longitude; }
            /* ---------- الاتجاه: حساس الهاتف (مُعايَر) أو مسار الحركة ---------- */
            function curHeading() {
                const now = Date.now();
                const sensorOk = S.sh != null && now - S.shAt < 2500;
                const cr = (S.course && now - S.course.t < 4000 && S.course.sp >= 1.2) ? S.course : null;
                if (cr && (!sensorOk || cr.sp >= 4))
                    return { h: cr.h, src: 'g' };
                if (sensorOk && !(S.rel && S.offN === 0))
                    return { h: GEO.wrap360(S.sh + S.off), src: 's' };
                if (cr)
                    return { h: cr.h, src: 'g' };
                return null;
            }
            function onOri(e) {
                const sa = GEO.screenAngle();
                let h = null;
                if (fin(e.webkitCompassHeading)) {
                    h = GEO.wrap360(e.webkitCompassHeading + sa);
                    if (fin(e.webkitCompassAccuracy))
                        S.cAcc = e.webkitCompassAccuracy;
                }
                else if (e.alpha != null && (e.type === 'deviceorientationabsolute' || e.absolute === true)) {
                    const r = GEO.headingFromEuler(e.alpha, e.beta, e.gamma, sa);
                    if (r) {
                        h = r.h;
                        if (S.rel) { S.rel = false; S.off = 0; S.offN = 0; S.sh = null; }
                        S.absAt = Date.now();
                    }
                }
                else if (e.alpha != null && e.type === 'deviceorientation' && Date.now() - (S.absAt || 0) > 3000) {
                    /* بعض المتصفحات/WebView لا تعطي بوصلة مطلقة: نستعمل الحساس النسبي ونعايره من اتجاه المشي */
                    const r2 = GEO.headingFromEuler(e.alpha, e.beta, e.gamma, sa);
                    if (r2) { h = r2.h; S.rel = true; }
                }
                if (h == null || !isFinite(h))
                    return;
                const now = Date.now();
                if (S.ori !== 'granted') {
                    S.ori = 'granted';
                    paintPerm();
                }
                S.oriAt = now;
                if (S.sh == null || now - S.shAt > 2500)
                    S.sh = h;
                else {
                    const dd = Math.abs(GEO.wrap180(h - S.sh));
                    if (dd >= 1.5)
                        S.sh = smooth(S.sh, h, dd > 40 ? 0.6 : (dd > 12 ? 0.22 : 0.1));
                }
                S.shAt = now;
                if (!S.raf) {
                    S.raf = requestAnimationFrame(function () { S.raf = 0; if (alive() && S.tab === 'home') {
                        updNav();
                        updHdg();
                    } });
                }
            }
            function setAng(id, target) {
                const el = $(id);
                if (!el)
                    return;
                if (!isFinite(target))
                    return;
                const cur = S.angs[id] == null ? target : S.angs[id];
                const delta = (((target - cur) % 360) + 540) % 360 - 180;
                if (S.angs[id] != null && Math.abs(delta) < 0.4)
                    return;
                const nv = ((cur + delta) % 360 + 360) % 360;
                S.angs[id] = nv;
                el.setAttribute('transform', 'rotate(' + nv.toFixed(1) + ' 100 100)');
            }
            async function reqOri() {
                const D = window.DeviceOrientationEvent;
                if (D && typeof D.requestPermission === 'function') {
                    try {
                        const r = await D.requestPermission();
                        S.ori = (r === 'granted') ? 'wait' : 'denied';
                    }
                    catch (e) {
                        S.ori = 'need';
                    }
                }
                if (!S.dead)
                    paintPerm();
            }
            /* ---------- معايرة البوصلة من اتجاه الحركة (تصحيح الانحراف المغناطيسي وانحياز الحساس) ---------- */
            function offKey() { const D = db(); return D.opts && D.opts.off; }
            function loadOff() {
                if (S.offLoaded || !S.pos)
                    return;
                S.offLoaded = true;
                const o = offKey();
                if (o && fin(o.v) && Math.abs(o.v) <= 30 && fin(o.lat) && fin(o.lng) && dist(lat(), lng(), o.lat, o.lng) < 400000) {
                    S.off = o.v;
                    S.offN = 3;
                }
            }
            function saveOff() { setOpt('off', { v: +S.off.toFixed(2), lat: +lat().toFixed(3), lng: +lng().toFixed(3), t: Date.now() }); }
            function calibrate(c, sp, hd) {
                if (S.sh == null || Date.now() - S.shAt > 1500)
                    return;
                if (!(fin(sp) && sp >= (S.rel ? 1.2 : 2.5) && fin(hd) && (c.accuracy || 99) <= 35))
                    return;
                const diff = GEO.wrap180(hd - S.sh);
                if (!S.rel && Math.abs(diff) > 30)
                    return; /* البوصلة المطلقة لا تحتاج تعويضاً كبيراً: تجاهل الاتجاهات الشاذة */
                if (S.offN >= 5 && Math.abs(GEO.wrap180(diff - S.off)) > 50)
                    return;
                if (S.offN === 0)
                    S.off = diff;
                else
                    S.off = GEO.wrap180(S.off + GEO.wrap180(diff - S.off) * 0.12);
                S.offN++;
                if (S.offN % 15 === 0)
                    saveOff();
            }
            /* ---------- استقبال المواقع: تنقية + فلتر + سرعة + مسار ---------- */
            function onPos(p, tag) {
                if (S.dead || !p || !p.coords)
                    return;
                const c = p.coords, now = Date.now();
                if (!(fin(c.latitude) && fin(c.longitude)) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180) {
                    S.nRej++;
                    return;
                }
                const ts = (fin(p.timestamp) && p.timestamp > 1e11) ? p.timestamp : now;
                if (S.pos && ts < S.lastTs - 500) {
                    S.nRej++;
                    return;
                }
                if (S.pos && now - ts > 30000) {
                    S.nRej++;
                    return;
                }
                if (tag === 'low') {
                    if (now - S.lastHigh < 15000)
                        return;
                }
                else
                    S.lastHigh = now;
                S.mode = tag === 'low' ? 'low' : 'high';
                const acc = (fin(c.accuracy) && c.accuracy > 0) ? c.accuracy : 100;
                let la = c.latitude, lo = c.longitude;
                if (opt('filter')) {
                    const r = S.flt.update(la, lo, acc, ts, fin(c.speed) ? c.speed : S.spd);
                    if (r === null) {
                        S.nRej++;
                        return;
                    }
                    if (r.jump)
                        S.nJump++;
                    la = r.lat;
                    lo = r.lng;
                }
                S.lastTs = ts;
                S.fix = now;
                S.nAcc++;
                S.best = S.best == null ? acc : Math.min(S.best, acc);
                S.buf.push({ lat: c.latitude, lng: c.longitude, acc: acc, rt: now });
                while (S.buf.length > 60 || (S.buf.length && now - S.buf[0].rt > 25000))
                    S.buf.shift();
                S.pos = { coords: { latitude: la, longitude: lo, accuracy: acc, altitude: c.altitude, altitudeAccuracy: c.altitudeAccuracy, heading: c.heading, speed: c.speed }, timestamp: ts };
                S.err = '';
                S.errKind = '';
                if (S.perm && S.perm.state !== 'granted')
                    S.perm = Object.assign({}, S.perm, { state: 'granted' });
                S.lowSince = acc > 1500 ? (S.lowSince || now) : 0;
                /* السرعة والمسار: من الحساس إن وُجد، وإلا من الإزاحة بين قراءتين */
                let sp = (fin(c.speed) && c.speed >= 0 && c.speed <= 97) ? c.speed : null;
                let hd = (fin(c.heading) && c.heading >= 0) ? c.heading : null;
                const pp = S.prevPos;
                if (!pp) {
                    S.prevPos = { lat: la, lng: lo, t: ts, acc: acc };
                }
                else {
                    const dt = (ts - pp.t) / 1000;
                    /* [إصلاح السفر] قراءة شبكة تقريبية (±مئات الأمتار) بعد العودة من الخلفية كانت تُحسب منها سرعة خيالية (مثل 754 كم/س)
                       واتجاه خاطئ يلوّث معايرة البوصلة. الآن: لا نشتق السرعة/المسار إلا بين قراءتين موثوقتين (≤50 م)،
                       ونرفض أي سرعة فوق 350 كم/س */
                    if (acc > 50 || pp.acc > 50) {
                        S.prevPos = { lat: la, lng: lo, t: ts, acc: acc };
                    }
                    else if (dt >= 1) {
                        const g = GEO.geodesic(pp.lat, pp.lng, la, lo), thr = Math.max(4, 0.5 * Math.max(acc, pp.acc));
                        if (g.m >= thr) {
                            const v = g.m / dt;
                            if (v <= 97) {
                                if (sp == null)
                                    sp = v;
                                if (hd == null && v >= 1)
                                    hd = g.brg;
                            }
                            S.prevPos = { lat: la, lng: lo, t: ts, acc: acc };
                        }
                        else if (dt >= 4) {
                            if (sp == null)
                                sp = 0;
                            S.prevPos = { lat: la, lng: lo, t: ts, acc: acc };
                        }
                    }
                }
                if (sp != null)
                    S.spd = S.spd == null ? sp : S.spd * 0.6 + sp * 0.4;
                if (hd != null && sp != null && sp >= 1.2 && acc <= 60)
                    S.course = { h: hd, sp: sp, t: now };
                loadOff();
                calibrate(c, sp, hd);
                tick();
            }
            function onErr(e, k) {
                k = k || GEO.classify(e);
                S.lastErrAt = Date.now();
                if (k === 'timeout') {
                    S.timeouts++;
                    updStat();
                    return;
                }
                S.errKind = k;
                if (k === 'denied' || k === 'disabled' || k === 'unsupported')
                    S.perm = Object.assign({}, S.perm || {}, { state: k });
                S.err = GEO.msg(k);
                paintPerm();
                updStat();
            }
            function startWatch() {
                if (S.dead)
                    return;
                stopWatch();
                S.lastRestart = Date.now();
                S.w = GEO.watch(onPos, onErr);
            }
            function stopWatch() { if (S.w) {
                try {
                    S.w.stop();
                }
                catch (e) { }
                S.w = null;
            } }
            async function lockScreen() {
                try {
                    if (!opt('keepAwake'))
                        return;
                    if (!navigator.wakeLock) {
                        S.wlOk = false;
                        return;
                    }
                    if (!S.wl && document.visibilityState === 'visible') {
                        S.wl = await navigator.wakeLock.request('screen');
                        S.wlOk = true;
                        S.wl.addEventListener('release', function () { S.wl = null; });
                    }
                }
                catch (e) {
                    S.wl = null;
                    S.wlOk = false;
                }
            }
            function unlockScreen() { try {
                if (S.wl)
                    S.wl.release();
            }
            catch (e) { } S.wl = null; }
            function onVis() {
                if (document.visibilityState !== 'visible') {
                    S.hidAt = Date.now();
                    return;
                }
                /* [إصلاح السفر] بعد الغياب في الخلفية: السرعة والمسار ونقطة الاشتقاق والفلتر كلها من موقع قديم بعيد.
                   نبدأ نظيفًا حتى لا تُخلط قراءات ما قبل الخروج بما بعده، ولا تُعرض قيم قديمة على أنها مباشرة */
                if (S.hidAt && Date.now() - S.hidAt > 3000) {
                    S.prevPos = null;
                    S.spd = null;
                    S.course = null;
                    S.sh = null;
                    if (S.flt)
                        S.flt.reset();
                    /* الحساس النسبي يُعاد ضبط صفره عند الاستئناف في بعض الأجهزة → نعيد المعايرة من الحركة */
                    if (S.rel) {
                        S.off = 0;
                        S.offN = 0;
                    }
                    S.resumed = Date.now();
                }
                S.hidAt = 0;
                if (document.visibilityState === 'visible') {
                    S.wl = null;
                    S.lastAuto = 0;
                    S.autoReq = 0;
                    lockScreen();
                    recheck(true, false);
                }
            }
            S.stop = function () {
                S.dead = true;
                clearInterval(S.timer);
                window.removeEventListener('deviceorientationabsolute', onOri, true);
                window.removeEventListener('deviceorientation', onOri, true);
                document.removeEventListener('visibilitychange', onVis);
                try {
                    if (S.offPerm)
                        S.offPerm();
                }
                catch (e) { }
                stopWatch();
                unlockScreen();
                if (S.offN >= 5 && S.pos) {
                    try {
                        saveOff();
                    }
                    catch (e) { }
                }
            };
            /* ---------- الأذونات: فحص / طلب / إعادة فحص ---------- */
            async function recheck(force, manual) {
                const prev = S.perm ? S.perm.state : '';
                let p;
                try {
                    p = await GEO.check();
                }
                catch (e) {
                    return;
                }
                if (S.dead)
                    return;
                S.perm = p;
                if (p.state === 'granted') {
                    S.errKind = '';
                    S.err = '';
                    if (!S.w || prev !== 'granted' || (force && Date.now() - S.fix > 15000))
                        startWatch();
                }
                paintPerm();
                updStat();
                if (manual)
                    toast(p.state === 'granted' ? 'الإذن مفعّل' + (p.precise === false ? ' (تقريبي)' : '') : 'الحالة: ' + permLbl(p.state));
            }
            async function retryLoc(silent) {
                S.err = '';
                S.errKind = '';
                S.asked = true;
                const r = await GEO.request();
                if (S.dead)
                    return;
                S.perm = r;
                if (r.state === 'denied' && r.src === 'web')
                    S.errKind = 'denied';
                if (r.state === 'disabled')
                    S.errKind = 'disabled';
                paintPerm();
                updStat();
                if (r.state === 'granted' || r.state === 'unknown' || (r.state === 'prompt' && r.src === 'web'))
                    startWatch();
                else if (r.state === 'disabled' && !silent)
                    toast('خدمة الموقع ما زالت مغلقة');
                else if (r.state === 'denied' && !silent)
                    toast('الإذن ما زال مرفوضًا — فعّله من إعدادات الهاتف');
            }
            function permIntro() {
                return new Promise(function (resolve) {
                    const ov = document.createElement('div');
                    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.62)';
                    ov.innerHTML = '<div dir="rtl" style="width:100%;max-width:360px;padding:22px 18px 16px;border-radius:22px;background:var(--bg-elev);color:var(--text);border:1.5px solid #f2b705;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.5)">'
                        + '<div style="font-size:44px;line-height:1.2">📍</div>'
                        + '<p style="margin:8px 0 6px;font-weight:900;font-size:calc(18px * var(--font-scale))">فعّل إذن الموقع</p>'
                        + '<p style="margin:0 0 16px;line-height:1.9;color:var(--text-dim);font-size:calc(13.5px * var(--font-scale))">يحتاج GBS إذن الموقع ليعرف مكانك ويرسم السهم نحو وجهتك. اضغط «السماح» ثم وافق في النافذة التالية واختر «الموقع الدقيق». موقعك يبقى على جهازك فقط.</p>'
                        + '<button type="button" class="gps-big" id="gpsIntroOk" style="margin-bottom:8px">السماح بالموقع</button>'
                        + '<button type="button" class="btn btn-ghost" id="gpsIntroNo" style="width:100%">ليس الآن</button></div>';
                    document.body.appendChild(ov);
                    const done = function (v) {
                        if (ov.parentNode)
                            ov.parentNode.removeChild(ov);
                        resolve(v);
                    };
                    ov.querySelector('#gpsIntroOk').addEventListener('click', function () { done(true); });
                    ov.querySelector('#gpsIntroNo').addEventListener('click', function () { done(false); });
                });
            }
            async function init() {
                let p;
                try {
                    p = await GEO.check();
                }
                catch (e) {
                    p = { state: 'unknown', precise: null, src: 'web' };
                }
                if (S.dead)
                    return;
                S.perm = p;
                paintPerm();
                updStat();
                if (!opt('permIntro') && p.state !== 'granted' && p.state !== 'unsupported' && p.state !== 'insecure') {
                    setOpt('permIntro', true);
                    const ans = await permIntro();
                    if (S.dead)
                        return;
                    if (ans) {
                        S.asked = true;
                        try {
                            p = await GEO.request();
                        }
                        catch (e) { }
                        if (S.dead)
                            return;
                        S.perm = p;
                        paintPerm();
                        updStat();
                    }
                }
                if (p.state === 'prompt' && p.src === 'cap') {
                    S.asked = true;
                    try {
                        p = await GEO.request();
                    }
                    catch (e) { }
                    if (S.dead)
                        return;
                    S.perm = p;
                }
                S.asked = true;
                const st = S.perm.state;
                if (st === 'granted' || st === 'unknown' || st === 'prompt')
                    startWatch();
                else {
                    S.errKind = st;
                    S.err = GEO.msg(st);
                }
                paintPerm();
                updStat();
                if (!S.dead)
                    S.offPerm = GEO.onPermissionChange(function () { recheck(false, false); });
            }
            function permLbl(s) {
                return ({ granted: 'مسموح', prompt: 'لم يُطلب بعد', denied: 'مرفوض', disabled: 'GPS مغلق', unsupported: 'غير مدعوم', insecure: 'اتصال غير آمن', unknown: 'غير معروف' })[s] || 'غير معروف';
            }
            /* ---------- بطاقات الأذونات في «الرئيسية» ---------- */
            function permHTML() {
                const P = S.perm || {}, st = P.state, k = S.errKind, now = Date.now();
                const opener = GEO.hasSettingsOpener();
                const btn = function (act, label, primary) { return '<button type="button" class="btn ' + (primary ? 'btn-primary' : 'btn-ghost') + '" data-act="' + act + '">' + label + '</button>'; };
                const card = function (cls, ic, title, body, btns) {
                    return '<div class="gps-perm ' + cls + '"><div class="gps-perm-h"><span>' + ic + '</span><span>' + title + '</span></div><p>' + body + '</p>'
                        + (btns ? '<div class="gps-row">' + btns + '</div>' : '') + '</div>';
                };
                const steps = 'افتح إعدادات الهاتف ← التطبيقات ← هذا التطبيق ← الأذونات ← الموقع، ثم اختر «السماح أثناء استخدام التطبيق» وفعّل «استخدام الموقع الدقيق».';
                let out = '';
                if (st === 'unsupported' || k === 'unsupported')
                    out += card('bad', '📵', 'تحديد الموقع غير مدعوم', 'هذا الجهاز أو المتصفح لا يوفّر خدمة الموقع. جرّب من التطبيق المثبّت على هاتف يدعم GPS.', '');
                else if (st === 'insecure')
                    out += card('bad', '🔒', 'الاتصال غير آمن', GEO.msg('insecure') + '.', '');
                else if (k === 'policy')
                    out += card('bad', '🚫', 'الموقع محجوب في هذه الصفحة', GEO.msg('policy') + '.', '');
                else if (st === 'denied' || k === 'denied')
                    out += card('bad', '📍', 'إذن الموقع مرفوض', 'بدون الإذن لا يمكن تحديد موقعك. ' + steps, btn('allow', 'إعادة المحاولة', true) + (opener ? btn('settings', 'فتح الإعدادات') : ''));
                else if (st === 'disabled' || k === 'disabled')
                    out += card('bad', '🛰️', 'خدمة الموقع (GPS) مغلقة', 'شغّل «الموقع» من لوحة الإعدادات السريعة في هاتفك ثم ارجع — سيستأنف التتبّع تلقائيًا.', btn('allow', 'إعادة المحاولة', true) + (opener ? btn('gpsset', 'فتح إعدادات الموقع') : ''));
                else if ((st === 'prompt' || st === 'unknown') && S.asked && !S.pos && now - S.started > 4000)
                    out += card('warn', '📍', 'التطبيق يحتاج إذن الموقع', 'اضغط «السماح» ثم وافق في النافذة التي تظهر. نستخدم موقعك على جهازك فقط لإظهار السهم والمسافة، ولا يُرسل لأي جهة.', btn('allow', 'السماح بالموقع', true));
                else if (st === 'granted' && P.precise === false)
                    out += card('warn', '🎯', 'الإذن «تقريبي» فقط', 'الدقة الحالية قد تصل لمئات الأمتار. اختر «الموقع الدقيق / Precise» حتى يعمل السهم بدقة.', btn('allow', 'السماح بالموقع الدقيق', true) + (opener ? btn('settings', 'فتح الإعدادات') : ''));
                else if (S.pos && S.lowSince && now - S.lowSince > 10000)
                    out += card('warn', '🎯', 'دقة الموقع منخفضة جدًا', 'قد يكون «الموقع الدقيق» مغلقًا أو أنك داخل مبنى. فعّل الموقع الدقيق من الإعدادات وانتقل لمكان مكشوف.', opener ? btn('settings', 'فتح الإعدادات') : '');
                if (S.ori === 'need')
                    out += card('warn', '🧭', 'فعّل بوصلة الاتجاه', 'يحتاج السهم إذن حساس الحركة والاتجاه ليعرف إلى أين يشير هاتفك. اضغط الزر ثم وافق.', btn('ori', 'تفعيل البوصلة', true));
                else if (S.ori === 'denied')
                    out += card('bad', '🧭', 'إذن حساس الاتجاه مرفوض', 'السهم سيعتمد على اتجاه حركتك فقط. لتفعيله أغلق التطبيق تمامًا وأعد فتحه ثم اسمح بحساس الحركة والاتجاه.', btn('ori', 'إعادة المحاولة'));
                return out;
            }
            function paintPerm() { setHTML('gpsPerm', permHTML()); }
            /* ---------- شريط الحالة ---------- */
            function updLive() {
                /* أخضر ينبض: الموقع مفتوح وتصل قراءات حديثة — أحمر يهتز: الموقع مغلق أو لا توجد إشارة */
                const sb = $('gpsSave');
                if (sb) {
                    if (S.pos && !S.capBusy)
                        sb.removeAttribute('disabled');
                    else
                        sb.setAttribute('disabled', '');
                }
                const ld = $('gpsLocDot'), lt = $('gpsLocTxt');
                if (!ld || !lt)
                    return;
                const on = !!(S.pos && !S.err && S.fix && (Date.now() - S.fix) <= 15000);
                const ag = $('gpsLocAge');
                if (ag && !ag.hidden)
                    ag.hidden = true;
                let t, cc;
                if (on) {
                    t = 'تم تحديث الموقع';
                    cc = 'gps-dot ok pulse';
                }
                else if (S.err) {
                    t = S.errKind === 'denied' ? 'اسمح للتطبيق بالوصول إلى الموقع الجغرافي' : 'افتح الموقع الجغرافي في هاتفك';
                    cc = 'gps-dot bad shake';
                }
                else if (!S.pos) {
                    if (Date.now() - S.started < 10000) {
                        t = 'جارٍ تحديد الموقع…';
                        cc = 'gps-dot bad';
                    }
                    else {
                        t = 'افتح الموقع الجغرافي أو انتقل لمكان مكشوف';
                        cc = 'gps-dot bad shake';
                    }
                }
                else {
                    t = 'الإشارة منقطعة — تأكد أن الموقع الجغرافي مفتوح';
                    cc = 'gps-dot bad shake';
                }
                if (ld.className !== cc)
                    ld.className = cc;
                if (lt.textContent !== t)
                    lt.textContent = t;
            }
            function updStat() {
                updLive();
                const dot = $('gpsDot'), txt = $('gpsStatTxt');
                if (!dot || !txt)
                    return;
                let cls = 'warn', t;
                if (S.err) {
                    cls = 'bad';
                    t = ({ denied: 'إذن الموقع مرفوض', disabled: 'خدمة الموقع (GPS) مغلقة' })[S.errKind] || S.err;
                }
                else if (!S.pos) {
                    t = 'جارٍ البحث عن إشارة GPS… الأفضل أن تكون في مكان مكشوف' + (S.mode === 'low' ? ' (دقة منخفضة مؤقتًا)' : '');
                }
                else {
                    const acc = S.pos.coords.accuracy, age = Math.round((Date.now() - S.fix) / 1000), qq = qual(acc);
                    cls = qq.c;
                    t = 'تم تحديد الموقع — الدقة ±' + Math.round(acc) + ' م (' + qq.t + ')';
                    if (S.perm && S.perm.precise === false)
                        t += ' — إذن تقريبي';
                    if (age > 15) {
                        cls = 'warn';
                        t = 'آخر تحديث قبل ' + age + ' ثانية — الإشارة ضعيفة';
                    }
                }
                const c2 = 'gps-dot ' + cls;
                if (dot.className !== c2)
                    dot.className = c2;
                if (txt.textContent !== t)
                    txt.textContent = t;
            }
            /* ---------- المحرّر (حفظ / تعديل وجهة) ---------- */
            function openEditor(opt2) {
                S.editor = { id: opt2.id || null, title: opt2.title, name: opt2.name || '', emoji: opt2.emoji || '📍', lat: opt2.lat, lng: opt2.lng, acc: opt2.acc, n: opt2.n };
                renderEditor();
                const slot = $('gpsEdSlot');
                try {
                    if (slot)
                        slot.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                catch (e) { }
            }
            function renderEditor() {
                const slot = $('gpsEdSlot');
                if (!slot)
                    return;
                const e = S.editor;
                if (!e) {
                    slot.innerHTML = '';
                    return;
                }
                const accNote = fin(e.acc) ? '<p class="gps-note" style="margin:0 0 8px">الدقة التقديرية ±' + Math.round(e.acc) + ' م' + (e.n > 1 ? ' — من متوسط ' + e.n + ' قراءة' : '') + '</p>' : '';
                slot.innerHTML = '<div class="gps-ed"><p style="margin:0 0 10px;font-weight:900;font-size:calc(15px * var(--font-scale))">' + esc(e.title) + '</p>'
                    + accNote
                    + '<input class="gps-in" id="gpsEdName" maxlength="40" placeholder="اسم المكان (مثال: البيت، الفندق)">'
                    + '<div class="gps-chips">' + ICONS.map(function (i) { return '<button type="button" class="gps-chip' + (i === e.emoji ? ' on' : '') + '" data-ic="' + i + '">' + i + '</button>'; }).join('') + '</div>'
                    + '<div class="gps-grid"><input class="gps-in" id="gpsEdLat" inputmode="decimal" dir="ltr" placeholder="خط العرض"><input class="gps-in" id="gpsEdLng" inputmode="decimal" dir="ltr" placeholder="خط الطول"></div>'
                    + '<div class="gps-row"><button type="button" class="btn btn-ghost" id="gpsEdCancel">إلغاء</button><button type="button" class="btn btn-primary" id="gpsEdOk">حفظ</button></div></div>';
                $('gpsEdName').value = e.name;
                $('gpsEdLat').value = e.lat;
                $('gpsEdLng').value = e.lng;
                qa(slot, '[data-ic]').forEach(function (b) {
                    b.addEventListener('click', function () {
                        e.emoji = b.getAttribute('data-ic');
                        qa(slot, '[data-ic]').forEach(function (x) { x.classList.toggle('on', x === b); });
                    });
                });
                $('gpsEdCancel').addEventListener('click', function () { S.editor = null; renderEditor(); });
                $('gpsEdOk').addEventListener('click', saveEditor);
            }
            function newId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
            function saveEditor() {
                const e = S.editor;
                if (!e)
                    return;
                const name = ($('gpsEdName').value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
                const la = parseNum($('gpsEdLat').value), lo = parseNum($('gpsEdLng').value);
                if (!okLL(la, lo)) {
                    toast('الإحداثيات غير صحيحة — خط العرض بين -90 و90، وخط الطول بين -180 و180');
                    return;
                }
                const same = fin(e.acc) && Math.abs(la - parseNum(e.lat)) < 1e-7 && Math.abs(lo - parseNum(e.lng)) < 1e-7;
                const acc = same ? Math.round(e.acc) : undefined;
                const D = db();
                if (e.id) {
                    const d = D.dests.find(function (x) { return x.id === e.id; });
                    if (d) {
                        d.name = name || d.name;
                        d.emoji = e.emoji;
                        d.lat = la;
                        d.lng = lo;
                        if (acc !== undefined)
                            d.acc = acc;
                        else if (la !== d.lat || lo !== d.lng)
                            delete d.acc;
                    }
                }
                else {
                    if (D.dests.length >= MAX) {
                        toast('وصلت للحد الأقصى (' + MAX + ') من الوجهات — احذف بعضها أولًا');
                        return;
                    }
                    const nd = { id: newId(), name: name || (e.emoji === '🚗' ? 'موقف السيارة' : 'وجهة ' + (D.dests.length + 1)), emoji: e.emoji, lat: la, lng: lo, t: Date.now() };
                    if (acc !== undefined)
                        nd.acc = acc;
                    D.dests.push(nd);
                }
                persist();
                S.editor = null;
                if (S.tab === 'dest') {
                    S.results = null;
                    paintBody();
                }
                else
                    renderEditor();
                toast('تم الحفظ');
            }
            /* ---------- تثبيت موقع دقيق: متوسط مرجّح لعدة قراءات ---------- */
            function curFix() { return { lat: lat(), lng: lng(), acc: S.pos.coords.accuracy, n: 1 }; }
            function captureBest(ms, onProg) {
                return new Promise(function (resolve) {
                    if (!S.pos) {
                        resolve(null);
                        return;
                    }
                    const t0 = Date.now();
                    (function loop() {
                        if (S.dead || !S.pos) {
                            resolve(null);
                            return;
                        }
                        const now = Date.now(), el = now - t0;
                        const moving = S.spd != null && S.spd > 1.2;
                        const win = S.buf.filter(function (x) { return now - x.rt <= Math.max(ms, 3000) + 500; });
                        const avg = GEO.average(win);
                        if (onProg)
                            onProg(el, avg);
                        if (el >= ms || moving || (avg && avg.n >= 6 && avg.acc <= 6)) {
                            resolve(moving || !avg ? curFix() : avg);
                            return;
                        }
                        setTimeout(loop, 400);
                    })();
                });
            }
            async function doSave(kind) {
                if (!S.pos || S.capBusy)
                    return;
                S.capBusy = true;
                const id = kind === 'park' ? 'gpsPark' : kind === 'home' ? 'gpsHomeOk' : 'gpsSave', ms = kind === 'park' ? 5000 : 6000;
                const btn = $(id), old = btn ? btn.innerHTML : '';
                const r = await captureBest(ms, function (el) { const b = $(id); if (b)
                    b.textContent = 'تثبيت… ' + Math.max(1, Math.ceil((ms - el) / 1000)) + ' ث'; });
                S.capBusy = false;
                const b2 = $(id);
                if (b2)
                    b2.innerHTML = old;
                if (S.dead || !r)
                    return;
                const go = function () { kind === 'park' ? finishPark(r) : kind === 'home' ? finishHome(r) : finishSave(r); };
                if (r.acc > 60)
                    showConfirm('دقة الموقع ضعيفة', 'الدقة الحالية ±' + Math.round(r.acc) + ' م — قد يكون المكان المحفوظ بعيدًا عن موقعك الفعلي. الأفضل الانتظار في مكان مكشوف ثم المحاولة. هل تحفظه على أي حال؟', go);
                else
                    go();
            }
            function finishSave(r) {
                if (S.tab !== 'home' && S.tab !== 'dest')
                    return;
                openEditor({ title: 'إضافة وجهة — موقعك الحالي', lat: r.lat.toFixed(6), lng: r.lng.toFixed(6), emoji: '📍', acc: r.acc, n: r.n });
            }
            function finishHome(r) {
                const D = db();
                if (D.dests.length >= MAX) {
                    toast('وصلت للحد الأقصى (' + MAX + ') من الوجهات — احذف بعضها أولًا');
                    return;
                }
                const inp = $('gpsHomeName');
                const raw = inp ? inp.value : (S.hName || '');
                const name = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 40) || ('موقع ' + (D.dests.length + 1));
                D.dests.push({ id: newId(), name: name, emoji: '📍', lat: +r.lat.toFixed(6), lng: +r.lng.toFixed(6), t: Date.now(), acc: Math.round(r.acc) });
                persist();
                S.hName = '';
                S.hOpen = false;
                if (inp)
                    inp.value = '';
                showHomeBox();
                try {
                    if (navigator.vibrate)
                        navigator.vibrate(30);
                }
                catch (e) { }
                toast('تم حفظ «' + name + '» (±' + Math.round(r.acc) + ' م) — يظهر أولًا في «الوجهات»');
            }
            function finishPark(r) {
                const D = db(), la = +r.lat.toFixed(6), lo = +r.lng.toFixed(6), acc = Math.round(r.acc);
                const old = D.dests.find(function (x) { return x.emoji === '🚗' && x.name === 'موقف السيارة'; });
                if (old) {
                    old.lat = la;
                    old.lng = lo;
                    old.t = Date.now();
                    old.acc = acc;
                }
                else {
                    if (D.dests.length >= MAX) {
                        toast('وصلت للحد الأقصى (' + MAX + ') من الوجهات — احذف بعضها أولًا');
                        return;
                    }
                    D.dests.push({ id: newId(), name: 'موقف السيارة', emoji: '🚗', lat: la, lng: lo, t: Date.now(), acc: acc });
                }
                persist();
                try {
                    if (navigator.vibrate)
                        navigator.vibrate(30);
                }
                catch (e) { }
                toast('تم حفظ موقف سيارتك (±' + acc + ' م) — اختره من «الوجهات» للعودة إليه');
            }
            /* ---------- تبويب: الرئيسية ---------- */
            function homeHTML() {
                return '<div class="gps-loc"><i class="gps-dot" id="gpsLocDot"></i><span id="gpsLocTxt"></span><span class="gps-age" id="gpsLocAge" hidden></span></div>' + dialHTML()
                    + '<div class="gps-grid">'
                    + '<div class="gps-cell"><small>دقة الموقع</small><b id="gpsAcc">—</b></div>'
                    + '<div class="gps-cell"><small>جودة الإشارة</small><b id="gpsSig">—</b></div>'
                    + '<div class="gps-cell"><small>السرعة</small><b id="gpsSpd">—</b></div>'
                    + '<div class="gps-cell"><small>الارتفاع</small><b id="gpsAlt">—</b></div>'
                    + '<div class="gps-cell"><small>اتجاه الهاتف</small><b id="gpsHdg">—</b></div>'
                    + '<div class="gps-cell gps-crd"><small>الإحداثيات</small><b><span id="gpsLat">—</span><span id="gpsLng"></span></b></div></div>'
                    + '<div class="gps-row"><button type="button" class="btn btn-ghost" id="gpsPark" disabled>موقف سيارتي</button><button type="button" class="btn btn-ghost" id="gpsCopy" disabled>نسخ الإحداثيات</button></div>'
                    + '<div class="gps-row"><button type="button" class="btn btn-ghost" id="gpsShare" disabled>مشاركة موقعي</button><button type="button" class="btn btn-ghost" id="gpsMaps" disabled>فتحه في الخرائط</button></div>'
                    + '<p class="gps-note">«حفظ الموقع الحالي» و«موقف سيارتي» يجمعان عدة قراءات لثوانٍ ويحسبان متوسطها المرجّح بالدقة، فيكون المكان المحفوظ أدق من قراءة واحدة.</p>';
            }
            function showHomeBox() {
                const bx = $('gpsHomeBox'), bt = $('gpsHomeSave');
                if (bx)
                    bx.hidden = !S.hOpen;
                if (bt)
                    bt.hidden = !!S.hOpen;
            }
            function bindHome() {
                bindNav();
                $('gpsHomeSave').addEventListener('click', function () {
                    S.hOpen = true;
                    showHomeBox();
                    try {
                        $('gpsHomeName').focus();
                    }
                    catch (e) { }
                });
                $('gpsHomeName').addEventListener('input', function () { S.hName = this.value; });
                $('gpsHomeName').addEventListener('keydown', function (e) { if (e.key === 'Enter') {
                    e.preventDefault();
                    if (S.pos && !S.capBusy)
                        doSave('home');
                } });
                $('gpsHomeOk').addEventListener('click', function () { doSave('home'); });
                $('gpsHomeCancel').addEventListener('click', function () {
                    S.hOpen = false;
                    S.hName = '';
                    $('gpsHomeName').value = '';
                    showHomeBox();
                });
                $('gpsPark').addEventListener('click', function () { doSave('park'); });
                $('gpsCopy').addEventListener('click', function () { if (S.pos)
                    F.copy(lat().toFixed(6) + ', ' + lng().toFixed(6)); });
                $('gpsShare').addEventListener('click', function () {
                    if (S.pos)
                        F.share('موقعي الحالي (الدقة ±' + Math.round(S.pos.coords.accuracy) + ' م): https://www.google.com/maps?q=' + lat().toFixed(6) + ',' + lng().toFixed(6));
                });
                $('gpsMaps').addEventListener('click', function () {
                    if (S.pos)
                        window.open('https://www.google.com/maps?q=' + lat().toFixed(6) + ',' + lng().toFixed(6), '_blank');
                });
            }
            function updHome() {
                updNav();
                const ok = !!S.pos;
                ['gpsSave', 'gpsHomeSave', 'gpsHomeOk', 'gpsPark', 'gpsCopy', 'gpsShare', 'gpsMaps'].forEach(function (id) {
                    const b = $(id);
                    if (b) {
                        if (ok && !S.capBusy)
                            b.removeAttribute('disabled');
                        else
                            b.setAttribute('disabled', '');
                    }
                });
                if (!ok)
                    return;
                const stale = markStale();
                const c = S.pos.coords;
                setTxt('gpsLat', fmtCoord(c.latitude, true));
                setTxt('gpsLng', fmtCoord(c.longitude, false));
                const qq = qual(c.accuracy);
                setTxt('gpsAcc', '±' + Math.round(c.accuracy) + ' م — ' + qq.t);
                setTxt('gpsAlt', fin(c.altitude) ? Math.round(c.altitude) + ' م' + (fin(c.altitudeAccuracy) && c.altitudeAccuracy > 0 ? ' (±' + Math.round(c.altitudeAccuracy) + ')' : '') : '—');
                const sp = S.spd != null ? S.spd : (fin(c.speed) ? c.speed : null);
                /* [إصلاح] لا نعرض سرعة قديمة كأنها مباشرة */
                setTxt('gpsSpd', stale ? '—' : (sp != null ? (sp * 3.6 < 1 ? '0 كم/س' : Math.round(sp * 3.6) + ' كم/س') : '—'));
                /* جودة الإشارة: من الدقة الحالية وعمر آخر قراءة (المتصفح لا يعطي عدد الأقمار) */
                const nb = stale ? 0 : (c.accuracy <= 10 ? 4 : (c.accuracy <= 25 ? 3 : (c.accuracy <= 60 ? 2 : 1)));
                const sc = nb >= 3 ? 'ok' : (nb === 2 ? 'warn' : 'bad');
                let bh = '';
                for (let i = 1; i <= 4; i++)
                    bh += '<u' + (i <= nb ? ' class="on"' : '') + '></u>';
                setHTML('gpsSig', '<span class="gps-bars ' + sc + '">' + bh + '</span> ' + (stale ? 'بانتظار إشارة' : ['', 'ضعيفة', 'متوسطة', 'جيدة', 'ممتازة'][nb]));
                updHdg();
            }
            /* [إصلاح] الموقع قديم؟ (لا قراءة منذ 6 ثوانٍ: بعد العودة من الخلفية، نفق، إشارة ضعيفة) → نعلّم الواجهة بدل عرضه كمباشر */
            function markStale() {
                const stale = !S.fix || Date.now() - S.fix > 6000;
                const fr = $('gpsFrame');
                if (fr)
                    fr.classList.toggle('gps-stale', stale);
                if (stale) {
                    setTxt('gpsSpd', '—');
                    const sg = $('gpsSig');
                    if (sg && sg.textContent.indexOf('بانتظار') < 0)
                        setHTML('gpsSig', '<span class="gps-bars bad"><u></u><u></u><u></u><u></u></span> بانتظار إشارة');
                }
                return stale;
            }
            function updHdg() {
                const hh = curHeading();
                setTxt('gpsHdg', hh ? (Math.round(hh.h) % 360) + '° ' + dirLbl(hh.h) : '—');
            }
            /* ---------- تبويب: الوجهات ---------- */
            function destHTML() {
                return '<div id="gpsRecent"></div><button type="button" class="gps-add" id="gpsSave" disabled><span>+ إضافة وجهة</span><small>حفظ موقعك الحالي كوجهة</small></button>'
                    + '<div id="gpsEdSlot"></div><div class="gps-list" id="gpsList" style="margin-top:0;margin-bottom:12px"></div><div id="gpsPerm"></div>' + statHTML()
                    + '<div class="gps-row" style="margin-top:0"><input class="gps-in" id="gpsQ" placeholder="اسم مكان، أو إحداثيات، أو رابط خرائط جوجل" enterkeyhint="search" autocomplete="off"><button type="button" class="btn btn-primary" id="gpsGo" style="flex:0 0 auto;padding:0 20px">بحث</button></div>'
                    + '<p class="gps-note">البحث بالاسم يحتاج إنترنت (ويُرتّب الأقرب لموقعك أولًا). الإحداثيات بصيغة عشرية (15.5007, 32.5599) أو درجات (15°30′02″N 32°33′21″E) وروابط خرائط جوجل وOpenStreetMap الكاملة تعمل بدون إنترنت.</p>'
                    + '<div id="gpsRes"></div>';
            }
            function sortedDests() {
                const D = db(), arr = D.dests.slice();
                if (S.pos) {
                    arr.forEach(function (d) { d._m = dist(lat(), lng(), d.lat, d.lng); });
                    arr.sort(function (a, b) { return a._m - b._m; });
                }
                else
                    arr.sort(function (a, b) { return (b.t || 0) - (a.t || 0); });
                return arr;
            }
            function dateTxt(t) {
                try {
                    return new Date(t).toLocaleDateString('ar', { day: 'numeric', month: 'short' });
                }
                catch (e) {
                    return '';
                }
            }
            function renderList() {
                renderRecent();
                const list = $('gpsList');
                if (!list)
                    return;
                const D = db();
                if (!D.dests.length) {
                    list.innerHTML = '<p class="gps-empty">لا توجد وجهات بعد.<br>اضغط «إضافة وجهة» لحفظ موقعك الحالي، أو ابحث عن مكان بالأسفل.</p>';
                    return;
                }
                list.innerHTML = '<div class="gps-h"><span>كل الوجهات</span><em>' + D.dests.length + '</em></div>'
                    + sortedDests().map(function (d) { return destItemHTML(d, D); }).join('');
            }
            /* ---------- المواقع المحفوظة مؤخرًا ---------- */
            function agoTxt(t) {
                if (!t)
                    return '';
                const s = Math.max(0, (Date.now() - t) / 1000);
                if (s < 60)
                    return 'الآن';
                const m = Math.floor(s / 60);
                if (m < 60)
                    return 'منذ ' + (m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? m + ' دقائق' : m + ' دقيقة');
                const h = Math.floor(m / 60);
                if (h < 24)
                    return 'منذ ' + (h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? h + ' ساعات' : h + ' ساعة');
                const d = Math.floor(h / 24);
                if (d < 30)
                    return 'منذ ' + (d === 1 ? 'يوم' : d === 2 ? 'يومين' : d <= 10 ? d + ' أيام' : d + ' يومًا');
                return 'منذ ' + dateTxt(t);
            }
            function fullDate(t) {
                try {
                    return new Date(t).toLocaleString('ar', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
                }
                catch (e) {
                    return '';
                }
            }
            function recentHTML(d, D, first) {
                const ql = fin(d.acc) ? qual(d.acc) : null;
                let h = '<div class="gps-card' + (d.id === D.sel ? ' sel' : '') + (first ? ' new' : '') + '" data-id="' + esc(d.id) + '">'
                    + (d.id === D.sel ? '<span class="gps-selb">الوجهة الحالية</span>' : '')
                    + '<div class="gps-ch"><span class="gps-ic">' + esc(d.emoji) + '</span><div class="gps-main"><b>' + esc(d.name) + '</b><small>' + esc(agoTxt(d.t)) + '</small></div></div>'
                    + '<div class="gps-cd">'
                    + '<div><small>المسافة</small><b class="rtl" data-d="' + esc(d.id) + '">' + (S.pos ? fmtD(dist(lat(), lng(), d.lat, d.lng)) : '—') + '</b></div>'
                    + '<div><small>الاتجاه</small><b class="rtl" data-b="' + esc(d.id) + '">' + (S.pos ? dirLbl(bear(lat(), lng(), d.lat, d.lng)) : '—') + '</b></div>'
                    + '<div class="w"><small>الإحداثيات</small><b>' + esc(fmtCoord(d.lat, true)) + ', ' + esc(fmtCoord(d.lng, false)) + '</b></div>'
                    + '<div><small>دقة الحفظ</small><b class="rtl">' + (ql ? '±' + d.acc + ' م — ' + ql.t : 'غير مسجّلة') + '</b></div>'
                    + '<div><small>وقت الحفظ</small><b class="rtl">' + esc(fullDate(d.t)) + '</b></div>'
                    + '</div>'
                    + '<div class="gps-cf"><button type="button" class="gps-go" data-go>🧭 توجّه إليها</button><button type="button" class="gps-cp" data-cp title="نسخ الإحداثيات">📋</button></div>'
                    + '</div>';
                return h;
            }
            function renderRecent() {
                const box = $('gpsRecent');
                if (!box)
                    return;
                const D = db();
                const rec = D.dests.filter(function (x) { return x && x.t; }).sort(function (a, b) { return b.t - a.t; }).slice(0, 6);
                if (!rec.length) {
                    box.innerHTML = '';
                    return;
                }
                box.innerHTML = '<div class="gps-h"><span>محفوظة مؤخرًا</span><em>' + rec.length + '</em></div>'
                    + '<div class="gps-rc">' + rec.map(function (d, i) { return recentHTML(d, D, i === 0); }).join('') + '</div>';
            }
            function copyCoords(d) {
                const txt = d.lat.toFixed(6) + ', ' + d.lng.toFixed(6);
                const ok = function () { toast('تم نسخ الإحداثيات'); };
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(txt).then(ok, function () { fallback(); });
                        return;
                    }
                }
                catch (e) { }
                fallback();
                function fallback() {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = txt;
                        ta.setAttribute('readonly', '');
                        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
                        document.body.appendChild(ta);
                        ta.select();
                        ta.setSelectionRange(0, 99999);
                        const r = document.execCommand('copy');
                        document.body.removeChild(ta);
                        if (r)
                            ok();
                        else
                            toast(txt);
                    }
                    catch (e) {
                        toast(txt);
                    }
                }
            }
            function destItemHTML(d, D) {
                return '<div class="gps-item' + (d.id === D.sel ? ' sel' : '') + '" data-id="' + esc(d.id) + '">'
                    + '<span class="gps-ic">' + esc(d.emoji) + '</span>'
                    + '<div class="gps-main"><b>' + esc(d.name) + '</b><small>' + esc(dateTxt(d.t)) + ' — ' + d.lat.toFixed(4) + ', ' + d.lng.toFixed(4) + (fin(d.acc) ? ' — ±' + d.acc + ' م' : '') + '</small></div>'
                    /* [تصميم] المسافة + الاتجاه (يحدّثهما updDist تلقائيًا عبر data-d / data-b) */
                    + '<span class="gps-lx-nd"><span class="gps-dist" data-d="' + esc(d.id) + '">' + (S.pos ? fmtD(d._m) : '') + '</span>'
                    + '<small class="gps-dir" data-b="' + esc(d.id) + '">' + (S.pos ? dirLbl(bear(lat(), lng(), d.lat, d.lng)) : '') + '</small></span>'
                    /* [تصميم] صف الأزرار: «توجّه» يمرّ لنفس معالج الضغط على الصف (pickDest) */
                    + '<span class="gps-acts"><button type="button" class="gps-act gps-goi" title="توجّه إليها">🧭</button>'
                    + '<button type="button" class="gps-act" data-ed title="تعديل">✏️</button>'
                    + '<button type="button" class="gps-act" data-del title="حذف">🗑️</button></span></div>';
            }
            function updDist() {
                if (!S.pos)
                    return;
                const D = db();
                qa(root, '[data-d]').forEach(function (el) {
                    const d = D.dests.find(function (x) { return x.id === el.getAttribute('data-d'); });
                    if (d)
                        el.textContent = fmtD(dist(lat(), lng(), d.lat, d.lng));
                });
                qa(root, '[data-b]').forEach(function (el) {
                    const d = db().dests.find(function (x) { return x.id === el.getAttribute('data-b'); });
                    if (d) {
                        const t = dirLbl(bear(lat(), lng(), d.lat, d.lng));
                        if (el.textContent !== t)
                            el.textContent = t;
                    }
                });
            }
            function pickDest(id) {
                db().sel = id;
                persist();
                S.arrived = false;
                go('home');
            }
            function bindDest() {
                $('gpsSave').addEventListener('click', function () { doSave('save'); });
                $('gpsGo').addEventListener('click', doSearch);
                $('gpsQ').addEventListener('keydown', function (e) { if (e.key === 'Enter') {
                    e.preventDefault();
                    doSearch();
                } });
                $('gpsRecent').addEventListener('click', function (e) {
                    const card = e.target.closest('.gps-card');
                    if (!card)
                        return;
                    const d = db().dests.find(function (x) { return x.id === card.getAttribute('data-id'); });
                    if (!d)
                        return;
                    if (e.target.closest('[data-cp]')) {
                        copyCoords(d);
                        return;
                    }
                    pickDest(d.id);
                });
                $('gpsList').addEventListener('click', function (e) {
                    const row = e.target.closest('.gps-item');
                    if (!row)
                        return;
                    const id = row.getAttribute('data-id');
                    const d = db().dests.find(function (x) { return x.id === id; });
                    if (!d)
                        return;
                    if (e.target.closest('[data-del]')) {
                        showConfirm('حذف الوجهة', 'سيتم حذف «' + d.name + '» نهائيًا. لا يمكن التراجع عن هذا الإجراء.', function () {
                            const D = db();
                            D.dests = D.dests.filter(function (x) { return x.id !== id; });
                            if (D.sel === id)
                                D.sel = null;
                            persist();
                            renderList();
                            toast('تم حذف الوجهة');
                        });
                        return;
                    }
                    if (e.target.closest('[data-ed]')) {
                        openEditor({ id: d.id, title: 'تعديل الوجهة', name: d.name, emoji: d.emoji, lat: d.lat, lng: d.lng, acc: d.acc });
                        return;
                    }
                    pickDest(id);
                });
                $('gpsRes').addEventListener('click', function (e) {
                    const it = e.target.closest('[data-r]');
                    if (!it || !S.results)
                        return;
                    const r = S.results[+it.getAttribute('data-r')];
                    if (!r)
                        return;
                    openEditor({ title: 'إضافة وجهة', name: r.name.split(',')[0].trim().slice(0, 40), emoji: '📍', lat: r.lat.toFixed(6), lng: r.lng.toFixed(6) });
                });
                renderList();
                renderResults();
            }
            function renderResults() {
                const box = $('gpsRes');
                if (!box)
                    return;
                if (S.results === 'loading') {
                    box.innerHTML = '<p class="gps-empty">جارٍ البحث…</p>';
                    return;
                }
                if (S.results === 'fail') {
                    box.innerHTML = '<p class="gps-empty">تعذّر البحث — تأكد من الإنترنت. يمكنك لصق الإحداثيات مباشرة وستعمل بدون إنترنت.</p>';
                    return;
                }
                if (!Array.isArray(S.results)) {
                    box.innerHTML = '';
                    return;
                }
                if (!S.results.length) {
                    box.innerHTML = '<p class="gps-empty">لا توجد نتائج — جرّب كتابة الاسم بطريقة أخرى أو أضف اسم المدينة.</p>';
                    return;
                }
                box.innerHTML = '<div class="gps-list">' + S.results.map(function (r, i) {
                    const parts = r.name.split(',');
                    const first = parts.shift().trim(), rest = parts.join(',').trim();
                    return '<div class="gps-item" data-r="' + i + '" style="cursor:pointer"><span class="gps-ic">📍</span>'
                        + '<div class="gps-main"><b>' + esc(first) + '</b><small>' + esc(rest) + '</small></div>'
                        + (S.pos ? '<span class="gps-dist">' + fmtD(dist(lat(), lng(), r.lat, r.lng)) + '</span>' : '') + '</div>';
                }).join('') + '</div>';
            }
            async function doSearch() {
                const inp = $('gpsQ');
                if (!inp)
                    return;
                const v = inp.value.trim();
                if (!v)
                    return;
                const ll = parseLL(v);
                if (ll) {
                    S.results = null;
                    renderResults();
                    openEditor({ title: 'إضافة وجهة بالإحداثيات', emoji: '📍', lat: ll.lat, lng: ll.lng });
                    return;
                }
                if (/^https?:\/\//i.test(v)) {
                    toast('هذا الرابط لا يحتوي إحداثيات ظاهرة (الروابط المختصرة لا تعمل) — افتحه في الخرائط وانسخ الرابط الكامل أو الإحداثيات');
                    return;
                }
                S.results = 'loading';
                renderResults();
                let tm = null;
                try {
                    const ctl = ('AbortController' in window) ? new AbortController() : null;
                    tm = setTimeout(function () { if (ctl)
                        ctl.abort(); }, 12000);
                    let bias = '';
                    if (S.pos) {
                        const la = lat(), lo = lng();
                        bias = '&viewbox=' + (lo - 1.5).toFixed(4) + ',' + (la + 1.5).toFixed(4) + ',' + (lo + 1.5).toFixed(4) + ',' + (la - 1.5).toFixed(4) + '&bounded=0';
                    }
                    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=ar' + bias + '&q=' + encodeURIComponent(v), { signal: ctl ? ctl.signal : undefined });
                    clearTimeout(tm);
                    if (!r.ok)
                        throw new Error('HTTP ' + r.status);
                    const j = await r.json();
                    if (S.dead || S.tab !== 'dest')
                        return;
                    S.results = (Array.isArray(j) ? j : []).map(function (x) { return { name: String(x.display_name || '').slice(0, 140), lat: +x.lat, lng: +x.lon }; })
                        .filter(function (x) { return okLL(x.lat, x.lng); });
                }
                catch (e) {
                    clearTimeout(tm);
                    if (S.dead || S.tab !== 'dest')
                        return;
                    S.results = 'fail';
                }
                renderResults();
            }
            /* ---------- تبويب: الحالة (الأذونات والتشخيص والإعدادات) ---------- */
            function kv(label, id) { return '<div class="gps-kv"><span>' + label + '</span><b id="' + id + '">—</b></div>'; }
            function tgl(k, label) { return '<button type="button" class="gps-tgl" role="switch" data-opt="' + k + '" aria-checked="' + (opt(k) ? 'true' : 'false') + '"><span>' + label + '</span><i></i></button>'; }
            function infoHTML() {
                const opener = GEO.hasSettingsOpener();
                return statHTML() + '<div class="gps-sec"><h5>🔐 الأذونات</h5>'
                    + kv('إذن الموقع', 'gpsI_perm') + kv('نوع الدقة المسموحة', 'gpsI_prec') + kv('حساس البوصلة', 'gpsI_ori') + kv('إبقاء الشاشة مضيئة', 'gpsI_wl')
                    + '<div class="gps-row"><button type="button" class="btn btn-primary" data-act="allow" style="flex:1">طلب الإذن</button><button type="button" class="btn btn-ghost" data-act="recheck" style="flex:1">إعادة الفحص</button></div>'
                    + '<div class="gps-row"><button type="button" class="btn btn-ghost" data-act="ori" style="flex:1">تفعيل البوصلة</button>' + (opener ? '<button type="button" class="btn btn-ghost" data-act="settings" style="flex:1">إعدادات التطبيق</button>' : '') + '</div></div>'
                    + '<div class="gps-sec"><h5>🛰️ جودة الإشارة</h5>'
                    + kv('الدقة الحالية', 'gpsI_acc') + kv('أفضل دقة في هذه الجلسة', 'gpsI_best') + kv('عمر آخر قراءة', 'gpsI_age') + kv('مصدر الموقع', 'gpsI_mode')
                    + kv('القراءات المقبولة / المرفوضة', 'gpsI_cnt') + kv('إعادة تشغيل التتبّع تلقائيًا', 'gpsI_rst') + '</div>'
                    + '<div class="gps-sec"><h5>🧭 البوصلة</h5>'
                    + kv('مصدر الاتجاه', 'gpsI_src') + kv('تصحيح الشمال التلقائي', 'gpsI_off') + kv('جودة معايرة الحساس', 'gpsI_cal')
                    + '<div class="gps-row"><button type="button" class="btn btn-ghost" data-act="resetoff" style="flex:1">إعادة ضبط المعايرة</button></div></div>'
                    + '<div class="gps-sec"><h5>🌐 البيئة</h5>' + kv('التشغيل', 'gpsI_env') + kv('الاتصال بالإنترنت', 'gpsI_net') + kv('اتصال آمن (HTTPS)', 'gpsI_sec') + '</div>'
                    + '<div class="gps-sec"><h5>⚙️ الإعدادات</h5>'
                    + tgl('filter', 'ثبات الموقع (فلتر كالمان لإزالة التذبذب)') + tgl('keepAwake', 'إبقاء الشاشة مضيئة أثناء التتبّع') + tgl('vibrate', 'اهتزاز عند الوصول') + tgl('dms', 'عرض الإحداثيات بالدرجات والدقائق')
                    + '</div>'
                    + '<button type="button" class="btn btn-ghost" data-act="diag" style="width:100%">نسخ تقرير التشخيص</button>'
                    + '<p class="gps-note">إن لم يعمل الموقع: تأكد من تفعيل GPS، وإذن الموقع «الدقيق»، ثم انتقل لمكان مكشوف وانتظر نصف دقيقة. أرسل «تقرير التشخيص» عند طلب المساعدة.</p>';
            }
            function badge(txt, cls) { return '<span class="gps-badge ' + cls + '">' + txt + '</span>'; }
            function updInfo() {
                const P = S.perm || {}, env = GEO.env();
                const stc = { granted: 'ok', prompt: 'warn', unknown: 'warn', denied: 'bad', disabled: 'bad', unsupported: 'bad', insecure: 'bad' }[P.state] || 'warn';
                setHTML('gpsI_perm', badge(permLbl(P.state), stc));
                setHTML('gpsI_prec', P.state !== 'granted' ? '—' : (P.precise === true ? badge('دقيق', 'ok') : (P.precise === false ? badge('تقريبي فقط', 'warn') : 'لا يمكن التحقق (يُحكم بالدقة الفعلية)')));
                const oriMap = { granted: badge('يعمل', 'ok'), wait: badge('بانتظار القراءة…', 'warn'), need: badge('يحتاج تفعيلًا', 'warn'), denied: badge('مرفوض', 'bad'), nodata: badge('لا توجد قراءات', 'bad'), unsupported: badge('غير مدعوم', 'bad') };
                setHTML('gpsI_ori', oriMap[S.ori] || '—');
                setHTML('gpsI_wl', !opt('keepAwake') ? 'متوقف من الإعدادات' : (S.wl ? badge('مفعّل', 'ok') : (S.wlOk === false ? badge('غير مدعوم', 'warn') : '—')));
                if (S.pos) {
                    const a = S.pos.coords.accuracy, qq = qual(a);
                    let bars = '';
                    for (let i = 1; i <= 4; i++)
                        bars += '<u class="' + (i <= qq.n ? 'on' : '') + '"></u>';
                    setHTML('gpsI_acc', '±' + Math.round(a) + ' م — ' + qq.t + '<span class="gps-bars ' + qq.c + '">' + bars + '</span>');
                }
                else
                    setHTML('gpsI_acc', '—');
                setTxt('gpsI_best', S.best != null ? '±' + Math.round(S.best) + ' م' : '—');
                setTxt('gpsI_age', S.fix ? Math.round((Date.now() - S.fix) / 1000) + ' ث' : '—');
                setTxt('gpsI_mode', S.mode === 'high' ? 'GPS عالي الدقة' : (S.mode === 'low' ? 'شبكة (دقة منخفضة)' : '—'));
                setTxt('gpsI_cnt', S.nAcc + ' / ' + S.nRej + (S.nJump ? ' (قفزات: ' + S.nJump + ')' : ''));
                setTxt('gpsI_rst', String(S.restarts));
                const hh = curHeading();
                setTxt('gpsI_src', !hh ? '—' : (hh.src === 's' ? 'حساس الهاتف' : 'مسار حركتك (GPS)'));
                setTxt('gpsI_off', S.offN >= 3 ? (S.off >= 0 ? '+' : '') + S.off.toFixed(1) + '°' : (S.offN > 0 ? 'جارٍ المعايرة…' : 'لم تتم بعد (امشِ أو قُد دقيقة)'));
                const ca = S.cAcc;
                setHTML('gpsI_cal', ca == null ? '—' : (ca < 0 ? badge('غير مضبوط', 'bad') : (ca <= 15 ? badge('جيد (±' + Math.round(ca) + '°)', 'ok') : badge('ضعيف (±' + Math.round(ca) + '°)', 'warn'))));
                setTxt('gpsI_env', env.native ? 'تطبيق مثبّت' : 'متصفح');
                setHTML('gpsI_net', navigator.onLine === false ? badge('غير متصل', 'warn') : badge('متصل', 'ok'));
                setHTML('gpsI_sec', env.secure ? badge('نعم', 'ok') : badge('لا', 'bad'));
            }
            function bindInfo() { updInfo(); }
            function diagText() {
                const P = S.perm || {}, env = GEO.env(), hh = curHeading();
                const L = [];
                L.push('تقرير تشخيص GPS — ' + new Date().toLocaleString('ar'));
                L.push('البيئة: ' + (env.native ? 'تطبيق مثبّت' : 'متصفح') + ' | مكوّن Geolocation: ' + (env.hasPlugin ? 'موجود' : 'غير موجود') + ' | HTTPS: ' + (env.secure ? 'نعم' : 'لا'));
                L.push('إذن الموقع: ' + permLbl(P.state) + ' | الدقة المسموحة: ' + (P.precise === true ? 'دقيق' : (P.precise === false ? 'تقريبي' : 'غير معروف')) + ' | آخر خطأ: ' + (S.errKind || 'لا يوجد'));
                L.push('حساس البوصلة: ' + S.ori + (S.cAcc != null ? ' | دقة الحساس: ' + Math.round(S.cAcc) + '°' : '') + ' | مصدر الاتجاه: ' + (hh ? hh.src : '—') + ' | تصحيح الشمال: ' + S.off.toFixed(1) + '° (' + S.offN + ' عينة)');
                L.push(S.pos ? ('الدقة الحالية: ±' + Math.round(S.pos.coords.accuracy) + ' م | أفضل دقة: ±' + Math.round(S.best) + ' م | عمر القراءة: ' + Math.round((Date.now() - S.fix) / 1000) + ' ث | المصدر: ' + S.mode) : 'لا يوجد موقع بعد');
                L.push('القراءات: ' + S.nAcc + ' مقبولة، ' + S.nRej + ' مرفوضة، ' + S.nJump + ' قفزة | مهلات: ' + S.timeouts + ' | إعادة تشغيل: ' + S.restarts + ' | الفلتر: ' + (opt('filter') ? 'يعمل' : 'متوقف'));
                L.push('الجهاز: ' + String(navigator.userAgent || '').slice(0, 160));
                return L.join('\n');
            }
            async function act(a) {
                if (a === 'allow')
                    return retryLoc();
                if (a === 'settings') {
                    const ok = await GEO.openSettings('app');
                    if (!ok)
                        toast('افتح إعدادات الهاتف ← التطبيقات ← هذا التطبيق ← الأذونات ← الموقع');
                    return;
                }
                if (a === 'gpsset') {
                    const ok = await GEO.openSettings('location');
                    if (!ok)
                        toast('شغّل «الموقع» من لوحة الإعدادات السريعة في الهاتف');
                    return;
                }
                if (a === 'ori')
                    return reqOri();
                if (a === 'recheck')
                    return recheck(true, true);
                if (a === 'fmt') {
                    setOpt('dms', !opt('dms'));
                    updHome();
                    return;
                }
                if (a === 'resetoff') {
                    S.off = 0;
                    S.offN = 0;
                    S.offLoaded = true;
                    const D = db();
                    if (D.opts)
                        delete D.opts.off;
                    persist();
                    toast('تمت إعادة ضبط معايرة البوصلة');
                    updInfo();
                    return;
                }
                if (a === 'diag') {
                    F.copy(diagText());
                    return;
                }
            }
            function toggleOpt(t) {
                const k = t.getAttribute('data-opt'), v = !opt(k);
                setOpt(k, v);
                t.setAttribute('aria-checked', v ? 'true' : 'false');
                if (k === 'filter')
                    S.flt.reset();
                if (k === 'keepAwake') {
                    if (v)
                        lockScreen();
                    else
                        unlockScreen();
                }
                if (k === 'dms')
                    updHome();
                updInfo();
            }
            frame.addEventListener('click', function (e) {
                const t = e.target.closest('[data-act],[data-opt]');
                if (!t)
                    return;
                if (t.hasAttribute('data-opt'))
                    toggleOpt(t);
                else
                    act(t.getAttribute('data-act'));
            });
            /* ---------- تبويب: التوجيه ---------- */
            function ringSVG() {
                let t = '';
                for (let i = 0; i < 72; i++) {
                    const a = i * 5, big = i % 18 === 0, mid = i % 6 === 0;
                    if (i === 0)
                        continue;
                    t += '<line x1="100" y1="10" x2="100" y2="' + (big ? 24 : (mid ? 20 : 15)) + '" transform="rotate(' + a + ' 100 100)" stroke="' + (big || mid ? '#f2b705' : 'rgba(255,224,102,.45)') + '" stroke-width="' + (big ? 3 : (mid ? 2.2 : 1.2)) + '" stroke-linecap="round"/>';
                }
                t += '<polygon points="100,9 94,23 106,23" fill="#ff5a4d"/>'
                    + '<text x="100" y="42" text-anchor="middle" font-size="15" font-weight="900" fill="#ff7b6e">ش</text>'
                    + '<text x="162" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#e8dca8">ق</text>'
                    + '<text x="100" y="168" text-anchor="middle" font-size="13" font-weight="800" fill="#e8dca8">ج</text>'
                    + '<text x="38" y="105" text-anchor="middle" font-size="13" font-weight="800" fill="#e8dca8">غ</text>';
                return t;
            }
            function dialHTML() {
                const d = selDest();
                return '<div class="gps-panel">'
                    + '<div class="gps-dst"><span>' + (d ? esc(d.name) : 'بدون وجهة') + '</span></div>'
                    + '<div class="gps-dial"><svg viewBox="1 1 198 198" aria-label="سهم الاتجاه نحو الوجهة">'
                    + '<defs>'
                    + '<radialGradient id="gpsFace" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#2b2409"/><stop offset="1" stop-color="#0a0803"/></radialGradient>'
                    + '<linearGradient id="gpsRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#b98700"/><stop offset="1" stop-color="#ffd23a"/></linearGradient>'
                    + '<linearGradient id="gpsL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#ffd23a"/></linearGradient>'
                    + '<linearGradient id="gpsR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7bf14"/><stop offset="1" stop-color="#b98100"/></linearGradient>'
                    + '<filter id="gpsSh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000" flood-opacity=".6"/></filter>'
                    + '</defs>'
                    + '<circle cx="100" cy="100" r="96" fill="url(#gpsFace)" stroke="url(#gpsRim)" stroke-width="4"/>'
                    + '<circle cx="100" cy="100" r="70" fill="none" stroke="rgba(242,183,5,.28)" stroke-width="1"/>'
                    + '<circle cx="100" cy="100" r="46" fill="none" stroke="rgba(242,183,5,.16)" stroke-width="1" stroke-dasharray="2 4"/>'
                    + '<g id="gpsRing">' + ringSVG() + '</g>'
                    + '<g id="gpsArrow" filter="url(#gpsSh)">'
                    + '<polygon points="100,28 58,154 100,128" fill="url(#gpsL)"/>'
                    + '<polygon points="100,28 142,154 100,128" fill="url(#gpsR)"/>'
                    + '<polygon points="100,28 58,154 100,128 142,154" fill="none" stroke="#6b4a00" stroke-width="2" stroke-linejoin="round"/>'
                    + '<line x1="100" y1="30" x2="100" y2="126" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/></g>'
                    + '<circle cx="100" cy="100" r="7" fill="#1f1500" stroke="#ffe066" stroke-width="2.5"/></svg></div>'
                    + '<p class="gps-far" id="gpsFar">—</p><p class="gps-sub" id="gpsSub"></p></div>'
                    + '<button type="button" class="gps-big" id="gpsHomeSave" style="margin:0 0 12px"' + (S.hOpen ? ' hidden' : '') + ' disabled>📍 حفظ الموقع الحالي</button>'
                    + '<div id="gpsHomeBox" class="gps-ed"' + (S.hOpen ? '' : ' hidden') + '>'
                    + '<p style="margin:0 0 10px;font-weight:900;font-size:calc(15px * var(--font-scale))">اسم الموقع الحالي</p>'
                    + '<input class="gps-in" id="gpsHomeName" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="اكتب اسمًا (مثال: البيت، الفندق)" value="' + esc(S.hName || '') + '">'
                    + '<div class="gps-row"><button type="button" class="btn btn-ghost" id="gpsHomeCancel">إلغاء</button><button type="button" class="btn btn-primary" id="gpsHomeOk" disabled>حفظ</button></div></div>'
                    + '<div id="gpsEdSlot"></div>'
                    + statHTML()
                    + (d
                        ? '<div class="gps-row" style="margin:0 0 12px"><button type="button" class="btn btn-ghost" id="gpsChange">تغيير الوجهة</button><button type="button" class="btn btn-ghost" id="gpsStop">إيقاف التوجيه</button></div>'
                        : '<div class="gps-row" style="margin:0 0 12px"><button type="button" class="btn btn-ghost" id="gpsPickGo">اختيار وجهة</button></div>');
            }
            function bindNav() {
                const pk = $('gpsPickGo');
                if (pk)
                    pk.addEventListener('click', function () { go('dest'); });
                const d = selDest();
                if (!d)
                    return;
                $('gpsChange').addEventListener('click', function () { go('dest'); });
                $('gpsStop').addEventListener('click', function () { db().sel = null; persist(); S.arrived = false; paintBody(); });
            }
            function etaTxt(m) {
                const sp = S.spd;
                if (sp != null && sp >= 0.8)
                    return 'الوقت المتوقع ≈ ' + fmtT(m / Math.min(sp, 45) / 60) + ' (حسب سرعتك الحالية)';
                if (m < 3000)
                    return 'مشيًا ≈ ' + fmtT(m / 1000 / 5 * 60);
                return 'بالسيارة ≈ ' + fmtT(m / 1000 / 50 * 60);
            }
            function updNav() {
                const d = selDest();
                const far = $('gpsFar'), sub = $('gpsSub'), ar = $('gpsArrow');
                if (!far || !sub || !ar)
                    return;
                const hh = curHeading(), h = hh ? hh.h : 0;
                const calHint = (hh && hh.src === 's' && S.cAcc != null && (S.cAcc < 0 || S.cAcc > 25)) ? '<br><span style="color:#ffcf6b">البوصلة تحتاج معايرة — حرّك الهاتف على شكل رقم 8.</span>' : '';
                setAng('gpsRing', -h);
                if (!d) {
                    S.navDest = null;
                    ar.style.opacity = '1';
                    setAng('gpsArrow', -h);
                    const t1 = hh ? ((Math.round(h) % 360) + '° ' + dirLbl(h)) : '—';
                    if (far.textContent !== t1)
                        far.textContent = t1;
                    const h0 = 'لم تختر وجهة — السهم يشير إلى الشمال.<br>اختر وجهة من «الوجهات» ليشير إليها السهم.'
                        + (!hh && Date.now() - S.started > 3000 ? '<br><span style="color:#ff8a7a">اتجاه الهاتف غير متاح الآن — أدر الهاتف أو امشِ قليلًا.</span>' : '') + calHint;
                    if (sub.__h !== h0) {
                        sub.__h = h0;
                        sub.innerHTML = h0;
                    }
                    return;
                }
                if (!S.pos) {
                    far.textContent = '—';
                    ar.style.opacity = '.25';
                    sub.__h = 'بانتظار إشارة GPS…';
                    sub.textContent = 'بانتظار إشارة GPS…';
                    return;
                }
                ar.style.opacity = '1';
                const m0 = dist(lat(), lng(), d.lat, d.lng), b0 = bear(lat(), lng(), d.lat, d.lng);
                const still = (S.spd == null || S.spd < 0.6), accNow = S.pos.coords.accuracy || 15;
                if (S.navDest !== d.id) {
                    S.navDest = d.id;
                    S.mShow = null;
                    S.bShow = null;
                }
                /* المسافة: لا تتغيّر إلا بفرق ≥ 1.5 م أثناء الوقوف */
                if (S.mShow == null || !still || Math.abs(m0 - S.mShow) >= 1.5)
                    S.mShow = m0;
                /* الاتجاه: يُثبَّت عند الوقوف قرب الوجهة (الإشارة هناك مجرد ضجيج) ويُنعَّم أثناء الحركة */
                if (S.bShow == null)
                    S.bShow = b0;
                else if (!still || m0 > Math.max(12, accNow * 1.5))
                    S.bShow = smooth(S.bShow, b0, 0.35);
                const m = S.mShow, b = S.bShow;
                setAng('gpsArrow', b - h);
                far.textContent = fmtD(m);
                const near = Math.max(15, Math.min(S.pos.coords.accuracy || 15, 40));
                const lines = [];
                if (m <= near) {
                    lines.push('<b style="color:#2fb36b">وصلت إلى وجهتك</b>');
                    if (!S.arrived) {
                        S.arrived = true;
                        try {
                            if (opt('vibrate') && navigator.vibrate)
                                navigator.vibrate([200, 100, 200]);
                        }
                        catch (e) { }
                        toast('وصلت إلى وجهتك');
                    }
                }
                else {
                    if (m > near * 3)
                        S.arrived = false;
                    lines.push('الوجهة باتجاه ' + (Math.round(b) % 360) + '° ' + dirLbl(b));
                    lines.push(etaTxt(m));
                    if (S.pos.coords.accuracy > m * 0.5 && m < 300)
                        lines.push('<span style="color:#ffcf6b">دقة الإشارة (±' + Math.round(S.pos.coords.accuracy) + ' م) قريبة من المسافة — الاتجاه تقريبي حتى تتحسّن.</span>');
                }
                if (!hh && Date.now() - S.started > 3000)
                    lines.push('<span style="color:#ff8a7a">اتجاه الهاتف غير متاح الآن — السهم محسوب بالنسبة للشمال. أدر الهاتف أو امشِ قليلًا.</span>');
                const h1 = lines.join('<br>') + calHint;
                if (sub.__h !== h1) {
                    sub.__h = h1;
                    sub.innerHTML = h1;
                }
            }
            /* ---------- التبديل بين التبويبات ---------- */
            function paintBody() {
                const body = $('gpsBody');
                if (!body)
                    return;
                qa(root, '.gps-tab').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === S.tab); });
                if (S.tab === 'home') {
                    body.innerHTML = homeHTML();
                    S.angs = {};
                    bindHome();
                    updHome();
                    paintPerm();
                }
                else if (S.tab === 'dest') {
                    body.innerHTML = destHTML();
                    bindDest();
                    paintPerm();
                }
                else {
                    body.innerHTML = infoHTML();
                    bindInfo();
                }
                renderEditor();
                updStat();
            }
            function go(tab) { S.tab = tab; paintBody(); }
            function tick() {
                if (!alive()) {
                    stopAll();
                    return;
                }
                updStat();
                if (S.tab === 'home') {
                    updHome();
                    paintPerm();
                }
                else if (S.tab === 'dest') {
                    updDist();
                    paintPerm();
                }
                else
                    updInfo();
            }
            qa(root, '.gps-tab').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-t')); }); });
            /* ---------- التشغيل ---------- */
            window.addEventListener('deviceorientationabsolute', onOri, true);
            window.addEventListener('deviceorientation', onOri, true);
            document.addEventListener('visibilitychange', onVis);
            S.timer = setInterval(function () {
                if (!alive()) {
                    stopAll();
                    return;
                }
                const now = Date.now();
                updStat();
                if (S.tab === 'info')
                    updInfo();
                else if (S.tab === 'home') {
                    paintPerm();
                    if (S.pos) {
                        updNav();
                        markStale();
                    }
                }
                /* إعادة محاولة تلقائية: بعد تفعيل الإذن أو الموقع من إعدادات الهاتف يبدأ التتبّع دون ضغط الزر */
                {
                    const st0 = S.perm && S.perm.state;
                    if (!S.pos && (st0 === 'denied' || st0 === 'disabled' || st0 === 'prompt' || st0 === 'unknown' || S.errKind === 'denied' || S.errKind === 'disabled')
                        && document.visibilityState === 'visible' && now - (S.lastAuto || 0) > 2500) {
                        S.lastAuto = now;
                        recheck(false, false).then(function () {
                            if (S.dead || S.pos || document.visibilityState !== 'visible')
                                return;
                            const st1 = S.perm && S.perm.state;
                            if (st1 === 'granted')
                                return;
                            S.autoReq = (S.autoReq || 0) + 1;
                            if (S.autoReq > 40)
                                return;
                            /* إعادة المحاولة تلقائيًا بدل ضغط الزر: طلب الإذن إن لم يُطلب، وإلا إعادة تشغيل التتبّع */
                            if ((st1 === 'prompt' || st1 === 'unknown') && !S.reqBusy && S.autoReq <= 6) {
                                S.reqBusy = true;
                                retryLoc(true).then(function () { S.reqBusy = false; }, function () { S.reqBusy = false; });
                            }
                            else if (!S.reqBusy)
                                startWatch();
                        });
                    }
                }
                /* حارس: لو توقّفت القراءات رغم الإذن نعيد تشغيل التتبّع */
                if (S.w && S.perm && S.perm.state === 'granted' && now - Math.max(S.fix, S.lastRestart) > 35000) {
                    S.restarts++;
                    startWatch();
                }
                /* حارس: لا قراءات من حساس الاتجاه */
                if (!S.oriAt && S.ori === 'wait' && now - S.started > 3500) {
                    S.ori = window.DeviceOrientationEvent ? 'nodata' : 'unsupported';
                }
            }, 1000);
            S.ori = (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function') ? 'asking' : 'wait';
            paintBody();
            if (S.ori === 'asking')
                reqOri();
            init();
            lockScreen();
        }
    });
})();
