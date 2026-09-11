// 提取 index.html 内联脚本并做语法检查（Node 直接按 UTF-8 读取，避免 shell 编码干扰）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(file, 'utf8');
const m = /<script>([\s\S]*?)<\/script>/.exec(src);
if (!m) { console.error('未找到内联 <script>'); process.exit(1); }

const code = m[1];
const out = path.join(__dirname, 'extracted.js');
fs.writeFileSync(out, code, 'utf8');

try {
  new vm.Script(code, { filename: 'index-inline.js' });
  console.log('SYNTAX OK  chars=' + code.length);
} catch (e) {
  console.error('SYNTAX FAIL:', e.message);
  const line = (e.stack.match(/index-inline\.js:(\d+)/) || [])[1];
  if (line) {
    const lines = code.split('\n');
    for (let i = Math.max(0, line - 3); i < Math.min(lines.length, +line + 2); i++) {
      console.error((i + 1) + ': ' + lines[i]);
    }
  }
  process.exit(1);
}
