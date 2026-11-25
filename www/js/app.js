/* ================= تشغيل التطبيق ================= */
(function () {
    'use strict';
    var F = window.FUN;
    var $ = function (id) { return document.getElementById(id); };

    /* فتح الأداة مباشرة */
    F.open('gps');

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
        $('sheetBody').innerHTML = '<p>المحفوظ الآن: <b>' + n + '</b> موقع/وجهة.</p>'
            + '<div class="row"><button type="button" class="btn btn-primary" id="bkExport">⬇️ تصدير ملف</button>'
            + '<button type="button" class="btn btn-ghost" id="bkImport">⬆️ استيراد ملف</button></div>'
            + '<p class="hint">الاستيراد يستبدل الوجهات الحالية بما في الملف.</p>';
        $('bkExport').onclick = exportData;
        $('bkImport').onclick = function () { $('bkFile').click(); };
        openSheet();
    }
    function exportData() {
        var json = JSON.stringify({ app: 'gbs', v: 1, at: new Date().toISOString(), gpsNav: settings.gpsNav || { dests: [], sel: null } }, null, 2);
        var name = 'gbs-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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
            showConfirm('استيراد', 'سيُستبدل ' + nav.dests.length + ' موقع/وجهة بالمحفوظ حاليًا. متابعة؟', function () {
                settings.gpsNav = nav;
                saveSettingsData();
                closeSheet();
                F.open('gps');
                toast('تم الاستيراد');
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
