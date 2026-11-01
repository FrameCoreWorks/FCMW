import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const req=createRequire(path.join(process.cwd(),'x.js'));const {chromium}=req('playwright');
const root=process.cwd();const srv=http.createServer((q,s)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'Content-Type':p.endsWith('.js')||p.endsWith('.mjs')?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream'});s.end(d)})}).listen(8798);
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const pg=await b.newPage();
pg.on('pageerror',e=>console.log('ERR',e.message));
await pg.goto('http://localhost:8798/urzad/index.html?format=9x16&render=1');await pg.waitForFunction('window.filmReady',null,{timeout:200000});
const out=await pg.evaluate(()=>{
  const S=window.__SET;const res={};
  for(const key of ['inS','outS']){
    const scene=S[key];scene.updateMatrixWorld(true);const items=[];
    scene.traverse(o=>{
      const g=o.geometry;if(!g)return;
      if(o.isInstancedMesh){const m=new o.matrixWorld.constructor();const e=[];for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);const el=m.elements;
        // axis aligned check
        const ok=[1,2,4,6,8,9].every(j=>Math.abs(el[j])<1e-4);if(!ok)continue;
        const sx=Math.abs(el[0]),sy=Math.abs(el[5]),sz=Math.abs(el[10]),x=el[12],y=el[13],z=el[14];
        items.push({t:'box',n:o.name||'inst',i,min:[x-sx/2,y-sy/2,z-sz/2],max:[x+sx/2,y+sy/2,z+sz/2]});}}
      else if(o.isMesh){g.computeBoundingBox();const bb=g.boundingBox.clone().applyMatrix4(o.matrixWorld);
        const el=o.matrixWorld.elements;const ok=[1,2,4,6,8,9].every(j=>Math.abs(el[j])<1e-4);if(!ok)return;
        items.push({t:g.type,n:o.name||g.type,min:[bb.min.x,bb.min.y,bb.min.z],max:[bb.max.x,bb.max.y,bb.max.z]});}
    });
    // faces: for each item, each axis, each side; plane thickness 0 -> both sides same
    const hits=[];const eps=0.004;
    const ov=(a0,a1,b0,b1)=>Math.min(a1,b1)-Math.max(a0,b0);
    for(let a=0;a<items.length;a++)for(let c=a+1;c<items.length;c++){const A=items[a],B=items[c];
      for(let ax=0;ax<3;ax++){const o1=(ax+1)%3,o2=(ax+2)%3;
        const o1v=ov(A.min[o1],A.max[o1],B.min[o1],B.max[o1]),o2v=ov(A.min[o2],A.max[o2],B.min[o2],B.max[o2]);
        if(o1v<0.15||o2v<0.15)continue;
        for(const sa of ['min','max'])for(const sb of ['min','max']){
          const fa=A[sa][ax],fb=B[sb][ax];if(Math.abs(fa-fb)>eps)continue;
          const thinA=A.max[ax]-A.min[ax]<1e-3,thinB=B.max[ax]-B.min[ax]<1e-3;
          // same outward normal (both min or both max), or a plane
          if(sa===sb||thinA||thinB)hits.push({ax:'xyz'[ax],f:+fa.toFixed(3),A:A.n+(A.i??'')+' '+A.min.map(v=>v.toFixed(2))+'|'+A.max.map(v=>v.toFixed(2)),B:B.n+(B.i??'')+' '+B.min.map(v=>v.toFixed(2))+'|'+B.max.map(v=>v.toFixed(2)),area:+(o1v*o2v).toFixed(2)});
        }}}
    res[key]={n:items.length,hits:hits.sort((p,q)=>q.area-p.area).slice(0,60),total:hits.length};
  }
  return res;});
console.log(JSON.stringify(out,null,1));await b.close();srv.close();
