/* ================= التخزين المحلي للرحلات (IndexedDB) =================
   كل البيانات تبقى على الهاتف — لا يُرسل أي موقع لأي خادم.
   IndexedDB أنسب من localStorage للمسارات الطويلة (آلاف النقاط). إن لم يتوفر نرجع إلى localStorage.
   ===================================================================== */
(function () {
    'use strict';
    var NAME = 'gbs', VER = 1, ST = 'trips', dbp = null;
    var LSK = 'gbs.trips.fallback';

    function open() {
        if (dbp) return dbp;
        dbp = new Promise(function (res, rej) {
            if (!window.indexedDB) return rej(new Error('no-idb'));
            var r;
            try { r = indexedDB.open(NAME, VER); } catch (e) { return rej(e); }
            r.onupgradeneeded = function () {
                var d = r.result;
                if (!d.objectStoreNames.contains(ST)) d.createObjectStore(ST, { keyPath: 'id' });
            };
            r.onsuccess = function () { res(r.result); };
            r.onerror = function () { rej(r.error); };
            r.onblocked = function () { rej(new Error('blocked')); };
        }).catch(function (e) { dbp = null; throw e; });
        return dbp;
    }
    function tx(mode, fn) {
        return open().then(function (d) {
            return new Promise(function (res, rej) {
                var t = d.transaction(ST, mode), s = t.objectStore(ST), out;
                out = fn(s);
                t.oncomplete = function () { res(out && 'result' in out ? out.result : out); };
                t.onerror = function () { rej(t.error); };
                t.onabort = function () { rej(t.error || new Error('abort')); };
            });
        });
    }
    /* ---------- البديل: localStorage ---------- */
    function lsAll() { try { var o = JSON.parse(localStorage.getItem(LSK) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
    function lsSave(o) { localStorage.setItem(LSK, JSON.stringify(o)); }

    function valid(t) { return t && typeof t === 'object' && typeof t.id === 'string' && Array.isArray(t.pts); }

    var Store = window.GBS_STORE = {
        mode: 'idb',
        put: function (trip) {
            if (!valid(trip)) return Promise.reject(new Error('bad trip'));
            var copy = JSON.parse(JSON.stringify(trip));
            return tx('readwrite', function (s) { return s.put(copy); }).catch(function () {
                Store.mode = 'ls';
                var o = lsAll(); o[copy.id] = copy; lsSave(o);
            });
        },
        get: function (id) {
            return tx('readonly', function (s) { return s.get(id); }).catch(function () { Store.mode = 'ls'; return lsAll()[id] || null; });
        },
        all: function () {
            return tx('readonly', function (s) { return s.getAll(); }).then(function (a) {
                /* دمج ما قد يكون حُفظ في البديل سابقًا */
                var o = lsAll(); Object.keys(o).forEach(function (k) { if (!a.some(function (t) { return t.id === k; })) a.push(o[k]); });
                return a.filter(valid);
            }).catch(function () { Store.mode = 'ls'; var o = lsAll(); return Object.keys(o).map(function (k) { return o[k]; }).filter(valid); });
        },
        del: function (id) {
            var o = lsAll(); if (o[id]) { delete o[id]; try { lsSave(o); } catch (e) { } }
            return tx('readwrite', function (s) { return s.delete(id); }).catch(function () { });
        },
        /* طلب «تخزين دائم» حتى لا يحذف النظام البيانات عند امتلاء المساحة */
        persist: function () {
            try { if (navigator.storage && navigator.storage.persist) return navigator.storage.persist(); } catch (e) { }
            return Promise.resolve(false);
        },
        estimate: function () {
            try { if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate(); } catch (e) { }
            return Promise.resolve(null);
        }
    };
})();
