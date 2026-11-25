/* ================= GBS المنتصر — تحسينات العرض فقط =================
   • حركة سلسة للمؤشر والقرص: نقرأ الزاوية التي تكتبها الأداة كما هي ونحرّكها بانتقال ناعم
     (نفس الزاوية تمامًا — فقط بدل القفز المباشر). لا نغيّر أي حساب.
   • أرقام الدرجات على القرص + علامة ثابتة أعلى البوصلة تشير لاتجاه الهاتف.
   • الملاحظات الطويلة تُختصر لسطرين وتُفتح باللمس.
   يُحمَّل قبل app.js حتى يلتقط أول رسم للأداة.
   ======================================================================= */
(function () {
    'use strict';
    var body = document.getElementById('funToolBody');
    if (!body) return;
    var NS = 'http://www.w3.org/2000/svg';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- الحركة السلسة ---------- */
    function readAngle(el) {
        var m = /rotate\(\s*(-?[\d.]+)/.exec(el.getAttribute('transform') || '');
        return m ? parseFloat(m[1]) : null;
    }
    function follow(el) {
        if (el.__lx) return;
        el.__lx = true;
        var unwrapped = null;
        function apply() {
            var a = readAngle(el);
            if (a == null || !isFinite(a)) return;
            if (unwrapped == null) {
                unwrapped = a;
                el.style.transform = 'rotate(' + a + 'deg)';
                /* تفعيل الانتقال بعد أول وضع حتى لا يدور عند الفتح */
                requestAnimationFrame(function () { if (!reduce) el.classList.add('lx-sm'); });
                return;
            }
            /* أقصر طريق: من 359° إلى 1° يتحرك درجتين لا 358 */
            var cur = ((unwrapped % 360) + 360) % 360;
            var d = ((a - cur + 540) % 360) - 180;
            unwrapped += d;
            el.style.transform = 'rotate(' + unwrapped.toFixed(2) + 'deg)';
        }
        new MutationObserver(apply).observe(el, { attributes: true, attributeFilter: ['transform'] });
        apply();
    }

    /* ---------- أرقام الدرجات والعلامة الثابتة ---------- */
    function decorateDial(svg) {
        if (svg.__lxDial) return;
        svg.__lxDial = true;
        var ring = svg.querySelector('#gpsRing');
        if (ring) {
            var g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'lx-degs');
            for (var a = 30; a < 360; a += 30) {
                if (a % 90 === 0) continue; /* مكان حروف الجهات */
                var t = document.createElementNS(NS, 'text');
                t.setAttribute('x', '100');
                t.setAttribute('y', '33.5');
                t.setAttribute('text-anchor', 'middle');
                t.setAttribute('class', 'lx-deg');
                t.setAttribute('transform', 'rotate(' + a + ' 100 100)');
                t.textContent = String(a);
                g.appendChild(t);
            }
            ring.appendChild(g);
        }
        /* علامة ذهبية ثابتة أعلى القرص (لا تدور): تقرأ عندها اتجاه الهاتف */
        var arrow = svg.querySelector('#gpsArrow');
        var mk = document.createElementNS(NS, 'path');
        mk.setAttribute('d', 'M100 1.5 L95 -5 L105 -5 Z');
        mk.setAttribute('fill', '#ffe27a');
        mk.setAttribute('stroke', '#a87400');
        mk.setAttribute('stroke-width', '.8');
        mk.setAttribute('transform', 'translate(0 5.5)');
        if (arrow) svg.insertBefore(mk, arrow); else svg.appendChild(mk);
    }

    function enhance() {
        var svg = body.querySelector('.gps-dial svg');
        if (svg) {
            decorateDial(svg);
            var ar = svg.querySelector('#gpsArrow'), rg = svg.querySelector('#gpsRing');
            if (ar) follow(ar);
            if (rg) follow(rg);
        }
        var notes = body.querySelectorAll('.gps-note');
        for (var i = 0; i < notes.length; i++) {
            var n = notes[i];
            if (n.__lx) continue;
            n.__lx = true;
            n.setAttribute('role', 'button');
            n.setAttribute('tabindex', '0');
            n.addEventListener('click', function () { this.classList.toggle('lx-open'); });
        }
    }

    var queued = false;
    new MutationObserver(function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; enhance(); });
    }).observe(body, { childList: true, subtree: true });
    enhance();
})();
