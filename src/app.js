(() => {
'use strict';

const W = 480, H = 270;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
const boot = document.getElementById('boot');

const C = {
  white: '#F5F5D4', green: '#96CF85', blue: '#4B6D85', black: '#352B31',
  yellow: '#DFE9AA', brown: '#9B986C', red: '#AA5A67', purple: '#9D5B88', cyan: '#BFE7E7'
};

const UI = {
  sliderX: 8, sliderY: 254, sliderW: 162,
  buttonY: 251,
  buttons: [
    { id:'log', x:286, key:'L', icon:'s_UI_log', tip:"CAPTAIN'S LOG" },
    { id:'probe', x:306, key:'P', icon:'s_UI_probe', tip:'LAUNCH PROBE' },
    { id:'rocket', x:326, key:'3', icon:'s_UI_rocket', tip:'LAUNCH ROCKET' },
    { id:'temp', x:346, key:'TAB', icon:'s_UI_temp', tip:'TEMPERATURE VIEW' },
    { id:'reverse', x:366, key:'1', icon:'s_UI_reverse', tip:'REVERSE TIME' },
    { id:'pause', x:386, key:'SPACE', icon:'s_UI_pause', tip:'PAUSE TIME' },
    { id:'fast', x:406, key:'2', icon:'s_UI_fastforward', tip:'TIME SPEED' },
    { id:'camera', x:426, key:'4', icon:'s_UI_camera', tip:'TAKE PICTURE' },
    { id:'mute', x:446, key:'5', icon:'s_UI_mute', tip:'MUTE MUSIC' },
    { id:'random', x:466, key:'0', icon:'s_UI_random', tip:'RANDOM PLANET' },
  ]
};

const asset = {};
const assetNames = {
  sliderBack: 's_UI_slider_back_00.png',
  sliderFront: 's_UI_slider_front_00.png',
  sliderFrontAlt: 's_UI_slider_front_01.png',
  rocketSprite: 's_rocket_00.png',
  cursor0: 's_cursor_00.png', cursor1: 's_cursor_01.png', cursor2: 's_cursor_02.png',
  focusTL: 's_cursor_ext_00.png', focusTR: 's_cursor_ext_01.png', focusBR: 's_cursor_ext_02.png', focusBL: 's_cursor_ext_03.png',
  log: 's_UI_log_00.png', probe: 's_UI_probe_00.png', pause: 's_UI_pause_00.png',
  reverse: 's_UI_reverse_00.png', fast: 's_UI_fastforward_00.png', rocket: 's_UI_rocket_00.png',
  camera: 's_UI_camera_00.png', mute: 's_UI_mute_00.png', random: 's_UI_random_00.png'
};
for (let i=0;i<5;i++) assetNames['temp'+i] = `s_UI_temp_0${i}.png`;
for (let i=0;i<12;i++) assetNames['cloud'+i] = `s_cloud_${String(i).padStart(2,'0')}.png`;
for (let i=0;i<25;i++) assetNames['moon'+i] = `s_moon_${String(i).padStart(2,'0')}.png`;
for (const [k,fn] of Object.entries(assetNames)) {
  const im = new Image(); im.src = 'assets/sprites/' + fn; asset[k] = im;
}
const specialTexture = {};
const plutoMapImage = new Image();
plutoMapImage.src = 'assets/textures/pluto_map_00.png';
plutoMapImage.addEventListener('load',()=>{
  try{
    const c=document.createElement('canvas'); c.width=plutoMapImage.naturalWidth; c.height=plutoMapImage.naturalHeight;
    const g=c.getContext('2d',{willReadFrequently:true}); g.imageSmoothingEnabled=false; g.drawImage(plutoMapImage,0,0);
    specialTexture.pluto={width:c.width,height:c.height,data:g.getImageData(0,0,c.width,c.height).data};
  }catch{}
});

const audio = new Audio('assets/mus_loop.ogg');
audio.loop = true;
audio.volume = 0.46;
let audioStarted = false;
function startAudio() {
  if (audioStarted) return;
  audioStarted = true;
  const p = audio.play();
  if (p && p.catch) p.catch(() => { audioStarted = false; boot.classList.add('visible'); });
  else boot.classList.remove('visible');
}
audio.addEventListener('playing', () => boot.classList.remove('visible'));
audio.addEventListener('error', () => boot.classList.remove('visible'));
setTimeout(() => { if (!audioStarted) boot.classList.add('visible'); }, 900);

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerp(a,b,t){ return a+(b-a)*t; }
function mod(n,m){ return ((n%m)+m)%m; }
function mixHex(hex, toward, amount) {
  const a = hex.replace('#',''), b = toward.replace('#','');
  const out=[];
  for(let i=0;i<3;i++) out.push(Math.round(lerp(parseInt(a.slice(i*2,i*2+2),16),parseInt(b.slice(i*2,i*2+2),16),amount)));
  return '#'+out.map(v=>v.toString(16).padStart(2,'0')).join('');
}
const MOON_COLORS = [
  C.white, C.yellow, C.brown, C.cyan, C.blue,
  mixHex(C.green,C.white,.32), mixHex(C.purple,C.white,.22), mixHex(C.red,C.white,.24)
];
const SOLAR_MOON_COLORS = {
  MOON: mixHex(C.white,C.black,.18), PHOBOS:C.brown, DEIMOS:mixHex(C.brown,C.white,.24),
  IO:C.yellow, EUROPA:mixHex(C.white,C.yellow,.25), GANYMEDE:mixHex(C.brown,C.white,.18), CALLISTO:mixHex(C.brown,C.purple,.18),
  ENCELADUS:C.cyan, RHEA:mixHex(C.white,C.blue,.15), TITAN:mixHex(C.yellow,C.red,.28), IAPETUS:mixHex(C.brown,C.white,.12),
  MIRANDA:mixHex(C.white,C.blue,.18), ARIEL:C.cyan, UMBRIEL:mixHex(C.purple,C.black,.22), TITANIA:mixHex(C.cyan,C.blue,.22),
  PROTEUS:mixHex(C.brown,C.black,.18), TRITON:mixHex(C.cyan,C.purple,.18), NEREID:C.blue,
  WIKTIONARY:mixHex(C.white,C.black,.18), WIKIBOOKS:C.white, WIKIQUOTE:mixHex(C.white,C.blue,.12),
  WIKISOURCE:mixHex(C.white,C.brown,.10), WIKISPECIES:mixHex(C.white,C.green,.10), WIKIVOYAGE:mixHex(C.white,C.cyan,.12), WIKIDATA:mixHex(C.white,C.purple,.10),
  PANDORA:mixHex(C.green,C.cyan,.26), CASSANDRA:mixHex(C.green,C.blue,.20), DANTE:mixHex(C.red,C.yellow,.18), HADES:mixHex(C.brown,C.red,.16),
  CHAOS:mixHex(C.purple,C.blue,.18), 'POLYPHEMUS III':mixHex(C.cyan,C.blue,.22), 'POLYPHEMUS IV':mixHex(C.white,C.cyan,.28),
  'POLYPHEMUS VII':mixHex(C.blue,C.cyan,.30), 'POLYPHEMUS VIII':mixHex(C.white,C.blue,.18), 'POLYPHEMUS IX':C.brown,
  'POLYPHEMUS X':mixHex(C.cyan,C.green,.18), 'POLYPHEMUS XI':mixHex(C.white,C.purple,.14), 'POLYPHEMUS XIII':mixHex(C.brown,C.white,.12), 'POLYPHEMUS XIV':mixHex(C.blue,C.black,.12)
};

const RING_STYLE_PROFILES = {
  THIN:{bands:[0],density:.88,size:1},
  WIDE:{bands:[-.070,-.035,0,.035,.070],density:.86,size:1},
  DOUBLE:{bands:[-.070,.070],density:.90,size:1},
  TRIPLE:{bands:[-.090,0,.090],density:.88,size:1},
  DENSE:{bands:[-.125,-.085,-.045,0,.045,.085,.125],density:.94,size:1},
  SPARSE:{bands:[0],density:.48,size:1},
  DUST:{bands:[-.055,.005,.065],density:.34,size:1},
  SHEPHERDED:{bands:[-.125,-.015,.120],density:.84,size:1},
  DEBRIS:{bands:[-.085,-.015,.075],density:.50,size:2},
  ICY:{bands:[-.100,-.050,0,.050,.100],density:.94,size:1},
  DARK:{bands:[-.060,0,.060],density:.72,size:1},
  MIXED:{bands:[-.120,-.060,.010,.085],density:.80,size:1}
};
const PROCEDURAL_RING_STYLES=['THIN','WIDE','DOUBLE','TRIPLE','DENSE','SPARSE','DUST','SHEPHERDED','DEBRIS','ICY','DARK','MIXED'];
const RING_COLORS=[C.purple,C.blue,C.brown,C.yellow,C.cyan,mixHex(C.white,C.blue,.18),mixHex(C.red,C.brown,.28)];
function configureProceduralRing(p,r){
  if(!p.ring) return;
  p.ringStyle=pick(r,PROCEDURAL_RING_STYLES);
  // Ring systems should feel meaningfully different from world to world, not
  // like the same ellipse with a palette swap. Size controls the overall
  // reach, while band spread changes how tightly the individual bands cluster.
  p.ringScale=1.36+r()*.59;
  p.ringFlatness=.13+r()*.21;
  p.ringBandSpread=.72+r()*.72;
  p.ringSpinRate=.022+r()*.035;
  p.ringParticleScale=.72+r()*.88;
  p.ringAlpha=.45+r()*.48;
  p.ringColor=pick(r,RING_COLORS);
  p.ringMaterial=p.ringStyle==='ICY'?'ICE':p.ringStyle==='DARK'?'ROCK':p.ringStyle==='DUST'?'DUST':p.ringStyle==='DEBRIS'?'ROCK / ICE':pick(r,['ICE / ROCK','ROCK','DUST / ICE']);
  if(p.ringStyle==='ICY'){ p.ringColor=mixHex(C.white,C.cyan,.25); p.ringAlpha=.92; }
  if(p.ringStyle==='DARK'){ p.ringColor=mixHex(C.brown,C.black,.28); p.ringAlpha=.64; }
  if(p.ringStyle==='DUST') p.ringAlpha=.38;
  if(p.ringStyle==='SPARSE') p.ringAlpha=.56;
}
function ringStyleLabel(p=planet){
  if(!p?.ring) return 'NONE';
  return ({DENSE:'DENSE MULTIBAND',SHEPHERDED:'SHEPHERDED',DEBRIS:'DEBRIS',DUST:'DUST',ICY:'ICY MULTIBAND',DARK:'DARK NARROW'}[p.ringStyle]||p.ringStyle||'SIMPLE');
}
const moonTintCache = new Map();
function moonTintColor(m){
  if(SOLAR_MOON_COLORS[m?.name]) return SOLAR_MOON_COLORS[m.name];
  const key=`${planet?.seed||0}:${m?.name||'MOON'}:${m?.frame||0}`;
  return MOON_COLORS[hashString(key)%MOON_COLORS.length];
}
function tintedMoonSprite(frame,color){
  const im=asset['moon'+frame];
  if(!im || !im.complete || !im.naturalWidth) return im;
  const key=`${frame}:${color}`;
  if(moonTintCache.has(key)) return moonTintCache.get(key);
  const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
  const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(im,0,0);
  g.globalCompositeOperation='source-in'; g.fillStyle=color; g.fillRect(0,0,c.width,c.height);
  g.globalCompositeOperation='source-over';
  moonTintCache.set(key,c); return c;
}
const moonTextureCache=new Map();
function moonTextureEnabled(m,diameter){
  if(diameter>=10) return true;
  if(planet?.name==='POLYPHEMUS' && diameter>=4) return true;
  return h2(hashString(m?.name||'MOON')&255,diameter,(planet?.seed||0)^0x5d19a6e3)<.085;
}
function moonTextureColors(m,base){
  const s=(m?.scan?.surface||'').toUpperCase();
  if(s.includes('SULFUR')) return [C.yellow,mixHex(C.red,C.yellow,.32),C.white];
  if(s.includes('ICE')) return [mixHex(base,C.white,.42),mixHex(C.cyan,C.white,.20),mixHex(C.blue,C.white,.10)];
  if(s.includes('METALLIC')) return [C.white,C.cyan,mixHex(C.blue,C.white,.22)];
  if(s.includes('CARBON')) return [mixHex(base,C.black,.45),C.purple,mixHex(C.brown,C.black,.30)];
  if(s.includes('BASALT')) return [mixHex(base,C.black,.38),mixHex(base,C.brown,.35),mixHex(base,C.white,.16)];
  return [mixHex(base,C.black,.28),mixHex(base,C.white,.22),mixHex(base,C.brown,.20)];
}
function texturedMoonSprite(frame,color,m,diameter){
  const base=tintedMoonSprite(frame,color);
  if(!base||!base.width||!moonTextureEnabled(m,diameter)) return base;
  const surface=(m?.scan?.surface||'ROCK').toUpperCase();
  const key=`${planet?.seed||0}:${m?.name||'MOON'}:${frame}:${color}:${surface}`;
  if(moonTextureCache.has(key)) return moonTextureCache.get(key);
  const c=document.createElement('canvas');c.width=base.width;c.height=base.height;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(base,0,0);
  const alpha=g.getImageData(0,0,c.width,c.height).data, solid=[];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(alpha[(y*c.width+x)*4+3]>24)solid.push([x,y]);
  if(!solid.length)return base;
  g.globalCompositeOperation='source-atop';
  const r=mulberry32(hashString(key)), palette=moonTextureColors(m,color), detailCount=diameter>=30?28:diameter>=20?20:diameter>=12?12:6;
  const point=()=>solid[Math.floor(r()*solid.length)];
  if(planet?.name==='EARTH' && m?.name==='MOON'){
    // Earth's Moon must stay neutral lunar grey. The UI's C.white is a warm
    // cream, so using the normal moon tint path makes Luna look yellow/beige.
    // Repaint the whole visible disc with an independent grayscale lunar
    // palette, then layer recognizable near-side maria and crater relief over it.
    const lunar={
      high:'#B9BAB4', highLight:'#D3D4CE', mid:'#9A9B96',
      mare:'#686A69', mareDark:'#56595A', crater:'#7D7F7C', rim:'#DADBD4', limb:'#777A78'
    };
    g.fillStyle=lunar.high;
    g.fillRect(0,0,c.width,c.height);

    // Approximate near-side maria: Oceanus Procellarum / Imbrium on the left,
    // Serenitatis + Tranquillitatis to the upper-right, Nubium/Humorum below,
    // and Fecunditatis toward the lower-right. Slight overlap makes the tiny
    // pixel sprite read much more like the real Moon than random dark blobs.
    const maria=[
      [.285,.47,.155,.245,lunar.mareDark], // Oceanus Procellarum
      [.405,.325,.155,.125,lunar.mare],    // Mare Imbrium
      [.585,.335,.105,.095,lunar.mare],    // Mare Serenitatis
      [.635,.445,.125,.105,lunar.mareDark],// Mare Tranquillitatis
      [.585,.565,.105,.090,lunar.mare],    // Mare Fecunditatis
      [.425,.585,.135,.095,lunar.mare],    // Mare Nubium
      [.300,.615,.090,.075,lunar.mareDark] // Mare Humorum
    ];
    for(const [mx,my,rx,ry,col] of maria){
      g.fillStyle=col;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
        const dx=(x/c.width-mx)/rx, dy=(y/c.height-my)/ry;
        if(dx*dx+dy*dy<1 && alpha[(y*c.width+x)*4+3]>24) g.fillRect(x,y,1,1);
      }
    }

    // Highlands are mottled rather than flat. Keep the noise sparse and fully
    // deterministic so Luna is recognizable and stable every visit.
    for(let i=0;i<detailCount+18;i++){
      const [x,y]=point();
      g.fillStyle=r()>.48?lunar.highLight:lunar.mid;
      g.fillRect(x,y,1,1);
    }

    // Craters: dark floor + bright sunward rim. Larger sprites get a few 2 px
    // basins while small sprites retain crisp one-pixel impact marks.
    const craterCount=diameter>=30?13:diameter>=20?9:6;
    for(let i=0;i<craterCount;i++){
      const [x,y]=point(), big=diameter>=24 && r()>.66;
      g.fillStyle=lunar.crater;
      g.fillRect(x,y,big?2:1,big?2:1);
      if(big){
        g.fillStyle=lunar.mareDark; g.fillRect(x+1,y+1,1,1);
        g.fillStyle=lunar.rim; g.fillRect(x,y-1,1,1); g.fillRect(x-1,y,1,1);
      }else if(r()>.42){
        g.fillStyle=lunar.rim; g.fillRect(x-1,y,1,1);
      }
    }

    // Very subtle limb darkening gives the disc spherical volume while staying
    // within the native pixel-art language and preserving the sprite silhouette.
    for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
      if(alpha[(y*c.width+x)*4+3]<=24) continue;
      const nx=(x+.5)/c.width*2-1, ny=(y+.5)/c.height*2-1;
      const rr=nx*nx+ny*ny;
      if(rr>.72 && h2(x,y,hashString(key)^0x4c554e41)>.30){
        g.fillStyle=rr>.90?lunar.limb:lunar.mid;
        g.globalAlpha=rr>.90?.34:.16;
        g.fillRect(x,y,1,1);
        g.globalAlpha=1;
      }
    }
  } else if(surface.includes('ICE')){
    g.fillStyle=palette[1];
    for(let i=0;i<Math.max(4,Math.floor(detailCount*.55));i++){
      let [x,y]=point(),len=2+Math.floor(r()*Math.max(2,diameter*.18));
      for(let k=0;k<len;k++){g.fillRect(x,y,1,1);x+=r()<.5?-1:1;y+=r()<.45?0:(r()<.5?-1:1);}
    }
    g.fillStyle=palette[0];for(let i=0;i<detailCount*.35;i++){const [x,y]=point();g.fillRect(x,y,1+(r()>.72?1:0),1);}
  }else if(surface.includes('SULFUR')){
    for(let i=0;i<detailCount;i++){g.fillStyle=palette[i%palette.length];const [x,y]=point(),sz=r()>.78?2:1;g.fillRect(x,y,sz,sz);}
  }else if(surface.includes('METALLIC')){
    for(let i=0;i<detailCount;i++){g.fillStyle=palette[i%palette.length];const [x,y]=point();g.fillRect(x,y,1+Math.floor(r()*3),1);}
  }else{
    // Rocky/basalt/carbon moons get small crater clusters rather than a flat tint.
    for(let i=0;i<detailCount;i++){
      const [x,y]=point(),sz=diameter>=18&&r()>.78?2:1;
      g.fillStyle=palette[i%palette.length];g.fillRect(x,y,sz,sz);
      if(sz>1&&r()>.45){g.fillStyle=palette[1];g.fillRect(x+1,y+1,1,1);}
    }
  }
  g.globalCompositeOperation='source-over';moonTextureCache.set(key,c);return c;
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  h ^= h >>> 16; h = Math.imul(h,0x7feb352d); h ^= h >>> 15; h = Math.imul(h,0x846ca68b); h ^= h >>> 16;
  return h >>> 0;
}
function mulberry32(seed) {
  return function(){ let t=seed+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
}
function h2(x,y,s){
  let h=(s ^ Math.imul(x,374761393) ^ Math.imul(y,668265263))>>>0;
  h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967295;
}
function smooth(t){ return t*t*(3-2*t); }
function valueNoise(x,y,seed,periodX=64) {
  let x0=Math.floor(x), y0=Math.floor(y), tx=smooth(x-x0), ty=smooth(y-y0);
  const x1=x0+1, y1=y0+1;
  const a=h2(mod(x0,periodX),y0,seed), b=h2(mod(x1,periodX),y0,seed);
  const c=h2(mod(x0,periodX),y1,seed), d=h2(mod(x1,periodX),y1,seed);
  return lerp(lerp(a,b,tx),lerp(c,d,tx),ty);
}
function fbm(x,y,seed) {
  let total=0, amp=.56, freq=1, norm=0;
  for(let o=0;o<5;o++) { total += valueNoise(x*freq,y*freq,seed+o*101,64)*amp; norm+=amp; amp*=.52; freq*=2; }
  return total/norm;
}

// Exact 3x5-ish bitmap font recovered from the supplied executable. Lowercase is normalized to uppercase,
// matching the original game's compact all-caps display style.
const FONT = window.PLANETARIUM_FONT || {};
function glyph(ch){
  ch = ch.toUpperCase();
  return FONT[ch] || FONT['?'];
}
function textWidth(text, scale=1){
  let w=0; for(const ch of String(text)){ const g=glyph(ch); w+=(g ? g.shift : 4)*scale; } return Math.max(0,w-scale);
}
function drawText(text,x,y,color=C.white,scale=1,align='left'){
  text=String(text).toUpperCase();
  let px=x;
  const tw=textWidth(text,scale);
  if(align==='center') px-=Math.floor(tw/2); else if(align==='right') px-=tw;
  ctx.fillStyle=color;
  for(const ch of text){
    const g=glyph(ch); if(!g){ px+=4*scale; continue; }
    const p=g.p;
    for(let i=0;i<p.length;i+=2){
      const gx=p[i]+g.off, gy=p[i+1]-6;
      ctx.fillRect(Math.round(px+gx*scale),Math.round(y+gy*scale),scale,scale);
    }
    px += g.shift*scale;
  }
}
function wrapText(text,maxPx,scale=1){
  const paras=String(text).split('#'); const lines=[];
  const splitWord=(word)=>{
    const parts=[]; let part='';
    for(const ch of word){
      const test=part+ch;
      if(part && textWidth(test,scale)>maxPx){ parts.push(part); part=ch; }
      else part=test;
    }
    if(part) parts.push(part);
    return parts.length?parts:[''];
  };
  for(let pi=0;pi<paras.length;pi++){
    const rawWords=paras[pi].split(/\s+/).filter(Boolean), words=[]; let line='';
    if(!rawWords.length){ lines.push(''); continue; }
    for(const word of rawWords){
      if(textWidth(word,scale)>maxPx) words.push(...splitWord(word)); else words.push(word);
    }
    for(const word of words){
      const test=line ? line+' '+word : word;
      if(line && textWidth(test,scale)>maxPx){ lines.push(line); line=word; } else line=test;
    }
    if(line) lines.push(line);
  }
  return lines;
}
function drawParagraph(text,x,y,maxPx,color=C.white,scale=1,lineH=8){
  const lines=wrapText(text,maxPx,scale);
  lines.forEach((line,i)=>drawText(line,x,y+i*lineH,color,scale));
  return y+lines.length*lineH;
}

function hoverActive(){ return state.mouse.inside && state.mouse.pointerType!=='touch'; }
function pointInRect(p,x,y,w,h){ return !!p && p.x>=x && p.x<=x+w && p.y>=y && p.y<=y+h; }
function drawFocusFrame(x,y,w,h){
  x=Math.round(x); y=Math.round(y); w=Math.max(5,Math.round(w)); h=Math.max(5,Math.round(h));
  const tl=asset.focusTL, tr=asset.focusTR, br=asset.focusBR, bl=asset.focusBL;
  if([tl,tr,br,bl].every(im=>im&&im.complete&&im.naturalWidth)){
    ctx.drawImage(tl,x-1,y-1);
    ctx.drawImage(tr,x+w-7,y-1);
    ctx.drawImage(br,x+w-7,y+h-7);
    ctx.drawImage(bl,x-1,y+h-7);
    return;
  }
  ctx.fillStyle=C.white;
  const arm=3;
  ctx.fillRect(x,y,arm,1); ctx.fillRect(x,y,1,arm);
  ctx.fillRect(x+w-arm,y,arm,1); ctx.fillRect(x+w-1,y,1,arm);
  ctx.fillRect(x,y+h-1,arm,1); ctx.fillRect(x,y+h-arm,1,arm);
  ctx.fillRect(x+w-arm,y+h-1,arm,1); ctx.fillRect(x+w-1,y+h-arm,1,arm);
}
function drawInfoBackdrop(x,y,w,h){
  const rx=Math.max(0,Math.round(x)),ry=Math.max(0,Math.round(y));
  const rw=Math.min(W-rx,Math.max(0,Math.round(w))),rh=Math.min(H-ry,Math.max(0,Math.round(h)));
  if(rw<=0||rh<=0)return;
  ctx.globalAlpha=.80;ctx.fillStyle=C.black;ctx.fillRect(rx,ry,rw,rh);
  ctx.globalAlpha=.18;ctx.fillStyle=C.white;ctx.fillRect(rx,ry,rw,1);ctx.fillRect(rx,ry,1,rh);
  ctx.globalAlpha=.10;ctx.fillRect(rx,ry+rh-1,rw,1);ctx.fillRect(rx+rw-1,ry,1,rh);
  ctx.globalAlpha=1;
}

function rectOverlapArea(a,b){
  const x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
  const y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  return x*y;
}
function bodyScreenRect(body,cx,cy,pad=4){
  if(body?.type==='moon'){
    const m=planet.moonData?.[body.index]; if(!m) return {x:cx-pad,y:cy-pad,w:pad*2,h:pad*2};
    const r=Math.max(5,m.hitRadius||Math.ceil((m.visualDiameter||10)/2));
    return {x:m.screenX-r-pad,y:m.screenY-r-pad,w:(r+pad)*2,h:(r+pad)*2};
  }
  return {x:cx-planet.rx-pad,y:cy-planet.ry-pad,w:planet.rx*2+pad*2,h:planet.ry*2+pad*2};
}
function visibleBodyRects(cx,cy,excludeBody=null){
  const out=[];
  if(!excludeBody||excludeBody.type!=='planet') out.push(bodyScreenRect({type:'planet'},cx,cy,3));
  for(let i=0;i<(planet.moonData?.length||0);i++){
    if(excludeBody?.type==='moon'&&excludeBody.index===i) continue;
    const m=planet.moonData[i]; if(!Number.isFinite(m.screenX)||!Number.isFinite(m.screenY)) continue;
    out.push(bodyScreenRect({type:'moon',index:i},cx,cy,2));
  }
  return out;
}
function chooseInfoPanelRect(body,cx,cy,w,h,extraObstacles=[]){
  const margin=6,bottomLimit=246,target=bodyScreenRect(body,cx,cy,5);
  w=Math.min(Math.round(w),W-margin*2); h=Math.min(Math.round(h),bottomLimit-margin*2);
  const centeredX=target.x+target.w/2-w/2, centeredY=target.y+target.h/2-h/2;
  const raw=[
    {x:target.x+target.w+8,y:centeredY},
    {x:target.x-w-8,y:centeredY},
    {x:centeredX,y:target.y+target.h+8},
    {x:centeredX,y:target.y-h-8},
    {x:margin,y:margin},{x:W-w-margin,y:margin},
    {x:margin,y:bottomLimit-h-margin},{x:W-w-margin,y:bottomLimit-h-margin}
  ];
  const obstacles=visibleBodyRects(cx,cy,body);
  let best=null,bestScore=Infinity;
  for(const c of raw){
    const r={x:clamp(Math.round(c.x),margin,W-w-margin),y:clamp(Math.round(c.y),margin,bottomLimit-h-margin),w,h};
    let score=rectOverlapArea(r,target)*80;
    for(const o of obstacles) score+=rectOverlapArea(r,o)*8;
    for(const o of (extraObstacles||[])) score+=rectOverlapArea(r,o)*60;
    score+=Math.hypot((r.x+r.w/2)-(target.x+target.w/2),(r.y+r.h/2)-(target.y+target.h/2))*.02;
    if(score<bestScore){bestScore=score;best=r;}
  }
  return best||{x:margin,y:margin,w,h};
}
function chooseNearBodyPanelRect(body,cx,cy,w,h,extraObstacles=[]){
  const margin=5,bottomLimit=246,target=bodyScreenRect(body,cx,cy,3);
  w=Math.min(Math.round(w),W-margin*2);h=Math.min(Math.round(h),bottomLimit-margin*2);
  const tcx=target.x+target.w/2,tcy=target.y+target.h/2;
  let ux=tcx-cx,uy=tcy-cy,ul=Math.hypot(ux,uy);
  if(ul<1){ux=1;uy=0;ul=1;} ux/=ul;uy/=ul;
  const tx=-uy,ty=ux,gap=7;
  const radialAnchor={x:tcx+ux*(target.w*.5+gap),y:tcy+uy*(target.h*.5+gap)};
  const placeFromVector=(vx,vy,anchor=radialAnchor)=>({
    x:anchor.x+(vx<-.15?-w:vx>.15?0:-w/2),
    y:anchor.y+(vy<-.15?-h:vy>.15?0:-h/2)
  });
  const candidates=[
    placeFromVector(ux,uy),
    placeFromVector(tx,ty,{x:tcx+tx*(target.w*.5+gap),y:tcy+ty*(target.h*.5+gap)}),
    placeFromVector(-tx,-ty,{x:tcx-tx*(target.w*.5+gap),y:tcy-ty*(target.h*.5+gap)}),
    {x:target.x+target.w+gap,y:tcy-h/2},
    {x:target.x-w-gap,y:tcy-h/2},
    {x:tcx-w/2,y:target.y-h-gap},
    {x:tcx-w/2,y:target.y+target.h+gap}
  ];
  const obstacles=visibleBodyRects(cx,cy,body);
  let best=null,bestScore=Infinity;
  for(const c of candidates){
    const rx=clamp(Math.round(c.x),margin,W-w-margin),ry=clamp(Math.round(c.y),margin,bottomLimit-h-margin);
    const r={x:rx,y:ry,w,h};
    const clampPenalty=Math.abs(rx-c.x)+Math.abs(ry-c.y);
    let score=rectOverlapArea(r,target)*1800+clampPenalty*2.5;
    for(const o of obstacles) score+=rectOverlapArea(r,o)*16;
    for(const o of (extraObstacles||[])) if(o) score+=rectOverlapArea(r,o)*85;
    score+=Math.hypot((r.x+r.w/2)-tcx,(r.y+r.h/2)-tcy)*.18;
    if(score<bestScore){bestScore=score;best=r;}
  }
  return best||{x:margin,y:margin,w,h};
}
function choosePlanetHoverPanelRect(cx,cy,w,h){
  // Keep the primary planet card in its original, predictable home: just to
  // the right of the planet. Only clamp vertically/horizontally to the UI.
  const margin=6,bottomLimit=246;
  w=Math.min(Math.round(w),W-margin*2);h=Math.min(Math.round(h),bottomLimit-margin*2);
  const maxX=W-w-margin,maxY=bottomLimit-h-margin;
  const desiredX=Math.round(cx+planet.rx+18);
  const legacyMaxX=Math.min(220,maxX);
  const x=maxX<202?Math.max(margin,maxX):clamp(desiredX,202,Math.max(202,legacyMaxX));
  const y=clamp(38,margin,Math.max(margin,maxY));
  return {x,y,w,h};
}
function chooseMoonHoverPanelRect(body,w,h){
  // Keep the card attached to the moon/object with a stable offset. Anchor it
  // OUTSIDE the rendered body so the card never paints over the moon texture.
  const margin=5,bottomLimit=246,m=planet.moonData?.[body?.index];
  w=Math.min(Math.round(w),W-margin*2);h=Math.min(Math.round(h),bottomLimit-margin*2);
  if(!m||!Number.isFinite(m.screenX)||!Number.isFinite(m.screenY)) return {x:margin,y:margin,w,h};
  const bodyRadius=Math.max(6,Math.ceil(m.hitRadius||((m.visualDiameter||10)*.55+3)));
  const gap=8;
  let x=Math.round(m.screenX+bodyRadius+gap);
  if(x+w>W-margin) x=Math.round(m.screenX-bodyRadius-gap-w);
  x=clamp(x,margin,W-w-margin);
  const y=clamp(Math.round(m.screenY-h*.32),8,Math.max(8,bottomLimit-h-margin));
  return {x,y,w,h};
}


function infoFieldLines(value,label,maxPx){
  const prefix=(String(label||'').toUpperCase()+'        ').slice(0,9),prefixW=textWidth(prefix,1);
  const valueLines=wrapText(String(value??''),Math.max(28,maxPx-prefixW),1);
  return {prefix,prefixW,lines:valueLines.length?valueLines:['']};
}
function measureInfoLabelWidth(rows,maxPx,gapPx=12){
  let widest=0;
  for(const row of rows||[]){
    const label=String((row&&row[0])||'').toUpperCase();
    widest=Math.max(widest,textWidth(label,1));
  }
  return clamp(widest+gapPx,36,Math.max(36,maxPx-28));
}
function alignedInfoFieldLines(value,label,maxPx,labelW){
  const labelText=String(label||'').toUpperCase();
  const resolvedLabelW=clamp(Math.round(labelW||textWidth(labelText,1)+12),36,Math.max(36,maxPx-28));
  const valueW=Math.max(24,maxPx-resolvedLabelW);
  const valueLines=wrapText(String(value??''),valueW,1);
  return {label:labelText,labelW:resolvedLabelW,lines:valueLines.length?valueLines:['']};
}
function infoFieldHeight(label,value,maxPx,labelW=null){
  if(labelW==null) return Math.max(1,infoFieldLines(value,label,maxPx).lines.length)*9;
  return Math.max(1,alignedInfoFieldLines(value,label,maxPx,labelW).lines.length)*9;
}
function drawInfoField(label,value,x,y,maxPx,color=C.white,labelW=null){
  if(labelW==null){
    const f=infoFieldLines(value,label,maxPx);
    drawText(f.prefix,x,y,color,1);
    f.lines.forEach((line,i)=>drawText(line,x+f.prefixW,y+i*9,color,1));
    return y+Math.max(1,f.lines.length)*9;
  }
  const f=alignedInfoFieldLines(value,label,maxPx,labelW);
  drawText(f.label,x,y,color,1);
  f.lines.forEach((line,i)=>drawText(line,x+f.labelW,y+i*9,color,1));
  return y+Math.max(1,f.lines.length)*9;
}
function deepScanModelForPlanet(){
  const d=planet.scan;
  if(isHaloRingWorld()) return {
    rows:[
      ['TYPE','FORERUNNER HALO',C.white],['DIAMETER',`${(planet.radiusKm*2).toLocaleString('en-US')} KM`,C.blue],['WIDTH',`${planet.haloSurfaceWidthKm||318} KM`,C.blue],
      ['GRAVITY',`${planet.gravity.toFixed(3)} G`,C.white],['STATUS',(planet.haloStatus||'UNKNOWN').replace('PARTIALLY ','').replace(' / DEACTIVATED',' / OFFLINE').replace(' / BANISHED OCCUPATION',' / BANISHED'),C.red],
      ['MONITOR',(planet.haloMonitor||'UNKNOWN').split(' ').slice(0,2).join(' '),C.cyan],['BIOME',(planet.haloBiome||'CURATED').split(' / ')[0],C.green],['FUNCTION','HALO ARRAY WEAPON',C.purple],
      ['LIFE',lifeTypeLabel(),isAlive()?C.green:C.brown],['TECH','FORERUNNER',C.purple]
    ],anomaly:hasAnomaly(d)?d.anomaly:'',anomalyLines:6
  };
  if(planet.solar) return {
    rows:[
      ['AGE',`${d.ageBy.toFixed(1)} BY`,C.white],['PRESS',d.pressureText||`${d.pressureAtm.toFixed(2)} ATM`,C.white],['MAG',d.magField,C.cyan],['DIST SUN',`${planet.distanceAU.toFixed(3)} AU`,C.blue],
      ['TILT',`${planet.axialTiltDeg.toFixed(2)} DEG`,C.white],['ATMOS',compactAtmosphereChemistry(),C.yellow],['WEATHER',compactWeatherLabel(),atmosphereAccentColor()],['CLOUDS',`${Math.round(dynamicCloudCover()*100)}% ${cloudTypeLabel()}`,C.white],
      ['PRECIP',precipitationLabel(),C.cyan],['ROTATION',`${planet.dayHours.toFixed(2)} H`,C.white],['YEAR',`${planet.yearDays} D`,C.white],...(planet.ring?[['RINGS',ringStyleLabel().replace(' MULTIBAND',''),planet.ringColor||C.purple]]:[])
    ],anomaly:hasAnomaly(d)?d.anomaly:'',anomalyLines:6
  };
  return {
    rows:[
      ['AGE',`${d.ageBy.toFixed(1)} BY`,C.white],['PRESS',`${d.pressureAtm.toFixed(2)} ATM`,C.white],['MAG',d.magField,C.cyan],['O2',`${d.oxygen.toFixed(1)}%`,C.green],['N2',`${d.nitrogen.toFixed(1)}%`,C.blue],['CO2',`${d.co2.toFixed(1)}%`,C.yellow],
      ['WEATHER',compactWeatherLabel(),atmosphereAccentColor()],['CLOUDS',`${Math.round(dynamicCloudCover()*100)}% ${cloudTypeLabel()}`,C.white],['PRECIP',precipitationLabel(),C.cyan],['TECTONIC',d.tectonics,C.white],['VOLCANIC',d.volcanism,C.red],
      ['OCEAN',`${d.oceanDepthKm.toFixed(1)} KM`,C.cyan],['ICE',`${iceCoverPercent()}%`,C.white],['LIFE',lifeTypeLabel(),isAlive()?C.green:C.brown],['TECH',techLevelLabel(),C.purple],['FE',`${d.iron}  C ${d.carbon}`,C.brown],['U',d.uranium,C.brown]
    ],anomaly:hasAnomaly(d)?d.anomaly:'',anomalyLines:4
  };
}
function deepScanModelForMoon(m){
  const d=m.scan;
  if(m.kind==='heighliner') return {rows:[['TYPE','GUILD HEIGHLINER',C.white],['POSITION','FIXED HOLD',C.blue],['HULL',d.surface,C.brown],['INTERIOR',d.atmosphere,C.yellow],['ACTIVITY',d.activity,C.red]],anomaly:hasAnomaly(d)?d.anomaly:'',anomalyLines:4};
  if(m.kind==='human_ship') return {rows:[['TYPE',d.type||m.objectClass||'HUMAN VESSEL',C.white],['ORIGIN',d.origin||'HUMAN',C.blue],['STATUS',d.status||'ACTIVE ORBIT',C.green],['ROLE',d.role||'COLONIAL SUPPORT',C.brown],['ACTIVITY',d.activity||'SHUTTLE TRAFFIC',C.red]],anomaly:hasAnomaly(d)?d.anomaly:'',anomalyLines:4};
  return {rows:[['TEMP',`${moonTemperatureC(m)} C`,C.white],['GRAVITY',`${d.gravity.toFixed(2)} G`,C.white],['SURFACE',d.surface,C.brown],['ATMOS',d.atmosphere,C.yellow],['WATER ICE',d.waterIce,C.cyan],['ACTIVITY',d.activity,C.red]],anomaly:hasAnomaly(d)?d.anomaly:'',anomalyLines:4};
}
function measureDeepScanModel(model,maxPx,labelW=null){
  let h=12;
  for(const [label,value] of model.rows) h+=infoFieldHeight(label,value,maxPx,labelW);
  if(model.anomaly) h+=12+wrapText(model.anomaly,maxPx,1).length*8;
  return h;
}
function drawDeepScanModel(model,x,y,maxPx,labelW=null){
  drawText('DEEP SCAN',x,y,C.purple,1); let yy=y+12;
  for(const [label,value,color] of model.rows) yy=drawInfoField(label,value,x,yy,maxPx,color,labelW);
  if(model.anomaly){
    yy+=2; drawText('ANOMALY',x,yy,C.purple,1); yy+=10;
    const lines=wrapText(model.anomaly,maxPx,1);
    lines.forEach((line,i)=>drawText(line,x,yy+i*8,C.yellow,1)); yy+=lines.length*8;
  }
  return yy;
}
function infoPanelHovered(){
  const r=state.infoPanelRect;
  return !!r && state.mouse.inside && pointInRect(state.mouse,r.x,r.y,r.w,r.h);
}
function scrollInfoPanel(delta){
  if(!state.infoPanelRect || state.infoScrollMax<=0) return false;
  state.infoScroll=clamp(state.infoScroll+delta,0,state.infoScrollMax);
  return true;
}
function beginScrollableInfoPanel(key,rect,contentHeight,pad=8){
  const viewportH=Math.max(1,rect.h-pad*2);
  if(state.infoPanelKey!==key){state.infoPanelKey=key;state.infoScroll=0;state.infoPanelFocused=false;}
  state.infoPanelRect={...rect};
  state.infoScrollMax=Math.max(0,Math.ceil(contentHeight-viewportH));
  state.infoScroll=clamp(state.infoScroll,0,state.infoScrollMax);
  drawInfoBackdrop(rect.x,rect.y,rect.w,rect.h);
  ctx.save();
  ctx.beginPath();ctx.rect(rect.x+5,rect.y+5,rect.w-10,rect.h-10);ctx.clip();
  ctx.translate(0,-state.infoScroll);
  return {x:rect.x+pad,y:rect.y+pad,viewportH};
}
function endScrollableInfoPanel(rect,contentHeight,pad=8){
  ctx.restore();
  if(state.infoScrollMax<=0) return;
  const trackX=rect.x+rect.w-5,trackY=rect.y+6,trackH=Math.max(8,rect.h-12);
  const viewportH=Math.max(1,rect.h-pad*2);
  ctx.globalAlpha=.48;ctx.fillStyle=C.purple;
  for(let py=trackY;py<trackY+trackH;py+=3)ctx.fillRect(trackX,py,1,1);
  const thumbH=Math.max(5,Math.round(trackH*clamp(viewportH/Math.max(viewportH,contentHeight),.08,1)));
  const travel=Math.max(0,trackH-thumbH);
  const thumbY=trackY+Math.round(travel*(state.infoScroll/state.infoScrollMax));
  ctx.globalAlpha=1;ctx.fillStyle=(infoPanelHovered()||state.infoPanelFocused)?C.white:C.purple;ctx.fillRect(trackX-1,thumbY,2,thumbH);
}
function measureNarrative(text,maxPx){return text?10+wrapText(text,maxPx,1).length*8:0;}
function drawNarrative(title,text,x,y,maxPx,titleColor=C.green,textColor=C.green){
  if(!text)return y;
  drawText(title,x,y,titleColor,1);y+=10;
  const lines=wrapText(text,maxPx,1);
  lines.forEach((line,i)=>drawText(line,x,y+i*8,textColor,1));
  return y+lines.length*8;
}

const syllA=['AR','BEL','CA','DA','EL','FEN','GA','HEL','IO','JAR','KA','LUM','MER','NO','OR','PHA','QUA','RAN','SOL','TA','UR','VEL','WY','XAN','YOR','ZEN'];
const syllB=['A','AE','ARA','EN','ER','IA','ION','IS','ON','ORA','OS','UM','US','YR'];
const suffix=['',' PRIME',' II',' III',' IV',' V',' MINOR',' MAJOR',' OMICRON',' BETA'];
function randomPlanetName(){
  const r=Math.random; let n=syllA[Math.floor(r()*syllA.length)] + syllB[Math.floor(r()*syllB.length)];
  if(r()<.35) n += syllA[Math.floor(r()*syllA.length)].toLowerCase();
  if(r()<.18) n += suffix[Math.floor(r()*suffix.length)];
  return n.toUpperCase();
}

const moonA=['AL','BE','CER','DA','EL','FA','GAN','HEL','IO','KA','LE','MER','NA','OR','PEL','RA','SEL','TA','UM','VE','XAN','YOR','ZEL'];
const moonB=['A','AE','ARA','EN','ER','IA','IS','ON','ORA','OS','UM','US','YX'];
function moonName(r,index){
  const base=moonA[Math.floor(r()*moonA.length)] + moonB[Math.floor(r()*moonB.length)];
  return (base + (index>1 && r()<.28 ? ` ${index+1}` : '')).toUpperCase();
}
const atmosphereChemistries=['N2 / O2','O2 RICH','NITROGEN','N2 / CH4','CO2 RICH','CO2 / SO2','METHANE','SULFURIC','ARGON','WATER VAPOR','AMMONIA','H2 / HE','H2 / HE / CH4','HYDROGEN SULFIDE','CHLORINE','HE / NE','METALLIC VAPOR','EXOTIC'];
const WORLD_PROFILE_ORDER=['TERRESTRIAL','OCEAN','DESERT','ICE','BARREN','VOLCANIC','TOXIC','VERDANT','DWARF'];
const WORLD_PROFILES={
  TERRESTRIAL:{water:[.28,.64],target:[.34,.70],cloud:[.18,.58],atmos:['THIN','NORMAL','NORMAL','DENSE'],chem:['N2 / O2','O2 RICH','NITROGEN','ARGON','WATER VAPOR','N2 / CH4']},
  OCEAN:{water:[.76,.94],target:[.38,.70],cloud:[.40,.78],atmos:['NORMAL','DENSE','DENSE','SUPERDENSE'],chem:['N2 / O2','O2 RICH','NITROGEN','WATER VAPOR','N2 / CH4','AMMONIA']},
  DESERT:{water:[.01,.15],target:[.60,.84],cloud:[.02,.24],atmos:['TRACE','THIN','NORMAL','DENSE'],chem:['CO2 RICH','NITROGEN','ARGON','CO2 / SO2','CHLORINE','HE / NE']},
  ICE:{water:[.32,.72],target:[.05,.23],cloud:[.18,.55],atmos:['TRACE','THIN','NORMAL','DENSE'],chem:['NITROGEN','N2 / CH4','ARGON','CO2 RICH','AMMONIA','H2 / HE / CH4','HE / NE']},
  BARREN:{water:[0,.08],target:[.18,.72],cloud:[0,.10],atmos:['NONE','TRACE','TRACE','THIN'],chem:['ARGON','CO2 RICH','NITROGEN','HE / NE','METALLIC VAPOR']},
  VOLCANIC:{water:[0,.08],target:[.80,.97],cloud:[.16,.48],atmos:['THIN','DENSE','SUPERDENSE'],chem:['CO2 / SO2','SULFURIC','METALLIC VAPOR','CO2 RICH','HYDROGEN SULFIDE','CHLORINE']},
  TOXIC:{water:[.08,.38],target:[.48,.78],cloud:[.48,.86],atmos:['DENSE','DENSE','SUPERDENSE'],chem:['SULFURIC','CHLORINE','HYDROGEN SULFIDE','CO2 / SO2','EXOTIC','METALLIC VAPOR','N2 / CH4']},
  VERDANT:{water:[.38,.68],target:[.38,.64],cloud:[.28,.66],atmos:['NORMAL','NORMAL','DENSE'],chem:['N2 / O2','O2 RICH','WATER VAPOR','NITROGEN','N2 / CH4']},
  DWARF:{water:[0,.30],target:[.03,.28],cloud:[0,.15],atmos:['NONE','NONE','TRACE','TRACE','THIN'],chem:['NITROGEN','N2 / CH4','ARGON','CO2 RICH','METHANE']}
};
function rangePick(r,range){ return range[0]+r()*(range[1]-range[0]); }
function chooseWorldProfile(r){
  const q=r();
  if(q<.31)return 'TERRESTRIAL'; if(q<.45)return 'OCEAN'; if(q<.58)return 'DESERT'; if(q<.68)return 'ICE';
  if(q<.76)return 'BARREN'; if(q<.83)return 'VOLCANIC'; if(q<.89)return 'TOXIC'; if(q<.94)return 'VERDANT'; return 'DWARF';
}
const SPECIAL_WORLD_TYPES={ARRAKIS:'DESERT',HOTH:'ICE',BLOOD:'OCEAN',SINGULARITY:'BARREN',MAGRATHEA:'TERRESTRIAL','VERY PLANET':'TERRESTRIAL','CAT PLANET':'VERDANT','EVERYBODY CAT PLANET':'VERDANT'};
const urlParams=new URLSearchParams(window.location.search);
const urlPlanet=(urlParams.get('planet')||'').trim().slice(0,60).toUpperCase();
const urlTempC=Number.parseFloat(urlParams.get('temp')||'');

const locationParts={
  ice:['ICE CAPS','GLACIERS','TUNDRA','ARCTIC PLAINS'], sea:['OCEANS','DEEP SEAS','LAKES','WARM WATERS'],
  beach:['BEACHES','SAND DUNES','SHORES'], mount:['MOUNTAINS','ROCKY EXPANSES','MOUNTAIN PASSES','PEAKS'],
  grass:['FORESTS','FIELDS','GRASSLANDS','HIGHLANDS'], cloud:['SKIES','CLOUD LAYER','STRATOSPHERE'], underground:['CAVES','UNDERGROUND RIVERS','CRACKS IN THE GROUND']
};
const quant=['GROUPS OF','CLANS OF','A LARGE NUMBER OF','MANY','A FEW','SOME','A GROWING NUMBER OF'];
const build=['SKINNY','FAT','SHORT','TALL','THIN','HUGE','TINY','ENORMOUS','SMALL','BIZARRE','ELEGANT','SLIMY','DOCILE','FIERCE','INTELLIGENT','LAZY','AGILE','SLEEPY'];
const looks=['DULL','VIBRANT','SPOTTED','STRIPED','MOTTLED','DARK','LIGHT','GREY','MULTI-COLOURED','ORANGE','LIGHT BLUE','PALE','GLOWING','PINK','SILVER','GOLDEN'];
const creatures=['BEASTS','BIRDS','MAMMALS','MONSTERS','CRYSTALS','ALGAE','YETIS','SPORES','MICROBES','BUGS','INSECTS','REPTILES','BUTTERFLIES','DOLPHINS','TURTLES','SQUID-LIKE CREATURES','EELS','SHARKS','BLOBS','AMPHIBIANS','CRUSTACEANS','FISH','KRAKENS','DEER','GOATS','GOLEMS','GRIFFINS','RODENTS','FUNGI','ANTS','FROGS','BATS','WORMS','GOBLINS','BEETLES','TREES','SERPENTS','UNICORNS','DRAGONS','ELDERLINGS'];
const behaviours=['WAVING AT US','WATCHING US','LEADING THE OTHERS','DEEP IN THOUGHT','EXPLORING','DEVELOPING A LANGUAGE','PLAYING','FIGHTING','DANCING','SINGING'];

const SOLAR_ALIASES = {
  'SOL I':'MERCURY', 'SOL 1':'MERCURY',
  'SOL II':'VENUS', 'SOL 2':'VENUS',
  'TERRA':'EARTH', 'GAIA':'EARTH', 'SOL III':'EARTH', 'SOL 3':'EARTH',
  'SOL IV':'MARS', 'SOL 4':'MARS',
  'SOL V':'JUPITER', 'SOL 5':'JUPITER',
  'SOL VI':'SATURN', 'SOL 6':'SATURN',
  'SOL VII':'URANUS', 'SOL 7':'URANUS',
  'SOL VIII':'NEPTUNE', 'SOL 8':'NEPTUNE',
  'SOL IX':'PLUTO', 'SOL 9':'PLUTO'
};
const FICTIONAL_ALIASES={
  'AVATAR':'PANDORA','PANDORA (AVATAR)':'PANDORA','MOON OF PANDORA':'PANDORA','EYWA':'PANDORA',
  'ROCKY':'ERID','ROCKY PLANET':'ERID','PROJECT HAIL MARY':'ERID',
  'FOREST MOON OF ENDOR':'ENDOR','SAND BLAST':'ARRAKIS','DUNE':'ARRAKIS','RAKIS':'ARRAKIS',
  'GEIDI PRIME':'GIEDI PRIME','GIEDI PRIME':'GIEDI PRIME',
  'DEATHSTAR':'DEATH STAR','DEATH STAR 1':'DEATH STAR','DEATH STAR I':'DEATH STAR',
  'DEATH STAR 2':'DEATH STAR II','DEATH STAR TWO':'DEATH STAR II',
  'DEATH STAR 3':'DEATH STAR III','DEATH STAR THREE':'DEATH STAR III',
  'DS-1':'DEATH STAR','DS-2':'DEATH STAR II','DS-3':'DEATH STAR III',
  'WIKI':'WIKIPEDIA','WIKIPEDIA.ORG':'WIKIPEDIA','WIKIMEDIA':'WIKIPEDIA',
  'LAND OF OOO':'OOO','WORLD OF OOO':'OOO','ADVENTURE TIME':'OOO','ADVENTURE TIME WORLD':'OOO',
  'POLYPHEMUS MOON 3':'POLYPHEMUS III','POLYPHEMUS MOON III':'POLYPHEMUS III',
  'POLYPHEMUS MOON 4':'POLYPHEMUS IV','POLYPHEMUS MOON IV':'POLYPHEMUS IV',
  'POLYPHEMUS MOON 7':'POLYPHEMUS VII','POLYPHEMUS MOON VII':'POLYPHEMUS VII',
  'POLYPHEMUS MOON 8':'POLYPHEMUS VIII','POLYPHEMUS MOON VIII':'POLYPHEMUS VIII',
  'POLYPHEMUS MOON 9':'POLYPHEMUS IX','POLYPHEMUS MOON IX':'POLYPHEMUS IX',
  'POLYPHEMUS MOON 10':'POLYPHEMUS X','POLYPHEMUS MOON X':'POLYPHEMUS X',
  'POLYPHEMUS MOON 11':'POLYPHEMUS XI','POLYPHEMUS MOON XI':'POLYPHEMUS XI',
  'POLYPHEMUS MOON 13':'POLYPHEMUS XIII','POLYPHEMUS MOON XIII':'POLYPHEMUS XIII',
  'POLYPHEMUS MOON 14':'POLYPHEMUS XIV','POLYPHEMUS MOON XIV':'POLYPHEMUS XIV',
  'HALO':'ALPHA HALO','HALO CE':'ALPHA HALO','INSTALLATION 04':'ALPHA HALO','INSTALLATION 4':'ALPHA HALO','I04':'ALPHA HALO',
  'INSTALLATION 01':'BETA HALO','INSTALLATION 1':'BETA HALO','I01':'BETA HALO',
  'INSTALLATION 02':'EPSILON HALO','INSTALLATION 2':'EPSILON HALO','I02':'EPSILON HALO',
  'INSTALLATION 03':'GAMMA HALO','INSTALLATION 3':'GAMMA HALO','I03':'GAMMA HALO',
  'INSTALLATION 05':'DELTA HALO','INSTALLATION 5':'DELTA HALO','I05':'DELTA HALO','HALO 2':'DELTA HALO',
  'INSTALLATION 06':'KAPPA HALO','INSTALLATION 6':'KAPPA HALO','I06':'KAPPA HALO',
  'INSTALLATION 07':'ZETA HALO','INSTALLATION 7':'ZETA HALO','I07':'ZETA HALO','HALO INFINITE':'ZETA HALO'
};
function canonicalPlanetName(name){
  const upper=(name||'').trim().toUpperCase().slice(0,60) || 'PLANET';
  return FICTIONAL_ALIASES[upper] || SOLAR_ALIASES[upper] || upper;
}
function knownMoon(name,orbitKm,periodDays,radiusKm,visualOrbit,frame,size,scan={}){
  const {
    direction=1, kind=null, fixedPosition=null, displayLengthKm=null,
    objectClass=null, hoverLabel=null, visualRenderer=null, ...scanData
  }=scan||{};
  return {
    name,orbitKm,periodDays,radiusKm,visualOrbit,frame,size,direction,
    kind,fixedPosition,displayLengthKm,objectClass,hoverLabel,visualRenderer,
    scan:scanData
  };
}
const SOLAR_SYSTEM_PLANETS = {
  MERCURY:{
    renderer:'mercury', worldClass:'BARREN WORLD', visualRadius:34, radiusKm:2440, massEarth:.0553, gravity:.38,
    water:0, cloudCover:0, defaultTempC:167, tempRange:[-180,430], life:false, populationBase:0,
    dayHours:1407.6, yearDays:87.97, distanceAU:.387, axialTiltDeg:.034, rotationDirection:1,
    atmosDensity:'TRACE', atmosChemistry:'O / NA / H / HE', weather:'NO WEATHER',
    observation:'THE INNERMOST PLANET IS A SCORCHED, AIRLESS WORLD COVERED IN ANCIENT IMPACT CRATERS.',
    moons:[], ring:false,
    scan:{ageBy:4.5,pressureAtm:0,pressureText:'EXOSPHERE',magField:'WEAK',oxygen:0,nitrogen:0,co2:0,tectonics:'DORMANT',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'RICH',carbon:'TRACE',uranium:'COMMON',anomaly:'EXTREME SOLAR WEATHER',lossRisk:false}
  },
  VENUS:{
    renderer:'venus', worldClass:'GREENHOUSE WORLD', visualRadius:45, radiusKm:6052, massEarth:.815, gravity:.90,
    water:0, cloudCover:.92, cloudSpeed:.32, defaultTempC:467, tempRange:[300,520], life:false, populationBase:0,
    dayHours:5832.5, yearDays:224.7, distanceAU:.723, axialTiltDeg:177.36, rotationDirection:-1,
    atmosDensity:'SUPERDENSE', atmosChemistry:'CO2 / N2', weather:'SULFURIC ACID CLOUDS',
    observation:'A GLOBAL LAYER OF PALE SULFURIC-ACID CLOUDS HIDES A CRUSHINGLY HOT VOLCANIC SURFACE.',
    moons:[], ring:false,
    scan:{ageBy:4.5,pressureAtm:93,pressureText:'93 ATM',magField:'INDUCED',oxygen:0,nitrogen:3.5,co2:96.5,tectonics:'ACTIVE',volcanism:'HIGH',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'COMMON',carbon:'RICH',uranium:'TRACE',anomaly:'SURFACE HIDDEN BY ACID CLOUDS',lossRisk:false}
  },
  EARTH:{
    renderer:'earth', worldClass:'TERRESTRIAL WORLD', visualRadius:47, radiusKm:6371, massEarth:1, gravity:1,
    water:.71, cloudCover:.48, cloudSpeed:.22, defaultTempC:15, tempRange:[-80,120], life:true, lifeToleranceC:50, populationBase:8,
    dayHours:23.934, yearDays:365.25, distanceAU:1, axialTiltDeg:23.44, rotationDirection:1,
    atmosDensity:'NORMAL', atmosChemistry:'N2 / O2', weather:'RAIN / STORMS', hurricanePotential:true,
    observation:'THE BIRTHPLACE OF HUMANITY. BLUE OCEANS, ACTIVE WEATHER AND A DENSE BIOSPHERE COVER MUCH OF THE SURFACE.',
    moons:[knownMoon('MOON',384400,27.322,1737,79,4,.72,{tempBias:-35,gravity:.17,surface:'BASALT / DUST',atmosphere:'TRACE EXOSPHERE',waterIce:'RICH',activity:'DORMANT',anomaly:'WATER ICE IN POLAR SHADOWS',lossRisk:false})], ring:false,
    scan:{ageBy:4.5,pressureAtm:1,pressureText:'1 ATM',magField:'STRONG',oxygen:20.9,nitrogen:78.1,co2:.04,tectonics:'ACTIVE',volcanism:'MODERATE',oceanDepthKm:3.7,lifeTypePotential:'COMPLEX',techPotential:'EARLY SPACEFLIGHT',iron:'RICH',carbon:'ABUNDANT',uranium:'COMMON',anomaly:'ARTIFICIAL RADIO EMISSIONS DETECTED',lossRisk:false}
  },
  MARS:{
    renderer:'mars', worldClass:'DESERT WORLD', visualRadius:38, radiusKm:3390, massEarth:.107, gravity:.38,
    water:.06, cloudCover:.08, cloudSpeed:.12, defaultTempC:-63, tempRange:[-130,85], life:false, populationBase:0,
    dayHours:24.623, yearDays:686.98, distanceAU:1.524, axialTiltDeg:25.19, rotationDirection:1,
    atmosDensity:'THIN', atmosChemistry:'CO2 / N2 / AR', weather:'DUST STORMS',
    observation:'FOR ONE HUNDRED AND FIFTY YEARS HUMANS HAD THEIR EYES ON MARS. ITS COLD DESERTS STILL HOLD WATER ICE BENEATH THE DUST.',
    moons:[
      knownMoon('PHOBOS',9376,.3189,11,55,14,.55,{tempBias:-5,gravity:.001,surface:'DUST / ROCK',atmosphere:'NONE',waterIce:'TRACE',activity:'ORBIT DECAY',anomaly:'ORBIT DECAY DETECTED',lossRisk:false}),
      knownMoon('DEIMOS',23463,1.2624,6,72,15,.48,{tempBias:-8,gravity:.001,surface:'DUST / ROCK',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'NONE',lossRisk:false})
    ], ring:false,
    scan:{ageBy:4.6,pressureAtm:.006,pressureText:'0.006 ATM',magField:'REMANENT',oxygen:.13,nitrogen:1.9,co2:95.3,tectonics:'DORMANT',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'RICH',carbon:'COMMON',uranium:'COMMON',anomaly:'SUBSURFACE WATER ICE DETECTED',lossRisk:false}
  },
  JUPITER:{
    renderer:'jupiter', worldClass:'GAS GIANT', visualRadius:62, radiusKm:69911, massEarth:317.8, gravity:2.53,
    water:0, cloudCover:.72, cloudSpeed:.48, defaultTempC:-110, tempRange:[-180,-40], life:false, populationBase:0,
    dayHours:9.925, yearDays:4333, distanceAU:5.203, axialTiltDeg:3.13, rotationDirection:1,
    atmosDensity:'SUPERDENSE', atmosChemistry:'H2 / HE', weather:'JET STORMS',
    observation:'THE LARGEST PLANET IN THE SOLAR SYSTEM IS A DEEP, BANDED ATMOSPHERE WRAPPED AROUND AN ENORMOUS INTERIOR.',
    moons:[
      knownMoon('IO',421700,1.769,1822,77,1,.72,{tempBias:-20,gravity:.18,surface:'SULFUR / BASALT',atmosphere:'TRACE SO2',waterIce:'NONE',activity:'VOLCANIC',anomaly:'EXTREME VOLCANISM',lossRisk:false}),
      knownMoon('EUROPA',671100,3.551,1561,90,6,.70,{tempBias:-50,gravity:.13,surface:'WATER ICE / ROCK',atmosphere:'TRACE O2',waterIce:'ABUNDANT',activity:'TIDAL',anomaly:'SUBSURFACE OCEAN LIKELY',lossRisk:false}),
      knownMoon('GANYMEDE',1070400,7.155,2634,104,9,.80,{tempBias:-40,gravity:.15,surface:'ICE / ROCK',atmosphere:'TRACE O2',waterIce:'ABUNDANT',activity:'TECTONIC',anomaly:'INTRINSIC MAGNETIC FIELD',lossRisk:false}),
      knownMoon('CALLISTO',1882700,16.689,2410,119,12,.78,{tempBias:-30,gravity:.13,surface:'ICE / ROCK',atmosphere:'TRACE CO2 / O2',waterIce:'RICH',activity:'DORMANT',anomaly:'ANCIENT CRATERED SURFACE',lossRisk:false})
    ], ring:true, ringStyle:'DUST', ringMaterial:'DUST / ROCK', ringTilt:-.04, ringScale:1.38, ringFlatness:.12, ringColor:mixHex(C.brown,C.black,.18), ringAlpha:.24,
    scan:{ageBy:4.6,pressureAtm:.99,pressureText:'1 BAR REF',magField:'EXTREME',oxygen:0,nitrogen:0,co2:0,tectonics:'ATMOSPHERIC',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'RICH',carbon:'COMMON',uranium:'TRACE',anomaly:'GREAT RED SPOT - LONG-LIVED STORM',lossRisk:false}
  },
  SATURN:{
    renderer:'saturn', worldClass:'GAS GIANT', visualRadius:59, radiusKm:58232, massEarth:95.2, gravity:1.07,
    water:0, cloudCover:.58, cloudSpeed:.40, defaultTempC:-140, tempRange:[-200,-70], life:false, populationBase:0,
    dayHours:10.7, yearDays:10756, distanceAU:9.537, axialTiltDeg:26.73, rotationDirection:1,
    atmosDensity:'SUPERDENSE', atmosChemistry:'H2 / HE', weather:'JET STORMS',
    observation:'A PALE GAS GIANT SURROUNDED BY A VAST SYSTEM OF ICY RINGS.',
    moons:[
      knownMoon('ENCELADUS',238020,1.370,252,96,5,.58,{tempBias:-61,gravity:.01,surface:'WATER ICE',atmosphere:'TRACE H2O',waterIce:'ABUNDANT',activity:'CRYOVOLCANIC',anomaly:'WATER PLUMES DETECTED',lossRisk:false}),
      knownMoon('RHEA',527040,4.518,764,109,7,.65,{tempBias:-34,gravity:.03,surface:'ICE / ROCK',atmosphere:'TRACE O2 / CO2',waterIce:'ABUNDANT',activity:'DORMANT',anomaly:'NONE',lossRisk:false}),
      knownMoon('TITAN',1221860,15.945,2575,123,11,.82,{tempBias:-39,gravity:.14,surface:'ICE / HYDROCARBONS',atmosphere:'DENSE N2 / CH4',waterIce:'RICH',activity:'METHANE CYCLE',anomaly:'LIQUID HYDROCARBON LAKES',lossRisk:false}),
      knownMoon('IAPETUS',3560830,79.32,736,138,13,.64,{tempBias:-43,gravity:.02,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'DORMANT',anomaly:'TWO-TONE SURFACE',lossRisk:false})
    ], ring:true, ringStyle:'DENSE', ringMaterial:'ICE', ringTilt:-.08, ringScale:1.82, ringFlatness:.23, ringColor:mixHex(C.white,C.yellow,.18), ringAlpha:.94,
    scan:{ageBy:4.5,pressureAtm:.99,pressureText:'1 BAR REF',magField:'STRONG',oxygen:0,nitrogen:0,co2:0,tectonics:'ATMOSPHERIC',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'COMMON',carbon:'RICH',uranium:'TRACE',anomaly:'HEXAGONAL NORTH-POLAR STORM',lossRisk:false}
  },
  URANUS:{
    renderer:'uranus', worldClass:'ICE GIANT', visualRadius:52, radiusKm:25362, massEarth:14.5, gravity:.89,
    water:0, cloudCover:.35, cloudSpeed:.28, defaultTempC:-195, tempRange:[-240,-130], life:false, populationBase:0,
    dayHours:17.24, yearDays:30687, distanceAU:19.191, axialTiltDeg:97.77, rotationDirection:-1,
    atmosDensity:'SUPERDENSE', atmosChemistry:'H2 / HE / CH4', weather:'METHANE CLOUDS',
    observation:'A PALE CYAN ICE GIANT ROTATING ALMOST ON ITS SIDE, ENCIRCLED BY A FAINT DARK RING SYSTEM.',
    moons:[
      knownMoon('MIRANDA',129900,1.413,236,70,2,.56,{tempBias:-18,gravity:.01,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'TECTONIC',anomaly:'EXTREME CLIFFS',lossRisk:false}),
      knownMoon('ARIEL',190900,2.520,579,82,4,.62,{tempBias:-18,gravity:.03,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'ABUNDANT',activity:'TECTONIC',anomaly:'YOUNG FRACTURED TERRAIN',lossRisk:false}),
      knownMoon('UMBRIEL',265969,4.144,585,94,8,.62,{tempBias:-19,gravity:.03,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'DORMANT',anomaly:'DARK ANCIENT SURFACE',lossRisk:false}),
      knownMoon('TITANIA',436300,8.706,789,106,10,.68,{tempBias:-8,gravity:.04,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'TECTONIC',anomaly:'CANYON NETWORKS',lossRisk:false}),
      knownMoon('OBERON',583400,13.463,761,120,12,.67,{tempBias:-9,gravity:.04,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'DORMANT',anomaly:'ANCIENT CRATERED TERRAIN',lossRisk:false})
    ], ring:true, ringStyle:'DARK', ringMaterial:'ROCK', ringTilt:1.28, ringScale:1.52, ringFlatness:.16, ringColor:mixHex(C.brown,C.black,.30), ringAlpha:.62,
    scan:{ageBy:4.5,pressureAtm:.99,pressureText:'1 BAR REF',magField:'STRONG',oxygen:0,nitrogen:0,co2:0,tectonics:'ATMOSPHERIC',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'COMMON',carbon:'RICH',uranium:'TRACE',anomaly:'EXTREME AXIAL TILT',lossRisk:false}
  },
  NEPTUNE:{
    renderer:'neptune', worldClass:'ICE GIANT', visualRadius:51, radiusKm:24622, massEarth:17.1, gravity:1.14,
    water:0, cloudCover:.48, cloudSpeed:.46, defaultTempC:-200, tempRange:[-240,-140], life:false, populationBase:0,
    dayHours:16.11, yearDays:60190, distanceAU:30.07, axialTiltDeg:28.32, rotationDirection:1,
    atmosDensity:'SUPERDENSE', atmosChemistry:'H2 / HE / CH4', weather:'SUPERSONIC STORMS',
    observation:'A DEEP BLUE ICE GIANT WITH THE FASTEST WINDS IN THE SOLAR SYSTEM.',
    moons:[
      knownMoon('PROTEUS',117647,1.122,210,68,3,.54,{tempBias:-22,gravity:.01,surface:'DARK ROCK / ICE',atmosphere:'NONE',waterIce:'RICH',activity:'DORMANT',anomaly:'IRREGULAR CRATERED SHAPE',lossRisk:false}),
      knownMoon('TRITON',354759,5.877,1353,84,6,.73,{direction:-1,tempBias:-35,gravity:.08,surface:'N2 ICE / ROCK',atmosphere:'TRACE N2',waterIce:'ABUNDANT',activity:'CRYOVOLCANIC',anomaly:'NITROGEN GEYSERS',lossRisk:false}),
      knownMoon('NEREID',5509090,360.14,170,103,16,.52,{tempBias:-20,gravity:.01,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'DORMANT',anomaly:'HIGHLY ECCENTRIC ORBIT',lossRisk:false})
    ], ring:true, ringStyle:'SPARSE', ringMaterial:'DUST / ICE', ringTilt:.12, ringScale:1.46, ringFlatness:.18, ringColor:C.blue, ringAlpha:.42,
    scan:{ageBy:4.5,pressureAtm:.99,pressureText:'1 BAR REF',magField:'STRONG',oxygen:0,nitrogen:0,co2:0,tectonics:'ATMOSPHERIC',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'COMMON',carbon:'RICH',uranium:'TRACE',anomaly:'SUPERSONIC WINDS AND DARK STORMS',lossRisk:false}
  },
  PLUTO:{
    renderer:'pluto', worldClass:'DWARF PLANET', visualRadius:28, radiusKm:1188, massEarth:.00218, gravity:.063,
    water:0, cloudCover:0, cloudSpeed:.04, defaultTempC:-229, tempRange:[-245,-150], life:false, populationBase:0,
    dayHours:153.3, yearDays:90560, distanceAU:39.48, axialTiltDeg:119.59, rotationDirection:-1,
    atmosDensity:'TRACE', atmosChemistry:'N2 / CH4 / CO', weather:'NITROGEN FROSTS',
    observation:'A COLD DWARF PLANET WITH A BRIGHT HEART-SHAPED NITROGEN-ICE BASIN AND FIVE KNOWN MOONS.',
    moons:[
      knownMoon('CHARON',19640,6.387,606,50,9,.66,{direction:-1,tempBias:-18,gravity:.029,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'ABUNDANT',activity:'DORMANT',anomaly:'RED POLAR CAP AND CANYONED ICE PLAINS',lossRisk:false}),
      knownMoon('STYX',42700,20.2,8,63,16,.40,{tempBias:-22,gravity:.001,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'CHAOTIC ROTATION',anomaly:'NONE',lossRisk:false}),
      knownMoon('NIX',48700,24.9,19,74,17,.44,{tempBias:-20,gravity:.001,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'CHAOTIC ROTATION',anomaly:'REDDISH IMPACT REGION',lossRisk:false}),
      knownMoon('KERBEROS',57800,32.2,6,86,15,.38,{tempBias:-21,gravity:.001,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'CHAOTIC ROTATION',anomaly:'DOUBLE-LOBED SHAPE',lossRisk:false}),
      knownMoon('HYDRA',64800,38.2,24,98,18,.46,{tempBias:-20,gravity:.001,surface:'WATER ICE',atmosphere:'NONE',waterIce:'ABUNDANT',activity:'CHAOTIC ROTATION',anomaly:'HIGHLY REFLECTIVE WATER ICE',lossRisk:false})
    ], ring:false,
    scan:{ageBy:4.5,pressureAtm:0.00001,pressureText:'TRACE',magField:'WEAK',oxygen:0,nitrogen:97.5,co2:0,tectonics:'ACTIVE ICE',volcanism:'CRYOVOLCANIC?',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'TRACE',carbon:'COMMON',uranium:'TRACE',anomaly:'SPUTNIK PLANITIA - NITROGEN ICE BASIN',lossRisk:false}
  }};
const AVATAR_POLYPHEMUS_MOONS=[
  knownMoon('DANTE',150000,1.35,860,74,6,.50,{surface:'SULFUR / BASALT',atmosphere:'TRACE CO2 / SO2',waterIce:'TRACE',activity:'VOLCANIC',anomaly:'TIDAL HEATING / LAVA PLAINS',lossRisk:false}),
  knownMoon('HADES',205000,2.10,1280,82,7,.54,{surface:'BASALT / ROCK',atmosphere:'THIN N2 / CO2',waterIce:'TRACE',activity:'TECTONIC',anomaly:'HEAVY IMPACT BASINS',lossRisk:false}),
  knownMoon('POLYPHEMUS III',278000,3.12,3420,91,3,.73,{surface:'WATER / ROCK / ICE',atmosphere:'THIN N2 / CO2',waterIce:'ABUNDANT',activity:'TECTONIC',anomaly:'GLOBAL OCEAN / NO BIOSIGNATURES',lossRisk:false}),
  knownMoon('POLYPHEMUS IV',362000,4.08,3540,100,2,.75,{surface:'ICE / OCEAN / ROCK',atmosphere:'THIN N2 / CO2',waterIce:'ABUNDANT',activity:'CRYOVOLCANIC',anomaly:'SUBSURFACE OCEAN',lossRisk:false}),
  knownMoon('PANDORA',455000,5.32,2890,110,4,.78,{surface:'WATER / FOREST / ROCK',atmosphere:'N2 / O2 / CO2',waterIce:'COMMON',activity:'VOLCANIC / MAGNETIC',anomaly:'GLOBAL BIOSPHERE / UNOBTANIUM FLUX',lossRisk:false}),
  knownMoon('CASSANDRA',548000,6.74,3320,120,3,.76,{surface:'OCEAN / FOREST / ROCK',atmosphere:'N2 / O2 / CO2',waterIce:'COMMON',activity:'TECTONIC',anomaly:'CARBON-CYCLE BIOSIGNATURES',lossRisk:false}),
  knownMoon('POLYPHEMUS VII',665000,8.45,2680,131,5,.68,{surface:'WATER / ICE / ROCK',atmosphere:'THIN N2 / CO2',waterIce:'ABUNDANT',activity:'CRYOVOLCANIC',anomaly:'OCEAN WORLD / NO COMPLEX LIFE',lossRisk:false}),
  knownMoon('POLYPHEMUS VIII',785000,10.6,2180,142,5,.64,{surface:'ICE / ROCK',atmosphere:'TRACE N2',waterIce:'ABUNDANT',activity:'DORMANT',anomaly:'FRACTURED ICE SHELL',lossRisk:false}),
  knownMoon('POLYPHEMUS IX',925000,13.1,1620,153,7,.58,{surface:'ROCK / DUST',atmosphere:'TRACE',waterIce:'COMMON',activity:'DORMANT',anomaly:'ANCIENT IMPACT TERRAIN',lossRisk:false}),
  knownMoon('POLYPHEMUS X',1080000,16.0,2520,164,4,.66,{surface:'WATER / ICE / ROCK',atmosphere:'THIN N2 / CO2',waterIce:'ABUNDANT',activity:'TECTONIC',anomaly:'CLOUD-COVERED OCEAN BASINS',lossRisk:false}),
  knownMoon('POLYPHEMUS XI',1280000,20.2,1880,176,5,.60,{surface:'ICE / ROCK',atmosphere:'TRACE CH4 / N2',waterIce:'ABUNDANT',activity:'DORMANT',anomaly:'METHANE FROST',lossRisk:false}),
  knownMoon('CHAOS',1510000,25.8,1160,188,8,.54,{surface:'CARBON-RICH ROCK / ICE',atmosphere:'TRACE CH4',waterIce:'RICH',activity:'CHAOTIC ROTATION',anomaly:'DARK CHAOTIC TERRAIN',lossRisk:false}),
  knownMoon('POLYPHEMUS XIII',1780000,32.6,690,200,11,.48,{direction:-1,surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'RETROGRADE ORBIT',anomaly:'OUTER RETROGRADE MOON',lossRisk:false}),
  knownMoon('POLYPHEMUS XIV',2110000,41.9,510,212,12,.44,{direction:-1,surface:'DARK ROCK / ICE',atmosphere:'NONE',waterIce:'COMMON',activity:'RETROGRADE ORBIT',anomaly:'DISTANT RETROGRADE MOON',lossRisk:false})
];
function avatarSisterPreset({worldType='BARREN',worldClass='LUNAR SISTER',radiusKm=1800,gravity=.22,water=.08,cloudCover=.08,temp=-70,atmos='TRACE',chem='N2 / CO2',weather='COLD HAZE',life=false,lifeType='NONE',surface='ROCK / ICE',observation,anomaly,retrograde=false}){
  const radiusEarth=radiusKm/6371;
  return {
    worldType,worldClass,visualRadius:Math.round(clamp(25+radiusKm/180,28,43)),radiusKm,gravity,
    massEarth:Math.max(.002,gravity*radiusEarth*radiusEarth),density:Math.max(.2,gravity/Math.max(.03,radiusEarth)),
    water,cloudCover,cloudSpeed:.08,defaultTempC:temp,tempRange:[temp-80,temp+80],life,populationBase:life?3:0,
    dayHours:retrograde?72:32,yearDays:440,distanceAU:4.37,axialTiltDeg:12,rotationDirection:retrograde?-1:1,
    atmosDensity:atmos,atmosChemistry:chem,weather,ring:false,moons:[],
    observation,
    scan:{ageBy:4.4,pressureAtm:atmos==='NONE'?0:atmos==='TRACE'?.01:atmos==='THIN'?.22:.82,pressureText:atmos==='NONE'?'VACUUM':atmos,magField:'POLYPHEMUS-DRIVEN',oxygen:life?16:0,nitrogen:chem.includes('N2')?72:0,co2:chem.includes('CO2')?(life?8:80):0,tectonics:surface.includes('VOLCANIC')?'ACTIVE':'LOW',volcanism:surface.includes('VOLCANIC')?'HIGH':'LOW',oceanDepthKm:water>.5?3.2:0,lifeTypePotential:lifeType,techPotential:'NONE',iron:'COMMON',carbon:'COMMON',uranium:'TRACE',anomaly,lossRisk:false}
  };
}
const AVATAR_SISTER_PRESETS={
  DANTE:avatarSisterPreset({worldType:'VOLCANIC',worldClass:'VOLCANIC MOON',radiusKm:860,gravity:.11,water:.01,cloudCover:.12,temp:165,atmos:'TRACE',chem:'CO2 / SO2',weather:'ASH / LAVA HAZE',surface:'VOLCANIC BASALT',observation:'THE INNERMOST KNOWN MOON OF POLYPHEMUS, SCORCHED BY TIDAL HEATING AND ACTIVE VOLCANISM.',anomaly:'EXTREME TIDAL HEATING'}),
  HADES:avatarSisterPreset({worldType:'BARREN',worldClass:'ROCKY MOON',radiusKm:1280,gravity:.16,water:.03,cloudCover:.05,temp:42,atmos:'THIN',chem:'N2 / CO2',weather:'DUST HAZE',surface:'BASALT / ROCK',observation:'THE SECOND MOON OF POLYPHEMUS, A DARK ROCKY WORLD WITH A THIN ATMOSPHERE AND OLD IMPACT BASINS.',anomaly:'HEAVY IMPACT TERRAIN'}),
  'POLYPHEMUS III':avatarSisterPreset({worldType:'OCEAN',worldClass:'OCEANIC MOON',radiusKm:3420,gravity:.66,water:.78,cloudCover:.48,temp:9,atmos:'THIN',chem:'N2 / CO2',weather:'COLD OCEAN CLOUDS',surface:'WATER / ROCK / ICE',observation:'AN UNNAMED LARGE LUNAR SISTER OF PANDORA WITH OCEANS, CLOUDS AND A THIN NITROGEN-CARBON-DIOXIDE ATMOSPHERE. NO CONFIRMED LIFE IS DETECTED.',anomaly:'GLOBAL OCEAN / NO BIOSIGNATURES'}),
  'POLYPHEMUS IV':avatarSisterPreset({worldType:'ICE',worldClass:'ICY OCEAN MOON',radiusKm:3540,gravity:.72,water:.64,cloudCover:.36,temp:-18,atmos:'THIN',chem:'N2 / CO2',weather:'ICE CLOUDS',surface:'ICE / OCEAN / ROCK',observation:'AN UNNAMED LARGE MOON OF POLYPHEMUS WITH A THICK ICE SHELL, OPEN WATER BASINS AND A THIN ATMOSPHERE.',anomaly:'SUBSURFACE OCEAN'}),
  CASSANDRA:avatarSisterPreset({worldType:'VERDANT',worldClass:'LIFE-BEARING MOON',radiusKm:3320,gravity:.78,water:.61,cloudCover:.54,temp:22,atmos:'NORMAL',chem:'N2 / O2 / CO2',weather:'RAIN / MAGNETIC STORMS',life:true,lifeType:'COMPLEX',surface:'OCEAN / FOREST / ROCK',observation:'PANDORA\'S KNOWN SISTER MOON. ITS NITROGEN-OXYGEN ATMOSPHERE AND CARBON-CYCLE BIOSIGNATURES SUGGEST A LIVING WORLD.',anomaly:'CARBON-CYCLE BIOSPHERE'}),
  'POLYPHEMUS VII':avatarSisterPreset({worldType:'OCEAN',worldClass:'OCEAN MOON',radiusKm:2680,gravity:.48,water:.83,cloudCover:.44,temp:-4,atmos:'THIN',chem:'N2 / CO2',weather:'COLD RAIN / ICE',surface:'WATER / ICE / ROCK',observation:'AN UNNAMED WATER-RICH MOON OF POLYPHEMUS WITH BROAD OCEANS AND A THIN ATMOSPHERE. NO COMPLEX BIOSPHERE IS CONFIRMED.',anomaly:'OCEAN BASINS / NO COMPLEX LIFE'}),
  'POLYPHEMUS VIII':avatarSisterPreset({worldType:'ICE',worldClass:'ICE MOON',radiusKm:2180,gravity:.34,water:.46,cloudCover:.18,temp:-71,atmos:'TRACE',chem:'N2',weather:'ICE HAZE',surface:'ICE / ROCK',observation:'AN UNNAMED FROZEN LUNAR SISTER WITH A FRACTURED ICE SHELL AND TRACE NITROGEN.',anomaly:'FRACTURED ICE SHELL'}),
  'POLYPHEMUS IX':avatarSisterPreset({worldType:'BARREN',worldClass:'BARREN MOON',radiusKm:1620,gravity:.24,water:.11,cloudCover:.04,temp:-88,atmos:'TRACE',chem:'N2 / CO2',weather:'NO WEATHER',surface:'ROCK / DUST',observation:'AN UNNAMED ROCKY MOON OF POLYPHEMUS COVERED IN ANCIENT IMPACT TERRAIN.',anomaly:'ANCIENT IMPACT BASINS'}),
  'POLYPHEMUS X':avatarSisterPreset({worldType:'OCEAN',worldClass:'CLOUDY OCEAN MOON',radiusKm:2520,gravity:.43,water:.72,cloudCover:.57,temp:-21,atmos:'THIN',chem:'N2 / CO2',weather:'COLD CLOUD DECKS',surface:'WATER / ICE / ROCK',observation:'AN UNNAMED CLOUD-COVERED LUNAR SISTER WITH LARGE WATER BASINS AND A THIN ATMOSPHERE.',anomaly:'CLOUD-COVERED OCEAN BASINS'}),
  'POLYPHEMUS XI':avatarSisterPreset({worldType:'ICE',worldClass:'METHANE ICE MOON',radiusKm:1880,gravity:.28,water:.34,cloudCover:.15,temp:-102,atmos:'TRACE',chem:'N2 / CH4',weather:'METHANE FROST',surface:'ICE / ROCK',observation:'AN UNNAMED COLD MOON WITH WATER ICE, METHANE FROST AND A VERY THIN ATMOSPHERE.',anomaly:'METHANE FROST FIELDS'}),
  CHAOS:avatarSisterPreset({worldType:'BARREN',worldClass:'CHAOTIC OUTER MOON',radiusKm:1160,gravity:.14,water:.18,cloudCover:.03,temp:-125,atmos:'TRACE',chem:'N2 / CH4',weather:'NO WEATHER',surface:'CARBON-RICH ROCK / ICE',observation:'CHAOS ORBITS FAR BEYOND PANDORA AND CASSANDRA. ITS DARK, ICE-RICH SURFACE AND UNSTABLE ROTATION GIVE THE MOON ITS NAME.',anomaly:'CHAOTIC ROTATION'}),
  'POLYPHEMUS XIII':avatarSisterPreset({worldType:'DWARF',worldClass:'RETROGRADE OUTER MOON',radiusKm:690,gravity:.07,water:.18,cloudCover:0,temp:-143,atmos:'NONE',chem:'NONE',weather:'NO WEATHER',surface:'ICE / ROCK',observation:'ONE OF POLYPHEMUS\' DISTANT UNNAMED OUTER MOONS, MOVING IN A RETROGRADE ORBIT.',anomaly:'RETROGRADE ORBIT',retrograde:true}),
  'POLYPHEMUS XIV':avatarSisterPreset({worldType:'DWARF',worldClass:'RETROGRADE OUTER MOON',radiusKm:510,gravity:.04,water:.12,cloudCover:0,temp:-151,atmos:'NONE',chem:'NONE',weather:'NO WEATHER',surface:'DARK ROCK / ICE',observation:'THE OUTERMOST DESIGNATED LUNAR SISTER IN THIS CHART, A SMALL DARK BODY ON A RETROGRADE ORBIT.',anomaly:'DISTANT RETROGRADE ORBIT',retrograde:true})
};
function haloInstallationPreset({
  worldClass='FORERUNNER HALO',style='temperate',temp=14,water=.42,cloud=.28,life=true,
  monitor='UNKNOWN',status='INTACT',biome='CURATED TERRAIN',anomaly='FORERUNNER SUPERWEAPON SIGNATURE',
  gaps=[],glassed=false,population='SPARSE',lifeType='CURATED',observation='',loreReport=''
}={}){
  return {
    shape:'haloRing',worldType:style==='desert'?'DESERT':style==='ice'?'ICE':'VERDANT',worldClass,renderer:'halo',
    visualRadius:65,radiusKm:5000,gravity:.99,massEarth:.02,density:.01,
    water,cloudCover:cloud,cloudSpeed:.12,defaultTempC:temp,tempRange:[-23,40],life,populationBase:life?4:0,
    dayHours:19.2,yearDays:365,distanceAU:0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:life?'NORMAL':'TRACE',atmosChemistry:'N2 / O2',weather:cloud>.4?'CONTROLLED STORMS':'CONTROLLED WEATHER',ring:false,disableAutoCivilization:true,
    haloBandWidth:13,haloFlatten:.30,haloScreenAngle:-.18,haloSurfaceWidthKm:318,haloStyle:style,haloMonitor:monitor,haloStatus:status,haloBiome:biome,
    haloGaps:gaps.map(g=>({...g})),haloGlassed:!!glassed,
    observation,
    scan:{ageBy:.097,pressureAtm:life?1:.02,pressureText:life?'1.0 ATM':'TRACE',magField:'ARTIFICIAL',oxygen:life?20.9:0,nitrogen:life?78.1:0,co2:life?.04:0,tectonics:'ARTIFICIAL',volcanism:'CONTROLLED',oceanDepthKm:water>0?1.8:0,lifeTypePotential:lifeType,techPotential:'FORERUNNER',iron:'ABUNDANT',carbon:'COMMON',uranium:'TRACE',anomaly,lossRisk:false},
    loreReport,lifeLabel:life?'CURATED':'NONE',populationLabel:life?population:'NONE',lifeTypeLabel:life?lifeType:'NONE',techLevelLabel:'FORERUNNER'
  };
}
const HALO_INSTALLATIONS={
  'BETA HALO':haloInstallationPreset({style:'desert',temp:26,water:.06,cloud:.10,monitor:'001 SHAMED INSTRUMENT',status:'INTACT / DEACTIVATED',biome:'DESERT / FORERUNNER FACILITIES',population:'SPARSE',
    anomaly:'HALO ARRAY WEAPON GRID / FLOOD CONTAINMENT',observation:'INSTALLATION 01 — BETA HALO. A 10,000 KM FORERUNNER RINGWORLD WITH A BROAD DESERT-LIKE INTERIOR AND LIMITED WEATHER.',
    loreReport:'BETA HALO IS AN INTACT MEMBER OF THE SEVEN-RING HALO ARRAY. ITS INTERIOR IS DOMINATED BY DESERT TERRAIN, FORERUNNER STRUCTURES AND CONTAINMENT FACILITIES UNDER THE CARE OF 001 SHAMED INSTRUMENT.'}),
  'EPSILON HALO':haloInstallationPreset({style:'oceanice',temp:-4,water:.72,cloud:.46,monitor:'007 CONTRITE WITNESS',status:'INTACT / DEACTIVATED',biome:'OCEANS / ROCK / ICE FLOES',population:'SPARSE',
    anomaly:'HALO ARRAY WEAPON GRID / OCEANIC BIOSPHERE',observation:'INSTALLATION 02 — EPSILON HALO. AN INTACT FORERUNNER RINGWORLD OF OCEANS, ROCKY OUTCROPS AND LARGE ICE FLOES.',
    loreReport:'EPSILON HALO PRESERVES A COLD OCEANIC ENVIRONMENT ACROSS ITS INNER SURFACE. ROCKY ISLANDS AND ICE FLOES INTERRUPT THE WATER WHILE FORERUNNER INFRASTRUCTURE RUNS BENEATH THE ARTIFICIAL LANDSCAPE.'}),
  'GAMMA HALO':haloInstallationPreset({style:'mixed',temp:18,water:.31,cloud:.31,monitor:'049 ABJECT TESTAMENT',status:'MAJOR SURFACE DAMAGE',biome:'DESERT / JUNGLE / VOLCANIC',population:'TRACE',gaps:[{at:.71,size:.025}],
    anomaly:'DAMAGED CONTROL COMPLEX / FORERUNNER WEAPON GRID',observation:'INSTALLATION 03 — GAMMA HALO. DESERTS, JUNGLES AND VOLCANIC REGIONS SHARE A RING THAT HAS SUFFERED MAJOR SURFACE DAMAGE.',
    loreReport:'GAMMA HALO REMAINS STRUCTURALLY RECOGNIZABLE BUT ITS SURFACE HAS BEEN BADLY DAMAGED. FORERUNNER FACILITIES, MIXED BIOMES AND THE SCARS AROUND ITS FORMER CONTROL COMPLEX REMAIN DETECTABLE.'}),
  'ALPHA HALO':haloInstallationPreset({style:'temperate',temp:15,water:.46,cloud:.34,life:false,monitor:'343 GUILTY SPARK',status:'DESTROYED',biome:'FORMER TEMPERATE BIOSPHERE',population:'NONE',lifeType:'NONE',
    gaps:[{at:.06,size:.13},{at:.31,size:.055},{at:.58,size:.095},{at:.82,size:.07}],anomaly:'CATASTROPHIC REACTOR DETONATION / HALO DEBRIS',
    observation:'INSTALLATION 04 — ALPHA HALO. THE FIRST HALO ENCOUNTERED BY HUMANITY IS NOW A BROKEN ARC OF FORERUNNER SUPERSTRUCTURE AND DEAD LANDSCAPE.',
    loreReport:'ALPHA HALO WAS DESTROYED IN 2552. ONLY BROKEN RING SEGMENTS, EXPOSED SUPERSTRUCTURE AND QUARANTINED WRECKAGE REMAIN OF THE ONCE-TEMPERATE INSTALLATION.'}),
  'DELTA HALO':haloInstallationPreset({style:'jungle',temp:22,water:.38,cloud:.52,monitor:'2401 PENITENT TANGENT',status:'PARTIALLY GLASSED / DEACTIVATED',biome:'JUNGLE / DESERT / GLASSED ZONES',population:'TRACE',glassed:true,
    anomaly:'FLOOD CONTAINMENT / GLASSED SURFACE SECTORS',observation:'INSTALLATION 05 — DELTA HALO. DENSE JUNGLES AND FORERUNNER COMPLEXES ARE INTERRUPTED BY LARGE GLASSED REGIONS LEFT BY BATTLE.',
    loreReport:'DELTA HALO STILL CARRIES JUNGLE, DESERT AND FORERUNNER FACILITY ZONES, BUT PARTS OF ITS SURFACE WERE GLASSED DURING THE BATTLE TO CONTAIN THE FLOOD OUTBREAK.'}),
  'KAPPA HALO':haloInstallationPreset({style:'tundra',temp:-8,water:.36,cloud:.36,monitor:'16807 ABASHED EULOGY',status:'INTACT / DEACTIVATED',biome:'TUNDRA / FOREST',population:'SPARSE',
    anomaly:'HALO ARRAY WEAPON GRID / PRESERVED ECOLOGY',observation:'INSTALLATION 06 — KAPPA HALO. AN INTACT FORERUNNER RINGWORLD COVERED IN TUNDRA, FORESTS AND COLD CURATED WILDERNESS.',
    loreReport:'KAPPA HALO IS ONE OF THE ARRAY’S INTACT RINGS. COLD TUNDRA AND FOREST BIOMES SPREAD ACROSS ITS INNER SURFACE ABOVE DEEP FORERUNNER MACHINE LAYERS.'}),
  'ZETA HALO':haloInstallationPreset({style:'zeta',temp:12,water:.44,cloud:.38,monitor:'ADJUTANT RESOLUTION',status:'DAMAGED / BANISHED OCCUPATION',biome:'FOREST / MOUNTAIN / FORERUNNER RUINS',population:'MANY',lifeType:'MIXED',gaps:[{at:.12,size:.095},{at:.49,size:.045},{at:.76,size:.025}],
    anomaly:'SUNDERED RING / BANISHED CONTROL / ANCIENT FORERUNNER SECRETS',observation:'INSTALLATION 07 — ZETA HALO. A DAMAGED, PARTLY SUNDERED RINGWORLD OF MOUNTAINS, FORESTS, FORERUNNER RUINS AND ACTIVE CONFLICT.',
    loreReport:'ZETA HALO IS DAMAGED AND PARTLY SUNDERED, WITH SURVIVING LANDSCAPE FRAGMENTS SEPARATED BY BROKEN SECTIONS OF RING. BANISHED OCCUPATION, UNSC ACTIVITY AND ANCIENT FORERUNNER STRUCTURES ARE ALL DETECTABLE ACROSS THE INSTALLATION.'})
};
const LORE_PRESETS={
  ...HALO_INSTALLATIONS,
  ...AVATAR_SISTER_PRESETS,
  WIKIPEDIA:{
    worldType:'BARREN',worldClass:'ENCYCLOPEDIC WORLD',renderer:'wikipedia',visualRadius:39,radiusKm:4600,gravity:.58,massEarth:.31,density:.80,
    water:0,cloudCover:.08,cloudSpeed:.06,defaultTempC:20,tempRange:[-20,55],life:true,populationBase:8,
    dayHours:24,yearDays:365,distanceAU:1,axialTiltDeg:23,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / O2',weather:'EDIT CLOUDS',ring:false,disableAutoCivilization:true,
    observation:'A PALE PUZZLE-GLOBE WORLD COVERED IN INTERLOCKING KNOWLEDGE PANELS, GLYPHS AND CONSTANTLY CHANGING ARTICLE DISTRICTS.',
    moons:[
      knownMoon('WIKTIONARY',42000,1.7,92,55,15,.38,{tempBias:-10,gravity:.003,surface:'LEXICON PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'EDITING',anomaly:'MULTILINGUAL DICTIONARY INDEX',lossRisk:false}),
      knownMoon('WIKIBOOKS',54000,2.6,108,65,14,.40,{tempBias:-12,gravity:.004,surface:'TEXTBOOK PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'EDITING',anomaly:'OPEN TEXTBOOK ARCHIVE',lossRisk:false}),
      knownMoon('WIKIQUOTE',67500,3.8,76,75,15,.35,{tempBias:-14,gravity:.002,surface:'QUOTE PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'EDITING',anomaly:'SOURCED QUOTATION ARCHIVE',lossRisk:false}),
      knownMoon('WIKISOURCE',83000,5.3,118,86,14,.42,{tempBias:-16,gravity:.004,surface:'DOCUMENT PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'ARCHIVING',anomaly:'PRIMARY SOURCE VAULTS',lossRisk:false}),
      knownMoon('WIKISPECIES',99000,7.1,69,97,15,.34,{tempBias:-18,gravity:.002,surface:'TAXONOMY PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'CATALOGUING',anomaly:'SPECIES DIRECTORY',lossRisk:false}),
      knownMoon('WIKIVOYAGE',118000,9.5,96,108,14,.38,{tempBias:-20,gravity:.003,surface:'MAP PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'MAPPING',anomaly:'TRAVEL GUIDE NETWORK',lossRisk:false}),
      knownMoon('WIKIDATA',141000,12.4,132,120,13,.44,{tempBias:-22,gravity:.005,surface:'DATA PANELS',atmosphere:'NONE',waterIce:'NONE',activity:'INDEXING',anomaly:'STRUCTURED DATA CORE',lossRisk:false})
    ],
    scan:{ageBy:.25,pressureAtm:.72,pressureText:'0.72 ATM',magField:'MODERATE',oxygen:20,nitrogen:78,co2:.04,tectonics:'CONTINUOUS EDITS',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'MISSING PUZZLE SEGMENT / GLOBAL EDIT HISTORY',lossRisk:false},
    loreReport:'THE SURFACE IS DIVIDED INTO BILLIONS OF INTERLOCKING KNOWLEDGE DISTRICTS MAINTAINED BY VAST NUMBERS OF EDITORS. SEVEN SMALL SISTER-PROJECT MOONS ORBIT THE GLOBE, EACH SPECIALIZED IN WORDS, BOOKS, QUOTATIONS, SOURCE TEXTS, SPECIES, TRAVEL OR STRUCTURED DATA.',
    lifeLabel:'ABUNDANT',populationLabel:'MASSIVE',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'INTERSTELLAR'
  },
  OOO:{
    worldType:'VERDANT',worldClass:'POST-CATACLYSM WORLD',renderer:'ooo',visualRadius:43,radiusKm:5920,gravity:.94,massEarth:.88,density:1.01,
    water:.57,cloudCover:.66,cloudSpeed:.14,defaultTempC:17,tempRange:[-18,36],life:true,populationBase:6,
    dayHours:24.8,yearDays:394,distanceAU:1.08,axialTiltDeg:19,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'PATCHY STORMS / SWEET BREEZES',ring:false,moons:[],
    damage:{type:'BITE',angle:0,severity:.82,seed:0x00a0f00d},
    observation:'A STRANGE BLUE-GREEN WORLD OF CARTOONISH SEAS, KINGDOMS, RUINS AND A GREAT BITE-SHAPED SCAR REMOVED FROM ONE SIDE OF THE GLOBE.',
    scan:{ageBy:1.1,pressureAtm:1.02,pressureText:'1.02 ATM',magField:'MODERATE',oxygen:20.4,nitrogen:78.2,co2:.06,tectonics:'PATCHY',volcanism:'LOW',oceanDepthKm:2.8,lifeTypePotential:'INTELLIGENT',techPotential:'PATCHWORK / LOST HIGH TECH',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'MUTAGENIC RUINS / MAGIC SIGNATURES',lossRisk:false},
    loreReport:'KINGDOMS OF CANDY, ICE, FIRE AND MANY OTHER PEOPLES COVER THE SURFACE. RUINS OF OLDER HUMAN CIVILIZATION, UNUSUAL MAGIC SIGNATURES AND A HUGE MISSING CHUNK OF THE WORLD ARE ALL CLEARLY VISIBLE.'
  },
  PANDORA:{
    worldType:'VERDANT',worldClass:'LIFE-BEARING MOON',visualRadius:42,radiusKm:2890,gravity:.80,massEarth:.16,density:1.78,
    water:.44,cloudCover:.62,cloudSpeed:.18,defaultTempC:27,tempRange:[-20,42],life:true,populationBase:5,
    dayHours:21,yearDays:304,distanceAU:4.37,axialTiltDeg:17,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2 / CO2',weather:'MONSOONS / MISTS',ring:false,
    moons:[knownMoon('ISV VENTURE STAR',18600,.72,1,61,15,.34,{kind:'human_ship',displayLengthKm:1.6,objectClass:'HUMAN COLONIAL VESSEL',hoverLabel:'RDA INTERSTELLAR SHIP',visualRenderer:'pandora_ship',type:'HUMAN COLONIAL VESSEL',origin:'RDA / HUMAN',status:'ACTIVE ORBIT',role:'INTERSTELLAR TRANSPORT / COLONIAL SUPPORT',surface:'ENGINEERED METAL HULL',atmosphere:'SEALED HUMAN INTERIOR',waterIce:'NONE',activity:'SHUTTLE TRAFFIC / COLONIAL LOGISTICS',anomaly:'HIGH-ENERGY DRIVE / HUMAN INDUSTRIAL SIGNATURES',lossRisk:false})],
    surface:'FOREST / OCEAN / ROCK',
    observation:'A DENSELY FORESTED MOON OF POLYPHEMUS. TOWERING JUNGLES, FLOATING MOUNTAINS AND A PLANET-WIDE BIOSPHERIC NETWORK DEFINE THIS WORLD.',
    scan:{ageBy:4.3,pressureAtm:.9,pressureText:'0.9 ATM',magField:'MODERATE',oxygen:20,nitrogen:72,co2:5,tectonics:'ACTIVE',volcanism:'LOW',oceanDepthKm:1.7,lifeTypePotential:'INTELLIGENT',techPotential:'PRE-INDUSTRIAL',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'PLANET-WIDE NEURAL BIOSPHERE',lossRisk:false},
    loreReport:'THE NA\'VI LIVE IN LARGE CLANS AMONG GIANT FORESTS, CLIFFS AND FLOATING MOUNTAINS. IKRAN, DIREHORSES AND COUNTLESS BIOLUMINESCENT SPECIES ARE TIED TO THE GLOBAL NETWORK KNOWN AS EYWA.'
  },
  POLYPHEMUS:{
    worldType:'TOXIC',worldClass:'GAS GIANT',renderer:'jupiter',visualRadius:58,radiusKm:61950,gravity:2.1,massEarth:210,density:.95,
    water:0,cloudCover:.54,cloudSpeed:.26,defaultTempC:-145,tempRange:[-210,-70],life:false,populationBase:0,
    dayHours:11.4,yearDays:10240,distanceAU:4.37,axialTiltDeg:12,rotationDirection:1,
    atmosDensity:'SUPERDENSE',atmosChemistry:'H2 / HE / CH4 / NH3 / H2S',weather:'AMMONIA / LIGHTNING STORMS',ring:false,moons:AVATAR_POLYPHEMUS_MOONS,
    observation:'NARANAWM, THE GREAT EYE: A MASSIVE GAS GIANT ORBITED BY PANDORA AND THIRTEEN LUNAR SISTERS. ITS GRAVITY AND MAGNETIC FIELD STRONGLY SHAPE THE MOONS AROUND IT.',
    scan:{ageBy:4.6,pressureAtm:1,pressureText:'1 BAR REF',magField:'EXTREME',oxygen:0,nitrogen:0,co2:0,tectonics:'ATMOSPHERIC',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'COMMON',carbon:'RICH',uranium:'TRACE',anomaly:'FOURTEEN-MOON SYSTEM / INTENSE MAGNETIC COUPLING',lossRisk:false}
  },
  ERID:{
    worldType:'TOXIC',worldClass:'AMMONIA WORLD',visualRadius:46,radiusKm:7120,gravity:2.05,massEarth:2.56,density:1.84,
    water:.02,cloudCover:.76,cloudSpeed:.18,defaultTempC:98,tempRange:[40,180],life:true,populationBase:7,
    dayHours:8.9,yearDays:42,distanceAU:39.1,axialTiltDeg:8,rotationDirection:1,
    atmosDensity:'SUPERDENSE',atmosChemistry:'AMMONIA / N2 / CO2',weather:'AMMONIA STORMS',ring:false,
    observation:'THE HIGH-PRESSURE HOMEWORLD OF THE ERIDIANS. WARM ROCK, AMMONIA CHEMISTRY AND A CRUSHING ATMOSPHERE DEFINE THE PLANET ROCKY CALLS HOME.',
    scan:{ageBy:5.0,pressureAtm:29.3,pressureText:'29.3 ATM',magField:'MODERATE',oxygen:0,nitrogen:58,co2:18,tectonics:'ACTIVE',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'RICH',carbon:'COMMON',uranium:'COMMON',anomaly:'ADVANCED XENON-DRIVEN INDUSTRIAL SIGNATURES',lossRisk:false},
    loreReport:'THE ERIDIANS ARE TOOL-USING, HIGHLY SOCIAL ROCK-LIKE BEINGS WHO THRIVE IN A HOT, HIGH-PRESSURE AMMONIA ENVIRONMENT. INDUSTRIAL MINING, PRECISION ENGINEERING AND ADVANCED SPACEFLIGHT ARE CLEARLY DETECTED.'
  },
  TATOOINE:{
    worldType:'DESERT',worldClass:'DESERT WORLD',visualRadius:41,radiusKm:5250,gravity:.93,massEarth:.62,density:1.13,
    water:.01,cloudCover:.04,cloudSpeed:.09,defaultTempC:34,tempRange:[-15,72],life:true,populationBase:4,
    dayHours:23,yearDays:304,distanceAU:1.9,axialTiltDeg:22,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / O2',weather:'HEAT HAZE / SANDSTORMS',ring:false,
    observation:'A BINARY-SUN DESERT WORLD OF ROCKY MESAS, SALT FLATS AND SCATTERED SETTLEMENTS.',
    moons:[knownMoon('GHOMRASSEN',310000,24.1,820,72,11,.60,{tempBias:-16,gravity:.08,surface:'ROCK / DUST',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'NONE',lossRisk:false}),knownMoon('GUERMESSA',420000,38.4,670,88,10,.55,{tempBias:-18,gravity:.06,surface:'ROCK / DUST',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'NONE',lossRisk:false})],
    scan:{ageBy:4.8,pressureAtm:.87,pressureText:'0.87 ATM',magField:'WEAK',oxygen:19,nitrogen:77,co2:1.8,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'COMMON',uranium:'TRACE',anomaly:'TWIN-STELLAR INSOLATION PATTERN',lossRisk:false},
    loreReport:'MOISTURE FARMERS, JAWA TRADERS AND HUTT-DOMINATED SETTLEMENTS ARE SCATTERED ACROSS THE DESERT. DEEP SAND SEAS AND REMOTE CANYONS HIDE OLD RUINS, RACER TRACKS AND SMUGGLER ROUTES.'
  },
  HOTH:{
    worldType:'ICE',worldClass:'ICE WORLD',visualRadius:40,radiusKm:4800,gravity:.92,massEarth:.52,density:1.22,
    water:.58,cloudCover:.22,cloudSpeed:.12,defaultTempC:-58,tempRange:[-150,-5],life:true,populationBase:2,
    dayHours:23.8,yearDays:549,distanceAU:3.1,axialTiltDeg:28,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / O2',weather:'BLIZZARDS',ring:false,
    observation:'A FROZEN WORLD of SNOW PLAINS, BLUE GLACIERS AND BITTER WINDS.',
    scan:{ageBy:4.7,pressureAtm:.74,pressureText:'0.74 ATM',magField:'WEAK',oxygen:18,nitrogen:79,co2:.5,tectonics:'LOW',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'COMPLEX',techPotential:'NONE',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'SUBGLACIAL CAVERN NETWORKS',lossRisk:false},
    loreReport:'TAUNTAUN HERDS AND LARGE PREDATORS LIKE WAMPAS SURVIVE IN THE POLAR WASTES. NO NATIVE TECHNOLOGICAL CIVILIZATION IS VISIBLE, BUT TEMPORARY MILITARY ACTIVITY SOMETIMES APPEARS.'
  },
  ENDOR:{
    worldType:'VERDANT',worldClass:'FOREST MOON',visualRadius:38,radiusKm:4900,gravity:.85,massEarth:.49,density:1.10,
    water:.33,cloudCover:.34,cloudSpeed:.15,defaultTempC:16,tempRange:[-20,38],life:true,populationBase:4,
    dayHours:18.2,yearDays:402,distanceAU:8.2,axialTiltDeg:19,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'MISTS / SHOWERS',ring:false,
    observation:'A WOODED MOON WITH TOWERING CONIFERS, FOGGY VALLEYS AND A STRONG NATIVE BIOSPHERE.',
    scan:{ageBy:4.3,pressureAtm:1.02,pressureText:'1.02 ATM',magField:'MODERATE',oxygen:22,nitrogen:75,co2:.06,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:.5,lifeTypePotential:'INTELLIGENT',techPotential:'PRE-INDUSTRIAL',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'ORBITAL BATTLE DEBRIS SIGNATURES',lossRisk:false},
    loreReport:'EWOK VILLAGES, LIFTED WOODEN BRIDGES AND FOREST TRAILS ARE DETECTED THROUGH THE TREETOPS. THE MOON ALSO CARRIES OLD SCARS FROM THE BATTLE THAT DESTROYED THE SECOND DEATH STAR.'
  },
  NABOO:{
    worldType:'VERDANT',worldClass:'TERRESTRIAL WORLD',visualRadius:43,radiusKm:6400,gravity:1.0,massEarth:1.01,density:1.00,
    water:.46,cloudCover:.36,cloudSpeed:.16,defaultTempC:21,tempRange:[-10,40],life:true,populationBase:7,
    dayHours:26.6,yearDays:312,distanceAU:1.1,axialTiltDeg:17,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'RAIN / STORMS',ring:false,
    observation:'A LUSH WORLD OF GRASSLANDS, SEAS AND WETLANDS KNOWN FOR BOTH SURFACE CITIES AND UNDERWATER SETTLEMENTS.',
    scan:{ageBy:4.4,pressureAtm:1.01,pressureText:'1.01 ATM',magField:'MODERATE',oxygen:21,nitrogen:78,co2:.05,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:2.2,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'DUAL SURFACE / SUBAQUATIC CIVILIZATION',lossRisk:false},
    loreReport:'HUMAN CITIES, GUNGAN UNDERWATER HABITATS AND HIGH-ENERGY TRANSPORT ROUTES COVER NABOO. THE WORLD MAINTAINS A BALANCE BETWEEN ORNAMENTAL ARCHITECTURE, AGRICULTURE AND ADVANCED STARFARING TECHNOLOGY.'
  },
  CORUSCANT:{
    worldType:'BARREN',worldClass:'CITY WORLD',renderer:'coruscant',visualRadius:44,radiusKm:6100,gravity:.98,massEarth:.95,density:1.03,
    water:.01,cloudCover:.21,cloudSpeed:.12,defaultTempC:18,tempRange:[-5,35],life:true,populationBase:8,
    dayHours:24,yearDays:368,distanceAU:1.3,axialTiltDeg:22,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'URBAN HAZE / RAIN',ring:false,
    observation:'A PLANET-SPANNING ECUMENOPOLIS WHERE NEARLY THE ENTIRE SURFACE HAS BEEN BUILT OVER.',
    scan:{ageBy:5.1,pressureAtm:1.02,pressureText:'1.02 ATM',magField:'MODERATE',oxygen:20.5,nitrogen:77.8,co2:.4,tectonics:'CONTAINED',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'RICH',carbon:'COMMON',uranium:'COMMON',anomaly:'PLANET-WIDE ARTIFICIAL LIGHT NETWORK',lossRisk:false},
    loreReport:'A LAYERED CITYSCAPE COVERS THE ENTIRE PLANET. HEAVY AIR TRAFFIC, ORBITAL LANES, SENATORIAL DISTRICTS AND MEGASTRUCTURAL FOUNDATIONS ALL POINT TO ONE OF THE GALAXY\'S MOST ADVANCED URBAN WORLDS.'
  },
  MUSTAFAR:{
    worldType:'VOLCANIC',worldClass:'VOLCANIC WORLD',visualRadius:38,radiusKm:4200,gravity:.85,massEarth:.41,density:1.29,
    water:0,cloudCover:.12,cloudSpeed:.06,defaultTempC:134,tempRange:[40,260],life:true,populationBase:2,
    dayHours:36,yearDays:412,distanceAU:.9,axialTiltDeg:11,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'CO2 / SO2',weather:'ASH / HEAT',ring:false,
    observation:'A VOLCANIC WORLD OF LAVA RIVERS, BASALT SPires AND CONSTANT GEOLOGICAL VIOLENCE.',
    scan:{ageBy:4.8,pressureAtm:.29,pressureText:'0.29 ATM',magField:'WEAK',oxygen:1,nitrogen:7,co2:82,tectonics:'VIOLENT',volcanism:'HIGH',oceanDepthKm:0,lifeTypePotential:'COMPLEX',techPotential:'INDUSTRIAL',iron:'RICH',carbon:'TRACE',uranium:'COMMON',anomaly:'EXTENSIVE LAVA OCEANS',lossRisk:false},
    loreReport:'INDUSTRIAL MINING FACILITIES AND FORTIFIED COMPLEXES CLING TO THE ROCK ABOVE THE LAVA FLOWS. LIFE IS HARSH AND LOCALIZED, BUT THE WORLD SUPPORTS SPECIALIZED INDUSTRY AND STRATEGIC OUTPOSTS.'
  },
  KAMINO:{
    worldType:'OCEAN',worldClass:'OCEAN WORLD',visualRadius:43,radiusKm:6800,gravity:1.02,massEarth:1.12,density:1.01,
    water:.94,cloudCover:.82,cloudSpeed:.24,defaultTempC:9,tempRange:[-5,28],life:true,populationBase:5,
    dayHours:27,yearDays:463,distanceAU:2.1,axialTiltDeg:14,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'N2 / O2',weather:'GLOBAL STORMS',ring:false,
    observation:'AN OCEANIC WORLD OF ENDLESS SEAS, HARD RAIN AND TOWERING STILTED CITIES RISING ABOVE THE WAVES.',
    scan:{ageBy:4.5,pressureAtm:1.6,pressureText:'1.6 ATM',magField:'MODERATE',oxygen:21,nitrogen:77.5,co2:.1,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:6.1,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'CLONE / BIOENGINEERING INFRASTRUCTURE',lossRisk:false},
    loreReport:'THE KAMINOANS OPERATE ADVANCED CLONING FACILITIES FROM OCEAN-BORNE CITIES. HEAVY RAIN, STRONG WINDS AND PLANET-WIDE WATER COVER DOMINATE THE ENVIRONMENT.'
  },
  ALDERAAN:{
    worldType:'VERDANT',worldClass:'ALPINE WORLD',visualRadius:42,radiusKm:6250,gravity:.96,massEarth:.93,density:1.01,
    water:.51,cloudCover:.31,cloudSpeed:.14,defaultTempC:14,tempRange:[-12,30],life:true,populationBase:6,
    dayHours:24.2,yearDays:364,distanceAU:1.0,axialTiltDeg:21,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'CLEAR / SHOWERS',ring:false,
    observation:'A BEAUTIFUL CORE WORLD OF MOUNTAINS, LAKES AND ELEGANT CITIES.',
    scan:{ageBy:4.6,pressureAtm:1,pressureText:'1 ATM',magField:'MODERATE',oxygen:21,nitrogen:78,co2:.04,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:2.6,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'RECENT PLANETARY DESTRUCTION TRAUMA',lossRisk:false},
    loreReport:'PEACEFUL CITIES, ALPINE SETTLEMENTS AND HIGH CULTURAL DENSITY DEFINE ALDERAAN. THE WORLD IS SYNONYMOUS WITH DIPLOMACY, ART AND LONG-STANDING PARTICIPATION IN INTERSTELLAR AFFAIRS.'
  },
  DEATH_STAR:{
    worldType:'BARREN',worldClass:'IMPERIAL BATTLE STATION',renderer:'deathstar',visualRadius:46,radiusKm:80000,gravity:1.08,massEarth:170,density:.19,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:21,tempRange:[0,42],life:false,populationBase:0,
    dayHours:24,yearDays:365,distanceAU:0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A MOON-SIZED ARTIFICIAL BATTLE STATION WITH A PLANET-KILLING SUPERLASER DISH AND AN IMPERIAL PANEL-ARMOURED SURFACE.',
    scan:{ageBy:.03,pressureAtm:0,pressureText:'CONTROLLED INTERIOR ONLY',magField:'ARTIFICIAL',oxygen:0,nitrogen:0,co2:0,tectonics:'NONE',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'INTERSTELLAR',iron:'ABUNDANT',carbon:'TRACE',uranium:'ABUNDANT',anomaly:'SUPERLASER CONDUIT GRID',lossRisk:false},
    lifeLabel:'NONE',populationLabel:'MASSIVE',lifeTypeLabel:'NONE',techLevelLabel:'INTERSTELLAR'
  },
  DEATH_STAR_II:{
    worldType:'BARREN',worldClass:'INCOMPLETE BATTLE STATION',renderer:'deathstar2',visualRadius:46,radiusKm:90000,gravity:1.02,massEarth:165,density:.17,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:18,tempRange:[0,40],life:false,populationBase:0,
    dayHours:24,yearDays:365,distanceAU:0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    damage:{type:'CUSTOM_MASK',angle:0,severity:.82,seed:0xd5020002},
    observation:'THE SECOND DEATH STAR: A PARTIALLY COMPLETED SUPERWEAPON ABOVE ENDOR WITH LARGE EXPOSED SECTIONS OF INNER SUPERSTRUCTURE.',
    scan:{ageBy:.01,pressureAtm:0,pressureText:'PARTIAL INTERNAL LIFE SUPPORT',magField:'ARTIFICIAL',oxygen:0,nitrogen:0,co2:0,tectonics:'NONE',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'INTERSTELLAR',iron:'ABUNDANT',carbon:'TRACE',uranium:'ABUNDANT',anomaly:'EXPOSED REACTOR / CONSTRUCTION SUPERSTRUCTURE',lossRisk:false},
    lifeLabel:'NONE',populationLabel:'MANY',lifeTypeLabel:'NONE',techLevelLabel:'INTERSTELLAR'
  },
  DEATH_STAR_III:{
    worldType:'BARREN',worldClass:'RUINED BATTLE STATION',renderer:'deathstar3',visualRadius:46,radiusKm:90000,gravity:.96,massEarth:140,density:.16,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:-12,tempRange:[-120,25],life:false,populationBase:0,
    dayHours:24,yearDays:365,distanceAU:0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    damage:{type:'EXPLOSION_DAMAGE',angle:.18,severity:.94,seed:0xd5030003},
    observation:'A BADLY DAMAGED DEATH-STAR-TYPE HULK. WHOLE REGIONS OF THE SHELL ARE TORN OPEN, LEAVING JAGGED SCARS AND EXPOSED INNER FRAMES.',
    scan:{ageBy:.02,pressureAtm:0,pressureText:'VACUUM',magField:'ARTIFICIAL',oxygen:0,nitrogen:0,co2:0,tectonics:'NONE',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'INTERSTELLAR',iron:'ABUNDANT',carbon:'TRACE',uranium:'ABUNDANT',anomaly:'CATASTROPHIC BATTLE DAMAGE',lossRisk:false},
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'INTERSTELLAR'
  },
  ARRAKIS:{
    worldType:'DESERT',worldClass:'DESERT PLANET',visualRadius:42,radiusKm:6200,gravity:.91,massEarth:.86,density:.93,
    water:.00,cloudCover:.01,cloudSpeed:.05,defaultTempC:47,tempRange:[10,92],life:true,populationBase:5,
    dayHours:26.5,yearDays:687,distanceAU:1.9,axialTiltDeg:19,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / O2',weather:'SPICE DUST / SANDSTORMS',ring:false,
    moons:[knownMoon('SPACING GUILD HEIGHLINER',0,0,10,0,0,1,{kind:'heighliner',fixedPosition:{x:-88,y:-58,depth:1},displayLengthKm:20,objectClass:'GUILD HEIGHLINER',surface:'GUILD MEGASTRUCTURE HULL',atmosphere:'SEALED INTERIOR',waterIce:'NONE',activity:'FIXED TRANSPORT HOLD',anomaly:'HOLTZMAN / FOLDSPACE SIGNATURE',lossRisk:false})],
    observation:'THE DESERT WORLD OF DUNE, ALMOST ENTIRELY DRY AND FAMOUS AS THE ONLY SOURCE OF MELANGE.',
    scan:{ageBy:4.9,pressureAtm:.92,pressureText:'0.92 ATM',magField:'WEAK',oxygen:20,nitrogen:76,co2:1.6,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'COMMON',uranium:'TRACE',anomaly:'SPICE BLOWS / TITANIC SANDWORM SIGNATURES',lossRisk:false},
    loreReport:'FREMEN SIETCHES, SCATTERED IMPERIAL OUTPOSTS AND ENORMOUS SANDWORMS DOMINATE THE DEEP DESERT. THE ENTIRE POLITICAL ECONOMY OF THE IMPERIUM ORBITS THE SPICE HARVESTED HERE.'
  },
  CALADAN:{
    worldType:'OCEAN',worldClass:'OCEANIC WORLD',visualRadius:43,radiusKm:6700,gravity:.98,massEarth:1.06,density:1.02,
    water:.78,cloudCover:.52,cloudSpeed:.16,defaultTempC:18,tempRange:[-8,34],life:true,populationBase:6,
    dayHours:24.4,yearDays:391,distanceAU:1.1,axialTiltDeg:18,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'RAIN / SEAS',ring:false,
    observation:'A WATER-RICH WORLD OF RAIN, ISLANDS AND DEEP OCEANS, LONG RULED BY HOUSE ATREIDES.',
    scan:{ageBy:4.4,pressureAtm:1.03,pressureText:'1.03 ATM',magField:'MODERATE',oxygen:21,nitrogen:78,co2:.05,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:4.9,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'VAST PELAGIC ECOSYSTEMS',lossRisk:false},
    loreReport:'SEA-SWEPT CLIFFS, AGRICULTURAL ESTATES AND COASTAL CITIES DEFINE CALADAN. THE PLANET SUPPORTS A STABLE HUMAN CIVILIZATION WITH HIGH TECHNOLOGY AND A STRONG MARITIME CHARACTER.'
  },
  'GIEDI PRIME':{
    worldType:'TOXIC',worldClass:'INDUSTRIAL WORLD',visualRadius:42,radiusKm:6000,gravity:1.02,massEarth:.98,density:1.08,
    water:.01,cloudCover:.66,cloudSpeed:.10,defaultTempC:36,tempRange:[5,75],life:true,populationBase:7,
    dayHours:28,yearDays:402,distanceAU:1.4,axialTiltDeg:14,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'CO2 / SO2 / N2',weather:'SMOG / ACID RAIN',ring:false,
    observation:'A HARSH, HEAVILY INDUSTRIALIZED WORLD ASSOCIATED WITH HOUSE HARKONNEN.',
    scan:{ageBy:4.8,pressureAtm:1.8,pressureText:'1.8 ATM',magField:'WEAK',oxygen:11,nitrogen:63,co2:22,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'RICH',carbon:'COMMON',uranium:'COMMON',anomaly:'PLANET-WIDE INDUSTRIAL EMISSIONS',lossRisk:false},
    loreReport:'DENSE INDUSTRIAL ZONES, EXTRACTION COMPLEXES AND HEAVY POLLUTION COVER GIEDI PRIME. BIOLOGICAL DIVERSITY IS LIMITED, BUT THE PLANET IS TEEMING WITH HIGH-ENERGY INDUSTRIAL ACTIVITY.'
  },
  'SALUSA SECUNDUS':{
    worldType:'BARREN',worldClass:'PRISON WORLD',visualRadius:40,radiusKm:5900,gravity:.96,massEarth:.84,density:1.12,
    water:.03,cloudCover:.08,cloudSpeed:.08,defaultTempC:18,tempRange:[-18,58],life:true,populationBase:2,
    dayHours:25,yearDays:471,distanceAU:1.5,axialTiltDeg:16,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / O2',weather:'DUST / HEAT',ring:false,
    observation:'A BLEAK AND DEADLY IMPERIAL PRISON PLANET, HARDENED BY EXTREME CONDITIONS.',
    scan:{ageBy:4.7,pressureAtm:.81,pressureText:'0.81 ATM',magField:'WEAK',oxygen:18,nitrogen:79,co2:.5,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'SURVIVAL-SELECTED MILITARY POPULATION',lossRisk:false},
    loreReport:'THE WORLD IS DELIBERATELY BRUTAL: WASTELANDS, ROCKY BASINS AND MINIMAL RESOURCES PUSH ITS PEOPLE TOWARD RELENTLESS SURVIVAL. MILITARIZED ENCAMPMENTS AND HARDENED FORTRESSES ARE VISIBLE.'
  }
};
function lorePresetForName(name){ return LORE_PRESETS[name?.replace(/ /g,'_')] || LORE_PRESETS[name] || null; }
function tempRangeFor(p=planet){ return p?.tempRange || [-78,78]; }
function tempStateFromC(c,p=planet){ const [lo,hi]=tempRangeFor(p); return clamp((c-lo)/(hi-lo),0,1); }
function tempCFromState(v,p=planet){ const [lo,hi]=tempRangeFor(p); return Math.round(lo+clamp(v,0,1)*(hi-lo)); }
function tempStorageKey(p=planet){
  if(p?.solar && p.name==='MARS') return 'planetarium:temp:solar:MARS:v2';
  return p?.solar ? `planetarium:temp:solar:${p.name}` : `planetarium:temp:${p?.seed}`;
}

const SPECIALS = {
  'CAT PLANET': { text:'CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET.', palette:'cat', life:true },
  'EVERYBODY CAT PLANET': { text:'CAT PLANET CAT PLANET CAT PLANET. MEOW!', palette:'cat', life:true },
  'ARDA': { text:'AMONG MANY OTHER FASCINATING CREATURES, ARDA IS HOME TO A RACE OF TALL, THIN, HUMANOID CREATURES, THE FIRST CHILDREN OF ILUVATAR.', life:true },
  'SHIRE': { text:'THE HILLS ARE HOME TO SMALL, PEACEFUL CREATURES WITH LARGE, HAIRY FEET.', life:true },
  'ARRAKIS': { text:"THE DEEP SANDS ARE HOME TO ENORMOUS, INCREDIBLY STRONG WORMS, KNOWN LOCALLY AS 'GREAT MAKERS' AND WORSHIPPED AS GODS. THE ONLY KNOWN SOURCE OF THE SPICE MELANGE.", life:true, hot:true },
  'KERBIN': { text:'THE SHORES ARE HOME TO A GROUP OF SMALL, GREEN FROG-LIKE CREATURES, WHO APPEAR TO BE TAKING THE FIRST STEPS TOWARD SPACE EXPLORATION.', life:true },
  'MINECRAFT': { text:'THE GRASSLANDS ARE HOME TO LARGE, VOXELATED SPIDERS, ZOMBIES, CREEPERS, SKELETONS AND THE OCCASIONAL BRAVE ADVENTURER.', life:true },
  'HOTH': { text:'SO... COLD...', life:true, cold:true },
  'TRANTOR': { text:'AT THE CENTRE OF THE GALAXY, THIS PLANET IS HOME TO ROUGHLY FORTY-FIVE BILLION HUMAN BEINGS.', life:true },
  'VULCAN': { text:'THE PLANET IS GIVING OFF STRANGE PSYCHIC READINGS. LOGIC APPEARS TO BE POPULAR HERE.', life:true },
  'MAGRATHEA': { text:'THIS PLANET IS LARGE ENOUGH TO HOUSE OTHER PLANETS.', life:true },
  'EUROPA': { text:'ALL THESE WORLDS ARE YOURS EXCEPT EUROPA - ATTEMPT NO LANDING THERE.', life:false, cold:true },
  'MOBIUS': { text:'THIS PLANET IS HOME TO A REMARKABLE POPULATION OF INCREDIBLY FAST BLUE HEDGEHOGS.', life:true },
  'HYRULE': { text:'HEY, LISTEN!', life:true },
  'SUPER MARIO WORLD': { text:'THE CASTLES ARE HOME TO LARGE, VICIOUS TURTLE-LIKE CREATURES. SO MANY CASTLES, SO FEW PRINCESSES!', life:true },
  'SOURCE CODE': { text:'HEY, STOP LOOKING AT MY SOURCE CODE!', life:true },
  'BLOOD': { text:'THE OCEANS APPEAR TO BE MADE ENTIRELY OF BLOOD. WHY DID WE COME TO THIS PLANET?', life:true },
  'LANTERN': { text:'ONE SOLITARY FIGURE WALKS ALONE THROUGH THE DARKNESS.', life:true, cold:true },
  'KNIFE': { text:'A WARRIOR BATTLES HIS WAY THROUGH THE BOTTOM OF THE WORLD, IN SEARCH OF A GOLDEN THRONE.', life:true },
  'SPEAR': { text:'... BUT SHE WAS NO LONGER THERE.', life:true },
  'SINGULARITY': { text:'THE SPACE CLOSE TO THE BLACK HOLE IS FILLED WITH FAINT WHISPERS FROM AN ANCIENT RACE.', life:false, dark:true },
  'VERY PLANET': { text:'THIS PLANET LOOKS STRANGELY FLAT.', life:true },
  'WHATEVER WHO CARES': { text:"THERE'S NOTHING OF INTEREST HERE.", life:false },
  'POOPIA': { text:"PRONOUNCED POE-OH-PIA. AND WOW, I REALLY WASN'T EXPECTING ANYONE TO REMEMBER THAT!", life:true },
  "'STRAYA": { text:'AUSSIE AUSSIE AUSSIE! OI OI OI!', life:true, hot:true },
  'USA!': { text:'USA! USA! USA!', life:true },
  'APPLE PIE RECIPE': { text:'IN A LARGE BOWL, BEGIN BY MAKING THE UNIVERSE. THEN ADD FLOUR AND SOME SALT. ADD BUTTER. THEN ADD APPLES, DICED.', life:true },
  'DARK WORLD': { text:'THIS PLANET HAS BEEN CORRUPTED BY AN IMPOSSIBLE HORROR AND THREATENS TO DESTROY NEIGHBOURING WORLDS.', life:true, dark:true },
  'ASPHYXIA': { text:'THE OCEANS ARE FILLED WITH CREATURES IN A PERPETUAL STATE OF DROWNING.', life:true },
  'HAMMOCK': { text:'THE WARM OCEANS ARE TEEMING WITH FRIENDLY, ADORABLE SHARKS.', life:true },
  'EXILE': { text:"AFTER A TIMELESS PERIOD DRIFTING THROUGH SPACE, A SETTLEMENT SHIP LANDED ON THIS SMALL, HARSH PLANET. THE AIR IS THIN, THE FLORA BITTER, AND THE FAUNA DEADLY - BUT IT'S HOME.", life:true },
  'NEW EDEN': { text:'HOME TO A HUMAN SETTLEMENT FOR TWO HUNDRED YEARS. PRESENTLY, NO LIFE REMAINS.', life:false },
};
const INFO_CARDS = {
  'WHAT DO I DO?': 'CLICK AND DRAG THE SLIDER (OR PRESS LEFT AND RIGHT) TO CHANGE THE HEAT OF THE PLANET. PRESS TAB OR THE VIEW BUTTON TO CYCLE NORMAL, TEMPERATURE AND ATMOSPHERE VIEWS. TYPE IN NEW PLACES TO VISIT, OR PRESS ? / 0 FOR A RANDOM PLANET. HOVER A PLANET OR MOON FOR DETAILS. CLICK A BODY TO TARGET IT, THEN PRESS P OR THE PROBE BUTTON FOR A DEEP SCAN. PRESS F FOR FAVORITES, L FOR THE PLANET LIBRARY, AND C TO COPY A SHAREABLE LINK. THERE IS NO PURPOSE, SO JUST HAVE FUN!',
  'SO YOU WANT TO LEAVE ME?': 'PRESS ESCAPE, ALT+F4, OR BETTER YET JUST STAY HERE AND SIT AMONG THE STARS!',
  "SO WHAT'S ALL THIS THEN?": 'THIS THING WAS MADE BY DANIEL LINSSEN WITH MUSIC BY DUBMOOD AS A SIDE PROJECT FOR HIS OWN AMUSEMENT. THIS RECONSTRUCTION USES NEW CODE AND THE ASSETS RECOVERED FROM YOUR COPY.',
  'WHERE CAN I GO FOR MORE?': 'THE ORIGINAL PLANETARIUM WAS MADE BY DANIEL LINSSEN. VISIT MANAGORE.ITCH.IO FOR HIS GAMES.'
};

function storageGet(key, fallback=null){ try { const v=localStorage.getItem(key); return v===null?fallback:v; } catch { return fallback; } }
function storageSet(key,v){ try { localStorage.setItem(key,v); } catch {} }
function storageRemove(key){ try { localStorage.removeItem(key); } catch {} }
function planetariumStorageEntries(){
  const out={};
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith('planetarium:')) out[key]=localStorage.getItem(key);
    }
  }catch{}
  return out;
}
function clearPlanetariumStorage(){
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith('planetarium:')) keys.push(key);
    }
    keys.forEach(key=>localStorage.removeItem(key));
  }catch{}
}

const MOON_HOVER_GRACE_MS=700;

const state = {
  name: urlPlanet || storageGet('planetarium:lastName','PLANET'),
  input: '', enteringName:false, temp: .50, viewMode:0, tempView:false, reverse:false, paused:false, speedIndex:1, muted:false,
  phase:0, simDays:0, intro:!urlPlanet, introUntil: Infinity,
  mouse:{x:-20,y:-20,down:false,inside:false,pointerType:'mouse'},
  draggingSlider:false, hovered:null, hoverBody:null, pinnedBody:null, moonHoverGrace:null, moonHoverUntil:0, moonInspect:null, rocket:null, probe:null, spaceLaunchSerial:0,
  history:[], historyPos:-1, favorites:[], scannedWorlds:[], libraryOpen:false, libraryTab:'favorites', librarySelection:0, libraryRows:[], libraryActionRects:[], resetConfirmUntil:0,
  lifeScroll:0, lifeScrollMax:0, lifePanelRect:null, lifePanelFocused:false, lifePanelKey:'',
  infoScroll:0, infoScrollMax:0, infoPanelRect:null, infoPanelFocused:false, infoPanelKey:'',
  info:null, infoTitle:null, toastText:'', toastUntil:0,
  lastTime:performance.now(), twinkle:0, cameraFlash:0,
  captureMode:null, cameraHold:null
};
try { state.history = JSON.parse(storageGet('planetarium:history','[]')) || []; } catch { state.history=[]; }
try { state.favorites = JSON.parse(storageGet('planetarium:favorites','[]')) || []; } catch { state.favorites=[]; }
try { state.scannedWorlds = JSON.parse(storageGet('planetarium:scanned-worlds','[]')) || []; } catch { state.scannedWorlds=[]; }
state.history=state.history.filter(v=>typeof v==='string').slice(-40);
state.favorites=[...new Set(state.favorites.filter(v=>typeof v==='string').map(v=>canonicalPlanetName(v)))].slice(0,100);
state.scannedWorlds=[...new Set(state.scannedWorlds.filter(v=>typeof v==='string').map(v=>canonicalPlanetName(v)))].slice(-200);
function hasStoredScanForWorld(name){
  const seed=hashString(canonicalPlanetName(name));
  const prefix=`planetarium:probe-scan:${seed}:`;
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith(prefix) && localStorage.getItem(key)==='1') return true;
    }
  }catch{}
  return false;
}
for(const name of [...state.history,...state.favorites,state.name]){
  const canonical=canonicalPlanetName(name);
  if(canonical && hasStoredScanForWorld(canonical) && !state.scannedWorlds.includes(canonical)) state.scannedWorlds.push(canonical);
}
state.scannedWorlds=state.scannedWorlds.slice(-200);
storageSet('planetarium:scanned-worlds',JSON.stringify(state.scannedWorlds));

let planet=null;
function pick(r, arr){ return arr[Math.floor(r()*arr.length)]; }

const POPULATION_WORDS=['NONE','TRACE','VERY FEW','FEW','SOME','MANY','VERY MANY','ABUNDANT','MASSIVE'];
const RESOURCE_LEVELS=['TRACE','POOR','COMMON','RICH','ABUNDANT'];
const PLANET_ANOMALIES=[
  'ARTIFICIAL RADIO SIGNAL','ANCIENT RUINS','MASSIVE CRYSTALLINE FORMATIONS','UNUSUAL MAGNETIC ACTIVITY',
  'ABANDONED STRUCTURES','ORBITAL DEBRIS OF UNKNOWN ORIGIN','IMPOSSIBLE GEOLOGICAL FORMATIONS',
  'ARTIFICIAL SATELLITE','PLANET-WIDE RESONANCE','REPEATING GRAVITATIONAL PULSE','UNEXPLAINED HEAT SOURCE',
  'PERFECTLY CIRCULAR IMPACT BASIN','NON-NATURAL LIGHT PATTERN','VAST SUBSURFACE CAVITY','ISOLATED RADIO BURST',
  'EQUATORIAL MEGASTRUCTURE FRAGMENTS','ANOMALOUS ISOTOPE DEPOSIT','SYNCHRONIZED LIGHTNING PATTERN',
  'MASSIVE FLOATING MINERAL FIELD','UNIDENTIFIED ORBITAL TRANSMITTER','REGULAR GEOMETRIC SURFACE MARKS',
  'EXTREME AURORAL ACTIVITY','DEEP CRUSTAL ENERGY SIGNATURE','UNKNOWN OBJECT BENEATH SURFACE'
];
const MOON_ANOMALIES=[
  'HOLLOW REGION','SUBSURFACE OCEAN','UNUSUAL MAGNETIC FIELD','ARTIFICIAL REFLECTOR','ANCIENT IMPACT STRUCTURE',
  'CRYSTALLINE CAVES','RADIO ECHO','REGULAR SURFACE GRID','BURIED METALLIC MASS','GEYSER FIELD','THERMAL HOTSPOT',
  'UNEXPLAINED ORBITAL DRIFT','MONOLITHIC STRUCTURE','DEEP FRACTURE NETWORK','UNIDENTIFIED TRANSMISSION',
  'FROZEN GAS RESERVOIR','TIDAL HEATING ANOMALY','EXTREME ALBEDO PATCH','ARTIFICIAL CAVITY','DUST PLUME SOURCE'
];
function planetAnomalyFor(p,r){
  if(r()<.38) return '';
  const pool=[...PLANET_ANOMALIES];
  if((p.water||0)>.55) pool.push('SUBSURFACE OCEAN','ABYSSAL HEAT BLOOM','MASSIVE DEEP-OCEAN STRUCTURE','UNEXPLAINED BIOLUMINESCENT REGION');
  if((p.water||0)<.12) pool.push('BURIED ICE RESERVOIR','GLASS DESERT FIELD','ANCIENT DRY RIVER NETWORK','SUBSURFACE SALT CAVES');
  if((p.cloudCover||0)>.55) pool.push('PERMANENT STORM EYE','PLANET-WIDE CLOUD VORTEX','ATMOSPHERIC STANDING WAVE');
  if((p.atmosChemistry||'').includes('METHANE')) pool.push('HYDROCARBON RAIN SEA','METHANE LIGHTNING COMPLEX');
  if((p.atmosChemistry||'').includes('SULF')||(p.atmosChemistry||'').includes('SO2')) pool.push('SULFUR PLUME CONTINENT','ACID-CLOUD SUPERROTATION');
  if((p.atmosChemistry||'').includes('EXOTIC')||(p.atmosChemistry||'').includes('METALLIC')) pool.push('METALLIC CLOUD LIGHTNING','HIGH-ENERGY ATMOSPHERIC ARC','UNCLASSIFIED SPECTRAL LINE');
  if((p.populationBase||0)>=6) pool.push('MEGAFAUNA MIGRATION','SUBSURFACE MICROBIAL LIFE','MASSIVE BIOLOGICAL BLOOM','PLANET-SCALE MIGRATION ROUTE');
  if(p.ring) pool.push('RING PARTICLE RESONANCE','UNIDENTIFIED RING SHEPHERD','ARTIFICIAL GAP IN RING SYSTEM');
  return pick(r,pool);
}
function moonAnomalyFor(p,m,r){
  if(r()<.46) return '';
  const pool=[...MOON_ANOMALIES];
  const surface=(m.surface||'').toUpperCase(), activity=(m.activity||'').toUpperCase();
  if(surface.includes('ICE')) pool.push('SUBSURFACE OCEAN','CRYOVOLCANIC CHAMBER','DEEP ICE CAVERN','FROZEN ORGANIC DEPOSIT');
  if(activity.includes('VOLCAN')) pool.push('ACTIVE LAVA VENT','CRYOVOLCANIC PLUME','RECENT SURFACE ERUPTION');
  if((m.atmosphere||'').includes('TRACE')) pool.push('TRANSIENT ATMOSPHERIC PLUME','ESCAPING GAS CLOUD');
  if((m.waterIce||'')==='ABUNDANT'||(m.waterIce||'')==='RICH') pool.push('BURIED LIQUID RESERVOIR','FRESH ICE DEPOSIT');
  return pick(r,pool);
}
function hasAnomaly(d){ return !!d?.anomaly && d.anomaly!=='NONE'; }
function makePlanetScan(p){
  const r=mulberry32((p.seed^0x74c2e317)>>>0);
  p.populationBase=2+Math.floor(r()*7);
  const pressureRanges={NONE:[0,0],TRACE:[.001,.12],THIN:[.12,.78],NORMAL:[.78,1.68],DENSE:[1.7,6.8],SUPERDENSE:[7,90]};
  const pr=pressureRanges[p.atmosDensity]||[.5,1.5];
  const chemistry=(p.atmosChemistry||'').toUpperCase();
  let oxygen=(chemistry.includes('O2') ? 14+r()*15 : (p.populationBase>=4?7+r()*18:r()*3));
  if(chemistry.includes('METHANE')||chemistry.includes('SULF')||chemistry.includes('EXOTIC')||chemistry.includes('H2')) oxygen*=.12;
  if(p.atmosDensity==='NONE') oxygen=0;
  let co2=chemistry.includes('CO2')?(18+r()*67):(0.05+r()*4.5);
  if(chemistry.includes('METHANE')||chemistry.includes('H2')) co2*=.25;
  if(p.atmosDensity==='NONE') co2=0;
  const other=p.atmosDensity==='NONE'?0:5+r()*14;
  let nitrogen=Math.max(0,100-oxygen-co2-other);
  oxygen=Math.round(oxygen*10)/10; co2=Math.round(co2*10)/10; nitrogen=Math.round(nitrogen*10)/10;
  const complexity=p.populationBase<=3?'MICROBIAL':p.populationBase<=5?'SIMPLE':p.populationBase<=7?'COMPLEX':'INTELLIGENT';
  const tech=complexity==='INTELLIGENT'?pick(r,['PRIMITIVE','PRE-INDUSTRIAL','INDUSTRIAL','INDUSTRIAL','EARLY SPACEFLIGHT','EARLY SPACEFLIGHT','ORBITAL','INTERPLANETARY']):'NONE';
  p.scan={
    ageBy:Math.round((.45+r()*10.6)*10)/10,
    pressureAtm:Math.round((pr[0]+r()*(pr[1]-pr[0]))*100)/100,
    magField:pick(r,['NONE','WEAK','MODERATE','STRONG','EXTREME']),
    oxygen,nitrogen,co2,
    tectonics:pick(r,['DORMANT','LOW','ACTIVE','ACTIVE','VIOLENT']),
    volcanism:pick(r,['NONE','LOW','LOW','MODERATE','HIGH']),
    oceanDepthKm:Math.round((.15+p.water*7.4+r()*2.1)*10)/10,
    lifeTypePotential:complexity,
    techPotential:tech,
    iron:pick(r,RESOURCE_LEVELS), carbon:pick(r,RESOURCE_LEVELS), uranium:pick(r,RESOURCE_LEVELS),
    anomaly:planetAnomalyFor(p,r),
    lossRisk:r()<.045
  };
}
const PROCEDURAL_DAMAGE_TYPES=['SHATTERED_EDGE','MISSING_HEMISPHERE','EXPLOSION_DAMAGE','BITE','CRATER'];
function configureRarePlanetDamage(p,r){
  if(!p || p.solar || p.special || p.lorePreset || p.shape==='cube' || p.shape==='haloRing') return;
  // Roughly one named procedural world in four hundred is born catastrophically damaged.
  if(r()>=.0025) return;
  const type=pick(r,PROCEDURAL_DAMAGE_TYPES);
  const destructive=type!=='CRATER';
  p.damageProfile={type,angle:r()*Math.PI*2,severity:.62+r()*.32,seed:((p.seed^0x44535452)>>>0)};
  p.destroyedProcedural=destructive;
  if(destructive){
    p.populationBase=0;
    p.lifeText='NO SURVIVING BIOSPHERE IS DETECTED. THE PLANET HAS SUFFERED CATASTROPHIC STRUCTURAL DAMAGE.';
    p.noLifeText=p.lifeText;
    if(p.scan){
      p.scan.lifeTypePotential='NONE'; p.scan.techPotential='NONE';
      p.scan.anomaly=`CATASTROPHIC PLANETARY DAMAGE / ${type.replaceAll('_',' ')}`;
      p.scan.tectonics='CATASTROPHIC'; p.scan.volcanism=type==='EXPLOSION_DAMAGE'?'EXTREME':'HIGH';
    }
    p.civilization=null;
  }else if(p.scan){
    p.scan.anomaly='PLANET-SCALE IMPACT CRATER';
  }
}

function makeMoonScan(p,m,index){
  const r=mulberry32(hashString(`${p.name}|MOON|${index}|DEEP-SCAN`));
  const rel=m.radiusKm/1737;
  const scan={
    gravity:Math.round(clamp(rel*(.08+r()*.22),.01,.52)*100)/100,
    tempBias:-38-Math.round(r()*105)-index*7,
    surface:pick(r,['ROCK / ICE','BASALT','SILICATE','ICE / ROCK','METALLIC','DUST','SULFUR / ROCK','CARBON-RICH ROCK']),
    atmosphere:pick(r,['NONE','NONE','NONE','TRACE','TRACE','THIN']),
    waterIce:pick(r,['NONE','TRACE','COMMON','RICH','ABUNDANT']),
    activity:pick(r,['DORMANT','DORMANT','TECTONIC','CRYOVOLCANIC','VOLCANIC']),
    anomaly:'',
    lossRisk:r()<.035
  };
  scan.anomaly=moonAnomalyFor(p,scan,r);
  return scan;
}
const SPACE_TECH_RANK={NONE:0,PRIMITIVE:0,'PRE-INDUSTRIAL':1,INDUSTRIAL:2,'EARLY SPACEFLIGHT':3,ORBITAL:4,INTERPLANETARY:5,INTERSTELLAR:6};
function spaceTechRank(level){ return SPACE_TECH_RANK[level]||0; }
function noLocalOrbit(p=planet){ return p?.name==='ARRAKIS'; }
function makeOrbitalObject(r,p,type,index,rank){
  const base=p.radius+10;
  const orbit=base+index*5+r()*(13+rank*2);
  return {
    type, orbit, flatten:.34+r()*.16, phase:r()*Math.PI*2,
    periodDays:Math.max(2.2,7.8-rank*.72+r()*5.8), direction:r()<.14?-1:1,
    tint:pick(r,[C.white,C.cyan,C.purple,C.blue])
  };
}
function configureCivilization(p){
  if(p.name==='KERBIN'){
    p.scan.lifeTypePotential='INTELLIGENT';
    p.scan.techPotential='EARLY SPACEFLIGHT';
  }
  const rank=spaceTechRank(p.scan?.techPotential);
  if(rank<3){ p.civilization=null; return; }
  const r=mulberry32((p.seed^0x5aace77d)>>>0);
  let satelliteCount=rank===3?1+Math.floor(r()*3):rank===4?3+Math.floor(r()*4):5+Math.floor(r()*4);
  let stationCount=rank===3?(r()<.55?1:0):rank===4?1+Math.floor(r()*2):2+Math.floor(r()*2);
  let trafficCount=rank===3?1:rank===4?2+Math.floor(r()*2):3+Math.floor(r()*3);
  if(p.name==='EARTH'){ satelliteCount=4; stationCount=1; trafficCount=2; }
  const satellites=[],stations=[],traffic=[];
  for(let i=0;i<satelliteCount;i++) satellites.push(makeOrbitalObject(r,p,'satellite',i,rank));
  for(let i=0;i<stationCount;i++) stations.push(makeOrbitalObject(r,p,'station',i+2,rank));
  for(let i=0;i<trafficCount;i++) traffic.push(makeOrbitalObject(r,p,'traffic',i+1,rank));
  let moonMissionIndex=null;
  const naturalMoonIndices=(p.moonData||[]).map((m,i)=>m.kind?null:i).filter(i=>i!==null);
  if(naturalMoonIndices.length && (rank>=5 || (rank===4&&r()<.70) || (rank===3&&r()<.28))) moonMissionIndex=naturalMoonIndices[Math.floor(r()*naturalMoonIndices.length)];
  if(p.name==='EARTH' && naturalMoonIndices.length) moonMissionIndex=naturalMoonIndices[0];
  if(noLocalOrbit(p)){
    satelliteCount=0; stationCount=0; trafficCount=0; moonMissionIndex=null;
    satellites.length=0; stations.length=0; traffic.length=0;
  }
  const story=noLocalOrbit(p)
    ? 'NO LOCAL ORBITAL TRAFFIC IS MAINTAINED ABOVE ARRAKIS; THE SPACING GUILD HOLDS AT FIXED STANDOFF POSITIONS AWAY FROM FREMEN-CONTROLLED ORBIT.'
    : rank>=5
      ? `MULTIPLE ORBITAL STATIONS, ${satelliteCount} ACTIVE SATELLITE GROUPS AND REGULAR MOON MISSIONS ARE DETECTED`
      : rank===4
        ? `${stationCount?'CREWED ORBITAL STATIONS AND ':''}${satelliteCount} ACTIVE SATELLITE GROUPS SUPPORT A BUSY SPACE PROGRAM`
        : `${satelliteCount} SATELLITE GROUP${satelliteCount===1?'':'S'}${stationCount?' AND A SMALL CREWED STATION':''} MARK THE CIVILIZATION'S FIRST PERMANENT STEPS INTO SPACE`;
  p.civilization={rank,satellites,stations,traffic,launched:[],moonMissionIndex,missionPhase:r(),missionPeriodDays:9+r()*16,story};
}
function canLaunchCivilizationRocket(){ return !!planet?.civilization && !noLocalOrbit() && isAlive() && planet.civilization.rank>=3; }
const ATMOS_DENSITY_STRENGTH={NONE:0,TRACE:.08,THIN:.28,NORMAL:.58,DENSE:.82,SUPERDENSE:1};
function atmosphereStrength(p=planet){ return ATMOS_DENSITY_STRENGTH[p?.atmosDensity] ?? .5; }
function hasAtmosphereView(p=planet){
  return !!p && p.atmosDensity!=='NONE' && p.atmosChemistry!=='NONE' && atmosphereStrength(p)>.02;
}
function nextViewMode(mode=state.viewMode,p=planet){
  // NORMAL -> CLEAN -> ATMOSPHERE -> TEMPERATURE -> NORMAL.
  // Airless planets simply skip the atmosphere diagnostic.
  const modes=hasAtmosphereView(p)?[0,1,2,3]:[0,1,3];
  const at=modes.indexOf(mode);
  return modes[(at<0?0:at+1)%modes.length];
}
function normalizeViewModeForPlanet(){
  if(state.viewMode===2 && !hasAtmosphereView(planet)) state.viewMode=0;
  state.tempView=state.viewMode===3;
}
function configureWeatherSystems(p,r){
  const strength=atmosphereStrength(p); p.weatherSystems=[];
  if(strength<=.08) return;
  const typeBoost=p.worldType==='OCEAN'?2:p.worldType==='TOXIC'?2:p.worldType==='VOLCANIC'?1:p.worldType==='DESERT'?1:0;
  const count=clamp(Math.round(1+strength*5+(p.cloudCover||0)*3+typeBoost),1,10);
  const hurricaneChance=p.worldType==='OCEAN'?.72:p.worldType==='VERDANT'?.56:.42;
  p.hurricanePotential=!!(p.solar?.hurricanePotential ?? (strength>=.58 && p.water>.38 && r()<hurricaneChance));
  for(let i=0;i<count;i++){
    const sizeBoost=(p.worldType==='OCEAN'||p.worldType==='TOXIC')?2:0;
    p.weatherSystems.push({lon:r(),lat:.18+r()*.64,size:3+sizeBoost+Math.floor(r()*7),spin:r()<.5?-1:1,speed:(.003+r()*.010)*(r()<.5?-1:1),phase:r()*Math.PI*2,intensity:.35+r()*.65});
  }
}
function applyLorePreset(p,preset,r){
  if(!preset) return;
  p.lorePreset=preset;
  p.renderer=preset.renderer||p.renderer||null;
  p.shape=preset.shape||p.shape||'sphere';
  p.worldType=preset.worldType||p.worldType;
  p.worldClassOverride=preset.worldClass||null;
  p.radius=preset.visualRadius||p.radius;
  const giant=p.worldClassOverride==='GAS GIANT' || ['jupiter','saturn','uranus','neptune'].includes(p.renderer);
  p.rx=p.radius*(giant?1.05:1);
  p.ry=p.radius*(giant ? .94 : 1);
  p.water=preset.water ?? p.water;
  p.mount=preset.mount ?? (p.worldType==='OCEAN' ? .82 : p.worldType==='DESERT' ? .67 : p.worldType==='VOLCANIC' ? .62 : .76);
  p.beach=preset.beach ?? (p.worldType==='OCEAN' ? .018 : p.worldType==='DESERT' ? .055 : .028);
  p.cloudCover=preset.cloudCover ?? p.cloudCover;
  p.cloudSpeed=preset.cloudSpeed ?? p.cloudSpeed;
  p.tempRange=(preset.tempRange||p.tempRange||[-78,78]).slice();
  p.defaultTempC=preset.defaultTempC ?? 15;
  p.target=tempStateFromC(p.defaultTempC,p);
  p.variance=preset.lifeToleranceC ? clamp(preset.lifeToleranceC/(p.tempRange[1]-p.tempRange[0]),.08,.35) : (preset.variance ?? Math.max(.06,p.variance||.12));
  p.ring=!!preset.ring;
  p.ringTilt=preset.ringTilt||0;
  p.ringScale=preset.ringScale;
  p.ringFlatness=preset.ringFlatness;
  p.ringColor=preset.ringColor;
  p.ringAlpha=preset.ringAlpha;
  p.ringStyle=preset.ringStyle||'THIN';
  p.ringMaterial=preset.ringMaterial||'ROCK / ICE';
  p.ringBandSpread=preset.ringBandSpread;
  p.ringSpinRate=preset.ringSpinRate;
  p.ringParticleScale=preset.ringParticleScale;
  p.haloBandWidth=preset.haloBandWidth||null;
  p.haloFlatten=preset.haloFlatten||null;
  p.haloScreenAngle=preset.haloScreenAngle||0;
  p.haloSurfaceWidthKm=preset.haloSurfaceWidthKm||null;
  p.haloStyle=preset.haloStyle||null;
  p.haloMonitor=preset.haloMonitor||null;
  p.haloStatus=preset.haloStatus||null;
  p.haloBiome=preset.haloBiome||null;
  p.haloGaps=Array.isArray(preset.haloGaps)?preset.haloGaps.map(g=>({...g})):[];
  p.haloGlassed=!!preset.haloGlassed;
  p.radiusKm=preset.radiusKm||p.radiusKm;
  p.radiusEarth=p.radiusKm/6371;
  p.gravity=preset.gravity ?? p.gravity;
  p.massEarth=preset.massEarth ?? Math.max(.01,p.gravity*p.radiusEarth*p.radiusEarth);
  p.density=preset.density ?? Math.max(.1,p.gravity/Math.max(.01,p.radiusEarth));
  p.dayHours=preset.dayHours ?? p.dayHours;
  p.yearDays=preset.yearDays ?? p.yearDays;
  p.distanceAU=preset.distanceAU ?? p.distanceAU;
  p.axialTiltDeg=preset.axialTiltDeg ?? p.axialTiltDeg;
  p.rotationDirection=preset.rotationDirection ?? 1;
  p.rotation=p.rotationDirection*(preset.rotation ?? (.18+r()*.12));
  p.atmosDensity=preset.atmosDensity||p.atmosDensity;
  p.atmosChemistry=preset.atmosChemistry||p.atmosChemistry;
  p.weatherPreset=preset.weather||p.weatherPreset||'CLEAR';
  p.lifeText=preset.observation||p.lifeText;
  p.noLifeText=preset.observation||p.noLifeText;
  p.populationBase=preset.populationBase ?? p.populationBase;
  p.clouds=[];
  const cn=Math.floor((p.atmosDensity==='NONE'?0:4)+p.cloudCover*15*atmosphereStrength(p));
  for(let i=0;i<cn;i++) p.clouds.push({lon:r(),lat:.15+r()*.7,frame:Math.floor(r()*12),off:r()*6.28});
  configureWeatherSystems(p,r);
  if(Array.isArray(preset.moons)){
    p.moonData=preset.moons.map((m,i)=>({
      name:m.name,orbit:m.visualOrbit,orbitKm:m.orbitKm,periodDays:m.periodDays,radiusKm:m.radiusKm,
      phase:(i*.91+r()*.45)%(Math.PI*2),direction:m.direction||1,frame:m.frame%17,size:m.size,
      kind:m.kind||null,fixedPosition:m.fixedPosition?{...m.fixedPosition}:null,displayLengthKm:m.displayLengthKm||null,
      objectClass:m.objectClass||null,hoverLabel:m.hoverLabel||null,visualRenderer:m.visualRenderer||null,
      screenX:0,screenY:0,known:true,scan:{...m.scan}
    }));
    p.moons=p.moonData.filter(m=>!m.kind).length;
  }
  if(preset.damage) p.damageProfile={...preset.damage,seed:(preset.damage.seed??(p.seed^0x6d616765))>>>0};
  makePlanetScan(p);
  Object.assign(p.scan,preset.scan||{});
  if(preset.scan?.lifeTypePotential) p.scan.lifeTypePotential=preset.scan.lifeTypePotential;
  if(preset.scan?.techPotential) p.scan.techPotential=preset.scan.techPotential;
  p.moonData=(p.moonData||[]).map((m,i)=>{
    const scan=makeMoonScan(p,m,i);
    m.scan={...scan,...(m.scan||{})};
    const loreMoon=!m.kind?lorePresetForName(m.name):null;
    if(loreMoon){
      m.radiusKm=loreMoon.radiusKm||m.radiusKm;
      m.loreWorldClass=loreMoon.worldClass||'';
      m.scan.gravity=loreMoon.gravity ?? m.scan.gravity;
      m.scan.tempBias=(loreMoon.defaultTempC ?? 0)-(p.defaultTempC ?? 0);
      m.scan.atmosphere=loreMoon.atmosChemistry||m.scan.atmosphere;
      m.scan.surface=loreMoon.surface||(
        loreMoon.worldType==='VERDANT'?'FOREST / OCEAN / ROCK':
        loreMoon.worldType==='OCEAN'?'WATER / ROCK / ICE':
        loreMoon.worldType==='ICE'?'ICE / ROCK':
        loreMoon.worldType==='VOLCANIC'?'VOLCANIC BASALT':
        loreMoon.worldType==='DESERT'?'DUST / ROCK':'ROCK / ICE'
      );
      m.scan.waterIce=(loreMoon.water??0)>.55?'ABUNDANT':(loreMoon.water??0)>.25?'COMMON':(loreMoon.water??0)>.08?'TRACE':'NONE';
      const activity=[];
      if(loreMoon.scan?.tectonics&&loreMoon.scan.tectonics!=='NONE') activity.push(`${loreMoon.scan.tectonics} TECTONICS`);
      if(loreMoon.scan?.volcanism&&loreMoon.scan.volcanism!=='NONE') activity.push(`${loreMoon.scan.volcanism} VOLCANISM`);
      m.scan.activity=activity.length?activity.join(' / '):m.scan.activity;
      m.scan.anomaly=loreMoon.scan?.anomaly||m.scan.anomaly;
    }
    return m;
  });
  p.loreReport=preset.loreReport||'';
  p.lifeLabelOverride=preset.lifeLabel||null;
  p.populationLabelOverride=preset.populationLabel||null;
  p.lifeTypeOverride=preset.lifeTypeLabel||null;
  p.techLevelOverride=preset.techLevelLabel||null;
  if(preset.disableAutoCivilization) p.civilization=null; else configureCivilization(p);
  const saved=parseFloat(storageGet(tempStorageKey(p),''));
  state.temp=Number.isFinite(saved)?clamp(saved,0,1):tempStateFromC(p.defaultTempC,p);
}

function generatePlanet(name){
  name=canonicalPlanetName(name);
  const seed=hashString(name), r=mulberry32(seed);
  const solar=SOLAR_SYSTEM_PLANETS[name] || null;
  const lorePreset=solar ? null : lorePresetForName(name);
  const special=solar ? {text:solar.observation, life:solar.life, solar:true} : (lorePreset ? {text:lorePreset.observation, life:lorePreset.life, lore:true} : (SPECIALS[name] || null));
  const p={name,seed,special,solar,lorePreset};
  if(solar){
    p.renderer=solar.renderer;
    p.tempRange=solar.tempRange.slice();
    p.defaultTempC=solar.defaultTempC;
    p.radius=solar.visualRadius;
    p.rx=p.radius*(solar.renderer==='jupiter'||solar.renderer==='saturn' ? 1.05 : 1);
    p.ry=p.radius*(solar.renderer==='jupiter'||solar.renderer==='saturn' ? .94 : 1);
    p.water=solar.water;
    p.mount=.76; p.beach=.03;
    p.cloudCover=solar.cloudCover||0;
    p.cloudSpeed=solar.cloudSpeed||.12;
    p.target=tempStateFromC(solar.defaultTempC,p);
    p.variance=solar.life ? clamp((solar.lifeToleranceC||45)/(solar.tempRange[1]-solar.tempRange[0]),.08,.35) : .08;
    p.moons=solar.moons.length;
    p.ring=!!solar.ring;
    p.ringTilt=solar.ringTilt||0;
    p.ringScale=solar.ringScale;
    p.ringFlatness=solar.ringFlatness;
    p.ringColor=solar.ringColor;
    p.ringAlpha=solar.ringAlpha;
    p.ringStyle=solar.ringStyle||'THIN';
    p.ringMaterial=solar.ringMaterial||'ROCK / ICE';
    p.ringBandSpread=solar.ringBandSpread;
    p.ringSpinRate=solar.ringSpinRate;
    p.ringParticleScale=solar.ringParticleScale;
    p.radiusKm=solar.radiusKm;
    p.radiusEarth=p.radiusKm/6371;
    p.gravity=solar.gravity;
    p.massEarth=solar.massEarth;
    p.density=Math.max(.1,p.gravity/Math.max(.01,p.radiusEarth));
    p.dayHours=solar.dayHours;
    p.yearDays=solar.yearDays;
    p.distanceAU=solar.distanceAU;
    p.axialTiltDeg=solar.axialTiltDeg;
    p.rotationDirection=solar.rotationDirection||1;
    p.rotation=p.rotationDirection*(.18+r()*.08);
    p.atmosDensity=solar.atmosDensity;
    p.atmosChemistry=solar.atmosChemistry;
    p.weatherPreset=solar.weather||'CLEAR';
    p.terrainSeed=(seed^0x9e3779b9)>>>0;
    p.stars=[]; const sr=mulberry32(seed^0x62a9d9ed);
    for(let i=0;i<78;i++) p.stars.push({x:Math.floor(sr()*W),y:Math.floor(sr()*238),b:sr(),tw:sr()*6.28});
    p.clouds=[];
    const isGiant=['jupiter','saturn','uranus','neptune'].includes(solar.renderer);
    const cn=isGiant?0:Math.floor(2+p.cloudCover*18);
    for(let i=0;i<cn;i++) p.clouds.push({lon:r(),lat:.15+r()*.7,frame:Math.floor(r()*12),off:r()*6.28});
    configureWeatherSystems(p,r);
    p.moonData=solar.moons.map((m,i)=>({
      name:m.name, orbit:m.visualOrbit, orbitKm:m.orbitKm, periodDays:m.periodDays,
      radiusKm:m.radiusKm, phase:(i*.91+r()*.45)%(Math.PI*2), direction:m.direction||1,
      frame:m.frame%17, size:m.size, screenX:0, screenY:0, known:true
    }));
    p.lifeText=solar.observation;
    p.noLifeText=solar.observation;
    makePlanetScan(p);
    p.populationBase=solar.populationBase||0;
    Object.assign(p.scan,solar.scan||{});
    p.moonData.forEach((m,i)=>{
      m.scan=makeMoonScan(p,m,i);
      Object.assign(m.scan,solar.moons[i].scan||{});
    });
    configureCivilization(p);
    const saved=parseFloat(storageGet(tempStorageKey(p),''));
    state.temp=Number.isFinite(saved)?clamp(saved,0,1):tempStateFromC(solar.defaultTempC,p);
    syncSolarTemperatureState(p);
    state.info=INFO_CARDS[name] || null;
    state.infoTitle=state.info ? name : null;
    storageSet('planetarium:lastName',name);
    return p;
  }

  const minecraft=name==='MINECRAFT';
  p.worldType=minecraft?'VERDANT':(SPECIAL_WORLD_TYPES[name]||chooseWorldProfile(r));
  const profile=WORLD_PROFILES[p.worldType]||WORLD_PROFILES.TERRESTRIAL;
  p.radius = p.worldType==='DWARF' ? 22+Math.floor(r()*11) : (special && name==='VERY PLANET' ? 54 : 43+Math.floor(r()*18));
  p.rx = p.radius*(.88+r()*.22); p.ry=p.radius*(.91+r()*.18);
  p.water=rangePick(r,profile.water);
  p.mount=p.worldType==='OCEAN'?.82:p.worldType==='DESERT'?.67:p.worldType==='VOLCANIC'?.62:.70+r()*.18;
  p.beach=p.worldType==='OCEAN'?.018:p.worldType==='DESERT'?.055:.025+r()*.035;
  p.cloudCover=rangePick(r,profile.cloud); p.cloudSpeed=(.12+r()*.35)*(r()<.5?-1:1);
  p.target=rangePick(r,profile.target); p.variance=.07+r()*.10;
  if(p.worldType==='VERDANT') p.variance=.11+r()*.09;
  if(p.worldType==='BARREN'||p.worldType==='VOLCANIC') p.variance=.045+r()*.055;
  p.moons = p.worldType==='DWARF' ? Math.min(3,Math.floor(r()*3.5)) : Math.min(4, Math.floor(r()*4.1));
  p.ring = p.worldType==='DWARF' ? r()<.035 : (r()<.15 || ['SATURN','MAGRATHEA','SINGULARITY'].includes(name));
  p.ringTilt = -.34+r()*.68;
  configureProceduralRing(p,r);
  p.radiusKm=p.worldType==='DWARF' ? Math.round(350+r()*1450) : Math.round(1600+p.radius*100+r()*2400);
  p.radiusEarth=p.radiusKm/6371;
  p.density=p.worldType==='DWARF' ? .45+r()*.70 : .72+r()*.72;
  p.gravity=p.worldType==='DWARF' ? clamp(p.radiusEarth*p.density,.02,.30) : clamp(p.radiusEarth*p.density,.16,2.65);
  p.massEarth=Math.max(.03,p.gravity*p.radiusEarth*p.radiusEarth);
  p.dayHours=p.worldType==='DWARF'?Math.round((18+r()*180)*10)/10:Math.round((7+r()*43)*10)/10;
  p.yearDays=p.worldType==='DWARF'?Math.round(1200+r()*120000):Math.round(74+r()*812);
  p.rotationDirection=r()<.16?-1:1;
  p.rotation=p.rotationDirection*(.18+r()*.24);
  p.atmosDensity=pick(r,profile.atmos);
  p.atmosChemistry=pick(r,profile.chem);
  if(p.atmosDensity==='NONE') p.atmosChemistry='NONE';
  if(p.worldType==='BARREN' && p.atmosDensity!=='NONE' && r()<.50) p.atmosDensity='TRACE';
  if(p.worldType==='TOXIC' && p.atmosDensity==='DENSE' && r()<.34) p.atmosDensity='SUPERDENSE';
  if(minecraft){
    // The only deliberately non-spherical world in Planetarium.
    p.shape='cube'; p.worldType='VERDANT';
    p.radius=42; p.rx=42; p.ry=42;
    p.water=.38; p.mount=.72; p.beach=.025;
    p.cloudCover=.36; p.cloudSpeed=.22;
    p.target=.56; p.variance=.30;
    p.moons=1; p.ring=false;
    p.radiusKm=6371; p.radiusEarth=1;
    p.density=1; p.gravity=1; p.massEarth=1;
    p.dayHours=20; p.yearDays=360;
    p.rotationDirection=1; p.rotation=.24;
    p.atmosDensity='NORMAL'; p.atmosChemistry='N2 / O2'; p.weatherPreset='BLOCK CLOUDS';
  }else p.shape='sphere';
  p.terrainSeed=(seed^0x9e3779b9)>>>0;
  p.stars=[]; const sr=mulberry32(seed^0x62a9d9ed);
  for(let i=0;i<78;i++) p.stars.push({x:Math.floor(sr()*W),y:Math.floor(sr()*238),b:sr(),tw:sr()*6.28});
  p.clouds=[];
  const cn=Math.floor((p.atmosDensity==='NONE'?0:4)+p.cloudCover*15*atmosphereStrength(p));
  for(let i=0;i<cn;i++) p.clouds.push({lon:r(),lat:.15+r()*.7,frame:Math.floor(r()*12),off:r()*6.28});
  configureWeatherSystems(p,r);
  p.moonData=[];
  for(let i=0;i<p.moons;i++){
    const visualOrbit=p.radius+24+i*13+r()*16;
    const orbitKm=Math.round((p.radiusKm*(3.1+i*1.7)+24000+i*47000+r()*72000)/100)*100;
    const periodDays=Math.round(clamp(2.6*Math.sqrt(Math.pow(orbitKm/100000,3)/p.massEarth),2.5,96)*10)/10;
    p.moonData.push({
      name:moonName(r,i), orbit:visualOrbit, orbitKm, periodDays,
      radiusKm:Math.round(120+r()*2100), phase:r()*Math.PI*2, direction:(i%2?-1:1),
      frame:Math.floor(r()*17), size:.65+r()*.35, screenX:0, screenY:0
    });
  }
  const loc=pick(r,Object.keys(locationParts));
  p.lifeText=`THE ${pick(r,locationParts[loc])} ARE HOME TO ${pick(r,quant)} ${pick(r,looks)} ${pick(r,build)} ${pick(r,creatures)}. SOME OF THEM APPEAR TO BE ${pick(r,behaviours)}.`;
  p.noLifeText = r()<.5 ? 'PRESENTLY, NO LIFE REMAINS.' : 'NO SIGNS OF LIFE ARE VISIBLE AT THIS TEMPERATURE.';
  makePlanetScan(p);
  if(minecraft){
    p.populationBase=7;
    p.scan.lifeTypePotential='INTELLIGENT';
    p.scan.techPotential='PRE-INDUSTRIAL';
    p.scan.tectonics='BLOCKY';
    p.scan.volcanism='LAVA POCKETS';
    p.scan.anomaly='IMPOSSIBLE CUBIC PLANETARY GEOMETRY';
    p.lifeText='VOXEL FORESTS, VILLAGES AND CAVE SYSTEMS COVER THE CUBIC SURFACE. HOSTILE CREATURES BECOME ACTIVE AFTER LOCAL SUNSET.';
    if(p.moonData[0]){
      p.moonData[0].name='BLOCK MOON';
      p.moonData[0].radiusKm=820;
      p.moonData[0].orbitKm=240000;
      p.moonData[0].periodDays=18;
    }
  }
  if(!minecraft&&!lorePreset) configureRarePlanetDamage(p,r);
  if(lorePreset){
    applyLorePreset(p,lorePreset,r);
  }else{
    p.moonData.forEach((m,i)=>{m.scan=makeMoonScan(p,m,i);});
    configureCivilization(p);
    const saved=parseFloat(storageGet(tempStorageKey(p),''));
    state.temp=Number.isFinite(saved)?clamp(saved,0,1):(special?.cold?.12:special?.hot?.84:clamp(p.target+(r()-.5)*.4,0,1));
  }
  state.info=INFO_CARDS[name] || null;
  state.infoTitle=state.info ? name : null;
  storageSet('planetarium:lastName',name);
  return p;
}
function visit(name, addHistory=true){
  name=canonicalPlanetName(name); if(!name) return;
  if(addHistory){
    state.history=state.history.filter(v=>v!==name);
    state.history.push(name);
    state.history=state.history.slice(-40); state.historyPos=state.history.length;
    storageSet('planetarium:history',JSON.stringify(state.history));
  }
  state.name=name; state.input=''; state.enteringName=false; state.intro=false; state.phase=0; state.simDays=0;
  state.rocket=null; state.probe=null; state.spaceLaunchSerial=0; state.pinnedBody=null; state.hoverBody=null; state.moonHoverGrace=null; state.moonHoverUntil=0; state.moonInspect=null; state.libraryOpen=false;
  state.lifeScroll=0; state.lifeScrollMax=0; state.lifePanelRect=null; state.lifePanelFocused=false; state.lifePanelKey='';
  state.infoScroll=0; state.infoScrollMax=0; state.infoPanelRect=null; state.infoPanelFocused=false; state.infoPanelKey='';
  planet=generatePlanet(state.name);
  normalizeViewModeForPlanet();
  document.title=`${planet.name} - Planetarium`;
  syncUrl();
}
function randomVisit(){ visit(randomPlanetName()); }
planet=generatePlanet(state.name);
normalizeViewModeForPlanet();
state.name=planet.name;
if(Number.isFinite(urlTempC)){ state.temp=tempStateFromC(urlTempC,planet); storageSet(tempStorageKey(planet),String(state.temp)); }
if(urlPlanet){
  state.history=state.history.filter(v=>v!==planet.name); state.history.push(planet.name); state.history=state.history.slice(-40);
  state.historyPos=state.history.length; storageSet('planetarium:history',JSON.stringify(state.history));
}
document.title=`${planet.name} - Planetarium`;
queueMicrotask(()=>syncUrl());

function isAlive(){
  if(planet.destroyedProcedural) return false;
  if(planet.solar){
    if(planet.name==='MARS') return marsTerraformStage()>=2;
    if(!planet.solar.life) return false;
    return Math.abs(tempC()-planet.solar.defaultTempC)<=planet.solar.lifeToleranceC;
  }
  if(planet.special && typeof planet.special.life==='boolean') return planet.special.life;
  return Math.abs(state.temp-planet.target)<=planet.variance;
}
function tempC(){ return tempCFromState(state.temp,planet); }
function tempBand(){ return clamp(Math.floor(state.temp*5),0,4); }
function marsTerraformStage(t=tempC()){
  if(planet?.name!=='MARS') return 0;
  if(t>=34) return 3; // verdant / heavily terraformed
  if(t>=8) return 2;  // open water + colonies
  if(t>=-8) return 1; // thawing desert
  return 0;
}
function periodicNoise01(lon,lat,fx,fy,seed){
  return valueNoise(lon*fx,lat*fy,seed,fx);
}
function syncSolarTemperatureState(p=planet){
  if(!p?.solar) return;
  if(p.name==='MARS'){
    const t=tempCFromState(state.temp,p);
    const stage=t>=34?3:t>=8?2:t>=-8?1:0;
    if(p._marsClimateStage!==stage){
      p._marsClimateStage=stage;
      const covers=[.06,.17,.46,.66], waters=[.03,.08,.30,.50];
      p.cloudCover=covers[stage]; p.water=waters[stage];
      p.atmosDensity=stage>=2?'NORMAL':'THIN';
      p.atmosChemistry=stage>=3?'N2 / O2 / CO2':stage>=2?'N2 / CO2 / O2':'CO2 / N2 / AR';
      p.weatherPreset=stage>=3?'RAIN / STORMS':stage>=2?'CLOUDS / SHOWERS':stage>=1?'THAW MISTS':'DUST STORMS';
      p._atmosBaseColor=null; p._atmosAccentColor=null;
      if(stage===0){p.scan.pressureAtm=.006;p.scan.pressureText='0.006 ATM';p.scan.oxygen=.13;p.scan.nitrogen=1.9;p.scan.co2=95.3;p.scan.oceanDepthKm=0;}
      else if(stage===1){p.scan.pressureAtm=.05;p.scan.pressureText='0.05 ATM';p.scan.oxygen=.4;p.scan.nitrogen=9;p.scan.co2=89;p.scan.oceanDepthKm=.2;}
      else if(stage===2){p.scan.pressureAtm=.42;p.scan.pressureText='0.42 ATM';p.scan.oxygen=7.8;p.scan.nitrogen=62;p.scan.co2=28;p.scan.oceanDepthKm=1.2;}
      else {p.scan.pressureAtm=.86;p.scan.pressureText='0.86 ATM';p.scan.oxygen=18.2;p.scan.nitrogen=73;p.scan.co2=5.5;p.scan.oceanDepthKm=2.7;}
      configureWeatherSystems(p,mulberry32(hashString(`MARS:CLIMATE:${stage}`)));
      p.hurricanePotential=stage>=3;
    }
    if(stage>=2){
      p.scan.lifeTypePotential=stage>=3?'INTELLIGENT':'MICROBIAL';
      p.scan.techPotential='INTERPLANETARY';
      p.populationBase=stage>=3?5:4;
      configureCivilization(p);
    }else{
      p.scan.lifeTypePotential='NONE';
      p.scan.techPotential='NONE';
      p.populationBase=0;
      p.civilization=null;
    }
  }
}

function surfaceWaterPercent(){
  if(planet.solar){
    const t=tempC();
    if(planet.name==='EARTH'){
      const frozen=t<0?clamp((t+55)/55,0,1):1;
      const boiled=t>100?clamp((155-t)/55,0,1):1;
      return Math.round(71*Math.min(frozen,boiled));
    }
    if(planet.name==='MARS'){
      if(t< -20) return 1;
      if(t< 0) return 4;
      if(t< 10) return 12;
      if(t< 22) return 28;
      if(t< 36) return 46;
      if(t< 56) return 58;
      return 44;
    }
    return 0;
  }
  const freeze=state.temp<.24 ? lerp(.38,1,(state.temp/.24)) : 1;
  const boil=state.temp>.82 ? lerp(1,.35,(state.temp-.82)/.18) : 1;
  return Math.round(clamp(planet.water*freeze*boil,0,.95)*100);
}
function worldClass(){
  if(planet.destroyedProcedural) return 'DESTROYED WORLD';
  if(planet.worldClassOverride) return planet.worldClassOverride;
  if(planet.solar){
    if(planet.name==='MARS'){
      const stage=marsTerraformStage(), water=surfaceWaterPercent();
      if(stage>=3) return water>=40?'VERDANT MARS':'TERRAFORMED MARS';
      if(stage>=2) return water>=34?'OCEANIC MARS':'TERRAFORMED MARS';
      if(stage>=1) return 'THAWING MARS';
      return 'DESERT WORLD';
    }
    return planet.solar.worldClass;
  }
  if(planet.name==='MINECRAFT') return 'CUBIC VOXEL WORLD';
  if(planet.special?.dark) return 'DARK WORLD';
  if(state.temp<.12) return 'ICE WORLD';
  if(state.temp>.93) return 'LAVA WORLD';
  if(planet.worldType==='OCEAN' && surfaceWaterPercent()>58) return surfaceWaterPercent()>82?'DEEP OCEAN WORLD':'OCEAN WORLD';
  if(planet.worldType==='DESERT' && surfaceWaterPercent()<22) return 'DESERT WORLD';
  if(planet.worldType==='ICE') return 'ICE WORLD';
  if(planet.worldType==='VOLCANIC') return 'VOLCANIC WORLD';
  if(planet.worldType==='TOXIC') return 'TOXIC WORLD';
  if(planet.worldType==='BARREN') return 'BARREN WORLD';
  if(planet.worldType==='DWARF') return state.temp<.30?'ICY DWARF PLANET':'DWARF PLANET';
  if(planet.worldType==='VERDANT') return 'VERDANT WORLD';
  if(state.temp>.78 && planet.water<.48) return 'DESERT WORLD';
  if(surfaceWaterPercent()>68) return 'OCEAN WORLD';
  if(planet.radiusEarth>1.35) return 'SUPER-EARTH';
  if(planet.atmosDensity==='TRACE' && planet.water<.42) return 'BARREN WORLD';
  return 'TERRESTRIAL WORLD';
}
function atmosphereLabel(){
  const c=(planet.atmosChemistry||'NONE');
  const compact=({'HYDROGEN SULFIDE':'H2S','CHLORINE':'CL2','METALLIC VAPOR':'METAL VAPOR','WATER VAPOR':'H2O VAPOR'}[c]||c).replace(/\s*\/\s*/g,'/');
  return `${planet.atmosDensity} ${compact}`;
}
function atmosphereBaseColor(p=planet){
  if(p?._atmosBaseColor) return p._atmosBaseColor;
  const c=(p?.atmosChemistry||'').toUpperCase(); let col=C.purple;
  if(p?.atmosDensity==='NONE') col=C.black;
  else if(c.includes('CH4')||c.includes('METHANE')) col=C.cyan;
  else if(c.includes('CHLORINE')) col=mixHex(C.green,C.yellow,.35);
  else if(c.includes('H2S')) col=mixHex(C.yellow,C.green,.22);
  else if(c.includes('METALLIC')) col=mixHex(C.purple,C.white,.22);
  else if(c.includes('CO2')) col=mixHex(C.yellow,C.red,.28);
  else if(c.includes('SULF')||c.includes('SO2')) col=C.yellow;
  else if(c.includes('H2')||c.includes('HE')||c.includes('NE')) col=mixHex(C.yellow,C.white,.42);
  else if(c.includes('WATER')) col=C.cyan;
  else if(c.includes('AMMONIA')) col=mixHex(C.white,C.yellow,.20);
  else if(c.includes('ARGON')) col=mixHex(C.purple,C.blue,.34);
  else if(c.includes('N2')||c.includes('NITROGEN')||c.includes('O2')) col=mixHex(C.blue,C.cyan,.26);
  else if(c.includes('EXOTIC')) col=mixHex(C.purple,C.red,.28);
  else if(c.includes('EXOSPHERE')||c.includes('NA')) col=mixHex(C.blue,C.purple,.45);
  if(p) p._atmosBaseColor=col; return col;
}
function atmosphereAccentColor(p=planet){
  if(p?._atmosAccentColor) return p._atmosAccentColor;
  const c=(p?.atmosChemistry||'').toUpperCase(); let col=C.purple;
  if(c.includes('CHLORINE')||c.includes('H2S')) col=C.green;
  else if(c.includes('METALLIC')||c.includes('EXOTIC')) col=C.purple;
  else if(c.includes('CO2')||c.includes('SULF')||c.includes('SO2')) col=C.yellow;
  else if(c.includes('CH4')||c.includes('METHANE')) col=C.blue;
  else if(c.includes('H2')||c.includes('HE')||c.includes('NE')||c.includes('AMMONIA')) col=C.white;
  else if(c.includes('WATER')||c.includes('N2')||c.includes('O2')) col=C.cyan;
  if(p) p._atmosAccentColor=col; return col;
}
function hurricaneConditions(p=planet){
  const t=tempC(), water=surfaceWaterPercent(), strength=atmosphereStrength(p), c=(p?.atmosChemistry||'').toUpperCase();
  const compatible=!c.includes('H2')&&!c.includes('HE')&&!c.includes('SULF')&&!c.includes('SO2')&&!c.includes('EXOTIC')&&!c.includes('CHLORINE')&&!c.includes('H2S')&&!c.includes('METALLIC')&&!c.includes('AMMONIA');
  return !!p?.hurricanePotential && compatible && strength>=.55 && water>=35 && t>=10 && t<=42;
}
function weatherLabel(){
  const strength=atmosphereStrength(planet), c=(planet.atmosChemistry||'').toUpperCase(), t=tempC(), water=surfaceWaterPercent();
  if(strength<=.08) return planet.weatherPreset||'NONE';
  if(planet.name==='EARTH'){
    if(t>70) return 'STEAM STORMS';
    if(t<-25) return 'BLIZZARDS';
    if(hurricaneConditions()) return 'RAIN / HURRICANES';
    return 'RAIN / STORMS';
  }
  if(planet.name==='MARS'){
    const stage=marsTerraformStage();
    if(stage>=3) return 'RAIN / STORMS';
    if(stage>=2) return 'CLOUDS / SHOWERS';
    if(stage>=1) return 'THAW MISTS';
    return 'DUST STORMS';
  }
  if(hurricaneConditions()) return 'RAIN / HURRICANES';
  if(planet.solar && planet.weatherPreset) return planet.weatherPreset;
  if(c.includes('CHLORINE')) return strength>.8?'CHLORINE SUPERSTORMS':'CHLORINE HAZE';
  if(c.includes('H2S')) return 'TOXIC SQUALLS';
  if(c.includes('METALLIC')) return t>45?'METAL VAPOR STORMS':'METALLIC HAZE';
  if(c.includes('H2')||c.includes('HE')) return strength>.8?'JET SUPERSTORMS':'JET STORMS';
  if(c.includes('AMMONIA')) return t<-20?'AMMONIA SNOW':'AMMONIA STORMS';
  if(c.includes('SULF')||c.includes('SO2')) return strength>.75?'ACID SUPERSTORMS':'ACID CLOUDS';
  if(c.includes('CO2') && water<15) return t>35?'DUST SUPERSTORMS':'DUST STORMS';
  if((c.includes('CH4')||c.includes('METHANE')) && t<15) return strength>.7?'METHANE RAIN':'METHANE HAZE';
  if(c.includes('WATER') && t>45) return 'STEAM STORMS';
  if(c.includes('EXOTIC')) return strength>.65?'ELECTRIC SUPERSTORMS':'ELECTRIC STORMS';
  if(t<-40) return strength>.55?'BLIZZARDS':'ICE CLOUDS';
  if(t>68 && strength>=.8) return 'SUPERSTORMS';
  if(water>55 && strength>.55) return 'MONSOONS';
  if(water>18) return 'RAIN / STORMS';
  return strength>=.8?'THICK CLOUDS':'CLOUDS';
}
function compactAtmosphereChemistry(){ return (planet.atmosChemistry||'NONE').replace(/\s*\/\s*/g,'/').replace(/\s+/g,' '); }
function compactWeatherLabel(){ const w=weatherLabel(); return ({
  'RAIN / HURRICANES':'HURRICANES','SULFURIC ACID CLOUDS':'ACID CLOUDS','SUPERSONIC STORMS':'SUPERSONIC','METHANE CLOUDS':'CH4 CLOUDS','RAIN / STORMS':'RAIN/STORMS',
  'CHLORINE SUPERSTORMS':'CL2 SUPERSTORMS','CHLORINE HAZE':'CL2 HAZE','DUST SUPERSTORMS':'DUST SUPERSTORMS','JET SUPERSTORMS':'JET SUPERSTORMS',
  'ACID SUPERSTORMS':'ACID SUPERSTORMS','ELECTRIC SUPERSTORMS':'ELECTRIC STORMS','METAL VAPOR STORMS':'METAL STORMS','AMMONIA STORMS':'NH3 STORMS',
  'AMMONIA SNOW':'NH3 SNOW','TOXIC SQUALLS':'TOXIC SQUALLS','METHANE RAIN':'CH4 RAIN'
}[w]||w); }
function atmosphereViewColor(lon,lat,nx,z){
  const strength=atmosphereStrength(planet), base=atmosphereBaseColor(), accent=atmosphereAccentColor();
  if(strength<=.02) return surfaceShade(C.black,nx,z);
  const c=(planet.atmosChemistry||'').toUpperCase(), drift=state.simDays*(.0025+strength*.0035);
  // Every longitude sample below is explicitly periodic. The old version mixed
  // arbitrary noise periods (9/34/17) with a 64-cell sampler, leaving a visible
  // 0°/360° seam when the atmosphere rotated across the front of the planet.
  const coarse=periodicNoise01(mod(lon+drift,1),lat,12,7,planet.terrainSeed^0x6d2b79f5);
  const fine=periodicNoise01(mod(lon-drift*1.7,1),lat,36,25,planet.terrainSeed^0x419b2d31);
  const curl=periodicNoise01(mod(lon+drift*.72,1),lat+(coarse-.5)*.08,20,14,planet.terrainSeed^0x1ca7b58d);
  let col=base;
  if(c.includes('H2')||c.includes('HE')||c.includes('AMMONIA')){
    const band=Math.sin((lat*(18+strength*12)+(coarse-.5)*1.4)*Math.PI)*.5+.5;
    col=mixHex(base,accent,clamp(.08+band*.52+(fine-.5)*.14,0,.68));
  }else if(c.includes('CH4')||c.includes('METHANE')){
    const haze=clamp(.18+coarse*.46+Math.sin((lon*8+lat*13+curl)*Math.PI)*.12,0,.72);
    col=mixHex(base,accent,haze);
    if(fine>.72) col=mixHex(col,C.white,.18);
  }else if(c.includes('SULF')||c.includes('SO2')||c.includes('CHLORINE')||c.includes('H2S')){
    // 12 instead of 11 keeps the sinusoid identical at lon=0 and lon=1.
    const swirl=Math.sin((lon*12+lat*7+(coarse-.5)*2+drift*4)*Math.PI)*.5+.5;
    col=mixHex(base,accent,clamp(.10+swirl*.46+(fine-.5)*.18,0,.72));
    if(curl>.72) col=mixHex(col,C.black,.12);
  }else if(c.includes('WATER')||c.includes('N2')||c.includes('O2')||c.includes('NITROGEN')){
    const cells=clamp((coarse*.65+fine*.35),0,1);
    col=mixHex(base,accent,.12+cells*.34);
    if(fine>.78) col=mixHex(col,C.white,.28);
  }else if(c.includes('METALLIC')||c.includes('EXOTIC')){
    const arcs=Math.abs(Math.sin((lon*20+lat*15+drift*8+fine)*Math.PI));
    col=mixHex(base,accent,.12+coarse*.28);
    if(arcs>.90) col=mixHex(col,C.white,.45);
    else if(curl<.25) col=mixHex(col,C.black,.18);
  }else{
    const bands=Math.sin((lat*(12+strength*10)+(coarse-.5)*1.2)*Math.PI)*.5+.5;
    col=mixHex(base,accent,clamp(.10+bands*.36+(fine-.5)*.25,0,.58));
  }
  if(strength<.2) col=mixHex(C.black,col,.55); else if(strength>.82) col=mixHex(col,C.white,.07);
  return surfaceShade(col,nx,z);
}
function lifeLabel(){
  if(planet.lifeLabelOverride) return planet.lifeLabelOverride;
  if(!isAlive()) return 'NONE';
  if(planet.name==='MARS'){
    const stage=marsTerraformStage();
    return stage>=3?'ABUNDANT':stage>=2?'ACTIVE':'SPARSE';
  }
  const d=Math.abs(state.temp-planet.target)/Math.max(.001,planet.variance);
  return d<.30?'ABUNDANT':d<.68?'ACTIVE':'SPARSE';
}
function populationLabel(){
  if(planet.populationLabelOverride) return planet.populationLabelOverride;
  if(!isAlive()) return 'NONE';
  if(planet.name==='MARS'){
    const stage=marsTerraformStage();
    return stage>=3?'MANY':stage>=2?'SOME':'TRACE';
  }
  const d=Math.abs(state.temp-planet.target)/Math.max(.001,planet.variance);
  const penalty=d<.22?0:d<.48?1:d<.74?2:3;
  return POPULATION_WORDS[clamp(planet.populationBase-penalty,1,POPULATION_WORDS.length-1)];
}
function lifeTypeLabel(){
  if(planet.lifeTypeOverride) return planet.lifeTypeOverride;
  if(!isAlive()) return 'NONE';
  if(planet.name==='MARS') return marsTerraformStage()>=3?'INTELLIGENT':'MICROBIAL';
  return planet.scan.lifeTypePotential;
}
function techLevelLabel(){
  if(planet.techLevelOverride) return planet.techLevelOverride;
  if(!isAlive()) return 'NONE';
  if(planet.name==='MARS') return 'INTERPLANETARY';
  return planet.scan.techPotential;
}
function lifeEnvironmentKey(){
  const t=tempC(), water=surfaceWaterPercent(), ice=iceCoverPercent(), strength=atmosphereStrength(planet);
  if(ice>=45 || t<-22) return 'COLD';
  if(water>=62) return 'OCEAN';
  if(water<=12 || t>=48) return 'DRY';
  if(strength>=1.25 || planet.atmosDensity==='SUPERDENSE') return 'DENSE';
  if((planet.atmosChemistry||'').includes('WATER') || water>=28) return 'WET';
  return 'TEMPERATE';
}
const LIFE_NAME_START=['KA','KEL','THA','VEL','ZOR','XEL','MER','SEN','ARI','TAL','VOR','NEM','PHA','RIN','UL','YAR','KETH','ORA','SAI','DRA'];
const LIFE_NAME_END=['RI','RA','AN','EN','I','AE','OR','ETH','UN','ARA','IX','AL','OS','UM','EI','ON','IS','U','ESH','ARI'];
function alienSpeciesName(r){ return `${pick(r,LIFE_NAME_START)}${pick(r,LIFE_NAME_END)}`; }
function lifeSpecies(r,env,kind){
  const pools={
    MICROBIAL:{
      COLD:['CRYOPHILIC ARCHAEA','ICE-VEIN BACTERIA','ANTIFREEZE MICROBES','PALE BIOFILMS','GEOTHERMAL BACTERIAL MATS','SPORE-FORMING CRYOBES'],
      OCEAN:['CHEMOSYNTHETIC BACTERIA','FLOATING CYANOBACTERIA','DEEP-SEA ARCHAEA','LUMINOUS PLANKTON','SALT-TOLERANT MICROBES','HYDROTHERMAL BIOFILMS'],
      DRY:['DORMANT SPORE BACTERIA','ROCK-BORING MICROBES','SALT-CRUST ARCHAEA','RADIOTROPHIC BIOFILMS','DESICCATION-RESISTANT BACTERIA','SUBSURFACE METHANOGENS'],
      DENSE:['AEROSOL BACTERIA','FLOATING MICROBIAL COLONIES','CLOUD-DWELLING SPORES','ACID-TOLERANT ARCHAEA','ATMOSPHERIC PLANKTON','ELECTROSTATIC BIOFILMS'],
      WET:['PHOTOSYNTHETIC BACTERIAL MATS','SULFUR-REDUCING MICROBES','RIVER BIOFILMS','SPORE CLOUDS','IRON-EATING BACTERIA','METHANE-FEEDING ARCHAEA'],
      TEMPERATE:['CYANOBACTERIAL MATS','MAGNETOTACTIC BACTERIA','SOIL ARCHAEA','PHOTOSYNTHETIC MICROBES','FILAMENTOUS BACTERIA','SYMBIOTIC BIOFILMS']
    },
    SIMPLE:{
      COLD:['GLACIER LICHEN FIELDS','PALE FUNGAL MATS','ICE-ROOT COLONIES','CRYSTAL ALGAE','SNOW SPORE BLOOMS','THERMAL-VENT TUBE COLONIES'],
      OCEAN:['REEF POLYPS','RIBBON ALGAE','FILTER-FEEDING COLONIES','FLOATING KELP ANALOGUES','GELATINOUS BLOOMS','LUMINOUS REEF MATS'],
      DRY:['DUST LICHENS','WATER-STORING FUNGAL TOWERS','ROOTED SPORE MATS','SALT-VINE COLONIES','DORMANT BULB FIELDS','STONE-SKIN SUCCULENT ANALOGUES'],
      DENSE:['SKY MATS','FLOATING SPORE COLONIES','GAS-BLADDER BLOOMS','CLOUD FUNGI','AERIAL FILTER COLONIES','HANGING VINE ANALOGUES'],
      WET:['FUNGAL TOWERS','MARSH POLYPS','RIVER ALGAE','SPORE FORESTS','VINE MATS','AMPHIBIOUS REEF COLONIES'],
      TEMPERATE:['LICHEN FORESTS','FUNGAL GROVES','ROOTED FILTER COLONIES','ALGAE-LIKE MEADOWS','SPORE TREES','MOSS-LIKE CARPETS']
    },
    COMPLEX:{
      COLD:['GLACIER CRAWLERS','PALE ICE BURROWERS','FUR-BEARING HEXAPODS','SNOW STALKERS','THERMAL-VENT SWIMMERS','SHELLBACK TUNDRA GRAZERS','ICE-SAIL HUNTERS','CRYSTAL-HORN HERD BEASTS'],
      OCEAN:['LANTERN JELLIES','GLASSFIN SWIMMERS','RIBBON EELS','SHELLBACK GRAZERS','REEF STALKERS','BLADEFIN HUNTERS','SIX-FINNED FILTER FEEDERS','GIANT SAILBACK SWIMMERS','INK-CLOUD CEPHALOPODS','ARMOURED TIDE CRAWLERS'],
      DRY:['DUNE RUNNERS','SAND BURROWERS','PLATEBACK GRAZERS','DUST STRIDERS','NIGHT-HUNTING SERPENTS','SALT-FLAT CRAWLERS','HEAT-SHIELD BEETLE ANALOGUES','LONG-LEGGED SCAVENGERS','CANYON GLIDERS','STONE-SHELL HERD BEASTS'],
      DENSE:['CLOUD MANTAS','SKY JELLIES','SAILWINGS','GAS-BLADDER FLOATERS','AERIAL FILTER FEEDERS','STORM RIDERS','BALLOON PREDATORS','FLOATING GRAZER HERDS','WINGED AMBUSH HUNTERS','ELECTRIC CLOUD EELS'],
      WET:['MUDSKIPPERS','RIVER STALKERS','AMPHIBIOUS GRAZERS','MOSSBACK HERD BEASTS','SWAMP STRIDERS','SIX-LEGGED CROAKERS','REED AMBUSHERS','SHELL-CROWNED CRAWLERS','DELTA FILTER FEEDERS','TREE-CLIMBING GLIDERS'],
      TEMPERATE:['MOSSBACK GRAZERS','SIX-LEGGED HERD BEASTS','GLASSWING FLIERS','PACK-HUNTING STALKERS','ARMOURED CRAWLERS','LONG-NECKED BROWSERS','BURROWING RODENT ANALOGUES','FEATHERED RUNNERS','LANTERN MOTHS','TREE-DWELLING GLIDERS','PLATEBACK PREDATORS','SOCIAL TUNNELERS']
    }
  };
  const group=pools[kind]||pools.COMPLEX;
  return pick(r,group[env]||group.TEMPERATE);
}
function lifeProbeObservation(){
  if(!isAlive()) return '';
  const env=lifeEnvironmentKey();
  const life=lifeTypeLabel();
  const r=mulberry32(hashString(`${planet.seed}:${env}:${life}:${lifeLabel()}:${populationLabel()}`)^0x4c494645);
  if(planet.name==='EARTH'){
    return pick(r,[
      'HUMANS SHARE THE PLANET WITH MILLIONS OF KNOWN SPECIES, FROM OCEANIC PLANKTON AND FUNGI TO INSECTS, WHALES AND FORESTS.',
      'COMPLEX FOOD WEBS COVER LAND AND SEA. HUMANS ARE THE DOMINANT TECHNOLOGICAL SPECIES, BUT MICROBIAL LIFE STILL MAKES UP MUCH OF THE BIOSPHERE.',
      'OCEANS ARE RICH IN PLANKTON, REEFS AND LARGE ANIMALS; LAND SUPPORTS FORESTS, FUNGI, INSECTS, BIRDS, MAMMALS AND HUMAN CIVILIZATION.'
    ]);
  }
  if(planet.name==='MINECRAFT'){
    return 'VOXELATED VILLAGERS BUILD BLOCK SETTLEMENTS ACROSS THE CUBIC SURFACE. CREEPERS, SKELETONS, SPIDERS AND ZOMBIES BECOME ACTIVE AFTER LOCAL SUNSET, WHILE DEEP CAVE SYSTEMS CONTAIN UNUSUAL MINERAL DEPOSITS.';
  }
  if(planet.name==='MARS'){
    const stage=marsTerraformStage();
    if(stage>=3) return 'MARS NOW SUPPORTS OPEN SEAS, GREEN BASINS AND A GROWING WEB OF SEEDED LIFE. THE HUMANITY ARE ON A WAY TO BUILD A NEW CIVILIZATION THERE.';
    if(stage>=2) return 'SHALLOW OCEANS, ENGINEERED MICROBES AND EXPANDING HABITATS ARE DETECTED. THE HUMANITY ARE ON A WAY TO BUILD A NEW CIVILIZATION THERE.';
  }
  if(planet.loreReport) return planet.loreReport;
  const chemistry=(planet.atmosChemistry||'').toUpperCase();
  const microbialBias=chemistry.includes('SULF')?'SULFUR-METABOLIZING':chemistry.includes('METHANE')||chemistry.includes('CH4')?'METHANE-FEEDING':chemistry.includes('EXOTIC')?'EXOTIC-CHEMISTRY':'';
  if(life==='MICROBIAL'){
    const primary=lifeSpecies(r,env,'MICROBIAL');
    const habitat={COLD:'BENEATH ICE AND AROUND GEOTHERMAL CRACKS',OCEAN:'IN THE WATER COLUMN AND AROUND DEEP VENTS',DRY:'INSIDE ROCK PORES AND BURIED SALT LAYERS',DENSE:'IN STABLE CLOUD LAYERS',WET:'ALONG RIVERS, MUD FLATS AND WARM POOLS',TEMPERATE:'THROUGH SOIL, WATER AND SHALLOW ROCK'}[env];
    const metabolism=microbialBias?`${microbialBias} `:'';
    return `${metabolism}${primary} DOMINATE ${habitat}. ${pick(r,['THEIR COLONIES FORM VISIBLE MATS','MANY ENTER DORMANT SPORE STATES','SEVERAL STRAINS PRODUCE FAINT BIOLUMINESCENCE','THEY BUILD THICK MINERAL-RICH BIOFILMS','DIFFERENT STRAINS COMPETE IN LAYERED COLONIES'])}.`;
  }
  if(life==='SIMPLE'){
    const primary=lifeSpecies(r,env,'SIMPLE'), microbes=lifeSpecies(r,env,'MICROBIAL');
    return `${primary} ARE WIDESPREAD, FED BY ${microbes}. ${pick(r,['THE COLONIES GROW IN LARGE SEASONAL BLOOMS','THEIR SPORES TRAVEL GREAT DISTANCES','MOST GROWTH FOLLOWS WATER AND MINERAL SOURCES','THEY FORM DENSE LAYERS THAT SUPPORT SMALL FILTER FEEDERS','THE COLONIES RETREAT INTO DORMANT FORMS WHEN CONDITIONS WORSEN'])}.`;
  }
  if(life==='INTELLIGENT' || techLevelLabel()!=='NONE'){
    const people=alienSpeciesName(r);
    const body=pick(r,env==='OCEAN'?['AQUATIC CEPHALOPODS','ARMOURED SWIMMERS','AMPHIBIOUS HEXAPODS']:env==='DENSE'?['WINGED HEXAPODS','FLOATING COLONIAL BEINGS','GAS-BLADDERED FLIERS']:env==='DRY'?['BURROWING HEXAPODS','ARMOURED BIPEDS','LONG-LIMBED DESERT DWELLERS']:env==='COLD'?['FUR-BEARING HEXAPODS','SUBGLACIAL AQUATIC BEINGS','STOCKY FOUR-ARMED BIPEDS']:['TOOL-USING HEXAPODS','FEATHERED BIPEDS','CEPHALOPOD-LIKE LAND DWELLERS','ARMOURED QUADRUPEDS','SOCIAL INSECTOID BEINGS','FOUR-ARMED BIPEDS']);
    const settlement=pick(r,env==='OCEAN'?['REEF CITIES','FLOATING SETTLEMENTS','SUBMERGED CITIES']:env==='DENSE'?['CLOUD COLONIES','SUSPENDED SETTLEMENTS','HIGH-ALTITUDE CITIES']:env==='DRY'?['CANYON SETTLEMENTS','SUBTERRANEAN CITIES','OASIS CITADELS']:env==='COLD'?['GEOTHERMAL CITIES','SUBGLACIAL SETTLEMENTS','INSULATED VALLEY CITIES']:['RIVER CITIES','TERRACED SETTLEMENTS','FOREST CITIES','COASTAL SETTLEMENTS','UNDERGROUND CITIES']);
    const tech=techLevelLabel();
    const signal=noLocalOrbit()
      ? 'NO STABLE ORBITAL TRAFFIC IS PRESENT; LONG-RANGE TRADE AND TRANSIT HOLD FAR FROM THE PLANET WHILE SURFACE SETTLEMENTS, SPICE OPERATIONS AND RADIO EMISSIONS REMAIN CLEARLY DETECTABLE'
      : tech==='INTERPLANETARY'?'DENSE ORBITAL TRAFFIC, STATIONS AND REGULAR MOON MISSIONS ARE DETECTED':tech==='ORBITAL'?'MULTIPLE SATELLITES, CREWED STATIONS AND RADIO TRAFFIC SURROUND THE PLANET':tech==='EARLY SPACEFLIGHT'?'A SMALL SATELLITE NETWORK AND RADIO EMISSIONS ARE DETECTED':tech==='INDUSTRIAL'?'RADIO EMISSIONS AND LARGE INDUSTRIAL SITES ARE DETECTED':tech==='PRE-INDUSTRIAL'?'LARGE ROAD NETWORKS AND AGRICULTURAL REGIONS ARE VISIBLE':'STONEWORK, TOOLS AND ORGANIZED SETTLEMENTS ARE VISIBLE';
    const space=planet.civilization?.story?` ${planet.civilization.story}.`:'';
    return `THE ${people}, ${body}, BUILD ${settlement}. ${signal}.${space}`;
  }
  const a=lifeSpecies(r,env,'COMPLEX'), b=lifeSpecies(r,env,r()<.35?'SIMPLE':'COMPLEX');
  const relationship=pick(r,[
    `${a} GRAZE IN LARGE GROUPS WHILE ${b} FOLLOW THEIR MIGRATIONS`,
    `${a} ARE COMMON PREY FOR ${b}`,
    `${a} AND ${b} OCCUPY DIFFERENT LAYERS OF THE SAME ECOSYSTEM`,
    `${a} FORM LARGE SEASONAL MIGRATIONS; ${b} CONGREGATE AROUND THEIR BREEDING GROUNDS`,
    `${a} LIVE IN SOCIAL COLONIES WHILE ${b} PATROL THE SURROUNDING TERRITORY`,
    `${a} BUILD NESTING GROUNDS THAT ALSO SHELTER ${b}`
  ]);
  const trait=pick(r,[
    'BIOLUMINESCENT MARKINGS ARE COMMON','MANY SPECIES USE COLOUR CHANGES TO COMMUNICATE','ARMOURED BODY PLATES ARE WIDESPREAD','SIX-LIMBED BODY PLANS DOMINATE THE REGION','SEVERAL SPECIES USE ELECTRIC SENSES','MANY ANIMALS ENTER LONG DORMANT SEASONS','PACK AND HERD BEHAVIOUR IS COMMON','COMPLEX MATING DISPLAYS HAVE BEEN OBSERVED'
  ]);
  return `${relationship}. ${trait}.`;
}
function lifePanelHovered(){
  const r=state.lifePanelRect;
  return !!r && state.mouse.inside && pointInRect(state.mouse,r.x,r.y,r.w,r.h);
}
function scrollLifePanel(delta){
  if(!state.lifePanelRect || state.lifeScrollMax<=0) return false;
  state.lifeScroll=clamp(state.lifeScroll+delta,0,state.lifeScrollMax);
  return true;
}
function drawLifeProbeFact(x,y,maxPx=124,maxBottom=232){
  const fact=lifeProbeObservation();
  state.lifePanelRect=null;
  if(!fact || y>maxBottom-18) {
    state.lifeScroll=0; state.lifeScrollMax=0; state.lifePanelFocused=false;
    return false;
  }
  const key=`${planet.seed}:${tempBand()}:${weatherLabel()}:${lifeTypeLabel()}:${fact}`;
  if(state.lifePanelKey!==key){
    state.lifePanelKey=key;
    state.lifeScroll=0;
  }
  const lineH=8, contentY=y+10;
  const all=wrapText(fact,maxPx,1);
  const visibleLines=Math.max(1,Math.floor((maxBottom-contentY)/lineH)+1);
  state.lifeScrollMax=Math.max(0,all.length-visibleLines);
  state.lifeScroll=clamp(state.lifeScroll,0,state.lifeScrollMax);
  const panelW=maxPx+13;
  state.lifePanelRect={x:x-8,y:y-4,w:panelW,h:maxBottom-y+8};
  const hovered=lifePanelHovered();
  const active=hovered||state.lifePanelFocused;

  drawText('LIFE OBSERVED',x,y,C.green,1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x-1,contentY-1,maxPx+2,maxBottom-contentY+4);
  ctx.clip();
  const first=Math.floor(state.lifeScroll);
  const frac=state.lifeScroll-first;
  for(let i=0;i<visibleLines+1;i++){
    const line=all[first+i];
    if(line===undefined) break;
    drawText(line,x,contentY+i*lineH-frac*lineH,C.green,1);
  }
  ctx.restore();

  if(state.lifeScrollMax>0 && hovered){
    const trackX=x-6, trackY=contentY, trackH=Math.max(8,maxBottom-contentY+2);
    ctx.fillStyle=mixHex(C.green,C.black,.62);
    for(let py=trackY;py<trackY+trackH;py+=3) ctx.fillRect(trackX,py,1,1);
    const thumbH=Math.max(4,Math.round(trackH*(visibleLines/all.length)));
    const travel=Math.max(0,trackH-thumbH);
    const thumbY=trackY+Math.round(travel*(state.lifeScroll/state.lifeScrollMax));
    ctx.fillStyle=active?C.green:C.purple;
    ctx.fillRect(trackX,thumbY,2,thumbH);
  }
  if(active) drawFocusFrame(state.lifePanelRect.x,state.lifePanelRect.y,state.lifePanelRect.w,state.lifePanelRect.h);
  return true;
}

function iceCoverPercent(){
  if(planet.solar){
    const t=tempC();
    if(planet.name==='EARTH') return Math.round(clamp(8+(15-t)*1.25,1,98));
    if(planet.name==='MARS') return Math.round(clamp(18+(-63-t)*.28,2,65));
    return 0;
  }
  const cold=clamp((.43-state.temp)/.43,0,1);
  return Math.round(clamp(cold*(34+planet.water*66)+(1-planet.water)*4,0,98));
}
function bodyRef(body){ return body?.type==='moon'?{type:'moon',index:body.index}:{type:'planet'}; }
function bodyId(body){ return body?.type==='moon'?`moon-${body.index}`:'planet'; }
function bodyName(body){ return body?.type==='moon'?(planet.moonData[body.index]?.name||'MOON'):planet.name; }
function scanStorageKey(body){ return `planetarium:probe-scan:${planet.seed}:${bodyId(body)}`; }
function probeLossStorageKey(body){ return `planetarium:probe-loss:${planet.seed}:${bodyId(body)}`; }
function isScanned(body){ return storageGet(scanStorageKey(body),'0')==='1'; }
function markScanned(body){
  storageSet(scanStorageKey(body),'1');
  const name=canonicalPlanetName(planet.name);
  state.scannedWorlds=state.scannedWorlds.filter(v=>v!==name);
  state.scannedWorlds.push(name);
  state.scannedWorlds=state.scannedWorlds.slice(-200);
  storageSet('planetarium:scanned-worlds',JSON.stringify(state.scannedWorlds));
}
function scanForBody(body){ return body?.type==='moon'?planet.moonData[body.index]?.scan:planet.scan; }
function moonTemperatureC(m){ return Math.round(tempC()+(m.scan.tempBias||0)); }
function planetShareUrl(){
  const u=new URL(window.location.href);
  u.search='';
  u.searchParams.set('planet',planet.name);
  u.searchParams.set('temp',String(tempC()));
  u.hash='';
  return u.toString();
}
function syncUrl(){
  try { window.history.replaceState(null,'',planetShareUrl()); } catch {}
}
function showToast(text,ms=1500){ state.toastText=String(text).toUpperCase(); state.toastUntil=performance.now()+ms; }
function isFavorite(name=planet.name){ return state.favorites.includes(name.toUpperCase()); }
function toggleFavorite(){
  const name=planet.name.toUpperCase();
  if(isFavorite(name)){
    state.favorites=state.favorites.filter(v=>v!==name); showToast('REMOVED FROM FAVORITES');
  }else{
    state.favorites.push(name); state.favorites=[...new Set(state.favorites)].slice(-100); showToast('ADDED TO FAVORITES');
  }
  storageSet('planetarium:favorites',JSON.stringify(state.favorites));
}
function downloadTextFile(filename,text,mime='application/json'){
  try{
    const blob=new Blob([text],{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
    return true;
  }catch{return false;}
}
function exportCaptainLog(){
  storageSet('planetarium:history',JSON.stringify(state.history));
  storageSet('planetarium:favorites',JSON.stringify(state.favorites));
  storageSet('planetarium:scanned-worlds',JSON.stringify(state.scannedWorlds));
  const payload={
    format:'planetarium-captains-log',
    schema:1,
    appVersion:'1.1.0',
    exportedAt:new Date().toISOString(),
    data:planetariumStorageEntries()
  };
  const date=new Date().toISOString().slice(0,10);
  if(downloadTextFile(`planetarium-captains-log-${date}.json`,JSON.stringify(payload,null,2))) showToast('CAPTAIN LOG EXPORTED',2200);
  else showToast('EXPORT FAILED',2200);
}
let captainLogInput=null;
function importCaptainLog(){
  if(!captainLogInput){
    captainLogInput=document.createElement('input');
    captainLogInput.type='file'; captainLogInput.accept='.json,application/json'; captainLogInput.style.display='none';
    document.body.appendChild(captainLogInput);
    captainLogInput.addEventListener('change',async()=>{
      const file=captainLogInput.files?.[0]; captainLogInput.value=''; if(!file) return;
      try{
        const parsed=JSON.parse(await file.text());
        if(parsed?.format!=='planetarium-captains-log' || parsed?.schema!==1 || !parsed.data || typeof parsed.data!=='object') throw new Error('bad format');
        const entries=Object.entries(parsed.data).filter(([key,value])=>key.startsWith('planetarium:') && typeof value==='string');
        if(!entries.length || entries.length>10000) throw new Error('bad data');
        clearPlanetariumStorage();
        for(const [key,value] of entries) storageSet(key,value);
        showToast('CAPTAIN LOG IMPORTED',1600);
        try{ window.history.replaceState(null,'',window.location.pathname); }catch{}
        setTimeout(()=>window.location.reload(),500);
      }catch{ showToast('INVALID CAPTAIN LOG',2600); }
    });
  }
  captainLogInput.click();
}
function resetExplorationData(){
  const now=performance.now();
  if(now>state.resetConfirmUntil){
    state.resetConfirmUntil=now+4500;
    showToast('SELECT RESET AGAIN TO CONFIRM',3200);
    return;
  }
  clearPlanetariumStorage();
  state.resetConfirmUntil=0;
  try{ window.history.replaceState(null,'',window.location.pathname); }catch{}
  window.location.reload();
}

async function sharePlanet(){
  const url=planetShareUrl();
  try{
    if(navigator.share && state.mouse.pointerType!=='mouse'){
      await navigator.share({title:`Planetarium - ${planet.name}`,text:planet.name,url});
      showToast('PLANET LINK SHARED'); return;
    }
    if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(url); showToast('PLANET LINK COPIED'); return; }
  }catch(err){ if(err?.name==='AbortError') return; }
  try{
    const ta=document.createElement('textarea'); ta.value=url; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); showToast('PLANET LINK COPIED');
  }catch{ showToast('COPY FAILED'); }
}

function drawStars(t){
  ctx.fillStyle=C.black; ctx.fillRect(0,0,W,H);
  for(const s of planet.stars){
    const pulse=Math.sin(t*.0015+s.tw)*.5+.5;
    const col=s.b>.90?C.cyan:s.b>.70?C.white:mixHex(C.white,C.black,.52+.35*(1-pulse));
    ctx.fillStyle=col;
    ctx.fillRect(s.x,s.y,(s.b>.94?2:1),1);
    if(s.b>.985) ctx.fillRect(s.x,s.y-1,1,3);
  }
}
function terrainAt(lon,lat){
  // Fully wrap-safe procedural terrain so special planets do not show a vertical seam.
  const n=(
    periodicNoise01(lon,lat,14,6,planet.terrainSeed)*.56+
    periodicNoise01(lon,lat,28,12,planet.terrainSeed+101)*.29+
    periodicNoise01(lon,lat,56,24,planet.terrainSeed+202)*.15
  );
  const ridge=Math.abs(.5-periodicNoise01(lon+11/24,lat-.09,24,8,planet.terrainSeed^0x51ed))*2;
  return {n, ridge};
}
function surfaceShade(col,nx,z){
  const light=clamp((z*.62 + (-nx*.22) + .28),0,1);
  if(light<.34) return mixHex(col,C.black,.34);
  if(light<.53) return mixHex(col,C.black,.13);
  return col;
}
function lonDistance(a,b){ const d=Math.abs(a-b); return Math.min(d,1-d); }
function continentBlob(lon,lat,cx,cy,wx,hy){
  const dx=lonDistance(lon,cx)/wx, dy=(lat-cy)/hy;
  return 1-(dx*dx+dy*dy);
}
function earthLandValue(lon,lat,q){
  const add=[
    // North America + Greenland
    [.155,.30,.075,.09],[.205,.34,.090,.12],[.255,.38,.075,.11],[.315,.21,.040,.06],
    // South America
    [.245,.56,.060,.13],[.270,.68,.040,.11],
    // Eurasia / Africa / Arabia / India / SE Asia
    [.515,.30,.115,.10],[.610,.29,.160,.12],[.720,.31,.120,.10],[.810,.34,.075,.08],
    [.565,.52,.075,.15],[.615,.60,.045,.12],[.705,.48,.055,.08],[.775,.47,.060,.08],
    // Australia + islands
    [.855,.66,.060,.06],[.920,.58,.030,.04],[.965,.49,.020,.03],
    // Antarctica shelf
    [.500,.90,.330,.05]
  ];
  const cut=[
    // Atlantic, Mediterranean, Indian Ocean and Arctic cutouts to make continents read better
    [.405,.42,.090,.16],[.500,.43,.040,.05],[.650,.40,.040,.05],[.742,.58,.055,.09],[.590,.14,.120,.05],
    [.865,.53,.026,.03],[.214,.49,.030,.04]
  ];
  let v=-1.1;
  for(const b of add) v=Math.max(v,continentBlob(lon,lat,...b));
  for(const b of cut) v-=Math.max(0,continentBlob(lon,lat,...b))*0.72;
  const coastline=periodicNoise01(lon,lat,96,44,planet.terrainSeed^0x45ef)-.5;
  return v+(q.n-.5)*.20+(q.ridge-.5)*.05+coastline*.10;
}
function plutoTextureColor(lon,lat){
  const tex=specialTexture.pluto;
  if(!tex?.data) return null;
  const x=clamp(Math.floor(mod(lon,1)*tex.width),0,tex.width-1);
  const y=clamp(Math.floor(clamp(lat,0,1)*(tex.height-1)),0,tex.height-1);
  const i=(y*tex.width+x)*4;
  return '#'+[tex.data[i],tex.data[i+1],tex.data[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function fictionalGasGiantSurfaceColor(lon,lat,nx,z){
  const style=planet.name==='POLYPHEMUS'?0:(hashString(planet.name)%6);
  const seed=planet.terrainSeed^0x6a6173;
  const coarse=periodicNoise01(lon,lat,18+style*3,7+style,seed^0x1111)-.5;
  const streak=periodicNoise01(lon,lat,58+style*7,23+style*2,seed^0x2222)-.5;
  const grain=periodicNoise01(lon,lat,92,44,seed^0x3333)-.5;
  const curls=Math.sin(lon*Math.PI*(6+style)+coarse*(2.2+style*.18))*((style%2)?.046:.032);
  const bandLat=lat+curls+coarse*(.022+style*.003);
  const band=Math.sin((bandLat*(13+style*2)+streak*(.30+style*.035))*Math.PI);
  const palettes=[
    [mixHex(C.white,C.cyan,.18),mixHex(C.white,C.yellow,.16),mixHex(C.cyan,C.white,.34),mixHex(C.blue,C.cyan,.28),mixHex(C.purple,C.cyan,.26)],
    [mixHex(C.yellow,C.white,.20),mixHex(C.green,C.cyan,.24),mixHex(C.brown,C.yellow,.28),mixHex(C.cyan,C.green,.18),mixHex(C.brown,C.black,.18)],
    [mixHex(C.white,C.purple,.18),mixHex(C.purple,C.blue,.22),mixHex(C.blue,C.cyan,.26),mixHex(C.cyan,C.white,.24),mixHex(C.purple,C.black,.18)],
    [mixHex(C.white,C.yellow,.12),mixHex(C.red,C.yellow,.28),mixHex(C.brown,C.red,.22),mixHex(C.yellow,C.brown,.18),mixHex(C.red,C.black,.16)],
    [mixHex(C.cyan,C.white,.24),mixHex(C.green,C.cyan,.20),mixHex(C.blue,C.green,.16),mixHex(C.white,C.blue,.22),mixHex(C.blue,C.black,.15)],
    [mixHex(C.white,C.brown,.14),mixHex(C.brown,C.purple,.18),mixHex(C.purple,C.red,.18),mixHex(C.yellow,C.white,.18),mixHex(C.brown,C.black,.24)]
  ];
  const pal=palettes[style];
  let col=band>.58?pal[0]:band>.12?pal[1]:band>-.30?pal[2]:band>-.66?pal[3]:pal[4];
  const s1=((planet.seed>>>5)%100)/100, s2=((planet.seed>>>13)%100)/100;
  const storm1=(lonDistance(lon,.18+s1*.58)/(.065+(style%3)*.014))**2+((lat-(.35+s2*.28))/(.045+(style%2)*.018))**2;
  const storm2=(lonDistance(lon,.12+s2*.72)/(.045+((style+1)%3)*.010))**2+((lat-(.68-s1*.24))/(.036+((style+1)%2)*.012))**2;
  if(storm1<1) col=mixHex(pal[0],style===3?C.red:C.white,.34);
  else if(storm2<1 && style!==4) col=mixHex(pal[3],C.white,.22);
  else if(grain>.34) col=mixHex(col,C.white,.11);
  else if(grain<-.38) col=mixHex(col,C.black,.11);
  if(style===0 && planet.name==='POLYPHEMUS'){
    const eye=(lonDistance(lon,.36)/.095)**2+((lat-.47)/.060)**2;
    if(eye<1) col=eye<.48?mixHex(C.cyan,C.white,.52):mixHex(C.blue,C.cyan,.28);
  }
  return surfaceShade(col,nx,z);
}
function polarCapPresence(p=planet){
  // Named Solar System worlds keep their known two-pole behaviour. Procedural
  // worlds can naturally generate one north cap, one south cap, or both.
  if(p?.solar) return {north:true,south:true};
  if(p?._polarCapPresence) return p._polarCapPresence;
  const seed=((p?.terrainSeed||p?.seed||1)^0x1ceca9)>>>0;
  const roll=h2(17,53,seed);
  const presence=roll<.18?{north:true,south:false}:roll<.36?{north:false,south:true}:{north:true,south:true};
  if(p) p._polarCapPresence=presence;
  return presence;
}
function polarCapAt(lon,lat,baseReach,{forceBoth=false,seedSalt=0}={}){
  const reach=clamp(baseReach,0,.34);
  if(reach<=.003) return {ice:false,north:false,south:false,grain:0,depth:0};
  // Most surface pixels are nowhere near a pole. Bail out before sampling the
  // more detailed edge fields so textured caps stay cheap to render.
  const maxEdgeRoughness=.045;
  if(lat>reach+maxEdgeRoughness && lat<1-reach-maxEdgeRoughness) return {ice:false,north:false,south:false,grain:0,depth:0};
  const seed=((planet.terrainSeed||planet.seed||1)^0x504f4c45^seedSalt)>>>0;
  const presence=forceBoth?{north:true,south:true}:polarCapPresence(planet);
  let north=false,south=false,depth=0;
  if(lat<.5 && presence.north){
    // Two wrap-safe noise scales make a ragged coastline rather than a straight
    // latitude cut. The finer field also nibbles small bays out of the ice edge.
    const wave=(periodicNoise01(lon,.173,18,5,seed)-.5)*.052
      +(periodicNoise01(lon,.317,46,7,seed^0x6e6f7274)-.5)*.024;
    const edge=clamp(reach+wave,.005,.38);
    north=lat<edge; depth=north?edge-lat:0;
  }else if(lat>=.5 && presence.south){
    const wave=(periodicNoise01(lon,.827,18,5,seed^0x736f7574)-.5)*.052
      +(periodicNoise01(lon,.683,46,7,seed^0x5a17c9e3)-.5)*.024;
    const edge=clamp(reach+wave,.005,.38);
    south=lat>1-edge; depth=south?lat-(1-edge):0;
  }
  if(!north&&!south) return {ice:false,north:false,south:false,grain:0,depth:0};
  const grain=periodicNoise01(lon,lat,38,27,seed^0x46524f53);
  // Break up only the outermost pixels so the cap stays coherent while its
  // boundary develops fjords, islands and uneven tongues of ice.
  if(depth<.026 && grain<.27){north=false;south=false;depth=0;}
  return {ice:north||south,north,south,grain,depth};
}
function polarIceColor(cap){
  if(!cap?.ice) return C.white;
  if(cap.grain<.20) return mixHex(C.cyan,C.white,.68);
  if(cap.grain>.82) return mixHex(C.white,C.blue,.10);
  if(cap.depth<.018 && cap.grain<.42) return mixHex(C.cyan,C.white,.78);
  return C.white;
}

function solarSurfaceColor(lon,lat,normY,nx,z){
  if(state.viewMode===2 && hasAtmosphereView()) return atmosphereViewColor(lon,lat,nx,z);
  if(state.viewMode===3){
    const heat=clamp(state.temp-Math.abs(lat-.5)*.18,0,1);
    const c=heat<.2?C.blue:heat<.4?C.cyan:heat<.6?C.green:heat<.8?C.yellow:C.red;
    return surfaceShade(c,nx,z);
  }
  const kind=planet.renderer, t=tempC();
  if(!planet.solar && (kind==='jupiter'||kind==='saturn'||kind==='uranus'||kind==='neptune')) return fictionalGasGiantSurfaceColor(lon,lat,nx,z);
  if(kind==='jupiter'||kind==='saturn'||kind==='uranus'||kind==='neptune'){
    // Wrap-safe giant planet bands so the texture closes cleanly with no seam.
    const coarse=periodicNoise01(lon,lat,24,9,planet.terrainSeed^0x51e2)-.5;
    const streak=periodicNoise01(lon,lat,64,26,planet.terrainSeed^0xa931)-.5;
    const grain=periodicNoise01(lon,lat,96,48,planet.terrainSeed^0x2c47)-.5;
    const wave=Math.sin(lon*Math.PI*6+coarse*2.2)*.035;
    const bandLat=lat+wave+coarse*.026;
    const band=Math.sin((bandLat*18+streak*.34)*Math.PI);
    let col;
    if(kind==='jupiter'){
      col=band>.52?C.white:band>.02?C.yellow:band>-.55?C.brown:mixHex(C.red,C.yellow,.34);
      const spot=(lonDistance(lon,.72)/.085)**2+((lat-.62)/.055)**2;
      if(spot<1) col=spot<.46?C.red:mixHex(C.red,C.yellow,.35);
      else if(grain>.36 && Math.abs(band)<.60) col=mixHex(col,C.white,.12);
      else if(grain<-.38) col=mixHex(col,C.black,.10);
    }else if(kind==='saturn'){
      col=band>.52?C.white:band>-.08?C.yellow:mixHex(C.brown,C.white,.48);
      if(grain>.34) col=mixHex(col,C.white,.14);
      else if(grain<-.40) col=mixHex(col,C.brown,.14);
    }else if(kind==='uranus'){
      col=band>.62?C.white:band<-.62?C.blue:C.cyan;
      col=mixHex(col,C.white,.12);
      if(grain>.40) col=mixHex(col,C.white,.10);
      else if(grain<-.43) col=mixHex(col,C.blue,.10);
    }else{
      col=band>.58?C.cyan:band<-.50?C.blue:mixHex(C.blue,C.cyan,.24);
      const spot=(lonDistance(lon,.66)/.095)**2+((lat-.43)/.065)**2;
      if(spot<1) col=mixHex(C.blue,C.black,.42);
      else if(grain>.34) col=mixHex(col,C.cyan,.12);
      else if(grain<-.38) col=mixHex(col,C.black,.12);
    }
    return surfaceShade(col,nx,z);
  }
  const q=terrainAt(lon,lat);
  let col=C.brown;
  if(kind==='earth'){
    const land=earthLandValue(lon,lat,q);
    const coldShift=clamp((15-t)/100,-.08,.14);
    const northReach=clamp(.13+coldShift,.055,.26);
    const southReach=clamp(.18+coldShift*.80,.08,.31);
    // Earth keeps both real polar regions, but each coastline is textured and
    // longitude-dependent instead of being cut by a ruler-straight latitude.
    const northCap=polarCapAt(lon,lat,northReach,{forceBoth:true,seedSalt:0x45415254});
    const southCap=polarCapAt(lon,1-lat,southReach,{forceBoth:true,seedSalt:0x414e5441});
    const polar=northCap.north||southCap.north;
    if(polar) col=polarIceColor(northCap.north?northCap:southCap);
    else if(land<.01){
      if(t>105) col=mixHex(C.blue,C.brown,.65); else col=land>-.10?C.cyan:C.blue;
    }else if(land<.08) col=C.yellow;
    else if(t>55) col=land>.44?C.brown:C.yellow;
    else if(t<-18) col=C.white;
    else if(q.ridge>.82 && land>.16) col=mixHex(C.brown,C.green,.30);
    else col=land>.50?C.brown:C.green;
  }else if(kind==='mars'){
    const stage=marsTerraformStage();
    const marsReach=clamp(.5-clamp(.42+(t+63)/520,.32,.48),.01,.18);
    const marsCap=polarCapAt(lon,lat,marsReach,{forceBoth:true,seedSalt:0x4d415253});
    const polar=marsCap.ice;
    const ocean=periodicNoise01(lon,lat,56,33,planet.terrainSeed^0x544f);
    if(polar && t<10) col=polarIceColor(marsCap);
    else if(stage>=2 && ocean<clamp(.18+stage*.06,0,.34)) col=stage>=3?mixHex(C.blue,C.cyan,.18):C.blue;
    else if(stage>=3 && q.n>.44) col=q.ridge>.79?mixHex(C.brown,C.green,.22):C.green;
    else if(q.ridge>.80) col=mixHex(C.red,C.black,.28);
    else if(q.n>.62) col=mixHex(C.red,C.brown,.18);
    else if(q.n<.34) col=mixHex(C.red,C.black,.12);
    else col=mixHex(C.red,C.yellow,.10);
  }else if(kind==='mercury'){
    if(q.ridge>.80) col=mixHex(C.brown,C.black,.32);
    else if(q.n>.67) col=mixHex(C.white,C.brown,.45);
    else if(q.n<.35) col=mixHex(C.brown,C.black,.22);
    else col=mixHex(C.brown,C.white,.28);
  }else if(kind==='venus'){
    if(state.viewMode===1){
      // CLEAN view removes Venus' opaque cloud deck and reveals a stylized volcanic surface.
      if(q.ridge>.82) col=mixHex(C.brown,C.black,.28);
      else if(q.n>.66) col=mixHex(C.red,C.brown,.34);
      else if(q.n<.34) col=mixHex(C.brown,C.black,.16);
      else col=mixHex(C.brown,C.yellow,.20);
    }else{
      const cloudWarp=periodicNoise01(lon,lat,32,11,planet.terrainSeed^0x77b1)-.5;
      const cloudGrain=periodicNoise01(lon,lat,96,37,planet.terrainSeed^0x09ed)-.5;
      const sw=Math.sin((lat*12+(q.n-.5)*1.05+cloudWarp*.55)*Math.PI);
      col=sw>.45?C.white:sw>-.25?C.yellow:mixHex(C.yellow,C.red,.34);
      if(cloudGrain>.35) col=mixHex(col,C.white,.12);
      else if(cloudGrain<-.40) col=mixHex(col,C.brown,.10);
      if(q.ridge>.84) col=mixHex(col,C.brown,.18);
    }
  }else if(kind==='pluto'){
    const mapCol=plutoTextureColor(lon,lat);
    if(mapCol){
      col=mapCol;
    }else{
      const heart=(lonDistance(lon,.57)/.19)**2+((lat-.43)/.18)**2;
      const darkRegion=(lonDistance(lon,.33)/.22)**2+((lat-.68)/.28)**2;
      const mottled=periodicNoise01(lon,lat,80,38,planet.terrainSeed^0x6c75)-.5;
      col=mixHex(C.white,C.yellow,.22);
      if(darkRegion<1) col=mixHex(C.red,C.brown,.28);
      if(heart<1.05) col=mixHex(C.white,C.yellow,.08);
      if(mottled>.28) col=mixHex(col,C.white,.12);
      else if(mottled<-.32) col=mixHex(col,C.brown,.10);
    }
  }
  return surfaceShade(col,nx,z);
}
function deathStarSurfaceColor(lon,lat,nx,z,variant=1){
  const panelA=periodicNoise01(lon,lat,30,14,planet.terrainSeed^0x5101)-.5;
  const panelB=periodicNoise01(lon,lat,72,34,planet.terrainSeed^0x5102)-.5;
  const greeble=periodicNoise01(lon,lat,128,60,planet.terrainSeed^0x5103)-.5;
  const lx=(mod(lon*28+panelA*.9,1));
  const ly=(mod(lat*16+panelB*.7,1));
  let col=mixHex(C.white,C.black,.22);
  if(lx<.045||ly<.05) col=mixHex(C.white,C.black,.36);
  else if(greeble>.18) col=mixHex(C.white,C.black,.28);
  else if(greeble<-.30) col=mixHex(C.white,C.black,.14);
  const trench=Math.abs(lat-.52);
  if(trench<.013) col=mixHex(C.black,C.white,.09);
  else if(trench<.023) col=mixHex(C.black,C.white,.23);
  const dishDx=lonDistance(lon,.675), dishDy=(lat-.365);
  const dish=((dishDx/.095)**2)+((dishDy/.125)**2);
  if(dish<1){
    const radial=Math.abs(Math.sin(Math.atan2(dishDy,dishDx||.0001)*9));
    col=dish<.055?C.black:dish<.78?mixHex(C.white,C.black,.44-radial*.07):mixHex(C.white,C.black,.28);
  }
  const cap=((lonDistance(lon,.50)/.11)**2)+(((lat-.06)/.09)**2);
  if(cap<1) col=cap<.25?mixHex(C.black,C.white,.28):mixHex(C.white,C.black,.30);
  if(variant>=2){
    const latA=(lat-.5)*Math.PI, localY=Math.sin(latA), localX=Math.sin((lon-.5)*Math.PI*2)*Math.cos(latA);
    const q=damageSpace(localX,localY,planet.damageProfile||{angle:0});
    const scaff=periodicNoise01(lon,lat,90,46,planet.terrainSeed^0x5201);
    const strut=(Math.abs(mod(lon*52,1)-.5)<.08)||(Math.abs(mod(lat*34,1)-.5)<.08);
    const nearOpen=variant===2 ? q.x>.18 && Math.abs(q.y)<.82 : q.x>.08 && Math.abs(q.y)<.90;
    if(nearOpen){
      if(variant===2){
        if(scaff>.58||strut) col=mixHex(C.white,C.black,.42);
        else if(q.x>.32) col=mixHex(C.black,C.white,.05);
      }else{
        const ragged=periodicNoise01(lon,lat,24,14,planet.terrainSeed^0x5301)-.5;
        if(scaff>.52||strut) col=mixHex(C.white,C.black,.48);
        else if(ragged>.04||q.x>.42) col=mixHex(C.black,C.white,.05);
        else col=mixHex(col,C.black,.30);
      }
    }
  }
  return surfaceShade(col,nx,z);
}
function coruscantSurfaceColor(lon,lat,nx,z){
  const gridA=periodicNoise01(lon,lat,46,22,planet.terrainSeed^0x6111)-.5;
  const gridB=periodicNoise01(lon,lat,118,58,planet.terrainSeed^0x6112)-.5;
  const roadX=Math.abs(mod(lon*42+gridA*.4,1)-.5);
  const roadY=Math.abs(mod(lat*24+gridB*.3,1)-.5);
  let col=mixHex(C.white,C.black,.56);
  if(roadX<.07||roadY<.07) col=mixHex(C.white,C.black,.72);
  else if(gridB>.24) col=mixHex(C.white,C.black,.50);
  if((roadX<.025||roadY<.025) && gridA>.08) col=mixHex(C.yellow,C.white,.22);
  if(Math.abs(lat-.5)>.43) col=mixHex(col,C.black,.10);
  return surfaceShade(col,nx,z);
}
function wikipediaSurfaceColor(lon,lat,nx,z){
  const gx=lon*11.5, gy=lat*6.6;
  const cellX=Math.floor(gx), cellY=Math.floor(gy), u=gx-cellX, v=gy-cellY;
  const wobbleX=Math.sin((lat*13+cellX*.73)*Math.PI)*.038;
  const wobbleY=Math.sin((lon*15+cellY*.61)*Math.PI)*.034;
  let col=mixHex(C.white,C.black,.08);
  const seamX=Math.min(Math.abs(u+wobbleX),Math.abs(1-u-wobbleX));
  const seamY=Math.min(Math.abs(v+wobbleY),Math.abs(1-v-wobbleY));
  if(seamX<.032||seamY<.037) col=mixHex(C.white,C.black,.30);
  else{
    const shade=periodicNoise01(lon,lat,54,32,planet.terrainSeed^0x7711)-.5;
    col=mixHex(col,shade>0?C.white:C.black,Math.abs(shade)*.18);
  }
  const crownGap=lat<.18 && lon>.38 && lon<.63;
  if(!crownGap){
    const h=hashString(`${cellX}:${cellY}:${planet.seed}`);
    const passes=[h,(h>>>3)^0x45a1,(h>>>5)^0x1327];
    for(let i=0;i<passes.length;i++){
      const q=passes[i];
      if((q%100)>(i===0?16:i===1?44:72)) continue;
      const du=u-(((q>>7)&15)/15-.5)*.22, dv=v-(((q>>11)&15)/15-.5)*.22;
      const style=q%8;
      let ink=false;
      if(style===0) ink=(Math.abs(du-.50)<.050&&dv>.18&&dv<.82)||(Math.abs(dv-.31)<.040&&du>.22&&du<.74)||(Math.abs(dv-.70)<.040&&du>.22&&du<.74);
      else if(style===1) ink=(Math.abs(du-.32)<.045&&dv>.20&&dv<.78)||(Math.abs(du-.68)<.045&&dv>.20&&dv<.78)||(Math.abs(dv-.52)<.045&&du>.30&&du<.70);
      else if(style===2) ink=(Math.abs(dv-.28)<.042&&du>.24&&du<.76)||(Math.abs(dv-.72)<.042&&du>.24&&du<.76)||(Math.abs(du-.50)<.046&&dv>.28&&dv<.72);
      else if(style===3) ink=((du-.50)*(du-.50)+(dv-.50)*(dv-.50)<.050)&&((du-.50)*(du-.50)+(dv-.50)*(dv-.50)>.020);
      else if(style===4) ink=(Math.abs((du-.22)-(dv-.24)*.72)<.045&&dv>.22&&dv<.80)||(Math.abs((du-.78)+(dv-.24)*.72)<.045&&dv>.22&&dv<.80);
      else if(style===5) ink=(Math.abs(du-.50)<.040&&dv>.18&&dv<.82)||(Math.abs(du-.34)<.040&&dv>.36&&dv<.78)||(Math.abs(du-.66)<.040&&dv>.36&&dv<.78);
      else if(style===6) ink=(Math.abs(dv-.50)<.040&&du>.18&&du<.82)||(Math.abs(du-.28)<.040&&dv>.20&&dv<.50)||(Math.abs(du-.72)<.040&&dv>.50&&dv<.80);
      else ink=(Math.abs(du-.30)<.038&&dv>.20&&dv<.78)||(Math.abs(dv-.26)<.038&&du>.30&&du<.72)||(Math.abs(du-.72)<.038&&dv>.26&&dv<.78)||(Math.abs(dv-.78)<.038&&du>.30&&du<.72);
      if(ink) col=mixHex(C.black,C.white,.05);
    }
  }
  return surfaceShade(col,nx,z);
}
function wikipediaMissingPiece(nx,ny){
  if(planet?.renderer!=='wikipedia') return false;
  const crown=((nx+.04)/.18)**2+((ny+.90)/.11)**2<1;
  const bowl=((nx+.01)/.14)**2+((ny+.82)/.14)**2<1;
  const leftTab=((nx+.18)/.055)**2+((ny+.86)/.055)**2<1;
  const rightTab=((nx-.12)/.055)**2+((ny+.83)/.055)**2<1;
  return crown||bowl||leftTab||rightTab;
}
function oooSurfaceColor(lon,lat,nx,z){
  const ocean=mixHex(C.blue,C.cyan,.24);
  const deepOcean=mixHex(C.blue,C.black,.10);
  const grass=C.green;
  const darkGrass=mixHex(C.green,C.black,.14);
  const beach=mixHex(C.yellow,C.green,.34);
  const n=periodicNoise01(lon,lat,28,18,planet.terrainSeed^0x0aa0)-.5;
  const detail=periodicNoise01(lon,lat,66,40,planet.terrainSeed^0x0aa1)-.5;
  const north=((lonDistance(lon,.24)/.26)**2)+(((lat-.24)/.18)**2);
  const south=((lonDistance(lon,.29)/.20)**2)+(((lat-.66)/.30)**2);
  const island=((lonDistance(lon,.49)/.11)**2)+(((lat-.63)/.10)**2);
  let col=deepOcean;
  let land=(north<1||south<1||island<1);
  if(!land && n>.14 && Math.abs(lat-.5)<.40) land=true;
  if(land){
    col=detail>.10?grass:darkGrass;
    if(north>.86||south>.86||island>.86||Math.abs(n-.14)<.04) col=beach;
  }
  if(Math.abs(lat-.50)>.44) col=mixHex(col,C.white,.18);
  return surfaceShade(col,nx,z);
}
function drawOOOCloudSwirls(cx,cy){
  const r=planet.radius, left=Math.round(cx-r), top=Math.round(cy-r), size=r*2;
  const drift=state.simDays*.0038;
  const ribbons=[
    {y:-.34, amp:.07, freq:5.2, width:.060, xmin:-.78, xmax:.16},
    {y:-.06, amp:.06, freq:5.8, width:.058, xmin:-.62, xmax:.42},
    {y:.26, amp:.05, freq:6.1, width:.052, xmin:-.20, xmax:.58}
  ];
  for(let y=0;y<size;y+=2){
    const ny=((y+.5)/size)*2-1;
    for(let x=0;x<size;x+=2){
      const nx=((x+.5)/size)*2-1;
      if(nx*nx+ny*ny>1 || geometryMissingAt(nx,ny,planet)) continue;
      let on=false;
      for(const band of ribbons){
        if(nx<band.xmin||nx>band.xmax) continue;
        const wave=band.y+Math.sin((nx+drift)*band.freq)*band.amp;
        if(Math.abs(ny-wave)<band.width){ on=true; break; }
      }
      if(!on){
        const puffs=[[-.38,-.56,.09],[.66,-.05,.08],[.77,.46,.06]];
        for(const puff of puffs){
          const dx=nx-puff[0], dy=ny-puff[1];
          if(dx*dx+dy*dy<puff[2]*puff[2]){ on=true; break; }
        }
      }
      if(!on) continue;
      ctx.fillStyle=C.black; ctx.globalAlpha=.14; ctx.fillRect(left+x+1,top+y+1,2,2);
      ctx.fillStyle=mixHex(C.white,C.cyan,.16); ctx.globalAlpha=.78; ctx.fillRect(left+x,top+y,2,2);
    }
  }
  ctx.globalAlpha=1;
}
function planetFixedDamageCoords(nx,ny){
  const rr=nx*nx+ny*ny;
  if(rr>1) return {x:nx,y:ny,z:0};
  const screenZ=Math.sqrt(Math.max(0,1-rr));
  const a=(state.phase||0)*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
  return {
    x:nx*ca+screenZ*sa,
    y:ny,
    z:screenZ*ca-nx*sa
  };
}
function damageSpace(nx,ny,profile){
  const a=profile?.angle||0,ca=Math.cos(a),sa=Math.sin(a);
  return {x:nx*ca+ny*sa,y:-nx*sa+ny*ca};
}
function damageNoise(x,y,seed=0){
  return h2(Math.floor((x+1.2)*43),Math.floor((y+1.2)*43),seed>>>0)-.5;
}
function geometryMissingAt(nx,ny,p=planet){
  if(!p) return false;
  const fixed=planetFixedDamageCoords(nx,ny);
  if(fixed.z<0) return false;
  if(p.renderer==='wikipedia') return wikipediaMissingPiece(fixed.x,fixed.y);
  const profile=p.damageProfile; if(!profile||profile.type==='NONE'||profile.type==='CRATER') return false;
  if(profile.type==='PUZZLE_PIECE') return wikipediaMissingPiece(fixed.x,fixed.y);
  const sev=clamp(profile.severity??.72,.2,1),q=damageSpace(fixed.x,fixed.y,profile),x=q.x,y=q.y,n=damageNoise(x,y,profile.seed);
  if(profile.type==='BITE'){
    const r=.27+sev*.16+n*.035;
    const main=((x-.92)/r)**2+((y+.01)/(r*.88))**2<1;
    const upper=((x-.78)/(r*.70))**2+((y+.26)/(r*.62))**2<1;
    const lower=((x-.80)/(r*.74))**2+((y-.27)/(r*.64))**2<1;
    return main||upper||lower;
  }
  if(profile.type==='SHATTERED_EDGE'){
    const rag=.66-sev*.16+n*.18;
    const wedge=x>rag && (Math.abs(y)<.84 || damageNoise(x*1.7,y*1.9,profile.seed^0x51a7)>.18);
    const crack=x>.30 && Math.abs(y-(n*.55))<.025+sev*.018 && damageNoise(x*2.1,y*2.7,profile.seed^0x19d1)>.06;
    return wedge||crack;
  }
  if(profile.type==='MISSING_HEMISPHERE'){
    const boundary=.22-sev*.27+n*.13;
    return x>boundary;
  }
  if(profile.type==='EXPLOSION_DAMAGE'){
    const r=.19+sev*.12;
    const a=((x-.79)/(r*1.12))**2+((y+.05)/r)**2<1+n*.16;
    const b=((x-.61)/(r*.84))**2+((y-.34)/(r*.78))**2<1+n*.12;
    const c=((x-.68)/(r*.72))**2+((y+.39)/(r*.70))**2<1-n*.10;
    const torn=x>.74-sev*.18+n*.16 && Math.abs(y)<.82;
    return a||b||c||torn;
  }
  if(profile.type==='CUSTOM_MASK'){
    // Unfinished battle-station shell: a large construction sector is genuinely absent,
    // with a noisy boundary and smaller punched-through gaps around it.
    const open=x>.38+n*.16 && y>-.68+n*.08 && y<.70+n*.09;
    const cavity=((x-.46)/.20)**2+((y+.40)/.18)**2<1+n*.12;
    const lower=((x-.56)/.17)**2+((y-.50)/.15)**2<1-n*.10;
    return open||cavity||lower;
  }
  return false;
}
function damageEdgeAt(nx,ny,p=planet){
  if(!p||geometryMissingAt(nx,ny,p)) return false;
  const profile=p.renderer==='wikipedia'?{type:'PUZZLE_PIECE'}:p.damageProfile;
  if(!profile||profile.type==='NONE'||profile.type==='CRATER') return false;
  const e=Math.max(1/Math.max(18,p.rx||40),1/Math.max(18,p.ry||40))*1.65;
  return geometryMissingAt(nx+e,ny,p)||geometryMissingAt(nx-e,ny,p)||geometryMissingAt(nx,ny+e,p)||geometryMissingAt(nx,ny-e,p)||
         geometryMissingAt(nx+e*.7,ny+e*.7,p)||geometryMissingAt(nx-e*.7,ny-e*.7,p);
}
function damageSurfaceColor(base,nx,ny,p=planet){
  const profile=p?.damageProfile;
  if(profile?.type==='CRATER'){
    const fixed=planetFixedDamageCoords(nx,ny);
    const q=damageSpace(fixed.x,fixed.y,profile),sev=clamp(profile.severity??.7,.2,1),cx=.26,cy=-.08;
    const d=Math.sqrt(((q.x-cx)/(.22+sev*.10))**2+((q.y-cy)/(.18+sev*.08))**2);
    if(d<1){
      if(d<.68) return mixHex(base,C.black,.52);
      return mixHex(base,p.worldType==='ICE'?C.cyan:C.brown,.42);
    }
  }
  if(!damageEdgeAt(nx,ny,p)) return base;
  if(p.renderer==='wikipedia') return mixHex(C.white,C.black,.36);
  if(p.renderer==='deathstar2'||p.renderer==='deathstar3') return mixHex(C.white,C.black,.62);
  if(p.renderer==='ooo'){
    const layer=mod(Math.floor((ny+1)*18),4);
    return [C.black,mixHex(C.brown,C.black,.34),mixHex(C.brown,C.red,.16),mixHex(C.yellow,C.brown,.34)][layer];
  }
  const q=damageNoise(nx,ny,(profile?.seed||p.seed)^0x4d414e54);
  if(q>.24) return C.yellow;
  if(q<-.18) return mixHex(C.red,C.black,.20);
  return mixHex(C.brown,C.red,.24);
}
function damageInteriorColor(nx,ny,p=planet){
  if(!p) return C.black;
  if(p.renderer==='deathstar'||p.renderer==='deathstar2'||p.renderer==='deathstar3'){
    const mech=damageNoise(nx*1.9,ny*1.9,(p.seed^0x44535452)>>>0);
    const band=mod(Math.floor((ny+1)*20)+Math.floor((nx+1)*14),5);
    let col=[mixHex(C.white,C.black,.82),mixHex(C.white,C.black,.68),mixHex(C.blue,C.black,.60),mixHex(C.white,C.black,.88),mixHex(C.cyan,C.black,.72)][band];
    if(mech>.28) col=mixHex(col,C.white,.12);
    else if(mech<-.26) col=mixHex(col,C.black,.18);
    return col;
  }
  const rr=Math.sqrt(nx*nx+ny*ny);
  const noise=damageNoise(nx*1.8,ny*1.8,(p.seed^0x434f5245)>>>0);
  const striation=damageNoise(nx*5.4,ny*5.4,(p.seed^0x4c415941)>>>0);
  let layerR=rr+noise*.035;
  if(p.renderer==='ooo'){
    if(layerR<.18) return striation>.10?mixHex(C.yellow,C.white,.12):mixHex(C.red,C.yellow,.26);
    if(layerR<.34) return striation>.18?mixHex(C.brown,C.red,.08):mixHex(C.brown,C.red,.24);
    if(layerR<.56) return striation<-.16?mixHex(C.brown,C.black,.26):mixHex(C.brown,C.red,.10);
    if(layerR<.78) return striation>.12?mixHex(C.yellow,C.brown,.22):mixHex(C.brown,C.yellow,.16);
    return striation>.22?mixHex(C.green,C.brown,.42):mixHex(C.brown,C.green,.28);
  }
  if(p.worldType==='ICE'){
    if(layerR<.18) return mixHex(C.yellow,C.red,.18);
    if(layerR<.42) return mixHex(C.brown,C.red,.18);
    if(layerR<.72) return striation>.18?mixHex(C.blue,C.white,.32):mixHex(C.cyan,C.white,.26);
    return mixHex(C.white,C.cyan,.18);
  }
  if(layerR<.16) return striation>.08?mixHex(C.yellow,C.white,.20):mixHex(C.yellow,C.red,.12);
  if(layerR<.34) return striation<-.14?mixHex(C.red,C.black,.12):mixHex(C.red,C.brown,.14);
  if(layerR<.58) return striation>.16?mixHex(C.brown,C.black,.14):mixHex(C.brown,C.red,.12);
  if(layerR<.80) return striation<-.18?mixHex(C.yellow,C.brown,.20):mixHex(C.brown,C.yellow,.12);
  return striation>.16?mixHex(C.white,C.brown,.36):mixHex(C.brown,C.white,.26);
}
function specialSurfaceMask(nx,ny){
  return geometryMissingAt(nx,ny,planet);
}
function loreSurfaceColor(lon,lat,normY,nx,z){
  if(state.viewMode===2 && hasAtmosphereView()) return atmosphereViewColor(lon,lat,nx,z);
  if(state.viewMode===3){
    const heat=clamp(state.temp-Math.abs(lat-.5)*.18,0,1);
    const c=heat<.2?C.blue:heat<.4?C.cyan:heat<.6?C.green:heat<.8?C.yellow:C.red;
    return surfaceShade(c,nx,z);
  }
  if(['jupiter','saturn','uranus','neptune','mercury','venus','earth','mars','pluto'].includes(planet.renderer)) return solarSurfaceColor(lon,lat,normY,nx,z);
  if(planet.renderer==='deathstar') return deathStarSurfaceColor(lon,lat,nx,z,1);
  if(planet.renderer==='deathstar2') return deathStarSurfaceColor(lon,lat,nx,z,2);
  if(planet.renderer==='deathstar3') return deathStarSurfaceColor(lon,lat,nx,z,3);
  if(planet.renderer==='coruscant') return coruscantSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='wikipedia') return wikipediaSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='ooo') return oooSurfaceColor(lon,lat,nx,z);
  return null;
}
function surfaceColor(lon,lat,normY,nx,z){
  if(planet.solar) return solarSurfaceColor(lon,lat,normY,nx,z);
  const loreCol=loreSurfaceColor(lon,lat,normY,nx,z);
  if(loreCol) return loreCol;
  const q=terrainAt(lon,lat), tempLocal=state.temp-Math.abs(lat-.5)*.63+(q.n-.5)*.12;
  if(state.viewMode===2 && hasAtmosphereView()) return atmosphereViewColor(lon,lat,nx,z);
  if(state.viewMode===3){
    const heat=clamp(tempLocal,0,1), col=heat<.2?C.blue:heat<.4?C.cyan:heat<.6?C.green:heat<.8?C.yellow:C.red;
    return surfaceShade(col,nx,z);
  }
  const type=planet.worldType||'TERRESTRIAL';
  const iceLine=clamp(.31+state.temp*.33,.25,.64);
  const cap=polarCapAt(lon,lat,.5-iceLine);
  const polar=cap.ice, iceCol=polarIceColor(cap);
  // Outside a generated cap, very low local temperature may still leave small
  // frost/snow patches, but it no longer recreates a second straight-edged cap.
  const coldFrost=tempLocal<.06 && periodicNoise01(lon,lat,34,23,planet.terrainSeed^0x534e4f57)>.64;
  let col=C.green;
  if(type==='OCEAN'){
    const threshold=.73+(planet.water-.82)*.24;
    if(polar) col=iceCol;
    else if(coldFrost) col=mixHex(C.cyan,C.white,.76);
    else if(q.n<threshold-.045) col=q.n<threshold-.18?C.blue:C.cyan;
    else if(q.n<threshold+.015) col=C.yellow;
    else col=q.ridge>.86?C.brown:C.green;
  }else if(type==='DESERT'){
    const waterLine=.30+(planet.water-.08)*.35;
    if(polar&&state.temp<.34) col=iceCol;
    else if(q.n<waterLine) col=C.blue;
    else if(q.ridge>.79||q.n>.76) col=C.brown;
    else if(q.n<.42) col=mixHex(C.yellow,C.brown,.18);
    else col=q.n>.62?mixHex(C.red,C.yellow,.30):C.yellow;
  }else if(type==='ICE'){
    const cracks=q.ridge>.82||periodicNoise01(lon,lat,40,29,planet.terrainSeed^0x33a7)>.79;
    if(q.n<.46 && tempLocal>.12) col=cracks?C.blue:C.cyan;
    else col=cracks?mixHex(C.blue,C.white,.42):C.white;
  }else if(type==='VOLCANIC'){
    const lava=q.ridge>.76||q.n<.27||periodicNoise01(lon,lat,28,21,planet.terrainSeed^0xc115)>.82;
    if(tempLocal<.15&&polar) col=iceCol;
    else if(lava) col=q.ridge>.88?C.yellow:C.red;
    else col=q.n>.62?mixHex(C.brown,C.black,.30):mixHex(C.brown,C.red,.18);
  }else if(type==='TOXIC'){
    const threshold=.50+(planet.water-.24)*.22;
    if(polar&&tempLocal<.08) col=iceCol;
    else if(q.n<threshold-planet.beach) col=q.n<threshold-.12?mixHex(C.blue,C.purple,.22):C.cyan;
    else if(q.ridge>.82) col=C.brown;
    else col=q.n>.60?mixHex(C.yellow,C.green,.28):mixHex(C.green,C.brown,.18);
  }else if(type==='BARREN'){
    if(polar&&state.temp<.20) col=iceCol;
    else if(q.ridge>.78) col=mixHex(C.brown,C.black,.35);
    else if(q.n>.66) col=mixHex(C.brown,C.white,.26);
    else if(q.n<.34) col=mixHex(C.purple,C.black,.38);
    else col=C.brown;
  }else if(type==='DWARF'){
    const frost=periodicNoise01(lon,lat,40,19,planet.terrainSeed^0x0d77);
    if(polar) col=cap.grain>.38?iceCol:mixHex(C.cyan,C.white,.48);
    else if(tempLocal<.18) col=frost>.42?C.white:mixHex(C.cyan,C.white,.45);
    else if(q.ridge>.80) col=mixHex(C.brown,C.black,.34);
    else if(q.n>.60) col=mixHex(C.white,C.brown,.28);
    else col=mixHex(C.brown,C.purple,.14);
  }else if(type==='VERDANT'){
    const threshold=.59+(planet.water-.52)*.26;
    if(polar) col=iceCol;
    else if(coldFrost) col=mixHex(C.cyan,C.white,.76);
    else if(q.n<threshold-planet.beach) col=q.n<threshold-.14?C.blue:C.cyan;
    else if(q.n<threshold+planet.beach) col=C.yellow;
    else if(q.ridge>.88) col=C.brown;
    else col=q.n>.67?mixHex(C.green,C.yellow,.14):C.green;
  }else{
    const threshold=.57+(planet.water-.5)*.28;
    if(polar) col=iceCol;
    else if(coldFrost) col=mixHex(C.cyan,C.white,.76);
    else if(q.n<threshold-planet.beach) col=q.n<threshold-.14?C.blue:C.cyan;
    else if(q.n<threshold+planet.beach) col=C.yellow;
    else if(q.n>planet.mount||q.ridge>.86) col=C.brown;
    else if(tempLocal>.72) col=C.yellow;
    else col=C.green;
  }
  return surfaceShade(col,nx,z);
}
function drawAtmosphereLimb(cx,cy){
  if((state.viewMode!==0 && state.viewMode!==2) || !hasAtmosphereView()) return;
  const strength=atmosphereStrength(planet); if(strength<=.02) return;
  const diagnostic=state.viewMode===2;
  const col=atmosphereAccentColor(), layers=diagnostic?(strength>.8?3:strength>.35?2:1):1; ctx.fillStyle=col;
  for(let layer=0;layer<layers;layer++){
    const rx=planet.rx+2+layer*2, ry=planet.ry+2+layer*2, steps=Math.max(90,Math.round((rx+ry)*2.6));
    ctx.globalAlpha=(diagnostic?.48:.16)-layer*.11;
    for(let i=0;i<steps;i++){
      if((i+layer*2)%Math.max(1,4-layer)!==0 && layer>0) continue;
      const a=i/steps*Math.PI*2,nx=Math.cos(a),ny=Math.sin(a);
      if(geometryMissingAt(nx*.985,ny*.985,planet)) continue;
      ctx.fillRect(Math.round(cx+nx*rx),Math.round(cy+ny*ry),1,1);
    }
  }
  ctx.globalAlpha=1;
}
function weatherSystemPosition(w,cx,cy){
  const lon=mod(w.lon+state.phase*1.10+state.simDays*w.speed,1), a=(lon-.5)*Math.PI*2; if(Math.cos(a)<-.08) return null;
  return {x:cx+Math.sin(a)*planet.rx*.90,y:cy+(w.lat-.5)*2*planet.ry*.78,depth:Math.cos(a),a};
}
function drawSpiralWeather(x,y,size,spin,color,alpha){
  ctx.fillStyle=color; ctx.globalAlpha=alpha;
  for(let i=0;i<24;i++){ const q=i/23,a=q*Math.PI*4.6*spin+state.simDays*.22*spin,rr=1+q*size; ctx.fillRect(Math.round(x+Math.cos(a)*rr),Math.round(y+Math.sin(a)*rr*.46),1,1); }
  ctx.fillStyle=C.black; ctx.globalAlpha=alpha*.75; ctx.fillRect(Math.round(x),Math.round(y),1,1); ctx.globalAlpha=1;
}
function drawLightningBolt(x,y,seed,alpha=1){
  ctx.fillStyle=C.white;ctx.globalAlpha=alpha;
  const bend=(seed&1)?1:-1;
  ctx.fillRect(Math.round(x),Math.round(y),1,2);
  ctx.fillRect(Math.round(x+bend),Math.round(y+2),1,2);
  ctx.fillRect(Math.round(x),Math.round(y+4),1,2);
  if((seed&4)!==0){ctx.fillStyle=C.cyan;ctx.fillRect(Math.round(x-bend),Math.round(y+3),1,1);}
  ctx.globalAlpha=1;
}
function drawWeatherSystems(cx,cy){
  if(state.viewMode!==0 && state.viewMode!==2) return;
  if(!planet.weatherSystems?.length || atmosphereStrength(planet)<=.08) return;
  const label=weatherLabel(), atmosphereMode=state.viewMode===2, base=atmosphereAccentColor();
  for(let i=0;i<planet.weatherSystems.length;i++){
    const w=planet.weatherSystems[i],pos=weatherSystemPosition(w,cx,cy); if(!pos) continue;
    if((planet.damageProfile||planet.renderer==='wikipedia')&&!planetContainsPoint(pos.x,pos.y,cx,cy,1)) continue;
    const alpha=(atmosphereMode?.86:.42)*w.intensity,size=Math.max(2,w.size*(.72+pos.depth*.28));
    const electrical=label.includes('STORM')||label.includes('HURRICANE')||label.includes('MONSOON')||label.includes('ELECTRIC');
    const flashTick=Math.floor(performance.now()/150)+(planet.seed%97)+i*11;
    if(electrical && flashTick%31===0) drawLightningBolt(pos.x+(i%3-1)*2,pos.y-2,(planet.seed^i)>>>0,atmosphereMode?.95:.72);
    if(label.includes('HURRICANE')&&i<2){drawSpiralWeather(pos.x,pos.y,size+3,w.spin,C.white,atmosphereMode?.95:.70);continue;}
    if(label.includes('SUPERSTORM')&&i<3){drawSpiralWeather(pos.x,pos.y,size+4,w.spin,base,Math.min(1,alpha+.20));continue;}
    if(label.includes('DUST')){ctx.fillStyle=mixHex(C.brown,C.red,.22);ctx.globalAlpha=alpha;for(let k=0;k<14;k++){const a=w.phase+k*2.17,rr=(k%5)*size*.28;ctx.fillRect(Math.round(pos.x+Math.cos(a)*rr),Math.round(pos.y+Math.sin(a)*rr*.38),k%4===0?2:1,1);}ctx.globalAlpha=1;continue;}
    if(label.includes('BLIZZARD')||label.includes('SNOW')){ctx.fillStyle=C.white;ctx.globalAlpha=alpha;for(let k=0;k<14;k++){const a=w.phase+k*1.31,rr=(k%6)*size*.22;ctx.fillRect(Math.round(pos.x+Math.cos(a)*rr+k*.12),Math.round(pos.y+Math.sin(a)*rr*.35),1,1);}ctx.globalAlpha=1;continue;}
    if(label.includes('MONSOON')||label.includes('RAIN')){ctx.fillStyle=label.includes('METHANE')?C.cyan:C.blue;ctx.globalAlpha=alpha;for(let k=0;k<11;k++){const dx=(k%5-2)*2,dy=Math.floor(k/5)*2;ctx.fillRect(Math.round(pos.x+dx),Math.round(pos.y+dy),1,2);}ctx.globalAlpha=1;continue;}
    if(label.includes('JET')||label.includes('SUPERSONIC')){ctx.fillStyle=label.includes('SUPERSONIC')?C.cyan:base;ctx.globalAlpha=alpha;const len=Math.round(size*2.1);for(let k=-len;k<=len;k+=3)ctx.fillRect(Math.round(pos.x+k),Math.round(pos.y+Math.sin((k+w.phase)*.8)*2),2,1);ctx.globalAlpha=1;continue;}
    if(label.includes('ACID')||label.includes('CHLORINE')||label.includes('TOXIC')){drawSpiralWeather(pos.x,pos.y,size,w.spin,label.includes('CHLORINE')||label.includes('TOXIC')?C.green:C.yellow,alpha+.12);continue;}
    if(label.includes('METAL')){ctx.fillStyle=C.purple;ctx.globalAlpha=alpha;for(let k=0;k<10;k++){const a=w.phase+k*.77,rr=(k%4)*size*.38;ctx.fillRect(Math.round(pos.x+Math.cos(a)*rr),Math.round(pos.y+Math.sin(a)*rr*.4),k%3===0?2:1,1);}ctx.fillStyle=C.white;ctx.fillRect(Math.round(pos.x),Math.round(pos.y),1,1);ctx.globalAlpha=1;continue;}
    if(label.includes('ELECTRIC')){ctx.fillStyle=C.purple;ctx.globalAlpha=alpha;ctx.fillRect(Math.round(pos.x-size),Math.round(pos.y),Math.round(size*2),1);ctx.fillStyle=C.cyan;ctx.fillRect(Math.round(pos.x),Math.round(pos.y-size*.45),1,Math.round(size));ctx.globalAlpha=1;continue;}
    ctx.fillStyle=label.includes('METHANE')?C.cyan:label.includes('ICE')?C.white:base;ctx.globalAlpha=alpha;
    for(let k=0;k<8;k++){const a=w.phase+k*.91,rr=(k%4)*size*.32;ctx.fillRect(Math.round(pos.x+Math.cos(a)*rr),Math.round(pos.y+Math.sin(a)*rr*.45),1+(k%5===0?1:0),1);}ctx.globalAlpha=1;
  }
}
function ringBandMotion(p,radialScale){
  const seedRate=.026+h2((p.seed||0)&255,71,(p.seed^0x72696e67)>>>0)*.026;
  const baseRate=p.ringSpinRate??seedRate;
  const reference=Math.max(.8,p.ringScale||1.52);
  // Keplerian-ish differential rotation: material closer to the planet moves
  // faster than material farther out. It is deliberately softened so the
  // low-resolution particle pattern reads as slow motion rather than flicker.
  const kepler=Math.pow(reference/Math.max(.72,radialScale),1.5);
  const direction=p.ringDirection??p.rotationDirection??1;
  return state.simDays*baseRate*kepler*direction;
}
function ringPoints(cx,cy,front){
  if(!planet.ring) return;
  const style=RING_STYLE_PROFILES[planet.ringStyle]||RING_STYLE_PROFILES.THIN;
  const baseA=planet.rx*(planet.ringScale||1.52), baseB=Math.max(5,planet.ry*(planet.ringFlatness||.27)), rot=planet.ringTilt||0;
  const spread=planet.ringBandSpread??(.86+h2((planet.seed||0)&255,29,(planet.seed^0x73707264)>>>0)*.42);
  const particleScale=planet.ringParticleScale??(.82+h2((planet.seed||0)&255,47,(planet.seed^0x70617274)>>>0)*.56);
  const baseColor=planet.ringColor || (planet.special?.dark?C.red:C.purple);
  for(let bi=0;bi<style.bands.length;bi++){
    const offset=style.bands[bi]*spread;
    const radialScale=(planet.ringScale||1.52)*(1+offset);
    const a=baseA*(1+offset), b=baseB*(1+offset*.72);
    const circumference=Math.PI*(3*(a+b)-Math.sqrt(Math.max(1,(3*a+b)*(a+3*b))));
    const steps=Math.max(90,Math.round(circumference*1.42));
    const turns=ringBandMotion(planet,radialScale);
    const spinOffset=Math.floor(mod(turns,1)*steps);
    const bandColor=planet.ringStyle==='MIXED'
      ? [baseColor,C.yellow,C.blue,C.brown][bi%4]
      : (planet.ringStyle==='ICY' ? mixHex(baseColor,C.white,bi%2?.18:.05) : mixHex(baseColor,C.black,bi%2?.10:0));
    ctx.fillStyle=bandColor;
    ctx.globalAlpha=(planet.ringAlpha??1)*(planet.ringStyle==='DUST'?.78:1);
    for(let i=0;i<steps;i++){
      const th=i/steps*Math.PI*2;
      const ysign=Math.sin(th);
      if((front && ysign<0)||(!front && ysign>=0)) continue;
      // We keep the geometry fixed and move the particle pattern through it.
      // A perfectly uniform ellipse looks static when rotated; shifting the
      // non-uniform particles makes the orbital motion visible.
      const sourceI=mod(i-spinOffset,steps);
      const noise=h2(sourceI+bi*997,bi+17,(planet.seed^0x51ed270b)>>>0);
      if(noise>style.density) continue;
      if(planet.ringStyle==='SPARSE' && ((sourceI+bi*11)%13)<6) continue;
      if(planet.name==='NEPTUNE' && ((Math.floor(sourceI/steps*Math.PI*20)+bi*3)%7)<3) continue;
      const jitter=(h2(sourceI,bi,(planet.seed^0xa5315a9d)>>>0)-.5)*(planet.ringStyle==='DEBRIS'?3.1:planet.ringStyle==='DUST'?1.8:.75)*particleScale;
      const aa=a+jitter, bb=b+jitter*.36;
      const ex=Math.cos(th)*aa, ey=Math.sin(th)*bb;
      const x=cx+ex*Math.cos(rot)-ey*Math.sin(rot), y=cy+ex*Math.sin(rot)+ey*Math.cos(rot);
      const chunkChance=clamp(.80-(particleScale-1)*.10, .62, .86);
      const chunk=(style.size>1||particleScale>1.18) && h2(sourceI+31,bi,(planet.seed^0x8da6b343)>>>0)>chunkChance;
      ctx.fillRect(Math.round(x),Math.round(y),chunk?2:1,1);
      if(chunk && h2(sourceI+9,bi,(planet.seed^0x1b873593)>>>0)>.58) ctx.fillRect(Math.round(x),Math.round(y)+1,1,1);
    }
  }
  ctx.globalAlpha=1;
}

function normalMoonAngle(m){
  if(m?.fixedPosition) return 0;
  return m.phase+(state.simDays/Math.max(.0001,m.periodDays))*Math.PI*2*m.direction;
}
function inspectedMoonAngle(m){
  if(m?.fixedPosition) return 0;
  const inspect=state.moonInspect;
  if(!inspect || planet.moonData[inspect.index]!==m) return normalMoonAngle(m);
  const elapsed=state.simDays-inspect.startSimDays;
  return inspect.startAngle+(elapsed/Math.max(.0001,m.periodDays))*Math.PI*2*m.direction*.06;
}
function moonPosition(m,cx,cy){
  if(m?.fixedPosition){
    return {ang:0,x:cx+(m.fixedPosition.x||0),y:cy+(m.fixedPosition.y||0),depth:m.fixedPosition.depth??1,fixed:true};
  }
  const ang=inspectedMoonAngle(m);
  return {ang,x:cx+Math.cos(ang)*m.orbit,y:cy+Math.sin(ang)*m.orbit*.34,depth:Math.sin(ang)};
}
function beginMoonInspection(index){
  const m=planet.moonData[index];
  if(!m||m.fixedPosition) return;
  if(state.moonInspect?.index===index) return;
  releaseMoonInspection();
  state.moonInspect={index,startSimDays:state.simDays,startAngle:normalMoonAngle(m)};
}
function releaseMoonInspection(){
  const inspect=state.moonInspect;
  if(!inspect) return;
  const m=planet.moonData[inspect.index];
  if(m&&!m.fixedPosition){
    const current=inspect.startAngle+((state.simDays-inspect.startSimDays)/Math.max(.0001,m.periodDays))*Math.PI*2*m.direction*.06;
    m.phase=current-(state.simDays/m.periodDays)*Math.PI*2*m.direction;
  }
  state.moonInspect=null;
}
function pointNearMoonOrbit(p,m,cx,cy){
  if(!p || !m || m.fixedPosition) return false;
  const rx=Math.max(8,m.orbit), ry=Math.max(4,m.orbit*.34);
  const ang=Math.atan2((p.y-cy)/ry,(p.x-cx)/rx);
  const ox=cx+Math.cos(ang)*rx, oy=cy+Math.sin(ang)*ry;
  const dist=Math.hypot(p.x-ox,p.y-oy);
  const tolerance=clamp(Math.round(rx*.045),3,7);
  if(planetContainsPoint(p.x,p.y,cx,cy,-2)) return false;
  return dist<=tolerance;
}
const MOON_SPRITE_VISIBLE_DIAMETERS=[22,18,16,14,12,10,8,8,6,6,6,4,4,4,2,2,2,24,26,28,30,32,34,36,40];
const MOON_NATIVE_SIZE_FRAMES=[
  {frame:14,diameter:2},{frame:11,diameter:4},{frame:8,diameter:6},{frame:6,diameter:8},
  {frame:5,diameter:10},{frame:4,diameter:12},{frame:3,diameter:14},{frame:2,diameter:16},
  {frame:1,diameter:18},{frame:0,diameter:22},{frame:17,diameter:24},{frame:18,diameter:26},
  {frame:19,diameter:28},{frame:20,diameter:30},{frame:21,diameter:32},{frame:22,diameter:34},
  {frame:23,diameter:36},{frame:24,diameter:40}
];
function moonVisualDiameter(m){
  if(!m) return 3;
  const planetVisualRadius=(planet.rx+planet.ry)*.5;
  // radiusKm is the source of truth. We calculate the physically proportional
  // diameter, then select the closest native pixel sprite instead of scaling a
  // tiny moon frame into a blurry/blocky giant.
  const physicalRatio=Math.max(0,(m.radiusKm||0)/Math.max(1,planet.radiusKm||1));
  let physicalDiameter=planetVisualRadius*2*physicalRatio;
  if(planet?.name==='EARTH' && m?.name==='MOON') physicalDiameter*=.78;
  return clamp(Math.round(physicalDiameter),2,40);
}
function moonNativeFrame(targetDiameter){
  let best=MOON_NATIVE_SIZE_FRAMES[0], bestDelta=Infinity;
  for(const entry of MOON_NATIVE_SIZE_FRAMES){
    const delta=Math.abs(entry.diameter-targetDiameter);
    if(delta<bestDelta){ best=entry; bestDelta=delta; }
  }
  return best;
}
function moonSpriteVisibleDiameter(frame){
  return MOON_SPRITE_VISIBLE_DIAMETERS[clamp(Math.round(frame||0),0,MOON_SPRITE_VISIBLE_DIAMETERS.length-1)]||22;
}
function drawMoonOrbit(m,cx,cy,emphasis=false){
  if(!m||m.fixedPosition) return;
  const rx=m.orbit, ry=m.orbit*.34;
  const circumference=Math.PI*(3*(rx+ry)-Math.sqrt((3*rx+ry)*(rx+3*ry)));
  // A little denser than the idle orbit so the moving guide reads as one
  // continuous path instead of a handful of dots hopping between pixels.
  const spacing=emphasis?clamp(Math.round(rx*.105),4,8):clamp(Math.round(rx*.16),6,12);
  const dots=Math.max(emphasis?32:22,Math.round(circumference/spacing));
  const direction=m.direction||1;
  const periodBias=clamp(1/Math.sqrt(Math.max(.25,m.periodDays||1)),.18,1.65);
  // Hover orbit motion is UI animation, independent of simulation speed. Keep
  // the angular phase fully continuous and draw at sub-pixel coordinates so
  // the guide glides instead of snapping one whole canvas pixel at a time.
  const orbitTurns=emphasis ? (performance.now()*0.001)*(.011+.006*periodBias)*direction : 0;
  const orbitGreen=mixHex(C.green,C.white,.18);
  const orbitGreenBright=mixHex(C.green,C.white,.48);
  ctx.fillStyle=emphasis?orbitGreen:C.blue;
  for(let i=0;i<dots;i++){
    const pattern=mod(i,17);
    if(emphasis && (pattern===7 || pattern===8 || mod(i,29)===15)) continue;
    const th=mod(i/dots+orbitTurns,1)*Math.PI*2;
    const x=cx+Math.cos(th)*rx, y=cy+Math.sin(th)*ry;
    ctx.globalAlpha=emphasis?(pattern===0?.98:.84):.62;
    if(emphasis){
      const size=pattern===0?1.55:1.15;
      ctx.fillRect(x-size*.5,y-size*.5,size,size);
    }else{
      ctx.fillRect(Math.round(x),Math.round(y),1,1);
    }
  }
  if(emphasis){
    // Bright green leaders make direction obvious while staying in the app's
    // existing palette rather than introducing a new highlight color.
    for(let k=0;k<3;k++){
      const th=mod(orbitTurns+k*.287,1)*Math.PI*2;
      const x=cx+Math.cos(th)*rx, y=cy+Math.sin(th)*ry;
      ctx.globalAlpha=k===0?1:.78;
      ctx.fillStyle=k===0?orbitGreenBright:orbitGreen;
      const size=k===0?1.8:1.25;
      ctx.fillRect(x-size*.5,y-size*.5,size,size);
    }
  }
  ctx.globalAlpha=1;
}

function drawBlockMoon(pos,m,diameter){
  // Minecraft's single moon follows the same deliberately impossible voxel
  // geometry as the planet instead of using a round moon sprite.
  const s=Math.max(6,Math.round(diameter/2)*2);
  const x=Math.round(pos.x-s/2), y=Math.round(pos.y-s/2);
  const base=mixHex(C.white,C.brown,.34);
  const light=mixHex(base,C.white,.28);
  const dark=mixHex(base,C.black,.30);
  ctx.fillStyle=base; ctx.fillRect(x,y,s,s);
  // Bright top/left and darker right/bottom faces give the tiny square a
  // readable cube-like volume without breaking the native pixel style.
  ctx.fillStyle=light; ctx.fillRect(x,y,s,2); ctx.fillRect(x,y,2,s);
  ctx.fillStyle=dark; ctx.fillRect(x+s-2,y,2,s); ctx.fillRect(x,y+s-2,s,2);
  const seed=hashString(`${planet.seed}:${m.name}:BLOCK-MOON`);
  for(let py=2;py<s-2;py+=2){
    for(let px=2;px<s-2;px+=2){
      const n=h2(px,py,seed);
      if(n>.73){ctx.fillStyle=dark;ctx.fillRect(x+px,y+py,1,1);}
      else if(n<.16){ctx.fillStyle=light;ctx.fillRect(x+px,y+py,1,1);}
    }
  }
  m.visualDiameter=s;
  m.hitRadius=Math.max(6,s*.62+3);
  m.renderFrame=-1;
}
function drawMoons(cx,cy,t,front){
  for(const m of planet.moonData){
    const pos=moonPosition(m,cx,cy); m.screenX=pos.x; m.screenY=pos.y; m.depth=pos.depth;
    if((front && pos.depth<0)||(!front && pos.depth>=0)) continue;
    if(m.kind==='heighliner'){
      drawHeighliner(pos.x,pos.y,cx,cy);
      m.visualDiameter=28; m.hitRadius=15; m.renderFrame=-2;
      continue;
    }
    if(m.kind==='human_ship'){
      drawPandoraOrbiter(pos.x,pos.y);
      m.visualDiameter=18; m.hitRadius=11; m.renderFrame=-3;
      continue;
    }
    const requestedDiameter=moonVisualDiameter(m);
    if(isCubePlanet() && m.name==='BLOCK MOON'){
      drawBlockMoon(pos,m,requestedDiameter);
      continue;
    }
    const native=moonNativeFrame(requestedDiameter);
    const im=texturedMoonSprite(native.frame,moonTintColor(m),m,native.diameter);
    const renderedDiameter=native.diameter;
    m.renderFrame=native.frame;
    if(im && im.width){
      // Draw the native-size moon 1:1. No runtime upscaling means the circular
      // pixel silhouette stays clean and transparent padding cannot balloon
      // into a giant square.
      m.visualDiameter=renderedDiameter;
      m.hitRadius=Math.max(5,renderedDiameter*.55+3);
      ctx.drawImage(im,Math.round(pos.x-im.width/2),Math.round(pos.y-im.height/2));
    } else {
      m.visualDiameter=renderedDiameter;
      m.hitRadius=Math.max(5,renderedDiameter*.55+3);
      ctx.fillStyle=moonTintColor(m);
      const s=Math.max(2,renderedDiameter);
      ctx.beginPath();ctx.arc(Math.round(pos.x),Math.round(pos.y),s*.5,0,Math.PI*2);ctx.fill();
    }
  }
}
function civilizationObjectPosition(o,cx,cy){
  const ang=o.phase+(state.simDays/o.periodDays)*Math.PI*2*o.direction;
  return {x:cx+Math.cos(ang)*o.orbit,y:cy+Math.sin(ang)*o.orbit*o.flatten,depth:Math.sin(ang)};
}
function drawCivilizationCraft(x,y,type,tint=C.white){
  x=Math.round(x);y=Math.round(y);
  if(type==='station'){
    ctx.fillStyle=C.white;ctx.fillRect(x-1,y-1,3,3);
    ctx.fillStyle=C.purple;ctx.fillRect(x-4,y,2,1);ctx.fillRect(x+3,y,2,1);
    ctx.fillStyle=C.cyan;ctx.fillRect(x,y-3,1,2);
  }else if(type==='traffic'){
    ctx.fillStyle=tint;ctx.fillRect(x,y,2,1);ctx.fillStyle=C.white;ctx.fillRect(x-1,y,1,1);
  }else{
    ctx.fillStyle=C.white;ctx.fillRect(x,y,1,1);
    ctx.fillStyle=tint;ctx.fillRect(x-2,y,1,1);ctx.fillRect(x+2,y,1,1);
  }
}
function drawCivilizationOrbitObjects(cx,cy,front){
  const civ=planet.civilization;
  if(!civ || !isAlive() || noLocalOrbit()) return;
  const groups=[civ.satellites,civ.stations,civ.traffic,civ.launched||[]];
  for(const group of groups){
    for(const o of group){
      const pos=civilizationObjectPosition(o,cx,cy);
      if((front&&pos.depth<0)||(!front&&pos.depth>=0)) continue;
      drawCivilizationCraft(pos.x,pos.y,o.type,o.tint);
    }
  }
}
function drawCivilizationMoonMission(cx,cy){
  const civ=planet.civilization;
  if(!civ || !isAlive() || noLocalOrbit() || civ.moonMissionIndex==null) return;
  const m=planet.moonData[civ.moonMissionIndex]; if(!m) return;
  const q=mod(civ.missionPhase+state.simDays/civ.missionPeriodDays,1);
  const u=q<.5?smooth(q*2):smooth((1-q)*2);
  const x=lerp(cx,m.screenX,u), y=lerp(cy,m.screenY,u)-Math.sin(u*Math.PI)*10;
  drawCivilizationCraft(x,y,'traffic',C.green);
}
function specialSetpiecePosition(cx,cy,orbit,flatten,periodDays,phase=.0){
  const ang=phase+state.simDays/Math.max(1,periodDays)*Math.PI*2;
  return {x:cx+Math.cos(ang)*orbit,y:cy+Math.sin(ang)*orbit*flatten,depth:Math.sin(ang)};
}
function drawPandoraOrbiter(x,y){
  x=Math.round(x); y=Math.round(y);
  ctx.fillStyle=mixHex(C.white,C.blue,.18); ctx.fillRect(x-7,y-1,14,2);
  ctx.fillStyle=C.white; ctx.fillRect(x-1,y-3,2,6); ctx.fillRect(x-9,y,2,1); ctx.fillRect(x+8,y,2,1);
  ctx.fillStyle=C.cyan; ctx.fillRect(x-5,y-2,2,1); ctx.fillRect(x+3,y-2,2,1);
  ctx.fillStyle=C.black; ctx.fillRect(x+7,y-1,2,2);
}
function drawHeighlinerTraffic(noseX,noseY,planetCx,planetCy){
  if(planet?.name!=='ARRAKIS') return;
  const dx=planetCx-noseX, dy=planetCy-noseY;
  const dist=Math.hypot(dx,dy)||1;
  const ux=dx/dist, uy=dy/dist;
  const edgeRadius=Math.max(14,(planet.rx+planet.ry)*.52);
  const travel=Math.max(18,dist-edgeRadius*1.02);
  const atmosX=planetCx-ux*edgeRadius*.98, atmosY=planetCy-uy*edgeRadius*.98;
  const now=performance.now()/1000;
  for(let i=0;i<5;i++){
    const phase=mod(now*(.075+i*.003)+i*.22,1.24);
    if(phase>.90) continue;
    const progress=smooth(phase/.90);
    const px=noseX+ux*travel*progress;
    const py=noseY+uy*travel*progress;
    const fade=progress>.82 ? 1-clamp((progress-.82)/.18,0,1) : 1;
    ctx.globalAlpha=.55*fade;
    ctx.fillStyle=C.cyan;
    ctx.fillRect(Math.round(px-ux),Math.round(py-uy),1,1);
    ctx.globalAlpha=.90*fade;
    ctx.fillStyle=C.white;
    ctx.fillRect(Math.round(px),Math.round(py),progress<.16?1:2,1);
    if(progress>.72){
      ctx.globalAlpha=.34*fade;
      ctx.fillStyle=mixHex(C.yellow,C.white,.18);
      ctx.fillRect(Math.round(px+ux*2),Math.round(py+uy*2),1,1);
    }
  }
  for(let i=0;i<3;i++){
    const phase=mod(now*(.061+i*.004)+.38+i*.29,1.34);
    if(phase>.84) continue;
    const progress=smooth(phase/.84);
    const px=atmosX-(atmosX-noseX)*progress;
    const py=atmosY-(atmosY-noseY)*progress;
    const fade=progress>.74 ? 1-clamp((progress-.74)/.26,0,1) : 1;
    ctx.globalAlpha=.40*fade;
    ctx.fillStyle=mixHex(C.yellow,C.red,.22);
    ctx.fillRect(Math.round(px+ux),Math.round(py+uy),1,1);
    ctx.globalAlpha=.88*fade;
    ctx.fillStyle=C.white;
    ctx.fillRect(Math.round(px),Math.round(py),progress>.18?2:1,1);
    if(progress<.18){
      ctx.globalAlpha=.42*fade;
      ctx.fillStyle=C.cyan;
      ctx.fillRect(Math.round(px-ux*2),Math.round(py-uy*2),1,1);
    }
  }
  ctx.globalAlpha=1;
}
function drawHeighliner(x,y,planetCx=x+48,planetCy=y+12){
  const dx=planetCx-x, dy=planetCy-y;
  const len=Math.hypot(dx,dy)||1;
  const ux=dx/len, uy=dy/len;
  const px=-uy, py=ux;
  const bodyLen=48;
  const tailX=x-ux*bodyLen*.58, tailY=y-uy*bodyLen*.58;
  const noseX=x+ux*bodyLen*.42, noseY=y+uy*bodyLen*.42;
  const steps=64;
  const base=mixHex(C.white,C.black,.84);
  const light=mixHex(C.white,C.black,.38);
  const mid=mixHex(C.white,C.black,.66);
  const dark=mixHex(C.white,C.black,.92);
  for(let s=0;s<=steps;s++){
    const t=s/steps;
    const cx=tailX+(noseX-tailX)*t;
    const cy=tailY+(noseY-tailY)*t;
    const radius=3.2+t*3.5+(t>.18&&t<.82&&((s%8)===0)?.35:0);
    for(let w=-Math.ceil(radius);w<=Math.ceil(radius);w++){
      const edge=Math.abs(w)/Math.max(1,radius);
      if(edge>1.06) continue;
      let col=edge>.88 ? dark : edge>.58 ? mid : base;
      if(w<0 && edge<.68) col=light;
      const rx=Math.round(cx+px*w), ry=Math.round(cy+py*w);
      ctx.fillStyle=col;
      ctx.fillRect(rx,ry,1,1);
      if(edge>.74 && (s%6)===0){
        ctx.fillStyle=mixHex(C.cyan,C.white,.48);
        ctx.globalAlpha=.20;
        ctx.fillRect(rx,ry,1,1);
        ctx.globalAlpha=1;
      }
    }
  }
  for(let rib=8;rib<steps-8;rib+=8){
    const t=rib/steps;
    const cx=tailX+(noseX-tailX)*t;
    const cy=tailY+(noseY-tailY)*t;
    const radius=3.2+t*3.3;
    ctx.fillStyle=mixHex(C.white,C.black,.56);
    for(let w=-Math.ceil(radius*.80);w<=Math.ceil(radius*.80);w++){
      const rx=Math.round(cx+px*w), ry=Math.round(cy+py*w);
      ctx.fillRect(rx,ry,1,1);
    }
  }
  const rimOuter=6.0, rimInner=3.9;
  for(let rr=Math.ceil(rimOuter);rr>=1;rr--){
    const col=rr<=rimInner ? C.black : rr>=rimOuter-1 ? mixHex(C.white,C.black,.18) : mixHex(C.white,C.black,.62);
    ctx.fillStyle=col;
    for(let a=0;a<Math.PI*2;a+=Math.PI/28){
      const ex=Math.cos(a)*rr*0.92, ey=Math.sin(a)*rr*0.74;
      const hx=Math.round(noseX+px*ex+ux*ey*.45);
      const hy=Math.round(noseY+py*ex+uy*ey*.45);
      ctx.fillRect(hx,hy,1,1);
    }
  }
  ctx.fillStyle=mixHex(C.cyan,C.white,.34);
  for(let i=0;i<5;i++){
    const t=.18+i*.14;
    const lx=tailX+(noseX-tailX)*t+px*(2.6+i*.25);
    const ly=tailY+(noseY-tailY)*t+py*(2.6+i*.25);
    ctx.fillRect(Math.round(lx),Math.round(ly),1,1);
  }
  drawHeighlinerTraffic(noseX+ux*2,noseY+uy*2,planetCx,planetCy);
}
function drawLoreSetpieces(cx,cy,front){
  if(state.viewMode>1) return;
}
const cloudTintCache=new Map();
function cloudTintColor(){
  const c=(planet.atmosChemistry||'').toUpperCase();
  if(c.includes('SULF')||c.includes('SO2')) return mixHex(C.yellow,C.white,.30);
  if(c.includes('CHLORINE')||c.includes('H2S')) return mixHex(C.green,C.yellow,.38);
  if(c.includes('CH4')||c.includes('METHANE')) return mixHex(C.cyan,C.white,.32);
  if(c.includes('CO2') && surfaceWaterPercent()<15) return mixHex(C.brown,C.red,.18);
  if(c.includes('METALLIC')||c.includes('EXOTIC')) return mixHex(C.purple,C.white,.30);
  if(c.includes('AMMONIA')||c.includes('H2')||c.includes('HE')) return mixHex(C.white,C.yellow,.12);
  return C.white;
}
function tintedCloudSprite(frame,color){
  const im=asset['cloud'+frame]; if(!im||!im.complete||!im.naturalWidth) return im;
  const key=`${frame}:${color}`; if(cloudTintCache.has(key)) return cloudTintCache.get(key);
  const c=document.createElement('canvas'); c.width=im.naturalWidth;c.height=im.naturalHeight;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(im,0,0);g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,c.width,c.height);g.globalCompositeOperation='source-over';
  cloudTintCache.set(key,c);return c;
}

function planetIsAtmosphericGiant(p=planet){
  return !!p && ['jupiter','saturn','uranus','neptune'].includes(p.renderer);
}
function seasonalCloudModifier(p=planet){
  const year=Math.max(40,p?.yearDays||365), phase=((p?.seed||0)%997)/997*Math.PI*2;
  return Math.sin((state.simDays/year)*Math.PI*2+phase)*.055;
}
function dynamicCloudCover(p=planet){
  if(!p || !hasAtmosphereView(p)) return 0;
  let cover=clamp(p.cloudCover||0,0,.99);
  if(p.name==='EARTH') cover=.52;
  if(p.name==='VENUS') cover=.97;
  if(p.name==='MARS') cover=[.06,.17,.46,.66][marsTerraformStage()] ?? cover;
  if(planetIsAtmosphericGiant(p)){
    const upper={JUPITER:.22,SATURN:.16,URANUS:.10,NEPTUNE:.24};
    return upper[p.name] ?? .14;
  }
  const type=p.worldType||'';
  if(type==='OCEAN') cover+=.10;
  else if(type==='VERDANT') cover+=.07;
  else if(type==='TOXIC') cover+=.12;
  else if(type==='VOLCANIC') cover+=.08;
  else if(type==='DESERT') cover-=.10;
  else if(type==='BARREN') cover-=.14;
  const chemistry=(p.atmosChemistry||'').toUpperCase(), t=tempC();
  if((chemistry.includes('WATER')||chemistry.includes('N2')||chemistry.includes('O2')) && t>60) cover-=clamp((t-60)/160,0,.20);
  if(t<-35 && !chemistry.includes('CH4')) cover+=.04;
  cover+=seasonalCloudModifier(p);
  return clamp(cover,.01,.985);
}
function cloudChemistryTypes(p=planet){
  const c=(p?.atmosChemistry||'').toUpperCase();
  if(p?.name==='VENUS'||c.includes('SULF')||c.includes('SO2')) return {low:'H2SO4',high:'SULFUR HAZE'};
  if(c.includes('CHLORINE')) return {low:'CHLORINE',high:'CL2 HAZE'};
  if(c.includes('H2S')) return {low:'SULFIDE',high:'TOXIC HAZE'};
  if(c.includes('CH4')||c.includes('METHANE')) return {low:'METHANE',high:'CH4 ICE'};
  if(c.includes('AMMONIA')||c.includes('H2')||c.includes('HE')) return {low:'AMMONIA',high:'ICE HAZE'};
  if(c.includes('METALLIC')) return {low:'METAL VAPOR',high:'MINERAL HAZE'};
  if(c.includes('EXOTIC')) return {low:'EXOTIC AEROSOL',high:'IONIC HAZE'};
  if((p?.worldType||'')==='VOLCANIC') return {low:'ASH / SO2',high:'SULFUR HAZE'};
  if((p?.worldType||'')==='DESERT' && surfaceWaterPercent()<16) return {low:'DUST',high:'ICE HAZE'};
  if(tempC()<-35) return {low:'ICE',high:'ICE CRYSTALS'};
  return {low:'WATER',high:'ICE'};
}
function cloudTypeLabel(p=planet){
  if(!hasAtmosphereView(p)) return 'NONE';
  const t=cloudChemistryTypes(p), raw=t.low===t.high?t.low:`${t.low}/${t.high}`;
  return raw
    .replace('WATER/ICE','H2O/ICE')
    .replace('H2SO4/SULFUR HAZE','H2SO4/SULFUR')
    .replace('CHLORINE/CL2 HAZE','CL2/HAZE')
    .replace('SULFIDE/TOXIC HAZE','H2S/HAZE')
    .replace('METHANE/CH4 ICE','CH4/ICE')
    .replace('AMMONIA/ICE HAZE','NH3/ICE')
    .replace('METAL VAPOR/MINERAL HAZE','METAL/HAZE')
    .replace('EXOTIC AEROSOL/IONIC HAZE','EXOTIC/IONIC')
    .replace('ASH / SO2/SULFUR HAZE','ASH/SULFUR')
    .replace('DUST/ICE HAZE','DUST/ICE')
    .replace('ICE/ICE CRYSTALS','ICE/CRYSTALS');
}
function precipitationLabel(p=planet){
  if(!hasAtmosphereView(p)) return 'NONE';
  const c=(p.atmosChemistry||'').toUpperCase(), w=weatherLabel(), water=surfaceWaterPercent(), t=tempC();
  if(c.includes('SULF')||c.includes('SO2')||c.includes('CHLORINE')||c.includes('H2S')) return 'ACID / CHEMICAL';
  if(c.includes('CH4')||c.includes('METHANE')) return t<-20?'METHANE SNOW':'METHANE RAIN';
  if(c.includes('AMMONIA')) return 'AMMONIA SNOW';
  if(c.includes('METALLIC')) return 'MINERAL DUST';
  if((p.worldType||'')==='VOLCANIC') return 'ASH';
  if(w.includes('DUST')) return 'DUST';
  if(w.includes('BLIZZARD')||w.includes('SNOW')||t<-12) return 'SNOW / ICE';
  if(water>12 && (w.includes('RAIN')||w.includes('MONSOON')||w.includes('HURRICANE')||w.includes('SHOWERS'))) return 'RAIN';
  return dynamicCloudCover(p)>.55?'TRACE':'NONE';
}
function cloudLayerSpec(layer,p=planet){
  if(!hasAtmosphereView(p) || p?.renderer==='wikipedia') return null;
  const giant=planetIsAtmosphericGiant(p), cover=dynamicCloudCover(p), types=cloudChemistryTypes(p);
  if(giant && layer===0) return null; // the visible giant surface is already atmosphere
  const seedSign=((hashString(`${p.seed}:CLOUD:${layer}`)&1)?1:-1);
  const baseSpeed=Math.max(.035,Math.abs(p.cloudSpeed||.18));
  const chemistry=(p.atmosChemistry||'').toUpperCase();
  let coverage=layer===0?cover*.90:cover*.58+.035;
  if(p.name==='VENUS') coverage=layer===0?.97:.88;
  if(giant) coverage=cover;
  coverage=clamp(coverage,.015,.985);
  let base=cloudTintColor(), accent=mixHex(base,C.white,layer===0?.20:.42);
  if(layer===0 && (p.worldType==='VOLCANIC'||chemistry.includes('METALLIC'))) accent=mixHex(base,C.black,.15);
  const altitude=giant?1:(layer===0?1:2);
  const weather=weatherLabel();
  const stormCenters=(p.weatherSystems||[]).slice(0,3).map(w=>({
    lon:mod(w.lon+state.simDays*w.speed,1),lat:w.lat,intensity:w.intensity,spin:w.spin
  }));
  return {
    layer, giant, coverage, altitude,
    type:layer===0?types.low:types.high,
    speed:seedSign*baseSpeed*(layer===0?.026:.043)*(layer===0?1:1.31),
    opacity:layer===0?.82:.64,
    diagnosticOpacity:layer===0?.97:.84,
    base,accent,weather,stormCenters,
    seed:(p.seed^(layer===0?0x6b7d4f21:0xa913cc5d))>>>0,
    shadow:layer===0&&!giant
  };
}
function cloudThreshold(coverage){ return clamp(.805-coverage*.56,.245,.80); }
function cloudStormInfluence(lon,lat,spec){
  const systems=spec.stormCenters||[]; if(!systems.length) return 0;
  const weather=spec.weather||''; let boost=0;
  for(const w of systems){
    const dx=mod(lon-w.lon+.5,1)-.5, dy=lat-w.lat;
    const sx=weather.includes('HURRICANE')?.105:.13, sy=weather.includes('HURRICANE')?.075:.10;
    const d=Math.sqrt((dx/sx)**2+(dy/sy)**2);
    if(d>1.55) continue;
    let influence=(1-d/1.55)*.34*w.intensity;
    if(weather.includes('HURRICANE')){
      const ang=Math.atan2(dy/sy,dx/sx), spiral=Math.sin(ang*2.2+d*11*w.spin+state.simDays*.14*w.spin);
      influence+=Math.max(0,spiral)*.24*(1-d/1.55);
      if(d<.17) influence-=.48; // clear eye
    }else if(weather.includes('SUPERSTORM')||weather.includes('SUPERSONIC')) influence*=1.45;
    boost=Math.max(boost,influence);
  }
  return boost;
}
function cloudFieldValue(lon,lat,spec){
  const drift=state.simDays*spec.speed;
  const u=mod(lon+drift,1);
  const latWarp=(periodicNoise01(u,lat,12,6,spec.seed^0x3121)-.5)*.055;
  const l1=periodicNoise01(u,lat+latWarp,spec.layer?14:10,spec.layer?8:6,spec.seed);
  const l2=periodicNoise01(u,lat-latWarp*.6,spec.layer?36:26,spec.layer?18:14,spec.seed^0x77a1);
  const l3=periodicNoise01(u,lat,spec.layer?78:58,spec.layer?36:28,spec.seed^0x2359);
  let v=l1*.54+l2*.31+l3*.15;
  const latitude=Math.abs(lat-.5)*2;
  if(spec.type.includes('ICE')) v+=latitude*.035;
  if(spec.type.includes('DUST')) v+=(1-latitude)*.035;
  v+=cloudStormInfluence(lon,lat,spec);
  return v;
}
function collectCloudPixels(cx,cy,spec){
  if(!spec) return [];
  const rx=planet.rx+spec.altitude, ry=planet.ry+spec.altitude;
  const threshold=cloudThreshold(spec.coverage), points=[];
  for(let y=Math.floor(cy-ry-1);y<=Math.ceil(cy+ry+1);y++){
    const ny=(y-cy)/ry; if(Math.abs(ny)>1) continue;
    for(let x=Math.floor(cx-rx-1);x<=Math.ceil(cx+rx+1);x++){
      const nx=(x-cx)/rx, rr=nx*nx+ny*ny; if(rr>1) continue;
      if(geometryMissingAt(nx,ny,planet)) continue;
      const z=Math.sqrt(Math.max(0,1-rr));
      const lon=mod(.5+Math.atan2(nx,z)/(Math.PI*2)+state.phase,1), lat=clamp(.5+Math.asin(ny)/Math.PI,0,1);
      const value=cloudFieldValue(lon,lat,spec); if(value<threshold) continue;
      const intensity=clamp((value-threshold)/Math.max(.05,1-threshold),0,1);
      points.push({x,y,nx,ny,z,lon,lat,intensity});
    }
  }
  return points;
}
function drawCloudShadows(points,cx,cy,spec){
  if(!spec?.shadow||state.viewMode!==0||!points.length) return;
  ctx.fillStyle=C.black;
  for(const q of points){
    if(q.intensity<.13 || h2(q.x,q.y,spec.seed^0x1145)<.34) continue;
    const sx=q.x+1,sy=q.y+1,nx=(sx-cx)/planet.rx,ny=(sy-cy)/planet.ry;
    if(nx*nx+ny*ny>1) continue;
    ctx.globalAlpha=.08+q.intensity*.12;
    ctx.fillRect(sx,sy,1,1);
  }
  ctx.globalAlpha=1;
}
function drawCloudPixels(points,spec,diagnostic=false){
  if(!spec||!points.length) return;
  const opacity=diagnostic?spec.diagnosticOpacity:spec.opacity;
  for(const q of points){
    const bright=h2(q.x,q.y,spec.seed^0x8f13)>.58;
    let col=bright?spec.accent:spec.base;
    if(spec.type.includes('DUST')) col=bright?mixHex(C.brown,C.yellow,.20):mixHex(C.brown,C.red,.16);
    if(spec.type.includes('ASH')) col=bright?C.brown:mixHex(C.brown,C.black,.38);
    ctx.fillStyle=col;ctx.globalAlpha=opacity*(.48+q.intensity*.52);
    ctx.fillRect(q.x,q.y,1,1);
  }
  ctx.globalAlpha=1;
}
function drawProceduralCloudLayers(cx,cy){
  if(state.viewMode!==0&&state.viewMode!==2) return;
  if(!hasAtmosphereView()) return;
  const diagnostic=state.viewMode===2;
  const lowSpec=cloudLayerSpec(0), highSpec=cloudLayerSpec(1);
  const low=collectCloudPixels(cx,cy,lowSpec), high=collectCloudPixels(cx,cy,highSpec);
  drawCloudShadows(low,cx,cy,lowSpec);
  drawCloudPixels(low,lowSpec,diagnostic);
  drawCloudPixels(high,highSpec,diagnostic);
}
function spherePointFromLonLat(lon,lat,cx,cy,scale=1){
  const a=(mod(lon-state.phase,1)-.5)*Math.PI*2, depth=Math.cos(a); if(depth<-.08) return null;
  return {x:cx+Math.sin(a)*planet.rx*scale,y:cy+(lat-.5)*2*planet.ry*.80*scale,depth};
}
function drawAuroras(cx,cy){
  if((state.viewMode!==0&&state.viewMode!==2)||!hasAtmosphereView()) return;
  const field=(planet.scan?.magField||'').toUpperCase();
  if(!['MODERATE','STRONG','EXTREME'].includes(field)) return;
  if((hashString(`${planet.seed}:AURORA`)%100)<28 && planet.name!=='EARTH') return;
  const diagnostic=state.viewMode===2, col=planet.atmosChemistry?.includes('CH4')?C.cyan:C.green;
  ctx.fillStyle=col;ctx.globalAlpha=diagnostic?.72:.30;
  const phase=state.simDays*.06+(planet.seed%17);
  for(const pole of [-1,1]){
    const yy=cy+pole*planet.ry*.74;
    for(let i=-10;i<=10;i+=2){
      const wave=Math.sin(i*.7+phase)*2;
      if(((i+planet.seed)&3)===0) continue;
      const ax=Math.round(cx+i),ay=Math.round(yy+wave);
      if(!planetContainsPoint(ax,ay,cx,cy,1)) continue;
      ctx.fillRect(ax,ay,1,1);
    }
  }
  ctx.globalAlpha=1;
}
function drawVolcanicPlumes(cx,cy){
  if((state.viewMode!==0&&state.viewMode!==2)) return;
  const volcanic=(planet.worldType==='VOLCANIC'||planet.name==='VENUS'||['HIGH','VIOLENT'].includes(planet.scan?.volcanism));
  if(!volcanic) return;
  const count=planet.name==='VENUS'?2:1+(planet.scan?.volcanism==='VIOLENT'?2:0);
  for(let i=0;i<count;i++){
    const lon=h2(i,19,planet.seed^0x7ca1),lat=.28+h2(i,31,planet.seed^0x2a9d)*.45,p=spherePointFromLonLat(lon,lat,cx,cy,.96); if(!p)continue;
    if(!planetContainsPoint(p.x,p.y,cx,cy,1)) continue;
    const height=3+Math.floor(h2(i,7,planet.seed)*5), col=planet.name==='VENUS'?C.brown:mixHex(C.brown,C.black,.30);
    ctx.fillStyle=col;ctx.globalAlpha=state.viewMode===2?.78:.55;
    for(let k=0;k<height;k++){ctx.fillRect(Math.round(p.x+(k%2?1:0)),Math.round(p.y-k),1+(k>height*.6?1:0),1);}
    ctx.globalAlpha=1;
  }
}
function drawPolarVortices(cx,cy){
  if((state.viewMode!==0&&state.viewMode!==2)||!hasAtmosphereView()) return;
  if(!(planetIsAtmosphericGiant()||planet.atmosDensity==='SUPERDENSE')) return;
  const diagnostic=state.viewMode===2, col=atmosphereAccentColor();
  ctx.strokeStyle=col;ctx.globalAlpha=diagnostic?.78:.28;
  for(const pole of [-1,1]){
    const py=cy+pole*planet.ry*.70;
    if(planet.name==='SATURN'&&pole<0){
      ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2,x=cx+Math.cos(a)*5,y=py+Math.sin(a)*2.2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();
    }else{
      for(let a=0;a<Math.PI*2;a+=.45) if(((a*10)|0)%2===0)ctx.fillRect(Math.round(cx+Math.cos(a)*5),Math.round(py+Math.sin(a)*2),1,1);
    }
  }
  ctx.globalAlpha=1;
}
function drawNormalAtmosphereHaze(cx,cy){
  if(state.viewMode!==0||!hasAtmosphereView()) return;
  const strength=atmosphereStrength(planet); if(strength<.28) return;
  const color=atmosphereBaseColor(), count=Math.round(20+strength*42);
  ctx.fillStyle=color;ctx.globalAlpha=.05+strength*.06;
  for(let i=0;i<count;i++){
    const a=h2(i,17,planet.seed)*Math.PI*2, rr=Math.sqrt(h2(i,31,planet.seed^0x51ac))*Math.min(planet.rx,planet.ry)*.93;
    const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr*(planet.ry/planet.rx);
    if(!planetContainsPoint(x,y,cx,cy,0)) continue;
    if((i+planet.seed)%3===0)ctx.fillRect(Math.round(x),Math.round(y),2,1);else ctx.fillRect(Math.round(x),Math.round(y),1,1);
  }
  ctx.globalAlpha=1;
}
function isHaloRingWorld(p=planet){ return p?.shape==='haloRing'; }
function haloRingMetric(px,py,cx,cy,p=planet,padding=0){
  const outer=Math.max(8,(p.radius||65)+padding), flat=clamp(p.haloFlatten||.30,.12,.72), angle=p.haloScreenAngle||0;
  const dx=px-cx,dy=py-cy,ca=Math.cos(angle),sa=Math.sin(angle);
  const xr=dx*ca+dy*sa, yr=-dx*sa+dy*ca;
  const rr=Math.sqrt((xr/outer)**2+(yr/(outer*flat))**2);
  const band=Math.max(4,(p.haloBandWidth||13)+padding*1.2),inner=Math.max(.08,(outer-band)/outer);
  const arc=Math.atan2(yr/(flat||.001),xr);
  const rawTheta=mod(arc/(Math.PI*2)+.5,1);
  const theta=mod(rawTheta+(state.phase||0),1);
  return {rr,inner,outer,flat,xr,yr,theta,rawTheta,arc,depth:Math.sin(arc),cross:(rr-inner)/Math.max(.001,1-inner)};
}
function haloGapAt(theta,p=planet){
  const gaps=p?.haloGaps||[];
  for(const g of gaps){ if(lonDistance(theta,mod(g.at,1))<(g.size||.04)) return true; }
  return false;
}
function haloGapEdgeAt(theta,p=planet){
  if(haloGapAt(theta,p)) return false;
  const e=.0065;
  return haloGapAt(mod(theta+e,1),p)||haloGapAt(mod(theta-e,1),p);
}
function haloMetalColor(theta,cross,p=planet,bright=false){
  const panel=periodicNoise01(theta,cross,94,16,p.terrainSeed^0x4d455441);
  const base=mixHex(C.white,C.black,bright ? .38 : .62+panel*.12);
  return panel>.78?mixHex(base,C.blue,.08):base;
}
function haloSurfaceColor(theta,cross,metric,p=planet){
  if(state.viewMode===3){
    const heat=clamp(state.temp+(periodicNoise01(theta,cross,26,8,p.terrainSeed^0x4807)-.5)*.08,0,1);
    return heat<.2?C.blue:heat<.4?C.cyan:heat<.6?C.green:heat<.8?C.yellow:C.red;
  }
  const breakEdge=haloGapEdgeAt(theta,p);
  const edge=cross<.18||cross>.82;
  const panel=periodicNoise01(theta,cross,72,10,p.terrainSeed^0x48414c4f);
  const sector=mod(theta*64,1), lane=mod(cross*11,1);
  const sectorSeam=sector<.030||sector>.970;
  const laneSeam=lane<.055||lane>.955;

  // Broken Halos reveal the engineered cross-section instead of ending in a
  // flat terrain-colored cut. Alternating dark braces, pale foundation metal
  // and cyan conduits echo the exposed Forerunner lattice seen on damaged
  // installations while remaining fully procedural/copyright-safe.
  if(breakEdge){
    const brace=Math.floor(cross*15)%5;
    if(brace===0||brace===3) return mixHex(C.white,C.black,.45);
    if(brace===1 && mod(theta*173,1)<.36) return C.cyan;
    return mixHex(C.brown,C.black,.42);
  }
  if(edge){
    let metal=haloMetalColor(theta,cross,p,sectorSeam);
    if(sectorSeam) metal=mixHex(metal,C.white,.17);
    if(laneSeam && panel>.46) metal=mixHex(metal,C.cyan,.14);
    return metal;
  }
  if(state.viewMode===2){
    const cloud=periodicNoise01(mod(theta+state.simDays*.002,1),cross,38,7,p.terrainSeed^0x41544d4f);
    let c=mixHex(C.blue,C.cyan,.45);
    if(cloud>.58)c=mixHex(c,C.white,.48);
    if(panel<.18)c=mixHex(c,C.black,.14);
    return c;
  }

  const style=p.haloStyle||'temperate';
  const terrain=periodicNoise01(theta,cross,30,10,p.terrainSeed^0x53555246);
  const detail=periodicNoise01(theta,cross,91,25,p.terrainSeed^0x46494e45);
  const macro=periodicNoise01(theta,cross,13,5,p.terrainSeed^0x4d414352);
  const ridge=periodicNoise01(theta,cross,57,12,p.terrainSeed^0x52494447);
  let col=C.green;
  if(style==='desert'){
    col=terrain<.18?mixHex(C.blue,C.cyan,.24):terrain>.82?mixHex(C.brown,C.white,.08):(macro>.68?mixHex(C.yellow,C.white,.10):C.yellow);
    if(ridge>.84) col=mixHex(C.brown,C.white,.16);
  }else if(style==='oceanice'){
    col=terrain<.64?(terrain<.34?C.blue:C.cyan):(detail>.50?C.white:mixHex(C.brown,C.white,.36));
    if(terrain>.62&&ridge>.80) col=C.white;
  }else if(style==='mixed'){
    col=terrain<.22?C.blue:terrain<.47?C.green:terrain<.70?C.yellow:mixHex(C.red,C.brown,.30);
    if(ridge>.87) col=mixHex(C.brown,C.white,.14);
  }else if(style==='jungle'){
    col=terrain<.27?C.blue:(detail>.76?mixHex(C.green,C.black,.20):C.green);
    if(ridge>.86) col=mixHex(C.brown,C.green,.20);
  }else if(style==='tundra'){
    col=terrain<.22?C.cyan:terrain>.67?C.white:mixHex(C.green,C.white,.26);
    if(ridge>.78) col=mixHex(C.white,C.blue,.08);
  }else if(style==='zeta'){
    col=terrain<.27?C.blue:terrain>.80?mixHex(C.brown,C.white,.20):(detail>.67?mixHex(C.green,C.yellow,.12):C.green);
    if(ridge>.82) col=detail>.55?C.white:mixHex(C.brown,C.white,.26);
  }else{
    col=terrain<.29?C.blue:terrain>.80?C.brown:C.green;
    if(ridge>.86) col=mixHex(C.brown,C.white,.20);
  }

  if(p.haloGlassed){
    const glass=periodicNoise01(theta,cross,19,6,p.terrainSeed^0x474c4153);
    if(glass>.72) col=mixHex(C.black,C.red,.20);
    else if(glass>.63) col=mixHex(col,C.brown,.50);
  }

  // Sector seams and service lanes break up the landscape with unmistakably
  // artificial Forerunner geometry. Keep them sparse so the biosphere still
  // reads first at this tiny pixel-art scale.
  if(sectorSeam && panel>.30) col=mixHex(col,C.black,.23);
  if(laneSeam && detail>.55) col=mixHex(col,C.white,.12);
  if((sector<.012||sector>.988) && lane>.35&&lane<.65 && Math.floor(theta*64)%5===0) col=mixHex(C.cyan,C.white,.18);

  if(state.viewMode===0 && cross>.18&&cross<.82){
    const cloud=periodicNoise01(mod(theta+state.simDays*.0018,1),cross,46,8,p.terrainSeed^0x434c4f55);
    if(cloud>clamp(.91-(p.cloudCover||.2)*.35,.68,.93)) col=mixHex(col,C.white,.56);
  }

  // The back half of the ring is slightly darker, which helps the band read as
  // one huge curved structure rather than a flat decorative ellipse.
  const depthLight=.90+(metric.depth*.5+.5)*.10;
  const rimLight=clamp(.97-Math.abs(cross-.5)*.10,.90,1);
  const shade=depthLight*rimLight;
  return shade<1?mixHex(col,C.black,1-shade):mixHex(col,C.white,shade-1);
}
function drawPixelLine(x0,y0,x1,y1,color,alpha=1){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
  let err=dx+dy;
  ctx.fillStyle=color;ctx.globalAlpha=alpha;
  for(;;){ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*err;if(e2>=dy){err+=dy;x0+=sx;}if(e2<=dx){err+=dx;y0+=sy;}}
  ctx.globalAlpha=1;
}
function haloPointOnRing(rawTheta,radius,cx,cy,outer,flat,angle){
  const a=(rawTheta-.5)*Math.PI*2,ca=Math.cos(angle),sa=Math.sin(angle);
  const xr=Math.cos(a)*radius,yr=Math.sin(a)*radius*flat;
  return {x:cx+xr*ca-yr*sa,y:cy+xr*sa+yr*ca};
}
function drawHaloDamageDebris(cx,cy,outer,flat,angle,inner){
  const gaps=planet.haloGaps||[]; if(!gaps.length) return;
  for(let gi=0;gi<gaps.length;gi++){
    const g=gaps[gi],size=g.size||.04;
    for(const side of [-1,1]){
      const worldTheta=mod(g.at+side*size,1),rawTheta=mod(worldTheta-(state.phase||0),1);
      const base=haloPointOnRing(rawTheta,(outer+inner)*.5,cx,cy,outer,flat,angle);
      const a=(rawTheta-.5)*Math.PI*2;
      const ca=Math.cos(angle),sa=Math.sin(angle);
      const tx=-Math.sin(a)*ca-Math.cos(a)*flat*sa,ty=-Math.sin(a)*sa+Math.cos(a)*flat*ca;
      const tl=Math.max(.001,Math.hypot(tx,ty)),tux=tx/tl,tuy=ty/tl;
      const rxv=Math.cos(a)*ca-Math.sin(a)*flat*sa,ryv=Math.cos(a)*sa+Math.sin(a)*flat*ca;
      const rl=Math.max(.001,Math.hypot(rxv,ryv)),rux=rxv/rl,ruy=ryv/rl;
      const count=planet.haloStatus==='DESTROYED'?7:5;
      for(let k=0;k<count;k++){
        const n=h2(gi*31+k,side<0?7:13,(planet.seed^0x44454252)>>>0);
        const along=side*(2+k*1.45+n*2.6),out=(h2(k,gi,(planet.seed^0x4252454b)>>>0)-.5)*9;
        const x=base.x+tux*along+rux*out,y=base.y+tuy*along+ruy*out;
        ctx.globalAlpha=.42+n*.48;
        ctx.fillStyle=k%4===0?C.cyan:(k%3===0?mixHex(C.yellow,C.brown,.42):mixHex(C.white,C.black,.48));
        ctx.fillRect(Math.round(x),Math.round(y),n>.78?2:1,1);
      }
    }
  }
  ctx.globalAlpha=1;
}
function drawHaloRingWorld(cx,cy,t){
  const outer=planet.radius||65,flat=clamp(planet.haloFlatten||.30,.12,.72),angle=planet.haloScreenAngle||0;
  const band=planet.haloBandWidth||13,inner=outer-band,ext=Math.ceil(outer+3);
  for(let y=Math.floor(cy-ext);y<=Math.ceil(cy+ext);y++){
    for(let x=Math.floor(cx-ext);x<=Math.ceil(cx+ext);x++){
      const m=haloRingMetric(x,y,cx,cy,planet,0);
      if(m.rr>1||m.rr<m.inner||haloGapAt(m.theta,planet)) continue;
      ctx.fillStyle=haloSurfaceColor(m.theta,m.cross,m,planet);ctx.fillRect(x,y,1,1);
    }
  }

  // Add structural ribs, retaining walls and cold-blue service lights on top of
  // the terrain pass. These details are derived from the reference language of
  // Halo's exposed superstructure rather than copied from any source image.
  if(state.viewMode===0||state.viewMode===1){
    const sectors=52;
    for(let i=0;i<sectors;i++){
      const raw=i/sectors,theta=mod(raw+(state.phase||0),1); if(haloGapAt(theta,planet)) continue;
      if((i+(planet.seed&7))%3!==0) continue;
      const a=haloPointOnRing(raw,inner+1.0,cx,cy,outer,flat,angle);
      const b=haloPointOnRing(raw,outer-1.0,cx,cy,outer,flat,angle);
      drawPixelLine(a.x,a.y,b.x,b.y,mixHex(C.white,C.black,.67),.30);
      if((i+(planet.seed&3))%11===0){
        const lamp=haloPointOnRing(raw,inner+2.2,cx,cy,outer,flat,angle);
        ctx.globalAlpha=.88;ctx.fillStyle=C.cyan;ctx.fillRect(Math.round(lamp.x),Math.round(lamp.y),1,1);ctx.globalAlpha=1;
      }
    }
  }

  if(state.viewMode===0||state.viewMode===2){
    ctx.globalAlpha=state.viewMode===2?.46:.20;ctx.fillStyle=state.viewMode===2?C.cyan:C.blue;
    const steps=220;
    for(let i=0;i<steps;i++){
      const raw=i/steps,theta=mod(raw+(state.phase||0),1);if(haloGapAt(theta,planet))continue;
      const q=haloPointOnRing(raw,inner+.5,cx,cy,outer,flat,angle);
      ctx.fillRect(Math.round(q.x),Math.round(q.y),1,1);
    }
    ctx.globalAlpha=1;
  }
  drawHaloDamageDebris(cx,cy,outer,flat,angle,inner);
}

function isCubePlanet(p=planet){ return p?.shape==='cube'; }
function planetContainsPoint(px,py,cx,cy,padding=0){
  if(isCubePlanet()) return Math.abs(px-cx)<=planet.rx+padding && Math.abs(py-cy)<=planet.ry+padding;
  if(isHaloRingWorld()){
    const m=haloRingMetric(px,py,cx,cy,planet,padding);
    return m.rr<=1 && m.rr>=m.inner && !haloGapAt(m.theta,planet);
  }
  const nx=(px-cx)/Math.max(1,planet.rx+padding), ny=(py-cy)/Math.max(1,planet.ry+padding);
  if(nx*nx+ny*ny>1) return false;
  const baseNx=(px-cx)/Math.max(1,planet.rx),baseNy=(py-cy)/Math.max(1,planet.ry);
  if(baseNx*baseNx+baseNy*baseNy<=1 && geometryMissingAt(baseNx,baseNy,planet)) return false;
  return true;
}
function minecraftBlockColor(u,v,shade=0){
  const tempLocal=clamp(state.temp-Math.abs(v-.5)*.28,0,1);
  if(state.viewMode===3){
    const c=tempLocal<.2?C.blue:tempLocal<.4?C.cyan:tempLocal<.6?C.green:tempLocal<.8?C.yellow:C.red;
    return shade?mixHex(c,C.black,shade):c;
  }
  if(state.viewMode===2){
    const n=periodicNoise01(u,v,20,12,planet.terrainSeed^0x4d43);
    let c=mixHex(C.blue,C.cyan,.36+n*.26);
    if(n>.72) c=mixHex(c,C.white,.28);
    return shade?mixHex(c,C.black,shade):c;
  }
  const n=periodicNoise01(u,v,18,12,planet.terrainSeed^0x4d43);
  const d=periodicNoise01(u,v,42,30,planet.terrainSeed^0xb10c);
  const polar=Math.abs(v-.5)>.43;
  let c;
  if(polar && state.temp<.62) c=C.white;
  else if(n<.34) c=n<.23?C.blue:C.cyan;
  else if(n>.76) c=d>.52?C.brown:mixHex(C.brown,C.white,.16);
  else if(state.temp>.83) c=C.yellow;
  else if(state.temp<.20) c=C.white;
  else c=d>.78?mixHex(C.green,C.brown,.24):C.green;
  return shade?mixHex(c,C.black,shade):c;
}
function drawMinecraftClouds(cx,cy,diagnostic=false){
  if(state.viewMode!==0&&state.viewMode!==2) return;
  const r=planet.radius, left=Math.round(cx-r), top=Math.round(cy-r), size=r*2;
  const drift=state.simDays*.0065;
  const threshold=diagnostic?.56:.68;
  for(let y=0;y<size;y+=2){
    const v=(y+.5)/size;
    for(let x=0;x<size;x+=2){
      const u=mod((x+.5)/size+drift,1);
      const a=periodicNoise01(u,v,14,8,planet.terrainSeed^0xc10d);
      const b=periodicNoise01(u,v,36,22,planet.terrainSeed^0xc10e);
      const cloud=a*.68+b*.32;
      if(cloud<threshold) continue;
      if(!diagnostic){
        ctx.fillStyle=C.black;ctx.globalAlpha=.13;ctx.fillRect(left+x+1,top+y+1,2,2);
      }
      ctx.fillStyle=diagnostic?C.cyan:C.white;
      ctx.globalAlpha=diagnostic?.82:.72;
      ctx.fillRect(left+x,top+y,2,2);
    }
  }
  ctx.globalAlpha=1;
}
function drawMinecraftCube(cx,cy,t){
  const normalView=state.viewMode===0, atmosphereView=state.viewMode===2, showEnvironment=normalView||atmosphereView;
  if(normalView) drawCivilizationOrbitObjects(cx,cy,false);
  drawMoons(cx,cy,t,false);
  const r=planet.radius, left=Math.round(cx-r), top=Math.round(cy-r), size=r*2;
  if(showEnvironment){
    ctx.fillStyle=atmosphereView?atmosphereAccentColor():mixHex(atmosphereBaseColor(),C.black,.30);
    ctx.globalAlpha=atmosphereView?.70:.24;
    ctx.fillRect(left-2,top-2,size+4,1);ctx.fillRect(left-2,top+size+1,size+4,1);
    ctx.fillRect(left-2,top-1,1,size+2);ctx.fillRect(left+size+1,top-1,1,size+2);
    ctx.globalAlpha=1;
  }
  ctx.fillStyle=mixHex(C.black,C.white,.08);ctx.fillRect(left-1,top-1,size+2,size+2);
  const block=2,rot=state.phase;
  for(let y=0;y<size;y+=block){
    const v=(y+.5)/size;
    for(let x=0;x<size;x+=block){
      const u=mod((x+.5)/size+rot,1);
      let shade=0;
      if(x>size-10) shade=.25;
      else if(y<8) shade=-.08;
      let col=minecraftBlockColor(u,v,Math.max(0,shade));
      if(shade<0) col=mixHex(col,C.white,-shade);
      ctx.fillStyle=col;ctx.fillRect(left+x,top+y,block,block);
      const detail=h2(x,y,planet.terrainSeed);
      if(state.viewMode<=1 && detail>.965 && col===C.green){
        ctx.fillStyle=mixHex(C.green,C.black,.35);ctx.fillRect(left+x,top+y,1,1);
      }
    }
  }
  // Strong square silhouette and slight face shading make it read as a planet-sized cube.
  ctx.fillStyle=mixHex(C.black,C.white,.10);
  ctx.fillRect(left,top,2,size);ctx.fillRect(left,top,size,2);
  ctx.fillStyle=mixHex(C.black,C.white,.22);
  ctx.fillRect(left+size-3,top,3,size);ctx.fillRect(left,top+size-3,size,3);
  drawMinecraftClouds(cx,cy,atmosphereView);
  if(showEnvironment){
    drawWeatherSystems(cx,cy);
    drawAuroras(cx,cy);
  }
  drawMoons(cx,cy,t,true);
  if(normalView){drawCivilizationOrbitObjects(cx,cy,true);drawCivilizationMoonMission(cx,cy);}
}
function drawPlanet(cx,cy,t){
  if(isCubePlanet()) { drawMinecraftCube(cx,cy,t); return; }
  if(isHaloRingWorld()) { drawHaloRingWorld(cx,cy,t); return; }
  const normalView=state.viewMode===0, atmosphereView=state.viewMode===2, showEnvironment=normalView||atmosphereView;
  if(normalView) drawCivilizationOrbitObjects(cx,cy,false);
  drawLoreSetpieces(cx,cy,false);
  drawMoons(cx,cy,t,false); ringPoints(cx,cy,false); if(showEnvironment) drawAtmosphereLimb(cx,cy);
  const minX=Math.floor(cx-planet.rx-1), maxX=Math.ceil(cx+planet.rx+1), minY=Math.floor(cy-planet.ry-1), maxY=Math.ceil(cy+planet.ry+1);
  const rot = state.phase;
  for(let y=minY;y<=maxY;y++){
    const ny=(y-cy)/planet.ry;
    if(Math.abs(ny)>1) continue;
    for(let x=minX;x<=maxX;x++){
      const nx=(x-cx)/planet.rx;
      const rr=nx*nx+ny*ny; if(rr>1) continue;
      if(specialSurfaceMask(nx,ny)){
        if(planet.renderer==='wikipedia') continue;
        ctx.fillStyle=damageInteriorColor(nx,ny,planet); ctx.fillRect(x,y,1,1);
        continue;
      }
      const z=Math.sqrt(Math.max(0,1-rr));
      const lon=mod(.5+Math.atan2(nx,z)/(Math.PI*2)+rot,1);
      const lat=clamp(.5+Math.asin(ny)/Math.PI,0,1);
      const baseSurface=surfaceColor(lon,lat,ny,nx,z);
      ctx.fillStyle=damageSurfaceColor(baseSurface,nx,ny,planet); ctx.fillRect(x,y,1,1);
    }
  }
  if(normalView) drawNormalAtmosphereHaze(cx,cy);
  // NORMAL shows the full atmosphere. CLEAN and TEMPERATURE intentionally strip it away.
  if(showEnvironment){
    drawProceduralCloudLayers(cx,cy);
    if(planet.renderer==='ooo') drawOOOCloudSwirls(cx,cy);
    drawWeatherSystems(cx,cy);
    drawVolcanicPlumes(cx,cy);
    drawPolarVortices(cx,cy);
    drawAuroras(cx,cy);
  }
  ringPoints(cx,cy,true); drawMoons(cx,cy,t,true);
  drawLoreSetpieces(cx,cy,true);
  if(normalView){drawCivilizationOrbitObjects(cx,cy,true);drawCivilizationMoonMission(cx,cy);}
}

function drawBaseLabel(cx,cy){
  const right=cx+planet.rx+13;
  const x=right<366?right:Math.max(8,cx-planet.rx-13-textWidth(planet.name));
  const y=Math.round(cy-12);
  drawText(planet.name,x,y,C.white,1);
  drawText(isHaloRingWorld()?`${(planet.radiusKm*2).toLocaleString('en-US')} KM DIA`:`${planet.radiusKm.toLocaleString('en-US')} KM`,x,y+10,C.blue,1);
  if(isFavorite()) drawText('FAV',x,y+20,C.purple,1);
}
function bodyAtPoint(p,cx,cy){
  if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  for(let i=planet.moonData.length-1;i>=0;i--){
    const m=planet.moonData[i], dx=p.x-m.screenX, dy=p.y-m.screenY, hr=m.hitRadius||7;
    const hiddenBehindPlanet=m.depth<0 && planetContainsPoint(m.screenX,m.screenY,cx,cy,0);
    if(!hiddenBehindPlanet && dx*dx+dy*dy<=hr*hr) return {type:'moon',index:i};
  }
  for(let i=planet.moonData.length-1;i>=0;i--){
    const m=planet.moonData[i];
    if(pointNearMoonOrbit(p,m,cx,cy)) return {type:'moon',index:i};
  }
  if(planetContainsPoint(p.x,p.y,cx,cy,3)) return {type:'planet'};
  return null;
}
function sameBody(a,b){ return !!a&&!!b&&a.type===b.type&&(a.type!=='moon'||a.index===b.index); }
function drawObjectMarker(body,cx,cy){
  if(!body) return;
  if(body.type==='moon'){
    const m=planet.moonData[body.index]; if(!m) return;
    const r=Math.ceil(m.hitRadius||7);
    drawFocusFrame(m.screenX-r-2,m.screenY-r-2,r*2+5,r*2+5);
  }else{
    drawFocusFrame(cx-planet.rx-5,cy-planet.ry-5,planet.rx*2+11,planet.ry*2+11);
  }
}
function drawPlanetDeepScan(x,y,maxPx=128){
  return drawDeepScanModel(deepScanModelForPlanet(),x,y,maxPx);
}
function drawHaloLoreFact(x,y,maxPx=124,maxBottom=232){
  const fact=planet.loreReport||planet.lifeText||'';
  if(!fact) return false;
  drawText('INSTALLATION DATA',x,y,C.green,1);
  const lines=wrapText(fact,maxPx,1).slice(0,Math.max(1,Math.floor((maxBottom-(y+10))/8)+1));
  lines.forEach((line,i)=>drawText(line,x,y+10+i*8,C.white,1));
  return true;
}
function drawPlanetHover(cx,cy){
  const body={type:'planet'},scanned=isScanned(body);
  const halo=isHaloRingWorld();
  const artificialOrbitals=planet.moonData?.some(m=>!!m.kind);
  const bodyCountLabel=artificialOrbitals?'OBJECTS':(planet.solar&&['JUPITER','SATURN','URANUS','NEPTUNE'].includes(planet.name)?'SHOWN MOONS':'MOONS');
  const bodyCount=artificialOrbitals?(planet.moonData?.length||0):planet.moons;
  const baseRows=halo?[
    ['TEMP',`${tempC()} C`,C.white],['DIAMETER',`${(planet.radiusKm*2).toLocaleString('en-US')} KM`,C.blue],['WIDTH',`${planet.haloSurfaceWidthKm||318} KM`,C.blue],['GRAVITY',`${planet.gravity.toFixed(3)} G`,C.white],
    ['ATMOS',atmosphereLabel(),C.yellow],['BIOSPHERE',lifeLabel(),isAlive()?C.green:C.brown],['STATUS',planet.haloStatus||'UNKNOWN',C.red],['MONITOR',planet.haloMonitor||'UNKNOWN',C.cyan],['ROTATION','ARTIFICIAL',C.white]
  ]:[
    ['TEMP',`${tempC()} C`,C.white],['RADIUS',`${planet.radiusEarth.toFixed(2)} EARTH`,C.blue],['GRAVITY',`${planet.gravity.toFixed(2)} G`,C.white],['WATER',`${surfaceWaterPercent()}%`,C.cyan],['ATMOS',atmosphereLabel(),C.yellow],
    ['WEATHER',compactWeatherLabel(),atmosphereAccentColor()],['BIOSPHERE',lifeLabel(),isAlive()?C.green:C.brown],['POPULATION',populationLabel(),isAlive()?C.green:C.brown],['DAY',`${planet.dayHours.toFixed(1)} H`,C.white],['YEAR',`${planet.yearDays} D`,C.white],
    [bodyCountLabel,String(bodyCount),C.purple],...(planet.ring?[['RING',ringStyleLabel(),planet.ringColor||C.purple]]:[])
  ];

  // Planet cards stay compact until a probe result exists. Once scanned, the
  // same card expands horizontally: ordinary planet data on the left and the
  // probe/deep-scan report on the right. Moon cards intentionally do not use
  // this layout and remain handled by drawMoonHover() unchanged.
  const panelW=scanned?280:168;
  const pad=8,columnGap=10;
  const normalW=scanned?127:146;
  const probeW=scanned?127:0;
  const nameLines=wrapText(planet.name,normalW,1);
  const classLines=wrapText(halo?'FORERUNNER HALO':worldClass(),normalW,1);

  const normalLabelW=measureInfoLabelWidth(baseRows,normalW);
  let normalH=Math.max(1,nameLines.length)*9+Math.max(1,classLines.length)*9+4;
  for(const [label,value] of baseRows) normalH+=infoFieldHeight(label,value,normalW,normalLabelW);

  let narrative='',probeH=0,scanModel=null,probeLabelW=null;
  if(scanned){
    narrative=halo?(planet.loreReport||planet.lifeText||''):lifeProbeObservation();
    scanModel=deepScanModelForPlanet();
    probeLabelW=measureInfoLabelWidth(scanModel.rows,probeW);
    probeH=12; // PROBE DATA heading
    if(narrative) probeH+=measureNarrative(narrative,probeW)+4;
    probeH+=measureDeepScanModel(scanModel,probeW,probeLabelW)+6;
  }

  const contentH=scanned?Math.max(normalH,probeH):normalH;
  const panelH=Math.min(232,contentH+pad*2);
  const rect=choosePlanetHoverPanelRect(cx,cy,panelW,panelH);
  const pos=beginScrollableInfoPanel(`${planet.seed}:planet:${scanned?'two-column-scan':'summary'}`,rect,contentH,pad);
  const x=pos.x,y=pos.y;

  // LEFT COLUMN — always-visible planet information.
  nameLines.forEach((line,i)=>drawText(line,x,y+i*9,C.white,1));
  let yy=y+Math.max(1,nameLines.length)*9;
  classLines.forEach((line,i)=>drawText(line,x,yy+i*9,C.green,1));
  yy+=Math.max(1,classLines.length)*9+4;
  for(const [label,value,color] of baseRows) yy=drawInfoField(label,value,x,yy,normalW,color,normalLabelW);

  // RIGHT COLUMN — created only after this planet has actually been probed.
  if(scanned){
    const probeX=x+normalW+columnGap;
    const separatorX=x+normalW+Math.floor(columnGap/2);
    ctx.globalAlpha=.35;ctx.fillStyle=C.purple;
    for(let sy=y;sy<y+contentH;sy+=4) ctx.fillRect(separatorX,sy,1,2);
    ctx.globalAlpha=1;

    drawText('PROBE DATA',probeX,y,C.purple,1);
    let py=y+12;
    if(narrative){
      py=drawNarrative(halo?'INSTALLATION DATA':'LIFE OBSERVED',narrative,probeX,py,probeW,C.green,halo?C.white:C.green);
      py+=4;
    }
    drawDeepScanModel(scanModel,probeX,py,probeW,probeLabelW);
  }

  endScrollableInfoPanel(rect,contentH,pad);
}
function drawMoonDeepScan(m,x,y,maxPx=132,labelW=null){
  return drawDeepScanModel(deepScanModelForMoon(m),x,y,maxPx,labelW);
}
function formatPeriodDays(days){ return days<10?days.toFixed(3):days<100?days.toFixed(2):days.toFixed(1); }
function drawMoonHover(body,cx,cy){
  const m=planet.moonData[body.index];if(!m)return [];
  const scanned=isScanned(body),vessel=m.kind==='human_ship',hasClass=!!m.loreWorldClass;
  const panelW=vessel?180:(m.kind==='heighliner'?176:164),innerW=panelW-16;
  const nameLines=wrapText(m.hoverLabel||m.name,innerW,1);
  const classLines=hasClass?wrapText(m.loreWorldClass,innerW,1):[];
  const summaryRows=m.kind==='heighliner'?[ 
    ['POSITION','FIXED GUILD HOLD',C.blue],
    ['SIZE',`${m.displayLengthKm||20} KM VESSEL`,C.brown]
  ]:[
    ['ORBIT',`${m.orbitKm.toLocaleString('en-US')} KM`,C.blue],
    ['PERIOD',`${formatPeriodDays(m.periodDays)} DAYS`,C.green],
    [vessel?'SIZE':'RADIUS',vessel?`${(m.displayLengthKm||1.6).toFixed(1)} KM VESSEL`:`${m.radiusKm.toLocaleString('en-US')} KM MOON`,C.brown]
  ];
  const summaryLabelW=measureInfoLabelWidth(summaryRows,innerW);
  const scanModel=scanned?deepScanModelForMoon(m):null;
  const scanLabelW=scanned?measureInfoLabelWidth(scanModel.rows,innerW):null;
  let contentH=Math.max(1,nameLines.length)*9+classLines.length*9+3;
  for(const [label,value] of summaryRows) contentH+=infoFieldHeight(label,value,innerW,summaryLabelW);
  if(scanned)contentH+=8+measureDeepScanModel(scanModel,innerW,scanLabelW);
  else contentH+=13;
  const panelH=Math.min(224,contentH+16);
  const rect=chooseMoonHoverPanelRect(body,panelW,panelH);
  const pos=beginScrollableInfoPanel(`${planet.seed}:moon-${body.index}:${scanned?'scan':'locked'}`,rect,contentH,8);
  const x=pos.x,y=pos.y;
  nameLines.forEach((line,i)=>drawText(line,x,y+i*9,C.white,1));
  let yy=y+Math.max(1,nameLines.length)*9+2;
  if(hasClass){classLines.forEach((line,i)=>drawText(line,x,yy+i*9,C.green,1));yy+=classLines.length*9;}
  for(const [label,value,color] of summaryRows) yy=drawInfoField(label,value,x,yy,innerW,color,summaryLabelW);
  if(scanned){yy+=8;drawMoonDeepScan(m,x,yy,innerW,scanLabelW);}
  else drawText('PROBE DATA LOCKED',x,yy+4,C.purple,1);
  endScrollableInfoPanel(rect,contentH,8);
  return [rect];
}
function drawContextInfo(body,cx,cy){
  if(!body){state.infoPanelRect=null;state.infoScrollMax=0;state.infoPanelFocused=false;return;}
  drawObjectMarker(body,cx,cy);
  if(body.type==='moon') drawMoonHover(body,cx,cy); else drawPlanetHover(cx,cy);
}

function drawHelpCard(){
  if(!state.info) return;
  drawText(state.infoTitle || planet.name,248,78,C.white,1);
  drawParagraph(state.info,248,92,218,C.green,1,8);
}
function recentItems(){
  const out=[];
  for(let i=state.history.length-1;i>=0;i--){ if(!out.includes(state.history[i])) out.push(state.history[i]); if(out.length>=20) break; }
  return out;
}
function scannedItems(){ return state.scannedWorlds.slice().reverse(); }
function libraryItems(){
  if(state.libraryTab==='favorites') return state.favorites.slice().reverse();
  if(state.libraryTab==='scanned') return scannedItems();
  return recentItems();
}
function libraryEmptyText(){
  if(state.libraryTab==='favorites') return 'NO FAVORITES YET - PRESS F ON A PLANET';
  if(state.libraryTab==='scanned') return 'NO PROBE RECORDS YET';
  return 'NO RECENT PLANETS YET';
}
function drawLibraryOverlay(){
  if(!state.libraryOpen) return;
  const x=78,y=31,w=324,h=207;
  ctx.globalAlpha=.98;ctx.fillStyle=C.black;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;
  ctx.strokeStyle=C.purple;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  drawText("CAPTAIN'S LOG",x+12,y+13,C.white,1);
  drawText(`FAV ${state.favorites.length}  SCANNED ${state.scannedWorlds.length}`,x+w-12,y+13,C.brown,1,'right');

  const favRect={x:x+7,y:y+20,w:76,h:19}, recentRect={x:x+87,y:y+20,w:61,h:19}, scannedRect={x:x+152,y:y+20,w:68,h:19};
  drawText(state.libraryTab==='favorites'?'> FAVORITES':'FAVORITES',x+12,y+29,state.libraryTab==='favorites'?C.green:C.purple,1);
  drawText(state.libraryTab==='recent'?'> RECENT':'RECENT',x+92,y+29,state.libraryTab==='recent'?C.green:C.purple,1);
  drawText(state.libraryTab==='scanned'?'> SCANNED':'SCANNED',x+157,y+29,state.libraryTab==='scanned'?C.green:C.purple,1);
  if(hoverActive()&&pointInRect(state.mouse,favRect.x,favRect.y,favRect.w,favRect.h)) drawFocusFrame(favRect.x,favRect.y,favRect.w,favRect.h);
  if(hoverActive()&&pointInRect(state.mouse,recentRect.x,recentRect.y,recentRect.w,recentRect.h)) drawFocusFrame(recentRect.x,recentRect.y,recentRect.w,recentRect.h);
  if(hoverActive()&&pointInRect(state.mouse,scannedRect.x,scannedRect.y,scannedRect.w,scannedRect.h)) drawFocusFrame(scannedRect.x,scannedRect.y,scannedRect.w,scannedRect.h);

  const items=libraryItems(); state.libraryRows=[];
  if(!items.length) drawText(libraryEmptyText(),x+12,y+54,C.brown,1);
  const visible=items.slice(0,8);
  state.librarySelection=clamp(state.librarySelection,0,Math.max(0,visible.length-1));
  visible.forEach((name,i)=>{
    const ry=y+48+i*12, row={name,x:x+10,y:ry-5,w:w-20,h:11}; state.libraryRows.push(row);
    if(i===state.librarySelection){ctx.fillStyle=mixHex(C.purple,C.black,.48);ctx.fillRect(x+8,ry-6,w-16,10);}
    drawText(name,x+14,ry,isFavorite(name)?C.green:(state.libraryTab==='scanned'?C.cyan:C.white),1);
    if(hoverActive()&&pointInRect(state.mouse,row.x,row.y,row.w,row.h)) drawFocusFrame(row.x,row.y,row.w,row.h);
  });

  const actionY=y+h-43;
  const exportRect={id:'export',x:x+9,y:actionY,w:88,h:19};
  const importRect={id:'import',x:x+106,y:actionY,w:88,h:19};
  const resetRect={id:'reset',x:x+203,y:actionY,w:111,h:19};
  state.libraryActionRects=[exportRect,importRect,resetRect];
  drawText('EXPORT JSON',exportRect.x+6,actionY+12,C.cyan,1);
  drawText('IMPORT JSON',importRect.x+6,actionY+12,C.green,1);
  const confirming=performance.now()<=state.resetConfirmUntil;
  drawText(confirming?'CONFIRM RESET':'RESET DATA',resetRect.x+6,actionY+12,confirming?C.red:C.purple,1);
  for(const rect of state.libraryActionRects){
    if(hoverActive()&&pointInRect(state.mouse,rect.x,rect.y,rect.w,rect.h)) drawFocusFrame(rect.x,rect.y,rect.w,rect.h);
  }
  drawText('SPACE VISIT  E EXPORT  I IMPORT  X RESET  L CLOSE',x+12,y+h-9,C.purple,1);
}
function drawToast(t){
  if(!state.toastText || t>=state.toastUntil) return;
  drawText(state.toastText,240,232,C.white,1,'center');
}

function drawSlider(){
  const x=UI.sliderX,y=UI.sliderY;
  const hover=hoverActive()&&sliderHit(state.mouse);
  const back=asset.sliderBack;
  if(back && back.complete && back.naturalWidth) ctx.drawImage(back,x,y);
  else {ctx.fillStyle=mixHex(C.white,C.black,.55);ctx.fillRect(x,y+2,UI.sliderW,3);}
  const fill=Math.round(state.temp*(UI.sliderW-7));
  ctx.fillStyle = state.viewMode===3 ? (tempBand()<2?C.blue:tempBand()<3?C.green:tempBand()<4?C.yellow:C.red) : (state.viewMode===2&&hasAtmosphereView()) ? atmosphereAccentColor() : C.purple;
  ctx.fillRect(x+2,y+3,Math.max(1,fill),1);
  const knob=state.draggingSlider?asset.sliderFrontAlt:asset.sliderFront;
  const kx=x+Math.round(state.temp*(UI.sliderW-7));
  if(knob && knob.complete && knob.naturalWidth) ctx.drawImage(knob,kx,y-3);
  else {ctx.fillStyle=C.white;ctx.fillRect(kx,y-3,3,13);}
  drawText(`${tempC()}C`,x+UI.sliderW+6,y,C.white,1);
  if(hover||state.draggingSlider) drawFocusFrame(x-5,y-8,UI.sliderW+10,21);
}
function viewModeName(mode=state.viewMode){ return ['NORMAL','CLEAN','ATMOSPHERE','TEMPERATURE'][mode]||'NORMAL'; }
function drawCleanViewIcon(x,y){
  ctx.fillStyle=C.white; ctx.fillRect(x+3,y+2,5,1); ctx.fillRect(x+2,y+3,1,5); ctx.fillRect(x+8,y+3,1,5); ctx.fillRect(x+3,y+8,5,1);
  ctx.fillStyle=C.blue; ctx.fillRect(x+4,y+4,3,3); ctx.fillStyle=C.green; ctx.fillRect(x+5,y+4,2,1); ctx.fillRect(x+4,y+6,2,1);
}
function drawAtmosphereViewIcon(x,y){
  ctx.fillStyle=atmosphereBaseColor();ctx.fillRect(x+3,y+3,5,5);ctx.fillStyle=atmosphereAccentColor();ctx.fillRect(x+2,y+4,1,3);ctx.fillRect(x+8,y+4,1,3);ctx.fillRect(x+4,y+2,3,1);ctx.fillRect(x+4,y+8,3,1);ctx.fillStyle=C.white;ctx.fillRect(x+5,y+4,1,1);ctx.fillRect(x+6,y+6,1,1);
}
function drawButtons(){
  state.hovered=null;
  for(const b of UI.buttons){
    const hover=state.mouse.inside && state.mouse.x>=b.x-3 && state.mouse.x<=b.x+14 && state.mouse.y>=UI.buttonY-4 && state.mouse.y<=UI.buttonY+14;
    if(hover) state.hovered=b;
    let im=null;
    if(b.id==='temp' && state.viewMode!==1 && state.viewMode!==2) im=asset['temp'+tempBand()];
    else if(b.id!=='temp') im=asset[b.id];
    const active=(b.id==='log'&&state.libraryOpen)||(b.id==='probe'&&!!state.probe)||(b.id==='temp'&&state.viewMode!==0)||(b.id==='reverse'&&state.reverse)||(b.id==='pause'&&state.paused)||(b.id==='mute'&&state.muted)||(b.id==='fast'&&state.speedIndex>1)||(b.id==='rocket'&&!!state.rocket);
    const rocketLocked=b.id==='rocket'&&!canLaunchCivilizationRocket();
    ctx.globalAlpha=rocketLocked?(hover?.52:.30):(active?1:(hover?.95:.72));
    if(b.id==='temp' && state.viewMode===1) drawCleanViewIcon(b.x,UI.buttonY);
    else if(b.id==='temp' && state.viewMode===2 && hasAtmosphereView()) drawAtmosphereViewIcon(b.x,UI.buttonY);
    else if(im && im.complete && im.naturalWidth) ctx.drawImage(im,b.x,UI.buttonY);
    else {ctx.fillStyle=C.white;ctx.fillRect(b.x,UI.buttonY,9,9);}
    ctx.globalAlpha=1;
    if(hover) drawFocusFrame(b.x-4,UI.buttonY-5,20,20);
  }
  if(state.hovered){
    const target=state.hovered.id==='probe'?(state.pinnedBody||state.hoverBody||{type:'planet'}):null;
    let tip=target?`LAUNCH PROBE: ${bodyName(target)}`:state.hovered.tip;
    if(state.hovered.id==='temp') tip=`VIEW ${viewModeName()} -> ${viewModeName(nextViewMode())}`;
    if(state.hovered.id==='rocket') tip=canLaunchCivilizationRocket()?'LAUNCH CIVILIZATION ROCKET':noLocalOrbit()?'ROCKET LOCKED: LOCAL ORBIT RESTRICTED':'ROCKET LOCKED: NO ACTIVE SPACEFLIGHT';
    if(state.hovered.id==='camera') tip='CLICK: PICTURE  HOLD 2S: FULL SCREENSHOT';
    if(state.cameraHold?.active && state.hovered.id==='camera' && !state.cameraHold.triggered){
      const left=Math.max(0,2-(performance.now()-state.cameraHold.startAt)/1000);
      tip=`HOLD FOR FULL SCREENSHOT ${left.toFixed(1)}S`;
    }
    drawText(`${tip}${state.hovered.id==='camera'?'':` [${state.hovered.key}]`}`,472,239,C.white,1,'right');
  }
}
function drawEntry(t){
  if(state.enteringName){
    const caret=((t/430)|0)%2===0?'_':'';
    const s=`> ${state.input}${caret}`;
    drawText(s,240,238,C.white,1,'center');
  }
}
function drawTitleCard(t){
  const blink=((t/560)|0)%2===0;
  // Keep briefing copy completely clear of the procedural star field.
  ctx.fillStyle=C.black;
  ctx.fillRect(42,20,396,230);
  ctx.strokeStyle=mixHex(C.purple,C.black,.32);
  ctx.strokeRect(42.5,20.5,395,229);

  drawText('PLANETARIUM',240,34,C.white,2,'center');
  drawText("CAPTAIN'S BRIEFING",240,65,C.purple,1,'center');

  drawText('YOU ARE THE CAPTAIN OF A DEEP-SPACE',240,89,C.white,1,'center');
  drawText('EXPLORATION SHIP CROSSING AN INFINITE',240,99,C.white,1,'center');
  drawText('GALAXY IN SEARCH OF NEW WORLDS, LIFE,',240,109,C.white,1,'center');
  drawText('ANOMALIES AND OTHER SURPRISES.',240,119,C.white,1,'center');

  drawText('EVERY NAME IS A DESTINATION.',240,141,C.green,1,'center');
  drawText('PRESS ENTER TO OPEN DESTINATION ENTRY',240,163,C.cyan,1,'center');
  drawText('HOVER WORLDS AND MOONS TO INSPECT THEM',240,175,C.blue,1,'center');
  drawText('LAUNCH PROBES TO REVEAL DEEPER SECRETS',240,187,C.purple,1,'center');
  drawText('MORE CONTROLS REVEAL THEMSELVES ON HOVER',240,199,C.brown,1,'center');

  if(blink) drawText('PRESS ANY KEY TO CONTINUE',240,231,C.white,1,'center');
}
function finishRocketMission(r){
  const civ=planet.civilization;
  if(r.mission==='moon') showToast(`MOON MISSION ARRIVED AT ${planet.moonData[r.moonIndex]?.name||'MOON'}`,2100);
  else if(civ){
    if(noLocalOrbit()) showToast('LOCAL ORBIT RESTRICTED',1800);
    else{
      const rr=mulberry32(hashString(`${planet.seed}:LAUNCH:${state.spaceLaunchSerial}`));
      civ.launched=civ.launched||[];
      civ.launched.push(makeOrbitalObject(rr,planet,'satellite',civ.launched.length+7,civ.rank));
      civ.launched=civ.launched.slice(-4);
      showToast('SATELLITE DEPLOYED',1800);
    }
  }
  state.rocket=null;
}
function drawRocket(t){
  const r=state.rocket; if(!r) return;
  const age=(t-r.start)/1000, duration=r.duration||4;
  if(age>=duration){ finishRocketMission(r); return; }
  const p=clamp(age/duration,0,1), e=smooth(p);
  let x,y;
  if(r.mission==='moon' && planet.moonData[r.moonIndex]){
    const m=planet.moonData[r.moonIndex];
    x=lerp(r.x,m.screenX,e); y=lerp(r.y,m.screenY,e)-Math.sin(p*Math.PI)*28;
  }else{
    const targetAngle=-.82;
    const tx=150+Math.cos(targetAngle)*(planet.radius+30), ty=116+Math.sin(targetAngle)*(planet.radius+30)*.42;
    x=lerp(r.x,tx,e); y=lerp(r.y,ty,e)-Math.sin(p*Math.PI)*24;
  }
  const im=asset.rocketSprite;
  if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,Math.round(x),Math.round(y)); else {ctx.fillStyle=C.white;ctx.fillRect(Math.round(x),Math.round(y),3,3);}
  if(p<.78 && (age*20|0)%2===0){ctx.fillStyle=C.red;ctx.fillRect(Math.round(x-2),Math.round(y+3),1,1);}
}
function launchCivilizationRocket(){
  if(state.rocket){ showToast('ROCKET ALREADY IN FLIGHT'); return; }
  if(noLocalOrbit()){ showToast('LOCAL ORBIT RESTRICTED',1800); return; }
  if(!isAlive()){ showToast('NO ACTIVE SPACEFARING CIVILIZATION'); return; }
  if(!planet.civilization || planet.civilization.rank<3){ showToast('CIVILIZATION HAS NO SPACEFLIGHT'); return; }
  state.spaceLaunchSerial++;
  const civ=planet.civilization;
  const moonMission=civ.moonMissionIndex!=null && ((state.spaceLaunchSerial%3===0)||civ.rank>=5&&state.spaceLaunchSerial%2===0);
  state.rocket={start:performance.now(),x:150+planet.rx*.45,y:116-planet.ry*.2,mission:moonMission?'moon':'orbit',moonIndex:moonMission?civ.moonMissionIndex:null,duration:moonMission?5.4:4.0};
  showToast(moonMission?`MOON MISSION LAUNCHED TO ${planet.moonData[civ.moonMissionIndex]?.name||'MOON'}`:'ORBITAL LAUNCH',1700);
}
function probeTargetPosition(body,cx,cy){
  if(body?.type==='moon'){
    const m=planet.moonData[body.index];
    if(m) return {x:m.screenX,y:m.screenY};
  }
  return {x:cx+planet.rx*.18,y:cy-planet.ry*.12};
}
function launchProbe(targetOverride=null){
  if(state.probe && !['complete','lost'].includes(state.probe.phase)){ showToast('PROBE ALREADY IN FLIGHT'); return; }
  const target=bodyRef(targetOverride||state.pinnedBody||state.hoverBody||{type:'planet'});
  if(isScanned(target)){
    state.pinnedBody=target; showToast('PROBE DATA ALREADY AVAILABLE'); return;
  }
  const m=target.type==='moon'?planet.moonData[target.index]:null;
  const totalHours=target.type==='moon'?Math.round(clamp(8+(m?.orbitKm||50000)/13000,9,42)):Math.round(10+planet.radiusEarth*5);
  const scanHours=Math.max(2,Math.round(totalHours*.18));
  state.probe={target,totalHours,remainingHours:totalHours,scanHours,phase:'flight',finishAt:0};
  state.pinnedBody=target;
  showToast(target.type==='moon'?`PROBE LAUNCHED TO ${bodyName(target)}`:'PROBE LAUNCHED',1800);
}
function updateProbe(dt,speed,t){
  const p=state.probe; if(!p) return;
  if(p.phase==='complete'||p.phase==='lost'){
    if(t>=p.finishAt) state.probe=null;
    return;
  }
  const rate=Math.max(.7,6*speed);
  p.remainingHours=Math.max(0,p.remainingHours-dt*rate);
  if(p.phase==='flight' && p.remainingHours<=p.scanHours){
    const scan=scanForBody(p.target);
    const firstLoss=!!scan?.lossRisk && storageGet(probeLossStorageKey(p.target),'0')!=='1';
    if(firstLoss){
      storageSet(probeLossStorageKey(p.target),'1');
      p.phase='lost'; p.finishAt=t+3200;
      showToast('PROBE LOST - CAUSE UNKNOWN',2800);
      return;
    }
    p.phase='scanning';
    showToast('SCANNING...',1300);
  }
  if(p.phase==='scanning' && p.remainingHours<=0){
    markScanned(p.target);
    state.pinnedBody=p.target;
    p.phase='complete'; p.finishAt=t+3200;
    showToast('PROBE DATA RECEIVED',2600);
  }
}
function drawProbeSprite(x,y,scanning=false){
  x=Math.round(x); y=Math.round(y);
  ctx.fillStyle=scanning?C.green:C.cyan;
  ctx.fillRect(x-1,y-1,3,3);
  ctx.fillStyle=C.white;
  ctx.fillRect(x-4,y,2,1); ctx.fillRect(x+3,y,2,1);
  ctx.fillRect(x,y-3,1,2);
  ctx.fillStyle=C.purple;
  ctx.fillRect(x-3,y-1,1,3); ctx.fillRect(x+3,y-1,1,3);
}
function drawProbe(cx,cy){
  const p=state.probe; if(!p||p.phase==='lost'||p.phase==='complete') return;
  const target=probeTargetPosition(p.target,cx,cy);
  if(p.phase==='scanning'){
    const a=performance.now()*.008;
    drawProbeSprite(target.x+Math.cos(a)*8,target.y+Math.sin(a)*4,true);
    return;
  }
  const flightHours=Math.max(.001,p.totalHours-p.scanHours);
  const progress=clamp((p.totalHours-p.remainingHours)/flightHours,0,1);
  const eased=smooth(progress);
  const start={x:331,y:250};
  const x=lerp(start.x,target.x,eased), y=lerp(start.y,target.y,eased)-Math.sin(progress*Math.PI)*24;
  drawProbeSprite(x,y,false);
}
function drawProbeStatus(){
  const p=state.probe; if(!p) return;
  if(p.phase==='flight') drawText(`PROBE ETA ${Math.max(1,Math.ceil(p.remainingHours))} H`,472,224,C.cyan,1,'right');
  else if(p.phase==='scanning') drawText('PROBE SCANNING',472,224,C.green,1,'right');
  else if(p.phase==='complete') drawText('PROBE DATA RECEIVED',472,224,C.green,1,'right');
  else if(p.phase==='lost') drawText('PROBE LOST - CAUSE UNKNOWN',472,224,C.red,1,'right');
}
function updateCameraHold(t){
  const h=state.cameraHold;
  if(!h || !h.active || h.triggered) return;
  if(!state.mouse.down) return;
  if(t-h.startAt>=2000){
    h.triggered=true;
    takeScreenshot({full:true});
  }
}

function drawCursor(){
  if(!state.mouse.inside)return;
  const im=asset[state.mouse.down?'cursor1':'cursor0'];
  if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,Math.round(state.mouse.x),Math.round(state.mouse.y));
  else {ctx.fillStyle=C.white;ctx.fillRect(Math.round(state.mouse.x),Math.round(state.mouse.y),2,2);}
}
function flash(){ state.cameraFlash=performance.now()+100; }

function render(t){
  const dt=Math.min(.05,(t-state.lastTime)/1000||0); state.lastTime=t;
  const dir=state.reverse?-1:1, speeds=[.20,.55,1.7,4.2], speed=state.paused?0:speeds[state.speedIndex];
  state.simDays += dt*1.15*speed*dir;
  updateProbe(dt,speed,t);
  updateCameraHold(t);
  const rotationRate=(24/planet.dayHours)*.035*planet.rotationDirection;
  state.phase=mod(state.phase+dt*rotationRate*speed*dir,1);
  const cleanCapture=state.captureMode==='clean';
  state.lifePanelRect=null;
  drawStars(t);
  const intro=state.intro;
  if(intro && !cleanCapture){
    drawTitleCard(t);
    drawCursor();
    requestAnimationFrame(render);
    return;
  }
  const cx=150, cy=116;
  drawPlanet(cx,cy,t);
  drawProbe(cx,cy);
  drawRocket(t);
  if(!intro){
    let hovered=!state.libraryOpen&&state.mouse.inside?bodyAtPoint(state.mouse,cx,cy):null;
    if(!hovered && !state.libraryOpen && infoPanelHovered() && state.hoverBody) hovered=bodyRef(state.hoverBody);
    if(hovered?.type==='moon'){
      state.moonHoverGrace=bodyRef(hovered);
      state.moonHoverUntil=t+MOON_HOVER_GRACE_MS;
    }else if(hovered?.type==='planet'){
      state.moonHoverGrace=null;
      state.moonHoverUntil=0;
    }else if(!hovered && state.moonHoverGrace && t<state.moonHoverUntil){
      hovered=state.moonHoverGrace;
    }else if(t>=state.moonHoverUntil){
      state.moonHoverGrace=null;
    }
    state.hoverBody=hovered;
    const body=state.pinnedBody || hovered;
    if(!cleanCapture && body?.type==='moon') drawMoonOrbit(planet.moonData[body.index],cx,cy,true);
    if(!cleanCapture && !state.info && body?.type!=='planet') drawBaseLabel(cx,cy);
    if(!cleanCapture){
      if(state.info) drawHelpCard(); else if(!state.libraryOpen) drawContextInfo(body,cx,cy);
    }
  }
  if(!cleanCapture){
    drawSlider(); drawButtons(); drawEntry(t); drawProbeStatus(); drawLibraryOverlay(); drawToast(t);
  }
  if(state.cameraFlash>t){ctx.globalAlpha=.45;ctx.fillStyle=C.white;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  if(!cleanCapture) drawCursor();
  requestAnimationFrame(render);
}

function saveTemp(){ storageSet(tempStorageKey(planet),String(state.temp)); }
function setTemp(v){ state.temp=clamp(v,0,1); syncSolarTemperatureState(planet); saveTemp(); syncUrl(); }
function toggleMute(){ state.muted=!state.muted; audio.muted=state.muted; startAudio(); }
function doAction(id){
  startAudio(); state.intro=false;
  switch(id){
    case 'log': state.libraryOpen=!state.libraryOpen; state.librarySelection=0; state.lifePanelFocused=false; break;
    case 'probe': launchProbe(); break;
    case 'temp': state.viewMode=nextViewMode(); state.tempView=state.viewMode===3; showToast(`VIEW: ${viewModeName()}`); break;
    case 'reverse': state.reverse=!state.reverse; break;
    case 'pause': state.paused=!state.paused; showToast(state.paused?'TIME PAUSED':'TIME RESUMED'); break;
    case 'fast': state.speedIndex=(state.speedIndex+1)%4; break;
    case 'rocket': launchCivilizationRocket(); break;
    case 'camera': takeScreenshot({full:false}); break;
    case 'mute': toggleMute(); break;
    case 'random': randomVisit(); break;
  }
}
function downloadScreenshot(png,full=false){
  try{
    const a=document.createElement('a');
    const safe=planet.name.replace(/[^A-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'planet';
    const suffix=full?'-full':'';
    a.download=`planetarium-${safe.toLowerCase()}${suffix}.png`;
    a.href=png || canvas.toDataURL('image/png');
    a.click();
  }catch{}
}
function takeScreenshot(options={}){
  const full=!!options.full;
  if(full){
    let png='';
    try{ png=canvas.toDataURL('image/png'); }catch{}
    flash();
    requestAnimationFrame(()=>downloadScreenshot(png,true));
    return;
  }
  state.captureMode='clean';
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      let png='';
      try{ png=canvas.toDataURL('image/png'); }catch{}
      state.captureMode=null;
      flash();
      requestAnimationFrame(()=>downloadScreenshot(png,false));
    });
  });
}
function handleLibraryPointer(p){
  if(!state.libraryOpen) return false;
  const x=78,y=31,w=324,h=207;
  if(pointInRect(p,x+7,y+20,76,19)){state.libraryTab='favorites';state.librarySelection=0;return true;}
  if(pointInRect(p,x+87,y+20,61,19)){state.libraryTab='recent';state.librarySelection=0;return true;}
  if(pointInRect(p,x+152,y+20,68,19)){state.libraryTab='scanned';state.librarySelection=0;return true;}
  for(let i=0;i<state.libraryRows.length;i++){
    const row=state.libraryRows[i];
    if(pointInRect(p,row.x,row.y,row.w,row.h)){state.librarySelection=i;visit(row.name);return true;}
  }
  for(const rect of state.libraryActionRects||[]){
    if(!pointInRect(p,rect.x,rect.y,rect.w,rect.h)) continue;
    if(rect.id==='export') exportCaptainLog();
    else if(rect.id==='import') importCaptainLog();
    else if(rect.id==='reset') resetExplorationData();
    return true;
  }
  if(!(p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h)){state.libraryOpen=false;return true;}
  return true;
}
function getPoint(ev){
  const r=canvas.getBoundingClientRect(); return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};
}
function sliderHit(p){ return p.x>=UI.sliderX-5&&p.x<=UI.sliderX+UI.sliderW+5&&p.y>=UI.sliderY-8&&p.y<=UI.sliderY+12; }
function updateSliderFromPoint(p){ setTemp((p.x-UI.sliderX)/(UI.sliderW-7)); }
function buttonAtPoint(p){
  for(const b of UI.buttons){
    if(p.x>=b.x-4&&p.x<=b.x+15&&p.y>=UI.buttonY-5&&p.y<=UI.buttonY+15) return b;
  }
  return null;
}
canvas.addEventListener('pointermove',ev=>{ const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true,pointerType:ev.pointerType||'mouse'};if(state.draggingSlider)updateSliderFromPoint(p); if(state.cameraHold && state.cameraHold.active && (!buttonAtPoint(p) || buttonAtPoint(p).id!=='camera')) state.cameraHold=null; });
canvas.addEventListener('pointerenter',ev=>{const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true,pointerType:ev.pointerType||'mouse'};});
canvas.addEventListener('pointerleave',()=>{state.mouse.inside=false;state.draggingSlider=false;state.mouse.down=false;state.cameraHold=null;if(state.mouse.pointerType==='mouse' && !state.moonHoverGrace)state.hoverBody=null;});
canvas.addEventListener('pointerdown',ev=>{
  startAudio();canvas.focus();const p=getPoint(ev);state.mouse={...state.mouse,...p,down:true,inside:true,pointerType:ev.pointerType||'mouse'};
  if(state.intro){ ev.preventDefault(); return; }
  if(state.infoPanelRect && pointInRect(p,state.infoPanelRect.x,state.infoPanelRect.y,state.infoPanelRect.w,state.infoPanelRect.h)){
    state.infoPanelFocused=true;
    ev.preventDefault();
    return;
  }
  state.infoPanelFocused=false;
  if(state.lifePanelRect && pointInRect(p,state.lifePanelRect.x,state.lifePanelRect.y,state.lifePanelRect.w,state.lifePanelRect.h)){
    state.lifePanelFocused=true;
    ev.preventDefault();
    return;
  }
  state.lifePanelFocused=false;
  if(handleLibraryPointer(p)){ev.preventDefault();return;}
  if(sliderHit(p)){state.draggingSlider=true;updateSliderFromPoint(p);ev.preventDefault();return;}
  const button=buttonAtPoint(p);
  if(button){
    if(button.id==='camera') state.cameraHold={active:true,startAt:performance.now(),triggered:false};
    else doAction(button.id);
    ev.preventDefault();
    return;
  }
  const intro=state.intro;
  const body=bodyAtPoint(p,intro?240:150,intro?111:116);
  if(body){
    const wasSame=sameBody(state.pinnedBody,body);
    if(wasSame){
      releaseMoonInspection();
      state.pinnedBody=null;
    }else{
      releaseMoonInspection();
      state.pinnedBody=bodyRef(body);
      if(body.type==='moon') beginMoonInspection(body.index);
    }
    state.moonHoverGrace=body.type==='moon'?bodyRef(body):null;
    state.moonHoverUntil=body.type==='moon'?performance.now()+MOON_HOVER_GRACE_MS:0;
    ev.preventDefault(); return;
  }
  releaseMoonInspection();
  state.pinnedBody=null;
  state.moonHoverGrace=null;
  state.moonHoverUntil=0;
  if(ev.pointerType && ev.pointerType!=='mouse') ev.preventDefault();
});
canvas.addEventListener('pointerup',()=>{
  const hold=state.cameraHold;
  state.mouse.down=false;state.draggingSlider=false;
  if(hold?.active && !hold.triggered) takeScreenshot({full:false});
  state.cameraHold=null;
});
canvas.addEventListener('wheel',ev=>{
  if(state.intro) return;
  const dir=ev.deltaY===0?0:(ev.deltaY>0?1:-1);
  if(dir && infoPanelHovered() && scrollInfoPanel(dir*18)){ev.preventDefault();return;}
  if(dir && lifePanelHovered() && scrollLifePanel(dir)){ev.preventDefault();}
},{passive:false});
canvas.addEventListener('dblclick',()=>toggleFullscreen());

function historyMove(delta){
  if(!state.history.length)return;
  state.historyPos=clamp((state.historyPos<0?state.history.length:state.historyPos)+delta,0,state.history.length-1);
  state.input=state.history[state.historyPos]||'';
}
function closeDesktopApp(){
  try{
    const getCurrentWindow=window.__TAURI__?.window?.getCurrentWindow;
    if(typeof getCurrentWindow!=='function') return false;
    getCurrentWindow().close().catch(()=>{});
    return true;
  }catch{return false;}
}
function toggleFullscreen(){
  if(document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch?.(()=>{});
}
window.addEventListener('keydown',ev=>{
  startAudio();
  if(state.intro){
    ev.preventDefault();
    state.intro=false;
    state.enteringName=false;
    state.input='';
    return;
  }
  if(ev.key==='Escape'){
    ev.preventDefault();
    const exitMessage='SO YOU WANT TO LEAVE ME?';
    if(state.infoTitle===exitMessage && closeDesktopApp()) return;
    state.libraryOpen=false;
    state.lifePanelFocused=false;
    releaseMoonInspection();
    state.pinnedBody=null;
    state.input='';
    state.enteringName=false;
    state.info=INFO_CARDS[exitMessage];
    state.infoTitle=exitMessage;
    state.intro=false;
    return;
  }
  if(ev.altKey && ev.key==='Enter'){ev.preventDefault();toggleFullscreen();return;}
  if(ev.key==='Enter'){
    ev.preventDefault();
    if(state.enteringName){
      if(state.input.trim()) visit(state.input);
      return;
    }
    state.intro=false;
    state.enteringName=true;
    state.input='';
    state.historyPos=-1;
    state.libraryOpen=false;
    state.info=null;
    state.infoTitle=null;
    state.lifePanelFocused=false;
    return;
  }
  if(!state.enteringName && state.infoPanelFocused && state.infoPanelRect){
    if(ev.key==='ArrowUp'){ev.preventDefault();scrollInfoPanel(-9);return;}
    if(ev.key==='ArrowDown'){ev.preventDefault();scrollInfoPanel(9);return;}
    if(ev.key==='PageUp'){ev.preventDefault();scrollInfoPanel(-72);return;}
    if(ev.key==='PageDown'){ev.preventDefault();scrollInfoPanel(72);return;}
    if(ev.key==='Home'){ev.preventDefault();state.infoScroll=0;return;}
    if(ev.key==='End'){ev.preventDefault();state.infoScroll=state.infoScrollMax;return;}
  }
  if(!state.enteringName && state.lifePanelFocused && state.lifePanelRect){
    if(ev.key==='ArrowUp'){ev.preventDefault();scrollLifePanel(-1);return;}
    if(ev.key==='ArrowDown'){ev.preventDefault();scrollLifePanel(1);return;}
    if(ev.key==='PageUp'){ev.preventDefault();scrollLifePanel(-5);return;}
    if(ev.key==='PageDown'){ev.preventDefault();scrollLifePanel(5);return;}
    if(ev.key==='Home'){ev.preventDefault();state.lifeScroll=0;return;}
    if(ev.key==='End'){ev.preventDefault();state.lifeScroll=state.lifeScrollMax;return;}
  }
  if(state.libraryOpen){
    const items=libraryItems().slice(0,8);
    const key=ev.key.toLowerCase();
    if(key==='l'){ev.preventDefault();state.libraryOpen=false;return;}
    if(key==='f'){ev.preventDefault();state.libraryTab='favorites';state.librarySelection=0;return;}
    if(key==='r'){ev.preventDefault();state.libraryTab='recent';state.librarySelection=0;return;}
    if(key==='s'){ev.preventDefault();state.libraryTab='scanned';state.librarySelection=0;return;}
    if(key==='e'){ev.preventDefault();exportCaptainLog();return;}
    if(key==='i'){ev.preventDefault();importCaptainLog();return;}
    if(key==='x'){ev.preventDefault();resetExplorationData();return;}
    if(ev.key===' ' && items[state.librarySelection]){ev.preventDefault();visit(items[state.librarySelection]);return;}
    if(ev.key==='ArrowUp'){ev.preventDefault();state.librarySelection=clamp(state.librarySelection-1,0,Math.max(0,items.length-1));return;}
    if(ev.key==='ArrowDown'){ev.preventDefault();state.librarySelection=clamp(state.librarySelection+1,0,Math.max(0,items.length-1));return;}
  }
  if(!state.enteringName && ev.key.toLowerCase()==='f'){ev.preventDefault();toggleFavorite();return;}
  if(!state.enteringName && ev.key.toLowerCase()==='l'){ev.preventDefault();state.libraryOpen=!state.libraryOpen;state.librarySelection=0;state.lifePanelFocused=false;return;}
  if(!state.enteringName && ev.key.toLowerCase()==='c'){ev.preventDefault();sharePlanet();return;}
  if(!state.enteringName && ev.key.toLowerCase()==='p'){ev.preventDefault();launchProbe(state.pinnedBody||state.hoverBody||{type:'planet'});return;}
  if(!state.enteringName && ev.key===' '){ev.preventDefault();doAction('pause');return;}
  if(state.enteringName){
    if(ev.key==='ArrowUp'){ev.preventDefault();historyMove(-1);return;}
    if(ev.key==='ArrowDown'){ev.preventDefault();historyMove(1);return;}
  }
  if(!state.enteringName && ev.key==='Tab'){ev.preventDefault();doAction('temp');return;}
  if(!state.enteringName && ev.key==='ArrowLeft'){ev.preventDefault();setTemp(state.temp-.0125);state.intro=false;return;}
  if(!state.enteringName && ev.key==='ArrowRight'){ev.preventDefault();setTemp(state.temp+.0125);state.intro=false;return;}
  if(ev.key==='ArrowDown' && !state.enteringName){ev.preventDefault();setTemp(state.temp-.0125);state.intro=false;return;}
  if(ev.key==='ArrowUp' && !state.enteringName){ev.preventDefault();setTemp(state.temp+.0125);state.intro=false;return;}
  if(ev.key==='Backspace' && state.enteringName){ev.preventDefault();state.input=state.input.slice(0,-1);return;}
  if(ev.key==='0' && !state.enteringName){ev.preventDefault();doAction('random');return;}
  if(ev.key==='1' && !state.enteringName){ev.preventDefault();doAction('reverse');return;}
  if(ev.key==='2' && !state.enteringName){ev.preventDefault();doAction('fast');return;}
  if(ev.key==='3' && !state.enteringName){ev.preventDefault();doAction('rocket');return;}
  if(ev.key==='4' && !state.enteringName){ev.preventDefault();doAction('camera');return;}
  if(ev.key==='5' && !state.enteringName){ev.preventDefault();doAction('mute');return;}
  if(ev.key==='?' && !state.enteringName){ev.preventDefault();doAction('random');return;}
  if(state.enteringName && !ev.ctrlKey&&!ev.metaKey&&!ev.altKey&&ev.key.length===1 && /[ -~]/.test(ev.key)){
    ev.preventDefault();state.input=(state.input+ev.key).slice(0,60).toUpperCase();
  }
});

canvas.focus();
requestAnimationFrame(render);
})();
