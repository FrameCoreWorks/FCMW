import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const W=1080,H=1920,N=200000;
const LIME=new THREE.Color('#C6FF3D'),PINK=new THREE.Color('#FF2E93'),WHITE=new THREE.Color('#FFFFFF'),VIO=new THREE.Color('#6B4BFF');
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R=rng(7);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);renderer.setPixelRatio(1);
renderer.setClearColor('#1B0B3A');renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
const scene=new THREE.Scene();
const cam=new THREE.PerspectiveCamera(32,W/H,0.1,200);
// background gradient plane
const bg=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({depthWrite:false,depthTest:false,
 vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.999,1.);}',
 fragmentShader:'varying vec2 v;uniform vec2 c;uniform float dim;void main(){vec2 p=(v-c)*vec2(1.,1.78);float d=length(p);vec3 a=vec3(0.18,0.07,0.38),b=vec3(0.055,0.02,0.13);vec3 col=mix(a,b,smoothstep(0.,1.1,d))*dim;float g=fract(sin(dot(v*1000.,vec2(12.9898,78.233)))*43758.5453);col+= (g-.5)*0.012;gl_FragColor=vec4(col,1.);}',
 uniforms:{c:{value:new THREE.Vector2(.5,.55)},dim:{value:1}}}));
bg.renderOrder=-1;bg.frustumCulled=false;scene.add(bg);
const geo=new THREE.BufferGeometry();
const pos=new Float32Array(N*3),col=new Float32Array(N*3),siz=new Float32Array(N),nor=new Float32Array(N*3),acc=new Float32Array(N*3);
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
geo.setAttribute('color',new THREE.BufferAttribute(col,3));
geo.setAttribute('size',new THREE.BufferAttribute(siz,1));geo.setAttribute('nrm',new THREE.BufferAttribute(nor,3));geo.setAttribute('acc',new THREE.BufferAttribute(acc,3));
const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
 uniforms:{focus:{value:10},aper:{value:0.6},px:{value:1},L:{value:new THREE.Vector3(-0.5,0.6,0.62).normalize()},RL:{value:new THREE.Vector3(0.85,0.15,-0.5).normalize()}},
 vertexShader:`attribute vec3 color,nrm,acc;attribute float size;varying vec3 vc;varying float va;uniform float focus,aper,px;uniform vec3 L,RL;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.);float z=-mv.z;float coc=abs(z-focus)/z*aper*14.;
 float s=size*px*(26./z);float ps=max(s,1.0)+coc;gl_PointSize=ps;va=clamp((s*s)/(ps*ps),0.02,1.)*clamp(s/1.0,0.,1.);
 vec3 c=color;if(dot(nrm,nrm)>0.5){vec3 n=normalize(normalMatrix*nrm);vec3 v=normalize(-mv.xyz);float nv=dot(n,v);
  float lam=max(0.,dot(n,L));float rim=pow(1.-abs(nv),2.5);float sp=pow(max(0.,dot(n,normalize(L+v))),36.);float rl=pow(max(0.,dot(n,RL)),2.);
  c=color*(0.10+1.0*lam)+acc*(rim*0.9+rl*1.0)+vec3(sp*1.2);c*=nv<0.?0.03:1.;c*=0.85;}
 vc=c;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`varying vec3 vc;varying float va;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float a=smoothstep(.5,.28,d);gl_FragColor=vec4(vc*a*va,1.);}`});
const comp=new EffectComposer(renderer);comp.setSize(W,H);comp.addPass(new RenderPass(scene,cam));const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),0.45,0.5,0.55);comp.addPass(bloom);
const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.renderOrder=1;scene.add(pts);
const light=new THREE.Vector3(-0.6,0.7,0.6).normalize(),rimL=new THREE.Vector3(0.8,0.1,-0.6).normalize();
function shade(i,n,view,base,accent,k){nor[i*3]=n.x;nor[i*3+1]=n.y;nor[i*3+2]=n.z;col[i*3]=base.r;col[i*3+1]=base.g;col[i*3+2]=base.b;acc[i*3]=accent.r*k;acc[i*3+1]=accent.g*k;acc[i*3+2]=accent.b*k;}
const occM=new THREE.MeshBasicMaterial({colorWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:2,polygonOffsetUnits:8});
function sampleMesh(g,start,count,opt={}){const m=new THREE.Mesh(g);if(!opt.noOcc){const o=new THREE.Mesh(g,occM);o.renderOrder=0;pts.add(o);}const s=new MeshSurfaceSampler(m).setRandomGenerator(R).build();
 const p=new THREE.Vector3(),n=new THREE.Vector3(),view=opt.view||new THREE.Vector3(0,0,1);
 for(let i=start;i<start+count;i++){s.sample(p,n);const j=(R()-.5)*(opt.jit||0.004);p.addScaledVector(n,j);
  pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;siz[i]=opt.size||1;
  let base=opt.base||LIME,acc=opt.acc||PINK;if(opt.paint){const r=opt.paint(p,n);if(r){base=r[0];acc=r[1];if(r[2])siz[i]=r[2];}}
  shade(i,n,view,base,acc,opt.rim??1);}
 if(opt.logo){let k=start+count,end=k+opt.logo.count,t=0;while(k<end&&t<5e6){t++;s.sample(p,n);if(!opt.logo.test(p,n))continue;p.addScaledVector(n,0.004);
  pos[k*3]=p.x;pos[k*3+1]=p.y;pos[k*3+2]=p.z;siz[k]=1.0;shade(k,n,view,WHITE.clone().multiplyScalar(2.2),PINK,0.6);k++;}} }
function textMask(str,font,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.font=font;x.textAlign='center';x.textBaseline='middle';
 x.fillText(str,w/2,h/2);return x.getImageData(0,0,w,h).data;}
function textPoints(lines,start,count,opt){ // lines:[{t,font,y}] in canvas 2000x2000 space -> world plane
 const w=2000,h=2000,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
 for(const l of lines){x.font=l.font;if(x.letterSpacing!==undefined)x.letterSpacing=(l.ls||0)+'px';x.fillText(l.t,w/2,l.y);}
 const d=x.getImageData(0,0,w,h).data;let i=start;const end=start+count;let tries=0;
 while(i<end&&tries<count*80){tries++;const u=R()*w|0,v=R()*h|0;if(d[(v*w+u)*4]>128){const X=(u/w-.5)*opt.sc,Y=-(v/h-.5)*opt.sc;
  pos[i*3]=X+opt.x;pos[i*3+1]=Y+opt.y;pos[i*3+2]=opt.z+(R()-.5)*opt.depth;siz[i]=opt.size||1;const c=(opt.color||LIME).clone().multiplyScalar(opt.gain||0.6);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;i++;}}
 return i;}
const isD=new Uint8Array(N);
function dust(start,end,opt={}){for(let i=start;i<end;i++){isD[i]=1;const r=Math.pow(R(),.6)*(opt.r||14),a=R()*6.283,b=Math.acos(2*R()-1);
 pos[i*3]=r*Math.sin(b)*Math.cos(a)+(opt.cx||0);pos[i*3+1]=r*Math.cos(b)*1.6+(opt.cy||0);pos[i*3+2]=r*Math.sin(b)*Math.sin(a)*1.2-(opt.back||3);siz[i]=0.5+R()*0.8;
 const c=(R()<0.25?PINK:R()<.5?VIO:LIME).clone().multiplyScalar(0.12+R()*0.25);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}}
function lathe(prof,seg=160){return new THREE.LatheGeometry(prof.map(([x,y])=>new THREE.Vector2(x,y)),seg);}
function textBox(str,font,bw,bh,ls=0,px=400){const c=document.createElement('canvas');c.width=Math.round(bw*px);c.height=Math.round(bh*px);const x=c.getContext('2d');x.fillStyle='#fff';x.font=font;x.letterSpacing=ls+'px';x.textAlign='center';x.textBaseline='middle';x.fillText(str,c.width/2,c.height/2+px*0.03);
 const d=x.getImageData(0,0,c.width,c.height).data;return(X,Y)=>{const u=Math.round((X/bw+.5)*c.width),v=Math.round((.5-Y/bh)*c.height);if(u<0||v<0||u>=c.width||v>=c.height)return false;return d[(v*c.width+u)*4]>128;};}
const shots={
 hook(){ // "200 000" numerals + question, dust
  let i=textPoints([{t:'200',font:'700 560px Display',y:640,ls:-8},{t:'000',font:'700 560px Display',y:1130,ls:-8}],0,130000,{sc:6.0,x:0,y:0.75,z:0,depth:0.25,gain:0.8,size:1.0});
  const q0=i;i=textPoints([{t:'DOTS. WHAT CAN',font:'700 100px Display',y:1450,ls:10},{t:'THEY BECOME?',font:'700 100px Display',y:1560,ls:10}],i,40000,{sc:6.0,x:0,y:0.75,z:0.05,depth:0.05,color:WHITE,gain:0.55,size:0.85});META.q=[q0,i];
  dust(i,N,{r:12,back:4});
  cam.position.set(0.6,-0.4,11);cam.lookAt(0,0.3,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=0.5;},
 perfume(){ // NOIRA faceted bottle
  const body=lathe([[0,-1.7],[1.0,-1.7],[1.12,-1.58],[1.12,0.75],[0.95,1.05],[0.42,1.2],[0.3,1.3],[0.3,1.5],[0,1.5]],8);
  body.rotateY(-Math.PI/8);
  const cap=lathe([[0,1.5],[0.48,1.5],[0.6,1.6],[0.6,2.75],[0.5,2.85],[0,2.85]],8);cap.rotateY(-Math.PI/8);
  const T=textBox('NOIRA','700 112px Display',0.9,0.3,10,600);
  sampleMesh(body,0,131500,{jit:0.01,logo:{count:3500,test:(p,n)=>n.z>0.95&&T(p.x,p.y-0.05)},paint:(p,n)=>{if(n.z>0.95&&p.y>-0.17&&p.y<0.27&&Math.abs(p.x)<0.44)return[PINK.clone().multiplyScalar(0.5),PINK];return null;}});
  sampleMesh(cap,135000,35000,{base:PINK,acc:LIME,jit:0.004});
  for(let i=170000;i<185000;i++){const r=Math.sqrt(R())*0.98,a=R()*6.283,y=-1.6+R()*2.2;pos[i*3]=r*Math.sin(a);pos[i*3+1]=y;pos[i*3+2]=r*Math.cos(a);siz[i]=0.6;const c=PINK.clone().multiplyScalar(0.06+0.06*(1-r));col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  dust(185000,N,{r:10,back:3});
  pts.rotation.set(0.1,-0.18,0.04);pts.position.set(0,-0.45,0);
  cam.position.set(0,0.5,11);cam.lookAt(0,0.1,0);mat.uniforms.focus.value=10.6;mat.uniforms.aper.value=0.9;},
 can(){ // GRAVL can, vertical logo
  const g=lathe([[0,-2.1],[0.8,-2.1],[0.98,-1.95],[1.0,-1.7],[1.0,1.6],[0.82,1.95],[0.78,2.05],[0,2.05]],200);
  const T=textBox('GRAVL','700 300px Display',3.3,0.95,18,300);
  sampleMesh(g,0,160000,{jit:0.006,logo:{count:15000,test:(p,n)=>{const r=Math.hypot(p.x,p.z);return r>0.97&&Math.abs(p.y)<1.6&&T(p.y,-(Math.atan2(p.x,p.z)*r+0.05));}},paint:(p,n)=>{const r=Math.hypot(p.x,p.z);
    if(r>0.97&&p.y<1.62&&p.y>-1.72){const s=Math.atan2(p.x,p.z)*r; if(T(p.y,-(s+0.05)))return[LIME.clone().multiplyScalar(0.3),PINK]; if(Math.abs(s+0.05)<0.62&&Math.abs(s+0.05)>0.56)return[PINK,PINK];return[LIME.clone().multiplyScalar(0.8),PINK];}
    return[WHITE.clone().multiplyScalar(.6),LIME];}});
  dust(175000,N,{r:10,back:3});
  pts.rotation.set(0.2,0.0,-0.3);cam.position.set(0,0,11.5);cam.lookAt(0,0,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=1.0;},
 terrain(){ // the drop: dot landscape shaped by the waveform
  let i=0;const cols=450,rows=400;
  for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){if(i>=180000)break;const X=(q/cols-.5)*11,Z=-Math.pow(r/rows,1.3)*26+1.5;
   const f=Math.abs(X);const env=Math.exp(-f*f/9);const h=env*(2.2*Math.abs(Math.sin(X*2.1+Z*0.35))*Math.abs(Math.sin(Z*0.9)) + 0.6*Math.sin(X*7+Z*2)*0.3)+0.08*Math.sin(Z*3+X);
   pos[i*3]=X;pos[i*3+1]=h-1.5;pos[i*3+2]=Z;siz[i]=1.0;const t=Math.min(1,h/1.4);const c=LIME.clone().lerp(PINK,t).multiplyScalar(0.35+1.1*t);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;i++;}
  dust(i,N,{r:12,cy:4,back:12});
  cam.position.set(0,0.2,5.5);cam.lookAt(0,0.2,-6);mat.uniforms.focus.value=8;mat.uniforms.aper.value=0.8;},
 lipstick(){ // SAVEN lipstick, open
  const tube=lathe([[0,-2.2],[0.62,-2.2],[0.66,-2.1],[0.66,-0.1],[0.6,-0.05],[0.6,0.35],[0,0.35]],160);
  const bul=new THREE.CylinderGeometry(0.44,0.44,1.9,96,30);bul.translate(0,1.25,0);
  const pa=bul.attributes.position;for(let k=0;k<pa.count;k++){const x=pa.getX(k),y=pa.getY(k);pa.setY(k,Math.min(y,1.75+0.62*x));}bul.computeVertexNormals();
  const T=textBox('SAVEN','700 150px Display',1.9,0.55,20,300);
  sampleMesh(tube,0,92000,{jit:0.005,logo:{count:7000,test:(p,n)=>{const r=Math.hypot(p.x,p.z);return r>0.64&&T(p.y+1.15,-(Math.atan2(p.x,p.z)*r));}},paint:(p,n)=>{if(p.y>-0.12)return[WHITE.clone().multiplyScalar(.8),LIME];return null;}});
  sampleMesh(bul,99000,80000,{jit:0.004,base:PINK,acc:WHITE,paint:(p,n)=>{if(n.y>0.5)return[PINK.clone().multiplyScalar(1.3),WHITE];return null;}});
  dust(179000,N,{r:10,back:3});
  pts.rotation.set(0.25,0.35,-0.42);pts.position.set(0.1,-0.1,0);cam.position.set(0,0,10.5);cam.lookAt(0,0,0);mat.uniforms.focus.value=10.2;mat.uniforms.aper.value=1.0;},
 camera(){ // ARKO camera
  const body=new RoundedBoxGeometry(3.4,2.1,1.0,6,0.18);
  const lens=lathe([[0.95,0.5],[0.95,0.75],[0.88,0.8],[0.88,1.25],[0.82,1.3],[0.82,1.55],[0.7,1.6],[0.55,1.6],[0.5,1.45],[0,1.45]],140);lens.rotateX(Math.PI/2);lens.translate(0.25,-0.1,0);
  const btn=new THREE.CylinderGeometry(0.2,0.2,0.16,40,2);btn.translate(-1.1,1.12,0);
  const dial=new THREE.CylinderGeometry(0.32,0.32,0.18,48,2);dial.translate(1.1,1.13,0.0);
  const vf=new RoundedBoxGeometry(0.9,0.35,0.7,3,0.08);vf.translate(-0.6,1.2,0);
  const T=textBox('ARKO','700 100px Display',0.9,0.3,16,400);
  sampleMesh(body,0,80000,{jit:0.004,logo:{count:5000,test:(p,n)=>n.z>0.9&&T(p.x+1.12,p.y-0.68)},paint:(p,n)=>{if(Math.abs(p.y)<0.55&&Math.abs(n.z)<0.9)return[WHITE.clone().multiplyScalar(0.35),LIME];return null;}});
  sampleMesh(lens,85000,70000,{jit:0.004,paint:(p,n)=>{const r=Math.hypot(p.x-0.25,p.y+0.1);if(p.z>1.4&&r<0.56)return[PINK.clone().multiplyScalar(0.25+0.9*Math.abs(Math.sin(r*40))),WHITE];if(r>0.86)return[WHITE.clone().multiplyScalar(0.8),PINK];return null;}});
  sampleMesh(btn,155000,5000,{base:PINK,acc:WHITE});sampleMesh(dial,160000,7000,{base:WHITE.clone().multiplyScalar(.7),acc:LIME});sampleMesh(vf,167000,9000,{});
  dust(176000,N,{r:10,back:3});
  pts.rotation.set(0.22,-0.5,0.06);cam.position.set(0,0,11.5);cam.lookAt(0,0,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=1.0;},
 cup(){ // MOLTO takeaway cup
  const cup=lathe([[0,-1.7],[0.72,-1.7],[0.74,-1.62],[0.98,1.3],[0,1.3]],180);
  const sleeve=lathe([[0.83,-0.75],[0.86,-0.75],[0.94,0.75],[0.91,0.75]],180);
  const lid=lathe([[0,1.62],[0.55,1.62],[0.6,1.5],[0.95,1.45],[1.04,1.35],[1.04,1.22],[0.98,1.2],[0,1.2]],180);
  const T=textBox('MOLTO','700 150px Display',1.6,0.5,22,400);
  sampleMesh(cup,0,85000,{jit:0.004,base:WHITE.clone().multiplyScalar(0.75),acc:PINK});
  sampleMesh(sleeve,85000,60000,{jit:0.004,logo:{count:7000,test:(p,n)=>{const r=Math.hypot(p.x,p.z);return r>0.85&&T(Math.atan2(p.x,p.z)*r,p.y);}},paint:(p,n)=>[LIME.clone().multiplyScalar(0.85),PINK]});
  sampleMesh(lid,152000,30000,{jit:0.003,base:PINK,acc:WHITE});
  for(let i=182000;i<190000;i++){const a=R()*6.283,r=0.15+R()*0.08,y=1.75+R()*1.6;pos[i*3]=Math.sin(a)*r+0.25*Math.sin(y*3);pos[i*3+1]=y;pos[i*3+2]=Math.cos(a)*r;siz[i]=0.7;const c=WHITE.clone().multiplyScalar(0.12*(1-(y-1.75)/1.6));col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  dust(190000,N,{r:10,back:3});
  pts.rotation.set(0.2,0.0,0.12);pts.position.set(0,-0.5,0);cam.position.set(0,0.3,10.5);cam.lookAt(0,0,0);mat.uniforms.focus.value=10.2;mat.uniforms.aper.value=1.0;},
 shades(){ // VISTRA sunglasses
  const rr=(w,h,r,cx,cy)=>{const s=new THREE.Path();const x=cx-w/2,y=cy-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r*1.6);s.quadraticCurveTo(x+w,y+h,x+w-r*1.6,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;};
  const ring=(cx)=>{const o=new THREE.Shape(rr(1.9,1.45,0.55,cx,0).getPoints(24));o.holes.push(rr(1.6,1.17,0.42,cx,0.0));const g=new THREE.ExtrudeGeometry(o,{depth:0.16,bevelEnabled:true,bevelSize:0.04,bevelThickness:0.04,bevelSegments:3,curveSegments:24});g.translate(0,0,-0.08);return g;};
  const bridge=new THREE.TorusGeometry(0.42,0.07,12,60,Math.PI*0.8);bridge.rotateZ(Math.PI*0.1);bridge.translate(0,0.12,0);
  const bar=new RoundedBoxGeometry(4.3,0.1,0.12,2,0.04);bar.translate(0,0.66,0);
  const frame=mergeGeometries([ring(-1.22),ring(1.22),bridge].map(g=>{g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal')g.deleteAttribute(k);return g;}));
  const L1=rr(1.62,1.19,0.43,-1.22,0),L2=rr(1.62,1.19,0.43,1.22,0);
  const lensG=(path)=>{const s=new THREE.Shape(path.getPoints(24));const g=new THREE.ExtrudeGeometry(s,{depth:0.04,bevelEnabled:false});g.translate(0,0,-0.02);return g;};
  const l1=lensG(L1),l2=lensG(L2);
  const arm=(sx)=>{const g=new RoundedBoxGeometry(0.12,0.24,3.6,3,0.05);g.translate(sx*2.12,0.42,-1.85);return g;};
  const a1=arm(-1),a2=arm(1);
  const T=textBox('VISTRA','700 120px Display',1.3,0.22,14,500);
  sampleMesh(frame,0,80000,{jit:0.003,base:LIME.clone().multiplyScalar(0.9),acc:PINK});
  sampleMesh(l1,80000,38000,{jit:0.002,noOcc:false,paint:(p,n)=>[PINK.clone().multiplyScalar(0.35+0.7*Math.max(0,0.6-p.y)),WHITE]});
  sampleMesh(l2,118000,38000,{jit:0.002,paint:(p,n)=>[PINK.clone().multiplyScalar(0.35+0.7*Math.max(0,0.6-p.y)),WHITE]});
  sampleMesh(a1,156000,10000,{jit:0.002,base:LIME.clone().multiplyScalar(0.9),acc:PINK});
  sampleMesh(a2,166000,10000,{jit:0.002,base:LIME.clone().multiplyScalar(0.9),acc:PINK,logo:{count:4000,test:(p,n)=>n.x>0.9&&T(-(p.z+1.25),p.y-0.42)}});
  dust(180000,N,{r:10,back:3});
  pts.rotation.set(0.32,-0.62,0.06);pts.scale.setScalar(0.64);pts.position.set(-0.5,0.0,0);cam.position.set(0,0,12);cam.lookAt(0,0,0);mat.uniforms.focus.value=11.5;mat.uniforms.aper.value=1.0;},
 phones(){ // KOVA headphones
  const band=new THREE.TorusGeometry(1.62,0.12,24,220,Math.PI);band.scale(1,1.12,1.6);
  const cup=(sx)=>{const g=lathe([[0,-0.34],[0.72,-0.34],[0.86,-0.26],[0.9,0.0],[0.86,0.26],[0.72,0.34],[0,0.34]],140);g.rotateZ(Math.PI/2);g.scale(1,1.25,1);g.translate(sx*1.72,-0.45,0);return g;};
  const cush=(sx)=>{const g=new THREE.TorusGeometry(0.62,0.17,20,120);g.rotateY(Math.PI/2);g.scale(1,1.25,1);g.translate(sx*1.38,-0.45,0);return g;};
  const yoke=(sx)=>{const g=new THREE.TorusGeometry(1.0,0.05,10,100,Math.PI);g.rotateY(Math.PI/2);g.translate(sx*1.72,-0.4,0);return g;};
  const parts=[[band,'b'],[cup(-1),'c'],[cup(1),'c'],[cush(-1),'k'],[cush(1),'k'],[yoke(-1),'y'],[yoke(1),'y']];
  const T=textBox('KOVA','700 160px Display',1.3,0.5,30,400);
  let i=0;const counts={b:30000,c:46000,k:20000,y:8000};
  for(const [g,t] of parts){const n=counts[t];const lg=(t==='c'&&i===30000)?{count:6000,test:(p,nn)=>p.x<-1.9&&nn.x<-0.9&&T(p.z,p.y+0.45)}:null;sampleMesh(g,i,n,{jit:0.004,logo:lg,paint:(p,nn)=>{
    if(t==='k')return[PINK.clone().multiplyScalar(0.7),PINK];
    
    if(t==='y')return[WHITE.clone().multiplyScalar(0.7),LIME];return null;}});i+=n+(lg?lg.count:0);}
  dust(i,N,{r:10,back:3});
  pts.rotation.set(0.1,1.0,0.04);pts.position.set(0.2,0,0);cam.position.set(0,0.1,13.5);cam.lookAt(0,-0.2,0);mat.uniforms.focus.value=13;mat.uniforms.aper.value=0.9;}
};

export const META={};
Object.assign(shots,{
 hookNum(){let i=textPoints([{t:'200',font:'700 560px Display',y:640,ls:-8},{t:'000',font:'700 560px Display',y:1130,ls:-8}],0,170000,{sc:6.0,x:0,y:0.75,z:0,depth:0.25,gain:0.8,size:1.0});dust(i,N,{r:12,back:4});
  cam.position.set(0.6,-0.4,11);cam.lookAt(0,0.3,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=0.5;},
 scatter(){for(let i=0;i<N;i++){const r=4+Math.pow(R(),0.5)*16,a=R()*6.283,b=Math.acos(2*R()-1);pos[i*3]=r*Math.sin(b)*Math.cos(a);pos[i*3+1]=r*Math.cos(b)*1.5;pos[i*3+2]=r*Math.sin(b)*Math.sin(a)-2;siz[i]=0.5+R()*0.9;
  const c=(R()<0.3?PINK:R()<.5?VIO:LIME).clone().multiplyScalar(0.15+R()*0.3);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  cam.position.set(0.6,-0.4,11);cam.lookAt(0,0.3,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=0.5;},
 galaxy(){for(let i=0;i<N;i++){const arm=i%3,t=Math.pow(R(),0.7),r=0.3+t*5.2,a=arm*2.094+t*5.5+(R()-.5)*0.5*(1-t*0.5);const th=(R()-.5)*0.35*(1-t*0.7);
  pos[i*3]=r*Math.cos(a)+(R()-.5)*0.25;pos[i*3+1]=th+(R()-.5)*0.08;pos[i*3+2]=r*Math.sin(a)+(R()-.5)*0.25;siz[i]=0.6+R()*0.7;
  const c=LIME.clone().lerp(PINK,Math.min(1,t*1.3)).lerp(WHITE,Math.max(0,0.4-t)).multiplyScalar(0.25+0.6*(1-t)+(R()<0.04?1.2:0));col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  pts.rotation.set(0.55,0,0.18);cam.position.set(0,0.5,12);cam.lookAt(0,0,0);mat.uniforms.focus.value=12;mat.uniforms.aper.value=0.7;},
 point(){for(let i=0;i<N;i++){const r=Math.pow(R(),2)*0.18,a=R()*6.283,b=Math.acos(2*R()-1);pos[i*3]=r*Math.sin(b)*Math.cos(a);pos[i*3+1]=r*Math.cos(b);pos[i*3+2]=r*Math.sin(b)*Math.sin(a);siz[i]=0.7;
  const c=WHITE.clone().lerp(PINK,R()*0.5).multiplyScalar(0.25);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  cam.position.set(0,0,11);cam.lookAt(0,0,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=0.6;},
 ring(){for(let i=0;i<N;i++){const a=R()*6.283,r=7+R()*5,z=(R()-.5)*1.5;pos[i*3]=r*Math.cos(a);pos[i*3+1]=r*Math.sin(a)*1.0;pos[i*3+2]=z;siz[i]=0.7+R()*0.6;
  const c=(R()<0.5?PINK:LIME).clone().multiplyScalar(0.5);col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
  cam.position.set(0,0,11);cam.lookAt(0,0,0);mat.uniforms.focus.value=11;mat.uniforms.aper.value=0.6;},
});
export function capture(n){isD.fill(0);pts.scale.setScalar(1);while(pts.children.length)pts.remove(pts.children[0]);pts.rotation.set(0,0,0);pts.position.set(0,0,0);siz.fill(0);col.fill(0);nor.fill(0);acc.fill(0);pos.fill(0);
 shots[n]();const occ=pts.children.slice();while(pts.children.length)pts.remove(pts.children[0]);
 return {name:n,dust:isD.slice(),pos:pos.slice(),col:col.slice(),siz:siz.slice(),nor:nor.slice(),acc:acc.slice(),rot:pts.rotation.clone(),p:pts.position.clone(),s:pts.scale.x,
  camP:cam.position.clone(),camQ:cam.quaternion.clone(),focus:mat.uniforms.focus.value,aper:mat.uniforms.aper.value,occ};}
export {THREE,renderer,comp,bloom,scene,cam,pts,geo,mat,pos,col,siz,nor,acc,N,W,H,LIME,PINK,WHITE,VIO,occM};
