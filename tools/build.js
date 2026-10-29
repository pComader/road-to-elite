// Build de Road To Elite: src/*.js → app.js (núcleo) + m-menu.js + m-timer.js minificados, y sw.js con la versión por contenido.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{minify}=require('terser');
const R='/home/claude/road-to-elite';
(async()=>{
  const out={'app.js':'core.js','m-menu.js':'menu.js','m-timer.js':'timer.js'};
  const h=crypto.createHash('sha1');
  for(const [dst,src] of Object.entries(out)){
    const code=fs.readFileSync(path.join(R,'src',src),'utf8');
    const m=await minify(code,{compress:{passes:2},mangle:true,format:{comments:/^!/},sourceMap:false});
    fs.writeFileSync(path.join(R,dst),m.code);
    h.update(m.code);
    console.log(dst.padEnd(12),(code.length/1024).toFixed(0)+' KB →',(m.code.length/1024).toFixed(0)+' KB');
  }
  for(const f of ['styles.css','index.html','config.js']) h.update(fs.readFileSync(path.join(R,f)));
  // CSS: quitar comentarios y espacios sobrantes
  const css=fs.readFileSync(path.join(R,'src','styles.css'),'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s*\n\s*/g,'\n').replace(/\n+/g,'\n');
  fs.writeFileSync(path.join(R,'styles.css'),css); h.update(css);
  console.log('styles.css  ',(fs.statSync(path.join(R,'src','styles.css')).size/1024).toFixed(0)+' KB →',(css.length/1024).toFixed(0)+' KB');
  const ver='rte-'+h.digest('hex').slice(0,10);
  const sw=fs.readFileSync(path.join(R,'src','sw.js'),'utf8').replace('__VERSION__',ver);
  fs.writeFileSync(path.join(R,'sw.js'),sw);
  console.log('sw versión',ver);
})();
