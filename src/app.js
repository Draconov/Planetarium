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
    { id:'temp', x:346, key:'TAB', icon:'s_UI_temp', tip:'TEMPERATURE VIEW' },
    { id:'reverse', x:366, key:'1', icon:'s_UI_reverse', tip:'REVERSE TIME' },
    { id:'fast', x:386, key:'2', icon:'s_UI_fastforward', tip:'TIME SPEED' },
    { id:'rocket', x:406, key:'3', icon:'s_UI_rocket', tip:'LAUNCH ROCKET' },
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
  reverse: 's_UI_reverse_00.png', fast: 's_UI_fastforward_00.png', rocket: 's_UI_rocket_00.png',
  camera: 's_UI_camera_00.png', mute: 's_UI_mute_00.png', random: 's_UI_random_00.png'
};
for (let i=0;i<5;i++) assetNames['temp'+i] = `s_UI_temp_0${i}.png`;
for (let i=0;i<12;i++) assetNames['cloud'+i] = `s_cloud_${String(i).padStart(2,'0')}.png`;
for (let i=0;i<17;i++) assetNames['moon'+i] = `s_moon_${String(i).padStart(2,'0')}.png`;
for (const [k,fn] of Object.entries(assetNames)) {
  const im = new Image(); im.src = 'assets/sprites/' + fn; asset[k] = im;
}

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
  for(let pi=0;pi<paras.length;pi++){
    const words=paras[pi].split(/\s+/).filter(Boolean); let line='';
    if(!words.length){ lines.push(''); continue; }
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

const syllA=['AR','BEL','CA','DA','EL','FEN','GA','HEL','IO','JAR','KA','LUM','MER','NO','OR','PHA','QUA','RAN','SOL','TA','UR','VEL','WY','XAN','YOR','ZEN'];
const syllB=['A','AE','ARA','EN','ER','IA','ION','IS','ON','ORA','OS','UM','US','YR'];
const suffix=['',' PRIME',' II',' III',' IV',' V',' MINOR',' MAJOR',' OMICRON',' BETA'];
function randomPlanetName(){
  const r=Math.random; let n=syllA[Math.floor(r()*syllA.length)] + syllB[Math.floor(r()*syllB.length)];
  if(r()<.35) n += syllA[Math.floor(r()*syllA.length)].toLowerCase();
  if(r()<.18) n += suffix[Math.floor(r()*suffix.length)];
  return n.toUpperCase();
}

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

const SPECIALS = {
  'CAT PLANET': { text:'CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET CAT PLANET.', palette:'cat', life:true },
  'EVERYBODY CAT PLANET': { text:'CAT PLANET CAT PLANET CAT PLANET. MEOW!', palette:'cat', life:true },
  'MARS': { text:'FOR ONE HUNDRED AND FIFTY YEARS HUMANS HAD THEIR EYES ON MARS, BUT IT ALWAYS PROVED TOO INHOSPITABLE. EVENTUALLY THEY LOOKED FURTHER ABROAD.', life:false, hot:true },
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
  'PLUTO': { text:'SORRY, THIS IS A PLANETARIUM, NOT A NOT-A-PLANET-ARIUM.', life:false, cold:true },
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
  'TERRA': { text:'THE BIRTHPLACE OF THE HUMAN RACE, BEFORE THEY FLED TO SARDONIA AND BEYOND. IS THAT BOB? HI, BOB!', life:true },
};
const INFO_CARDS = {
  'WHAT DO I DO?': 'CLICK AND DRAG THE SLIDER (OR PRESS LEFT AND RIGHT) TO CHANGE THE HEAT OF THE PLANET. TYPE IN NEW PLACES TO VISIT, OR PRESS ? / 0 FOR A RANDOM PLANET. PRESS THE OTHER BUTTONS TO SEE WHAT THEY DO. THERE IS NO PURPOSE, SO JUST HAVE FUN!',
  'SO YOU WANT TO LEAVE ME?': 'PRESS ESCAPE, ALT+F4, OR BETTER YET JUST STAY HERE AND SIT AMONG THE STARS!',
  "SO WHAT'S ALL THIS THEN?": 'THIS THING WAS MADE BY DANIEL LINSSEN WITH MUSIC BY DUBMOOD AS A SIDE PROJECT FOR HIS OWN AMUSEMENT. THIS RECONSTRUCTION USES NEW CODE AND THE ASSETS RECOVERED FROM YOUR COPY.',
  'WHERE CAN I GO FOR MORE?': 'THE ORIGINAL PLANETARIUM WAS MADE BY DANIEL LINSSEN. VISIT MANAGORE.ITCH.IO FOR HIS GAMES.'
};

function storageGet(key, fallback=null){ try { const v=localStorage.getItem(key); return v===null?fallback:v; } catch { return fallback; } }
function storageSet(key,v){ try { localStorage.setItem(key,v); } catch {} }

const state = {
  name: storageGet('planetarium:lastName','PLANET'),
  input: '', temp: .50, tempView:false, reverse:false, speedIndex:1, muted:false,
  phase:0, intro:true, introUntil: performance.now()+9000, mouse:{x:-20,y:-20,down:false,inside:false},
  draggingSlider:false, hovered:null, rocket:null, history:[], historyPos:-1, info:null,
  lastTime:performance.now(), twinkle:0, cameraFlash:0, infoTitle:null
};
try { state.history = JSON.parse(storageGet('planetarium:history','[]')) || []; } catch { state.history=[]; }

let planet=null;
function pick(r, arr){ return arr[Math.floor(r()*arr.length)]; }
function generatePlanet(name){
  name=(name || 'PLANET').trim().toUpperCase().slice(0,60) || 'PLANET';
  const seed=hashString(name), r=mulberry32(seed);
  const special=SPECIALS[name] || null;
  const p={name,seed,special};
  p.radius = special && name==='VERY PLANET' ? 54 : 43+Math.floor(r()*18);
  p.rx = p.radius*(.88+r()*.22); p.ry=p.radius*(.91+r()*.18);
  p.water=.28+r()*.45; p.mount=.70+r()*.18; p.beach=.025+r()*.035;
  p.cloudCover=.14+r()*.6; p.cloudSpeed=(.12+r()*.35)*(r()<.5?-1:1);
  p.target=.18+r()*.68; p.variance=.07+r()*.10;
  p.moons = Math.min(4, Math.floor(r()*4.1));
  p.ring = r()<.15 || ['SATURN','MAGRATHEA','SINGULARITY'].includes(name);
  p.ringTilt = -.34+r()*.68;
  p.rotation=(r()*2-1)*(.18+r()*.24);
  p.radiusKm=Math.round(1600+p.radius*100+r()*2400);
  p.terrainSeed=(seed^0x9e3779b9)>>>0;
  p.stars=[]; const sr=mulberry32(seed^0x62a9d9ed);
  for(let i=0;i<78;i++) p.stars.push({x:Math.floor(sr()*W),y:Math.floor(sr()*238),b:sr(),tw:sr()*6.28});
  p.clouds=[];
  const cn=Math.floor(4+p.cloudCover*15);
  for(let i=0;i<cn;i++) p.clouds.push({lon:r(),lat:.15+r()*.7,frame:Math.floor(r()*12),off:r()*6.28});
  p.moonData=[];
  for(let i=0;i<p.moons;i++) p.moonData.push({orbit:p.radius+24+i*13+r()*16,phase:r()*6.28,speed:(.08+r()*.13)*(i%2?-1:1),frame:Math.floor(r()*17),size:.65+r()*.35});
  const loc=pick(r,Object.keys(locationParts));
  p.lifeText=`THE ${pick(r,locationParts[loc])} ARE HOME TO ${pick(r,quant)} ${pick(r,looks)} ${pick(r,build)} ${pick(r,creatures)}. SOME OF THEM APPEAR TO BE ${pick(r,behaviours)}.`;
  p.noLifeText = r()<.5 ? 'PRESENTLY, NO LIFE REMAINS.' : 'NO SIGNS OF LIFE ARE VISIBLE AT THIS TEMPERATURE.';
  const saved=parseFloat(storageGet('planetarium:temp:'+seed,''));
  state.temp=Number.isFinite(saved)?clamp(saved,0,1):(special?.cold?.12:special?.hot?.84:clamp(p.target+(r()-.5)*.4,0,1));
  state.info=INFO_CARDS[name] || null;
  state.infoTitle=state.info ? name : null;
  storageSet('planetarium:lastName',name);
  return p;
}
function visit(name, addHistory=true){
  name=(name||'').trim(); if(!name) return;
  if(addHistory){
    if(!state.history.length || state.history[state.history.length-1]!==name.toUpperCase()) state.history.push(name.toUpperCase());
    state.history=state.history.slice(-40); state.historyPos=state.history.length; storageSet('planetarium:history',JSON.stringify(state.history));
  }
  state.name=name.toUpperCase(); state.input=''; state.intro=false; state.phase=0; state.rocket=null;
  planet=generatePlanet(state.name);
}
function randomVisit(){ visit(randomPlanetName()); }
planet=generatePlanet(state.name);

function isAlive(){
  if(planet.special && typeof planet.special.life==='boolean') return planet.special.life;
  return Math.abs(state.temp-planet.target)<=planet.variance;
}
function tempC(){ return Math.round(-78 + state.temp*156); }
function tempBand(){ return clamp(Math.floor(state.temp*5),0,4); }

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
  const x=lon*32, y=lat*17;
  const n=fbm(x,y,planet.terrainSeed);
  const ridge=Math.abs(.5-valueNoise(x*.8+11,y*.8-7,planet.terrainSeed^0x51ed,64))*2;
  return {n, ridge};
}
function surfaceColor(lon,lat,normY,nx,z){
  const q=terrainAt(lon,lat), tempLocal=state.temp - Math.abs(lat-.5)*.63 + (q.n-.5)*.12;
  let col;
  const iceLine=clamp(.31 + state.temp*.33, .25,.64);
  const polar=Math.abs(lat-.5) > iceLine;
  const threshold=.57 + (planet.water-.5)*.28;
  if(polar || tempLocal<.055) col=C.white;
  else if(q.n < threshold-planet.beach) col=(q.n<threshold-.14?C.blue:C.cyan);
  else if(q.n < threshold+planet.beach) col=C.yellow;
  else if(q.n > planet.mount || q.ridge>.86) col=C.brown;
  else if(tempLocal>.72) col=C.yellow;
  else col=C.green;

  if(state.tempView){
    const heat=clamp(tempLocal,0,1);
    col = heat<.2?C.blue : heat<.4?C.cyan : heat<.6?C.green : heat<.8?C.yellow : C.red;
  }
  // chunky spherical shading, intentionally subtle like the original flat pixel art
  const light=clamp((z*.62 + (-nx*.22) + .28),0,1);
  if(light<.34) col=mixHex(col,C.black,.34);
  else if(light<.53) col=mixHex(col,C.black,.13);
  return col;
}
function ringPoints(cx,cy,front){
  if(!planet.ring) return;
  const a=planet.rx*1.52, b=Math.max(7,planet.ry*.27), rot=planet.ringTilt;
  ctx.fillStyle=planet.special?.dark?C.red:C.purple;
  for(let i=0;i<240;i++){
    const th=i/240*Math.PI*2;
    const ysign=Math.sin(th);
    if((front && ysign<0)||(!front && ysign>=0)) continue;
    if((i+Math.floor(planet.seed%13))%5===0) continue;
    const ex=Math.cos(th)*a, ey=Math.sin(th)*b;
    const x=cx+ex*Math.cos(rot)-ey*Math.sin(rot), y=cy+ex*Math.sin(rot)+ey*Math.cos(rot);
    if(i%2===0) ctx.fillRect(Math.round(x),Math.round(y),1,1);
  }
}
function drawMoons(cx,cy,t,front){
  for(const m of planet.moonData){
    const ang=m.phase+t*.001*m.speed;
    const yDepth=Math.sin(ang);
    if((front && yDepth<0)||(!front && yDepth>=0)) continue;
    const x=cx+Math.cos(ang)*m.orbit, y=cy+Math.sin(ang)*m.orbit*.34;
    const im=asset['moon'+m.frame];
    const sc=m.size;
    if(im && im.complete && im.naturalWidth){
      const w=Math.round(im.width*sc),h=Math.round(im.height*sc);
      ctx.drawImage(im,Math.round(x-w/2),Math.round(y-h/2),w,h);
    } else { ctx.fillStyle=C.white;ctx.fillRect(Math.round(x),Math.round(y),4,4); }
  }
}
function drawPlanet(cx,cy,t){
  drawMoons(cx,cy,t,false); ringPoints(cx,cy,false);
  const minX=Math.floor(cx-planet.rx-1), maxX=Math.ceil(cx+planet.rx+1), minY=Math.floor(cy-planet.ry-1), maxY=Math.ceil(cy+planet.ry+1);
  const rot = state.phase;
  for(let y=minY;y<=maxY;y++){
    const ny=(y-cy)/planet.ry;
    if(Math.abs(ny)>1) continue;
    for(let x=minX;x<=maxX;x++){
      const nx=(x-cx)/planet.rx;
      const rr=nx*nx+ny*ny; if(rr>1) continue;
      const z=Math.sqrt(Math.max(0,1-rr));
      const lon=mod(.5+Math.atan2(nx,z)/(Math.PI*2)+rot,1);
      const lat=clamp(.5+Math.asin(ny)/Math.PI,0,1);
      ctx.fillStyle=surfaceColor(lon,lat,ny,nx,z); ctx.fillRect(x,y,1,1);
    }
  }
  // Clouds track longitude and get naturally hidden when on the rear hemisphere.
  for(const cl of planet.clouds){
    const lon=mod(cl.lon+rot*1.18+cl.off*.001,1);
    const ang=(lon-.5)*Math.PI*2;
    if(Math.cos(ang)<-.1) continue;
    const lat=(cl.lat-.5)*2;
    const px=cx+Math.sin(ang)*planet.rx*.93, py=cy+lat*planet.ry*.78;
    const im=asset['cloud'+cl.frame];
    if(im && im.complete && im.naturalWidth){ ctx.globalAlpha=.92;ctx.drawImage(im,Math.round(px-im.width/2),Math.round(py-im.height/2));ctx.globalAlpha=1; }
    else {ctx.fillStyle=C.white;ctx.fillRect(Math.round(px),Math.round(py),4,2);}
  }
  ringPoints(cx,cy,true); drawMoons(cx,cy,t,true);
}

function drawInfoPanel(x,y){
  const title = state.info ? (state.infoTitle || planet.name) : (planet.name + (planet.name.endsWith('PLANET')?'':' PLANET'));
  drawText(title,x,y,C.white,1);
  if(state.info){
    drawParagraph(state.info,x,y+14,218,C.green,1,8); return;
  }
  drawText(`${planet.radiusKm.toLocaleString('en-US')} KM`,x,y+14,C.blue,1);
  drawText(`${tempC()} C`,x+93,y+14,state.tempView?(tempBand()<2?C.cyan:tempBand()>3?C.red:C.yellow):C.white,1);
  const alive=isAlive();
  const txt=planet.special?.text || (alive?planet.lifeText:planet.noLifeText);
  drawParagraph(txt,x,y+29,218,alive?C.green:C.brown,1,8);
  if(alive && !planet.special){
    const popBase=1e3+((planet.seed>>>5)%9000000); const growth=(state.speedIndex+1)*(.1+state.temp*.2);
    const pop=Math.round(popBase*(1+growth));
    drawText(`EST. POPULATION ${pop.toLocaleString('en-US')}`,x,214,C.purple,1);
  }
}

function drawSlider(){
  const x=UI.sliderX,y=UI.sliderY;
  const back=asset.sliderBack;
  if(back && back.complete && back.naturalWidth) ctx.drawImage(back,x,y);
  else {ctx.fillStyle=mixHex(C.white,C.black,.55);ctx.fillRect(x,y+2,UI.sliderW,3);}
  const fill=Math.round(state.temp*(UI.sliderW-7));
  ctx.fillStyle = state.tempView ? (tempBand()<2?C.blue:tempBand()<3?C.green:tempBand()<4?C.yellow:C.red) : C.purple;
  ctx.fillRect(x+2,y+3,Math.max(1,fill),1);
  const knob=state.draggingSlider?asset.sliderFrontAlt:asset.sliderFront;
  const kx=x+Math.round(state.temp*(UI.sliderW-7));
  if(knob && knob.complete && knob.naturalWidth) ctx.drawImage(knob,kx,y-3);
  else {ctx.fillStyle=C.white;ctx.fillRect(kx,y-3,3,13);}
  drawText(`${tempC()}C`,x+UI.sliderW+6,y,C.white,1);
}
function drawButtons(){
  state.hovered=null;
  for(const b of UI.buttons){
    const hover=state.mouse.inside && state.mouse.x>=b.x-3 && state.mouse.x<=b.x+14 && state.mouse.y>=UI.buttonY-4 && state.mouse.y<=UI.buttonY+14;
    if(hover) state.hovered=b;
    let im=null;
    if(b.id==='temp') im=asset['temp'+tempBand()]; else im=asset[b.id];
    const active=(b.id==='temp'&&state.tempView)||(b.id==='reverse'&&state.reverse)||(b.id==='mute'&&state.muted)||(b.id==='fast'&&state.speedIndex>1);
    ctx.globalAlpha=active?1:(hover?.95:.72);
    if(im && im.complete && im.naturalWidth) ctx.drawImage(im,b.x,UI.buttonY);
    else {ctx.fillStyle=C.white;ctx.fillRect(b.x,UI.buttonY,9,9);}
    ctx.globalAlpha=1;
  }
  if(state.hovered){ drawText(`${state.hovered.tip} [${state.hovered.key}]`,472,239,C.white,1,'right'); }
}
function drawEntry(t){
  if(state.input){
    const caret=((t/430)|0)%2===0?'_':'';
    const s=`> ${state.input}${caret}`;
    drawText(s,240,238,C.white,1,'center');
  } else if(state.intro && t<state.introUntil){
    drawText('TYPE IN A NAME AND PRESS ENTER TO VISIT THAT PLANET',240,235,C.white,1,'center');
    drawText('CLICK THE QUESTION MARK (OR PRESS 0) TO GO TO A RANDOM PLANET',240,247,C.white,1,'center');
  }
}
function drawRocket(t){
  if(!state.rocket) return;
  const age=(t-state.rocket.start)/1000; if(age>3){state.rocket=null;return;}
  const p=age/3, x=state.rocket.x+state.rocket.vx*age*32, y=state.rocket.y+state.rocket.vy*age*32-age*age*12;
  const im=asset.rocketSprite;
  if(im&&im.complete&&im.naturalWidth)ctx.drawImage(im,Math.round(x),Math.round(y)); else {ctx.fillStyle=C.white;ctx.fillRect(x,y,3,3);}
  if((age*20|0)%2===0){ctx.fillStyle=C.red;ctx.fillRect(Math.round(x-2),Math.round(y+3),1,1);}
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
  const dir=state.reverse?-1:1, speeds=[.20,.55,1.7,4.2];
  state.phase=mod(state.phase+dt*planet.rotation*speeds[state.speedIndex]*dir,1);
  drawStars(t);
  const intro=state.intro && t<state.introUntil && !state.input;
  const cx=intro?240:150, cy=intro?111:116;
  drawPlanet(cx,cy,t);
  drawRocket(t);
  if(!intro) drawInfoPanel(248,78);
  drawSlider(); drawButtons(); drawEntry(t);
  if(state.cameraFlash>t){ctx.globalAlpha=.45;ctx.fillStyle=C.white;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  drawCursor();
  requestAnimationFrame(render);
}

function saveTemp(){ storageSet('planetarium:temp:'+planet.seed,String(state.temp)); }
function setTemp(v){ state.temp=clamp(v,0,1); saveTemp(); }
function toggleMute(){ state.muted=!state.muted; audio.muted=state.muted; startAudio(); }
function doAction(id){
  startAudio(); state.intro=false;
  switch(id){
    case 'temp': state.tempView=!state.tempView; break;
    case 'reverse': state.reverse=!state.reverse; break;
    case 'fast': state.speedIndex=(state.speedIndex+1)%4; break;
    case 'rocket': state.rocket={start:performance.now(),x:150+planet.rx*.45,y:116-planet.ry*.2,vx:1.5,vy:-1}; break;
    case 'camera': takeScreenshot(); break;
    case 'mute': toggleMute(); break;
    case 'random': randomVisit(); break;
  }
}
function takeScreenshot(){
  flash();
  requestAnimationFrame(()=>{
    try{
      const a=document.createElement('a'); const safe=planet.name.replace(/[^A-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'planet';
      a.download=`planetarium-${safe.toLowerCase()}.png`; a.href=canvas.toDataURL('image/png'); a.click();
    }catch{}
  });
}
function getPoint(ev){
  const r=canvas.getBoundingClientRect(); return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};
}
function sliderHit(p){ return p.x>=UI.sliderX-5&&p.x<=UI.sliderX+UI.sliderW+5&&p.y>=UI.sliderY-8&&p.y<=UI.sliderY+12; }
function updateSliderFromPoint(p){ setTemp((p.x-UI.sliderX)/(UI.sliderW-7)); }
canvas.addEventListener('pointermove',ev=>{ const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true};if(state.draggingSlider)updateSliderFromPoint(p); });
canvas.addEventListener('pointerenter',ev=>{const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true};});
canvas.addEventListener('pointerleave',()=>{state.mouse.inside=false;state.draggingSlider=false;state.mouse.down=false;});
canvas.addEventListener('pointerdown',ev=>{
  startAudio();canvas.focus();const p=getPoint(ev);state.mouse={...state.mouse,...p,down:true,inside:true};
  if(sliderHit(p)){state.draggingSlider=true;updateSliderFromPoint(p);ev.preventDefault();return;}
  for(const b of UI.buttons){if(p.x>=b.x-4&&p.x<=b.x+15&&p.y>=UI.buttonY-5&&p.y<=UI.buttonY+15){doAction(b.id);ev.preventDefault();return;}}
});
canvas.addEventListener('pointerup',()=>{state.mouse.down=false;state.draggingSlider=false;});
canvas.addEventListener('dblclick',()=>toggleFullscreen());

function historyMove(delta){
  if(!state.history.length)return;
  state.historyPos=clamp((state.historyPos<0?state.history.length:state.historyPos)+delta,0,state.history.length-1);
  state.input=state.history[state.historyPos]||'';
}
function toggleFullscreen(){
  if(document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch?.(()=>{});
}
window.addEventListener('keydown',ev=>{
  startAudio();
  if(ev.altKey && ev.key==='Enter'){ev.preventDefault();toggleFullscreen();return;}
  if(ev.key==='Tab'){ev.preventDefault();doAction('temp');return;}
  if(ev.key==='ArrowLeft'){ev.preventDefault();setTemp(state.temp-.0125);state.intro=false;return;}
  if(ev.key==='ArrowRight'){ev.preventDefault();setTemp(state.temp+.0125);state.intro=false;return;}
  if(ev.key==='ArrowDown' && !state.input){ev.preventDefault();setTemp(state.temp-.0125);state.intro=false;return;}
  if(ev.key==='ArrowUp' && !state.input){ev.preventDefault();setTemp(state.temp+.0125);state.intro=false;return;}
  if(ev.key==='ArrowUp' && state.input){ev.preventDefault();historyMove(-1);return;}
  if(ev.key==='ArrowDown' && state.input){ev.preventDefault();historyMove(1);return;}
  if(ev.key==='Enter'){
    ev.preventDefault();if(state.input.trim())visit(state.input);else state.intro=false;return;
  }
  if(ev.key==='Backspace'){ev.preventDefault();state.input=state.input.slice(0,-1);return;}
  if(ev.key==='Escape'){state.input='';state.info=INFO_CARDS['SO YOU WANT TO LEAVE ME?'];state.infoTitle='SO YOU WANT TO LEAVE ME?';state.intro=false;return;}
  if(ev.key==='0' && !state.input){ev.preventDefault();doAction('random');return;}
  if(ev.key==='1' && !state.input){ev.preventDefault();doAction('reverse');return;}
  if(ev.key==='2' && !state.input){ev.preventDefault();doAction('fast');return;}
  if(ev.key==='3' && !state.input){ev.preventDefault();doAction('rocket');return;}
  if(ev.key==='4' && !state.input){ev.preventDefault();doAction('camera');return;}
  if(ev.key==='5' && !state.input){ev.preventDefault();doAction('mute');return;}
  if(ev.key==='?' && !state.input){ev.preventDefault();doAction('random');return;}
  if(!ev.ctrlKey&&!ev.metaKey&&!ev.altKey&&ev.key.length===1 && /[ -~]/.test(ev.key)){
    ev.preventDefault();state.input=(state.input+ev.key).slice(0,60).toUpperCase();state.intro=false;
  }
});

canvas.focus();
requestAnimationFrame(render);
})();
