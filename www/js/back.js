/* ================= زر/إيماءة الرجوع في أندرويد =================
   مثل باقي التطبيقات، بإيماءة النظام العادية (لا إيماءات خاصة):
   - نافذة مفتوحة (تأكيد / نافذة سفلية / وضع الصحراء) ← تُغلق.
   - أي تبويب غير «الرئيسية» ← يرجع إلى الرئيسية.
   - في الرئيسية ← يخرج من التطبيق (يذهب للخلفية كما يفعل أندرويد مع بقية التطبيقات).
   ============================================================= */
(function () {
    'use strict';
    var C = window.Capacitor;
    var native = !!(C && C.isNativePlatform && C.isNativePlatform());
    var App = native && C.Plugins && C.Plugins.App;
    function $(id) { return document.getElementById(id); }
    function api() { return window.GBS_API; }
    function overlay() {
        if ($('confirmBackdrop') && $('confirmBackdrop').classList.contains('active')) return 'confirm';
        if ($('sheetBackdrop') && $('sheetBackdrop').classList.contains('active')) return 'sheet';
        if ($('lxDesert')) return 'desert';
        return null;
    }
    function tab() { var a = api(); return a && a.tab ? a.tab() : 'home'; }
    /* ينفّذ خطوة رجوع واحدة؛ يعيد false إن لم يبق شيء (أي: اخرج من التطبيق) */
    function step() {
        var o = overlay();
        if (o === 'confirm') { try { window.closeConfirm(false); } catch (e) { $('confirmBackdrop').classList.remove('active'); } return true; }
        if (o === 'sheet') { $('sheetBackdrop').classList.remove('active'); return true; }
        if (o === 'desert') { if (window.GBS_EXT) window.GBS_EXT.closeDesert(); return true; }
        if (tab() !== 'home' && api()) { api().go('home'); window.scrollTo(0, 0); return true; }
        return false;
    }
    window.GBS_BACK = step;

    if (App && App.addListener) {
        /* داخل تطبيق أندرويد: نستقبل زر/إيماءة الرجوع من النظام */
        App.addListener('backButton', function () {
            if (step()) return;
            var m = App.minimizeApp ? Promise.resolve().then(function () { return App.minimizeApp(); }) : Promise.reject();
            m.catch(function () { if (App.exitApp) App.exitApp(); });
        });
        return;
    }
    if (native) return; /* بدون إضافة App: يبقى سلوك أندرويد الافتراضي */

    /* في المتصفح / التطبيق المثبّت من المتصفح: نستعمل سجل التصفح بنفس المنطق.
       ندخل خطوة واحدة في السجل متى كنا خارج الرئيسية أو كانت نافذة مفتوحة */
    var pushed = false, ignore = 0;
    function need() { return tab() !== 'home' || !!overlay(); }
    function sync() {
        if (need() && !pushed) { history.pushState({ gbs: 'sub' }, ''); pushed = true; }
        else if (!need() && pushed) { pushed = false; ignore++; history.back(); }
    }
    try { history.replaceState({ gbs: 'home' }, ''); } catch (e) { }
    window.addEventListener('popstate', function () {
        if (ignore) { ignore--; return; }
        pushed = false;
        step();
        setTimeout(sync, 0);
    });
    window.addEventListener('gbs:tab', function () { setTimeout(sync, 0); });
    var mo = new MutationObserver(function () { setTimeout(sync, 0); });
    function watch() {
        ['confirmBackdrop', 'sheetBackdrop'].forEach(function (id) { var e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['class'] }); });
        mo.observe(document.body, { childList: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})();
