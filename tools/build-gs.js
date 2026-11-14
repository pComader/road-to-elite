// Une apps-script/modulos/*.gs (por orden de nombre) en apps-script/Code.gs, el único archivo que sube publicar.bat.
// Uso: node tools/build-gs.js           → reescribe Code.gs
//      node tools/build-gs.js --check   → solo comprueba que Code.gs coincide con los módulos
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'apps-script', 'modulos'), out = path.join(__dirname, '..', 'apps-script', 'Code.gs');
const files = fs.readdirSync(dir).filter(f => /^\d\d_.*\.gs$/.test(f)).sort();
const txt = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
new Function(txt);   // falla si hay un error de sintaxis
if (process.argv.includes('--check')) {
  const ok = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === txt;
  console.log(ok ? 'Code.gs coincide con los ' + files.length + ' módulos' : 'Code.gs NO coincide: ejecuta node tools/build-gs.js');
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(out, txt);
console.log('Code.gs ← ' + files.length + ' módulos · ' + Math.round(txt.length / 1024) + ' KB');
