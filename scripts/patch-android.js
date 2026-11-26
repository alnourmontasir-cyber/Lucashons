/* يضيف أذونات الموقع إلى AndroidManifest.xml بعد «npx cap add android» */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(file)) {
  console.error('لم يُعثر على AndroidManifest.xml — شغّل «npx cap add android» أولًا');
  process.exit(1);
}
let xml = fs.readFileSync(file, 'utf8');
const lines = [
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  /* تسجيل الرحلة في الخلفية: خدمة موقع أمامية بإشعار (Android 14+ يتطلب نوع الخدمة location) */
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
].filter(l => !xml.includes(l.match(/name="([^"]+)"/)[1]));
if (lines.length) {
  xml = xml.replace('</manifest>', '    ' + lines.join('\n    ') + '\n</manifest>');
  fs.writeFileSync(file, xml);
  console.log('أُضيف:', lines.length, 'سطر إلى AndroidManifest.xml');
} else {
  console.log('الأذونات موجودة مسبقًا');
}

/* [الشاشة السوداء / التطبيقات الأخيرة]
   1) خلفية نافذة أندرويد بلون التطبيق بدل الأسود/الأبيض أثناء التحميل وفي معاينة التطبيقات الأخيرة
   2) التأكد من عدم وجود FLAG_SECURE (يمنع معاينة التطبيقات الأخيرة ويجعلها سوداء) — المشروع لا يضيفه */
const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values');
try {
  fs.mkdirSync(resDir, { recursive: true });
  fs.writeFileSync(path.join(resDir, 'gbs_colors.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="gbs_bg">#070a12</color>\n'
    + '    <string name="capacitor_background_geolocation_notification_channel_name">تسجيل الرحلة</string>\n</resources>\n');
  const stylesFile = path.join(resDir, 'styles.xml');
  if (fs.existsSync(stylesFile)) {
    let st = fs.readFileSync(stylesFile, 'utf8');
    st = st.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/, function (m) {
      return st.includes('gbs_bg') ? m : m + '\n        <item name="android:windowBackground">@color/gbs_bg</item>';
    });
    fs.writeFileSync(stylesFile, st);
    console.log('خلفية النافذة: #070a12');
  }
} catch (e) { console.warn('تعذّر ضبط خلفية النافذة:', e.message); }
const javaRoot = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java');
(function scan(d) {
  if (!fs.existsSync(d)) return;
  for (const f of fs.readdirSync(d)) {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isDirectory()) scan(fp);
    else if (/\.(java|kt)$/.test(f) && fs.readFileSync(fp, 'utf8').includes('FLAG_SECURE'))
      console.warn('تنبيه: FLAG_SECURE موجود في ' + fp + ' — سيجعل معاينة التطبيقات الأخيرة سوداء');
  }
})(javaRoot);

