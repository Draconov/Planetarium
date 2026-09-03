(() => {
'use strict';

const W = 480, H = 270;
const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
const boot = document.getElementById('boot');

const C = {
  white: '#F5F5D4', green: '#96CF85', blue: '#4B6D85', black: '#352B31',
  yellow: '#DFE9AA', brown: '#9B986C', red: '#AA5A67', purple: '#9D5B88', cyan: '#BFE7E7'
};

// Render caches: expensive procedural planet data is built only when the
// planet/climate/view state changes. Motion still composites at 60 FPS.
const SURFACE_MAP_W=256, SURFACE_MAP_H=128, INTERACTIVE_SURFACE_STEP=2;
const renderCache={
  planetSeed:null,
  surfaceRevision:1,
  surfaceBuiltRevision:0,
  terrain:null,
  noiseLattices:new Map(),
  surfaceCanvas:null,
  surfaceCtx:null,
  surfaceImage:null,
  frame:null,
  colorRgb:new Map(),
  textWidth:new Map(),
  wrapText:new Map(),
  infoRevision:1,
  planetInfo:null,
  moonInfo:new Map(),
  scanStatus:new Map(),
  lastInteractiveInfoRefreshAt:0
};
function resetPlanetRenderCaches(){
  renderCache.planetSeed=planet?.seed??null;
  renderCache.surfaceRevision++;
  renderCache.surfaceBuiltRevision=0;
  renderCache.terrain=null;
  renderCache.noiseLattices.clear();
  renderCache.surfaceCanvas=null;
  renderCache.surfaceCtx=null;
  renderCache.surfaceImage=null;
  renderCache.frame=null;
  renderCache.planetInfo=null;
  renderCache.moonInfo.clear();
  renderCache.scanStatus.clear();
  renderCache.lastInteractiveInfoRefreshAt=0;
  renderCache.infoRevision++;
}
function ensurePlanetCacheContext(){
  const seed=planet?.seed??null;
  if(renderCache.planetSeed!==seed) resetPlanetRenderCaches();
}
function invalidateSurfaceCache(){ renderCache.surfaceRevision++; }
function invalidateInfoCache(){
  renderCache.infoRevision++;
  renderCache.planetInfo=null;
  renderCache.moonInfo.clear();
}
function invalidatePlanetPresentation(){ invalidateSurfaceCache(); invalidateInfoCache(); }
function rgbForHex(hex){
  let hit=renderCache.colorRgb.get(hex); if(hit) return hit;
  const s=String(hex||'#000000').replace('#','');
  hit=[parseInt(s.slice(0,2),16)||0,parseInt(s.slice(2,4),16)||0,parseInt(s.slice(4,6),16)||0];
  renderCache.colorRgb.set(hex,hit); return hit;
}
const BLACK_RGB=rgbForHex(C.black);
function rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');
}

function withDrawingContext(nextCtx,fn){
  const previous=ctx; ctx=nextCtx;
  try{return fn();}finally{ctx=previous;}
}

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
    invalidateSurfaceCache();
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
  'POLYPHEMUS X':mixHex(C.cyan,C.green,.18), 'POLYPHEMUS XI':mixHex(C.white,C.purple,.14), 'POLYPHEMUS XIII':mixHex(C.brown,C.white,.12), 'POLYPHEMUS XIV':mixHex(C.blue,C.black,.12),
  'WHITE LADY':mixHex(C.white,C.blue,.08), 'BLUE CHILD':mixHex(C.cyan,C.blue,.32),
  'PALE LADY':mixHex(C.white,C.brown,.10), 'SMALLER MOON':mixHex(C.brown,C.black,.30),
  '4546B INNER MOON':mixHex(C.brown,C.white,.18), '4546B OUTER MOON':mixHex(C.cyan,C.white,.18)
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
function paintSpecialMoonSurface(g,alpha,m,diameter,key){
  const name=(m?.name||'').toUpperCase();
  const w=g.canvas.width,h=g.canvas.height, seed=hashString(key)^0x4d4f4f4e;
  const paintDisc=(fn)=>{
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      if(alpha[(y*w+x)*4+3]<=24) continue;
      const nx=(x+.5)/w*2-1, ny=(y+.5)/h*2-1, rr=nx*nx+ny*ny;
      if(rr>1.06) continue;
      const z=Math.sqrt(Math.max(0,1-rr));
      const col=fn(nx,ny,rr,x,y,z);
      if(!col) continue;
      g.fillStyle=col; g.fillRect(x,y,1,1);
    }
  };
  const mark=(fx,fy,col,sz=1)=>{
    const x=Math.round(fx*w), y=Math.round(fy*h);
    for(let yy=0;yy<sz;yy++) for(let xx=0;xx<sz;xx++){
      const px=x+xx, py=y+yy;
      if(px<0||py<0||px>=w||py>=h) continue;
      if(alpha[(py*w+px)*4+3]<=24) continue;
      g.fillStyle=col; g.fillRect(px,py,1,1);
    }
  };
  if(name==='ATTLEROCK'){
    paintDisc((nx,ny,rr,x,y,z)=>{
      const dust=valueNoise((nx+1)*6.5,(ny+1)*6.5,seed,64), craterA=(nx-.28)**2/.08+ (ny+.10)**2/.06, craterB=(nx+.18)**2/.03 + (ny-.18)**2/.024;
      let col=rr>.78?mixHex(C.white,C.brown,.34):dust>.58?mixHex(C.white,C.brown,.28):mixHex(C.brown,C.black,.20);
      if(craterA<1||craterB<1) col=(craterA<.42||craterB<.45)?mixHex(C.black,C.brown,.16):mixHex(C.brown,C.white,.20);
      return surfaceShade(col,nx,z);
    });
    mark(.60,.43,mixHex(C.white,C.yellow,.18),2); mark(.66,.45,mixHex(C.brown,C.white,.18),1);
    mark(.38,.55,mixHex(C.white,C.cyan,.10),2); mark(.32,.60,mixHex(C.brown,C.white,.22),2);
    mark(.48,.31,mixHex(C.white,C.cyan,.12),1); mark(.72,.62,mixHex(C.white,C.yellow,.12),1);
    return true;
  }
  if(name==='ASH TWIN'){
    paintDisc((nx,ny,rr,x,y,z)=>{
      const dunes=valueNoise((nx+1)*7.0,(ny+1)*5.8,seed^0x41534854,64), band=Math.abs(ny-(Math.sin((nx+.14)*3.4)*.10));
      let col=dunes>.60?mixHex(C.white,C.brown,.28):dunes<.24?mixHex(C.yellow,C.white,.12):mixHex(C.white,C.yellow,.22);
      if(band<.12) col=band<.05?mixHex(C.brown,C.black,.16):mixHex(C.brown,C.white,.32);
      return surfaceShade(col,nx,z);
    });
    mark(.54,.26,mixHex(C.brown,C.white,.34),1); mark(.58,.28,mixHex(C.brown,C.black,.10),1);
    return true;
  }
  if(name==='EMBER TWIN'){
    paintDisc((nx,ny,rr,x,y,z)=>{
      const dunes=valueNoise((nx+1)*6.4,(ny+1)*6.0,seed^0x454d4252,64), scar=Math.abs(ny-(.08*Math.sin((nx-.10)*4.3)-.06));
      let col=dunes>.66?mixHex(C.red,C.brown,.18):dunes<.28?mixHex(C.yellow,C.brown,.16):mixHex(C.red,C.yellow,.24);
      if(scar<.13) col=scar<.045?mixHex(C.black,C.red,.12):mixHex(C.brown,C.red,.20);
      return surfaceShade(col,nx,z);
    });
    mark(.34,.60,mixHex(C.black,C.brown,.18),1);
    return true;
  }
  if(name==="HOLLOW'S LANTERN"){
    paintDisc((nx,ny,rr,x,y,z)=>{
      const noise=valueNoise((nx+1)*7.2,(ny+1)*6.6,seed^0x484f4c4f,64), seam=Math.abs(ny-(.18*Math.sin((nx+.05)*4.0)-.02)), vent=((nx+.24)/.26)**2+((ny-.08)/.18)**2;
      let col=noise>.58?mixHex(C.red,C.brown,.18):noise<.26?mixHex(C.black,C.brown,.16):mixHex(C.brown,C.black,.08);
      if(seam<.10) col=seam<.038?mixHex(C.red,C.yellow,.24):mixHex(C.brown,C.red,.18);
      if(vent<1) col=vent<.34?mixHex(C.yellow,C.white,.10):mixHex(C.red,C.yellow,.24);
      return surfaceShade(col,nx,z);
    });
    mark(.66,.34,mixHex(C.yellow,C.white,.10),1); mark(.70,.38,mixHex(C.red,C.yellow,.16),1);
    return true;
  }
  return false;
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
  } else if(paintSpecialMoonSurface(g,alpha,m,diameter,key)){
    // Hand-authored lore moons use bespoke tiny pixel maps so they still read
    // like their full-size planets instead of random tinted generic pebbles.
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
function noiseLatticeValue(x,y,seed,periodX){
  const key=`${seed>>>0}:${periodX}`;
  let lattice=renderCache.noiseLattices.get(key);
  if(!lattice){ lattice=new Map(); renderCache.noiseLattices.set(key,lattice); }
  const xx=mod(x,periodX),idx=y*512+xx;
  let v=lattice.get(idx);
  if(v===undefined){ v=h2(xx,y,seed); lattice.set(idx,v); }
  return v;
}
function valueNoise(x,y,seed,periodX=64) {
  let x0=Math.floor(x), y0=Math.floor(y), tx=smooth(x-x0), ty=smooth(y-y0);
  const x1=x0+1, y1=y0+1;
  const a=noiseLatticeValue(x0,y0,seed,periodX), b=noiseLatticeValue(x1,y0,seed,periodX);
  const c=noiseLatticeValue(x0,y1,seed,periodX), d=noiseLatticeValue(x1,y1,seed,periodX);
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
  const raw=String(text),key=`${scale}:${raw}`;
  const cached=renderCache.textWidth.get(key); if(cached!==undefined) return cached;
  let w=0; for(const ch of raw){ const g=glyph(ch); w+=(g ? g.shift : 4)*scale; }
  w=Math.max(0,w-scale); renderCache.textWidth.set(key,w); return w;
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
  const raw=String(text),cacheKey=`${maxPx}:${scale}:${raw}`;
  const cached=renderCache.wrapText.get(cacheKey); if(cached) return cached;
  const paras=raw.split('#'); const lines=[];
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
  renderCache.wrapText.set(cacheKey,lines); return lines;
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
      ...(planet.sporeTScore?[['T-SCORE',planet.sporeTScore,C.green]]:[]),['WEATHER',compactWeatherLabel(),atmosphereAccentColor()],['CLOUDS',`${Math.round(dynamicCloudCover()*100)}% ${cloudTypeLabel()}`,C.white],['PRECIP',precipitationLabel(),C.cyan],['TECTONIC',d.tectonics,C.white],['VOLCANIC',d.volcanism,C.red],
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
  'INSTALLATION 07':'ZETA HALO','INSTALLATION 7':'ZETA HALO','I07':'ZETA HALO','HALO INFINITE':'ZETA HALO',
  'SUBNAUTICA':'4546B','PLANET 4546B':'4546B','4546 B':'4546B','PLANET 4546 B':'4546B',
  'WARCRAFT':'AZEROTH','WORLD OF WARCRAFT':'AZEROTH','WOW':'AZEROTH','WOW AZEROTH':'AZEROTH',
  'WARCRAFT DRAENOR':'DRAENOR','WOW DRAENOR':'DRAENOR','ALTERNATE DRAENOR':'DRAENOR',
  'WARCRAFT OUTLAND':'OUTLAND','WOW OUTLAND':'OUTLAND','THE OUTLAND':'OUTLAND','THE OUTLANDS':'OUTLAND',
  'WARCRAFT ARGUS':'ARGUS','WOW ARGUS':'ARGUS',
  'OUTER WILDS':'TIMBER HEARTH','TIMBERHEARTH':'TIMBER HEARTH','OUTERWILDS':'TIMBER HEARTH',
  'ATTLEROCK':'ATTLEROCK','THE ATTLEROCK':'ATTLEROCK',
  'BRITTLE HOLLOW':'BRITTLE HOLLOW','BRITTLEHOLLOW':'BRITTLE HOLLOW',
  "HOLLOW'S LANTERN":"HOLLOW'S LANTERN",'HOLLOWS LANTERN':"HOLLOW'S LANTERN",
  "GIANT'S DEEP":"GIANT'S DEEP",'GIANTS DEEP':"GIANT'S DEEP",
  'DARK BRAMBLE':'DARK BRAMBLE','DARKBRAMBLE':'DARK BRAMBLE',
  'EMBER TWIN':'EMBER TWIN','EMBERTWIN':'EMBER TWIN',
  'ASH TWIN':'ASH TWIN','ASHTWIN':'ASH TWIN','HOURGLASS TWINS':'EMBER TWIN',
  'INTERLOPER':'INTERLOPER','THE INTERLOPER':'INTERLOPER',
  'QUANTUM MOON':'QUANTUM MOON','QUANTUMMOON':'QUANTUM MOON',
  'EYE OF THE UNIVERSE':'EYE OF THE UNIVERSE','THE EYE':'EYE OF THE UNIVERSE','EYE':'EYE OF THE UNIVERSE',
  'THE STRANGER':'THE STRANGER','STRANGER':'THE STRANGER','OUTER WILDS DLC':'THE STRANGER','ECHOES OF THE EYE':'THE STRANGER','DLC WORLD':'THE STRANGER',
  'WENKWORT':'WENKWORT ARTEM','WENKWORT ARTEM':'WENKWORT ARTEM','STELLARIS WENKWORT':'WENKWORT ARTEM',
  'ZANAAM':'ZANAAM','STELLARIS ZANAAM':'ZANAAM','PARIDAYDA':'PARIDAYDA','STELLARIS PARIDAYDA':'PARIDAYDA',
  'THE VEIL':'THE VEIL','VEIL':'THE VEIL','STELLARIS VEIL':'THE VEIL',
  "PROPHET'S RETREAT":"PROPHET'S RETREAT",'PROPHETS RETREAT':"PROPHET'S RETREAT",'HOLY WORLD':"PROPHET'S RETREAT",
  'WALLED GARDEN':'WALLED GARDEN','EMERALD MAUSOLEUM':'EMERALD MAUSOLEUM','PRISTINE JEWEL':'PRISTINE JEWEL',
  'KIRA':'KIRA','STELLARIS KIRA':'KIRA','SANCTUARY':'SANCTUARY','SANCTUARY RINGWORLD':'SANCTUARY','STELLARIS SANCTUARY':'SANCTUARY',
  'SPORE':'SPORE EARTH','SPORE EARTH':'SPORE EARTH','EARTH SPORE':'SPORE EARTH',
  'GROX':'GROX HOMEWORLD','GROX HOME':'GROX HOMEWORLD','GROX CAPITAL':'GROX HOMEWORLD','GROX HOMEWORLD':'GROX HOMEWORLD',
  'MYLIFF':'MYLIFF','OINKER-7':'OINKER-7','OINKER 7':'OINKER-7','ADVENTURE TOWN':'ADVENTURE TOWN',
  'RUINS OF DOOM':'RUINS OF DOOM','INFESTATION':'INFESTATION','IT CAME FROM THE SKY':'IT CAME FROM THE SKY',
  'TX-5000':'TX-5000','TX5000':'TX-5000','DANCETOPIA':'DANCETOPIA',
  'DYSON':'DYSON SPHERE','DYSON SPHERE':'DYSON SPHERE','DYSON SHELL':'DYSON SPHERE',
  'BERNAL':'BERNAL SPHERE','BERNAL SPHERE':'BERNAL SPHERE','ISLAND ONE':'BERNAL SPHERE',
  'RINGWORLD':'RINGWORLD PRIME','RING WORLD':'RINGWORLD PRIME','ARTIFICIAL RINGWORLD':'RINGWORLD PRIME','RINGWORLD PRIME':'RINGWORLD PRIME',
  'DOMEWORLD':'DOMEWORLD','DOME WORLD':'DOMEWORLD','MEGADOME WORLD':'DOMEWORLD','GLASS DOME WORLD':'DOMEWORLD',
  'ROTATING WHEEL SPACE STATION':'VON BRAUN WHEEL','ROTATING WHEEL':'VON BRAUN WHEEL','WHEEL STATION':'VON BRAUN WHEEL','VON BRAUN WHEEL':'VON BRAUN WHEEL',
  'STANFORD TORUS':'STANFORD TORUS','STANFORD':'STANFORD TORUS',
  "O'NEILL CYLINDER":"O'NEILL CYLINDER",'ONEILL CYLINDER':"O'NEILL CYLINDER",
  'BISHOP RING':'BISHOP RING',
  'SHELLWORLD':'SHELLWORLD','SHELL WORLD':'SHELLWORLD','NESTED SHELLWORLD':'SHELLWORLD','ARTIFICIAL PLANET':'SHELLWORLD',
  'GRAND CANYON PLANET':'CHASM','CANYON PLANET':'CHASM','CRACKED PLANET':'CHASM','MEGA CANYON':'CHASM'
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

function stellarisGaiaPreset({worldClass='GAIA WORLD',style='garden',radiusKm=6800,gravity=1.02,water=.56,cloud=.40,temp=21,population=4,tech='PRE-FTL',anomaly='ANCIENT CURATED BIOSPHERE',observation='',loreReport=''}={}){
  return {
    renderer:'stellarisgaia',stellarisStyle:style,worldType:'VERDANT',worldClass,visualRadius:43,radiusKm,gravity,
    massEarth:Math.max(.55,gravity*Math.pow(radiusKm/6371,2)),density:1.02,water,cloudCover:cloud,cloudSpeed:.13,
    defaultTempC:temp,tempRange:[-22,48],life:true,populationBase:population,dayHours:24.8,yearDays:410,distanceAU:1.1,axialTiltDeg:20,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'MILD RAIN / CLEAR SKIES',ring:false,moons:[],disableAutoCivilization:true,
    observation,
    scan:{ageBy:4.7,pressureAtm:1.04,pressureText:'1.04 ATM',magField:'STRONG',oxygen:22.2,nitrogen:76.6,co2:.05,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:water>.6?8.4:4.8,lifeTypePotential:'COMPLEX',techPotential:tech,iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly,lossRisk:false},
    loreReport,lifeLabel:'ABUNDANT',populationLabel:population>=6?'MANY':population>=3?'FEW':'TRACE',lifeTypeLabel:'COMPLEX',techLevelLabel:tech
  };
}
function sporeHiddenPreset({renderer='sporecity',worldType='VERDANT',worldClass='SPORE WORLD',tScore='T3',theme='bright',radiusKm=6100,gravity=.94,water=.42,cloud=.32,temp=22,life=true,population=5,atmos='NORMAL',chem='N2 / O2',weather='SHOWERS',tech='SPACE AGE',anomaly='MAXIS ADVENTURE SIGNATURE',observation='',loreReport=''}={}){
  const pressure=atmos==='NONE'?0:atmos==='TRACE'?.03:atmos==='THIN'?.38:atmos==='DENSE'?1.8:1.02;
  return {
    renderer,sporeTheme:theme,sporeTScore:tScore,worldType,worldClass,visualRadius:42,radiusKm,gravity,
    massEarth:Math.max(.2,gravity*Math.pow(radiusKm/6371,2)),density:1.01,water,cloudCover:cloud,cloudSpeed:.14,defaultTempC:temp,tempRange:[-60,72],life,populationBase:population,
    dayHours:22.7,yearDays:356,distanceAU:1.0,axialTiltDeg:17,rotationDirection:1,atmosDensity:atmos,atmosChemistry:chem,weather,ring:false,moons:[],disableAutoCivilization:true,
    observation,
    scan:{ageBy:4.1,pressureAtm:pressure,pressureText:pressure===0?'VACUUM':`${pressure.toFixed(2)} ATM`,magField:'MODERATE',oxygen:life?20.4:0,nitrogen:life?77.8:chem.includes('N2')?60:0,co2:worldType==='TOXIC'?25:.2,tectonics:'LOW',volcanism:worldType==='VOLCANIC'?'HIGH':'LOW',oceanDepthKm:water>.72?14.0:water>.35?4.2:0,lifeTypePotential:life?'COMPLEX':'NONE',techPotential:tech,iron:'COMMON',carbon:life?'ABUNDANT':'COMMON',uranium:'TRACE',anomaly,lossRisk:false},
    loreReport,lifeLabel:life?'ABUNDANT':'NONE',populationLabel:population>=7?'MASSIVE':population>=4?'MANY':population>0?'FEW':'NONE',lifeTypeLabel:life?'COMPLEX':'NONE',techLevelLabel:tech
  };
}

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
  '4546B':{
    worldType:'OCEAN',worldClass:'CATEGORY 3 OCEAN PLANET',renderer:'subnautica',visualRadius:44,radiusKm:5600,gravity:.86,massEarth:.66,density:.98,
    water:.94,cloudCover:.48,cloudSpeed:.18,defaultTempC:18,tempRange:[-55,48],life:true,populationBase:3,
    dayHours:24.6,yearDays:382,distanceAU:1.02,axialTiltDeg:18,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'OCEAN STORMS / ARCTIC SNOW',ring:false,
    moons:[
      knownMoon('4546B INNER MOON',118000,8.7,1250,72,5,.68,{surface:'ROCK / ICE',atmosphere:'TRACE',waterIce:'COMMON',activity:'STRONG TIDAL COUPLING',anomaly:'FREQUENT ECLIPSES / EXTREME TIDAL FORCING',lossRisk:false}),
      knownMoon('4546B OUTER MOON',286000,27.6,720,96,8,.55,{surface:'ICE / ROCK',atmosphere:'NONE',waterIce:'RICH',activity:'DORMANT',anomaly:'NONE',lossRisk:false})
    ],
    observation:'A TEMPERATE CATEGORY-3 OCEAN WORLD ALMOST COMPLETELY COVERED BY WATER, WITH ONLY SMALL ISLANDS, ARCTIC LAND AND VOLCANIC CRATER REGIONS BREAKING THE SURFACE.',
    scan:{ageBy:4.3,pressureAtm:1.03,pressureText:'1.03 ATM',magField:'MODERATE',oxygen:21,nitrogen:77,co2:.06,tectonics:'ACTIVE',volcanism:'HIGH',oceanDepthKm:8.4,lifeTypePotential:'ABUNDANT / LEVIATHAN',techPotential:'ANCIENT ARCHITECT RUINS',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'KHARAA QUARANTINE NETWORK / PRECURSOR ENERGY SIGNATURES',lossRisk:false},
    loreReport:'THE CRATER AND SECTOR ZERO SUPPORT DENSE, HIGHLY VARIED ECOSYSTEMS WHILE THE VAST DEAD ZONE IS MUCH DEEPER AND FAR LESS HOSPITABLE. ARCHITECT FACILITIES, ALTERRA WRECKAGE AND LEVIATHAN-CLASS ORGANISMS PRODUCE STRONG ANOMALOUS RETURNS.',
    lifeLabel:'ABUNDANT',populationLabel:'WILD',lifeTypeLabel:'COMPLEX',techLevelLabel:'ANCIENT RUINS'
  },
  AZEROTH:{
    worldType:'VERDANT',worldClass:'TITAN WORLDSOUL PLANET',renderer:'azeroth',visualRadius:45,radiusKm:6600,gravity:1.00,massEarth:1.04,density:1.00,
    water:.62,cloudCover:.50,cloudSpeed:.16,defaultTempC:16,tempRange:[-65,58],life:true,populationBase:9,
    dayHours:24,yearDays:365,distanceAU:1,axialTiltDeg:23,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2 / ARCANE TRACE',weather:'VARIED / ARCANE STORMS',ring:false,
    moons:[
      knownMoon('WHITE LADY',390000,28.0,1820,82,1,.78,{surface:'PALE ROCK / ARCANE DUST',atmosphere:'NONE',waterIce:'TRACE',activity:'LUNAR CYCLE',anomaly:'ELUNE-ASSOCIATED ARCANE SIGNATURE',lossRisk:false}),
      knownMoon('BLUE CHILD',245000,17.3,790,64,5,.58,{surface:'BLUE-GREEN ROCK / ICE',atmosphere:'TRACE',waterIce:'COMMON',activity:'VARIABLE ORBITAL APPEARANCE',anomaly:'RARE CONJUNCTION WITH WHITE LADY',lossRisk:false})
    ],
    observation:'A BLUE-GREEN WORLD OF VAST OCEANS, CONTINENTS, MOUNTAIN CHAINS, DESERTS AND MAGICAL CIVILIZATIONS BUILT ABOVE AN IMMENSE TITAN WORLDSOUL.',
    scan:{ageBy:4.6,pressureAtm:1.0,pressureText:'1.00 ATM',magField:'STRONG',oxygen:21,nitrogen:77,co2:.05,tectonics:'ACTIVE',volcanism:'ACTIVE',oceanDepthKm:4.6,lifeTypePotential:'INTELLIGENT / MAGICAL',techPotential:'ARCANE / INDUSTRIAL',iron:'RICH',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'TITAN WORLDSOUL / PLANETARY LEY-LINE NEXUS',lossRisk:false},
    loreReport:'MULTIPLE INTELLIGENT CIVILIZATIONS COVER AZEROTH. ARCANE LEY LINES, TITAN FACILITIES, OLD-GOD SCARS AND THE MAELSTROM CREATE PLANET-SCALE ENERGY SIGNATURES. THE WHITE LADY AND BLUE CHILD ORBIT ABOVE.',
    lifeLabel:'ABUNDANT',populationLabel:'MASSIVE',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'ARCANE / INDUSTRIAL'
  },
  DRAENOR:{
    worldType:'VERDANT',worldClass:'PRIMORDIAL ORCISH WORLD',renderer:'draenor',visualRadius:43,radiusKm:5600,gravity:.91,massEarth:.71,density:1.04,
    water:.40,cloudCover:.43,cloudSpeed:.14,defaultTempC:19,tempRange:[-55,61],life:true,populationBase:7,
    dayHours:26,yearDays:410,distanceAU:1.15,axialTiltDeg:20,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'PLAINS STORMS / FROST / SPORES',ring:false,
    moons:[
      knownMoon('PALE LADY',322000,24.8,1700,82,1,.76,{surface:'PALE ROCK',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'STRONG SHADOWMOON CULTURAL SIGNIFICANCE',lossRisk:false}),
      knownMoon('SMALLER MOON',178000,12.6,720,62,10,.52,{surface:'DARK ROCK',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'DARK LOW-ALBEDO SATELLITE',lossRisk:false})
    ],
    observation:'THE UNSHATTERED HOMEWORLD OF ORCS AND OGRES: A FERTILE WORLD OF PLAINS, FORESTS, SWAMPS, FUNGAL SEAS, VOLCANIC BADLANDS AND DRAENEI SETTLEMENTS.',
    scan:{ageBy:4.4,pressureAtm:.97,pressureText:'0.97 ATM',magField:'MODERATE',oxygen:20,nitrogen:78,co2:.08,tectonics:'ACTIVE',volcanism:'MODERATE',oceanDepthKm:2.4,lifeTypePotential:'INTELLIGENT',techPotential:'SHAMANIC / ARCANE',iron:'RICH',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'ELEMENTAL NEXUS / DRAENEI CRYSTAL TECHNOLOGY',lossRisk:false},
    loreReport:'VAST GRASSLANDS, FROSTFIRE RIDGES, SHADOWED VALLEYS, ZANGAR FUNGAL REGIONS AND DRAENEI CITIES SHARE THE WORLD. TWO MOONS DOMINATE THE NIGHT SKY, THE LARGER COMMONLY CALLED THE PALE LADY.',
    lifeLabel:'ABUNDANT',populationLabel:'MANY',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'SHAMANIC / ARCANE'
  },
  OUTLAND:{
    worldType:'BARREN',worldClass:'SHATTERED WORLD REMNANT',renderer:'outland',visualRadius:45,radiusKm:5200,gravity:.72,massEarth:.49,density:.94,
    water:.18,cloudCover:.22,cloudSpeed:.12,defaultTempC:22,tempRange:[-70,78],life:true,populationBase:5,
    dayHours:29,yearDays:410,distanceAU:0,axialTiltDeg:31,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / O2 / NETHER TRACE',weather:'ARCANE STORMS / NETHER WINDS',ring:false,
    damage:{type:'MISSING_HEMISPHERE',angle:-.22,severity:.72,seed:0x0a71a0d1},
    moons:[
      knownMoon('PALE LADY',322000,24.8,1700,82,1,.76,{surface:'PALE ROCK',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'LOOMS LARGE OVER THE SHATTERED REMNANT',lossRisk:false}),
      knownMoon('SMALLER MOON',178000,12.6,720,62,10,.52,{surface:'DARK ROCK',atmosphere:'NONE',waterIce:'TRACE',activity:'DORMANT',anomaly:'DARK LOW-ALBEDO SATELLITE',lossRisk:false})
    ],
    observation:'THE BROKEN REMAINS OF DRAENOR, TORN APART BY DIMENSIONAL PORTALS AND LEFT FLOATING BETWEEN THE GREAT DARK AND THE TWISTING NETHER.',
    scan:{ageBy:4.4,pressureAtm:.61,pressureText:'UNSTABLE / LOCAL',magField:'FRACTURED',oxygen:17,nitrogen:68,co2:.4,tectonics:'DISCONTINUOUS',volcanism:'LOCAL',oceanDepthKm:.8,lifeTypePotential:'INTELLIGENT',techPotential:'ARCANE / INTERPLANAR',iron:'COMMON',carbon:'COMMON',uranium:'TRACE',anomaly:'REALITY FRACTURES / FLOATING LANDMASSES / UNSTABLE TIMEFLOW',lossRisk:false},
    loreReport:'OUTLAND IS NO LONGER A COMPLETE PLANET. LARGE HABITABLE LANDMASSES, MOUNTAINS AND CITIES SURVIVE AS A SHATTERED FRAGMENT WHILE THE TWISTING NETHER SHOWS THROUGH AROUND BROKEN EDGES AND FLOATING ROCK.',
    lifeLabel:'PERSISTENT',populationLabel:'MANY',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'ARCANE / INTERPLANAR'
  },
  ARGUS:{
    worldType:'TOXIC',worldClass:'FEL-SHATTERED TITAN WORLD',renderer:'argus',visualRadius:46,radiusKm:6400,gravity:1.03,massEarth:1.08,density:1.02,
    water:.02,cloudCover:.37,cloudSpeed:.20,defaultTempC:39,tempRange:[-30,110],life:true,populationBase:6,
    dayHours:27,yearDays:455,distanceAU:0,axialTiltDeg:17,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'N2 / FEL / METALLIC VAPOR',weather:'FEL STORMS / ASH',ring:false,moons:[],
    damage:{type:'SHATTERED_EDGE',angle:.36,severity:.76,seed:0xa2655001},
    observation:'THE RUINED HOMEWORLD OF THE EREDAR, SATURATED WITH FEL ENERGY AND SPLIT BY ENORMOUS CRUSTAL WOUNDS, WITH BROKEN LAND AND CITY SECTIONS HANGING ABOVE THE SURFACE.',
    scan:{ageBy:5.1,pressureAtm:1.42,pressureText:'1.42 ATM TOXIC',magField:'CHAOTIC',oxygen:4,nitrogen:54,co2:8,tectonics:'CATASTROPHIC',volcanism:'EXTREME',oceanDepthKm:0,lifeTypePotential:'DEMONIC / INTELLIGENT',techPotential:'INTERSTELLAR / FEL',iron:'RICH',carbon:'COMMON',uranium:'ABUNDANT',anomaly:'TORTURED TITAN WORLDSOUL / LEGION RESURRECTION ENGINE',lossRisk:false},
    loreReport:'ARGUS WAS ONCE A LUSH EREDAR HOMEWORLD. IT IS NOW A BURNING-LEGION STRONGHOLD SHROUDED IN THE TWISTING NETHER, ITS CRUST SPLIT OPEN AND LARGE SECTIONS OF LAND BLOWN INTO ORBIT.',
    lifeLabel:'HOSTILE',populationLabel:'MANY',lifeTypeLabel:'DEMONIC / INTELLIGENT',techLevelLabel:'INTERSTELLAR / FEL'
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
    water:.00,cloudCover:.01,cloudSpeed:.05,defaultTempC:47,tempRange:[-50,92],life:true,populationBase:5,
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
  },
  CHASM:{
    renderer:'chasm',worldType:'BARREN',worldClass:'MEGACANYON WORLD',visualRadius:56,radiusKm:11200,gravity:1.24,massEarth:2.35,density:1.10,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:12,tempRange:[-95,58],life:false,populationBase:0,
    dayHours:29,yearDays:602,distanceAU:2.2,axialTiltDeg:7,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A GIANT AIRLESS ROCK WORLD CUT BY A CONTINENT-SCALE VERTICAL CHASM VISIBLE EVEN FROM ORBIT.',
    scan:{ageBy:5.7,pressureAtm:0,pressureText:'VACUUM',magField:'WEAK',oxygen:0,nitrogen:0,co2:0,tectonics:'DORMANT',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'PLANET-SPANNING RIFT / EXPOSED STRATIFIED CRUST',lossRisk:false},
    loreReport:'THE SURFACE IS A BONE-DRY EXPANSE OF CRUMBLING HIGHLANDS, IMPACT-SCARRED BASINS AND EXPOSED BEDROCK. A VAST NORTH-SOUTH CHASM, REMINISCENT OF A GRAND-CANYON SCALE RIFT, SPLITS THE FACE OF THE WORLD.'
  },
  'TIMBER HEARTH':{
    renderer:'timberhearth',worldType:'VERDANT',worldClass:'HEARTHIAN WORLD',visualRadius:41,radiusKm:5600,gravity:.91,massEarth:.74,density:1.12,
    water:.43,cloudCover:.38,cloudSpeed:.11,defaultTempC:17,tempRange:[-28,44],life:true,populationBase:3,
    dayHours:23.3,yearDays:281,distanceAU:.82,axialTiltDeg:11,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'BREEZES / SHOWERS',ring:false,
    moons:[knownMoon('ATTLEROCK',28400,5.1,820,60,14,.40,{tempBias:-18,gravity:.06,surface:'ROCK / DUST / CRATERS',atmosphere:'NONE',waterIce:'TRACE',activity:'LOW GEOLOGIC ACTIVITY',anomaly:'NOMAI RUINS / SIGNAL LOCATOR',lossRisk:false})],
    observation:'A SMALL WOODED WORLD OF RIVERS, ISLANDS AND ROUND HILLS, HOME TO A CURIOUS EARLY-SPACEFARING SPECIES.',
    scan:{ageBy:4.2,pressureAtm:.98,pressureText:'0.98 ATM',magField:'MODERATE',oxygen:21,nitrogen:77,co2:.08,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:1.9,lifeTypePotential:'INTELLIGENT',techPotential:'EARLY SPACEFLIGHT',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'ANCIENT NOMAI RUINS / LOCAL TIME-LOOP SIGNALS',lossRisk:false},
    loreReport:'TIMBER HEARTH IS A COZY, FORESTED WORLD OF LAKES, GULLIES AND WOODEN SETTLEMENTS. HEARTHIAN ASTRONAUTS HAVE REACHED THEIR MOON, ATTLEROCK, WHILE OLDER NOMAI RUINS AND UNUSUAL TEMPORAL SIGNALS LINGER ACROSS THE SYSTEM.',
    lifeLabel:'ABUNDANT',populationLabel:'FEW',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'EARLY SPACEFLIGHT'
  },
  ATTLEROCK:{
    renderer:'attlerock',worldType:'BARREN',worldClass:'LUNAR OUTPOST',visualRadius:28,radiusKm:820,gravity:.06,massEarth:.002,density:.57,
    water:.01,cloudCover:0,cloudSpeed:0,defaultTempC:-23,tempRange:[-145,32],life:false,populationBase:0,
    dayHours:120,yearDays:5.1,distanceAU:.82,axialTiltDeg:3,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    observation:'TIMBER HEARTH\'S DUSTY LITTLE MOON, KNOWN FOR ITS NOMAI RUINS AND A CLEAR VIEW OF THE ENTIRE SYSTEM.',
    scan:{ageBy:4.2,pressureAtm:0,pressureText:'VACUUM',magField:'NONE',oxygen:0,nitrogen:0,co2:0,tectonics:'LOW',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'OUTPOST',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'NOMAI RUINS / SIGNAL LOCATOR',lossRisk:false},
    loreReport:'ATTLEROCK IS A SMALL STONY MOON USED BY HEARTHIAN ASTRONAUTS AS A FIRST STEPPING-STONE INTO SPACE. OLD NOMAI STRUCTURES AND A SIGNAL LOCATOR STILL STAND ON ITS QUIET SURFACE.',
    lifeLabel:'NONE',populationLabel:'OUTPOST',lifeTypeLabel:'NONE',techLevelLabel:'OUTPOST'
  },
  'EMBER TWIN':{
    renderer:'embertwin',worldType:'DESERT',worldClass:'HOURGLASS TWIN',visualRadius:34,radiusKm:4300,gravity:.62,massEarth:.31,density:1.06,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:68,tempRange:[-18,140],life:false,populationBase:0,
    dayHours:13.4,yearDays:104,distanceAU:.46,axialTiltDeg:2,rotationDirection:1,
    atmosDensity:'TRACE',atmosChemistry:'TRACE N2 / DUST',weather:'DRY SAND FALLS',ring:false,
    moons:[knownMoon('ASH TWIN',11300,.47,4200,52,10,.64,{tempBias:-8,gravity:.58,surface:'ASH / ROCK / DUST',atmosphere:'TRACE',waterIce:'TRACE',activity:'TIDAL SAND TRANSFER',anomaly:'ANCIENT NOMAI TOWERS / HOURGLASS SAND EXCHANGE',lossRisk:false})],
    observation:'THE HOTTER OF THE HOURGLASS TWINS, A SUNBAKED WORLD OF CANYONS, CAVES AND MIGRATING SAND.',
    scan:{ageBy:4.1,pressureAtm:.03,pressureText:'TRACE',magField:'WEAK',oxygen:0,nitrogen:22,co2:2,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'ANCIENT RUINS',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'SAND TRANSFER / SUNLESS CITY / NOMAI RUINS',lossRisk:false},
    loreReport:'EMBER TWIN IS A DRY ORANGE WORLD RIDDLED WITH CAVES AND CHASMS. AS THE LOOP PROGRESSES, ITS PARTNER ASH TWIN DRAINS SAND TOWARD IT, BURYING RUINS AND OPENING NEW PASSAGES.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'ANCIENT RUINS'
  },
  'ASH TWIN':{
    renderer:'ashtwin',worldType:'DESERT',worldClass:'HOURGLASS TWIN',visualRadius:34,radiusKm:4200,gravity:.58,massEarth:.28,density:.99,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:41,tempRange:[-40,110],life:false,populationBase:0,
    dayHours:13.4,yearDays:104,distanceAU:.46,axialTiltDeg:2,rotationDirection:1,
    atmosDensity:'TRACE',atmosChemistry:'TRACE N2 / DUST',weather:'ASH DUST',ring:false,
    moons:[knownMoon('EMBER TWIN',11300,.47,4300,52,12,.64,{tempBias:12,gravity:.62,surface:'RED SAND / CANYONS',atmosphere:'TRACE',waterIce:'NONE',activity:'TIDAL SAND TRANSFER',anomaly:'SUNLESS CITY / CHERT OBSERVATORY SIGNALS',lossRisk:false})],
    observation:'THE PALER HOURGLASS TWIN, AN ASHEN DESERT WORLD WITH NOMAI TOWERS AND SAND-STRIPPED PLAINS.',
    scan:{ageBy:4.1,pressureAtm:.03,pressureText:'TRACE',magField:'WEAK',oxygen:0,nitrogen:24,co2:2,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'ANCIENT RUINS',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'ASH TWIN PROJECT / NOMAI TOWERS / SAND TRANSFER',lossRisk:false},
    loreReport:'ASH TWIN IS A PALE DESERT WORLD SURROUNDED BY TORNADO-LIKE SAND COLUMNS AND ANCIENT NOMAI STRUCTURES. IT SLOWLY EMPTIES ITSELF INTO EMBER TWIN OVER THE COURSE OF THE LOOP.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'ANCIENT RUINS'
  },
  'BRITTLE HOLLOW':{
    renderer:'brittlehollow',worldType:'VOLCANIC',worldClass:'FRACTURING HOLLOW WORLD',visualRadius:40,radiusKm:5100,gravity:.82,massEarth:.67,density:1.02,
    water:.02,cloudCover:.04,cloudSpeed:.06,defaultTempC:7,tempRange:[-60,48],life:false,populationBase:0,
    dayHours:21.9,yearDays:151,distanceAU:.63,axialTiltDeg:6,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'N2 / VOLCANIC GASES',weather:'ASH / FALLING CRUST',ring:false,
    moons:[knownMoon("HOLLOW'S LANTERN",22800,3.6,980,66,1,.48,{tempBias:110,gravity:.07,surface:'MOLTEN ROCK / BASALT',atmosphere:'TRACE VOLCANIC GASES',waterIce:'NONE',activity:'EXTREME VOLCANISM',anomaly:'CONSTANT METEORIC BOMBARDMENT',lossRisk:false})],
    observation:'A BLUE-GREY FRAGMENTING WORLD WITH A THIN CRUST, GLOWING FISSURES AND A LAVA-SPITTING VOLCANIC MOON.',
    scan:{ageBy:4.3,pressureAtm:.41,pressureText:'0.41 ATM',magField:'WEAK',oxygen:3,nitrogen:46,co2:6,tectonics:'CATASTROPHIC',volcanism:'HIGH',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'ANCIENT RUINS',iron:'COMMON',carbon:'TRACE',uranium:'TRACE',anomaly:'HOLLOW INTERIOR / NOMAI GRAVITY CRYSTALS / VOLCANIC BOMBARDMENT',lossRisk:false},
    loreReport:'BRITTLE HOLLOW IS A FRACTURING WORLD WHOSE CRUST BREAKS AWAY INTO SPACE. NOMAI RUINS CLING TO ITS SURFACE AND UNDERBELLY WHILE HOLLOW\'S LANTERN CONTINUES TO BATTER THE PLANET WITH VOLCANIC DEBRIS.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'ANCIENT RUINS'
  },
  "HOLLOW'S LANTERN":{
    renderer:'embertwin',worldType:'VOLCANIC',worldClass:'VOLCANIC MOON',visualRadius:24,radiusKm:980,gravity:.07,massEarth:.003,density:.47,
    water:0,cloudCover:.02,cloudSpeed:.04,defaultTempC:184,tempRange:[60,260],life:false,populationBase:0,
    dayHours:72,yearDays:3.6,distanceAU:.63,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'TRACE',atmosChemistry:'SO2 / ASH',weather:'VOLCANIC EJECTA',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A SMALL MOLTEN MOON THAT HURLS FIERY DEBRIS TOWARD BRITTLE HOLLOW.',
    scan:{ageBy:4.3,pressureAtm:.02,pressureText:'TRACE',magField:'NONE',oxygen:0,nitrogen:0,co2:3,tectonics:'VIOLENT',volcanism:'EXTREME',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'ABUNDANT',carbon:'TRACE',uranium:'TRACE',anomaly:'METEORIC VOLCANIC EJECTA',lossRisk:false},
    loreReport:'HOLLOW\'S LANTERN IS A BRUTAL LITTLE VOLCANIC MOON. ITS ERUPTIONS LAUNCH MOLTEN ROCK ACROSS THE SYSTEM AND REPEATEDLY SHATTER THE CRUST OF BRITTLE HOLLOW.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'NONE'
  },
  "GIANT'S DEEP":{
    renderer:'giantsdeep',worldType:'OCEAN',worldClass:'OCEANIC TITAN',visualRadius:49,radiusKm:9300,gravity:1.18,massEarth:1.62,density:.86,
    water:.96,cloudCover:.72,cloudSpeed:.20,defaultTempC:19,tempRange:[-5,42],life:true,populationBase:1,
    dayHours:18.1,yearDays:219,distanceAU:.92,axialTiltDeg:3,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'N2 / O2 / H2O',weather:'GLOBAL CYCLONES / ELECTRICAL STORMS',ring:false,moons:[],
    observation:'A VIOLENT GREEN WATER-WORLD OF ENDLESS CYCLONES, HIGH CLOUD DECKS AND LONELY ISLANDS.',
    scan:{ageBy:4.0,pressureAtm:2.6,pressureText:'2.6 ATM',magField:'STRONG',oxygen:24,nitrogen:72,co2:.06,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:38,lifeTypePotential:'MICROBIAL',techPotential:'NONE',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'ORBITAL CYCLONES / DEEP CURRENT ANOMALIES / JELLYFISH BIOSIGNATURES',lossRisk:false},
    loreReport:'GIANT\'S DEEP IS AN OCEANIC TITAN WRAPPED IN THICK GREEN CLOUD BANDS AND PERPETUAL STORMS. SMALL ISLANDS, CYCLONES AND DEEP ELECTRICAL ANOMALIES MAKE THE PLANET BEAUTIFUL AND EXTREMELY DANGEROUS.',
    lifeLabel:'PRESENT',populationLabel:'NONE',lifeTypeLabel:'MICROBIAL',techLevelLabel:'NONE'
  },
  'DARK BRAMBLE':{
    renderer:'darkbramble',worldType:'ICE',worldClass:'BRAMBLE SEED WORLD',visualRadius:44,radiusKm:6900,gravity:.94,massEarth:.98,density:.95,
    water:.11,cloudCover:.06,cloudSpeed:.04,defaultTempC:-34,tempRange:[-120,25],life:true,populationBase:0,
    dayHours:31,yearDays:297,distanceAU:1.26,axialTiltDeg:8,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'CH4 / N2 / CRYOGENIC FOG',weather:'ICE FOG',ring:false,moons:[],
    observation:'AN IMPOSSIBLE FROZEN BRAMBLE WORLD FILLED WITH THORNY GROWTH, INTERIOR FOG AND FRAGMENTED ICE.',
    scan:{ageBy:3.9,pressureAtm:.26,pressureText:'0.26 ATM',magField:'CHAOTIC',oxygen:0,nitrogen:48,co2:1.2,tectonics:'CHAOTIC',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'HOSTILE',techPotential:'NONE',iron:'TRACE',carbon:'RICH',uranium:'TRACE',anomaly:'NON-EUCLIDEAN INTERIOR / ANGLERFISH BIOSIGNATURES / SEED EXPANSION',lossRisk:false},
    loreReport:'DARK BRAMBLE IS A NIGHTMARISH THORN-CHOKED WORLD MADE OF TANGLED SEED-SPACE, ICY HUSKS AND FOG-FILLED POCKETS LARGER ON THE INSIDE THAN ON THE OUTSIDE. HOSTILE LIFE SIGNATURES HAVE BEEN DETECTED.',
    lifeLabel:'HOSTILE',populationLabel:'NONE',lifeTypeLabel:'HOSTILE',techLevelLabel:'NONE'
  },
  INTERLOPER:{
    renderer:'interloper',worldType:'ICE',worldClass:'ERRATIC COMET',visualRadius:27,radiusKm:1250,gravity:.09,massEarth:.005,density:.39,
    water:.34,cloudCover:0,cloudSpeed:0,defaultTempC:-118,tempRange:[-210,20],life:false,populationBase:0,
    dayHours:61,yearDays:642,distanceAU:2.8,axialTiltDeg:17,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A BLUE-WHITE COMET OF VOLATILES, ICE AND A DEADLY HIDDEN CORE ON A HIGHLY ECCENTRIC ORBIT.',
    scan:{ageBy:0.2,pressureAtm:0,pressureText:'VACUUM',magField:'NONE',oxygen:0,nitrogen:0,co2:0,tectonics:'LOW',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'NONE',iron:'TRACE',carbon:'COMMON',uranium:'TRACE',anomaly:'GHOST MATTER CORE / EXTREME ECCENTRIC ORBIT',lossRisk:false},
    loreReport:'THE INTERLOPER IS A FAST, ICY COMET WHOSE DECEPTIVELY PRETTY SHELL HIDES A LETHAL INTERIOR GHOST-MATTER CORE. IT SWEEPS CLOSE TO THE SUN AND THEN VANISHES BACK INTO THE OUTER DARK.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'NONE'
  },
  'QUANTUM MOON':{
    renderer:'quantummoon',worldType:'BARREN',worldClass:'QUANTUM SATELLITE',visualRadius:28,radiusKm:1300,gravity:.11,massEarth:.007,density:.42,
    water:.12,cloudCover:.92,cloudSpeed:.045,defaultTempC:-38,tempRange:[-150,26],life:false,populationBase:0,
    dayHours:0,yearDays:0,distanceAU:1.1,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'QUANTUM FOG / UNKNOWN',weather:'DENSE QUANTUM FOG',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A SILENT SHIFTING MOON THAT REFUSES TO STAY IN ONE PLACE AND SEEMS TO ECHO THE WORLDS IT VISITS.',
    scan:{ageBy:4.5,pressureAtm:.01,pressureText:'TRACE',magField:'UNKNOWN',oxygen:0,nitrogen:1,co2:0,tectonics:'UNKNOWN',volcanism:'UNKNOWN',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'ANCIENT PILGRIMAGE SITE',iron:'UNKNOWN',carbon:'UNKNOWN',uranium:'UNKNOWN',anomaly:'MACROSCOPIC QUANTUM BEHAVIOR / SIX LOCATIONS',lossRisk:false},
    loreReport:'THE QUANTUM MOON ORBITS DIFFERENT PLANETS DEPENDING ON WHO IS OBSERVING IT. ITS SURFACE SEEMS TO BORROW TRAITS FROM NEARBY WORLDS, AND AN ANCIENT PILGRIMAGE TRAIL STILL REMAINS.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'ANCIENT PILGRIMAGE SITE'
  },
  'EYE OF THE UNIVERSE':{
    renderer:'eyeuniverse',worldType:'BARREN',worldClass:'ANCIENT QUANTUM WORLD',visualRadius:31,radiusKm:1650,gravity:.12,massEarth:.008,density:.43,
    water:.07,cloudCover:.03,cloudSpeed:.02,defaultTempC:-92,tempRange:[-210,18],life:false,populationBase:0,
    dayHours:0,yearDays:0,distanceAU:8.8,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'TRACE',atmosChemistry:'TRACE / UNKNOWN',weather:'QUANTUM STATIC',ring:false,moons:[],disableAutoCivilization:true,
    observation:'THE ELUSIVE SIGNAL SOURCE: A PALE ANCIENT WORLD OF IMPOSSIBLE QUANTUM PROPERTIES SITTING FAR BEYOND THE MAIN SYSTEM.',
    scan:{ageBy:13.8,pressureAtm:.01,pressureText:'TRACE',magField:'ANOMALOUS',oxygen:0,nitrogen:0,co2:0,tectonics:'UNKNOWN',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'COSMOLOGICAL ARTIFACT',iron:'UNKNOWN',carbon:'UNKNOWN',uranium:'UNKNOWN',anomaly:'PRIMARY SIGNAL SOURCE / EXTREME QUANTUM INSTABILITY / OBSERVER EFFECTS',lossRisk:false},
    loreReport:'THE EYE OF THE UNIVERSE APPEARS LESS LIKE AN ORDINARY PLANET AND MORE LIKE AN ANCIENT COSMIC NODE. ITS PALE CRUST, EERIE SURFACE PATTERNS AND IMPOSSIBLE SIGNALS SUGGEST A CELESTIAL OBJECT TIED TO QUANTUM PHENOMENA ON A SYSTEM-WIDE SCALE.',
    lifeLabel:'NONE',populationLabel:'NONE',lifeTypeLabel:'NONE',techLevelLabel:'COSMOLOGICAL ARTIFACT'
  },
  'THE STRANGER':{
    shape:'haloRing',renderer:'stranger',worldType:'VERDANT',worldClass:'GENERATIONAL ARK / RING HABITAT',visualRadius:60,radiusKm:7800,gravity:.83,massEarth:1.18,density:.31,
    water:.41,cloudCover:.10,cloudSpeed:.03,defaultTempC:14,tempRange:[-32,36],life:false,populationBase:0,
    dayHours:26,yearDays:420,distanceAU:1.55,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'SEALED ARTIFICIAL INTERIOR',ring:false,moons:[],disableAutoCivilization:true,
    haloBandWidth:19,haloFlatten:.24,haloScreenAngle:-.06,haloStyle:'stranger',haloStatus:'INTACT',
    observation:'A TITANIC HIDDEN RINGWORLD SHIP WHOSE INNER SURFACE HOLDS FORESTS, RIVERS AND RESERVOIRS UNDER AN ENGINEERED SKY.',
    scan:{ageBy:0.28,pressureAtm:0,pressureText:'SEALED INTERIOR',magField:'ARTIFICIAL',oxygen:0,nitrogen:0,co2:0,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'INTERSTELLAR ARK',iron:'ABUNDANT',carbon:'COMMON',uranium:'TRACE',anomaly:'ROTATING MEGAHABITAT / CLOAKED GENERATIONAL VESSEL / ARTIFICIAL SUNLINE',lossRisk:false},
    loreReport:'THE STRANGER IS NOT A NATURAL WORLD BUT A COLOSSAL RING HABITAT HIDDEN INSIDE AN INTERSTELLAR VESSEL. ITS INNER SURFACE CARRIES GREEN LOWLANDS, ARTIFICIAL WATERWAYS, DAMMED RESERVOIRS AND MASSIVE ENGINEERED WALLS BUILT TO SUSTAIN AN ENTIRE CIVILIZATION.',
    lifeLabel:'NONE',populationLabel:'ABANDONED',lifeTypeLabel:'NONE',techLevelLabel:'INTERSTELLAR ARK'
  },

  'WENKWORT ARTEM':stellarisGaiaPreset({style:'wenkwort',worldClass:'CURATED GAIA WORLD',radiusKm:7200,gravity:1.08,water:.61,cloud:.46,temp:20,population:1,tech:'NONE',anomaly:'ANCIENT GARDENER DRONES / CURATED ECOSYSTEM',observation:'AN UNNATURALLY PERFECT GAIA WORLD WHOSE FORESTS, FLOWER FIELDS AND WATERWAYS SHOW SIGNS OF ANCIENT MACHINE CURATION.',loreReport:'WENKWORT ARTEM IS A PLANET-SCALE GARDEN. CARETAKER MACHINES QUIETLY MAINTAIN ITS ECOLOGICAL BALANCE, PRUNING FORESTS AND PROTECTING A BIOSPHERE THAT LOOKS TOO PERFECT TO BE NATURAL.'}),
  ZANAAM:stellarisGaiaPreset({style:'zanaam',worldClass:'GUARDED GAIA WORLD',radiusKm:7600,gravity:1.12,water:.49,cloud:.35,temp:23,population:0,tech:'ANCIENT',anomaly:'ANCIENT OBELISK / GUARDIAN SIGNATURES',observation:'A LARGE GAIA WORLD DOMINATED BY A GREEN VALLEY SYSTEM AND A MONUMENTAL ALIEN OBELISK VISIBLE FROM ORBIT.',loreReport:'ZANAAM IS A PRISTINE GAIA WORLD WHOSE CENTRAL VALLEYS SURROUND AN ENORMOUS ANCIENT STRUCTURE. THE PLANET FEELS LESS ABANDONED THAN WATCHED.'}),
  PARIDAYDA:stellarisGaiaPreset({style:'paridayda',worldClass:'ISOLATED GAIA WORLD',radiusKm:7900,gravity:1.09,water:.58,cloud:.42,temp:24,population:3,tech:'PRE-FTL',anomaly:'ISOLATED PRIMITIVE CIVILIZATION / ANCIENT TRAUMA',observation:'A VAST, BEAUTIFUL GAIA WORLD HIDING A SMALL PRE-FTL CIVILIZATION BENEATH OTHERWISE UNTOUCHED CONTINENTS.',loreReport:'PARIDAYDA LOOKS LIKE A PARADISE FROM ORBIT, BUT ITS SMALL SOCIETY LIVES AMONG THE SHADOWS OF A VIOLENT ANCIENT HISTORY. MOST OF THE PLANET REMAINS WILDERNESS.'}),
  'THE VEIL':{
    renderer:'veil',worldType:'VERDANT',worldClass:'PHASE-SHIFTING GAIA WORLD',visualRadius:44,radiusKm:7000,gravity:1.03,massEarth:1.22,density:1.0,
    water:.46,cloudCover:.54,cloudSpeed:.17,defaultTempC:18,tempRange:[-35,50],life:true,populationBase:0,dayHours:25,yearDays:390,distanceAU:1.2,axialTiltDeg:9,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2 / SHROUD PARTICULATES',weather:'PHASE FOG / QUIET RAIN',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A GAIA WORLD THAT PERIODICALLY SLIPS INTO A DARK SHROUDED STATE, ITS GREEN CONTINENTS DISSOLVING BENEATH VIOLET QUANTUM HAZE.',
    scan:{ageBy:5.0,pressureAtm:1.0,pressureText:'1.00 ATM / UNSTABLE',magField:'FLUCTUATING',oxygen:20.8,nitrogen:77.4,co2:.08,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:5.2,lifeTypePotential:'COMPLEX',techPotential:'NONE',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'PERIODIC GAIA / SHROUDED PHASE TRANSITION',lossRisk:false},
    loreReport:'THE VEIL REFUSES TO REMAIN IN ONE PHYSICAL STATE. AT TIMES IT IS A LUSH GAIA WORLD; AT OTHERS ITS SURFACE IS SWALLOWED BY A DARK PURPLE SHROUD, LEAVING ONLY GHOSTLY GEOGRAPHY VISIBLE.',lifeLabel:'ABUNDANT',populationLabel:'NONE',lifeTypeLabel:'COMPLEX',techLevelLabel:'NONE'
  },
  "PROPHET'S RETREAT":stellarisGaiaPreset({style:'holy',worldClass:'SACRED GAIA WORLD',radiusKm:7350,gravity:1.08,water:.52,cloud:.38,temp:22,population:0,tech:'FALLEN EMPIRE',anomaly:'HOLY WORLD / FALLEN EMPIRE CLAIM',observation:'A LUMINOUS SACRED GAIA WORLD OF DEEP FORESTS, CRYSTAL SEAS AND ANCIENT TEMPLE-LIKE COMPLEXES.',loreReport:'PROPHET\'S RETREAT IS TREATED AS SACRED GROUND BY AN ANCIENT SPIRITUALIST POWER. ITS SURFACE IS LEFT ALMOST UNTOUCHED EXCEPT FOR OLD SHRINES AND MONUMENTS.'}),
  'WALLED GARDEN':stellarisGaiaPreset({style:'walled',worldClass:'SACRED GAIA WORLD',radiusKm:6900,gravity:1.01,water:.44,cloud:.34,temp:20,population:0,tech:'FALLEN EMPIRE',anomaly:'HOLY WORLD / ORDERED PLANETARY GARDEN',observation:'A SACRED GAIA WORLD WHOSE CONTINENTS APPEAR STRANGELY ORDERED, DIVIDED BY LONG NATURAL-LOOKING GREEN BELTS AND ANCIENT BOUNDARIES.',loreReport:'WALLED GARDEN IS A PRESERVED HOLY WORLD. ITS ECOLOGY IS LUSH BUT CURIOUSLY ORDERED, AS IF AN ENTIRE PLANET WERE LANDSCAPED AND THEN SEALED AWAY.'}),
  'EMERALD MAUSOLEUM':stellarisGaiaPreset({style:'mausoleum',worldClass:'SACRED MEMORIAL WORLD',radiusKm:7050,gravity:1.05,water:.48,cloud:.41,temp:19,population:0,tech:'FALLEN EMPIRE',anomaly:'PLANETARY MAUSOLEUM / HOLY WORLD',observation:'A DARKER EMERALD GAIA WORLD WHERE HUGE MONUMENTAL COMPLEXES BREAK THROUGH THE FORESTS LIKE TOMBS.',loreReport:'EMERALD MAUSOLEUM IS BOTH PARADISE AND MEMORIAL. ANCIENT STRUCTURES SIT AMONG DEEP GREEN FORESTS, THEIR PURPOSE MORE FUNERARY THAN HABITABLE.'}),
  'PRISTINE JEWEL':stellarisGaiaPreset({style:'jewel',worldClass:'PRISTINE GAIA WORLD',radiusKm:6100,gravity:.94,water:.66,cloud:.29,temp:24,population:0,tech:'FALLEN EMPIRE',anomaly:'IMMUTABLE HOLY BIOSPHERE',observation:'A SMALL BRILLIANT GAIA WORLD WITH TURQUOISE OCEANS, BRIGHT FORESTS AND ALMOST NO VISIBLE GEOLOGICAL SCARRING.',loreReport:'PRISTINE JEWEL LIVES UP TO ITS NAME: A COMPACT, IMMACULATE GAIA WORLD PRESERVED WITH RELIGIOUS FERVOR BY AN ANCIENT POWER.'}),
  KIRA:{
    renderer:'kira',worldType:'VOLCANIC',worldClass:'INFERNAL OASIS WORLD',visualRadius:42,radiusKm:6500,gravity:1.04,massEarth:1.08,density:1.05,
    water:.08,cloudCover:.28,cloudSpeed:.11,defaultTempC:72,tempRange:[15,160],life:true,populationBase:1,dayHours:31,yearDays:470,distanceAU:.73,axialTiltDeg:12,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'CO2 / SO2 / N2',weather:'ASH STORMS / HOT RAIN',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A HOSTILE VOLCANIC WORLD OF BASALT AND LAVA BROKEN BY ONE IMPOSSIBLE GREEN OASIS REGION.',
    scan:{ageBy:4.3,pressureAtm:2.2,pressureText:'2.20 ATM',magField:'STRONG',oxygen:4,nitrogen:35,co2:52,tectonics:'ACTIVE',volcanism:'HIGH',oceanDepthKm:.4,lifeTypePotential:'LOCALIZED',techPotential:'NONE',iron:'RICH',carbon:'COMMON',uranium:'COMMON',anomaly:'INFERNAL OASIS / LOCAL HABITABLE MICROCLIMATE',lossRisk:false},
    loreReport:'KIRA IS ALMOST ENTIRELY INFERNAL: BLACK ROCK, LAVA PLAINS AND VOLCANIC HAZE. ONE GREEN REGION DEFIES THE REST OF THE PLANET, SUPPORTING WATER AND LIFE IN AN OTHERWISE HOSTILE WORLD.',lifeLabel:'LOCALIZED',populationLabel:'TRACE',lifeTypeLabel:'LOCALIZED',techLevelLabel:'NONE'
  },
  SANCTUARY:{
    shape:'haloRing',renderer:'halo',worldType:'VERDANT',worldClass:'ANCIENT PRESERVE RINGWORLD',visualRadius:64,radiusKm:6200,gravity:1.0,massEarth:.04,density:.02,
    water:.48,cloudCover:.30,cloudSpeed:.10,defaultTempC:19,tempRange:[-18,38],life:true,populationBase:6,dayHours:18,yearDays:410,distanceAU:1.0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'CONTROLLED WEATHER',ring:false,moons:[],disableAutoCivilization:true,
    haloBandWidth:17,haloFlatten:.27,haloScreenAngle:-.12,haloStyle:'sanctuary',haloStatus:'ANCIENT PRESERVE ACTIVE',
    observation:'AN ANCIENT RINGWORLD BUILT AS A NATURE PRESERVE, ITS HABITABLE SECTIONS HOLDING SEVERAL ISOLATED DEVELOPING CIVILIZATIONS.',
    scan:{ageBy:2.0,pressureAtm:1.0,pressureText:'CONTROLLED',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.04,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:3.4,lifeTypePotential:'INTELLIGENT',techPotential:'MULTIPLE PRE-FTL',iron:'ABUNDANT',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'ANCIENT PRESERVE / MULTIPLE ISOLATED CIVILIZATIONS',lossRisk:false},
    loreReport:'SANCTUARY IS A HABITABLE RINGWORLD DIVIDED INTO PRESERVE SECTORS. EACH SECTION SUPPORTS ITS OWN BIOSPHERE AND DEVELOPING SOCIETY WHILE ANCIENT AUTOMATION WATCHES FROM BELOW.',lifeLabel:'ABUNDANT',populationLabel:'MANY',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'MULTIPLE PRE-FTL'
  },
  'SPORE EARTH':sporeHiddenPreset({renderer:'sporeearth',worldClass:'SPORE T1 HOMEWORLD',tScore:'T1',theme:'earth',radiusKm:6371,gravity:1,water:.64,cloud:.31,temp:15,life:true,population:3,weather:'SHOWERS / THIN ECOSYSTEM',tech:'SPACE AGE',anomaly:'SPORE TERRAFORMING INDEX / T1 ECOSYSTEM',observation:'A FAMILIAR EARTH RECAST THROUGH THE SPORE TERRAFORMING SYSTEM: BLUE WATER, GREEN LAND AND A LIMITED T1 ECOSYSTEM.',loreReport:'THIS VERSION OF EARTH BELONGS TO SPORE\'S GALAXY. ITS CONTINENTS ARE FAMILIAR, BUT THE WORLD IS READ THROUGH A T-SCORE ECOSYSTEM MODEL RATHER THAN THE SOLAR-SYSTEM PROFILE.'}),
  'GROX HOMEWORLD':{
    renderer:'grox',sporeTScore:'T0',sporeTheme:'grox',worldType:'TOXIC',worldClass:'GROX MACHINE HOMEWORLD',visualRadius:43,radiusKm:6100,gravity:1.06,massEarth:1.05,density:1.09,
    water:0,cloudCover:.46,cloudSpeed:.08,defaultTempC:64,tempRange:[-20,130],life:false,populationBase:8,dayHours:19.4,yearDays:221,distanceAU:.18,axialTiltDeg:5,rotationDirection:1,
    atmosDensity:'DENSE',atmosChemistry:'CO2 / INDUSTRIAL TOXINS',weather:'TOXIC SMOG / ASH',ring:false,moons:[],disableAutoCivilization:true,
    observation:'THE HARD-CODED GROX CAPITAL WORLD: A T0 INDUSTRIAL MACHINE PLANET OF BLACK CRUST, RED CITY LIGHTS AND CYBERNETIC FORTRESSES NEAR THE GALACTIC CORE.',
    scan:{ageBy:4.6,pressureAtm:2.8,pressureText:'2.80 ATM',magField:'ARTIFICIAL / STRONG',oxygen:0,nitrogen:8,co2:67,tectonics:'CONTAINED',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'GALACTIC EMPIRE',iron:'ABUNDANT',carbon:'COMMON',uranium:'ABUNDANT',anomaly:'GROX CORE WORLD / CYBERNETIC PLANETARY FORTRESS',lossRisk:false},
    loreReport:'THE GROX HOMEWORLD IS DELIBERATELY HOSTILE TO ORGANIC LIFE. CITIES, FACTORIES AND DEFENSE NODES COVER A T0 SURFACE BENEATH TOXIC SKIES, WHILE MACHINE INFRASTRUCTURE EXTENDS DEEP BELOW THE CRUST.',lifeLabel:'NONE',populationLabel:'MASSIVE',lifeTypeLabel:'NONE',techLevelLabel:'GALACTIC EMPIRE'
  },
  MYLIFF:sporeHiddenPreset({renderer:'myliff',worldClass:'LIVING SPORE WORLD',tScore:'T3',theme:'organic',radiusKm:5900,gravity:.88,water:.47,cloud:.44,temp:26,life:true,population:4,weather:'WARM RAIN / BIOLOGICAL MISTS',tech:'TRIBAL / MYSTIC',anomaly:'PLANETARY PATRIARCH BIOSIGNATURE',observation:'A STRANGE T3 LIVING WORLD WHOSE ORGANIC PATTERNS APPEAR TIED TO A SINGULAR PLANETARY PATRIARCH.',loreReport:'MYLIFF IS LESS A NORMAL PLANET THAN A LIVING STORYBOOK WORLD. ITS BIOSPHERE FORMS LARGE ORGANIC PATTERNS AND RESPONDS TO THE FATE OF ITS PATRIARCH.'}),
  'OINKER-7':sporeHiddenPreset({renderer:'sporecity',worldClass:'COLORFUL CIVILIZATION WORLD',tScore:'T3',theme:'oinker',radiusKm:6000,gravity:.92,water:.35,cloud:.27,temp:28,life:true,population:7,weather:'WARM SHOWERS',tech:'SPACE AGE',anomaly:'CEREMONIAL MEGACITY / FESTIVAL TRAFFIC',observation:'A BRIGHTLY COLORED T3 CIVILIZATION WORLD PACKED WITH WHIMSICAL CITIES, CEREMONIAL STRUCTURES AND HEAVY LOCAL TRAFFIC.',loreReport:'OINKER-7 IS LOUD, COLORFUL AND VERY MUCH INHABITED. URBAN CENTERS SPREAD ACROSS ITS CONTINENTS IN THE EXAGGERATED ARCHITECTURAL STYLE OF A SPORE SPACE CIVILIZATION.'}),
  'ADVENTURE TOWN':sporeHiddenPreset({renderer:'sporecity',worldClass:'ADVENTURE RESORT WORLD',tScore:'T3',theme:'adventure',radiusKm:5600,gravity:.82,water:.28,cloud:.23,temp:25,life:true,population:6,weather:'CLEAR / LIGHT SHOWERS',tech:'SPACE AGE',anomaly:'DENSE ADVENTURE PROP / CITY SIGNATURES',observation:'A WHIMSICAL T3 WORLD WHERE A DENSE, COLORFUL SETTLEMENT COVERS THE MAIN CONTINENT LIKE A PLANET-SIZED THEME PARK.',loreReport:'ADVENTURE TOWN IS A SHOWCASE WORLD OF BRIGHT BUILDINGS, ROADS, DECORATIONS AND PECULIAR CIVILIANS. FROM ORBIT IT LOOKS MORE DESIGNED THAN GEOLOGICAL.'}),
  'RUINS OF DOOM':sporeHiddenPreset({renderer:'sporeruins',worldClass:'JUNGLE RUIN WORLD',tScore:'T2',theme:'ruins',radiusKm:6200,gravity:.96,water:.38,cloud:.58,temp:31,life:true,population:1,weather:'JUNGLE STORMS / MIST',tech:'ANCIENT RUINS',anomaly:'GOLDEN LLAMA / ANCIENT TEMPLE COMPLEX',observation:'A HUMID T2 JUNGLE WORLD WHERE MASSIVE TEMPLE RUINS EMERGE FROM THE FOREST CANOPY.',loreReport:'RUINS OF DOOM IS A DANGEROUS JUNGLE PLANET FILLED WITH OLD STONE COMPLEXES, HOSTILE CREATURES AND A LEGENDARY GOLDEN ARTIFACT.'}),
  INFESTATION:sporeHiddenPreset({renderer:'infestation',worldClass:'BIO-INFESTED WORLD',tScore:'T2',theme:'infested',radiusKm:6400,gravity:.98,water:.42,cloud:.52,temp:33,life:true,population:2,weather:'TOXIC SPORES / RAIN',tech:'COLLAPSING COLONY',anomaly:'PLANET-WIDE AGGRESSIVE INFESTATION',observation:'A ONCE-PEACEFUL T2 WORLD BEING CONSUMED BY A RAPIDLY SPREADING ALIEN BIOLOGICAL INFESTATION.',loreReport:'THE INFESTATION HAS TURNED WHOLE REGIONS INTO PURPLE-RED ORGANIC TERRAIN. SURVIVING GREEN LAND SHRINKS AROUND COLONIES WHILE THE INVASIVE BIOSPHERE ADVANCES.'}),
  'IT CAME FROM THE SKY':sporeHiddenPreset({renderer:'sporeice',worldType:'ICE',worldClass:'FROZEN RESEARCH WORLD',tScore:'T1',theme:'crash',radiusKm:5700,gravity:.84,water:.31,cloud:.36,temp:-42,life:true,population:2,atmos:'THIN',chem:'N2 / O2',weather:'SNOW / ICE FOG',tech:'RESEARCH OUTPOST',anomaly:'CRASHED ALIEN VESSEL / SECRET RESEARCH BASE',observation:'A FROZEN T1 WORLD WITH A DARK CRASH SCAR AND A SMALL RESEARCH COMPLEX VISIBLE AGAINST THE ICE.',loreReport:'BENEATH THE SNOW OF THIS REMOTE WORLD SITS A SECRET RESEARCH FACILITY BUILT AROUND A CRASHED ALIEN OBJECT. THE REST OF THE PLANET IS QUIET ICE.'}),
  'TX-5000':sporeHiddenPreset({renderer:'tx5000',worldType:'BARREN',worldClass:'SUPERWEAPON RESEARCH WORLD',tScore:'T0',theme:'industrial',radiusKm:6300,gravity:1.03,water:.01,cloud:.22,temp:46,life:false,population:6,atmos:'THIN',chem:'CO2 / INDUSTRIAL GAS',weather:'SMOG / STATIC',tech:'SPACE AGE',anomaly:'PLANETARY SUPERWEAPON COMPLEX / REACTOR GRID',observation:'A T0 INDUSTRIAL RESEARCH WORLD DOMINATED BY A GIGANTIC SUPERWEAPON COMPLEX, REACTORS AND POWER CONDUITS.',loreReport:'TX-5000 IS ALMOST ENTIRELY MACHINE TERRAIN. RESEARCH DOMES, REACTORS AND A HUGE WEAPON INSTALLATION ARE CONNECTED BY BRIGHT POWER LINES ACROSS A DEAD SURFACE.'}),
  DANCETOPIA:sporeHiddenPreset({renderer:'sporecity',worldClass:'GALACTIC RESORT WORLD',tScore:'T3',theme:'dance',radiusKm:6000,gravity:.90,water:.41,cloud:.20,temp:29,life:true,population:8,weather:'CLEAR / PARTY HAZE',tech:'SPACE AGE',anomaly:'PLANET-WIDE ENTERTAINMENT GRID / NIGHT LIGHTS',observation:'AN ABSURDLY COLORFUL T3 RESORT WORLD WHOSE CITIES, LIGHTS AND ENTERTAINMENT DISTRICTS ARE VISIBLE FROM ORBIT.',loreReport:'DANCETOPIA IS A GALACTIC PARTY PLANET. COLORED CITY GRIDS, RESORT DISTRICTS AND CONSTANT ARTIFICIAL LIGHT TURN THE NIGHT SIDE INTO A NEON PATCHWORK.'}),
  'BERNAL SPHERE':{
    renderer:'bernalsphere',worldType:'ARTIFICIAL',worldClass:'CUTAWAY BERNAL SPHERE',visualRadius:42,radiusKm:900,gravity:.98,massEarth:.0012,density:.01,
    water:.32,cloudCover:0,cloudSpeed:0,defaultTempC:21,tempRange:[18,27],life:true,populationBase:7,dayHours:24,yearDays:365,distanceAU:1.0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'SEALED',atmosChemistry:'N2 / O2',weather:'CONTROLLED INTERIOR WEATHER',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A METALLIC BERNAL SPHERE WITH A MASSIVE CUTAWAY APERTURE THAT EXPOSES ITS ARTIFICIAL INTERIOR LANDSCAPE.',
    scan:{ageBy:.03,pressureAtm:1.0,pressureText:'SEALED 1.00 ATM',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.04,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:1.4,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'ABUNDANT',carbon:'COMMON',uranium:'COMMON',anomaly:'CUTAWAY SPHERE / INTERIOR BIOSPHERE',lossRisk:false},
    loreReport:'THIS BERNAL SPHERE PRESENTS AS A SMALL METAL PLANET UNTIL ITS ENORMOUS OPENING REVEALS FARMLANDS, WATERWAYS AND STRUCTURAL TERRACES INSIDE THE HULL.',
    lifeLabel:'ABUNDANT',populationLabel:'MANY',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'INTERSTELLAR'
  },
  'RINGWORLD PRIME':{
    renderer:'ringworldprime',worldType:'VERDANT',worldClass:'PLANET WITH ORBITAL RINGWORLD',visualRadius:44,radiusKm:7200,gravity:1.01,massEarth:1.08,density:1.0,
    water:.52,cloudCover:.18,cloudSpeed:.05,defaultTempC:17,tempRange:[-10,34],life:true,populationBase:7,dayHours:26,yearDays:402,distanceAU:1.1,axialTiltDeg:9,rotationDirection:1,
    atmosDensity:'NORMAL',atmosChemistry:'N2 / O2',weather:'MILD / MANAGED',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A TERRAFORMED WORLD ENCASED BY A SPINNING ARTIFICIAL RINGWORLD, WITH A SMALLER RING-HABITAT SATELLITE ORBITING NEARBY.',
    scan:{ageBy:1.8,pressureAtm:1.06,pressureText:'1.06 ATM',magField:'MODERATE',oxygen:22,nitrogen:76,co2:.04,tectonics:'LOW',volcanism:'NONE',oceanDepthKm:5.9,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'COMMON',carbon:'ABUNDANT',uranium:'TRACE',anomaly:'ORBITAL RINGWORLD / MINI-RING SATELLITE',lossRisk:false},
    loreReport:"THE PRIMARY PLANET IS NATURAL, BUT THE CIVILIZATION AROUND IT ISN'T. A HABITABLE RINGWORLD WRAPS THE WORLD IN A BRIGHT ARTIFICIAL BAND, AND A SMALLER RING-HABITAT HAS REPLACED THE ROLE OF A CONVENTIONAL MOON.",
    lifeLabel:'ABUNDANT',populationLabel:'HIGH',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'INTERSTELLAR'
  },
  'DOMEWORLD':{
    renderer:'domeworld',worldType:'BARREN',worldClass:'MEGADOME COLONY WORLD',visualRadius:43,radiusKm:6700,gravity:.91,massEarth:.84,density:.95,
    water:.04,cloudCover:.05,cloudSpeed:.02,defaultTempC:8,tempRange:[-25,42],life:true,populationBase:6,dayHours:29,yearDays:388,distanceAU:1.6,axialTiltDeg:7,rotationDirection:1,
    atmosDensity:'THIN',atmosChemistry:'CO2 / TRACE N2',weather:'DUST / LOCAL CLIMATE CONTROL',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A ROCKY COLONY WORLD WHERE ENORMOUS GLASS DOMES PROTECT GREEN OASES AND DENSE MEGACITY COMPLEXES.',
    scan:{ageBy:3.1,pressureAtm:.34,pressureText:'0.34 ATM',magField:'WEAK',oxygen:5,nitrogen:12,co2:73,tectonics:'LOW',volcanism:'LOW',oceanDepthKm:0,lifeTypePotential:'ENGINEERED BIOSPHERES',techPotential:'INTERPLANETARY',iron:'ABUNDANT',carbon:'COMMON',uranium:'COMMON',anomaly:'GLASS MEGADOMES / OASIS CITIES',lossRisk:false},
    loreReport:'MOST OF THIS WORLD REMAINS BARE ROCK, BUT ITS INHABITANTS HAVE COVERED THE BEST BASINS WITH TRANSPARENT ARCLOGIES WHERE GREENERY, RESERVOIRS AND TOWERING CITIES SURVIVE BENEATH CLIMATE-CONTROLLED DOMES.',
    lifeLabel:'LOCALIZED',populationLabel:'HIGH',lifeTypeLabel:'ENGINEERED',techLevelLabel:'INTERPLANETARY'
  },
  'VON BRAUN WHEEL':{
    renderer:'wheelstation',worldType:'ARTIFICIAL',worldClass:'VON BRAUN WHEEL STATION',visualRadius:41,radiusKm:140,gravity:.42,massEarth:.0003,density:.01,
    water:.04,cloudCover:0,cloudSpeed:0,defaultTempC:20,tempRange:[16,29],life:true,populationBase:5,dayHours:24,yearDays:365,distanceAU:1.0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'SEALED',atmosChemistry:'N2 / O2',weather:'CONTROLLED',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A CLASSIC TOROIDAL SPACE STATION WITH A CENTRAL HUB, SPOKES AND A SPINNING HABITAT RIM.',
    scan:{ageBy:.01,pressureAtm:1.0,pressureText:'SEALED 1.00 ATM',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.05,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:.1,lifeTypePotential:'INTELLIGENT',techPotential:'INTERPLANETARY',iron:'ABUNDANT',carbon:'COMMON',uranium:'COMMON',anomaly:'ROTATING TORUS STATION / AXIAL HUB',lossRisk:false},
    loreReport:'THE VON BRAUN WHEEL IS A STRAIGHT-UP CLASSIC: A ROTATING WHEEL WITH PRESSURIZED RIM HABITATS AND A COMPACT CENTRAL HUB.',
    lifeLabel:'COMMON',populationLabel:'MODERATE',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'INTERPLANETARY'
  },
  'STANFORD TORUS':{
    renderer:'torushab',worldType:'ARTIFICIAL',worldClass:'STANFORD TORUS COMPLEX',visualRadius:43,radiusKm:1100,gravity:.98,massEarth:.0007,density:.01,
    water:.14,cloudCover:0,cloudSpeed:0,defaultTempC:20,tempRange:[17,28],life:true,populationBase:6,dayHours:24,yearDays:365,distanceAU:1.0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'SEALED',atmosChemistry:'N2 / O2',weather:'CONTROLLED',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A LONG-WHEEL HABITAT: A HUGE ROTATING TORUS CONNECTED BY A LONG AXIAL SPINE TO SUPPORT MODULES AND A SECONDARY RING.',
    scan:{ageBy:.02,pressureAtm:1.0,pressureText:'SEALED 1.00 ATM',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.04,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:.4,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'ABUNDANT',carbon:'COMMON',uranium:'COMMON',anomaly:'LONG-AXIS TORUS COMPLEX / SERVICE SPINE',lossRisk:false},
    loreReport:'THIS STANFORD TORUS DESIGN HAS GROWN INTO A LONGER, MORE INDUSTRIAL COMPLEX, WITH THE MAIN WHEEL ATTACHED TO A LONG SERVICE BOOM AND OUTBOARD STRUCTURES.',
    lifeLabel:'ABUNDANT',populationLabel:'MANY',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'INTERSTELLAR'
  },
  "O'NEILL CYLINDER":{
    renderer:'cylinderhab',worldType:'ARTIFICIAL',worldClass:"O'NEILL CYLINDER HABITAT",visualRadius:42,radiusKm:3200,gravity:.96,massEarth:.002,density:.01,
    water:.16,cloudCover:0,cloudSpeed:0,defaultTempC:20,tempRange:[18,28],life:true,populationBase:7,dayHours:24,yearDays:365,distanceAU:1.0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'SEALED',atmosChemistry:'N2 / O2',weather:'CONTROLLED',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A LONG CYLINDRICAL STATION SPINNING ON ITS LONG AXIS, WITH A GIANT WINDOW EXPOSING INTERIOR CONTINENTS AND WATER BANDS.',
    scan:{ageBy:.04,pressureAtm:1.0,pressureText:'SEALED 1.00 ATM',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.04,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:.7,lifeTypePotential:'INTELLIGENT',techPotential:'INTERSTELLAR',iron:'ABUNDANT',carbon:'ABUNDANT',uranium:'COMMON',anomaly:'WINDOWED CYLINDER HABITAT / INTERIOR BIOSPHERE',lossRisk:false},
    loreReport:"THE CYLINDER'S INTERIOR CARRIES LONG LAND STRIPS, RIVERS AND SETTLEMENT BANDS, VISIBLE THROUGH A HUGE LONGITUDINAL VIEWING WINDOW.",
    lifeLabel:'ABUNDANT',populationLabel:'HIGH',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'INTERSTELLAR'
  },
  'BISHOP RING':{
    renderer:'bishopring',worldType:'ARTIFICIAL',worldClass:'BISHOP RING HABITAT',visualRadius:47,radiusKm:18000,gravity:.99,massEarth:.004,density:.003,
    water:.24,cloudCover:0,cloudSpeed:0,defaultTempC:22,tempRange:[17,31],life:true,populationBase:8,dayHours:28,yearDays:410,distanceAU:1.2,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'SEALED',atmosChemistry:'N2 / O2',weather:'CONTROLLED',ring:false,moons:[],disableAutoCivilization:true,
    observation:'A TITANIC OPEN RINGWORLD ENCIRCLING A TINY ARTIFICIAL SUN AT ITS CENTER.',
    scan:{ageBy:.06,pressureAtm:1.0,pressureText:'SEALED 1.00 ATM',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.04,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:1.1,lifeTypePotential:'INTELLIGENT',techPotential:'KARDASHEV I+',iron:'ABUNDANT',carbon:'ABUNDANT',uranium:'COMMON',anomaly:'OPEN RING BIOSPHERE / CENTRAL ARTIFICIAL SUN',lossRisk:false},
    loreReport:'THE BISHOP RING IS A MONSTROUS HABITAT WHOSE LIVING SURFACE FACES INWARD TOWARD A SMALL ENGINEERED SUN HELD AT THE CENTER OF THE STRUCTURE.',
    lifeLabel:'ABUNDANT',populationLabel:'ENORMOUS',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'KARDASHEV I+'
  },
  'SHELLWORLD':{
    renderer:'shellworld',worldType:'ARTIFICIAL',worldClass:'NESTED SHELLWORLD',visualRadius:54,radiusKm:14000,gravity:.92,massEarth:2.1,density:.34,
    water:.20,cloudCover:0,cloudSpeed:0,defaultTempC:18,tempRange:[10,30],life:true,populationBase:7,dayHours:34,yearDays:590,distanceAU:2.1,axialTiltDeg:4,rotationDirection:1,
    atmosDensity:'SEALED LAYERS',atmosChemistry:'N2 / O2',weather:'LAYERED INTERIOR CLIMATES',ring:false,moons:[],disableAutoCivilization:true,
    observation:'AN ARTIFICIAL PLANET OF THREE INDEPENDENTLY ROTATING NESTED SHELLS, EACH VISIBLE THROUGH HEXAGONAL CUTOUTS, WITH A SMALL SUN ORBITING THE STRUCTURE.',
    scan:{ageBy:.09,pressureAtm:1.0,pressureText:'MULTI-LAYER SEALED BIOSPHERES',magField:'ARTIFICIAL',oxygen:21,nitrogen:78,co2:.04,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:1.3,lifeTypePotential:'INTELLIGENT',techPotential:'KARDASHEV I+',iron:'ABUNDANT',carbon:'ABUNDANT',uranium:'ABUNDANT',anomaly:'THREE NESTED WORLD-SHELLS / ORBITING MINI-SUN',lossRisk:false},
    loreReport:'THE SHELLWORLD STACKS THREE INHABITED SHELLS INSIDE ONE ANOTHER. HEXAGONAL APERTURES CUT THROUGH EACH LAYER, EXPOSING THE NEXT ROTATING BIOSPHERE AND THE TINY SUN THAT SERVICES THE SYSTEM.',
    lifeLabel:'ABUNDANT',populationLabel:'ENORMOUS',lifeTypeLabel:'INTELLIGENT',techLevelLabel:'KARDASHEV I+'
  },
  'DYSON SPHERE':{
    renderer:'dyson',worldType:'BARREN',worldClass:'STELLAR MEGASTRUCTURE',visualRadius:55,radiusKm:94500,gravity:.96,massEarth:22.5,density:.07,
    water:0,cloudCover:0,cloudSpeed:0,defaultTempC:230,tempRange:[120,420],life:false,populationBase:0,
    dayHours:36,yearDays:640,distanceAU:1.0,axialTiltDeg:0,rotationDirection:1,
    atmosDensity:'NONE',atmosChemistry:'NONE',weather:'NONE',ring:false,moons:[],disableAutoCivilization:true,
    observation:'AN IMMENSE ARTIFICIAL SHELL OF PANELS, ENERGY CONDUITS AND ACCESS APERTURES BUILT TO CAPTURE THE OUTPUT OF A STAR.',
    scan:{ageBy:.08,pressureAtm:0,pressureText:'SEALED INTERIORS ONLY',magField:'ARTIFICIAL',oxygen:0,nitrogen:0,co2:0,tectonics:'ENGINEERED',volcanism:'NONE',oceanDepthKm:0,lifeTypePotential:'NONE',techPotential:'KARDASHEV II',iron:'ABUNDANT',carbon:'TRACE',uranium:'ABUNDANT',anomaly:'STAR-ENCLOSING POWER HARVEST ARRAY',lossRisk:false},
    loreReport:'THE OBJECT IS NOT A NATURAL PLANET AT ALL BUT A TITANIC ENGINEERED SHELL. ITS EXTERIOR IS A PATCHWORK OF COLLECTOR PLATES, MAINTENANCE SEGMENTS, RADIATOR TOWERS AND GLOWING POWER CHANNELS FEEDING THE CIVILIZATION INSIDE.',
    lifeLabel:'NONE',populationLabel:'UNKNOWN',lifeTypeLabel:'NONE',techLevelLabel:'KARDASHEV II'
  }
};
function lorePresetForName(name){ return LORE_PRESETS[name?.replace(/ /g,'_')] || LORE_PRESETS[name] || null; }
function tempRangeFor(p=planet){ return p?.tempRange || [-78,78]; }
function tempStateFromC(c,p=planet){ const [lo,hi]=tempRangeFor(p); return clamp((c-lo)/(hi-lo),0,1); }
function tempCFromState(v,p=planet){ const [lo,hi]=tempRangeFor(p); return Math.round(lo+clamp(v,0,1)*(hi-lo)); }
function tempStorageKey(p=planet){
  if(p?.solar && p.name==='MARS') return 'planetarium:temp:solar:MARS:v2';
  // Arrakis' range was expanded from [10, 92] C to [-50, 92] C. Temperature
  // persistence stores the normalized slider position, so reusing the old key
  // would reinterpret an old 47 C save as roughly 14 C. Version its key once
  // so existing installs return to the intended 47 C default, while future
  // Arrakis adjustments still persist normally within the expanded range.
  if(p?.name==='ARRAKIS') return 'planetarium:temp:lore:ARRAKIS:v2';
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
  captureMode:null, cameraHold:null, hideCameraCaptureTip:false
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
function proceduralOceanDepthKm(p,r){
  const water=clamp(p?.water||0,0,1);
  if(water<=.03) return 0;

  // Keep ordinary wet terrestrial worlds close to the old behavior. Ocean-class
  // worlds get a separate basin model so a 90%+ water super-Earth can genuinely
  // have tens-of-kilometres-deep global oceans instead of always topping out near 9 km.
  if(p?.worldType!=='OCEAN'){
    const modestSizeScale=clamp(.92+(p?.radiusEarth||1)*.08,.88,1.12);
    return Math.round((.15+water*7.4+r()*2.1)*modestSizeScale*10)/10;
  }

  const radiusEarth=Math.max(.2,p?.radiusEarth||1);
  const gravity=Math.max(.2,p?.gravity||1);
  // Larger worlds can sustain larger ocean basins, while stronger surface gravity
  // slightly suppresses relief/depth. Clamp the factor so procedural extremes stay sane.
  const sizeGravityScale=clamp((.82+.30*radiusEarth)/(.90+.10*gravity),.68,1.50);

  let baseDepth;
  if(water>=.82){
    // DEEP OCEAN WORLD: roughly 15-34 km before size/gravity and natural variation.
    const t=clamp((water-.82)/.12,0,1);
    baseDepth=lerp(15,34,t);
  }else{
    // Regular OCEAN WORLD: roughly 6-15 km before planetary scaling.
    const t=clamp((water-.60)/.22,0,1);
    baseDepth=lerp(6,15,t);
  }

  const naturalVariation=.88+r()*.24;
  return Math.round(baseDepth*sizeGravityScale*naturalVariation*10)/10;
}
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
    oceanDepthKm:proceduralOceanDepthKm(p,r),
    lifeTypePotential:complexity,
    techPotential:tech,
    iron:pick(r,RESOURCE_LEVELS), carbon:pick(r,RESOURCE_LEVELS), uranium:pick(r,RESOURCE_LEVELS),
    anomaly:planetAnomalyFor(p,r),
    lossRisk:r()<.045
  };
}
const PROCEDURAL_MAJOR_DAMAGE_TYPES=['SHATTERED_EDGE','MISSING_HEMISPHERE','EXPLOSION_DAMAGE','BITE'];
const PROCEDURAL_SURFACE_DAMAGE_TYPES=['CRATER','CRATER_FIELD','SURFACE_RIFT'];
function atmosphereImpactExposure(p){
  return ({NONE:1,TRACE:.9,THIN:.72,NORMAL:.42,DENSE:.2,SUPERDENSE:.08})[p?.atmosDensity] ?? .45;
}
function tectonicDamageBias(p){
  return ({DORMANT:0,LOW:.004,ACTIVE:.009,HIGH:.013,EXTREME:.018,CATASTROPHIC:.024})[p?.scan?.tectonics] ?? 0;
}
function configureRarePlanetDamage(p,r){
  if(!p || p.solar || p.special || p.lorePreset || p.shape==='cube' || p.shape==='haloRing') return;
  // Surface damage should stay discoverable, but direct impact scarring should depend
  // strongly on atmospheric shielding. Thin or absent atmospheres are hit much more
  // often, while dense atmospheres mostly burn up incoming debris. Rift networks are
  // handled separately so tectonic planets can still show fractures.
  const impactExposure=atmosphereImpactExposure(p);
  const impactChance=.01+impactExposure*.055;
  const riftChance=.015+tectonicDamageBias(p);
  const surfaceRoll=r();
  let type=null;
  if(surfaceRoll<impactChance){
    type=r()<(.34+impactExposure*.18)?'CRATER_FIELD':'CRATER';
  }else if(surfaceRoll<impactChance+riftChance){
    type='SURFACE_RIFT';
  }
  if(type){
    p.damageProfile={type,angle:r()*Math.PI*2,severity:.42+r()*.34,seed:((p.seed^0x44535452)>>>0)};
    if(p.scan){
      p.scan.anomaly=type==='SURFACE_RIFT'?'PLANETARY RIFT NETWORK':'IMPACT-SCARRED SURFACE';
      if(type!=='SURFACE_RIFT') p.scan.tectonics=p.scan.tectonics==='DORMANT'?'LOW':p.scan.tectonics;
    }
  }
  if(r()>=.015) return;
  const majorType=pick(r,PROCEDURAL_MAJOR_DAMAGE_TYPES);
  p.damageProfile={type:majorType,angle:r()*Math.PI*2,severity:.62+r()*.32,seed:((p.seed^0x44535452)>>>0)};
  p.destroyedProcedural=true;
  p.populationBase=0;
  p.lifeText='NO SURVIVING BIOSPHERE IS DETECTED. THE PLANET HAS SUFFERED CATASTROPHIC STRUCTURAL DAMAGE.';
  p.noLifeText=p.lifeText;
  if(p.scan){
    p.scan.lifeTypePotential='NONE'; p.scan.techPotential='NONE';
    p.scan.anomaly=`CATASTROPHIC PLANETARY DAMAGE / ${majorType.replaceAll('_',' ')}`;
    p.scan.tectonics='CATASTROPHIC'; p.scan.volcanism=majorType==='EXPLOSION_DAMAGE'?'EXTREME':'HIGH';
  }
  p.civilization=null;
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
  const strength=atmosphereStrength(p); p.weatherSystems=[]; p.hurricaneActiveCount=0;
  if(strength<=.08) return;
  const typeBoost=p.worldType==='OCEAN'?2:p.worldType==='TOXIC'?2:p.worldType==='VOLCANIC'?1:p.worldType==='DESERT'?1:0;
  const count=clamp(Math.round(1+strength*5+(p.cloudCover||0)*3+typeBoost),1,10);

  // A world can be hurricane-capable without always having an active hurricane.
  // The old setup made Earth effectively hurricane-active whenever temperature,
  // water and atmosphere conditions were valid, and the first two storm centers
  // were then drawn as hurricanes at the same time.
  const potentialChance=p.worldType==='OCEAN'?.38:p.worldType==='VERDANT'?.24:.14;
  const explicitPotential=p.solar?.hurricanePotential ?? p.lorePreset?.hurricanePotential;
  p.hurricanePotential=!!(explicitPotential ?? (!p.lorePreset && strength>=.58 && p.water>.38 && r()<potentialChance));

  const spawnChance=p.name==='EARTH'?.18:p.worldType==='OCEAN'?.26:p.worldType==='VERDANT'?.16:.10;
  let activeHurricanes=(p.hurricanePotential && r()<spawnChance)?1:0;
  // A second hurricane stays possible only for very wet ocean worlds, and is rare.
  if(activeHurricanes && p.worldType==='OCEAN' && r()<.08) activeHurricanes=2;
  if(p.name==='EARTH') activeHurricanes=Math.min(activeHurricanes,1);
  p.hurricaneActiveCount=activeHurricanes;

  for(let i=0;i<count;i++){
    const sizeBoost=(p.worldType==='OCEAN'||p.worldType==='TOXIC')?2:0;
    p.weatherSystems.push({
      lon:r(),lat:.18+r()*.64,size:3+sizeBoost+Math.floor(r()*7),spin:r()<.5?-1:1,
      speed:(.003+r()*.010)*(r()<.5?-1:1),phase:r()*Math.PI*2,intensity:.35+r()*.65,
      hurricane:i<activeHurricanes
    });
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
  resetPlanetRenderCaches();
  document.title=`${planet.name} - Planetarium`;
  syncUrl();
}
function randomVisit(){ visit(randomPlanetName()); }
planet=generatePlanet(state.name);
normalizeViewModeForPlanet();
state.name=planet.name;
if(Number.isFinite(urlTempC)){ state.temp=tempStateFromC(urlTempC,planet); storageSet(tempStorageKey(planet),String(state.temp)); }
resetPlanetRenderCaches();
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
  return !!p?.hurricanePotential && (p?.hurricaneActiveCount||0)>0 && compatible && strength>=.55 && water>=35 && t>=10 && t<=42;
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
function isScanned(body){
  const key=scanStorageKey(body);
  if(renderCache.scanStatus.has(key)) return renderCache.scanStatus.get(key);
  const scanned=storageGet(key,'0')==='1'; renderCache.scanStatus.set(key,scanned); return scanned;
}
function markScanned(body){
  const key=scanStorageKey(body);
  storageSet(key,'1'); renderCache.scanStatus.set(key,true); invalidateInfoCache();
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
function terrainAtRaw(lon,lat){
  // Fully wrap-safe procedural terrain so special planets do not show a vertical seam.
  const n=(
    periodicNoise01(lon,lat,14,6,planet.terrainSeed)*.56+
    periodicNoise01(lon,lat,28,12,planet.terrainSeed+101)*.29+
    periodicNoise01(lon,lat,56,24,planet.terrainSeed+202)*.15
  );
  const ridge=Math.abs(.5-periodicNoise01(lon+11/24,lat-.09,24,8,planet.terrainSeed^0x51ed))*2;
  return {n, ridge};
}
function ensureTerrainMap(){
  ensurePlanetCacheContext();
  const existing=renderCache.terrain;
  if(existing && existing.seed===planet.terrainSeed) return existing;
  const w=SURFACE_MAP_W,h=SURFACE_MAP_H,n=new Float32Array(w*h),ridge=new Float32Array(w*h);
  for(let y=0;y<h;y++){
    const lat=(y+.5)/h;
    for(let x=0;x<w;x++){
      const q=terrainAtRaw((x+.5)/w,lat),i=y*w+x;
      n[i]=q.n; ridge[i]=q.ridge;
    }
  }
  return renderCache.terrain={seed:planet.terrainSeed,w,h,n,ridge};
}
function terrainAt(lon,lat){
  const map=ensureTerrainMap(),w=map.w,h=map.h;
  const fx=mod(lon,1)*w-.5, fy=clamp(lat,0,1)*(h-1);
  const x0=Math.floor(fx),x1=x0+1,y0=clamp(Math.floor(fy),0,h-1),y1=clamp(y0+1,0,h-1);
  const tx=fx-Math.floor(fx),ty=fy-y0;
  const i00=y0*w+mod(x0,w),i10=y0*w+mod(x1,w),i01=y1*w+mod(x0,w),i11=y1*w+mod(x1,w);
  return {
    n:lerp(lerp(map.n[i00],map.n[i10],tx),lerp(map.n[i01],map.n[i11],tx),ty),
    ridge:lerp(lerp(map.ridge[i00],map.ridge[i10],tx),lerp(map.ridge[i01],map.ridge[i11],tx),ty)
  };
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
    const ocean=periodicNoise01(lon,lat,56,33,planet.terrainSeed^0x544f);
    const basalt=periodicNoise01(lon,lat,27,17,planet.terrainSeed^0x4d415253);
    const dust=periodicNoise01(lon,lat,63,37,planet.terrainSeed^0x44555354);
    const frost=periodicNoise01(lon,lat,84,49,planet.terrainSeed^0x46524f53);
    // Mars keeps visible permanent polar caps around its default climate, with
    // a larger southern cap. As the temperature drops toward the low end, both
    // caps expand substantially instead of staying tiny until extreme values.
    const cold=clamp((-t-20)/120,0,1);
    const northReach=lerp(.048,.145,cold);
    const southReach=lerp(.082,.195,cold);
    const northCap=polarCapAt(lon,lat,northReach,{forceBoth:true,seedSalt:0x4d41524e});
    const southCap=polarCapAt(lon,1-lat,southReach,{forceBoth:true,seedSalt:0x4d415253});
    const polar=northCap.north||southCap.north;
    if(polar && t<18) col=polarIceColor(northCap.north?northCap:southCap);
    else if(stage>=2 && ocean<clamp(.18+stage*.06,0,.34)) col=stage>=3?mixHex(C.blue,C.cyan,.18):C.blue;
    else if(stage>=3 && q.n>.44) col=q.ridge>.79?mixHex(C.brown,C.green,.22):C.green;
    else if(q.ridge>.83) col=mixHex(C.red,C.black,.30);
    else if(basalt>.76) col=mixHex(C.brown,C.purple,.12);
    else if(q.n>.66) col=mixHex(C.red,C.brown,.20);
    else if(q.n<.30 || dust<.16) col=mixHex(C.red,C.black,.14);
    else col=mixHex(C.red,C.yellow,.13);
    if(frost>.90 && t<-92) col=mixHex(col,C.white,.12);
    else if(dust>.82) col=mixHex(col,C.yellow,.12);
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
function damageVisibleInCurrentView(){ return state.viewMode===0 || state.viewMode===1; }
function geometryMissingAt(nx,ny,p=planet){
  if(!p || !damageVisibleInCurrentView()) return false;
  const fixed=planetFixedDamageCoords(nx,ny);
  if(fixed.z<0) return false;
  if(p.renderer==='wikipedia') return wikipediaMissingPiece(fixed.x,fixed.y);
  if(p.renderer==='brittlehollow'){
    const x=fixed.x,y=fixed.y;
    const shellNoise=damageNoise(x*1.8,y*1.9,(p.seed^0x4252484f)>>>0);
    const cavity=((x-.02)/(.27+shellNoise*.025))**2+((y+.00)/(.31+shellNoise*.028))**2;
    const notchUpper=((x-.03)/(.18+shellNoise*.016))**2+((y+.21)/(.10+shellNoise*.014))**2;
    const notchLower=((x+.04)/(.16+shellNoise*.014))**2+((y-.23)/(.12+shellNoise*.014))**2;
    const notchRight=((x+.16)/(.11+shellNoise*.014))**2+((y-.01)/(.16+shellNoise*.016))**2;
    let open=cavity<1||notchUpper<1||notchLower<1||notchRight<1;
    if(open){
      const bridgeA=Math.abs(y+.02)<.030 && x>-.24 && x<.09;
      const bridgeB=Math.abs(y-.16)<.028 && x>-.09 && x<.19;
      const bridgeC=Math.abs(x+.08)<.026 && y>-.20 && y<.07;
      const bridgeNoise=damageNoise(x*5.4,y*5.7,(p.seed^0x42524944)>>>0);
      if((bridgeA||bridgeB||bridgeC) && bridgeNoise>.02) open=false;
    }
    return open;
  }
  const profile=p.damageProfile; if(!profile||profile.type==='NONE'||profile.type==='CRATER'||profile.type==='CRATER_FIELD'||profile.type==='SURFACE_RIFT') return false;
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
  if(!profile||profile.type==='NONE'||profile.type==='CRATER'||profile.type==='CRATER_FIELD'||profile.type==='SURFACE_RIFT') return false;
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
  if(profile?.type==='CRATER_FIELD'){
    const fixed=planetFixedDamageCoords(nx,ny);
    const q=damageSpace(fixed.x,fixed.y,profile),sev=clamp(profile.severity??.62,.2,1);
    const exposure=atmosphereImpactExposure(p);
    const basins=[[-.18,-.16,.10,.085],[.16,.04,.085,.075],[.27,-.20,.115,.090],[-.03,.22,.075,.065]];
    const basinCount=Math.max(1,Math.min(basins.length,1+Math.floor(exposure*3)));
    for(let i=0;i<basinCount;i++){
      const [cx,cy,rx,ry]=basins[i];
      const d=Math.sqrt(((q.x-cx)/(rx+sev*.045))**2+((q.y-cy)/(ry+sev*.045))**2);
      if(d<1){
        if(d<.60) return mixHex(base,C.black,.44);
        return mixHex(base,p.worldType==='ICE'?C.cyan:C.brown,.30);
      }
    }
    // Replace the old high-density pepper pattern with sparse, individually-shaped
    // micro-impacts and short ejecta scars. This reads as tiny crater pits instead
    // of dark dithering, and density falls off when atmosphere is thicker.
    const seed=(profile.seed||p.seed)>>>0;
    const microCount=1+Math.floor(exposure*4);
    const rimColor=p.worldType==='ICE'?mixHex(C.white,C.cyan,.16):mixHex(C.brown,C.white,.10);
    for(let i=0;i<microCount;i++){
      const cx=valueNoise(i*1.73,.31,seed^0x50495458,64)*.74-.37;
      const cy=valueNoise(i*2.11,1.27,seed^0x50495459,64)*.82-.41;
      const radius=.018+valueNoise(i*2.71,2.37,seed^0x50495452,64)*(.012+exposure*.014+sev*.006);
      const skew=.72+valueNoise(i*3.19,3.91,seed^0x50495453,64)*.52;
      const dx=q.x-cx, dy=q.y-cy;
      const d=Math.sqrt((dx/(radius*skew))**2 + (dy/radius)**2);
      if(d<1){
        if(d<.56) return mixHex(base,C.black,.30+.08*exposure);
        return mixHex(base,rimColor,.20);
      }
      const ang=valueNoise(i*4.01,4.83,seed^0x454a4543,64)*Math.PI*2;
      const ax=Math.cos(ang), ay=Math.sin(ang);
      const along=dx*ax+dy*ay;
      const across=Math.abs(-dx*ay+dy*ax);
      const ejectaLen=radius*(1.8+exposure*1.4);
      const ejectaWidth=radius*(.18+exposure*.18);
      if(along>radius*.55 && along<ejectaLen){
        const taper=1-along/ejectaLen;
        if(across<ejectaWidth*Math.max(.18,taper)) return mixHex(base,rimColor,.08+.06*exposure);
      }
    }
  }
  if(profile?.type==='SURFACE_RIFT'){
    const fixed=planetFixedDamageCoords(nx,ny);
    const q=damageSpace(fixed.x,fixed.y,profile),sev=clamp(profile.severity??.62,.2,1);
    const seed=(profile.seed||p.seed)>>>0;
    // Smooth low-frequency wandering gives the main fault a canyon/crack silhouette
    // instead of the old cell-hash stair-step line. Fine noise varies its width.
    const bend=(valueNoise((q.y+1.35)*2.4,.41,seed^0x52494654,64)-.5)*.34
      +Math.sin(q.y*5.2+(seed%997)*.0063)*.035;
    const fine=valueNoise((q.y+1.7)*7.2,1.13,seed^0x46494e45,64)-.5;
    const mainWidth=.010+sev*.011+Math.max(-.003,fine*.006);
    const mainDist=Math.abs(q.x-bend);
    const main=mainDist<mainWidth && Math.abs(q.y)<.91;

    // Two short offshoots peel away from the main fracture. They deliberately
    // occupy only part of the latitude range so the result reads as branching
    // geology rather than a second parallel stripe.
    const upperT=clamp((q.y+.46)/.48,0,1);
    const upperCenter=bend-(upperT*.17)+(valueNoise((q.y+1.1)*4.0,2.37,seed^0x425231,64)-.5)*.035;
    const upper=q.y>-.46&&q.y<.02&&Math.abs(q.x-upperCenter)<(.006+sev*.007);
    const lowerT=clamp((q.y-.08)/.46,0,1);
    const lowerCenter=bend+(lowerT*.14)+(valueNoise((q.y+1.0)*4.6,3.11,seed^0x425232,64)-.5)*.030;
    const lower=q.y>.08&&q.y<.54&&Math.abs(q.x-lowerCenter)<(.006+sev*.006);

    if(main||upper||lower){
      if(p.worldType==='VOLCANIC') return mixHex(C.red,C.black,.18);
      return mixHex(base,C.black,.68);
    }
    const rimWidth=mainWidth+.010+sev*.006;
    if(mainDist<rimWidth && Math.abs(q.y)<.93) return mixHex(base,C.brown,.22);
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
  if(p.renderer==='brittlehollow'){
    if(layerR<.22) return striation>.06?mixHex(C.black,C.red,.08):mixHex(C.black,C.purple,.04);
    if(layerR<.40) return striation>.12?mixHex(C.red,C.yellow,.14):mixHex(C.brown,C.red,.18);
    if(layerR<.68) return striation<-.10?mixHex(C.brown,C.black,.30):mixHex(C.purple,C.black,.18);
    return striation>.16?mixHex(C.white,C.black,.56):mixHex(C.brown,C.white,.18);
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
  if(planet.renderer==='subnautica') return subnauticaSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='azeroth') return azerothSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='draenor') return draenorSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='outland') return outlandSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='argus') return argusSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='timberhearth') return timberHearthSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='attlerock') return attlerockSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='embertwin') return emberTwinSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='ashtwin') return ashTwinSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='brittlehollow') return brittleHollowSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='giantsdeep') return giantsDeepSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='darkbramble') return darkBrambleSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='interloper') return interloperSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='quantummoon') return quantumMoonSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='eyeuniverse') return eyeUniverseSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='stellarisgaia') return stellarisGaiaSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='veil') return veilSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='kira') return kiraSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='sporeearth') return sporeEarthSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='grox') return groxSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='myliff') return myliffSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='sporecity') return sporeCitySurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='sporeruins') return sporeRuinsSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='infestation') return infestationSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='sporeice') return sporeIceSurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='tx5000') return tx5000SurfaceColor(lon,lat,nx,z);
  if(planet.renderer==='dyson') return dysonSurfaceColor(lon,lat,nx,z);
  return null;
}
function subnauticaSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const shelf=periodicNoise01(lon,lat,28,18,planet.terrainSeed^0x45464231);
  const bio=periodicNoise01(lon,lat,64,34,planet.terrainSeed^0x53454121);
  const arctic=lat<.14+(periodicNoise01(lon,lat,24,12,planet.terrainSeed^0x53454330)-.5)*.055;
  const island=q.n>.84 || (q.ridge>.88&&shelf>.64);
  let col;
  if(arctic && q.n>.52) col=bio>.55?mixHex(C.white,C.cyan,.16):C.white;
  else if(island) col=q.ridge>.91?C.brown:(bio>.54?mixHex(C.green,C.cyan,.16):C.green);
  else if(q.n>.67) col=shelf>.52?C.cyan:mixHex(C.blue,C.cyan,.34);
  else col=bio>.72?mixHex(C.blue,C.cyan,.18):C.blue;
  const crater=((lonDistance(lon,.63)/.055)**2+((lat-.58)/.045)**2);
  if(crater<1 && q.n>.54) col=crater<.42?mixHex(C.red,C.brown,.28):C.brown;
  return surfaceShade(col,nx,z);
}
function azerothSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const continent=periodicNoise01(lon,lat,16,11,planet.terrainSeed^0x415a4552)+periodicNoise01(lon,lat,35,23,planet.terrainSeed^0x4f544821)*.34;
  const biome=periodicNoise01(lon,lat,42,29,planet.terrainSeed^0x42494f4d);
  const land=continent>.69;
  let col;
  if(!land) col=continent>.63?C.cyan:C.blue;
  else if(Math.abs(lat-.5)>.40) col=biome>.50?C.white:mixHex(C.cyan,C.white,.60);
  else if(q.ridge>.86) col=Math.abs(lat-.5)>.27?mixHex(C.white,C.brown,.32):C.brown;
  else if(biome<.18) col=mixHex(C.yellow,C.brown,.15);
  else if(biome>.79) col=mixHex(C.green,C.blue,.12);
  else col=biome>.48?C.green:mixHex(C.green,C.yellow,.18);
  const maelstrom=(lonDistance(lon,.49)/.034)**2+((lat-.54)/.028)**2;
  if(maelstrom<1) col=maelstrom<.28?mixHex(C.blue,C.black,.42):mixHex(C.cyan,C.blue,.30);
  return surfaceShade(col,nx,z);
}
function draenorSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const land=periodicNoise01(lon,lat,15,11,planet.terrainSeed^0x44524145);
  const biome=periodicNoise01(lon,lat,34,21,planet.terrainSeed^0x4e4f5221);
  let col;
  if(land<.34) col=land<.22?C.blue:C.cyan;
  else if(lat<.18) col=biome>.45?C.white:mixHex(C.brown,C.white,.36);
  else if(biome<.17) col=mixHex(C.red,C.brown,.20);
  else if(biome>.82) col=mixHex(C.cyan,C.purple,.18);
  else if(q.ridge>.84) col=C.brown;
  else col=biome>.48?C.green:mixHex(C.green,C.yellow,.22);
  return surfaceShade(col,nx,z);
}
function outlandSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const fel=periodicNoise01(lon,lat,31,19,planet.terrainSeed^0x4f55544c);
  const nether=periodicNoise01(lon,lat,59,33,planet.terrainSeed^0x414e4421);
  let col;
  if(q.n<.30) col=fel>.58?mixHex(C.purple,C.blue,.30):C.blue;
  else if(q.ridge>.82) col=mixHex(C.brown,C.black,.24);
  else if(fel>.78) col=mixHex(C.green,C.yellow,.18);
  else if(fel<.20) col=mixHex(C.purple,C.red,.20);
  else col=nether>.60?mixHex(C.green,C.brown,.28):mixHex(C.brown,C.yellow,.16);
  return surfaceShade(col,nx,z);
}
function argusSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const fel=periodicNoise01(lon,lat,38,22,planet.terrainSeed^0x41524755);
  const ruin=periodicNoise01(lon,lat,78,43,planet.terrainSeed^0x5346454c);
  let col=q.ridge>.82?mixHex(C.brown,C.black,.32):mixHex(C.purple,C.black,.18);
  if(fel>.68) col=mixHex(C.green,C.yellow,.22);
  else if(fel<.22) col=mixHex(C.red,C.purple,.20);
  if(ruin>.82) col=mixHex(C.white,C.black,.48);
  const scar=Math.abs(lat-(.48+.06*Math.sin(lon*Math.PI*6)));
  if(scar<.018) col=scar<.007?mixHex(C.yellow,C.green,.16):mixHex(C.green,C.black,.06);
  return surfaceShade(col,nx,z);
}
function timberHearthSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const land=periodicNoise01(lon,lat,15,11,planet.terrainSeed^0x54494d42)+periodicNoise01(lon,lat,38,22,planet.terrainSeed^0x48454152)*.34;
  const forest=periodicNoise01(lon,lat,27,18,planet.terrainSeed^0x574f4f44);
  const plateau=periodicNoise01(lon,lat,18,10,planet.terrainSeed^0x504c4154);
  const riverA=Math.abs(lat-(.54+.14*Math.sin((lon+.08)*Math.PI*2.2)+(forest-.5)*.05));
  const riverB=Math.abs(lat-(.40-.10*Math.sin((lon-.18)*Math.PI*2.8)+(.5-plateau)*.04));
  const lake=((lonDistance(lon,.28)/.16)**2+((lat-.61)/.13)**2);
  let col;
  if(land<.43 || lake<1){
    col=(land<.34||lake<.66)?C.blue:C.cyan;
  }else if(q.ridge>.88){
    col=mixHex(C.brown,C.white,.18);
  }else if(forest>.62){
    col=forest>.78?mixHex(C.green,C.black,.06):C.green;
  }else if(plateau>.66){
    col=mixHex(C.green,C.yellow,.22);
  }else{
    col=mixHex(C.brown,C.green,.28);
  }
  const riverBand=(riverA<.011 || riverB<.010) && land>.42;
  if(riverBand) col=mixHex(C.cyan,C.white,.18);
  const village=(lonDistance(lon,.58)/.028)**2+((lat-.53)/.022)**2;
  if(village<1 && land>.48) col=village<.42?mixHex(C.yellow,C.white,.14):mixHex(C.brown,C.yellow,.18);
  const geyser=(lonDistance(lon,.73)/.04)**2+((lat-.28)/.05)**2;
  if(geyser<1 && land>.44) col=geyser<.36?mixHex(C.white,C.cyan,.16):mixHex(C.brown,C.white,.16);
  return surfaceShade(col,nx,z);
}
function attlerockSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const dust=periodicNoise01(lon,lat,34,22,planet.terrainSeed^0x4154544c);
  let col=q.ridge>.84?mixHex(C.white,C.brown,.36):q.n<.38?mixHex(C.brown,C.black,.24):mixHex(C.white,C.brown,.28);
  if(dust>.72) col=mixHex(col,C.white,.12);
  else if(dust<.18) col=mixHex(col,C.black,.10);
  const crater=((lonDistance(lon,.62)/.11)**2+((lat-.57)/.10)**2);
  if(crater<1) col=crater<.58?mixHex(C.black,C.brown,.16):mixHex(C.brown,C.white,.22);
  const outpostA=(lonDistance(lon,.58)/.028)**2+((lat-.44)/.024)**2;
  const outpostB=(lonDistance(lon,.37)/.022)**2+((lat-.56)/.020)**2;
  const locator=(lonDistance(lon,.35)/.010)**2+((lat-.51)/.058)**2;
  if(outpostA<1||outpostB<1) col=(outpostA<.32||outpostB<.32)?mixHex(C.white,C.yellow,.14):mixHex(C.brown,C.white,.20);
  if(locator<1 && q.n>.34) col=locator<.20?mixHex(C.white,C.cyan,.12):mixHex(C.brown,C.white,.20);
  return surfaceShade(col,nx,z);
}
function emberTwinSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const dune=periodicNoise01(lon,lat,25,15,planet.terrainSeed^0x454d4252);
  const scar=Math.abs(lat-(.48+.11*Math.sin(lon*Math.PI*3.2)+(dune-.5)*.05));
  let col;
  if(q.ridge>.87) col=mixHex(C.brown,C.black,.22);
  else if(q.n>.74) col=mixHex(C.red,C.brown,.20);
  else if(q.n<.34) col=mixHex(C.yellow,C.brown,.16);
  else col=mixHex(C.red,C.yellow,.26);
  if(scar<.020) col=scar<.009?mixHex(C.black,C.red,.14):mixHex(C.brown,C.red,.18);
  const cavern=((lonDistance(lon,.34)/.08)**2+((lat-.60)/.10)**2);
  if(cavern<1) col=cavern<.50?mixHex(C.black,C.brown,.16):mixHex(C.brown,C.yellow,.12);
  return surfaceShade(col,nx,z);
}
function ashTwinSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const ash=periodicNoise01(lon,lat,29,18,planet.terrainSeed^0x41534854);
  const band=Math.abs(lat-(.48+.06*Math.sin(lon*Math.PI*2.5)+(ash-.5)*.05));
  let col;
  if(q.ridge>.84) col=mixHex(C.white,C.brown,.30);
  else if(q.n<.32) col=mixHex(C.yellow,C.white,.20);
  else if(q.n>.72) col=mixHex(C.brown,C.white,.26);
  else col=mixHex(C.white,C.yellow,.22);
  if(band<.024) col=band<.010?mixHex(C.brown,C.black,.18):mixHex(C.brown,C.white,.32);
  if(ash>.78) col=mixHex(col,C.white,.10);
  else if(ash<.16) col=mixHex(col,C.black,.08);
  return surfaceShade(col,nx,z);
}
function brittleHollowSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const plates=periodicNoise01(lon,lat,18,12,planet.terrainSeed^0x42524954);
  const ash=periodicNoise01(lon,lat,48,26,planet.terrainSeed^0x484f4c4c);
  const coreLon=.53, coreLat=.52;
  const dx=(mod(lon-coreLon+.5,1)-.5), dy=lat-coreLat;
  const hollow=Math.sqrt((dx/.19)**2+(dy/.22)**2);
  const ring=Math.abs(hollow-1.0);
  const crackA=Math.abs(lat-(.50+.18*Math.sin((lon-.03)*Math.PI*2.0)+(plates-.5)*.045));
  const crackB=Math.abs(lat-(.45-.15*Math.sin((lon+.11)*Math.PI*2.9)+(ash-.5)*.055));
  const ray=Math.abs(Math.atan2(dy,dx)-(.8+.35*Math.sin(lon*Math.PI*2.0)))<(.08+(1-clamp(hollow,0,1))*0.06);
  const nearCore=hollow<1.55;
  let col;
  if(lat<.18+.05*(ash-.5)) col=ash>.58?mixHex(C.white,C.brown,.20):mixHex(C.white,C.blue,.18);
  else if(q.ridge>.84) col=mixHex(C.white,C.black,.48);
  else if(q.n<.28) col=mixHex(C.black,C.blue,.16);
  else if(q.n>.72) col=mixHex(C.white,C.black,.56);
  else col=mixHex(C.blue,C.purple,.20);
  if(ash>.78) col=mixHex(col,C.brown,.10);
  else if(ash<.18) col=mixHex(col,C.black,.08);
  if((crackA<.014||crackB<.012||(ray&&nearCore&&hollow>.90&&hollow<1.75)) && lat>.16){
    const hot=(crackA<.006||crackB<.005)||(ray&&hollow<1.30);
    col=hot?mixHex(C.red,C.yellow,.22):mixHex(C.brown,C.red,.18);
  }
  if(ring<.09){
    col=ring<.04?mixHex(C.red,C.yellow,.18):mixHex(C.brown,C.white,.20);
  }
  if(hollow<.98){
    if(hollow<.55) col=mixHex(C.black,C.red,.06);
    else col=mixHex(C.brown,C.black,.26);
  }
  return surfaceShade(col,nx,z);
}
function giantsDeepSurfaceColor(lon,lat,nx,z){
  const coarse=periodicNoise01(lon,lat,18,8,planet.terrainSeed^0x4749414e)-.5;
  const streak=periodicNoise01(lon,lat,46,21,planet.terrainSeed^0x54534450)-.5;
  const wave=Math.sin((lat*10+coarse*.9)*Math.PI+lon*Math.PI*1.8)*.028;
  const band=Math.sin((lat+wave+streak*.03)*Math.PI*8.5);
  let col=band>.48?mixHex(C.green,C.cyan,.18):band>-.12?mixHex(C.green,C.blue,.12):mixHex(C.blue,C.green,.22);
  if(streak>.30) col=mixHex(col,C.cyan,.12);
  else if(streak<-.34) col=mixHex(col,C.black,.08);
  // Giant's Deep should read as bands and violent storms, not as having an impact crater.
  // Keep a Great-Spot-like cyclone, but make it a soft swirling cloud feature rather than a dark hole.
  const dx=mod(lon-.64+.5,1)-.5, dy=lat-.28;
  const cyclone=(dx/.105)**2+(dy/.090)**2;
  const swirlA=Math.abs(dy-(.024*Math.sin(dx*22)+(streak)*.020));
  const swirlB=Math.abs(dy-(-.018+.020*Math.sin(dx*17+1.7)+(coarse)*.018));
  if(cyclone<1.25){
    col=mixHex(col,mixHex(C.green,C.cyan,.30),.22);
    if(swirlA<.016 || swirlB<.014) col=mixHex(C.cyan,C.green,.22);
    if(cyclone<.42) col=mixHex(col,mixHex(C.white,C.cyan,.10),.22);
    if(cyclone<.18) col=mixHex(col,C.white,.10);
  }
  return surfaceShade(col,nx,z);
}
function darkBrambleSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const bramble=periodicNoise01(lon,lat,20,12,planet.terrainSeed^0x4252414d);
  const ice=periodicNoise01(lon,lat,52,30,planet.terrainSeed^0x49434521);
  const tendril=Math.abs(lat-(.50+.20*Math.sin((lon+.03)*Math.PI*3.0)+(bramble-.5)*.08));
  let col;
  if(q.n<.28) col=mixHex(C.black,C.purple,.10);
  else if(ice>.76) col=mixHex(C.white,C.cyan,.22);
  else if(bramble>.60) col=mixHex(C.purple,C.black,.20);
  else col=mixHex(C.black,C.blue,.18);
  if(tendril<.028) col=tendril<.010?mixHex(C.black,C.red,.12):mixHex(C.brown,C.purple,.18);
  const seedVoid=(lonDistance(lon,.49)/.12)**2+((lat-.52)/.12)**2;
  if(seedVoid<1) col=seedVoid<.42?mixHex(C.black,C.purple,.02):mixHex(C.purple,C.black,.24);
  return surfaceShade(col,nx,z);
}
function interloperSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const ice=periodicNoise01(lon,lat,37,19,planet.terrainSeed^0x494e5445);
  const micro=periodicNoise01(lon,lat,78,41,planet.terrainSeed^0x434f4d54);
  let col;
  if(q.ridge>.86) col=mixHex(C.white,C.cyan,.22);
  else if(q.n<.34) col=mixHex(C.blue,C.black,.16);
  else if(ice>.60) col=mixHex(C.white,C.cyan,.14);
  else col=mixHex(C.cyan,C.white,.34);

  // Replace the old crater-like vent with a fractured icy shell.
  const crackA=Math.abs(lat-(.46+.10*Math.sin(lon*Math.PI*2.7)+(ice-.5)*.04));
  const crackB=Math.abs(lat-(.58-.08*Math.sin((lon+.08)*Math.PI*3.4)+(q.n-.5)*.05));
  const crackC=Math.abs(lat-(.36+.06*Math.sin((lon-.12)*Math.PI*4.2)+(micro-.5)*.03));
  if(crackA<.016 || crackB<.013 || crackC<.012){
    const deep=(crackA<.006)||(crackB<.005)||(crackC<.0045);
    col=deep?mixHex(C.blue,C.black,.36):mixHex(C.cyan,C.blue,.18);
  }

  // Narrow fractured vent zone near the tail origin: broken edge, not a neat circular cavity.
  const ventCenter=.70 + .012*Math.sin((lat-.52)*28);
  const ventBand=Math.abs(lonDistance(lon,ventCenter));
  const ventLat=Math.abs(lat-(.54+.07*Math.sin((lon-.66)*Math.PI*7.0)));
  const ventMask=(ventBand/.030)**2 + (ventLat/.095)**2;
  if(ventMask<1.0 && q.n>.30){
    col=ventMask<.24?mixHex(C.black,C.blue,.28):mixHex(C.brown,C.white,.18);
    if(((Math.floor(lon*220)+Math.floor(lat*170))&2)===0) col=mixHex(col,C.black,.10);
  }

  // Uneven broken ice patches around the vent make the shell look fractured rather than cratered.
  const shard=(lonDistance(lon,.66)/.075)**2+((lat-.53)/.11)**2;
  if(shard<1.0 && micro>.58) col=mixHex(col,C.white,.08);
  return surfaceShade(col,nx,z);
}
function quantumMoonSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const mist=periodicNoise01(lon,lat,18,11,planet.terrainSeed^0x51554e54);
  const blotch=periodicNoise01(lon,lat,44,25,planet.terrainSeed^0x4d4f4f4e);
  const broad=periodicNoise01(lon,lat,9,6,planet.terrainSeed^0x514d4f4f);
  const seam=Math.abs(lat-(.50+.07*Math.sin((lon+.09)*Math.PI*2.1)+(mist-.5)*.04));
  let col;
  if(q.ridge>.88) col=mixHex(C.blue,C.black,.40);
  else if(broad>.68) col=mixHex(C.blue,C.white,.22);
  else if(mist>.72) col=mixHex(C.blue,C.cyan,.16);
  else if(blotch<.22) col=mixHex(C.brown,C.blue,.34);
  else if(blotch>.66) col=mixHex(C.blue,C.black,.30);
  else col=mixHex(C.blue,C.black,.20);
  if(seam<.018) col=seam<.008?mixHex(C.black,C.blue,.18):mixHex(C.blue,C.white,.12);
  const shrine=(lonDistance(lon,.57)/.055)**2+((lat-.49)/.065)**2;
  if(shrine<1 && q.n>.44) col=shrine<.38?mixHex(C.white,C.cyan,.18):mixHex(C.brown,C.white,.20);
  return surfaceShade(col,nx,z);
}
function eyeUniverseSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const quantum=periodicNoise01(lon,lat,22,14,planet.terrainSeed^0x45594531);
  const shimmer=periodicNoise01(lon,lat,58,32,planet.terrainSeed^0x45594532);
  const dx=mod(lon-.50+.5,1)-.5, dy=lat-.52;
  const eye=(dx/.24)**2+(dy/.12)**2;
  const iris=(dx/.12)**2+(dy/.075)**2;
  const pupil=(dx/.050)**2+(dy/.050)**2;
  const lid=Math.abs(dy)-(.016+.070*Math.max(0,1-Math.abs(dx)/.24));
  let col;
  if(q.ridge>.88) col=mixHex(C.white,C.cyan,.18);
  else if(quantum>.70) col=mixHex(C.white,C.green,.14);
  else if(quantum<.24) col=mixHex(C.brown,C.white,.36);
  else col=mixHex(C.white,C.black,.20);
  if(eye<1){
    if(pupil<1) col=mixHex(C.black,C.purple,.06);
    else if(iris<1) col=mixHex(C.cyan,C.white,.12);
    else col=mixHex(C.brown,C.white,.22);
  }
  if(lid<.010 && Math.abs(dx)<.25) col=mixHex(C.black,C.cyan,.12);
  const lashA=Math.abs(dy-(.18+.05*Math.sin((lon+.02)*Math.PI*7.0))); 
  const lashB=Math.abs(dy-(-.18-.04*Math.sin((lon-.03)*Math.PI*6.0)));
  if((lashA<.010||lashB<.010) && Math.abs(dx)<.23) col=mixHex(C.white,C.cyan,.18);
  if(shimmer>.84) col=mixHex(col,C.white,.10);
  else if(shimmer<.16) col=mixHex(col,C.black,.08);
  return surfaceShade(col,nx,z);
}

function stellarisGaiaSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), macro=periodicNoise01(lon,lat,16,10,planet.terrainSeed^0x47414941), detail=periodicNoise01(lon,lat,47,26,planet.terrainSeed^0x5354454c);
  const land=macro>.43, style=planet.stellarisStyle||'garden';
  let col;
  if(!land) col=macro>.36?C.cyan:mixHex(C.blue,C.cyan,.18);
  else if(q.ridge>.87) col=mixHex(C.brown,C.white,.24);
  else if(detail>.74) col=mixHex(C.green,C.black,.10);
  else if(detail<.20) col=mixHex(C.green,C.yellow,.18);
  else col=C.green;
  if(style==='jewel') col=!land?mixHex(C.cyan,C.white,.10):mixHex(col,C.cyan,.08);
  if(style==='mausoleum' && land && detail>.63) col=mixHex(col,C.black,.16);
  if(style==='holy' && land && detail>.82) col=mixHex(C.white,C.yellow,.20);
  if(style==='walled' && land && (mod(lon*18,1)<.035||mod(lat*13,1)<.032)) col=mixHex(C.white,C.brown,.26);
  if(style==='wenkwort' && land && detail>.80) col=mixHex(C.green,C.white,.18);
  if(style==='zanaam'){
    const monument=(lonDistance(lon,.61)/.025)**2+((lat-.48)/.10)**2;
    if(monument<1) col=monument<.24?mixHex(C.black,C.cyan,.10):mixHex(C.white,C.brown,.28);
  }
  if(style==='paridayda' && land && detail>.85) col=mixHex(C.brown,C.white,.16);
  return surfaceShade(col,nx,z);
}
function veilSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), phase=periodicNoise01(lon,lat,24,16,planet.terrainSeed^0x5645494c), shroud=periodicNoise01(lon,lat,51,29,planet.terrainSeed^0x53485244);
  const land=q.n>.43;
  let col=land?(phase>.55?C.green:mixHex(C.green,C.blue,.16)):(q.n>.34?C.cyan:C.blue);
  const veil=shroud>.57 || Math.abs(lat-(.51+.12*Math.sin(lon*Math.PI*2.8)))<.055;
  if(veil) col=mixHex(col,shroud>.74?C.purple:C.black,shroud>.74?.42:.24);
  if(shroud>.86) col=mixHex(C.purple,C.cyan,.18);
  return surfaceShade(col,nx,z);
}
function kiraSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), lava=periodicNoise01(lon,lat,38,23,planet.terrainSeed^0x4b495241), ash=periodicNoise01(lon,lat,69,37,planet.terrainSeed^0x494e4645);
  let col=q.ridge>.85?mixHex(C.brown,C.black,.28):lava>.70?mixHex(C.red,C.yellow,.20):lava<.20?mixHex(C.black,C.brown,.16):mixHex(C.brown,C.red,.18);
  const oasis=(lonDistance(lon,.63)/.12)**2+((lat-.47)/.16)**2;
  if(oasis<1){
    if(oasis<.30) col=ash>.50?C.blue:C.cyan;
    else col=ash>.58?C.green:mixHex(C.green,C.yellow,.16);
  }
  return surfaceShade(col,nx,z);
}
function sporeEarthSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), land=periodicNoise01(lon,lat,14,9,planet.terrainSeed^0x53504541), biome=periodicNoise01(lon,lat,36,21,planet.terrainSeed^0x52544821);
  let col=land>.53?(q.ridge>.86?C.brown:biome>.64?C.green:mixHex(C.green,C.yellow,.22)):(land>.46?C.cyan:C.blue);
  if(Math.abs(lat-.5)>.39 && land>.50) col=C.white;
  return surfaceShade(col,nx,z);
}
function groxSurfaceColor(lon,lat,nx,z){
  const plates=periodicNoise01(lon,lat,50,27,planet.terrainSeed^0x47524f58), grit=periodicNoise01(lon,lat,91,47,planet.terrainSeed^0x4d414348);
  let col=plates>.70?mixHex(C.brown,C.black,.35):plates<.22?mixHex(C.red,C.black,.36):mixHex(C.black,C.brown,.16);
  const grid=mod(lon*42,1)<.045||mod(lat*25,1)<.055;
  if(grid && grit>.32) col=mixHex(C.red,C.yellow,.18);
  if(grit>.91) col=C.red;
  return surfaceShade(col,nx,z);
}
function myliffSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), org=periodicNoise01(lon,lat,31,20,planet.terrainSeed^0x4d594c49), vein=Math.abs(lat-(.50+.14*Math.sin(lon*Math.PI*4.0)+(org-.5)*.06));
  let col=q.n<.33?mixHex(C.blue,C.green,.25):org>.68?mixHex(C.green,C.purple,.18):org<.25?mixHex(C.brown,C.green,.26):C.green;
  if(vein<.018) col=vein<.007?mixHex(C.purple,C.white,.12):mixHex(C.cyan,C.green,.16);
  return surfaceShade(col,nx,z);
}
function sporeCitySurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), city=periodicNoise01(lon,lat,58,33,planet.terrainSeed^0x53504354), land=periodicNoise01(lon,lat,15,10,planet.terrainSeed^0x43495459);
  let ground=planet.sporeTheme==='dance'?mixHex(C.purple,C.green,.18):planet.sporeTheme==='oinker'?mixHex(C.yellow,C.red,.14):mixHex(C.green,C.yellow,.16);
  let col=land>.43?(q.ridge>.86?C.brown:ground):(land>.36?C.cyan:C.blue);
  if(land>.43 && city>.72){
    const neon=planet.sporeTheme==='dance'?(city>.86?C.cyan:C.purple):planet.sporeTheme==='oinker'?(city>.86?C.red:C.yellow):(city>.86?C.white:C.yellow);
    col=mixHex(col,neon,.50);
  }
  if(land>.48 && (mod(lon*35,1)<.026||mod(lat*22,1)<.028) && city>.50) col=mixHex(C.white,C.brown,.18);
  return surfaceShade(col,nx,z);
}
function sporeRuinsSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), jungle=periodicNoise01(lon,lat,35,22,planet.terrainSeed^0x5255494e), temple=(mod(lon*17,1)<.035||mod(lat*13,1)<.040);
  let col=q.n<.28?C.blue:jungle>.62?mixHex(C.green,C.black,.18):C.green;
  if(q.ridge>.87) col=C.brown;
  if(temple && q.n>.37 && jungle>.42) col=jungle>.72?mixHex(C.yellow,C.brown,.26):mixHex(C.brown,C.white,.16);
  return surfaceShade(col,nx,z);
}
function infestationSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), inf=periodicNoise01(lon,lat,27,17,planet.terrainSeed^0x494e4645), veins=Math.abs(lat-(.49+.16*Math.sin(lon*Math.PI*3.2)+(inf-.5)*.08));
  let col=q.n<.31?C.blue:(q.ridge>.86?C.brown:C.green);
  if(inf>.58 && q.n>.30) col=mixHex(C.purple,C.red,.20);
  if(veins<.028 && q.n>.28) col=veins<.010?C.red:mixHex(C.purple,C.green,.16);
  return surfaceShade(col,nx,z);
}
function sporeIceSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat), ice=periodicNoise01(lon,lat,42,25,planet.terrainSeed^0x49434521);
  let col=q.ridge>.86?C.white:ice>.58?mixHex(C.white,C.cyan,.16):mixHex(C.cyan,C.blue,.18);
  const crash=Math.abs(lat-(.54+.035*Math.sin((lon-.60)*Math.PI*8)));
  if(lonDistance(lon,.62)<.10 && crash<.030) col=crash<.012?mixHex(C.black,C.blue,.24):mixHex(C.brown,C.white,.12);
  return surfaceShade(col,nx,z);
}
function tx5000SurfaceColor(lon,lat,nx,z){
  const panel=periodicNoise01(lon,lat,75,41,planet.terrainSeed^0x54583530), seam=mod(lon*31,1)<.035||mod(lat*19,1)<.040;
  let col=panel>.64?mixHex(C.white,C.black,.56):mixHex(C.brown,C.black,.30);
  if(seam) col=mixHex(C.black,C.cyan,.14);
  const weapon=(lonDistance(lon,.56)/.10)**2+((lat-.48)/.12)**2;
  if(weapon<1) col=weapon<.30?mixHex(C.red,C.yellow,.18):mixHex(C.white,C.black,.34);
  if(panel>.92) col=C.red;
  return surfaceShade(col,nx,z);
}

function dysonSurfaceColor(lon,lat,nx,z){
  const band=Math.floor(mod(lon*24,24));
  const latBand=Math.floor(lat*18);
  const grid=(band%4===0 || latBand%4===0);
  const micro=periodicNoise01(lon,lat,90,54,planet.terrainSeed^0x4459534f);
  const panel=periodicNoise01(lon,lat,30,20,planet.terrainSeed^0x4e50414e);
  let col=panel>.58?mixHex(C.yellow,C.brown,.26):mixHex(C.white,C.brown,.48);
  if(grid) col=mixHex(col,C.black,.28);
  if(micro>.84) col=mixHex(C.cyan,C.white,.22);
  const conduit=Math.abs(lat-.52-(periodicNoise01(lon,lat,12,9,planet.terrainSeed^0x504f5745)-.5)*.18)<.010 || Math.abs(lon-.25)<.008 || Math.abs(lon-.75)<.008;
  if(conduit) col=mixHex(C.cyan,C.white,.26);
  const aperture=((lonDistance(lon,.50)/.070)**2+((lat-.50)/.12)**2)<1;
  if(aperture) col=mixHex(C.black,C.cyan,.28);
  return surfaceShade(col,nx,z);
}
function giediPrimeSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const industry=periodicNoise01(lon,lat,28,17,planet.terrainSeed^0x47494544);
  const pits=periodicNoise01(lon,lat,57,31,planet.terrainSeed^0x5052494d);
  const slag=periodicNoise01(lon,lat,84,49,planet.terrainSeed^0x534c4147);
  const smogBand=Math.abs(lat-(.50+.09*Math.sin(lon*Math.PI*5.5)+(industry-.5)*.04));
  let col;
  if(q.ridge>.86 || pits>.84) col=mixHex(C.black,C.brown,.22);
  else if(industry>.78) col=mixHex(C.white,C.black,.58);
  else if(slag>.76) col=mixHex(C.brown,C.black,.12);
  else if(q.n<.34) col=mixHex(C.yellow,C.brown,.26);
  else if(q.n>.68) col=mixHex(C.brown,C.black,.18);
  else col=mixHex(C.brown,C.yellow,.18);
  if(smogBand<.024) col=smogBand<.010 ? mixHex(C.white,C.yellow,.22) : mixHex(C.white,C.black,.54);
  if(pits<.12) col=mixHex(col,C.black,.20);
  if(industry>.90 && slag>.52) col=mixHex(C.white,C.black,.44);
  return surfaceShade(col,nx,z);
}
function chasmSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const strata=periodicNoise01(lon,lat,36,18,planet.terrainSeed^0x43484153);
  const rubble=periodicNoise01(lon,lat,88,47,planet.terrainSeed^0x52494654);
  const mesa=periodicNoise01(lon,lat,19,9,planet.terrainSeed^0x4d455341);
  let col;
  if(q.ridge>.84) col=mixHex(C.brown,C.black,.30);
  else if(q.n>.66) col=mixHex(C.brown,C.yellow,.18);
  else if(q.n<.30) col=mixHex(C.red,C.black,.16);
  else col=mixHex(C.brown,C.white,.18);
  if(strata>.76) col=mixHex(col,C.yellow,.14);
  else if(strata<.18) col=mixHex(col,C.black,.10);
  if(mesa>.82) col=mixHex(col,C.white,.10);
  const spine=.505 + Math.sin((lat-.5)*Math.PI*2.6)*.020 + (strata-.5)*.030 + (mesa-.5)*.010;
  const dist=lonDistance(lon,spine);
  const width=.020 + (1-q.ridge)*.010 + (rubble-.5)*.009;
  const inner=.010 + (rubble-.5)*.004;
  if(dist<width){
    const wall=clamp((width-dist)/Math.max(.001,width-inner),0,1);
    if(dist<inner){
      col=rubble>.58?mixHex(C.black,C.red,.10):mixHex(C.black,C.brown,.12);
    }else{
      col=wall>.66?mixHex(C.yellow,C.brown,.12):mixHex(C.brown,C.red,.14);
      if(rubble>.80) col=mixHex(col,C.white,.16);
    }
    if(Math.abs(lat-.5)<.18 && dist<width*.82) col=mixHex(col,C.black,.06);
  }else if(dist<width+.008){
    col=mixHex(C.white,C.brown,.26);
  }
  if(rubble>.90 && dist>width+.006) col=mixHex(col,C.black,.12);
  return surfaceShade(col,nx,z);
}
function arrakisSurfaceColor(lon,lat,nx,z){
  const q=terrainAt(lon,lat);
  const tC=tempC();
  const tempLocal=tC-Math.abs(lat-.5)*54+(q.n-.5)*10;
  const oasisNoise=periodicNoise01(lon,lat,18,13,planet.terrainSeed^0x41525241);
  const greenNoise=periodicNoise01(lon,lat,33,21,planet.terrainSeed^0x4b49534f);
  const duneNoise=periodicNoise01(lon,lat,54,25,planet.terrainSeed^0x444e4521);
  const basin=clamp((.52-q.n)*1.95 + (.58-q.ridge)*.45 + (oasisNoise-.54)*1.10,0,1);
  const dryRidge=q.ridge>.80 || q.n>.74;
  const desertBase=q.n<.40?mixHex(C.yellow,C.brown,.18):q.n>.64?mixHex(C.red,C.yellow,.24):C.yellow;
  const coolSand=mixHex(C.white,C.yellow,.44);
  const sparseVegetation=mixHex(C.green,C.yellow,.34);
  const lushVegetation=greenNoise>.62?mixHex(C.green,C.yellow,.08):C.green;
  if(tC<=2){
    const cold=clamp((2-tC)/52,0,1);
    // As ecological restoration overshoots into a deep freeze, Arrakis becomes
    // an icy desert rather than a snowball: broad irregular polar caps, frozen
    // oasis basins and scattered frost spread across the dunes toward -50 C.
    const coldReach=lerp(.025,.34,cold);
    const cap=polarCapAt(lon,lat,coldReach,{forceBoth:tC<-8,seedSalt:0x434f4c44});
    const frostNoise=periodicNoise01(lon,lat,42,27,planet.terrainSeed^0x46524f53);
    if(cap.ice && tempLocal<4-cold*8) return surfaceShade(polarIceColor(cap),nx,z);
    const frozenBasin=tempLocal<-5 && basin>(.78-cold*.24);
    const duneFrost=tempLocal<-12 && frostNoise>(.84-cold*.30) && q.n<.70;
    if(frozenBasin) return surfaceShade(basin>.90?mixHex(C.blue,C.white,.52):mixHex(C.cyan,C.white,.68),nx,z);
    if(duneFrost) return surfaceShade(mixHex(C.white,C.cyan,.16+cold*.18),nx,z);
    let col=dryRidge?mixHex(C.brown,C.black,.22):mixHex(coolSand,C.brown,.18);
    if(cold>.58 && frostNoise>.58) col=mixHex(col,C.white,.12+cold*.14);
    else if(duneNoise>.76) col=mixHex(col,C.white,.16);
    else if(greenNoise<.18) col=mixHex(col,C.black,.08);
    return surfaceShade(col,nx,z);
  }
  if(tC<=18){
    const waterSpot=basin>.82 && greenNoise>.44;
    const fertile=basin>.52 || (greenNoise>.66 && q.n<.67);
    let col;
    if(waterSpot) col=basin>.92?C.blue:C.cyan;
    else if(fertile) col=lushVegetation;
    else if(dryRidge || duneNoise>.70) col=q.ridge>.86?C.brown:mixHex(C.yellow,C.brown,.20);
    else col=greenNoise>.56?mixHex(C.green,C.yellow,.18):sparseVegetation;
    return surfaceShade(col,nx,z);
  }
  if(tC<=34){
    const waterSpot=basin>.88 && greenNoise>.54;
    const fringe=basin>.68 || (greenNoise>.76 && q.n<.58);
    let col;
    if(waterSpot) col=basin>.95?C.blue:C.cyan;
    else if(fringe) col=greenNoise>.70?mixHex(C.green,C.yellow,.14):sparseVegetation;
    else if(dryRidge) col=C.brown;
    else col=desertBase;
    return surfaceShade(col,nx,z);
  }
  let hot=desertBase;
  if(dryRidge) hot=C.brown;
  else if(duneNoise>.72) hot=mixHex(C.red,C.yellow,.30);
  return surfaceShade(hot,nx,z);
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
  if(planet.name==='ARRAKIS') return arrakisSurfaceColor(lon,lat,nx,z);
  if(planet.name==='GIEDI PRIME') return giediPrimeSurfaceColor(lon,lat,nx,z);
  if(planet.name==='CHASM') return chasmSurfaceColor(lon,lat,nx,z);
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
function ensureSurfaceMap(){
  ensurePlanetCacheContext();
  if(renderCache.surfaceImage && renderCache.surfaceBuiltRevision===renderCache.surfaceRevision) return renderCache.surfaceImage;
  // Surface generation only happens from the requestAnimationFrame render path,
  // never directly inside pointermove. If several slider events arrive before
  // the next display frame, they therefore collapse naturally into ONE rebuild
  // using the newest temperature value instead of rendering obsolete states.
  //
  // While dragging, sample one climate colour per 2x2 texel block. The texture
  // remains 256x128, so projection code does not change, but expensive climate/
  // biome evaluations fall from 32,768 to 8,192 per interactive rebuild. Slider
  // release invalidates the cache once more and restores full 1x1 quality.
  const step=state.draggingSlider?INTERACTIVE_SURFACE_STEP:1;
  // terrainAt() lazily builds its static map only for renderers that need it;
  // the map survives climate/view recolours.
  let c=renderCache.surfaceCanvas,g=renderCache.surfaceCtx;
  if(!c){
    c=document.createElement('canvas'); c.width=SURFACE_MAP_W; c.height=SURFACE_MAP_H;
    g=c.getContext('2d',{alpha:true,willReadFrequently:true}); g.imageSmoothingEnabled=false;
    renderCache.surfaceCanvas=c; renderCache.surfaceCtx=g;
  }
  const image=g.createImageData(SURFACE_MAP_W,SURFACE_MAP_H),data=image.data;
  for(let y=0;y<SURFACE_MAP_H;y+=step){
    const lat=(y+step*.5)/SURFACE_MAP_H;
    for(let x=0;x<SURFACE_MAP_W;x+=step){
      const lon=(x+step*.5)/SURFACE_MAP_W;
      // nx=0,z=1 intentionally asks every renderer for its unshaded base
      // colour. Lighting is screen-space and applied cheaply during projection.
      const rgb=rgbForHex(surfaceColor(lon,lat,lat-.5,0,1));
      const maxY=Math.min(SURFACE_MAP_H,y+step),maxX=Math.min(SURFACE_MAP_W,x+step);
      for(let yy=y;yy<maxY;yy++){
        let i=(yy*SURFACE_MAP_W+x)*4;
        for(let xx=x;xx<maxX;xx++,i+=4){
          data[i]=rgb[0]; data[i+1]=rgb[1]; data[i+2]=rgb[2]; data[i+3]=255;
        }
      }
    }
  }
  g.putImageData(image,0,0);
  renderCache.surfaceImage={width:SURFACE_MAP_W,height:SURFACE_MAP_H,data:image.data,canvas:c};
  renderCache.surfaceBuiltRevision=renderCache.surfaceRevision;
  return renderCache.surfaceImage;
}
function ensurePlanetFrameGeometry(cx,cy){
  ensurePlanetCacheContext();
  const minX=Math.floor(cx-planet.rx-1),maxX=Math.ceil(cx+planet.rx+1),minY=Math.floor(cy-planet.ry-1),maxY=Math.ceil(cy+planet.ry+1);
  const w=maxX-minX+1,h=maxY-minY+1,key=`${planet.rx.toFixed(4)}:${planet.ry.toFixed(4)}:${w}:${h}`;
  if(renderCache.frame?.key===key) return renderCache.frame;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{alpha:true,willReadFrequently:true});g.imageSmoothingEnabled=false;
  const image=g.createImageData(w,h),count=w*h;
  const active=new Uint8Array(count),lonBase=new Float32Array(count),latIndex=new Uint16Array(count),shade=new Uint8Array(count),nxMap=new Float32Array(count),nyMap=new Float32Array(count);
  for(let ly=0;ly<h;ly++){
    const sy=minY+ly,ny=(sy-cy)/planet.ry;
    if(Math.abs(ny)>1) continue;
    for(let lx=0;lx<w;lx++){
      const sx=minX+lx,nx=(sx-cx)/planet.rx,rr=nx*nx+ny*ny;
      if(rr>1) continue;
      const z=Math.sqrt(Math.max(0,1-rr)),i=ly*w+lx;
      active[i]=1;nxMap[i]=nx;nyMap[i]=ny;
      lonBase[i]=mod(.5+Math.atan2(nx,z)/(Math.PI*2),1);
      const lat=clamp(.5+Math.asin(ny)/Math.PI,0,1);
      latIndex[i]=clamp(Math.floor(lat*SURFACE_MAP_H),0,SURFACE_MAP_H-1);
      const light=clamp(z*.62+(-nx*.22)+.28,0,1);
      shade[i]=light<.34?2:light<.53?1:0;
    }
  }
  return renderCache.frame={key,c,g,image,active,lonBase,latIndex,shade,nxMap,nyMap,w,h,minX,minY,lastPhase:NaN,lastSurfaceRevision:0};
}
function shadeRgbFast(r,g,b,tier){
  if(!tier) return [r,g,b];
  const a=tier===2?.34:.13,ia=1-a;
  return [Math.round(r*ia+BLACK_RGB[0]*a),Math.round(g*ia+BLACK_RGB[1]*a),Math.round(b*ia+BLACK_RGB[2]*a)];
}
function renderPlanetSurfaceImage(cx,cy){
  const surface=ensureSurfaceMap(),frame=ensurePlanetFrameGeometry(cx,cy);
  // If time is paused and neither climate nor view changed, the already
  // projected offscreen frame can be reused verbatim.
  if(frame.lastPhase===state.phase && frame.lastSurfaceRevision===renderCache.surfaceRevision){
    ctx.drawImage(frame.c,frame.minX,frame.minY); return;
  }
  const out=frame.image.data; out.fill(0);
  const src=surface.data,sw=surface.width;
  const profile=planet.damageProfile;
  const dynamicDamage=damageVisibleInCurrentView() && (planet.renderer==='wikipedia'||!!(profile&&profile.type&&profile.type!=='NONE'));
  for(let i=0;i<frame.active.length;i++){
    if(!frame.active[i]) continue;
    const lon=mod(frame.lonBase[i]+state.phase,1);
    const sx=clamp(Math.floor(lon*SURFACE_MAP_W),0,SURFACE_MAP_W-1),sy=frame.latIndex[i];
    const si=(sy*sw+sx)*4,di=i*4;
    let rgb=shadeRgbFast(src[si],src[si+1],src[si+2],frame.shade[i]);
    if(dynamicDamage){
      const nx=frame.nxMap[i],ny=frame.nyMap[i];
      if(specialSurfaceMask(nx,ny)){
        if(planet.renderer==='wikipedia'||planet.renderer==='outland') continue;
        rgb=rgbForHex(damageInteriorColor(nx,ny,planet));
      }else{
        const baseHex=rgbToHex(rgb[0],rgb[1],rgb[2]);
        const damaged=damageSurfaceColor(baseHex,nx,ny,planet);
        if(damaged!==baseHex) rgb=rgbForHex(damaged);
      }
    }
    out[di]=rgb[0];out[di+1]=rgb[1];out[di+2]=rgb[2];out[di+3]=255;
  }
  frame.g.putImageData(frame.image,0,0);
  frame.lastPhase=state.phase;frame.lastSurfaceRevision=renderCache.surfaceRevision;
  ctx.drawImage(frame.c,frame.minX,frame.minY);
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
    if(label.includes('HURRICANE')&&w.hurricane){drawSpiralWeather(pos.x,pos.y,size+3,w.spin,C.white,atmosphereMode?.95:.70);continue;}
    if(label.includes('SUPERSTORM')&&i<3){drawSpiralWeather(pos.x,pos.y,size+4,w.spin,base,Math.min(1,alpha+.20));continue;}
    if(label.includes('DUST')){ctx.fillStyle=mixHex(C.brown,C.red,.22);ctx.globalAlpha=alpha;for(let k=0;k<14;k++){const a=w.phase+k*2.17,rr=(k%5)*size*.28;ctx.fillRect(Math.round(pos.x+Math.cos(a)*rr),Math.round(pos.y+Math.sin(a)*rr*.38),k%4===0?2:1,1);}ctx.globalAlpha=1;continue;}
    if(label.includes('BLIZZARD')||label.includes('SNOW')){ctx.fillStyle=C.white;ctx.globalAlpha=alpha;for(let k=0;k<14;k++){const a=w.phase+k*1.31,rr=(k%6)*size*.22;ctx.fillRect(Math.round(pos.x+Math.cos(a)*rr+k*.12),Math.round(pos.y+Math.sin(a)*rr*.35),1,1);}ctx.globalAlpha=1;continue;}
    if(label.includes('MONSOON')||label.includes('RAIN')){
      const rainCol=label.includes('METHANE')?C.cyan:C.blue;
      const cloudCol=electrical?mixHex(base,C.black,.34):mixHex(base,C.black,.20);
      ctx.globalAlpha=alpha*.72;
      ctx.fillStyle=cloudCol;
      for(let k=0;k<12;k++){
        const a=w.phase+k*.87, rr=(.18+(k%4)*.23)*size;
        const px=Math.round(pos.x+Math.cos(a)*rr);
        const py=Math.round(pos.y+Math.sin(a)*rr*.34)-1;
        ctx.fillRect(px,py,k%5===0?2:1,1);
      }
      if(electrical){
        ctx.fillStyle=mixHex(cloudCol,C.white,.10);
        ctx.fillRect(Math.round(pos.x-1),Math.round(pos.y-2),2,1);
      }
      ctx.fillStyle=rainCol;
      ctx.globalAlpha=alpha;
      for(let k=0;k<15;k++){
        const spread=((k*37+(planet.seed^i))%100)/100;
        const dx=(spread-.5)*size*1.8;
        const dy=((k%5)-2)*1.3;
        const len=1+((k+i)%3);
        const px=Math.round(pos.x+dx);
        const py=Math.round(pos.y+dy+1);
        ctx.fillRect(px,py,1,len);
        if((k%4)===0) ctx.fillRect(px+1,py+1,1,1);
      }
      ctx.globalAlpha=1;
      continue;
    }
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
function drawMoonLoreDetails(m,pos,diameter){
  if(!m||!pos) return;
  if(m.name==='ATTLEROCK'){
    const x=Math.round(pos.x),y=Math.round(pos.y),r=Math.max(4,Math.round(diameter*.45));
    // Esker's outpost + signal-locator mast. These are intentionally a little
    // oversized relative to strict scale so they remain readable at ~12 px.
    ctx.fillStyle=mixHex(C.white,C.yellow,.14);ctx.fillRect(x-1,y-1,3,2);
    ctx.fillStyle=C.brown;ctx.fillRect(x,y+1,1,1);
    ctx.fillStyle=mixHex(C.white,C.cyan,.10);ctx.fillRect(x+r-2,y-2,1,4);
    ctx.fillRect(x+r-3,y-2,3,1);
    ctx.fillStyle=C.cyan;ctx.fillRect(x+r-2,y-4,1,1);
  }
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
      drawMoonLoreDetails(m,pos,renderedDiameter);
    } else {
      m.visualDiameter=renderedDiameter;
      m.hitRadius=Math.max(5,renderedDiameter*.55+3);
      ctx.fillStyle=moonTintColor(m);
      const s=Math.max(2,renderedDiameter);
      ctx.beginPath();ctx.arc(Math.round(pos.x),Math.round(pos.y),s*.5,0,Math.PI*2);ctx.fill();
      drawMoonLoreDetails(m,pos,renderedDiameter);
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
function drawArgusDebrisChunk(cx,cy,chunk){
  const ox=Math.round(cx+chunk.x), oy=Math.round(cy+chunk.y);
  const rx=chunk.rx, ry=chunk.ry;
  const baseA=mixHex(C.purple,C.black,.22), baseB=mixHex(C.red,C.purple,.18);
  const edgeLight=mixHex(C.white,C.purple,.26), edgeDark=mixHex(C.black,C.purple,.10);
  for(let py=-ry;py<=ry;py++){
    for(let px=-rx;px<=rx;px++){
      const nx=px/Math.max(1,rx), ny=py/Math.max(1,ry);
      const rr=nx*nx+ny*ny;
      if(rr>1.08) continue;
      const wobble=h2(px+17,py-13,chunk.seed)-.5;
      if(rr>1+.18*wobble) continue;
      const globalX=(ox+px), globalY=(oy+py);
      let col=rr>.88?edgeDark:(chunk.seed&1?baseA:baseB);
      const metal=h2(globalX*3,globalY*5,chunk.seed^0x4d455441);
      const fel=h2(globalX*7,globalY*3,chunk.seed^0x46454c21);
      if(metal>.72) col=mixHex(C.white,C.black,.48);
      else if(metal<.18) col=mixHex(col,C.black,.18);
      if(fel>.77) col=mixHex(C.green,C.yellow,.20);
      if(rr<.78 && Math.abs(ny-(.08*Math.sin((nx+1.3)*4+chunk.seed*.001)))<.10 && fel>.56) col=mixHex(C.green,C.black,.06);
      if(rr>.82 && wobble>.18) col=edgeLight;
      ctx.fillStyle=col;
      ctx.fillRect(globalX,globalY,1,1);
    }
  }
}
function drawArgusDebris(cx,cy,front){
  if(planet.renderer!=='argus' || state.viewMode>1) return;
  const chunks=[
    {x:50,y:-31,rx:8,ry:5,front:false,seed:planet.seed^0xa1},
    {x:63,y:-14,rx:5,ry:4,front:true,seed:planet.seed^0xa2},
    {x:70,y:6,rx:9,ry:6,front:true,seed:planet.seed^0xa3},
    {x:49,y:23,rx:6,ry:4,front:false,seed:planet.seed^0xa4},
    {x:29,y:-48,rx:4,ry:3,front:false,seed:planet.seed^0xa5},
    {x:-32,y:43,rx:5,ry:4,front:true,seed:planet.seed^0xa6}
  ];
  for(const chunk of chunks){
    if(!!chunk.front!==!!front) continue;
    drawArgusDebrisChunk(cx,cy,chunk);
  }
}
function drawDarkBrambleSilhouette(cx,cy){
  if(planet.renderer!=='darkbramble') return;
  const spikes=[
    {lon:.08,lat:.33,len:8,side:1},{lon:.14,lat:.57,len:11,side:-1},{lon:.22,lat:.72,len:7,side:1},
    {lon:.36,lat:.24,len:8,side:-1},{lon:.58,lat:.76,len:7,side:1},{lon:.71,lat:.43,len:10,side:-1},
    {lon:.84,lat:.62,len:8,side:1},{lon:.92,lat:.31,len:9,side:-1}
  ];
  for(let i=0;i<spikes.length;i++){
    const s=spikes[i], base=spherePointFromLonLat(s.lon,s.lat,cx,cy,1.02); if(!base) continue;
    const nx=(base.x-cx)/Math.max(1,planet.rx), ny=(base.y-cy)/Math.max(1,planet.ry);
    const tx=-ny*s.side, ty=nx*s.side;
    const tipX=base.x+nx*s.len+tx*(s.len*.24), tipY=base.y+ny*s.len+ty*(s.len*.20);
    drawPixelLine(base.x,base.y,tipX,tipY,mixHex(C.brown,C.black,.34),.90);
    drawPixelLine(base.x+tx,base.y+ty,tipX,tipY,mixHex(C.black,C.purple,.06),.60);
    ctx.fillStyle=mixHex(C.white,C.cyan,.20);
    ctx.fillRect(Math.round(tipX),Math.round(tipY),1,1);
    if((i&1)===0) ctx.fillRect(Math.round(tipX-nx*1.5+tx),Math.round(tipY-ny*1.5+ty),1,1);
  }
  const cutouts=[
    {lon:.11,lat:.49,r:5.5},{lon:.31,lat:.67,r:4.2},{lon:.62,lat:.36,r:5.0},{lon:.88,lat:.57,r:4.6}
  ];
  for(const c of cutouts){
    const p=spherePointFromLonLat(c.lon,c.lat,cx,cy,.93); if(!p) continue;
    ctx.fillStyle=mixHex(C.black,C.purple,.02);
    for(let y=-c.r;y<=c.r;y++) for(let x=-c.r;x<=c.r;x++){
      const dx=x/Math.max(1,c.r), dy=y/Math.max(1,c.r*.72);
      if(dx*dx+dy*dy>1) continue;
      ctx.fillRect(Math.round(p.x+x),Math.round(p.y+y),1,1);
    }
  }
}
function drawAttlerockOutposts(cx,cy){
  if(planet?.renderer!=='attlerock' || state.viewMode>1) return;
  const sites=[
    {lon:.58,lat:.44,type:0},{lon:.37,lat:.56,type:1},{lon:.35,lat:.50,type:2},
    {lon:.68,lat:.61,type:0},{lon:.47,lat:.30,type:1},{lon:.76,lat:.38,type:2},
    {lon:.24,lat:.43,type:0}
  ];
  for(const s of sites){
    const p=spherePointFromLonLat(s.lon,s.lat,cx,cy,.985); if(!p||p.depth<.04) continue;
    const x=Math.round(p.x), y=Math.round(p.y);
    if(s.type===0){
      ctx.fillStyle=mixHex(C.white,C.yellow,.10);ctx.fillRect(x-2,y-2,5,3);
      ctx.fillStyle=mixHex(C.brown,C.white,.10);ctx.fillRect(x-1,y+1,3,2);
      ctx.fillStyle=C.cyan;ctx.fillRect(x+2,y-4,1,2);ctx.fillRect(x+1,y-4,3,1);
    }else if(s.type===1){
      ctx.fillStyle=mixHex(C.white,C.brown,.14);ctx.fillRect(x-2,y,5,2);ctx.fillRect(x-1,y-3,3,3);
      ctx.fillStyle=C.cyan;ctx.fillRect(x,y-5,1,2);ctx.fillRect(x-1,y-5,3,1);
      ctx.fillStyle=C.brown;ctx.fillRect(x-3,y+1,2,1);ctx.fillRect(x+3,y+1,2,1);
    }else{
      // Signal-locator silhouette: intentionally oversized so it survives the
      // 480x270 pixel-art presentation.
      ctx.fillStyle=mixHex(C.white,C.cyan,.08);ctx.fillRect(x-1,y-5,3,7);
      ctx.fillRect(x-4,y-3,9,2);
      ctx.fillRect(x-3,y-4,2,1);ctx.fillRect(x+3,y-4,2,1);
      ctx.fillStyle=mixHex(C.brown,C.white,.16);ctx.fillRect(x-2,y+2,5,2);
      ctx.fillStyle=C.cyan;ctx.fillRect(x,y-6,1,1);
    }
  }
}
function drawInterloperTail(cx,cy){
  if(planet?.renderer!=='interloper') return;
  const baseX=cx+planet.rx*.82, baseY=cy-planet.ry*.02;
  const layers=[
    {len:planet.rx*3.8, spread:planet.ry*.72, col:mixHex(C.white,C.cyan,.12), alpha:.22, seed:17},
    {len:planet.rx*4.5, spread:planet.ry*.50, col:mixHex(C.cyan,C.blue,.16), alpha:.18, seed:43},
    {len:planet.rx*5.0, spread:planet.ry*.30, col:mixHex(C.white,C.blue,.08), alpha:.13, seed:71}
  ];
  for(let li=0;li<layers.length;li++){
    const layer=layers[li];
    ctx.fillStyle=layer.col; ctx.globalAlpha=layer.alpha;
    const columns=Math.max(72,Math.round(layer.len*2.1));
    for(let i=0;i<columns;i++){
      const q=i/Math.max(1,columns-1);
      // Wide, ragged near the comet; steadily narrows into a thin distant tail.
      const taper=Math.pow(1-q,.76);
      const halfW=Math.max(.8,layer.spread*(.18+.82*taper));
      const centerWobble=(h2(i,layer.seed,planet.seed^0x1ce)-.5)*2.6 + Math.sin(q*11+li*1.7)*1.3*taper;
      const centerY=baseY-centerWobble-Math.sin(q*Math.PI)*planet.ry*.07;
      const x=Math.round(baseX+q*layer.len + Math.sin(q*17+li)*1.2*taper);
      const edgeTop=(h2(i,layer.seed+19,planet.seed)-.5)*3.2*taper;
      const edgeBot=(h2(i,layer.seed+37,planet.seed)-.5)*3.4*taper;
      const y0=Math.round(centerY-halfW+edgeTop), y1=Math.round(centerY+halfW+edgeBot);
      for(let y=y0;y<=y1;y++){
        const rel=Math.abs((y-centerY)/Math.max(1,halfW));
        if(rel>1) continue;
        if(rel>.76 && ((x+y+i+li)&1)) continue;
        if(q>.45 && (x*3+y+i)%9===0) continue;
        ctx.fillRect(x,y,q<.12?2:1,1);
      }
    }
  }
  // A few detached icy wisps break up the silhouette near the body.
  ctx.fillStyle=mixHex(C.white,C.cyan,.10);ctx.globalAlpha=.30;
  for(let i=0;i<18;i++){
    const q=i/17, x=Math.round(baseX+5+q*planet.rx*2.5), y=Math.round(baseY+(h2(i,99,planet.seed)-.5)*planet.ry*(.62*(1-q)));
    ctx.fillRect(x,y,1+(i%5===0?1:0),1);
  }
  ctx.globalAlpha=1;
}
function drawEyeUniverseCloud(cx,cy){
  if(planet?.renderer!=='eyeuniverse' || state.viewMode>1) return;
  const rx=planet.rx*1.58, ry=planet.ry*.72;
  const dark=mixHex(C.purple,C.black,.34), mid=mixHex(C.purple,C.blue,.18), glow=mixHex(C.purple,C.white,.12);
  // Broad almond-shaped quantum cloud behind the body.
  for(let pass=0;pass<3;pass++){
    const steps=180, prx=rx+pass*5, pry=ry+pass*3;
    ctx.globalAlpha=.23-pass*.045;
    ctx.fillStyle=pass===0?glow:pass===1?mid:dark;
    for(let i=0;i<steps;i++){
      if((i+pass)%2 && pass>0) continue;
      const a=i/steps*Math.PI*2;
      const pinch=.54+.46*Math.abs(Math.cos(a));
      const jitter=(h2(i,pass+51,planet.seed)-.5)*(4+pass*2);
      const x=Math.round(cx+Math.cos(a)*(prx+jitter));
      const y=Math.round(cy+Math.sin(a)*(pry*pinch+jitter*.18));
      ctx.fillRect(x,y,pass===0?2:1,1);
    }
  }
  // Uneven tendrils make it cloud-like rather than a clean Saturn ring.
  ctx.globalAlpha=.24;ctx.fillStyle=mid;
  for(let arm=0;arm<16;arm++){
    const side=arm<8?-1:1, k=arm%8;
    const y0=cy+(k-3.5)*planet.ry*.11;
    const len=planet.rx*(.58+h2(arm,71,planet.seed)*.62);
    const x0=cx+side*planet.rx*.88;
    const pts=12;
    let px=x0,py=y0;
    for(let j=1;j<pts;j++){
      const q=j/(pts-1), x=cx+side*(planet.rx*.88+q*len), y=y0+Math.sin(q*5+k)*planet.ry*.07*(1-q)+(h2(arm*17+j,83,planet.seed)-.5)*2;
      drawPixelLine(px,py,x,y,arm%3===0?glow:mid,.24*(1-q*.55)); px=x;py=y;
    }
  }
  ctx.globalAlpha=1;
}
function drawEyeUniverseGlyph(cx,cy){
  if(planet?.renderer!=='eyeuniverse') return;
  // The body itself is the pupil/iris core of the larger purple cloud-eye.
  const pupilR=Math.max(8,Math.round(Math.min(planet.rx,planet.ry)*.42));
  for(let y=-pupilR;y<=pupilR;y++) for(let x=-pupilR;x<=pupilR;x++){
    const rr=(x*x+y*y)/(pupilR*pupilR); if(rr>1) continue;
    const px=cx+x,py=cy+y;if(!planetContainsPoint(px,py,cx,cy,0))continue;
    let col=rr<.38?mixHex(C.black,C.purple,.04):rr<.72?mixHex(C.purple,C.black,.28):mixHex(C.blue,C.purple,.22);
    if(((x*7+y*11+planet.seed)&15)===0) col=mixHex(col,C.cyan,.20);
    ctx.fillStyle=col;ctx.fillRect(px,py,1,1);
  }
  ctx.fillStyle=mixHex(C.black,C.purple,.02);
  ctx.fillRect(cx-2,cy-2,5,5);
  ctx.fillStyle=mixHex(C.cyan,C.white,.12);ctx.fillRect(cx-1,cy-1,1,1);
}
function drawBrittleHollowBlackHole(cx,cy){
  if(planet?.renderer!=='brittlehollow' || state.viewMode>1) return;
  const bhx=Math.round(cx+planet.rx*.02), bhy=Math.round(cy-planet.ry*.03);
  const r=Math.max(5,Math.round(Math.min(planet.rx,planet.ry)*.115));
  // Accretion glow first, then the absolute black singularity. This is drawn
  // over the missing-geometry cavity on purpose, so it remains visible through
  // the broken shell instead of being rejected by planetContainsPoint().
  for(let y=-r-5;y<=r+5;y++) for(let x=-r-8;x<=r+8;x++){
    const ex=x/(r*1.65), ey=y/(r*.62), er=ex*ex+ey*ey;
    if(er>1.25||er<.48) continue;
    const col=er<.70?mixHex(C.purple,C.white,.18):er<.96?mixHex(C.purple,C.blue,.12):mixHex(C.blue,C.purple,.24);
    ctx.fillStyle=col;ctx.globalAlpha=.58-(er-.48)*.22;ctx.fillRect(bhx+x,bhy+y,1,1);
  }
  ctx.globalAlpha=1;
  for(let y=-r;y<=r;y++) for(let x=-r;x<=r;x++){
    const rr=(x*x+y*y)/(r*r); if(rr>1) continue;
    ctx.fillStyle=rr>.78?mixHex(C.black,C.purple,.10):C.black;
    ctx.fillRect(bhx+x,bhy+y,1,1);
  }
  ctx.fillStyle=mixHex(C.white,C.purple,.16);ctx.fillRect(bhx-r-1,bhy,2,1);ctx.fillRect(bhx+r,bhy,2,1);
  // A couple of broken-shell shadows point inward toward the singularity.
  ctx.fillStyle=mixHex(C.black,C.purple,.06);
  drawPixelLine(cx-planet.rx*.25,cy-planet.ry*.27,bhx-r,bhy-1,mixHex(C.black,C.purple,.06),.78);
  drawPixelLine(cx+planet.rx*.20,cy+planet.ry*.24,bhx+r,bhy+1,mixHex(C.black,C.purple,.06),.78);
}
function drawLoreSetpieces(cx,cy,front){
  if(state.viewMode>1) return;
  if(!front) drawInterloperTail(cx,cy);
  if(front) drawAttlerockOutposts(cx,cy);
  drawArgusDebris(cx,cy,front);
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
  const stormy=weather.includes('STORM')||weather.includes('HURRICANE')||weather.includes('MONSOON')||weather.includes('ELECTRIC');
  if(stormy){
    base=mixHex(base,C.black,layer===0?.22:.16);
    accent=mixHex(accent,C.black,layer===0?.14:.10);
  }
  const stormSource=weather.includes('HURRICANE')
    ? (p.weatherSystems||[]).filter(w=>w.hurricane).slice(0,2)
    : (p.weatherSystems||[]).slice(0,3);
  const stormCenters=stormSource.map(w=>({
    lon:mod(w.lon+state.simDays*w.speed,1),lat:w.lat,intensity:w.intensity,spin:w.spin
  }));
  return {
    layer, giant, coverage, altitude,
    type:layer===0?types.low:types.high,
    speed:seedSign*baseSpeed*(layer===0?.026:.043)*(layer===0?1:1.31),
    opacity:layer===0?.82:.64,
    diagnosticOpacity:layer===0?.97:.84,
    base,accent,weather,stormCenters,stormy,
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
    if(spec.stormy){
      const localStorm=cloudStormInfluence(q.lon,q.lat,spec);
      if(localStorm>.04){
        const darken=clamp(.18+localStorm*.90,0,.56);
        col=mixHex(col,C.black,darken);
        if(bright && localStorm>.18) col=mixHex(col,C.purple,.08);
      }
    }
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
function drawQuantumMoonFog(cx,cy){
  if(planet?.renderer!=='quantummoon' || (state.viewMode!==0 && state.viewMode!==2)) return;
  const diagnostic=state.viewMode===2;
  const limb=mixHex(C.white,C.blue,.20), haze=mixHex(C.white,C.blue,.34), darkHaze=mixHex(C.blue,C.black,.12);

  // Thick soft-looking limb: several broken shells rather than one bright ring.
  for(let layer=0;layer<5;layer++){
    const rx=planet.rx+1+layer, ry=planet.ry+1+layer, steps=Math.max(110,Math.round((rx+ry)*3.1));
    ctx.fillStyle=layer<2?limb:haze;
    ctx.globalAlpha=(diagnostic?.38:.18)-layer*.024;
    for(let i=0;i<steps;i++){
      if(layer>1 && ((i+layer)%3===0)) continue;
      const a=i/steps*Math.PI*2;
      const wob=(h2(i,layer+29,planet.seed^0x5146)-.5)*(layer+1)*.55;
      ctx.fillRect(Math.round(cx+Math.cos(a)*(rx+wob)),Math.round(cy+Math.sin(a)*(ry+wob*.45)),1,1);
    }
  }

  // Broad smoky cloud bands. They drift slowly with simulation time and hide
  // most of the surface without flattening the whole moon into one white disc.
  const phase=state.simDays*.018;
  for(let band=0;band<7;band++){
    const yBase=cy-planet.ry*.72+band*(planet.ry*1.44/6);
    const amp=2.2+h2(band,51,planet.seed)*3.2;
    const width=planet.rx*1.78;
    const steps=Math.round(width*1.35);
    ctx.fillStyle=band%3===0?darkHaze:haze;
    ctx.globalAlpha=diagnostic?.28:(band%3===0?.11:.19);
    for(let i=0;i<steps;i++){
      const q=i/Math.max(1,steps-1), x=cx-width*.5+q*width;
      const wave=Math.sin(q*Math.PI*(2.1+band*.22)+phase+band*.9)*amp;
      const jitter=(h2(i,band+83,planet.seed^0x514d)-.5)*3.0;
      const y=yBase+wave+jitter;
      if(!planetContainsPoint(x,y,cx,cy,0)) continue;
      const seg=1+((i+band)%4===0?2:0);
      ctx.fillRect(Math.round(x),Math.round(y),seg,1);
      if((i+band)%5===0 && planetContainsPoint(x,y+1,cx,cy,0)) ctx.fillRect(Math.round(x+1),Math.round(y+1),1,1);
    }
  }

  // Fine interior haze, deliberately gray-blue instead of white.
  ctx.fillStyle=mixHex(C.white,C.blue,.44); ctx.globalAlpha=diagnostic?.31:.12;
  const count=Math.round(130+planet.rx*1.4);
  for(let i=0;i<count;i++){
    const a=h2(i,37,planet.seed^0x5155)*Math.PI*2;
    const rr=Math.sqrt(h2(i,73,planet.seed^0x4d4f))*Math.min(planet.rx,planet.ry)*.95;
    const x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr*(planet.ry/planet.rx);
    if(!planetContainsPoint(x,y,cx,cy,0)) continue;
    ctx.fillRect(Math.round(x),Math.round(y),h2(i,11,planet.seed)>.82?2:1,1);
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
  }else if(style==='sanctuary'){
    const habitat=Math.floor(theta*8)%4;
    if(terrain<.24) col=terrain<.12?C.blue:C.cyan;
    else if(habitat===0) col=detail>.66?mixHex(C.green,C.black,.12):C.green;
    else if(habitat===1) col=macro>.58?mixHex(C.yellow,C.green,.14):mixHex(C.green,C.yellow,.22);
    else if(habitat===2) col=ridge>.72?C.brown:mixHex(C.green,C.blue,.10);
    else col=detail>.70?mixHex(C.white,C.green,.20):C.green;
    if(mod(theta*8,1)<.025) col=mixHex(C.white,C.black,.42);
    if(detail>.93) col=mixHex(C.white,C.cyan,.14);
  }else if(style==='stranger'){
    const river=Math.abs(cross-(.49+.10*Math.sin(theta*Math.PI*2.2)+(detail-.5)*.035));
    const reservoir=((lonDistance(theta,.14)/.09)**2+((cross-.43)/.10)**2)<1 || ((lonDistance(theta,.81)/.11)**2+((cross-.56)/.12)**2)<1;
    const forest=detail>.60;
    if(reservoir || terrain<.17) col=terrain<.10||reservoir?C.blue:C.cyan;
    else if(river<.034) col=river<.015?mixHex(C.cyan,C.white,.12):C.cyan;
    else if(cross<.26||cross>.74) col=ridge>.78?mixHex(C.brown,C.white,.12):mixHex(C.brown,C.green,.18);
    else if(forest) col=detail>.78?mixHex(C.green,C.black,.14):C.green;
    else col=macro>.68?mixHex(C.green,C.yellow,.12):mixHex(C.brown,C.green,.26);
    const dam=Math.abs(theta-.73)<.010 && cross>.34 && cross<.68;
    if(dam) col=mixHex(C.white,C.black,.52);
    const hull=Math.abs(theta-.25)<.010 && cross>.30 && cross<.72;
    if(hull) col=mixHex(C.white,C.black,.44);
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
function drawDysonRingLayer(cx,cy,rx,ry,planeAngle,phase,front,tint,moduleTint,moduleEvery=11){
  const cosA=Math.cos(planeAngle), sinA=Math.sin(planeAngle);
  const steps=Math.max(80,Math.round((rx+ry)*2.4));
  for(let i=0;i<steps;i++){
    // phase is deliberately part of the actual ring coordinate. Previously it
    // only changed the depth test, so a continuous ellipse looked stationary.
    const u=(i/steps)*Math.PI*2+phase;
    const depth=Math.sin(u);
    if(front ? depth<0 : depth>=0) continue;
    const ex=Math.cos(u)*rx;
    const ey=Math.sin(u)*ry*.36;
    const px=ex*cosA-ey*sinA;
    const py=ex*sinA+ey*cosA;
    const x=Math.round(cx+px), y=Math.round(cy+py);
    const bright=.16+.22*Math.max(0,depth);
    // Small moving construction gaps make the otherwise continuous ellipse's
    // rotation legible at pixel scale without turning it into a dotted ring.
    const segment=i%moduleEvery, block=((i/moduleEvery)|0);
    // More missing construction segments make the very slow counter-rotation
    // easy to read while keeping each band recognizably continuous.
    const majorGap=(block%3===1 && segment>=moduleEvery-3);
    const minorGap=(block%5===2 && segment>=2 && segment<=3);
    const serviceGap=(block%7===4 && segment===Math.floor(moduleEvery*.55));
    if(majorGap||minorGap||serviceGap) continue;
    ctx.fillStyle=mixHex(tint,C.white,front?bright:.05);
    ctx.fillRect(x,y,front?2:1,1);
    if(segment===0){
      const mx=Math.round(cx+px*1.01), my=Math.round(cy+py*1.01);
      ctx.fillStyle=front?moduleTint:mixHex(moduleTint,C.black,.26);
      ctx.fillRect(mx-1,my-1,2,2);
      if(((i/moduleEvery)|0)%4===0){
        ctx.fillStyle=front?mixHex(moduleTint,C.white,.18):mixHex(moduleTint,C.black,.34);
        ctx.fillRect(mx,my-2,1,1);
      }
    }
  }
}
function drawDysonStar(cx,cy){
  const rx=Math.max(10,Math.round(planet.rx*.34)), ry=Math.max(9,Math.round(planet.ry*.34));
  for(let py=-ry-6;py<=ry+6;py++){
    for(let px=-rx-6;px<=rx+6;px++){
      const nx=px/Math.max(1,rx), ny=py/Math.max(1,ry);
      const rr=nx*nx+ny*ny;
      if(rr>1.85) continue;
      let col=null;
      if(rr<=1){
        col=rr<.22?mixHex(C.white,C.yellow,.18):rr<.64?mixHex(C.yellow,C.white,.16):mixHex(C.red,C.yellow,.34);
      }else if(rr<=1.42){
        col=rr<1.15?mixHex(C.yellow,C.red,.22):mixHex(C.red,C.yellow,.18);
      }
      if(!col) continue;
      ctx.fillStyle=col;
      ctx.globalAlpha=rr<=1?1:(1.42-rr)/.42*.42;
      ctx.fillRect(cx+px,cy+py,1,1);
    }
  }
  ctx.globalAlpha=1;
}
function drawDysonSphereWorld(cx,cy,t){
  drawLoreSetpieces(cx,cy,false);
  const sec=t*.001;
  // Each shell now takes several real minutes per revolution. They counter-
  // rotate at slightly different rates so the megastructure slowly changes
  // configuration instead of spinning like a fan.
  const outerPhase=sec*.018;   // ~5.8 min / revolution
  const middlePhase=-sec*.013; // ~8.1 min / revolution
  const innerPhase=sec*.009;   // ~11.6 min / revolution
  const bronze=mixHex(C.yellow,C.brown,.26), pale=mixHex(C.white,C.yellow,.20), conduit=mixHex(C.cyan,C.white,.18);
  drawDysonRingLayer(cx,cy,planet.rx+8,planet.ry+6,-.95,outerPhase,false,bronze,pale,13);
  drawDysonRingLayer(cx,cy,planet.rx+2,planet.ry+10,-.28,middlePhase,false,mixHex(C.brown,C.white,.42),conduit,11);
  drawDysonRingLayer(cx,cy,planet.rx-5,planet.ry+14,.58,innerPhase,false,mixHex(C.yellow,C.white,.10),pale,9);
  drawDysonStar(cx,cy);
  drawDysonRingLayer(cx,cy,planet.rx+8,planet.ry+6,-.95,outerPhase,true,bronze,pale,13);
  drawDysonRingLayer(cx,cy,planet.rx+2,planet.ry+10,-.28,middlePhase,true,mixHex(C.brown,C.white,.42),conduit,11);
  drawDysonRingLayer(cx,cy,planet.rx-5,planet.ry+14,.58,innerPhase,true,mixHex(C.yellow,C.white,.10),pale,9);
  for(let i=0;i<18;i++){
    const a=outerPhase*.55+i*(Math.PI*2/18), r=planet.rx+6+((i%3)-1)*3;
    const x=Math.round(cx+Math.cos(a)*r), y=Math.round(cy+Math.sin(a)*r*.34);
    ctx.fillStyle=i%3===0?mixHex(C.cyan,C.white,.12):mixHex(C.white,C.yellow,.18);
    ctx.fillRect(x,y,1,1);
  }
  drawLoreSetpieces(cx,cy,true);
}
function drawMegastructureEllipse(x,y,rx,ry,color,alpha=1,rot=0,start=0,end=Math.PI*2,stroke=false,lineWidth=1){
  ctx.save();
  ctx.globalAlpha*=alpha;
  if(stroke){
    ctx.strokeStyle=color;
    ctx.lineWidth=lineWidth;
  }else ctx.fillStyle=color;
  ctx.beginPath();
  ctx.ellipse(Math.round(x),Math.round(y),Math.max(1,Math.abs(rx)),Math.max(1,Math.abs(ry)),rot,start,end);
  stroke ? ctx.stroke() : ctx.fill();
  ctx.restore();
}
function drawMegastructureLine(x0,y0,x1,y1,color,width=1,alpha=1){
  ctx.save();
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.lineCap='round';
  ctx.globalAlpha*=alpha;
  ctx.beginPath();
  ctx.moveTo(Math.round(x0)+0.5,Math.round(y0)+0.5);
  ctx.lineTo(Math.round(x1)+0.5,Math.round(y1)+0.5);
  ctx.stroke();
  ctx.restore();
}
function drawMegastructureHex(x,y,r,color,alpha=1,stroke=false,lineWidth=1,rot=0){
  ctx.save();
  ctx.globalAlpha*=alpha;
  if(stroke){ ctx.strokeStyle=color; ctx.lineWidth=lineWidth; } else ctx.fillStyle=color;
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=rot+Math.PI/6+i*Math.PI/3, px=x+Math.cos(a)*r, py=y+Math.sin(a)*r;
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  }
  ctx.closePath();
  stroke?ctx.stroke():ctx.fill();
  ctx.restore();
}
function clipMegastructureSphere(cx,cy,rx,ry,fn){
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);
  ctx.clip();
  fn();
  ctx.restore();
}
function drawTinyArtificialSun(x,y,r=4){
  drawMegastructureEllipse(x,y,r+3,r+3,mixHex(C.yellow,C.white,.10),.22);
  drawMegastructureEllipse(x,y,r+1,r+1,mixHex(C.yellow,C.white,.32),.42);
  drawMegastructureEllipse(x,y,r,r,mixHex(C.yellow,C.white,.58),1);
  drawMegastructureEllipse(x,y,Math.max(1,r-1),Math.max(1,r-1),C.white,.95);
}
function drawMetalPanelSphere(cx,cy,rx,ry,baseColor,seedShift=0){
  const seed=(planet.seed||0)^seedShift;
  drawMegastructureEllipse(cx,cy,rx,ry,baseColor,1);
  clipMegastructureSphere(cx,cy,rx,ry,()=>{
    for(let i=0;i<20;i++){
      const px=cx-rx*.82+h2(i,11,seed)*rx*1.58;
      const py=cy-ry*.82+h2(i,23,seed)*ry*1.58;
      const pw=2+Math.floor(h2(i,31,seed)*6), ph=1+Math.floor(h2(i,37,seed)*4);
      ctx.fillStyle=i%3===0?mixHex(baseColor,C.black,.24):mixHex(baseColor,C.white,.08);
      ctx.fillRect(Math.round(px),Math.round(py),pw,ph);
    }
    for(let i=-4;i<=4;i++) drawMegastructureLine(cx-rx*.78,cy+i*ry*.18,cx+rx*.78,cy+i*ry*.18,mixHex(C.white,C.black,.60),1,.22);
    for(let i=-4;i<=4;i++) drawMegastructureLine(cx+i*rx*.18,cy-ry*.78,cx+i*rx*.18,cy+ry*.78,mixHex(C.white,C.black,.60),1,.16);
  });
  drawMegastructureEllipse(cx,cy,rx,ry,mixHex(C.white,C.black,.36),1,0,0,Math.PI*2,true,1);
}
function drawSimpleHabitablePlanet(cx,cy,rx,ry,mode='terra'){
  const ocean=mode==='rocky'?mixHex(C.brown,C.black,.12):mixHex(C.blue,C.cyan,.16);
  const landA=mode==='rocky'?mixHex(C.brown,C.yellow,.16):mixHex(C.green,C.yellow,.14);
  const landB=mode==='rocky'?mixHex(C.brown,C.white,.20):mixHex(C.green,C.brown,.22);
  drawMegastructureEllipse(cx,cy,rx,ry,ocean,1);
  clipMegastructureSphere(cx,cy,rx,ry,()=>{
    for(let i=0;i<10;i++){
      const px=cx-rx*.7+h2(i,5,planet.seed)*rx*1.25;
      const py=cy-ry*.68+h2(i,17,planet.seed)*ry*1.20;
      const ex=rx*(.16+h2(i,29,planet.seed)*.26), ey=ry*(.10+h2(i,41,planet.seed)*.20);
      drawMegastructureEllipse(px,py,ex,ey,i%2?landA:landB,.94);
    }
    if(mode!=='rocky'){
      for(let i=0;i<8;i++){
        const px=cx-rx*.72+h2(i,61,planet.seed)*rx*1.32;
        const py=cy-ry*.72+h2(i,79,planet.seed)*ry*1.32;
        drawMegastructureEllipse(px,py,rx*(.09+h2(i,83,planet.seed)*.14),ry*(.05+h2(i,89,planet.seed)*.10),mixHex(C.white,C.blue,.12),.56);
      }
    }
  });
  drawMegastructureEllipse(cx,cy,rx,ry,mixHex(C.white,C.black,.34),1,0,0,Math.PI*2,true,1);
}
function drawMiniRingMoon(mx,my,scale=1){
  const rx=5*scale, ry=2*scale;
  drawMegastructureEllipse(mx,my,rx+1,ry+1,mixHex(C.white,C.black,.36),1,0,0,Math.PI*2,true,2);
  drawMegastructureEllipse(mx,my,rx,ry,mixHex(C.green,C.yellow,.12),1,0,0,Math.PI*2,true,1);
}
function drawBernalSphereWorld(cx,cy,t){
  const rx=Math.max(18,planet.rx+1), ry=Math.max(18,planet.ry+1);
  drawMetalPanelSphere(cx,cy,rx,ry,mixHex(C.white,C.blue,.12),0x2222);
  const cut={x:cx+rx*.18,y:cy-ry*.05,rx:rx*.56,ry:ry*.48};
  drawMegastructureEllipse(cut.x,cut.y,cut.rx+1,cut.ry+1,mixHex(C.white,C.black,.62),1);
  drawMegastructureEllipse(cut.x,cut.y,cut.rx,cut.ry,C.black,1);
  clipMegastructureSphere(cut.x,cut.y,cut.rx,cut.ry,()=>{
    drawMegastructureEllipse(cut.x+cut.rx*.12,cut.y+cut.ry*.10,cut.rx*.95,cut.ry*.92,mixHex(C.green,C.yellow,.12),1);
    drawMegastructureEllipse(cut.x+cut.rx*.08,cut.y+cut.ry*.12,cut.rx*.88,cut.ry*.32,mixHex(C.yellow,C.green,.18),.92);
    drawMegastructureLine(cut.x-cut.rx*.20,cut.y-cut.ry*.10,cut.x+cut.rx*.36,cut.y+cut.ry*.26,mixHex(C.blue,C.cyan,.08),2,.86);
    for(let i=0;i<12;i++){
      const px=cut.x-cut.rx*.75+h2(i,13,planet.seed)*cut.rx*1.45;
      const py=cut.y-cut.ry*.55+h2(i,27,planet.seed)*cut.ry*1.05;
      ctx.fillStyle=i%3===0?mixHex(C.green,C.yellow,.08):mixHex(C.brown,C.green,.18);
      ctx.fillRect(Math.round(px),Math.round(py),1+((i+1)%3===0),1);
    }
  });
  drawMegastructureEllipse(cut.x,cut.y,cut.rx,cut.ry,mixHex(C.white,C.black,.22),1,0,0,Math.PI*2,true,2);
  drawMegastructureLine(cx-rx*.18,cy+ry*.04,cx+rx*.52,cy+ry*.09,mixHex(C.white,C.black,.26),1,.78);
}
function drawRingworldPrimeWorld(cx,cy,t){
  const rx=Math.max(18,planet.rx), ry=Math.max(18,planet.ry);
  drawSimpleHabitablePlanet(cx,cy,rx,ry,'terra');
  const spin=state.simDays*.012;
  drawMegastructureEllipse(cx,cy,rx*1.48,ry*.46,mixHex(C.white,C.black,.26),1,-.16,0,Math.PI*2,true,6);
  drawMegastructureEllipse(cx,cy,rx*1.44,ry*.42,mixHex(C.green,C.yellow,.12),1,-.16,0,Math.PI*2,true,2);
  drawMegastructureEllipse(cx,cy,rx*1.35,ry*.38,mixHex(C.white,C.cyan,.14),1,-.16,0,Math.PI*2,true,1);
  const moonA=spin+1.1, mx=cx+Math.cos(moonA)*rx*1.95, my=cy+Math.sin(moonA)*ry*.95;
  for(let i=0;i<28;i++){
    const a=i/28*Math.PI*2;
    const ox=cx+Math.cos(a)*rx*1.95, oy=cy+Math.sin(a)*ry*.95;
    if(i%2===0) ctx.fillRect(Math.round(ox),Math.round(oy),1,1);
  }
  drawMiniRingMoon(mx,my,1.1);
}
function drawDomeworld(cx,cy,t){
  const rx=Math.max(18,planet.rx), ry=Math.max(18,planet.ry);
  drawSimpleHabitablePlanet(cx,cy,rx,ry,'rocky');
  clipMegastructureSphere(cx,cy,rx,ry,()=>{
    for(let i=0;i<6;i++){
      const px=cx-rx*.60+h2(i,101,planet.seed)*rx*1.18;
      const py=cy-ry*.48+h2(i,119,planet.seed)*ry*1.06;
      const dr=3+Math.floor(h2(i,137,planet.seed)*4);
      drawMegastructureEllipse(px,py+1,dr*1.05,Math.max(2,dr*.42),mixHex(C.green,C.yellow,.10),.95);
      for(let b=0;b<5;b++){
        ctx.fillStyle=mixHex(C.white,C.black,.44);
        ctx.fillRect(Math.round(px-dr*.55+h2(i,b+149,planet.seed)*dr*1.05),Math.round(py-.3+h2(b,i+163,planet.seed)*dr*.45),1,1+Math.floor(h2(b,i+179,planet.seed)*2));
      }
      drawMegastructureEllipse(px,py,dr,Math.max(2,dr*.65),mixHex(C.cyan,C.white,.14),.42);
      drawMegastructureEllipse(px,py,dr,Math.max(2,dr*.65),mixHex(C.white,C.cyan,.36),.75,0,Math.PI,Math.PI*2,true,1);
    }
  });
}
function drawVonBraunWheelWorld(cx,cy){
  const rx=Math.max(20,planet.rx+3), ry=Math.max(12,planet.ry*.54);
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(-.32);
  drawMegastructureEllipse(0,0,rx,ry,mixHex(C.white,C.black,.14),1);
  drawMegastructureEllipse(0,0,rx*.62,ry*.62,C.black,1);
  drawMegastructureEllipse(0,0,rx*.16,ry*.16,mixHex(C.white,C.black,.30),1);
  drawMegastructureEllipse(0,0,rx*.06,ry*.06,C.black,1);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3+state.simDays*.02;
    drawMegastructureLine(Math.cos(a)*rx*.12,Math.sin(a)*ry*.12,Math.cos(a)*rx*.72,Math.sin(a)*ry*.72,mixHex(C.white,C.black,.42),1,.85);
  }
  for(let i=0;i<20;i++){
    const a=i/20*Math.PI*2;
    ctx.fillStyle=i%2?mixHex(C.white,C.black,.50):mixHex(C.white,C.blue,.14);
    const px=Math.cos(a)*rx*.82, py=Math.sin(a)*ry*.82;
    ctx.fillRect(Math.round(px),Math.round(py),1,1);
  }
  ctx.restore();
}
function drawStanfordTorusWorld(cx,cy){
  const rx=Math.max(21,planet.rx+3), ry=Math.max(13,planet.ry*.56);
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(-.12);
  drawMegastructureEllipse(-8,0,rx,ry,mixHex(C.white,C.black,.16),1);
  drawMegastructureEllipse(-8,0,rx*.62,ry*.62,C.black,1);
  drawMegastructureEllipse(-8,0,rx*.14,ry*.14,mixHex(C.white,C.black,.30),1);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+state.simDays*.015;
    drawMegastructureLine(-8+Math.cos(a)*rx*.14,Math.sin(a)*ry*.14,-8+Math.cos(a)*rx*.70,Math.sin(a)*ry*.70,mixHex(C.white,C.black,.44),1,.82);
  }
  drawMegastructureLine(8,0,46,0,mixHex(C.white,C.black,.40),1,.92);
  drawMegastructureEllipse(17,0,7,4,mixHex(C.white,C.black,.20),1);
  drawMegastructureEllipse(17,0,4,2,C.black,1);
  for(let i=0;i<6;i++) drawMegastructureLine(8+i*6,-1,11+i*6,1,mixHex(C.white,C.black,.56),1,.62);
  ctx.fillStyle=mixHex(C.white,C.blue,.18);
  ctx.fillRect(47,-2,6,4);
  ctx.restore();
}
function drawCylinderHabitatWorld(cx,cy){
  const len=Math.max(48,planet.rx*2.25), r=Math.max(11,planet.ry*.74), angle=-.34;
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(angle);
  ctx.fillStyle=mixHex(C.white,C.black,.18);
  ctx.fillRect(-len*.36,-r,len*.72,r*2);
  drawMegastructureEllipse(-len*.36,0,r*.58,r,mixHex(C.white,C.black,.14));
  drawMegastructureEllipse(len*.36,0,r*.58,r,mixHex(C.white,C.black,.26));
  ctx.beginPath();
  ctx.moveTo(-len*.36,-r); ctx.lineTo(len*.36,-r); ctx.lineTo(len*.36,r); ctx.lineTo(-len*.36,r); ctx.closePath(); ctx.clip();
  const winX=-len*.18, winW=len*.38;
  ctx.fillStyle=mixHex(C.cyan,C.white,.14);
  ctx.fillRect(winX,-r*.44,winW,r*.88);
  ctx.fillStyle=mixHex(C.green,C.yellow,.12);
  ctx.fillRect(winX+1,-r*.16,winW-2,r*.20);
  ctx.fillStyle=mixHex(C.blue,C.cyan,.12);
  ctx.fillRect(winX+1,r*.05,winW-2,r*.14);
  for(let i=0;i<7;i++){
    const lx=winX+2+i*(winW-4)/6;
    drawMegastructureLine(lx,-r*.42,lx,r*.42,mixHex(C.white,C.black,.40),1,.58);
  }
  for(let i=0;i<10;i++){
    const x=-len*.31+i*(len*.62/9);
    drawMegastructureLine(x,-r*.88,x,r*.88,mixHex(C.white,C.black,.46),1,.34);
  }
  ctx.restore();
}
function drawBishopRingWorld(cx,cy){
  const rx=Math.max(30,planet.rx*1.10), ry=Math.max(12,planet.ry*.36);
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(-.18);
  drawMegastructureEllipse(0,0,rx,ry,mixHex(C.white,C.black,.20),1,0,0,Math.PI*2,true,7);
  drawMegastructureEllipse(0,0,rx,ry,mixHex(C.green,C.yellow,.14),1,0,0,Math.PI*2,true,3);
  drawMegastructureEllipse(0,0,rx*.72,ry*.56,C.black,1);
  drawTinyArtificialSun(0,0,5);
  ctx.restore();
}
function drawShellworldWorld(cx,cy){
  const rx=Math.max(20,planet.rx), ry=Math.max(20,planet.ry);
  const outer=mixHex(C.white,C.brown,.18), mid=mixHex(C.white,C.blue,.18), inner=mixHex(C.white,C.yellow,.14);
  drawMetalPanelSphere(cx,cy,rx,ry,outer,0x113);
  clipMegastructureSphere(cx,cy,rx,ry,()=>{
    for(let i=0;i<10;i++){
      const a=i/10*Math.PI*2+state.simDays*.006;
      drawMegastructureLine(cx+Math.cos(a)*rx*.18,cy+Math.sin(a)*ry*.18,cx+Math.cos(a)*rx*.76,cy+Math.sin(a)*ry*.76,mixHex(C.white,C.black,.56),1,.12);
    }
  });
  const cut1={x:cx+rx*.14,y:cy-ry*.04,r:Math.min(rx,ry)*.34};
  drawMegastructureHex(cut1.x,cut1.y,cut1.r+1,mixHex(C.white,C.black,.62),1,false,1,state.simDays*.008);
  drawMegastructureHex(cut1.x,cut1.y,cut1.r,C.black,1,false,1,state.simDays*.008);
  drawMegastructureEllipse(cut1.x,cut1.y,cut1.r*.88,cut1.r*.88,mid,1);
  clipMegastructureSphere(cut1.x,cut1.y,cut1.r*.88,cut1.r*.88,()=>{
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2-state.simDays*.010;
      drawMegastructureLine(cut1.x+Math.cos(a)*cut1.r*.18,cut1.y+Math.sin(a)*cut1.r*.18,cut1.x+Math.cos(a)*cut1.r*.78,cut1.y+Math.sin(a)*cut1.r*.78,mixHex(C.white,C.black,.46),1,.18);
    }
  });
  const cut2={x:cut1.x+cut1.r*.10,y:cut1.y+cut1.r*.02,r:cut1.r*.56};
  drawMegastructureHex(cut2.x,cut2.y,cut2.r+1,mixHex(C.white,C.black,.62),1,false,1,-state.simDays*.010);
  drawMegastructureHex(cut2.x,cut2.y,cut2.r,C.black,1,false,1,-state.simDays*.010);
  drawMegastructureEllipse(cut2.x,cut2.y,cut2.r*.88,cut2.r*.88,inner,1);
  drawMegastructureHex(cut2.x+cut2.r*.08,cut2.y,cut2.r*.34,C.black,1,false,1,state.simDays*.014);
  drawMegastructureEllipse(cut2.x+cut2.r*.08,cut2.y,cut2.r*.30,cut2.r*.30,mixHex(C.green,C.blue,.12),.96);
  const orbitR=rx*1.42, sunA=state.simDays*.018;
  for(let i=0;i<28;i++) if(i%2===0){
    const a=i/28*Math.PI*2;
    ctx.fillRect(Math.round(cx+Math.cos(a)*orbitR),Math.round(cy+Math.sin(a)*orbitR*.52),1,1);
  }
  drawTinyArtificialSun(cx+Math.cos(sunA)*orbitR,cy+Math.sin(sunA)*orbitR*.52,4);
}
function drawSpecialMegastructure(cx,cy,t){
  if(planet.renderer==='bernalsphere'){ drawBernalSphereWorld(cx,cy,t); return true; }
  if(planet.renderer==='ringworldprime'){ drawRingworldPrimeWorld(cx,cy,t); return true; }
  if(planet.renderer==='domeworld'){ drawDomeworld(cx,cy,t); return true; }
  if(planet.renderer==='wheelstation'){ drawVonBraunWheelWorld(cx,cy); return true; }
  if(planet.renderer==='torushab'){ drawStanfordTorusWorld(cx,cy); return true; }
  if(planet.renderer==='cylinderhab'){ drawCylinderHabitatWorld(cx,cy); return true; }
  if(planet.renderer==='bishopring'){ drawBishopRingWorld(cx,cy); return true; }
  if(planet.renderer==='shellworld'){ drawShellworldWorld(cx,cy); return true; }
  return false;
}

function drawPlanet(cx,cy,t){
  if(isCubePlanet()) { drawMinecraftCube(cx,cy,t); return; }
  if(isHaloRingWorld()) { drawHaloRingWorld(cx,cy,t); return; }
  if(drawSpecialMegastructure(cx,cy,t)) return;
  if(planet.renderer==='dyson') { drawDysonSphereWorld(cx,cy,t); return; }
  const normalView=state.viewMode===0, atmosphereView=state.viewMode===2, showEnvironment=normalView||atmosphereView;
  if(normalView) drawCivilizationOrbitObjects(cx,cy,false);
  drawLoreSetpieces(cx,cy,false);
  if(planet.renderer==='eyeuniverse') drawEyeUniverseCloud(cx,cy);
  drawMoons(cx,cy,t,false); ringPoints(cx,cy,false); if(showEnvironment) drawAtmosphereLimb(cx,cy);
  // The procedural world texture is cached offscreen. Rotation, moons, rings,
  // ships and every other visible motion still update at the 60 FPS render loop.
  renderPlanetSurfaceImage(cx,cy);
  drawDarkBrambleSilhouette(cx,cy);
  if(planet.renderer==='eyeuniverse') drawEyeUniverseGlyph(cx,cy);
  if(planet.renderer==='brittlehollow') drawBrittleHollowBlackHole(cx,cy);
  if(normalView) drawNormalAtmosphereHaze(cx,cy);
  // NORMAL shows the full atmosphere. CLEAN and TEMPERATURE intentionally strip it away.
  if(showEnvironment){
    drawProceduralCloudLayers(cx,cy);
    if(planet.renderer==='quantummoon') drawQuantumMoonFog(cx,cy);
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
function getPlanetInfoLayout(){
  ensurePlanetCacheContext();
  const scanned=isScanned({type:'planet'}),rev=renderCache.infoRevision;
  const cached=renderCache.planetInfo;
  if(cached && cached.seed===planet.seed && cached.scanned===scanned && cached.rev===rev) return cached;
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
  const panelW=scanned?280:168,pad=8,columnGap=10,normalW=scanned?127:146,probeW=scanned?127:0;
  const nameLines=wrapText(planet.name,normalW,1),classLines=wrapText(halo?'FORERUNNER HALO':worldClass(),normalW,1);
  const normalLabelW=measureInfoLabelWidth(baseRows,normalW);
  let normalH=Math.max(1,nameLines.length)*9+Math.max(1,classLines.length)*9+4;
  for(const [label,value] of baseRows) normalH+=infoFieldHeight(label,value,normalW,normalLabelW);
  let narrative='',probeH=0,scanModel=null,probeLabelW=null;
  if(scanned){
    narrative=halo?(planet.loreReport||planet.lifeText||''):lifeProbeObservation();
    scanModel=deepScanModelForPlanet();
    probeLabelW=measureInfoLabelWidth(scanModel.rows,probeW);
    probeH=12;
    if(narrative) probeH+=measureNarrative(narrative,probeW)+4;
    probeH+=measureDeepScanModel(scanModel,probeW,probeLabelW)+6;
  }
  const contentH=scanned?Math.max(normalH,probeH):normalH;
  const contentCanvas=document.createElement('canvas');
  contentCanvas.width=Math.max(1,panelW-pad*2); contentCanvas.height=Math.max(1,Math.ceil(contentH));
  const contentCtx=contentCanvas.getContext('2d',{alpha:true}); contentCtx.imageSmoothingEnabled=false;
  const layout={seed:planet.seed,scanned,rev,halo,baseRows,panelW,pad,columnGap,normalW,probeW,nameLines,classLines,normalLabelW,narrative,scanModel,probeLabelW,contentH,panelH:Math.min(232,contentH+pad*2),contentCanvas};
  withDrawingContext(contentCtx,()=>{
    nameLines.forEach((line,i)=>drawText(line,0,i*9,C.white,1));
    let yy=Math.max(1,nameLines.length)*9;
    classLines.forEach((line,i)=>drawText(line,0,yy+i*9,C.green,1));
    yy+=Math.max(1,classLines.length)*9+4;
    for(const [label,value,color] of baseRows) yy=drawInfoField(label,value,0,yy,normalW,color,normalLabelW);
    if(scanned){
      const probeX=normalW+columnGap,separatorX=normalW+Math.floor(columnGap/2);
      ctx.globalAlpha=.35;ctx.fillStyle=C.purple;
      for(let sy=0;sy<contentH;sy+=4) ctx.fillRect(separatorX,sy,1,2);
      ctx.globalAlpha=1;
      drawText('PROBE DATA',probeX,0,C.purple,1);
      let py=12;
      if(narrative){
        py=drawNarrative(halo?'INSTALLATION DATA':'LIFE OBSERVED',narrative,probeX,py,probeW,C.green,halo?C.white:C.green);
        py+=4;
      }
      drawDeepScanModel(scanModel,probeX,py,probeW,probeLabelW);
    }
  });
  return renderCache.planetInfo=layout;
}
function drawPlanetHover(cx,cy){
  const l=getPlanetInfoLayout();
  const rect=choosePlanetHoverPanelRect(cx,cy,l.panelW,l.panelH);
  const pos=beginScrollableInfoPanel(`${planet.seed}:planet:${l.scanned?'two-column-scan':'summary'}`,rect,l.contentH,l.pad);
  ctx.drawImage(l.contentCanvas,Math.round(pos.x),Math.round(pos.y));
  endScrollableInfoPanel(rect,l.contentH,l.pad);
}
function drawMoonDeepScan(m,x,y,maxPx=132,labelW=null){
  return drawDeepScanModel(deepScanModelForMoon(m),x,y,maxPx,labelW);
}
function formatPeriodDays(days){ return days<10?days.toFixed(3):days<100?days.toFixed(2):days.toFixed(1); }
function getMoonInfoLayout(body){
  ensurePlanetCacheContext();
  const m=planet.moonData[body.index]; if(!m) return null;
  const scanned=isScanned(body),rev=renderCache.infoRevision,key=`${body.index}:${scanned?1:0}:${rev}`;
  const cached=renderCache.moonInfo.get(key); if(cached) return cached;
  const vessel=m.kind==='human_ship',hasClass=!!m.loreWorldClass;
  const panelW=vessel?180:(m.kind==='heighliner'?176:164),innerW=panelW-16;
  const nameLines=wrapText(m.hoverLabel||m.name,innerW,1),classLines=hasClass?wrapText(m.loreWorldClass,innerW,1):[];
  const summaryRows=m.kind==='heighliner'?[
    ['POSITION','FIXED GUILD HOLD',C.blue],['SIZE',`${m.displayLengthKm||20} KM VESSEL`,C.brown]
  ]:[
    ['ORBIT',`${m.orbitKm.toLocaleString('en-US')} KM`,C.blue],['PERIOD',`${formatPeriodDays(m.periodDays)} DAYS`,C.green],
    [vessel?'SIZE':'RADIUS',vessel?`${(m.displayLengthKm||1.6).toFixed(1)} KM VESSEL`:`${m.radiusKm.toLocaleString('en-US')} KM MOON`,C.brown]
  ];
  const summaryLabelW=measureInfoLabelWidth(summaryRows,innerW);
  const scanModel=scanned?deepScanModelForMoon(m):null,scanLabelW=scanned?measureInfoLabelWidth(scanModel.rows,innerW):null;
  let contentH=Math.max(1,nameLines.length)*9+classLines.length*9+3;
  for(const [label,value] of summaryRows) contentH+=infoFieldHeight(label,value,innerW,summaryLabelW);
  if(scanned) contentH+=8+measureDeepScanModel(scanModel,innerW,scanLabelW); else contentH+=13;
  const contentCanvas=document.createElement('canvas');contentCanvas.width=Math.max(1,innerW);contentCanvas.height=Math.max(1,Math.ceil(contentH));
  const contentCtx=contentCanvas.getContext('2d',{alpha:true});contentCtx.imageSmoothingEnabled=false;
  const l={m,scanned,vessel,hasClass,panelW,innerW,nameLines,classLines,summaryRows,summaryLabelW,scanModel,scanLabelW,contentH,panelH:Math.min(224,contentH+16),contentCanvas};
  withDrawingContext(contentCtx,()=>{
    nameLines.forEach((line,i)=>drawText(line,0,i*9,C.white,1));
    let yy=Math.max(1,nameLines.length)*9+2;
    if(hasClass){classLines.forEach((line,i)=>drawText(line,0,yy+i*9,C.green,1));yy+=classLines.length*9;}
    for(const [label,value,color] of summaryRows) yy=drawInfoField(label,value,0,yy,innerW,color,summaryLabelW);
    if(scanned){yy+=8;drawMoonDeepScan(m,0,yy,innerW,scanLabelW);}
    else drawText('PROBE DATA LOCKED',0,yy+4,C.purple,1);
  });
  renderCache.moonInfo.set(key,l); return l;
}
function drawMoonHover(body,cx,cy){
  const l=getMoonInfoLayout(body); if(!l) return [];
  const rect=chooseMoonHoverPanelRect(body,l.panelW,l.panelH);
  const pos=beginScrollableInfoPanel(`${planet.seed}:moon-${body.index}:${l.scanned?'scan':'locked'}`,rect,l.contentH,8);
  ctx.drawImage(l.contentCanvas,Math.round(pos.x),Math.round(pos.y));
  endScrollableInfoPanel(rect,l.contentH,8);
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
  if(state.hovered && !(state.hideCameraCaptureTip && state.hovered.id==='camera')){
    const target=state.hovered.id==='probe'?(state.pinnedBody||state.hoverBody||{type:'planet'}):null;
    let tip=target?`LAUNCH PROBE: ${bodyName(target)}`:state.hovered.tip;
    if(state.hovered.id==='temp') tip=`VIEW ${viewModeName()} -> ${viewModeName(nextViewMode())}`;
    if(state.hovered.id==='rocket') tip=canLaunchCivilizationRocket()?'LAUNCH CIVILIZATION ROCKET':noLocalOrbit()?'ROCKET LOCKED: LOCAL ORBIT RESTRICTED':'ROCKET LOCKED: NO ACTIVE SPACEFLIGHT';
    if(state.hovered.id==='camera') tip='CLICK: PICTURE  HOLD 2S: FULL  HOLD 5S: MONITOR';
    if(state.cameraHold?.active && state.hovered.id==='camera'){
      const held=(performance.now()-state.cameraHold.startAt)/1000;
      if(state.cameraHold.triggered) tip='MONITOR-SIZE SCREENSHOT SAVED';
      else if(held<2) tip=`HOLD FOR FULL SCREENSHOT ${(2-held).toFixed(1)}S`;
      else tip=`FULL READY - HOLD FOR MONITOR ${(5-held).toFixed(1)}S`;
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
  if(!h || !h.active || h.triggered || !state.mouse.down) return;
  // The 2-second tier is intentionally armed rather than fired immediately.
  // That lets a user continue holding to 5 seconds without receiving both the
  // normal full screenshot and the monitor-resolution screenshot.
  if(t-h.startAt>=5000){
    h.triggered=true;
    takeScreenshot({monitor:true});
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
function setTemp(v,{interactive=false}={}){
  const next=clamp(v,0,1); if(next===state.temp) return;
  state.temp=next;
  syncSolarTemperatureState(planet);
  if(interactive){
    invalidateSurfaceCache();
    const now=performance.now();
    if(now-renderCache.lastInteractiveInfoRefreshAt>=80){
      invalidateInfoCache();
      renderCache.lastInteractiveInfoRefreshAt=now;
    }
    return;
  }
  invalidatePlanetPresentation();
  saveTemp();
  syncUrl();
}
function finishSliderDrag(){
  if(!state.draggingSlider) return;
  state.draggingSlider=false;
  // Force one exact climate/report rebuild for the final thumb position, then
  // persist/share it once instead of hammering storage + URL on every pixel.
  invalidatePlanetPresentation();
  renderCache.lastInteractiveInfoRefreshAt=0;
  saveTemp();
  syncUrl();
}
function toggleMute(){ state.muted=!state.muted; audio.muted=state.muted; startAudio(); }
function doAction(id){
  startAudio(); state.intro=false;
  switch(id){
    case 'log': state.libraryOpen=!state.libraryOpen; state.librarySelection=0; state.lifePanelFocused=false; break;
    case 'probe': launchProbe(); break;
    case 'temp': state.viewMode=nextViewMode(); state.tempView=state.viewMode===3; invalidatePlanetPresentation(); showToast(`VIEW: ${viewModeName()}`); break;
    case 'reverse': state.reverse=!state.reverse; break;
    case 'pause': state.paused=!state.paused; showToast(state.paused?'TIME PAUSED':'TIME RESUMED'); break;
    case 'fast': state.speedIndex=(state.speedIndex+1)%4; break;
    case 'rocket': launchCivilizationRocket(); break;
    case 'camera': takeScreenshot({full:false}); break;
    case 'mute': toggleMute(); break;
    case 'random': randomVisit(); break;
  }
}
function downloadScreenshot(png,mode='clean',size=null){
  try{
    const a=document.createElement('a');
    const safe=planet.name.replace(/[^A-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'planet';
    const suffix=mode==='monitor'&&size?`-monitor-${size.w}x${size.h}`:mode==='full'?'-full':'';
    a.download=`planetarium-${safe.toLowerCase()}${suffix}.png`;
    a.href=png || canvas.toDataURL('image/png');
    a.click();
  }catch{}
}
function monitorCaptureSize(){
  const dpr=Math.max(1,Number(window.devicePixelRatio)||1);
  const sw=Math.max(W,Math.round((window.screen?.width||W)*dpr));
  const sh=Math.max(H,Math.round((window.screen?.height||H)*dpr));
  // 8K is already a very large PNG and covers normal desktop monitors while
  // preventing pathological browser/virtual-display values from allocating an
  // enormous temporary canvas.
  const maxPixels=7680*4320;
  const pixels=sw*sh;
  if(pixels<=maxPixels) return {w:sw,h:sh};
  const scale=Math.sqrt(maxPixels/pixels);
  return {w:Math.max(W,Math.floor(sw*scale)),h:Math.max(H,Math.floor(sh*scale))};
}
function monitorScreenshotData(){
  const size=monitorCaptureSize();
  const out=document.createElement('canvas');
  out.width=size.w; out.height=size.h;
  const g=out.getContext('2d',{alpha:true});
  if(!g) return {png:'',size};
  g.imageSmoothingEnabled=false;
  // Keep any monitor-aspect-ratio padding transparent instead of adding
  // black letterbox bars. The Planetarium frame itself remains unchanged.
  g.clearRect(0,0,size.w,size.h);
  const scale=Math.min(size.w/W,size.h/H);
  const dw=Math.max(1,Math.round(W*scale)),dh=Math.max(1,Math.round(H*scale));
  const dx=Math.floor((size.w-dw)/2),dy=Math.floor((size.h-dh)/2);
  g.drawImage(canvas,0,0,W,H,dx,dy,dw,dh);
  let png='';
  try{ png=out.toDataURL('image/png'); }catch{}
  return {png,size};
}
function captureUiScreenshot(kind){
  // Camera hold/status copy is useful while choosing a capture tier, but it is
  // transient interaction feedback and should not be baked into the saved UI.
  // Hide only the camera tooltip, allow the normal render loop to paint a clean
  // UI frame, capture it, then restore the live overlay immediately afterward.
  state.hideCameraCaptureTip=true;
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      let png='',size=null;
      if(kind==='monitor'){
        const shot=monitorScreenshotData();
        png=shot.png; size=shot.size;
      }else{
        try{ png=canvas.toDataURL('image/png'); }catch{}
      }
      state.hideCameraCaptureTip=false;
      flash();
      requestAnimationFrame(()=>downloadScreenshot(png,kind,size));
    });
  });
}
function takeScreenshot(options={}){
  const monitor=!!options.monitor,full=!!options.full;
  if(monitor){
    captureUiScreenshot('monitor');
    return;
  }
  if(full){
    captureUiScreenshot('full');
    return;
  }
  state.captureMode='clean';
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      let png='';
      try{ png=canvas.toDataURL('image/png'); }catch{}
      state.captureMode=null;
      flash();
      requestAnimationFrame(()=>downloadScreenshot(png,'clean'));
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
function updateSliderFromPoint(p){ setTemp((p.x-UI.sliderX)/(UI.sliderW-7),{interactive:true}); }
function buttonAtPoint(p){
  for(const b of UI.buttons){
    if(p.x>=b.x-4&&p.x<=b.x+15&&p.y>=UI.buttonY-5&&p.y<=UI.buttonY+15) return b;
  }
  return null;
}
canvas.addEventListener('pointermove',ev=>{ const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true,pointerType:ev.pointerType||'mouse'};if(state.draggingSlider)updateSliderFromPoint(p); if(state.cameraHold && state.cameraHold.active && (!buttonAtPoint(p) || buttonAtPoint(p).id!=='camera')) state.cameraHold=null; });
canvas.addEventListener('pointerenter',ev=>{const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true,pointerType:ev.pointerType||'mouse'};});
canvas.addEventListener('pointerleave',()=>{state.mouse.inside=false;finishSliderDrag();state.mouse.down=false;state.cameraHold=null;if(state.mouse.pointerType==='mouse' && !state.moonHoverGrace)state.hoverBody=null;});
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
  const heldMs=hold?.active?performance.now()-hold.startAt:0;
  state.mouse.down=false;finishSliderDrag();
  if(hold?.active && !hold.triggered){
    if(heldMs>=5000) takeScreenshot({monitor:true});
    else if(heldMs>=2000) takeScreenshot({full:true});
    else takeScreenshot({full:false});
  }
  state.cameraHold=null;
});
canvas.addEventListener('pointercancel',()=>{state.mouse.down=false;finishSliderDrag();state.cameraHold=null;});
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
