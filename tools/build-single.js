/* 单文件构建：把 journey.html 的 CSS / JS / 3 张图版内联到 dist/chaoxi.html */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const readBuf = (p) => fs.readFileSync(path.join(root, p));

let html = read('journey.html');

/* CSS */
html = html.replace(/<link rel="stylesheet" href="([^"?]+)(?:\?[^"]*)?"\s*>/g, (m, p) => {
  return '<style>\n' + read(p) + '\n</style>';
});

/* 05 幕是动态 loadAct 的，单文件里必须内联，否则 dist 下没有 js/acts/。
   注意：必须在把 <script src> 内联之前插，否则锚点已经被替换掉。 */
const actScripts = ['01', '02', '03', '04', '05'].map((id) => {
  return '<script>\n' + read('js/acts/act' + id + '.js') + '\n</script>';
}).join('\n');
html = html.replace('<script src="js/coast.js', actScripts + '\n<script src="js/coast.js');

/* JS（去掉 ?v= 查询） */
html = html.replace(/<script src="([^"?]+)(?:\?[^"]*)?"\s*><\/script>/g, (m, p) => {
  return '<script>\n' + read(p) + '\n</script>';
});

if (html.indexOf("ACTS.register('01'") < 0) {
  console.warn('WARN: act01 not inlined');
}

/* 图版：相对路径 → data URI */
const plates = [
  'assets/plates/treated/01-xuanwu.webp',
  'assets/plates/treated/03-coral.webp',
  'assets/plates/treated/04-route.webp'
];

plates.forEach((p) => {
  const uri = 'data:image/webp;base64,' + readBuf(p).toString('base64');
  html = html.split(p).join(uri);
  html = html.split('../../' + p).join(uri);
  html = html.split('../' + p).join(uri);
});

/* 去掉本地 dev 外壳脚本里的 sourceMap 注释（没有也无妨） */
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync(path.join(root, 'dist/chaoxi.html'), html, 'utf8');

const size = fs.statSync(path.join(root, 'dist/chaoxi.html')).size;
console.log('wrote dist/chaoxi.html');
console.log('size:', (size / 1024 / 1024).toFixed(2), 'MB');
