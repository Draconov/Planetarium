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
    { id:'probe', x:326, key:'P', icon:null, tip:'LAUNCH PROBE' },
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
  focusTL: 's_cursor_ext_00.png', focusTR: 's_cursor_ext_01.png', focusBR: 's_cursor_ext_02.png', focusBL: 's_cursor_ext_03.png',
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
const atmosphereChemistries=['NITROGEN','CO2 RICH','METHANE','SULFUR','ARGON','EXOTIC'];
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
  'WHAT DO I DO?': 'CLICK AND DRAG THE SLIDER (OR PRESS LEFT AND RIGHT) TO CHANGE THE HEAT OF THE PLANET. TYPE IN NEW PLACES TO VISIT, OR PRESS ? / 0 FOR A RANDOM PLANET. HOVER A PLANET OR MOON FOR DETAILS. CLICK A BODY TO TARGET IT, THEN PRESS P OR THE PROBE BUTTON FOR A DEEP SCAN. PRESS F FOR FAVORITES, L FOR THE PLANET LIBRARY, AND C TO COPY A SHAREABLE LINK. THERE IS NO PURPOSE, SO JUST HAVE FUN!',
  'SO YOU WANT TO LEAVE ME?': 'PRESS ESCAPE, ALT+F4, OR BETTER YET JUST STAY HERE AND SIT AMONG THE STARS!',
  "SO WHAT'S ALL THIS THEN?": 'THIS THING WAS MADE BY DANIEL LINSSEN WITH MUSIC BY DUBMOOD AS A SIDE PROJECT FOR HIS OWN AMUSEMENT. THIS RECONSTRUCTION USES NEW CODE AND THE ASSETS RECOVERED FROM YOUR COPY.',
  'WHERE CAN I GO FOR MORE?': 'THE ORIGINAL PLANETARIUM WAS MADE BY DANIEL LINSSEN. VISIT MANAGORE.ITCH.IO FOR HIS GAMES.'
};

function storageGet(key, fallback=null){ try { const v=localStorage.getItem(key); return v===null?fallback:v; } catch { return fallback; } }
function storageSet(key,v){ try { localStorage.setItem(key,v); } catch {} }

const state = {
  name: urlPlanet || storageGet('planetarium:lastName','PLANET'),
  input: '', temp: .50, tempView:false, reverse:false, speedIndex:1, muted:false,
  phase:0, simDays:0, intro:!urlPlanet, introUntil: performance.now()+9000,
  mouse:{x:-20,y:-20,down:false,inside:false,pointerType:'mouse'},
  draggingSlider:false, hovered:null, hoverBody:null, pinnedBody:null, rocket:null, probe:null,
  history:[], historyPos:-1, favorites:[], libraryOpen:false, libraryTab:'favorites', librarySelection:0, libraryRows:[],
  info:null, infoTitle:null, toastText:'', toastUntil:0,
  lastTime:performance.now(), twinkle:0, cameraFlash:0
};
try { state.history = JSON.parse(storageGet('planetarium:history','[]')) || []; } catch { state.history=[]; }
try { state.favorites = JSON.parse(storageGet('planetarium:favorites','[]')) || []; } catch { state.favorites=[]; }
state.history=state.history.filter(v=>typeof v==='string').slice(-40);
state.favorites=[...new Set(state.favorites.filter(v=>typeof v==='string').map(v=>v.toUpperCase()))].slice(0,100);

let planet=null;
function pick(r, arr){ return arr[Math.floor(r()*arr.length)]; }

const POPULATION_WORDS=['NONE','TRACE','VERY FEW','FEW','SOME','MANY','VERY MANY','ABUNDANT','MASSIVE'];
const RESOURCE_LEVELS=['TRACE','POOR','COMMON','RICH','ABUNDANT'];
const PLANET_ANOMALIES=[
  'NONE','NONE','NONE','ARTIFICIAL RADIO SIGNAL','ANCIENT RUINS','MASSIVE CRYSTALLINE FORMATIONS',
  'SUBSURFACE OCEAN','UNUSUAL MAGNETIC ACTIVITY','ABANDONED STRUCTURES','ORBITAL DEBRIS OF UNKNOWN ORIGIN',
  'MEGAFAUNA MIGRATION','IMPOSSIBLE GEOLOGICAL FORMATIONS','ARTIFICIAL SATELLITE','SUBSURFACE MICROBIAL LIFE'
];
const MOON_ANOMALIES=[
  'NONE','NONE','NONE','NONE','HOLLOW REGION','SUBSURFACE OCEAN','UNUSUAL MAGNETIC FIELD',
  'ARTIFICIAL REFLECTOR','ANCIENT IMPACT STRUCTURE','CRYSTALLINE CAVES','RADIO ECHO'
];
function makePlanetScan(p){
  const r=mulberry32((p.seed^0x74c2e317)>>>0);
  p.populationBase=2+Math.floor(r()*7);
  const pressureRanges={TRACE:[.01,.12],THIN:[.18,.78],NORMAL:[.78,1.68],DENSE:[1.7,6.8]};
  const pr=pressureRanges[p.atmosDensity]||[.5,1.5];
  let oxygen=(p.populationBase>=4?10+r()*19:r()*4);
  if(p.atmosChemistry==='METHANE'||p.atmosChemistry==='SULFUR'||p.atmosChemistry==='EXOTIC') oxygen*=.16;
  let co2=p.atmosChemistry==='CO2 RICH'?(18+r()*47):(0.1+r()*5.5);
  if(p.atmosChemistry==='METHANE') co2*=.45;
  const other=5+r()*14;
  let nitrogen=Math.max(0,100-oxygen-co2-other);
  oxygen=Math.round(oxygen*10)/10; co2=Math.round(co2*10)/10; nitrogen=Math.round(nitrogen*10)/10;
  const complexity=p.populationBase<=3?'MICROBIAL':p.populationBase<=5?'SIMPLE':p.populationBase<=7?'COMPLEX':'INTELLIGENT';
  const tech=complexity==='INTELLIGENT'?pick(r,['PRIMITIVE','PRE-INDUSTRIAL','INDUSTRIAL','EARLY SPACEFLIGHT']):'NONE';
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
    anomaly:pick(r,PLANET_ANOMALIES),
    lossRisk:r()<.045
  };
}
function makeMoonScan(p,m,index){
  const r=mulberry32(hashString(`${p.name}|MOON|${index}|DEEP-SCAN`));
  const rel=m.radiusKm/1737;
  return {
    gravity:Math.round(clamp(rel*(.08+r()*.22),.01,.52)*100)/100,
    tempBias:-38-Math.round(r()*105)-index*7,
    surface:pick(r,['ROCK / ICE','BASALT','SILICATE','ICE / ROCK','METALLIC','DUST']),
    atmosphere:pick(r,['NONE','NONE','NONE','TRACE','TRACE','THIN']),
    waterIce:pick(r,['NONE','TRACE','COMMON','RICH','ABUNDANT']),
    activity:pick(r,['DORMANT','DORMANT','TECTONIC','CRYOVOLCANIC','VOLCANIC']),
    anomaly:pick(r,MOON_ANOMALIES),
    lossRisk:r()<.035
  };
}
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
  p.radiusKm=Math.round(1600+p.radius*100+r()*2400);
  p.radiusEarth=p.radiusKm/6371;
  p.density=.72+r()*.72;
  p.gravity=clamp(p.radiusEarth*p.density,.16,2.65);
  p.massEarth=Math.max(.03,p.gravity*p.radiusEarth*p.radiusEarth);
  p.dayHours=Math.round((7+r()*43)*10)/10;
  p.yearDays=Math.round(74+r()*812);
  p.rotationDirection=r()<.16?-1:1;
  p.rotation=p.rotationDirection*(.18+r()*.24);
  p.atmosDensity=pick(r,['THIN','NORMAL','NORMAL','DENSE']);
  if(r()<.08) p.atmosDensity='TRACE';
  p.atmosChemistry=pick(r,atmosphereChemistries);
  p.terrainSeed=(seed^0x9e3779b9)>>>0;
  p.stars=[]; const sr=mulberry32(seed^0x62a9d9ed);
  for(let i=0;i<78;i++) p.stars.push({x:Math.floor(sr()*W),y:Math.floor(sr()*238),b:sr(),tw:sr()*6.28});
  p.clouds=[];
  const cn=Math.floor(4+p.cloudCover*15);
  for(let i=0;i<cn;i++) p.clouds.push({lon:r(),lat:.15+r()*.7,frame:Math.floor(r()*12),off:r()*6.28});
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
  p.moonData.forEach((m,i)=>{m.scan=makeMoonScan(p,m,i);});
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
    const upper=name.toUpperCase();
    state.history=state.history.filter(v=>v!==upper);
    state.history.push(upper);
    state.history=state.history.slice(-40); state.historyPos=state.history.length;
    storageSet('planetarium:history',JSON.stringify(state.history));
  }
  state.name=name.toUpperCase(); state.input=''; state.intro=false; state.phase=0; state.simDays=0;
  state.rocket=null; state.probe=null; state.pinnedBody=null; state.hoverBody=null; state.libraryOpen=false;
  planet=generatePlanet(state.name);
  document.title=`${planet.name} - Planetarium`;
  syncUrl();
}
function randomVisit(){ visit(randomPlanetName()); }
planet=generatePlanet(state.name);
if(Number.isFinite(urlTempC)){ state.temp=clamp((urlTempC+78)/156,0,1); storageSet('planetarium:temp:'+planet.seed,String(state.temp)); }
if(urlPlanet){
  state.history=state.history.filter(v=>v!==planet.name); state.history.push(planet.name); state.history=state.history.slice(-40);
  state.historyPos=state.history.length; storageSet('planetarium:history',JSON.stringify(state.history));
}
document.title=`${planet.name} - Planetarium`;
queueMicrotask(()=>syncUrl());

function isAlive(){
  if(planet.special && typeof planet.special.life==='boolean') return planet.special.life;
  return Math.abs(state.temp-planet.target)<=planet.variance;
}
function tempC(){ return Math.round(-78 + state.temp*156); }
function tempBand(){ return clamp(Math.floor(state.temp*5),0,4); }

function surfaceWaterPercent(){
  const freeze=state.temp<.24 ? lerp(.38,1,(state.temp/.24)) : 1;
  const boil=state.temp>.82 ? lerp(1,.35,(state.temp-.82)/.18) : 1;
  return Math.round(clamp(planet.water*freeze*boil,0,.95)*100);
}
function worldClass(){
  if(planet.special?.dark) return 'DARK WORLD';
  if(state.temp<.16) return 'ICE WORLD';
  if(state.temp>.90) return 'LAVA WORLD';
  if(state.temp>.76 && planet.water<.48) return 'DESERT WORLD';
  if(surfaceWaterPercent()>68) return 'OCEAN WORLD';
  if(planet.radiusEarth>1.35) return 'SUPER-EARTH';
  if(planet.atmosDensity==='TRACE' && planet.water<.42) return 'BARREN WORLD';
  return 'TERRESTRIAL WORLD';
}
function atmosphereLabel(){ return `${planet.atmosDensity} ${planet.atmosChemistry}`; }
function lifeLabel(){
  if(!isAlive()) return 'NONE';
  const d=Math.abs(state.temp-planet.target)/Math.max(.001,planet.variance);
  return d<.30?'ABUNDANT':d<.68?'ACTIVE':'SPARSE';
}
function populationLabel(){
  if(!isAlive()) return 'NONE';
  const d=Math.abs(state.temp-planet.target)/Math.max(.001,planet.variance);
  const penalty=d<.22?0:d<.48?1:d<.74?2:3;
  return POPULATION_WORDS[clamp(planet.populationBase-penalty,1,POPULATION_WORDS.length-1)];
}
function lifeTypeLabel(){ return isAlive()?planet.scan.lifeTypePotential:'NONE'; }
function techLevelLabel(){ return isAlive()?planet.scan.techPotential:'NONE'; }
function iceCoverPercent(){
  const cold=clamp((.43-state.temp)/.43,0,1);
  return Math.round(clamp(cold*(34+planet.water*66)+(1-planet.water)*4,0,98));
}
function bodyRef(body){ return body?.type==='moon'?{type:'moon',index:body.index}:{type:'planet'}; }
function bodyId(body){ return body?.type==='moon'?`moon-${body.index}`:'planet'; }
function bodyName(body){ return body?.type==='moon'?(planet.moonData[body.index]?.name||'MOON'):planet.name; }
function scanStorageKey(body){ return `planetarium:probe-scan:${planet.seed}:${bodyId(body)}`; }
function probeLossStorageKey(body){ return `planetarium:probe-loss:${planet.seed}:${bodyId(body)}`; }
function isScanned(body){ return storageGet(scanStorageKey(body),'0')==='1'; }
function markScanned(body){ storageSet(scanStorageKey(body),'1'); }
function scanForBody(body){ return body?.type==='moon'?planet.moonData[body.index]?.scan:planet.scan; }
function moonTemperatureC(m){ return Math.round(tempC()+m.scan.tempBias); }
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
function moonPosition(m,cx,cy){
  const ang=m.phase+(state.simDays/m.periodDays)*Math.PI*2*m.direction;
  return {ang,x:cx+Math.cos(ang)*m.orbit,y:cy+Math.sin(ang)*m.orbit*.34,depth:Math.sin(ang)};
}
function pointNearMoonOrbit(p,m,cx,cy){
  if(!p || !m) return false;
  const rx=Math.max(8,m.orbit), ry=Math.max(4,m.orbit*.34);
  const ang=Math.atan2((p.y-cy)/ry,(p.x-cx)/rx);
  const ox=cx+Math.cos(ang)*rx, oy=cy+Math.sin(ang)*ry;
  const dist=Math.hypot(p.x-ox,p.y-oy);
  const tolerance=clamp(Math.round(rx*.045),3,7);
  const nx=(p.x-cx)/Math.max(1,planet.rx), ny=(p.y-cy)/Math.max(1,planet.ry);
  if(nx*nx+ny*ny<.92) return false;
  return dist<=tolerance;
}
function drawMoonOrbit(m,cx,cy,emphasis=false){
  if(!m) return;
  const rx=m.orbit, ry=m.orbit*.34;
  const circumference=Math.PI*(3*(rx+ry)-Math.sqrt((3*rx+ry)*(rx+3*ry)));
  const spacing=clamp(Math.round(rx*.16),6,12);
  const dots=Math.max(18,Math.round(circumference/spacing));
  ctx.fillStyle=emphasis?C.purple:C.blue;
  ctx.globalAlpha=emphasis?.95:.62;
  for(let i=0;i<dots;i++){
    const th=i/dots*Math.PI*2;
    const x=cx+Math.cos(th)*rx, y=cy+Math.sin(th)*ry;
    ctx.fillRect(Math.round(x),Math.round(y),1,1);
  }
  ctx.globalAlpha=1;
}
function drawMoons(cx,cy,t,front){
  for(const m of planet.moonData){
    const pos=moonPosition(m,cx,cy); m.screenX=pos.x; m.screenY=pos.y; m.depth=pos.depth;
    if((front && pos.depth<0)||(!front && pos.depth>=0)) continue;
    const im=asset['moon'+m.frame];
    const sc=m.size;
    if(im && im.complete && im.naturalWidth){
      const w=Math.round(im.width*sc),h=Math.round(im.height*sc);
      m.hitRadius=Math.max(6,Math.max(w,h)*.55+3);
      ctx.drawImage(im,Math.round(pos.x-w/2),Math.round(pos.y-h/2),w,h);
    } else { m.hitRadius=7;ctx.fillStyle=C.white;ctx.fillRect(Math.round(pos.x),Math.round(pos.y),4,4); }
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
    const lon=mod(cl.lon+rot*1.18+state.simDays*planet.cloudSpeed*.025+cl.off*.001,1);
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

function drawBaseLabel(cx,cy){
  const right=cx+planet.rx+13;
  const x=right<366?right:Math.max(8,cx-planet.rx-13-textWidth(planet.name));
  const y=Math.round(cy-12);
  drawText(planet.name,x,y,C.white,1);
  drawText(`${planet.radiusKm.toLocaleString('en-US')} KM`,x,y+10,C.blue,1);
  if(isFavorite()) drawText('FAV',x,y+20,C.purple,1);
}
function bodyAtPoint(p,cx,cy){
  if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  for(let i=planet.moonData.length-1;i>=0;i--){
    const m=planet.moonData[i], dx=p.x-m.screenX, dy=p.y-m.screenY, hr=m.hitRadius||7;
    const mx=(m.screenX-cx)/Math.max(1,planet.rx), my=(m.screenY-cy)/Math.max(1,planet.ry);
    const hiddenBehindPlanet=m.depth<0 && mx*mx+my*my<1;
    if(!hiddenBehindPlanet && dx*dx+dy*dy<=hr*hr) return {type:'moon',index:i};
  }
  for(let i=planet.moonData.length-1;i>=0;i--){
    const m=planet.moonData[i];
    if(pointNearMoonOrbit(p,m,cx,cy)) return {type:'moon',index:i};
  }
  const nx=(p.x-cx)/Math.max(1,planet.rx+3), ny=(p.y-cy)/Math.max(1,planet.ry+3);
  if(nx*nx+ny*ny<=1) return {type:'planet'};
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
function drawPlanetDeepScan(x,y){
  const d=planet.scan;
  drawText('DEEP SCAN',x,y,C.purple,1);
  drawText(`AGE      ${d.ageBy.toFixed(1)} BY`,x,y+12,C.white,1);
  drawText(`PRESS    ${d.pressureAtm.toFixed(2)} ATM`,x,y+21,C.white,1);
  drawText(`MAG      ${d.magField}`,x,y+30,C.cyan,1);
  drawText(`O2       ${d.oxygen.toFixed(1)}%`,x,y+39,C.green,1);
  drawText(`N2       ${d.nitrogen.toFixed(1)}%`,x,y+48,C.blue,1);
  drawText(`CO2      ${d.co2.toFixed(1)}%`,x,y+57,C.yellow,1);
  drawText(`TECTONIC ${d.tectonics}`,x,y+66,C.white,1);
  drawText(`VOLCANIC ${d.volcanism}`,x,y+75,C.red,1);
  drawText(`OCEAN    ${d.oceanDepthKm.toFixed(1)} KM`,x,y+84,C.cyan,1);
  drawText(`ICE      ${iceCoverPercent()}%`,x,y+93,C.white,1);
  drawText(`LIFE     ${lifeTypeLabel()}`,x,y+102,isAlive()?C.green:C.brown,1);
  drawText(`TECH     ${techLevelLabel()}`,x,y+111,C.purple,1);
  drawText(`FE ${d.iron}  C ${d.carbon}`,x,y+120,C.brown,1);
  drawText(`U  ${d.uranium}`,x,y+129,C.brown,1);
  drawText('ANOMALY',x,y+141,C.purple,1);
  const lines=wrapText(d.anomaly,Math.max(72,W-x-6),1).slice(0,5);
  lines.forEach((line,i)=>drawText(line,x,y+151+i*8,d.anomaly==='NONE'?C.brown:C.yellow,1));
}
function drawPlanetHover(cx,cy){
  const x=clamp(Math.round(cx+planet.rx+18),202,220), y=38;
  drawText(planet.name,x,y,C.white,1);
  drawText(worldClass(),x,y+9,C.green,1);
  drawText(`TEMP       ${tempC()} C`,x,y+22,C.white,1);
  drawText(`RADIUS     ${planet.radiusEarth.toFixed(2)} EARTH`,x,y+31,C.blue,1);
  drawText(`GRAVITY    ${planet.gravity.toFixed(2)} G`,x,y+40,C.white,1);
  drawText(`WATER      ${surfaceWaterPercent()}%`,x,y+49,C.cyan,1);
  drawText(`ATMOS      ${atmosphereLabel()}`,x,y+58,C.yellow,1);
  drawText(`BIOSPHERE  ${lifeLabel()}`,x,y+67,isAlive()?C.green:C.brown,1);
  drawText(`POPULATION ${populationLabel()}`,x,y+76,isAlive()?C.green:C.brown,1);
  drawText(`DAY        ${planet.dayHours.toFixed(1)} H`,x,y+85,C.white,1);
  drawText(`YEAR       ${planet.yearDays} D`,x,y+94,C.white,1);
  drawText(`MOONS      ${planet.moons}`,x,y+103,C.purple,1);
  const scanned=isScanned({type:'planet'});
  if(scanned){
    drawPlanetDeepScan(x+130,y);
  }else{
    drawText('PROBE DATA LOCKED',x,y+116,C.purple,1);
    const txt=planet.special?.text || (isAlive()?planet.lifeText:planet.noLifeText);
    if(txt){
      drawText('OBSERVATION',x,y+130,C.purple,1);
      const maxPx=Math.min(128,W-x-5), lines=wrapText(txt,maxPx,1), visible=lines.slice(0,8);
      visible.forEach((line,i)=>drawText(line,x,y+140+i*8,isAlive()?C.green:C.brown,1));
      if(lines.length>visible.length) drawText('...',x,y+140+visible.length*8,C.purple,1);
    }
  }
}
function drawMoonDeepScan(m,x,y){
  const d=m.scan;
  drawText('DEEP SCAN',x,y,C.purple,1);
  drawText(`TEMP     ${moonTemperatureC(m)} C`,x,y+11,C.white,1);
  drawText(`GRAVITY  ${d.gravity.toFixed(2)} G`,x,y+20,C.white,1);
  drawText(`SURFACE  ${d.surface}`,x,y+29,C.brown,1);
  drawText(`ATMOS    ${d.atmosphere}`,x,y+38,C.yellow,1);
  drawText(`WATER ICE ${d.waterIce}`,x,y+47,C.cyan,1);
  drawText(`ACTIVITY ${d.activity}`,x,y+56,C.red,1);
  drawText('ANOMALY',x,y+68,C.purple,1);
  const lines=wrapText(d.anomaly,126,1).slice(0,4);
  lines.forEach((line,i)=>drawText(line,x,y+78+i*8,d.anomaly==='NONE'?C.brown:C.yellow,1));
}
function drawMoonHover(body){
  const m=planet.moonData[body.index]; if(!m) return;
  const scanned=isScanned(body), panelW=136;
  let x=Math.round(m.screenX+12); if(x+panelW>W-5) x=Math.round(m.screenX-panelW-12);
  x=clamp(x,5,W-panelW-5);
  const y=clamp(Math.round(m.screenY-28),8,scanned?114:190);
  drawText(m.name,x,y,C.white,1);
  drawText(`${m.orbitKm.toLocaleString('en-US')} KM ORBIT`,x,y+11,C.blue,1);
  drawText(`${m.periodDays.toFixed(1)} DAYS`,x,y+20,C.green,1);
  drawText(`${m.radiusKm.toLocaleString('en-US')} KM MOON`,x,y+29,C.brown,1);
  if(scanned) drawMoonDeepScan(m,x,y+43);
  else drawText('PROBE DATA LOCKED',x,y+42,C.purple,1);
}
function drawContextInfo(body,cx,cy){
  if(!body) return;
  drawObjectMarker(body,cx,cy);
  if(body.type==='moon') drawMoonHover(body); else drawPlanetHover(cx,cy);
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
function libraryItems(){ return state.libraryTab==='favorites' ? state.favorites.slice().reverse() : recentItems(); }
function drawLibraryOverlay(){
  if(!state.libraryOpen) return;
  const x=86,y=39,w=308,h=191;
  ctx.globalAlpha=.97;ctx.fillStyle=C.black;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;
  ctx.strokeStyle=C.purple;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  drawText('PLANET LIBRARY',x+12,y+13,C.white,1);
  const favRect={x:x+7,y:y+20,w:75,h:19}, recentRect={x:x+84,y:y+20,w:63,h:19};
  drawText(state.libraryTab==='favorites'?'> FAVORITES':'FAVORITES',x+12,y+29,state.libraryTab==='favorites'?C.green:C.purple,1);
  drawText(state.libraryTab==='recent'?'> RECENT':'RECENT',x+91,y+29,state.libraryTab==='recent'?C.green:C.purple,1);
  if(hoverActive()&&pointInRect(state.mouse,favRect.x,favRect.y,favRect.w,favRect.h)) drawFocusFrame(favRect.x,favRect.y,favRect.w,favRect.h);
  if(hoverActive()&&pointInRect(state.mouse,recentRect.x,recentRect.y,recentRect.w,recentRect.h)) drawFocusFrame(recentRect.x,recentRect.y,recentRect.w,recentRect.h);
  const items=libraryItems(); state.libraryRows=[];
  if(!items.length){ drawText(state.libraryTab==='favorites'?'NO FAVORITES YET - PRESS F':'NO RECENT PLANETS YET',x+12,y+54,C.brown,1); }
  const visible=items.slice(0,11);
  state.librarySelection=clamp(state.librarySelection,0,Math.max(0,visible.length-1));
  visible.forEach((name,i)=>{
    const ry=y+48+i*12, row={name,x:x+10,y:ry-5,w:w-20,h:11}; state.libraryRows.push(row);
    if(i===state.librarySelection){ctx.fillStyle=mixHex(C.purple,C.black,.48);ctx.fillRect(x+8,ry-6,w-16,10);}
    drawText(name,x+14,ry,isFavorite(name)?C.green:C.white,1);
    if(hoverActive()&&pointInRect(state.mouse,row.x,row.y,row.w,row.h)) drawFocusFrame(row.x,row.y,row.w,row.h);
  });
  drawText('F/R TABS   ENTER VISIT   L CLOSE',x+12,y+h-10,C.purple,1);
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
  ctx.fillStyle = state.tempView ? (tempBand()<2?C.blue:tempBand()<3?C.green:tempBand()<4?C.yellow:C.red) : C.purple;
  ctx.fillRect(x+2,y+3,Math.max(1,fill),1);
  const knob=state.draggingSlider?asset.sliderFrontAlt:asset.sliderFront;
  const kx=x+Math.round(state.temp*(UI.sliderW-7));
  if(knob && knob.complete && knob.naturalWidth) ctx.drawImage(knob,kx,y-3);
  else {ctx.fillStyle=C.white;ctx.fillRect(kx,y-3,3,13);}
  drawText(`${tempC()}C`,x+UI.sliderW+6,y,C.white,1);
  if(hover||state.draggingSlider) drawFocusFrame(x-5,y-8,UI.sliderW+10,21);
}
function drawButtons(){
  state.hovered=null;
  for(const b of UI.buttons){
    const hover=state.mouse.inside && state.mouse.x>=b.x-3 && state.mouse.x<=b.x+14 && state.mouse.y>=UI.buttonY-4 && state.mouse.y<=UI.buttonY+14;
    if(hover) state.hovered=b;
    let im=null;
    if(b.id==='temp') im=asset['temp'+tempBand()]; else if(b.id!=='probe') im=asset[b.id];
    const active=(b.id==='probe'&&!!state.probe)||(b.id==='temp'&&state.tempView)||(b.id==='reverse'&&state.reverse)||(b.id==='mute'&&state.muted)||(b.id==='fast'&&state.speedIndex>1);
    ctx.globalAlpha=active?1:(hover?.95:.72);
    if(b.id==='probe') drawProbeButtonIcon(b.x,UI.buttonY,active);
    else if(im && im.complete && im.naturalWidth) ctx.drawImage(im,b.x,UI.buttonY);
    else {ctx.fillStyle=C.white;ctx.fillRect(b.x,UI.buttonY,9,9);}
    ctx.globalAlpha=1;
    if(hover) drawFocusFrame(b.x-4,UI.buttonY-5,20,20);
  }
  if(state.hovered){
    const target=state.hovered.id==='probe'?(state.pinnedBody||state.hoverBody||{type:'planet'}):null;
    const tip=target?`LAUNCH PROBE: ${bodyName(target)}`:state.hovered.tip;
    drawText(`${tip} [${state.hovered.key}]`,472,239,C.white,1,'right');
  }
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
function probeTargetPosition(body,cx,cy){
  if(body?.type==='moon'){
    const m=planet.moonData[body.index];
    if(m) return {x:m.screenX,y:m.screenY};
  }
  return {x:cx+planet.rx*.18,y:cy-planet.ry*.12};
}
function launchProbe(targetOverride=null){
  if(state.probe && !['complete','lost'].includes(state.probe.phase)){ showToast('PROBE ALREADY IN FLIGHT'); return; }
  const target=bodyRef(targetOverride||state.hoverBody||state.pinnedBody||{type:'planet'});
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
function drawProbeButtonIcon(x,y,active=false){
  ctx.fillStyle=active?C.green:C.cyan;
  ctx.fillRect(x+4,y+3,3,3);
  ctx.fillStyle=C.white;
  ctx.fillRect(x+1,y+4,2,1); ctx.fillRect(x+8,y+4,2,1); ctx.fillRect(x+5,y+1,1,2);
  ctx.fillStyle=C.purple;
  ctx.fillRect(x+2,y+2,1,5); ctx.fillRect(x+8,y+2,1,5);
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
  const dir=state.reverse?-1:1, speeds=[.20,.55,1.7,4.2], speed=speeds[state.speedIndex];
  state.simDays += dt*1.15*speed*dir;
  updateProbe(dt,speed,t);
  const rotationRate=(24/planet.dayHours)*.035*planet.rotationDirection;
  state.phase=mod(state.phase+dt*rotationRate*speed*dir,1);
  drawStars(t);
  const intro=state.intro && t<state.introUntil && !state.input;
  const cx=intro?240:150, cy=intro?111:116;
  drawPlanet(cx,cy,t);
  drawProbe(cx,cy);
  drawRocket(t);
  if(!intro){
    const hovered=!state.libraryOpen&&state.mouse.inside?bodyAtPoint(state.mouse,cx,cy):null;
    state.hoverBody=hovered;
    const body=hovered || state.pinnedBody;
    if(body?.type==='moon') drawMoonOrbit(planet.moonData[body.index],cx,cy,true);
    if(!state.info && body?.type!=='planet') drawBaseLabel(cx,cy);
    if(state.info) drawHelpCard(); else if(!state.libraryOpen) drawContextInfo(body,cx,cy);
  }
  drawSlider(); drawButtons(); drawEntry(t); drawProbeStatus(); drawLibraryOverlay(); drawToast(t);
  if(state.cameraFlash>t){ctx.globalAlpha=.45;ctx.fillStyle=C.white;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
  drawCursor();
  requestAnimationFrame(render);
}

function saveTemp(){ storageSet('planetarium:temp:'+planet.seed,String(state.temp)); }
function setTemp(v){ state.temp=clamp(v,0,1); saveTemp(); syncUrl(); }
function toggleMute(){ state.muted=!state.muted; audio.muted=state.muted; startAudio(); }
function doAction(id){
  startAudio(); state.intro=false;
  switch(id){
    case 'probe': launchProbe(); break;
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
function handleLibraryPointer(p){
  if(!state.libraryOpen) return false;
  const x=86,y=39,w=308,h=191;
  if(p.x>=x+7&&p.x<=x+82&&p.y>=y+20&&p.y<=y+39){state.libraryTab='favorites';state.librarySelection=0;return true;}
  if(p.x>=x+84&&p.x<=x+147&&p.y>=y+20&&p.y<=y+39){state.libraryTab='recent';state.librarySelection=0;return true;}
  for(let i=0;i<state.libraryRows.length;i++){
    const row=state.libraryRows[i];
    if(p.x>=row.x&&p.x<=row.x+row.w&&p.y>=row.y&&p.y<=row.y+row.h){state.librarySelection=i;visit(row.name);return true;}
  }
  if(!(p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h)){state.libraryOpen=false;return true;}
  return true;
}
function getPoint(ev){
  const r=canvas.getBoundingClientRect(); return {x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};
}
function sliderHit(p){ return p.x>=UI.sliderX-5&&p.x<=UI.sliderX+UI.sliderW+5&&p.y>=UI.sliderY-8&&p.y<=UI.sliderY+12; }
function updateSliderFromPoint(p){ setTemp((p.x-UI.sliderX)/(UI.sliderW-7)); }
canvas.addEventListener('pointermove',ev=>{ const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true,pointerType:ev.pointerType||'mouse'};if(state.draggingSlider)updateSliderFromPoint(p); });
canvas.addEventListener('pointerenter',ev=>{const p=getPoint(ev);state.mouse={...state.mouse,...p,inside:true,pointerType:ev.pointerType||'mouse'};});
canvas.addEventListener('pointerleave',()=>{state.mouse.inside=false;state.draggingSlider=false;state.mouse.down=false;if(state.mouse.pointerType==='mouse')state.hoverBody=null;});
canvas.addEventListener('pointerdown',ev=>{
  startAudio();canvas.focus();const p=getPoint(ev);state.mouse={...state.mouse,...p,down:true,inside:true,pointerType:ev.pointerType||'mouse'};
  if(handleLibraryPointer(p)){ev.preventDefault();return;}
  if(sliderHit(p)){state.draggingSlider=true;updateSliderFromPoint(p);ev.preventDefault();return;}
  for(const b of UI.buttons){if(p.x>=b.x-4&&p.x<=b.x+15&&p.y>=UI.buttonY-5&&p.y<=UI.buttonY+15){doAction(b.id);ev.preventDefault();return;}}
  const intro=state.intro && performance.now()<state.introUntil && !state.input;
  const body=bodyAtPoint(p,intro?240:150,intro?111:116);
  if(body){
    state.pinnedBody=sameBody(state.pinnedBody,body)?null:body;
    ev.preventDefault(); return;
  }
  if(ev.pointerType && ev.pointerType!=='mouse'){ state.pinnedBody=null; ev.preventDefault(); }
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
  if(state.libraryOpen){
    const items=libraryItems().slice(0,11);
    if(ev.key==='Escape'||ev.key.toLowerCase()==='l'){ev.preventDefault();state.libraryOpen=false;return;}
    if(ev.key.toLowerCase()==='f'){ev.preventDefault();state.libraryTab='favorites';state.librarySelection=0;return;}
    if(ev.key.toLowerCase()==='r'){ev.preventDefault();state.libraryTab='recent';state.librarySelection=0;return;}
    if(ev.key==='ArrowUp'){ev.preventDefault();state.librarySelection=clamp(state.librarySelection-1,0,Math.max(0,items.length-1));return;}
    if(ev.key==='ArrowDown'){ev.preventDefault();state.librarySelection=clamp(state.librarySelection+1,0,Math.max(0,items.length-1));return;}
    if(ev.key==='Enter'&&items[state.librarySelection]){ev.preventDefault();visit(items[state.librarySelection]);return;}
  }
  if(!state.input && ev.key.toLowerCase()==='f'){ev.preventDefault();toggleFavorite();return;}
  if(!state.input && ev.key.toLowerCase()==='l'){ev.preventDefault();state.libraryOpen=!state.libraryOpen;state.librarySelection=0;return;}
  if(!state.input && ev.key.toLowerCase()==='c'){ev.preventDefault();sharePlanet();return;}
  if(!state.input && ev.key.toLowerCase()==='p'){ev.preventDefault();launchProbe(state.hoverBody||state.pinnedBody||{type:'planet'});return;}
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
  if(ev.key==='Escape'){
    if(state.pinnedBody){state.pinnedBody=null;return;}
    state.input='';state.info=INFO_CARDS['SO YOU WANT TO LEAVE ME?'];state.infoTitle='SO YOU WANT TO LEAVE ME?';state.intro=false;return;
  }
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
