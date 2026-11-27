/* ================= تشغيل التطبيق ================= */
(function () {
    'use strict';
    var F = window.FUN;
    var $ = function (id) { return document.getElementById(id); };

    /* فتح الأداة مباشرة — مع إبلاغ حارس التشغيل بالنجاح أو الفشل (لا شاشة فارغة أبدًا) */
    try {
        F.open('gps');
    } catch (e) {
        console.error(e);
    }
    if ($('gpsBody')) {
        if (window.__bootDone) window.__bootDone();
    } else if (window.__bootFail) {
        window.__bootFail('لم تُرسم الأداة');
    }
    /* عند العودة من الخلفية: لو فقد WebView المحتوى لأي سبب نعيد رسم الأداة (البيانات محفوظة في التخزين) */
    function ensureAlive() {
        if (document.visibilityState !== 'visible') return;
        if (!$('gpsBody')) {
            try { F.open('gps'); } catch (e) { console.error(e); }
        }
    }
    document.addEventListener('visibilitychange', ensureAlive);
    window.addEventListener('pageshow', ensureAlive);

    /* [دون إنترنت] طلب تخزين دائم من البداية حتى لا يحذف النظام الوجهات والرحلات وبلاطات الخريطة عند امتلاء المساحة */
    try { if (window.GBS_STORE) GBS_STORE.persist(); } catch (e) { }

    /* ---------- دليل الاستخدام (زر «؟») ---------- */
    function showGuide() {
        var d = F.tools.gps, g = d && d.guide;
        if (!g) return;
        $('sheetTitle').textContent = 'طريقة الاستخدام';
        $('sheetBody').innerHTML = '<p>' + F.esc(g.about) + '</p><ol>'
            + g.steps.map(function (s) { return '<li>' + F.esc(s) + '</li>'; }).join('')
            + '</ol><p class="hint">💡 ' + F.esc(g.tip) + '</p>';
        openSheet();
    }

    /* ---------- النسخ الاحتياطي: تصدير / استيراد الوجهات ---------- */
    function showBackup() {
        $('sheetTitle').textContent = 'النسخ الاحتياطي';
        var n = (settings.gpsNav && settings.gpsNav.dests || []).length;
        var nt = window.GBS_TRIPS ? GBS_TRIPS.list().length + (GBS_TRIPS.current() ? 1 : 0) : 0;
        $('sheetBody').innerHTML = '<p>المحفوظ الآن: <b>' + n + '</b> موقع/وجهة و<b>' + nt + '</b> رحلة.</p>'
            + '<div class="row"><button type="button" class="btn btn-primary" id="bkExport">⬇️ تصدير ملف</button>'
            + '<button type="button" class="btn btn-ghost" id="bkImport">⬆️ استيراد ملف</button></div>'
            + '<p class="hint">الاستيراد يستبدل الوجهات الحالية بما في الملف، ويضيف الرحلات غير الموجودة دون حذف رحلاتك.</p>';
        $('bkExport').onclick = exportData;
        $('bkImport').onclick = function () { $('bkFile').click(); };
        openSheet();
    }
    function exportData() {
        /* v2: الوجهات + الرحلات. ملفات v1 القديمة تبقى قابلة للاستيراد */
        var jobs = window.GBS_TRIPS ? GBS_TRIPS.exportAll().catch(function () { return []; }) : Promise.resolve([]);
        jobs.then(function (trips) {
            var json = JSON.stringify({ app: 'gbs', v: 2, at: new Date().toISOString(), gpsNav: settings.gpsNav || { dests: [], sel: null }, trips: trips });
            var name = 'gbs-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            if (window.GBS_SAVEFILE) { GBS_SAVEFILE(name, json, 'application/json'); return; }
            exportLegacy(json, name);
        });
    }
    function exportLegacy(json, name) {
        var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
        if (Share) { F.share(json); return; } /* داخل تطبيق أندرويد: مشاركة النص (حفظه في ملاحظة أو إرساله) */
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast('تم التصدير');
    }
    $('bkFile').addEventListener('change', function () {
        var f = this.files && this.files[0];
        this.value = '';
        if (!f) return;
        f.text().then(function (txt) {
            var o = JSON.parse(txt);
            var nav = o && (o.gpsNav || (o.settings && o.settings.gpsNav));
            if (!nav || !Array.isArray(nav.dests)) throw new Error('bad');
            var trips = Array.isArray(o.trips) ? o.trips : [];
            showConfirm('استيراد', 'سيُستبدل ' + nav.dests.length + ' موقع/وجهة بالمحفوظ حاليًا' + (trips.length ? ' وتُضاف الرحلات الجديدة من ' + trips.length + ' رحلة' : '') + '. متابعة؟', function () {
                settings.gpsNav = nav;
                saveSettingsData();
                closeSheet();
                var tj = (trips.length && window.GBS_TRIPS) ? GBS_TRIPS.importAll(trips) : Promise.resolve(0);
                tj.then(function (k) { F.open('gps'); toast('تم الاستيراد' + (k ? ' (+' + k + ' رحلة)' : '')); });
            });
        }).catch(function () { toast('الملف غير صالح'); });
    });

    function openSheet() { $('sheetBackdrop').classList.add('active'); }
    function closeSheet() { $('sheetBackdrop').classList.remove('active'); }
    $('btnHelp').addEventListener('click', showGuide);
    $('btnBackup').addEventListener('click', showBackup);
    $('sheetClose').addEventListener('click', closeSheet);
    $('sheetBackdrop').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });

    /* دليل أول تشغيل */
    if (!settings.guideSeen) {
        settings.guideSeen = 1;
        saveSettingsData();
        setTimeout(showGuide, 600);
    }

    /* ---------- عامل الخدمة: يعمل بدون إنترنت كتطبيق ويب مثبّت (لا حاجة له داخل تطبيق أندرويد) ---------- */
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (!native && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw.js').catch(function (e) { console.warn('sw', e); });
        });
    }

    /* ---------- زر «تثبيت التطبيق» للمتصفحات التي تدعمه ---------- */
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        $('btnInstall').hidden = false;
    });
    $('btnInstall').addEventListener('click', function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.finally(function () { deferred = null; $('btnInstall').hidden = true; });
    });
    window.addEventListener('appinstalled', function () { $('btnInstall').hidden = true; toast('تم تثبيت التطبيق'); });
})();
