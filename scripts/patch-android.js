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
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
].filter(l => !xml.includes(l.match(/name="([^"]+)"/)[1]));
if (lines.length) {
  xml = xml.replace('</manifest>', '    ' + lines.join('\n    ') + '\n</manifest>');
  fs.writeFileSync(file, xml);
  console.log('أُضيف:', lines.length, 'سطر إلى AndroidManifest.xml');
} else {
  console.log('الأذونات موجودة مسبقًا');
}
