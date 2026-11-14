import { t } from './i18n.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paletteFor, underMaterial, styledMesh, canvasTexture } from './paint.js';
import { MAP, LAYOUT, BOXES, STRUCTS, EXTRACT, height, pathDist, pathX, rng } from '../shared/layout.js';

const materials = {
  concrete: [0x77776e, .94], steel: [0x3d5055, .78], painted: [0x456665, .72],
  rust: [0x8b5540, .86], plaster: [0xb6a78b, .96], wood: [0x745644, .90],
  brick: [0x885846, .94], glass: [0x354949, .34], plastic: [0x658284, .72],
  vegetation: [0x5f7151, .95], rubber: [0x353936, .98], asphalt: [0x555754, .96],
  marking: [0xb9ae7b, .95], porcelain: [0xa7a58f, .9], snow: [0xc2d2d7, .95],
};
const box = new THREE.BoxGeometry();
const portal = new THREE.CylinderGeometry(1,1,1,12).rotateX(Math.PI/2);
const pipe = new THREE.CylinderGeometry(1, 1, 1, 10);
const round = new THREE.IcosahedronGeometry(1, 0);

const plates = new Map();
window.addEventListener('language-change', () => {for(const texture of plates.values())texture.userData.redraw();});
const grassBlade = new THREE.BufferGeometry();
grassBlade.setAttribute('position',new THREE.Float32BufferAttribute([-.36,0,0,.21,0,0,.51,1,.08],3));
grassBlade.setIndex([0,1,2]);
grassBlade.computeVertexNormals();
export function colorGround(geometry) {
  const theme = MAP.theme;
  const surface = new THREE.Color(theme.grass ?? '#82784a');
  const trail = new THREE.Color(theme.path ?? '#6a5235');
  const asphalt = new THREE.Color(materials.asphalt[0]);
  const tile = new THREE.Color(0x8d8981);
  const color = new THREE.Color();
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    const macro = Math.sin(x * .13 + Math.sin(z * .08)) * Math.cos(z * .15);
    const variation = 1 + .075 * macro + .024 * Math.sin(x * .61 + z * .27);
    if (MAP.kind === 'city') {
      const edge = Math.abs(x - pathX(z));
      color.copy(asphalt).lerp(surface, THREE.MathUtils.smoothstep(edge, 4.7, 6.5));
    } else if (MAP.kind === 'factory') {
      const lane = THREE.MathUtils.smoothstep(Math.abs(x), 2.4, 4);
      const seam = Math.min(Math.abs(Math.sin(x*Math.PI/6)),Math.abs(Math.sin((z+2)*Math.PI/6)));
      const panel = Math.sin((Math.floor(x/6)+.5)*1.7+(Math.floor((z+2)/6)+.5)*2.4)*.025;
      color.setHex(0x77766d).lerp(tile, lane * .5);
      color.multiplyScalar(.95+panel+.085*THREE.MathUtils.smoothstep(seam,0,.22));
    } else if (MAP.kind === 'mesh') color.copy(tile);
    else {
      const edge = pathDist(x, z) + macro * .38;
      color.copy(trail).lerp(surface, THREE.MathUtils.smoothstep(edge, 1.05, 3.4));
      if (theme.snow) color.multiplyScalar(.94);
    }
    color.multiplyScalar(variation).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function buildEnvironment(scene) {
  const grouped = new Map(), owned = [], practicals = [];
  const transform = new THREE.Matrix4(), rotation = new THREE.Euler(), quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  function piece(family, geometry, x, y, z, sx, sy, sz, yaw = 0, roll = 0) {
    const g = geometry.toNonIndexed();
    transform.compose(position.set(x, y, z), quaternion.setFromEuler(rotation.set(0, yaw, roll, 'YXZ')), scale.set(sx, sy, sz));
    g.deleteAttribute('uv');
    g.applyMatrix4(transform);
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family).push(g);
  }
  const block = (family, ...args) => piece(family, box, ...args);
  const tube = (family, ...args) => piece(family, pipe, ...args);
  const stone = (family, ...args) => piece(family, round, ...args);
  function sign(words, x, y, z, width, yaw = 0, tone = '#2c4446') {
    const style = `${words}|${tone}`;
    let texture = plates.get(style);
    if (!texture) {
      texture = canvasTexture(256, (g, s) => {
        g.fillStyle = tone; g.fillRect(0, 0, s, s);
        g.strokeStyle = '#b2a283'; g.lineWidth = 5; g.strokeRect(9, 19, s - 18, s - 38);
        g.fillStyle = '#e5d7ad'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 43px sans-serif'; g.fillText(t(words), s / 2, s / 2 + 2, s - 33);
      });
      texture.userData.redraw = () => {
        const g=texture.image.getContext('2d'), s=texture.image.width;
        g.fillStyle=tone;g.fillRect(0,0,s,s);
        g.strokeStyle='#b2a283';g.lineWidth=5;g.strokeRect(9,19,s-18,s-38);
        g.fillStyle='#e5d7ad';g.textAlign='center';g.textBaseline='middle';
        g.font='bold 43px sans-serif';g.fillText(t(words),s/2,s/2+2,s-33);
        texture.needsUpdate=true;
      };
      plates.set(style, texture);
    }
    const mat = new THREE.MeshBasicMaterial({map:texture, color:0xffffff});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * .26), mat);
    mesh.position.set(x,y,z); mesh.rotation.y=yaw; scene.add(mesh); owned.push(mat);
  }
  function light(x,y,z, kind = 'work') {
    const profile = kind === 'egress' ? {color:0xa2d2ab,day:.45,night:.8,range:4,power:4}
      : kind === 'street' ? {color:0xffd7a0,day:.15,night:1,range:8,power:12}
      : {color:0xffdfb0,day:1,night:.04,range:9,power:38};
    block('steel',x,y+.06,z-.035,.85,.18,.16);
    block('steel',x,y+.16,z-.09,.10,.2,.12);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.61,.055,.13), new THREE.MeshBasicMaterial({color:profile.color}));
    mesh.position.set(x,y,z+.025); scene.add(mesh); owned.push(mesh.material);
    practicals.push({p:mesh.position,c:profile.color,mesh,kind,...profile});
  }
  function lane(x,z,w,d,family='marking') {
    const y = Math.max(height(x-w*.45,z-d*.45),height(x+w*.45,z+d*.45),height(x,z));
    block(family,x,y+.025,z,w,.045,d);
  }

  if (MAP.kind === 'factory') {
    for (const roof of LAYOUT.overhead) block('steel',roof.x,roof.gy+roof.h/2,roof.z,roof.w,roof.h,roof.d);
    for (const x of [-26.5,26.5]) {
      block('glass',x,7.62,-36,.18,1.24,94);
      for(let z=-82;z<12;z+=7)block('steel',x,7.62,z,.32,1.24,.22);
    }
    for(const z of [10.5,-82.5])block('glass',0,7.62,z,53,1.24,.18);
    for (const wall of BOXES.filter(b=>b.kind==='wall')) {
      const cross = wall.w > wall.d, narrow = cross ? wall.d : wall.w;
      const floor = cross ? wall.w : wall.d;
      block('concrete',wall.x,.22,wall.z,wall.w+.05,.44,wall.d+.05);
      block('steel',wall.x,wall.h-.13,wall.z,wall.w+.09,.25,wall.d+.09);
      for (let offset=-floor/2+.22; offset<floor/2; offset+=4.4) {
        const x=cross?wall.x+offset:wall.x, z=cross?wall.z:wall.z+offset;
        block('steel',x,wall.h/2,z,cross?.21:narrow+.09,wall.h,cross?narrow+.09:.21);
      }
    }
    for (const p of LAYOUT.pillars) {
      block('concrete',p.x,.15,p.z,.92,.3,.92);
      block('painted',p.x,3.5,p.z,.44,7,.45);
      block('steel',p.x-.19,3.5,p.z,.12,7,.63);
      block('steel',p.x+.19,3.5,p.z,.12,7,.63);
      block('rust',p.x,.66,p.z,.47,.24,.64);
      block('steel',p.x,7.05,p.z,1,.22,.96);
      block('steel',p.x,7.62,p.z,.44,1.24,.45);
    }
    for (const z of [-4,-18,-34,-48,-64,-78]) {
      for (const x of [-19.75,-6.5,6.5,19.75]) {
        block('steel',x,7.23,z,13.1,.42,.27);
        block('steel',x,8.12,z,13.1,.23,.21);
        for (const [i,q] of [-4.87,-1.62,1.62,4.87].entries()) {
          block('steel',x+q,7.69,z,3.42,.13,.13,0,i%2===0?.27:-.27);
          block('steel',x+q+1.6,7.7,z,.12,.81,.18);
        }
      }
      for (const x of [-24,24]) block('steel',x,8.15,z-4,3.4,.16,8.5);
      light(-4,6.74,z); light(4,6.74,z);
    }
    for (const x of [-13,13]) {
      block('steel',x,7.23,-36,.3,.36,91);
      block('painted',x+.7,6.82,-36,.4,.38,90);
      for (const z of [-12,-26,-40,-56,-70]) block('steel',x+.7,7.04,z,.56,.75,.25);
    }
    for (const [i,machine] of BOXES.filter(b=>b.kind==='machine').entries()) {
      const {x,z,w,d,h}=machine;
      const family=i%3===0?'rust':i%3===1?'painted':'steel';
      block('concrete',x,.2,z,w,.4,d);
      block(family,x,h*.55,z,w*.93,h*.9,d*.94);
      block('steel',x,h*.82,z,w*.99,.24,d*.99);
      if(i%3===0){
        piece('steel',portal,x,h*.57,z+d*.49,h*.39,h*.39,.18);
        piece('rubber',portal,x,h*.57,z+d*.51,h*.29,h*.29,.15);
        block('rust',x,h*.64,z+d*.535,h*.52,.09,.13);
        for (const side of [-1,1]) {
          block('steel',x+side*w*.33,h*.57,z+d*.48,.17,h*.53,.21);
          block('marking',x+side*w*.3,h*.24,z+d*.49,w*.14,.08,.05);
        }
        tube('rust',x-w*.21,h+1.1,z,.36,2.5,.36);
      } else if(i%3===1){
        for(let j=0;j<4;j++)block('rubber',x-w*.3+j*w*.19,h*.56,z+d*.48,w*.07,h*.38,.10);
        tube('steel',x,h+.38,z,.66,.74,.66);
        tube('painted',x,h+1,z,.24,1.7,.24);
      } else {
        block('rubber',x,h+.06,z,w*.77,.19,d*.8);
        for(let j=0;j<5;j++)block('steel',x-w*.3+j*w*.15,h+.18,z,.10,.14,d*.72);
        block('marking',x,h*.6,z+d*.48,w*.5,.19,.1);
      }
    }
    for(const side of [-1,1])for(let z=-78;z<8;z+=3.8) {
      lane(side*2.55,z,.055,2.6);
      if(z<-5)lane(side*22.8,z,.06,2.75,'steel');
    }
    for(const [x,z,side] of [[22,-34,1],[-22,-62,-1]]) {
      block('steel',x,3.8,z,6.4,.15,12.4);
      for(const offset of [-5.9,0,5.9]) {
        block('steel',x+side*2.9,1.91,z+offset,.24,3.8,.27);
        block('rust',x-side*3.08,4.4,z+offset,.10,1.16,.10);
      }
      for(const h of [4.36,4.95])block('rust',x-side*3.06,h,z,.10,.09,12.3);
    }
    for (const [label,z] of [['RECEPTION',-25.64],['FURNACES',-55.64],['MAINTENANCE',-81.94]]) {
      sign(label,0,5.6,z,4.0,0,'#414638');
      light(-2.8,3.8,z+.17,'egress'); light(2.8,3.8,z+.17,'egress');
    }
  }

  if (MAP.kind === 'city') {
    for(let z=12;z>-76;z-=2.8){
      const x=pathX(z), a=Math.atan2(pathX(z+1)-pathX(z-1),2);
      for(const side of [-1,1]){
        block('concrete',x+side*5.35,height(x+side*5.35,z)+.04,z,1.36,.12,2.81,a);
        block('concrete',x+side*4.72,height(x+side*4.72,z)+.095,z,.15,.18,2.82,a);
      }
      if(Math.round(z/2.8)%2===0)lane(x,z,.085,1.65);
    }
    for(const z of [0,-22,-43])for(let x=-3.6;x<4;x+=1.1)lane(pathX(z)+x,z,.47,1.75,'porcelain');
    const labels = {
      env_storefront_old:['LAUNDRY', 'plaster', 'painted'], env_motel_closed:['MOTEL', 'plaster','rust'],
      env_garage_detached:['WORKSHOP','brick','steel'], env_house_ranch_b:['STATION 06','porcelain','rust'],
      env_storage_office:['24H STORE','brick','painted'], env_house_boarded:['WAREHOUSE','wood','steel'],
      env_warehouse_salvage:['LOADING','steel','painted'],
    };
    for(const building of STRUCTS){
      if(!labels[building.key])continue;
      const [name,base,trim]=labels[building.key], {x,z,w,d,gy}=building;
      const s=Math.sign(-x), front=x+s*w/2;
      const f=(family, depth,y,along,width,tall,length)=>block(family,front+s*depth,gy+y,z+along,width,tall,length);
      f(base,.015,1.75,0,.14,3.5,d*.98);
      f('concrete',.09,.16,0,.26,.32,d*.99);
      f(trim,.12,3.59,0,.36,.26,d*1.02);
      f('steel',.08,3.87,0,.24,.17,d*1.03);
      const door = -d*.22;
      f('steel',.12,1.11,door,.18,2.22,1.56);
      f('glass',.224,1.17,door,.05,1.93,1.14);
      f('porcelain',.26,1.08,door+.32,.085,.25,.10);
      for(const along of [d*.03,d*.26]){
        f('steel',.12,1.69,along,.24,1.62,d*.21);
        f('glass',.257,1.69,along,.05,1.31,d*.173);
        f(trim,.28,.99,along,.19,.13,d*.21);
        f('steel',.29,1.69,along,.14,1.5,.08);
      }
      f(trim,.41,2.68,0,.86,.18,d*.84);
      sign(name,front+s*.31,gy+3.15,z,Math.min(5.1,d*.69),s*Math.PI/2,trim==='rust'?'#77483d':'#2c4446');
      light(front+s*.56,gy+2.53,z+door,'street');
    }
    const station = STRUCTS.find(b => b.key === 'env_house_ranch_b');
    const sf = station.x - station.w / 2;
    const y = station.gy;
    block('rust',sf-.65,y+3.22,station.z,1.6,.29,6.6);
    block('porcelain',sf-.66,y+3.39,station.z,1.5,.12,6.48);
    for (const z of [station.z-2.7,station.z+2.7]) {
      block('steel',sf-.21,y+1.55,z,.2,3.1,.19);
      block('concrete',sf-.23,y+.08,z,.42,.16,.38);
    }
    const poles=LAYOUT.props.filter(p=>p.key==='env_power_pole');
    const cordMat= new THREE.MeshStandardMaterial({color:materials.rubber[0],roughness:.98});
    owned.push(cordMat);
    for(let i=1;i<poles.length;i++){
      const a=poles[i-1],b=poles[i];
      for(const dx of [-.22,.22]){
        const start=new THREE.Vector3(a.x+dx,a.y+6.05,a.z),end=new THREE.Vector3(b.x+dx,b.y+6.05,b.z);
        const middle=start.clone().lerp(end,.5);middle.y-=1.18;
        scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start,middle,end),12,.021,5,false),cordMat));
      }
    }
  }

  if (MAP.kind === 'mesh') {
    const bounds=MAP.data.bounds;
    for(let z=-27;z<=25;z+=2){
      for(const x of [-7.76,-4.62])block('porcelain',x,.022,z,.13,.035,1.97);
      if(z%6===-3||z%6===3)block('concrete',-6.22,.022,z,2.9,.034,.1);
    }
    for(const [label,z] of [['INFORMATION',20],['GALLERY',5],['SERVICE',-16]]){
      block('steel',-6.2,3.68,z,3.9,.63,.19);
      sign(label,-6.2,3.68,z+.11,2.4);
      sign(label,-6.2,3.68,z-.11,2.4,Math.PI);
      light(-6.2,3.35,z,'egress');
    }
    for(let z=-24;z<25;z+=6){
      block('steel',-6.15,4.7,z,3.36,.13,.38);
      for (const side of [-1,1]) block('plaster',-6.15+side*1.68,4.87,z,1.04,.14,5.73);
      for(const x of [-7.1,-5.25])light(x,4.58,z);
    }
    for(const b of BOXES){
      if(b.x<bounds.minX+1||b.x>bounds.maxX-1||b.w<1.5||b.w>8||b.d>.56||b.h>4.5||b.h<2.15)continue;
      for(const direction of [-1,1]){
        const edge=b.z+direction*(b.d/2+.033);
        block('steel',b.x,.19,edge,b.w+.02,.22,.075);
        block('painted',b.x,b.h-.21,edge,b.w+.02,.25,.075);
        for(const x of [b.x-b.w*.42,b.x,b.x+b.w*.42])block('steel',x,b.h*.49,edge,.07,b.h*.88,.07);
      }
    }
  }

  if (MAP.kind === 'wild'){
    const seed=rng(MAP.seed+103);
    const free=(x,z)=>pathDist(x,z)>3.1 && !BOXES.some(b=>Math.abs(x-b.x)<b.w*.5+.7&&Math.abs(z-b.z)<b.d*.5+.7)
      && ![...LAYOUT.spawns,...LAYOUT.tx,...LAYOUT.items,EXTRACT].some(p=>Math.hypot(p.x-x,p.z-z)<2.5)
      && !LAYOUT.colliders.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+.6);
    const undergrowth = MAP.theme.snow ? 0 : MAP.theme.minNight ? 360 : 520;
    for (let i=0; i<undergrowth; i++) {
      const z = -75 + seed()*78, x=pathX(z)+(seed()-.5)*33;
      const density = Math.sin(x*.54 + Math.sin(z*.35))*Math.cos(z*.53);
      if (density < .21 || !free(x,z)) continue;
      const y = height(x,z);
      for (let j=0; j<5; j++){
        const yaw = seed()*6.283, d=seed()*.78;
        const px=x+Math.cos(yaw)*d, pz=z+Math.sin(yaw)*d;
        if (free(px,pz)) piece('vegetation',grassBlade,px,height(px,pz)-.01,pz,.14+seed()*.18,.19+seed()*.21,1,yaw);
      }
      if (i%11===0) stone('vegetation',x,y+.07,z,.72,.36,.46,seed()*6.28);
    }
    for(const tree of LAYOUT.trees.filter((_,i)=>i%4===0)){
      if(Math.hypot(tree.x,tree.z)>67)continue;
      for(let i=0;i<3;i++){
        const x=tree.x+(seed()-.5)*4.6,z=tree.z+(seed()-.5)*4.6;
        if(!free(x,z))continue;
        if(MAP.theme.snow)stone('snow',x,height(x,z)-.04,z,.65+seed()*.5,.16+seed()*.11,.32+seed()*.44,seed()*6);
        else stone('vegetation',x,height(x,z)+.12,z,.35+seed()*.25,.29+seed()*.21,.35+seed()*.26,seed()*6);
      }
    }
    for(const rock of LAYOUT.rocks.filter((_,i)=>i%8===0)){
      if(Math.hypot(rock.x,rock.z)>60)continue;
      if(MAP.theme.snow)stone('snow',rock.x,rock.y+rock.s*.87,rock.z,rock.s*.68,rock.s*.15,rock.s*.58);
    }
    const markers = MAP.theme.snow ? [[-4.5,-9,'SHELTER'],[4.4,-32,'RIDGE']]
      : MAP.theme.minNight ? [[-9,-11,'MARSH'],[-4.4,-32,'NORTH TRAIL']]
      : [[-4.5,-9,'CABIN'],[4.5,-30,'CLEARING']];
    if (MAP.theme.snow) {
      for (const z of [-9,-15,-24,-33,-49,-58]) {
        for (const side of [-1,1]) {
          const x = pathX(z)+side*4.7;
          if (!free(x,z)) continue;
          const y = height(x,z);
          stone('snow',x,y-.09,z,.84,.38,1.58,.35*side);
        }
      }
    }
    for(const [dx,z,label] of markers){
      const x=pathX(z)+dx, y=height(x,z);
      if(!free(x,z))continue;
      block('wood',x,y+.85,z,.15,1.7,.16);
      block('wood',x,y+1.31,z,1.62,.37,.16);
      sign(label,x,y+1.31,z+.086,1.45,0,'#4b4430');
    }
  }

  for(const [family,geometries] of grouped) {
    const [hex,roughness]=materials[family];
    const color = new THREE.Color(hex);
    const mat = new THREE.MeshStandardMaterial({color,roughness,metalness:family==='steel'?.18:0});
    if (family === 'vegetation') mat.side = THREE.DoubleSide;
    owned.push(mat);
    scene.add(styledMesh(mergeGeometries(geometries),underMaterial(paletteFor(color),1,.94, family === 'vegetation' ? { side: THREE.DoubleSide } : {}),mat));
    for(const geometry of geometries)geometry.dispose();
  }
  function update(night) {
    for (const source of practicals) {
      const level = source.day + (source.night-source.day)*night;
      source.mesh.material.color.setHex(source.c).multiplyScalar(level);
      source.r = source.range * level;
      source.intensity = source.power * level;
    }
  }
  function dispose() {
    for (const material of owned) material.dispose();
  }
  return { practicals, update, dispose };
}
