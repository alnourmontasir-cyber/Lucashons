/* ================= غلاف مستقل =================
   الأداة كانت تعمل داخل التطبيق الأم وتعتمد على: settings / saveSettingsData / toast / showConfirm / window.FUN
   هذا الملف يوفّرها بأبسط شكل حتى تعمل الأداة وحدها كتطبيق. يُحمَّل قبل geo.js و gps-tool.js
   ================================================= */
(function () {
    'use strict';
    var KEY = 'gbs.settings.v1';

    /* ---------- الإعدادات (تُحفظ في localStorage — تبقى داخل التطبيق المثبّت) ---------- */
    var data = {};
    try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { data = {}; }
    window.settings = data;
    window.saveSettingsData = function () {
        try { localStorage.setItem(KEY, JSON.stringify(window.settings)); } catch (e) { }
    };

    /* ---------- إشعار قصير ---------- */
    window.toast = function (msg) {
        var t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(t._timer);
        t._timer = setTimeout(function () { t.classList.remove('show'); }, 2400);
    };

    /* ---------- نافذة تأكيد ---------- */
    var confirmCb = null;
    window.showConfirm = function (title, msg, onConfirm) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMsg').textContent = msg;
        confirmCb = onConfirm;
        document.getElementById('confirmBackdrop').classList.add('active');
    };
    window.closeConfirm = function (run) {
        var cb = confirmCb;
        confirmCb = null;
        document.getElementById('confirmBackdrop').classList.remove('active');
        if (run && cb) cb();
    };

    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------- نواة FUN مصغّرة: تسجيل الأداة وفتحها في الإطار الوحيد ---------- */
    var reg = {};
    var FUN = window.FUN = {
        tools: reg,
        register: function (def) {
            if (!def || !def.id || typeof def.render !== 'function' || reg[def.id]) return;
            reg[def.id] = def;
        },
        esc: function (s) { return escapeHTML(s == null ? '' : s); },
        copy: async function (text) {
            try {
                await navigator.clipboard.writeText(text);
            } catch (e) {
                try {
                    var ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    var ok = document.execCommand('copy');
                    ta.remove();
                    if (!ok) throw new Error('copy failed');
                } catch (e2) {
                    toast('تعذّر النسخ في هذا المتصفح');
                    return;
                }
            }
            toast('تم النسخ');
        },
        share: async function (text) {
            var Share = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
            try {
                if (Share) { await Share.share({ title: 'GBS المنتصر', text: text }); return; }
                if (navigator.share) { await navigator.share({ title: 'GBS المنتصر', text: text }); return; }
                await FUN.copy(text);
            } catch (e) {
                if (e && e.name === 'AbortError') return;
                toast('تعذّرت المشاركة');
            }
        },
        open: function (id) {
            var d = reg[id];
            if (!d) return;
            document.getElementById('funToolTitle').textContent = d.name;
            var root = document.getElementById('funToolBody');
            root.innerHTML = '';
            try {
                d.render(root);
            } catch (e) {
                console.error(e);
                root.innerHTML = '<p class="hint" style="text-align:center">تعذّر فتح الأداة</p>';
            }
            document.getElementById('funToolBackdrop').classList.add('active');
        },
        close: function () { document.getElementById('funToolBackdrop').classList.remove('active'); }
    };
})();
