/* يُنزّل خطوط التطبيق (Tajawal / Cinzel / Amiri — رخصة OFL) إلى www/fonts وقت البناء على GitHub
   حتى يعمل التطبيق دون أي اتصال بالإنترنت. إن فشل التنزيل يبقى التطبيق يعمل بخط الهاتف. */
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, '..', 'www', 'fonts');
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cinzel:wght@700;900&family=Amiri:wght@700&display=swap';
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
(async () => {
  const r = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('css ' + r.status);
  let css = await r.text();
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
  if (!urls.length) throw new Error('no font urls');
  fs.mkdirSync(OUT, { recursive: true });
  let i = 0;
  for (const u of urls) {
    const name = 'f' + (++i) + path.extname(new URL(u).pathname || '.woff2');
    const f = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!f.ok) throw new Error('font ' + f.status);
    fs.writeFileSync(path.join(OUT, name), Buffer.from(await f.arrayBuffer()));
    css = css.split(u).join(name);
  }
  fs.writeFileSync(path.join(OUT, 'fonts.css'), '/* مولّد تلقائيًا بواسطة scripts/fetch-fonts.js */\n' + css);
  console.log('fonts: ' + urls.length + ' files saved to www/fonts');
})().catch(e => { console.warn('fetch-fonts failed (التطبيق سيستعمل خط الهاتف):', e.message); process.exitCode = 0; });
