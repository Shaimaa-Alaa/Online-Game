/* Low-poly 3D race stage. Needs the THREE global (r128 build) and a document. */
function makeRace3D(THREE, doc){
'use strict';
var V3=THREE.Vector3, ROAD_W=56, LAPS=2;
/* wide closed circuit: smooth loop, min corner radius ~50 m so a 56 m road never folds on itself */
var PTS=(function(){var a=[],n=16,i,t,rr;for(i=0;i<n;i++){t=i/n*Math.PI*2;rr=1+0.10*Math.sin(2*t+0.6)+0.05*Math.sin(3*t+1.9);a.push([Math.round(260*rr*Math.cos(t)),Math.round(170*rr*Math.sin(t))])}return a})();

function rng(seed){var a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function mkCanvas(w,h){var c=doc.createElement('canvas');c.width=w;c.height=h;var g=null;try{g=c.getContext('2d')}catch(e){g=null}return g?{c:c,g:g}:null}
function ctex(cv,rx,ry){if(!cv) return null;var t=new THREE.CanvasTexture(cv.c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=4;return t}
function mat(color,map,extra){var o={color:map?0xffffff:color};if(map)o.map=map;if(extra)for(var k in extra)o[k]=extra[k];return new THREE.MeshLambertMaterial(o)}
function basic(color,extra){var o={color:color};if(extra)for(var k in extra)o[k]=extra[k];return new THREE.MeshBasicMaterial(o)}
function flat(g){var n=g.index?g.toNonIndexed():g; n.computeVertexNormals(); return n}
function box(w,h,d,m,x,y,z){var me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);me.position.set(x||0,y||0,z||0);return me}

/* ---------- canvas textures ---------- */
function roadCanvas(){
  var cv=mkCanvas(128,256); if(!cv) return null; var g=cv.g, r=rng(3);
  g.fillStyle='#3e424b'; g.fillRect(0,0,128,256);
  for(var i=0;i<1600;i++){var c=r()>.5?255:0;g.fillStyle='rgba('+c+','+c+','+c+',.06)';g.fillRect(r()*128,r()*256,2,2)}
  g.fillStyle='#f3f3ee'; g.fillRect(5,0,5,256); g.fillRect(118,0,5,256); g.fillRect(61,0,6,120);
  return cv;
}
function curbCanvas(){
  var cv=mkCanvas(32,64); if(!cv) return null; var g=cv.g;
  g.fillStyle='#c9202b'; g.fillRect(0,0,32,32); g.fillStyle='#f4f4f4'; g.fillRect(0,32,32,32);
  return cv;
}
function wallCanvas(){
  var cv=mkCanvas(32,64); if(!cv) return null; var g=cv.g;
  g.fillStyle='#c4c8d0'; g.fillRect(0,0,32,32); g.fillStyle='#8f1d28'; g.fillRect(0,32,32,32);
  return cv;
}
function winCanvas(seed){
  var cv=mkCanvas(64,128); if(!cv) return null; var g=cv.g, r=rng(seed);
  g.fillStyle='#d3d9e2'; g.fillRect(0,0,64,128);
  for(var y=0;y<8;y++)for(var x=0;x<4;x++){g.fillStyle=r()>.8?'#f4e7a8':'#8fb4d6'; g.fillRect(x*16+3,y*16+3,10,10)}
  return cv;
}
function grassCanvas(){
  var cv=mkCanvas(128,128); if(!cv) return null; var g=cv.g, r=rng(11);
  g.fillStyle='#78b957'; g.fillRect(0,0,128,128);
  for(var i=0;i<900;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.07)':'rgba(0,40,0,.08)';var s=2+r()*6;g.fillRect(r()*128,r()*128,s,s)}
  return cv;
}
function bannerCanvas(title){
  var cv=mkCanvas(2048,256); if(!cv) return null; var g=cv.g, q=32, x, y;
  g.fillStyle='#c9202b'; g.fillRect(0,0,2048,256);
  for(y=0;y<2;y++)for(x=0;x<2048/q;x++){g.fillStyle=((x+y)%2)?'#111':'#fff';g.fillRect(x*q,y*q*0.75,q,q*0.75);g.fillStyle=((x+y)%2)?'#fff':'#111';g.fillRect(x*q,256-(y+1)*q*0.75,q,q*0.75)}
  g.textAlign='center'; g.textBaseline='middle';
  var size=132; g.direction='rtl';
  do{g.font='800 '+size+'px Cairo, Lalezar, Tahoma, sans-serif';size-=6}while(g.measureText(title).width>1700&&size>40);
  g.lineWidth=10; g.strokeStyle='rgba(60,0,8,.55)'; g.strokeText(title,1024,132);
  g.fillStyle='#fff'; g.fillText(title,1024,132);
  return cv;
}

function skyMesh(r,stops){
  var g=new THREE.SphereGeometry(r,28,18), pos=g.attributes.position, col=new Float32Array(pos.count*3), c=new THREE.Color(), a=new THREE.Color(), b=new THREE.Color();
  for(var i=0;i<pos.count;i++){
    var t=pos.getY(i)/r, k=0; while(k<stops.length-2&&t>stops[k+1][0]) k++;
    var s0=stops[k], s1=stops[k+1], u=clamp((t-s0[0])/(s1[0]-s0[0]),0,1);
    a.setHex(s0[1]); b.setHex(s1[1]); c.copy(a).lerp(b,u); col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  return new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));
}
var SKY=[[-1,0x9db68a],[-0.02,0xd9cfa8],[0.0,0xfbe6c4],[0.12,0xcfe6f3],[0.45,0x7fbdee],[1,0x4f96dc]];
function puffCanvas(){
  var cv=mkCanvas(64,64); if(!cv) return null; var g=cv.g, gr=g.createRadialGradient(32,32,2,32,32,30);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.5,'rgba(255,255,255,.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return cv;
}
function flameCanvas(){
  var cv=mkCanvas(64,64); if(!cv) return null; var g=cv.g, gr=g.createRadialGradient(32,32,1,32,32,30);
  gr.addColorStop(0,'rgba(255,255,230,1)'); gr.addColorStop(.25,'rgba(255,214,90,.95)'); gr.addColorStop(.6,'rgba(255,110,20,.55)'); gr.addColorStop(1,'rgba(255,60,0,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return cv;
}
function finishCanvas(){
  var cv=mkCanvas(256,32); if(!cv) return null; var g=cv.g;
  for(var y=0;y<2;y++)for(var x=0;x<16;x++){g.fillStyle=((x+y)%2)?'#111':'#fff'; g.fillRect(x*16,y*16,16,16)}
  return cv;
}

/* ---------- world ---------- */
function buildWorld(title){
  var rnd=rng(7), i, k;
  var scene=new THREE.Scene();
  scene.background=new THREE.Color(0xcfe6f3);
  scene.fog=new THREE.Fog(0xd8e8ee,260,980);
  scene.add(skyMesh(1300,SKY));
  scene.add(new THREE.HemisphereLight(0xfff6e6,0x7fa85f,0.9));
  var sun=new THREE.DirectionalLight(0xfff0d6,0.95); sun.position.set(90,150,60);
  sun.castShadow=true; sun.shadow.mapSize.set(1536,1536);
  var sc=sun.shadow.camera; sc.left=-80; sc.right=80; sc.top=80; sc.bottom=-80; sc.near=20; sc.far=520; sun.shadow.bias=-0.0007; sun.shadow.normalBias=0.35;
  scene.add(sun); scene.add(sun.target);

  var curve=new THREE.CatmullRomCurve3(PTS.map(function(p){return new V3(p[0],0,p[1])}),true,'centripetal');
  curve.arcLengthDivisions=1200;
  var L=curve.getLength(), N=Math.round(L/2.5), P=[], T=[], NN=[];
  for(i=0;i<=N;i++){var u=i/N, p=curve.getPointAt(u), t=curve.getTangentAt(u); t.y=0; t.normalize(); P.push(p); T.push(t); NN.push(new V3(t.z,0,-t.x));}

  var ground=new THREE.Mesh(new THREE.PlaneGeometry(3600,3600),mat(0x78b957));
  ground.rotation.x=-Math.PI/2; ground.position.y=-0.35; scene.add(ground);

  /* low-poly terrain: flat near the track, rolling hills farther out */
  var TP=[]; for(i=0;i<=N;i+=4) TP.push(P[i]);
  function dTrack(x,z){var m=1e9;for(var j=0;j<TP.length;j++){var dx=TP[j].x-x,dz=TP[j].z-z,d=dx*dx+dz*dz;if(d<m)m=d}return Math.sqrt(m)}
  function hAt(x,z){
    var d=dTrack(x,z), t=clamp((d-78)/130,0,1); t=t*t*(3-2*t); if(t<=0) return 0;
    var n=Math.sin(x*.021+1.3)*Math.cos(z*.017)*.55+Math.sin(x*.05+z*.043)*.3+Math.sin(z*.09-x*.03)*.15;
    return (n*0.5+0.5)*44*t;
  }
  var SEG=128, tg=new THREE.PlaneGeometry(1700,1700,SEG,SEG); tg.rotateX(-Math.PI/2);
  var tp=tg.attributes.position, tcol=new Float32Array(tp.count*3), cA=new THREE.Color(0x86c862), cB=new THREE.Color(0x4f9a46), cc=new THREE.Color();
  for(i=0;i<tp.count;i++){
    var vx=tp.getX(i), vz=tp.getZ(i), hh=hAt(vx,vz); if(hh>0.01) hh+=(rnd()-.5)*4;
    tp.setY(i,hh);
    cc.copy(cA).lerp(cB,clamp(hh/30,0,1)); var jt=(rnd()-.5)*0.1; cc.r=clamp(cc.r+jt,0,1); cc.g=clamp(cc.g+jt,0,1); cc.b=clamp(cc.b+jt*.5,0,1);
    tcol[i*3]=cc.r; tcol[i*3+1]=cc.g; tcol[i*3+2]=cc.b;
  }
  tg.setAttribute('color',new THREE.BufferAttribute(tcol,3)); tg=tg.toNonIndexed(); tg.computeVertexNormals();
  var tmesh=new THREE.Mesh(tg,new THREE.MeshLambertMaterial({vertexColors:true})); tmesh.receiveShadow=true; scene.add(tmesh);

  function strip(oa,ya,ob,yb,m){
    var pos=new Float32Array((N+1)*6), uv=new Float32Array((N+1)*4), idx=[], j;
    for(j=0;j<=N;j++){
      var p=P[j], n=NN[j], a=j*6, b=j*4;
      pos[a]=p.x+n.x*oa; pos[a+1]=ya; pos[a+2]=p.z+n.z*oa;
      pos[a+3]=p.x+n.x*ob; pos[a+4]=yb; pos[a+5]=p.z+n.z*ob;
      uv[b]=0; uv[b+1]=j/N; uv[b+2]=1; uv[b+3]=j/N;
      if(j<N){var v=j*2; idx.push(v,v+2,v+1,v+1,v+2,v+3)}
    }
    var g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals();
    var me=new THREE.Mesh(g,m); me.receiveShadow=true; scene.add(me); return me;
  }
  var H=ROAD_W/2, DS=THREE.DoubleSide;
  var roadM=mat(0x3e424b,ctex(roadCanvas(),1,L/16),{side:DS});
  var curbM=mat(0xc9202b,ctex(curbCanvas(),1,L/5),{side:DS});
  var wallM=mat(0xaaaaaa,ctex(wallCanvas(),1,L/9),{side:DS});
  strip(-H,0.02,H,0.02,roadM);
  [-1,1].forEach(function(s){
    strip(s*H,0.04,s*(H+2.4),0.04,curbM);
    strip(s*(H+2.4),0.04,s*(H+2.4),1.3,wallM);
    strip(s*(H+2.4),1.3,s*(H+3.4),1.3,curbM);
  });

  var fcv=finishCanvas();
  if(fcv){
    var ft=ctex(fcv,1,1), fl=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W,2),mat(0xffffff,ft));
    fl.rotation.x=-Math.PI/2; fl.position.set(P[0].x,0.045,P[0].z); fl.rotation.z=Math.atan2(T[0].x,T[0].z)+Math.PI; scene.add(fl);
  }
  /* start / finish gantry at the first sample */
  var gantry=new THREE.Group(), p0=P[0], t0=T[0];
  gantry.position.set(p0.x,0,p0.z); gantry.rotation.y=Math.atan2(t0.x,t0.z);
  var dark=mat(0x14171d);
  gantry.add(box(2,15,2,dark,-(H+2.4),7.5,0), box(2,15,2,dark,H+2.4,7.5,0), box(ROAD_W+7,6.6,1.4,dark,0,12,0));
  var bannerTex=ctex(bannerCanvas(title),1,1);
  var banner=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W+4.4,(ROAD_W+4.4)/8),bannerTex?basic(0xffffff,{map:bannerTex}):basic(0xc9202b));
  banner.position.set(0,12,-0.75); banner.rotation.y=Math.PI; gantry.add(banner);
  var lightMats=[];
  [-5.5,0,5.5].forEach(function(x){
    var lm=basic(0xffa07a); lightMats.push(lm);
    var s=new THREE.Mesh(new THREE.SphereGeometry(1.3,14,10),lm); s.position.set(x,7.2,-0.2);
    gantry.add(s, box(3.2,3.2,0.5,dark,x,7.2,0.3));
  });
  scene.add(gantry);

  /* grandstand beside the track, just after the start line */
  var gs=new THREE.Group(), gi=Math.round(N*0.02);
  gs.position.set(P[gi].x+NN[gi].x*(H+30),0,P[gi].z+NN[gi].z*(H+30));
  gs.rotation.y=Math.atan2(T[gi].x,T[gi].z)
  gs.add(box(9,5,34,mat(0x8d96a3),0,2.5,0), box(11,0.6,36,mat(0xb3262e),-1,9.5,0));
  [-16,16].forEach(function(z){gs.add(box(0.5,9,0.5,mat(0x555d6b),-4.6,4.7,z))});
  var crowdGeo=new THREE.BoxGeometry(0.9,1.5,0.9), crowd=new THREE.InstancedMesh(crowdGeo,new THREE.MeshLambertMaterial({color:0xffffff}),170), m4=new THREE.Matrix4(), col=new THREE.Color();
  var pal=[0xe63946,0xf4a261,0x2a9d8f,0x457b9d,0xf1fa8c,0x9b5de5,0xffffff,0x3a86ff];
  for(i=0;i<170;i++){
    var row=Math.floor(i/57), z=-15.5+(i%57)*0.545;
    m4.makeTranslation(-3.2+row*0.0-row*1.1,5.6+row*1.05,z); crowd.setMatrixAt(i,m4);
    col.setHex(pal[Math.floor(rnd()*pal.length)]); crowd.setColorAt(i,col);
  }
  crowd.instanceColor.needsUpdate=true; gs.add(crowd);
  /* local +x of this group points along the track normal, so the stand opens toward the road */
  gs.rotation.y=Math.atan2(T[gi].x,T[gi].z)+Math.PI/2;
  scene.add(gs);

  /* trees */
  function nearTrack(x,z,minD){ return dTrack(x,z)<minD; }
  var trees=[], tries=0;
  while(trees.length<240&&tries<9000){
    tries++;
    var tx=(rnd()-.5)*1000+10, tz=(rnd()-.5)*760;
    if(nearTrack(tx,tz,H+14)) continue;
    trees.push([tx,tz,0.8+rnd()*0.9,hAt(tx,tz)]);
  }
  var nPine=Math.floor(trees.length*0.65), nRound=trees.length-nPine;
  var cone=new THREE.InstancedMesh(flat(new THREE.ConeGeometry(2.6,7,7)),new THREE.MeshLambertMaterial({color:0x2f8f46}),nPine);
  var crown=new THREE.InstancedMesh(flat(new THREE.IcosahedronGeometry(3.1,0)),new THREE.MeshLambertMaterial({color:0x58b94f}),Math.max(1,nRound));
  var trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.45,0.55,2.2,6),new THREE.MeshLambertMaterial({color:0x7a4b2a}),trees.length);
  trees.forEach(function(tr,j){
    var sc=tr[2], gy=tr[3];
    m4.makeScale(sc,sc,sc); m4.setPosition(tr[0],gy+1.1*sc,tr[1]); trunk.setMatrixAt(j,m4);
    if(j<nPine){ m4.makeScale(sc,sc,sc); m4.setPosition(tr[0],gy+(2.2+3.5)*sc,tr[1]); cone.setMatrixAt(j,m4); }
    else { m4.makeScale(sc,sc,sc); m4.setPosition(tr[0],gy+(2.2+2.4)*sc,tr[1]); crown.setMatrixAt(j-nPine,m4); }
  });
  scene.add(trunk,cone,crown);

  /* distant skyline, clouds */
  var wins=[winCanvas(5),winCanvas(9)], bmats=wins.map(function(cv,k){return mat(0xffffff,ctex(cv,3,6+k*2))});
  if(!wins[0]) bmats=[mat(0xb7c0cc),mat(0xa9b4c4)];
  for(i=0;i<22;i++){
    var ang=i/22*Math.PI*2+rnd()*.25, rad=1+rnd()*0.18, h=40+rnd()*70, w=22+rnd()*20, bx=Math.cos(ang)*rad*520+10, bz=Math.sin(ang)*rad*390;
    var bgy=hAt(bx,bz);
    scene.add(box(w,h,w,bmats[i%bmats.length],bx,bgy+h/2-1,bz));
  }
  var cloudM=basic(0xffffff,{fog:false});
  for(i=0;i<9;i++){
    var cg=new THREE.Group(), ca=rnd()*Math.PI*2, cr=340+rnd()*300;
    for(k=0;k<3;k++){var sp=new THREE.Mesh(new THREE.SphereGeometry(14+rnd()*10,8,6),cloudM); sp.position.set(k*16-16,rnd()*4,rnd()*8); sp.scale.y=0.55; cg.add(sp)}
    cg.position.set(Math.cos(ca)*cr,120+rnd()*60,Math.sin(ca)*cr); scene.add(cg);
  }

  function redrawBanner(t){
    if(!bannerTex) return;
    var cv=bannerCanvas(t); if(!cv) return;
    var g2=bannerTex.image.getContext('2d'); g2.clearRect(0,0,2048,256); g2.drawImage(cv.c,0,0); bannerTex.needsUpdate=true;
  }
  function dispose(){
    scene.traverse(function(o){
      if(o.geometry) o.geometry.dispose();
      if(o.material){ [].concat(o.material).forEach(function(m){ if(m.map) m.map.dispose(); m.dispose(); }); }
    });
  }
  return {scene:scene,sun:sun,curve:curve,L:L,N:N,P:P,T:T,NN:NN,lights:lightMats,redrawBanner:redrawBanner,dispose:dispose};
}

/* ---------- cars (facing +Z) ---------- */
function plateCanvas(label){
  var cv=mkCanvas(96,96); if(!cv) return null; var g=cv.g;
  g.fillStyle='#fff'; g.beginPath(); g.arc(48,48,45,0,Math.PI*2); g.fill();
  g.fillStyle='#14171d'; g.beginPath(); g.arc(48,48,38,0,Math.PI*2); g.lineWidth=5; g.strokeStyle='#14171d'; g.stroke();
  g.fillStyle='#14171d'; g.font='800 52px Cairo, Arial, sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(label,48,52);
  return cv;
}
function glowCanvas(){
  var cv=mkCanvas(64,64); if(!cv) return null; var g=cv.g, gr=g.createRadialGradient(32,32,1,32,32,31);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.35,'rgba(255,255,255,.5)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); return cv;
}
function makeCar(col,label,envOk,isMe){
  var hue=col.h;
  var g=new THREE.Group();
  var body=new THREE.Color().setHSL(col.h/360,col.s,col.l), deep=new THREE.Color().setHSL(col.h/360,col.s*0.9,col.l*0.45);
  function paint(c,m,r){ return envOk?new THREE.MeshStandardMaterial({color:c.getHex?c.getHex():c,metalness:m,roughness:r}):new THREE.MeshPhongMaterial({color:c.getHex?c.getHex():c,shininess:70,specular:0x555555}); }
  var bm=paint(body,0.62,0.3), dm=paint(deep,0.5,0.4), carbon=paint(0x15171c,0.4,0.5), rimM=paint(0xcfd5df,0.9,0.22), glass=paint(0x0a1120,0.9,0.08);
  var wm=mat(0x17191f), white=mat(0xf4f4f4), disc=paint(0x8a909c,0.8,0.4), red=mat(0xd62a2a);
  function add(m){g.add(m); return m}
  add(box(2.3,0.5,4.7,bm,0,0.8,0));
  add(box(2.36,0.18,4.4,carbon,0,0.5,0));
  add(box(2.1,0.2,1.6,bm,0,1.1,1.45));
  add(box(0.8,0.14,0.9,carbon,0,1.2,1.3));
  add(box(2.34,0.5,0.36,dm,0,0.78,2.42));
  add(box(1.3,0.24,0.1,mat(0x0b0c10),0,0.74,2.62));
  add(box(2.6,0.07,0.55,carbon,0,0.4,2.55));
  add(box(0.14,0.22,2.7,carbon,-1.2,0.46,0.1), box(0.14,0.22,2.7,carbon,1.2,0.46,0.1));
  add(box(1.9,0.3,0.4,carbon,0,0.5,-2.45));
  add(box(1.85,0.62,2.0,glass,0,1.42,-0.25));
  add(box(1.95,0.14,2.2,bm,0,1.8,-0.25));
  add(box(0.22,0.12,0.4,dm,-1.1,1.42,0.55), box(0.22,0.12,0.4,dm,1.1,1.42,0.55));
  add(box(0.34,0.03,1.25,white,-0.38,1.11,-1.55)); add(box(0.34,0.03,1.25,white,0.38,1.11,-1.55));
  add(box(0.34,0.03,1.0,white,-0.38,1.215,1.4)); add(box(0.34,0.03,1.0,white,0.38,1.215,1.4));
  add(box(2.9,0.11,0.95,bm,0,2.1,-2.12)); add(box(0.09,0.55,1.0,dm,-1.45,2.0,-2.12)); add(box(0.09,0.55,1.0,dm,1.45,2.0,-2.12));
  add(box(0.16,0.75,0.16,dm,-0.95,1.72,-2.05)); add(box(0.16,0.75,0.16,dm,0.95,1.72,-2.05));
  var tailOff=basic(0x8c1018), tails=[tailOff];
  var tl=box(0.7,0.24,0.08,tailOff,-0.75,0.98,-2.36), tr=box(0.7,0.24,0.08,tailOff,0.75,0.98,-2.36); add(tl); add(tr);
  var bar=box(0.9,0.07,0.06,tailOff,0,1.0,-2.37); add(bar);
  var hl=basic(0xfff6d2); add(box(0.7,0.16,0.1,hl,-0.72,0.97,2.4)); add(box(0.7,0.16,0.1,hl,0.72,0.97,2.4));
  add(box(0.55,0.05,0.1,basic(0xffffff),-0.72,0.84,2.43)); add(box(0.55,0.05,0.1,basic(0xffffff),0.72,0.84,2.43));
  add(box(0.5,0.18,0.08,basic(0xffa347),-1.05,0.72,2.43)); add(box(0.5,0.18,0.08,basic(0xffa347),1.05,0.72,2.43));
  var metal=paint(0x7b8392,0.9,0.3);
  [-0.55,0.55].forEach(function(x){var ex=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.11,0.6,10),metal); ex.rotation.x=Math.PI/2; ex.position.set(x,0.5,-2.62); g.add(ex)});
  var pt=ctex(plateCanvas(label),1,1);
  var plate=new THREE.Mesh(new THREE.PlaneGeometry(1.45,1.45),pt?basic(0xffffff,{map:pt}):basic(0xffffff));
  plate.rotation.set(-Math.PI/2,0,Math.PI); plate.position.set(0,1.885,-0.25); g.add(plate);
  var wheels=[];
  [[-1.25,1.5],[1.25,1.5],[-1.25,-1.5],[1.25,-1.5]].forEach(function(w){
    var pivot=new THREE.Group(); pivot.position.set(w[0],0.64,w[1]);
    var tire=new THREE.Mesh(new THREE.CylinderGeometry(0.64,0.64,0.62,14),wm); tire.rotation.z=Math.PI/2; pivot.add(tire);
    var rim=new THREE.Mesh(new THREE.CylinderGeometry(0.43,0.43,0.66,14),rimM); rim.rotation.z=Math.PI/2; pivot.add(rim);
    for(var k=0;k<5;k++){var sp=box(0.7,0.09,0.84,carbon,0,0,0); sp.rotation.x=k*Math.PI/5; pivot.add(sp)}
    var hb=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.72,8),rimM); hb.rotation.z=Math.PI/2; pivot.add(hb);
    g.add(pivot); wheels.push(pivot);
    g.add(box(0.12,0.2,0.34,red,w[0]>0?w[0]-0.2:w[0]+0.2,0.84,w[1]));
  });
  var gt=ctex(glowCanvas(),1,1), glows=[];
  [-0.75,0.75].forEach(function(x){
    var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,color:0xff2a2a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    sp.position.set(x,1.0,-2.5); sp.scale.set(2.3,1.3,1); g.add(sp); glows.push(sp);
  });
  var ug=null;
  if(isMe&&gt){
    ug=new THREE.Mesh(new THREE.PlaneGeometry(4.6,7.2),new THREE.MeshBasicMaterial({map:gt,color:new THREE.Color(col.css),transparent:true,opacity:0.5,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    ug.rotation.x=-Math.PI/2; ug.position.y=0.1; g.add(ug);
  }
  var sh=new THREE.Mesh(new THREE.CircleGeometry(1,18),basic(0x000000,{transparent:true,opacity:0.2,depthWrite:false}));
  sh.scale.set(2.0,3.3,1); sh.rotation.x=-Math.PI/2; sh.position.y=0.07; g.add(sh);
  g.traverse(function(o){ if(o.isMesh&&o!==sh&&o!==plate&&o!==ug) o.castShadow=true; });
  function brake(on){
    tailOff.color.setHex(on?0xff2626:0x8c1018);
    glows.forEach(function(s){s.material.opacity=on?0.95:0});
  }
  return {group:g,wheels:wheels,color:body,brake:brake};
}

/* ---------- the live stage ---------- */

/* ---------- lite car: ~12 meshes with shared geometry, used for the crowd when there are many players ---------- */
var liteG=null, liteM={}, liteWheelM=null, liteDark=null, liteBlobM=null;
function makeLiteCar(col){
  if(!liteG){
    liteG={body:new THREE.BoxGeometry(2.3,0.55,4.6),nose:new THREE.BoxGeometry(1.3,0.32,1.6),cab:new THREE.BoxGeometry(1.5,0.62,1.9),wing:new THREE.BoxGeometry(2.9,0.12,0.9),
      fwing:new THREE.BoxGeometry(2.6,0.08,0.5),stripe:new THREE.BoxGeometry(0.5,0.03,3.6),wheel:new THREE.CylinderGeometry(0.64,0.64,0.62,10),blob:new THREE.CircleGeometry(1,14)};
    liteWheelM=new THREE.MeshLambertMaterial({color:0x17191f}); liteDark=new THREE.MeshLambertMaterial({color:0x14171d});
    liteBlobM=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.22,depthWrite:false});
  }
  var key=col.css, bm=liteM[key];
  if(!bm){ bm=liteM[key]={body:new THREE.MeshLambertMaterial({color:new THREE.Color().setHSL(col.h/360,col.s,col.l)}),stripe:new THREE.MeshLambertMaterial({color:0xffffff})}; }
  var g=new THREE.Group(), m;
  function add(geo,mt,x,y,z){ m=new THREE.Mesh(geo,mt); m.position.set(x,y,z); g.add(m); return m; }
  add(liteG.body,bm.body,0,0.8,0); add(liteG.nose,bm.body,0,0.72,2.6); add(liteG.cab,liteDark,0,1.35,-0.25);
  add(liteG.wing,bm.body,0,2.05,-2.1); add(liteG.fwing,liteDark,0,0.45,3.1); add(liteG.stripe,bm.stripe,0,1.1,0);
  var wheels=[];
  [[-1.25,1.5],[1.25,1.5],[-1.25,-1.5],[1.25,-1.5]].forEach(function(w){
    var pv=new THREE.Group(); pv.position.set(w[0],0.64,w[1]);
    var t=new THREE.Mesh(liteG.wheel,liteWheelM); t.rotation.z=Math.PI/2; pv.add(t); g.add(pv); wheels.push(pv);
  });
  var sh=new THREE.Mesh(liteG.blob,liteBlobM); sh.scale.set(2.0,3.3,1); sh.rotation.x=-Math.PI/2; sh.position.y=0.07; g.add(sh);
  return {group:g,wheels:wheels,color:bm.body,brake:function(){},lite:true};
}

function create(host,R,env){
  env=env||{};
  var title=(R.cfg&&R.cfg.title)||'سباق المعرفة';
  var cvs=doc.createElement('canvas'); cvs.className='gl';
  var renderer;
  try{ renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,powerPreference:'high-performance'}); }catch(e){ return null; }
  if(!renderer||!renderer.getContext||!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));

  try{ renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; }catch(e){}
  var world=buildWorld(title), scene=world.scene, curve=world.curve, L=world.L, sun=world.sun;
  var P=world.P, T=world.T, N=world.N;
  /* soft reflections for the metallic paint, from a small sky scene */
  var envOk=false;
  try{
    var pm=new THREE.PMREMGenerator(renderer), es=new THREE.Scene();
    es.add(skyMesh(40,SKY));
    var sunBall=new THREE.Mesh(new THREE.SphereGeometry(4,10,8),new THREE.MeshBasicMaterial({color:0xfff3d0})); sunBall.position.set(22,20,14); es.add(sunBall);
    var rt=pm.fromScene(es); scene.environment=rt.texture; pm.dispose(); envOk=true;
  }catch(e){ envOk=false; }
  var TOTAL=LAPS*L, chunk=TOTAL/Math.max(1,R.total);
  var cam=new THREE.PerspectiveCamera(62,16/9,0.5,1500);
  var camLook=new V3(), camReady=false, fovBoost=0, baseFov=64;

  /* ---- motion constants (metres, seconds) ---- */
  var NP=R.players.length;
  var LW=4.4, MINF=7.4, LATSEP=3.8, ROWGAP=12;               /* lane width, min forward gap, min lateral gap, grid row gap */
  var VMAX=150, ACC=100, DEC=85, IDLE=8, STEP=1/60;
  /* lanes alternate HOME (even index, where the grid cars sit) and CORRIDOR (odd index, kept empty) so any car can always overtake
     through a free corridor without ever coming within the minimum lateral distance of anyone */
  var nHome=NP<=3?3:(NP<=8?Math.max(4,Math.ceil(NP/2)):6), nLanes=2*nHome-1;
  var laneOrder=(function(){var a=[],j;for(j=0;j<nHome;j++)a.push(j*2);var mid=(nLanes-1)/2;a.sort(function(x,y){return Math.abs(x-mid)-Math.abs(y-mid)||x-y});return a})();
  function laneLat(j){return (j-(nLanes-1)/2)*LW}
  var creepW=Math.min(chunk*0.3,26);

  /* cars: index 0 is the student */
  var entries=R.players.map(function(p){return {id:p.id,name:p.name,color:p.color,me:p.id===R.myId}});
  var tagsBox=doc.createElement('div'); tagsBox.className='tags';
  var crowded=NP>12;
  var cars=entries.map(function(e,i){
    var mc=(crowded&&!e.me)?makeLiteCar(e.color):makeCar(e.color,e.me?'★':String(i+1),envOk,!!e.me); scene.add(mc.group);
    mc.group.rotation.order='YXZ';
    var lane=laneOrder[i%nHome], row=Math.floor(i/nHome);
    var tag=doc.createElement('div'); tag.className='tag'+(e.me?' me':''); tag.textContent=e.name;
    tag.style.background=e.color.css+'e0'; tagsBox.appendChild(tag);
    var s0=-(14+row*ROWGAP+((lane/2)%2?4:0));
    return {id:e.id,name:e.name,color:e.color,me:!!e.me,group:mc.group,wheels:mc.wheels,brake:mc.brake,braking:null,emit:0,idx:i,
      s:s0,ps:s0,v:0,acc:0,accel:0,speed:0,
      lane:lane,home:lane,lat:laneLat(lane),plat:laneLat(lane),laneT:lane,latV:0,blocked:0,laneChk:0,hold:0,
      target:0,disp:s0,launch:0,near:false,vis:true,boost:0,spinT:0,spinHit:false,
      fwd:new V3(0,0,1),tag:tag,tagW:0,lastScore:0,lite:!!mc.lite};
  });
  var me=cars.filter(function(c){return c.me})[0]||cars[0];
  function scoreOf(id){for(var q=0;q<R.players.length;q++) if(R.players[q].id===id) return R.players[q].score||0; return 0}
  function tieOf(id){for(var q=0;q<R.players.length;q++) if(R.players[q].id===id) return q; return 999}

  /* HUD */
  var hud=doc.createElement('div'); hud.className='hud';
  hud.innerHTML=
   '<div class="hud-pills"><div class="pill pill-rank"><span>المركز</span><b class="v-rank">1</b><small>/<span class="v-n"></span></small></div>'+
   '<div class="pill pill-lap"><span>اللفة</span><b class="v-lap">1</b><small>/'+LAPS+'</small></div>'+
   '<div class="pill pill-ok"><i class="okbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></i><b class="v-ok">0</b></div></div>'+
   '<ol class="hud-board" aria-label="الترتيب"></ol>'+
   '<canvas class="hud-mini" width="300" height="190" aria-hidden="true"></canvas>';
  var sl=doc.createElement('div'); sl.className='sl'; var fl=doc.createElement('div'); fl.className='flash';
  host.insertBefore(fl,host.firstChild); host.insertBefore(sl,host.firstChild);
  var cd=doc.createElement('div'); cd.className='cd'; cd.setAttribute('aria-live','assertive');
  host.insertBefore(cd,host.firstChild); host.insertBefore(tagsBox,host.firstChild); host.insertBefore(hud,host.firstChild); host.insertBefore(cvs,host.firstChild);
  var vRank=hud.querySelector('.v-rank'), vLap=hud.querySelector('.v-lap'), vOk=hud.querySelector('.v-ok'), board=hud.querySelector('.hud-board');
  hud.querySelector('.v-n').textContent=cars.length;
  var toastEl=doc.createElement('div'); toastEl.className='toast3d'; host.insertBefore(toastEl,host.firstChild);
  function toast(text,kind){ toastEl.className='toast3d'; toastEl.textContent=text; void toastEl.offsetWidth; toastEl.className='toast3d show '+(kind||''); }
  var miniC=hud.querySelector('.hud-mini'), mg=miniC.getContext('2d');
  /* minimap: static outline drawn once */
  var minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  world.P.forEach(function(p){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z)});
  var mw=miniC.width, mh=miniC.height, msc=Math.min((mw-44)/(maxX-minX),(mh-44)/(maxZ-minZ));
  function mx(x){return mw/2+(x-(minX+maxX)/2)*msc} function mz(z){return mh/2+(z-(minZ+maxZ)/2)*msc}
  var outline=mkCanvas(mw,mh);
  if(outline){
    var og=outline.g; og.lineJoin='round'; og.lineCap='round';
    og.beginPath(); world.P.forEach(function(p,j){j?og.lineTo(mx(p.x),mz(p.z)):og.moveTo(mx(p.x),mz(p.z))}); og.closePath();
    og.strokeStyle='#ffffff'; og.lineWidth=15; og.stroke(); og.strokeStyle='#3a4150'; og.lineWidth=7; og.stroke();
  }
  function drawMini(){
    if(!mg) return;
    mg.clearRect(0,0,mw,mh); if(outline) mg.drawImage(outline.c,0,0);
    for(var j=cars.length-1;j>=0;j--){
      var c=cars[j], p=c.group.position;
      mg.beginPath(); mg.arc(mx(p.x),mz(p.z),c.me?11:7,0,Math.PI*2);
      mg.fillStyle=c.me?'#ef4146':c.color.css; mg.fill();
      mg.lineWidth=c.me?4:2.5; mg.strokeStyle='#fff'; mg.stroke();
    }
  }

  /* pooled dust / smoke puffs */
  var puffTex=ctex(puffCanvas(),1,1), puffs=[];
  for(var pi=0;pi<72;pi++){
    var psp=new THREE.Sprite(new THREE.SpriteMaterial({map:puffTex,color:0xdcd3c0,transparent:true,opacity:0,depthWrite:false,fog:true}));
    psp.visible=false; scene.add(psp); puffs.push({s:psp,life:0,max:1,vx:0,vy:0,vz:0,s0:1,s1:2,a:0.5});
  }
  /* flames: additive glowing sprites shot out of the exhausts while a car is boosting */
  var flameTex=ctex(flameCanvas(),1,1), flames=[], flameI=0;
  for(var fi=0;fi<90;fi++){
    var fsp=new THREE.Sprite(new THREE.SpriteMaterial({map:flameTex,color:0xff9a2a,transparent:true,opacity:0,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
    fsp.visible=false; scene.add(fsp); flames.push({s:fsp,life:0,max:1,vx:0,vy:0,vz:0,s0:1,s1:2});
  }
  function emitFlame(x,y,z,vx,vy,vz,life,s0,s1,col){
    var q=flames[flameI]; flameI=(flameI+1)%flames.length;
    q.life=q.max=life; q.vx=vx; q.vy=vy; q.vz=vz; q.s0=s0; q.s1=s1; q.s.position.set(x,y,z); q.s.material.color.setHex(col); q.s.visible=true;
  }
  function updateFlames(dt){
    for(var j=0;j<flames.length;j++){
      var q=flames[j]; if(q.life<=0) continue;
      q.life-=dt; if(q.life<=0){q.s.visible=false; continue;}
      var t=1-q.life/q.max; q.s.position.x+=q.vx*dt; q.s.position.y+=q.vy*dt; q.s.position.z+=q.vz*dt;
      var sz=q.s0+(q.s1-q.s0)*t; q.s.scale.set(sz,sz,1); q.s.material.opacity=(1-t)*(t<0.1?t/0.1:1);
    }
  }
  var puffI=0;
  function emitPuff(x,y,z,vx,vy,vz,life,s0,s1,a,col){
    var q=puffs[puffI]; puffI=(puffI+1)%puffs.length;
    q.life=q.max=life; q.vx=vx; q.vy=vy; q.vz=vz; q.s0=s0; q.s1=s1; q.a=a;
    q.s.position.set(x,y,z); q.s.material.color.setHex(col); q.s.visible=true;
  }
  function updatePuffs(dt){
    for(var j=0;j<puffs.length;j++){
      var q=puffs[j]; if(q.life<=0) continue;
      q.life-=dt; if(q.life<=0){q.s.visible=false; continue;}
      var t=1-q.life/q.max; q.s.position.x+=q.vx*dt; q.s.position.y+=q.vy*dt; q.s.position.z+=q.vz*dt;
      var sz=q.s0+(q.s1-q.s0)*t; q.s.scale.set(sz,sz,1); q.s.material.opacity=q.a*(1-t)*(t<0.12?t/0.12:1);
    }
  }
  var shake=0, boostT=0, SPIN_DUR=1.05;
  function startSpin(c){ if(c.spinT>0) return; c.spinT=SPIN_DUR; c.spinHit=true; }

  /* placement and motion
     Model: every car has a LOGICAL target (= correct answers x chunk, the same on every screen) and a DISPLAY target that spreads
     cars with equal progress into a staggered grid (fixed lane per car, rows MINF+ apart). The simulation runs at a fixed 60 Hz
     (so the same answer gives the same movement on any device), uses a braking-distance speed profile with jerk-smoothed
     acceleration, never lets a car enter another car's footprint (it brakes instead of pushing) and only changes lane when the
     neighbouring lane is clear. Rendering interpolates between the last two simulation states. */
  var DRIFT=0.5, done=0, qDur=12, tMark=0, lastRev=0;   /* cars cruise forward all the time: DRIFT of each question's distance is covered while the clock runs, a correct answer adds the rest */
  var pA=new V3(), tA=new V3(), time=0, running=false, final=false, timers=[], raf=0, last=0, hudT=0, disposed=false, accT=0, alpha=0, runT=0, synced=false;
  function sampleTrack(sd){
    var u=(((sd%L)+L)%L)/L*N, i=Math.floor(u), f=u-i; if(i>=N){i=0;f=0}
    var a=P[i], b=P[i+1], ta=T[i], tb=T[i+1];
    pA.set(a.x+(b.x-a.x)*f,0,a.z+(b.z-a.z)*f); tA.set(ta.x+(tb.x-ta.x)*f,0,ta.z+(tb.z-ta.z)*f); tA.normalize();
  }
  function place(c){
    var s=c.ps+(c.s-c.ps)*alpha, lat=c.plat+(c.lat-c.plat)*alpha;
    sampleTrack(s); c.fwd.copy(tA);
    var sw=c.speed>6?Math.sin(time*0.9+c.idx*1.7)*0.32*clamp(c.speed/40,0,1):0; lat+=sw;
    c.group.position.set(pA.x+tA.z*lat,0,pA.z-tA.x*lat);
    var spinA=0, hop=0;
    if(c.spinT>0){ var u=1-c.spinT/SPIN_DUR; var e=1-Math.pow(1-u,2.2); spinA=Math.PI*2*e; hop=Math.sin(u*Math.PI)*0.35; }
    c.group.rotation.y=Math.atan2(tA.x,tA.z)+clamp(c.latV*0.011,-0.1,0.1)+spinA;
    c.group.position.y=hop;
    c.group.rotation.x=-clamp(c.accel*0.00045,-0.05,0.045);
  }
  function layout(){
    var order=cars.slice().sort(function(a,b){return b.target-a.target||tieOf(a.id)-tieOf(b.id)}), cnt={};
    order.forEach(function(c){
      var key=c.target+'|'+c.home, k=cnt[key]||0; cnt[key]=k+1;
      c.base=chunk*(DRIFT*done+(1-DRIFT)*(c.target/chunk))-(c.target===0&&done===0?14:0)-k*ROWGAP-((c.home/2)%2?4:0); c.disp=c.base;
    });
  }
  function ring(d){ return d-L*Math.round(d/L); }   /* signed distance along the closed track, so cars a whole lap apart still see each other */
  function laneFree(c,lane,extra){
    var tl=laneLat(lane), lo=Math.min(c.lat,tl)+0.5, hi=Math.max(c.lat,tl)-0.5;
    for(var q=0;q<cars.length;q++){
      var o=cars[q]; if(o===c) continue;
      if(Math.abs(ring(o.s-c.s))>MINF+extra) continue;
      var ol=laneLat(o.laneT);
      if(Math.abs(o.lat-tl)<LATSEP||Math.abs(ol-tl)<LATSEP||(o.lat>lo&&o.lat<hi)) return false;
    }
    return true;
  }
  function simStep(dt){
    var q,k,c,o;
    if(running) runT+=dt;
    var dr=(running&&!final)?chunk*DRIFT*Math.min(1,(runT-tMark)/qDur):0;
    for(q=0;q<cars.length;q++){ cars[q].disp=(cars[q].base==null?cars[q].disp:cars[q].base)+dr; }
    for(q=0;q<cars.length;q++){ c=cars[q]; c.ps=c.s; c.plat=c.lat; }
    for(q=0;q<cars.length;q++){
      c=cars[q];
      /* 1. wanted speed from the braking distance to the display target */
      var vd=0, launching=running&&!final&&c.target===0&&runT>=c.launch&&runT<c.launch+2.2;
      if(running){
        var gap=c.disp-c.s, W=launching?46:creepW, idleV=launching?30:IDLE;
        if(gap>0.3) vd=Math.min(c.boost>0?VMAX*1.3:VMAX,(final?0:idleV)+Math.sqrt(2*DEC*0.8*gap)*(c.boost>0?1.28:1));
        else { var rem=c.disp+W-c.s; vd=(final||rem<=0)?0:Math.min(idleV,Math.sqrt(2*6*rem)); }
      }
      /* 2. jerk-limited acceleration */
      if(c.boost>0) c.boost=Math.max(0,c.boost-dt);
      if(c.spinT>0&&c.spinHit){ c.v*=0.55; c.acc=0; c.spinHit=false; }              /* a spin-out scrubs speed off, then the car carries on */
      var a=clamp((vd-c.v)*6,-DEC,c.boost>0?ACC*1.7:ACC);
      c.acc+=(a-c.acc)*(1-Math.exp(-dt*16));
      c.v=Math.max(0,c.v+c.acc*dt);
      /* 3. safe spacing: never enter the footprint of a car ahead in (nearly) the same lane */
      var ns=c.s+c.v*dt, lim=1e9;
      for(k=0;k<cars.length;k++){
        o=cars[k]; if(o===c) continue;
        if(Math.abs(o.lat-c.lat)<LATSEP){ var ds=ring(o.s-c.s); if(ds>=0&&(ds>0||o.idx<c.idx)) lim=Math.min(lim,c.s+ds-MINF); }
      }
      if(ns>lim){ ns=Math.max(c.s,lim); c.v=Math.min(c.v,(ns-c.s)/dt); if(c.disp-c.s>1.5) c.blocked+=dt; } else c.blocked=Math.max(0,c.blocked-dt*2);
      c.s=ns; c.speed=c.v; c.accel=c.acc;
      /* 4. lane change only into a clear lane (overtake), then return to the home lane */
      c.laneChk-=dt; c.hold-=dt;
      if(c.laneChk<=0){
        c.laneChk=0.3;
        var settled=Math.abs(laneLat(c.laneT)-c.lat)<0.5;
        if(settled&&c.blocked>0.25){
          var ex=c.blocked>1.6?0:8, cand=[], mid=(nLanes-1)/2, dd;
          for(dd=1;dd<nLanes;dd++){ if(c.laneT>mid){cand.push(c.laneT-dd,c.laneT+dd)} else {cand.push(c.laneT+dd,c.laneT-dd)} }
          for(k=0;k<cand.length;k++){ if(cand[k]>=0&&cand[k]<nLanes&&laneFree(c,cand[k],ex)){ c.laneT=cand[k]; c.blocked=0; c.hold=2.2; break; } }
        } else if(settled&&c.laneT!==c.home&&c.hold<=0&&laneFree(c,c.home,12)){
          var tl=laneLat(c.home), clear=true, o2;
          for(k=0;k<cars.length;k++){ o2=cars[k]; if(o2!==c&&Math.abs(o2.lat-tl)<LATSEP&&ring(o2.s-c.s)>-2&&ring(o2.s-c.s)<MINF+22){ clear=false; break; } }
          if(clear){ c.laneT=c.home; c.hold=1.2; }
        }
      }
      var dl=laneLat(c.laneT)-c.lat, lv=clamp(dl*3,-7,7);
      c.latV+=(lv-c.latV)*(1-Math.exp(-dt*8));
      var nl=c.lat+c.latV*dt, ok=true;
      if(Math.abs(nl-c.lat)>1e-5){
        for(k=0;k<cars.length;k++){ o=cars[k]; if(o===c) continue;
          if(Math.abs(ring(o.s-c.s))<MINF+1&&Math.abs(o.lat-c.lat)>=LATSEP&&Math.abs(o.lat-nl)<LATSEP){ ok=false; break; } }
      }
      if(ok) c.lat=(Math.abs(laneLat(c.laneT)-nl)<0.04)?laneLat(c.laneT):nl; else c.latV=0;
      for(k=0;k<c.wheels.length;k++) c.wheels[k].rotation.x+=c.v*dt/0.64;
    }
  }
  function step(dt){
    accT+=Math.min(dt,0.25); var n=0;
    while(accT>=STEP&&n<15){ simStep(STEP); accT-=STEP; n++; }
    if(n>=15) accT=0;
    alpha=accT/STEP;
  }
  layout(); cars.forEach(function(c){c.s=c.ps=c.disp});
  var fwdTmp=new V3();
  function effects(dt){
    cars.forEach(function(c){
      var dx=c.group.position.x-me.group.position.x, dz=c.group.position.z-me.group.position.z; c.near=(dx*dx+dz*dz)<3600;
      var br=!running||c.accel<-22;
      if(br!==c.braking){ c.braking=br; c.brake(br); }
      var rate=0;
      if(!c.me&&!c.near) return;
      if(c.speed>16&&c.accel>6) rate=c.me?34:14; else if(c.speed>60) rate=c.me?9:4; else if(c.speed>8) rate=c.me?6:2.5;
      if(boostT>0&&c.me) rate=Math.max(rate,48);
      if(c.boost>0&&(c.me||c.near)){
        c.femit=(c.femit||0)+dt*(c.me?85:34);
        while(c.femit>=1){
          c.femit-=1; var fp=c.group.position, ff=c.fwd, side=(Math.random()<.5?-1:1)*0.5, jit=(Math.random()-.5)*0.25, kk=Math.random();
          emitFlame(fp.x-ff.x*(2.5+kk*0.5)+ff.z*side,0.5+Math.random()*0.15,fp.z-ff.z*(2.5+kk*0.5)-ff.x*side,
            -ff.x*(9+Math.random()*7)+jit*4,(Math.random()-.5)*1.2,-ff.z*(9+Math.random()*7)+jit*4,0.38+Math.random()*0.3,c.me?1.7:1.1,c.me?4.4:2.8,kk<.35?0xffe27a:kk<.75?0xff9a2a:0xff4d1a);
        }
      }
      if(c.spinT>0){
        c.semit=(c.semit||0)+dt*40;
        while(c.semit>=1){ c.semit-=1; var sp2=c.group.position; emitPuff(sp2.x+(Math.random()-.5)*2.2,0.3,sp2.z+(Math.random()-.5)*2.2,(Math.random()-.5)*3,1+Math.random()*1.4,(Math.random()-.5)*3,0.8,1.0,3.4,0.5,0xeeeeee); }
      }
      c.emit+=dt*rate;
      while(c.emit>=1){
        c.emit-=1; var p=c.group.position, f=c.fwd, sd=(Math.random()<.5?-1:1)*0.95;
        var heavy=c.me&&boostT>0, col=heavy?0xf4f4f4:0xd9cfb8;
        emitPuff(p.x-f.x*2.6+f.z*sd*(c.lat>0?1:1),0.35,p.z-f.z*2.6-f.x*sd,(Math.random()-.5)*2.4-f.x*c.speed*0.05,0.8+Math.random()*1.4,(Math.random()-.5)*2.4-f.z*c.speed*0.05,heavy?0.9:0.7,heavy?1.2:0.8,heavy?4.2:3,heavy?0.5:0.34,col);
      }
    });
    boostT=Math.max(0,boostT-dt);
    updatePuffs(dt); updateFlames(dt);
    var sp=me.speed/VMAX;
    var op=clamp((me.speed-40)/80,0,1)*0.55; sl.style.opacity=op.toFixed(3);
    sl.style.transform='rotate('+((time*9)%360).toFixed(1)+'deg) scale(1.5)';
    sun.position.set(me.group.position.x+90,150,me.group.position.z+60); sun.target.position.copy(me.group.position); sun.target.updateMatrixWorld();
    if(env.onFrame) env.onFrame(clamp(sp,0,1),running&&me.accel>6);
  }
  var cp=new V3(), cl=new V3();
  function updateCam(dt){
    var n0=Math.min(cars.length,30), back=11+n0*0.2+fovBoost*0.2, hgt=5.4+n0*0.14-fovBoost*0.02, lc=me.lat*0.5;
    cp.copy(me.group.position).addScaledVector(me.fwd,-back); cp.x-=me.fwd.z*lc; cp.z+=me.fwd.x*lc; cp.y=hgt;
    cl.copy(me.group.position).addScaledVector(me.fwd,26+n0*0.5); cl.x-=me.fwd.z*lc*0.8; cl.z+=me.fwd.x*lc*0.8; cl.y=2.2;
    if(!camReady){cam.position.copy(cp); camLook.copy(cl); camReady=true}
    cam.position.lerp(cp,1-Math.exp(-dt*6));
    camLook.lerp(cl,1-Math.exp(-dt*8));
    shake*=Math.exp(-dt*3.2);
    if(shake>0.01){ cam.position.x+=(Math.random()-.5)*0.16*shake; cam.position.y+=(Math.random()-.5)*0.12*shake; }
    cam.lookAt(camLook);
    fovBoost*=Math.exp(-dt*2.2);
    var f=baseFov+fovBoost; if(Math.abs(cam.fov-f)>0.02){cam.fov=f;cam.updateProjectionMatrix()}
  }
  var tv=new V3(), tagFrame=0, rects=[];
  function updateTags(w,h){
    if((tagFrame++)%2) return;
    var list=[], crowd=cars.length>12;
    cars.forEach(function(c){
      tv.copy(c.group.position); tv.y=3.9; tv.applyMatrix4(cam.matrixWorldInverse); var d=-tv.z; c.td=d;
      var want=d>=2&&d<=(crowd?58:140)||c.me||(c.rk&&c.rk<=3&&d>=2&&d<=220);
      if(!want){ if(c.tagOn!==false){c.tag.style.visibility='hidden'; c.tagOn=false} return; }
      list.push(c);
    });
    list.sort(function(a,b){ var pa=a.me?0:(a.rk<=3?1:2), pb=b.me?0:(b.rk<=3?1:2); return pa-pb||a.td-b.td; });
    rects.length=0;
    list.forEach(function(c){
      tv.copy(c.group.position); tv.y=3.9; tv.project(cam);
      var x=(tv.x*0.5+0.5)*w, y=(-tv.y*0.5+0.5)*h, sc=clamp(42/c.td,0.5,0.95);
      if(x<-60||x>w+60||y<-40||y>h+40){ if(c.tagOn!==false){c.tag.style.visibility='hidden'; c.tagOn=false} return; }
      if(!c.tagW) c.tagW=c.tag.offsetWidth||70;
      var rw=c.tagW*sc, rh=26*sc, x0=x-rw/2, y0=y-rh, hit=false;
      if(!c.me){ for(var q=0;q<rects.length;q++){ var R2=rects[q]; if(x0<R2[0]+R2[2]&&x0+rw>R2[0]&&y0<R2[1]+R2[3]&&y0+rh>R2[1]){ hit=true; break; } } }
      if(hit){ if(c.tagOn!==false){c.tag.style.visibility='hidden'; c.tagOn=false} return; }
      rects.push([x0,y0,rw,rh]);
      if(c.tagOn!==true){c.tag.style.visibility='visible'; c.tagOn=true}
      c.tag.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-100%) scale('+sc.toFixed(3)+')';
      c.tag.style.zIndex=String(Math.round(1000-c.td));
    });
  }
  var lastOrder='', lastRank=0, rankReady=false, prevRanks={};
  function orderNow(){ return cars.slice().sort(function(a,b){return b.target-a.target||tieOf(a.id)-tieOf(b.id)}); }
  function updateHud(){
    var order=orderNow(), rank=order.indexOf(me)+1; order.forEach(function(c,i){c.rk=i+1});
    vRank.textContent=rank; vOk.textContent=scoreOf(me.id);
    vLap.textContent=me.s>=TOTAL-0.5?LAPS:clamp(Math.floor(Math.max(0,me.s)/L)+1,1,LAPS);
    var shown=order.slice(0,6); if(rank>6) shown=order.slice(0,5).concat([me]);
    var key=shown.map(function(c){return c.id+':'+(order.indexOf(c)+1)}).join(',');
    if(key!==lastOrder){
      lastOrder=key; board.replaceChildren(); var nowRanks={};
      shown.forEach(function(c){
        var rk=order.indexOf(c)+1; nowRanks[c.id]=rk; var pr=prevRanks[c.id];
        var li=doc.createElement('li'); li.className=(c.me?'me':'')+(rk===1?' first':'')+(pr&&rk<pr?' up':'')+(pr&&rk>pr?' down':'');
        var n=doc.createElement('span'); n.className='bn'; n.textContent=order.indexOf(c)+1;
        var dot=doc.createElement('i'); dot.className='dot'; dot.style.background=c.me?'#ef4146':c.color.css;
        var t=doc.createElement('span'); t.className='bt'; t.textContent=c.me?'أنت':c.name;
        li.append(n,dot,t); board.appendChild(li);
      }); prevRanks=nowRanks;
    }
    return rank;
  }
  function resize(){
    var w=host.clientWidth, h=host.clientHeight; if(!w||!h) return;
    renderer.setSize(w,h,false);
    cam.aspect=w/h; baseFov=(cam.aspect<0.9?80:(cam.aspect<1.3?70:64))+(NP>12?3:0); cam.fov=baseFov+fovBoost; cam.updateProjectionMatrix();
  }
  var viewOff=0, qbEl=null;
  function applyOffset(snap){
    var w=host.clientWidth, h=host.clientHeight; if(!w||!h) return;
    qbEl=qbEl||host.querySelector('.qbox');
    var tgt=(qbEl&&!qbEl.hidden&&qbEl.offsetHeight)?(Math.min(qbEl.offsetHeight+16,h*0.66)*0.5+h*0.07):0;
    viewOff=snap?tgt:viewOff+(tgt-viewOff)*0.25;
    if(Math.abs(tgt-viewOff)<0.5) viewOff=tgt;
    cam.setViewOffset(w,h,0,Math.round(viewOff),w,h);
  }
  var ro=null; if(window.ResizeObserver){ ro=new ResizeObserver(resize); ro.observe(host); }
  window.addEventListener('resize',resize); resize();

  cars.forEach(function(c){place(c)}); updateCam(1); cam.updateMatrixWorld(); updateHud(); drawMini();
  function frame(now){
    if(disposed) return;
    raf=requestAnimationFrame(frame);
    var dt=Math.min(0.05,((now||0)-last)/1000); last=now||0; if(dt<=0) return;
    time+=dt; cars.forEach(function(c){ if(c.spinT>0) c.spinT=Math.max(0,c.spinT-dt); }); step(dt); cars.forEach(place); effects(dt); updateCam(dt);
    cam.updateMatrixWorld();
    renderer.render(scene,cam);
    updateTags(host.clientWidth,host.clientHeight); drawMini();
    hudT+=dt; if(hudT>0.12){hudT=0; updateHud();}
    applyOffset(false);
  }
  raf=requestAnimationFrame(function(t){last=t||0;frame(t)});
  if(doc.fonts&&doc.fonts.load){ doc.fonts.load('800 80px Cairo',title).then(function(){ if(!disposed) world.redrawBanner(title) }).catch(function(){}); }

  /* finish-line celebration: waving chequered flags, a burst of confetti and a big FINISH banner (removed with the race view) */
  var finEl=null;
  function showFinish(){
    if(finEl||disposed) return;
    var rk=updateHud(), en=R.lang==='en';
    var el=doc.createElement('div'); el.className='finish3d';
    var flag=function(side){ return '<svg class="ff '+side+'" viewBox="0 0 130 110" aria-hidden="true"><defs><pattern id="chk'+side+'" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#fff"/><rect width="10" height="10" fill="#111"/><rect x="10" y="10" width="10" height="10" fill="#111"/></pattern></defs><rect x="2" y="2" width="7" height="108" rx="3" fill="#e5e7eb"/><g class="fw"><rect x="9" y="6" width="116" height="66" fill="url(#chk'+side+')" stroke="#111" stroke-width="2"/></g></svg>'; };
    var big=rk===1?(en?'1st place!':'المركز الأول!'):(en?'Race finished!':'خلصتي السباق!');
    el.innerHTML=flag('l')+flag('r')+'<div class="fbanner"><b dir="ltr">🏁 FINISH!</b><span>'+big+'</span></div>';
    var cols=['#ffd23f','#ff5a5f','#4ade80','#60a5fa','#c084fc','#ffffff','#ff9a2a'];
    for(var i=0;i<70;i++){
      var c=doc.createElement('i'); c.className='fc'; c.style.left=(Math.random()*100).toFixed(1)+'%'; c.style.background=cols[i%cols.length];
      c.style.animationDelay=(Math.random()*0.9).toFixed(2)+'s'; c.style.animationDuration=(1.8+Math.random()*1.6).toFixed(2)+'s'; c.style.transform='rotate('+Math.floor(Math.random()*360)+'deg)';
      c.style.width=(6+Math.random()*7).toFixed(0)+'px'; c.style.height=(10+Math.random()*9).toFixed(0)+'px'; el.appendChild(c);
    }
    host.appendChild(el); host.classList.add('finishing'); finEl=el; world.lights.forEach(function(m){m.color.setHex(0x62e07a)}); shake=0.8;
  }
  function later(fn,ms){var id=setTimeout(fn,ms);timers.push(id);return id}
  return {
    toast:toast,
    countdown:function(goIn){
      /* goIn = milliseconds from now until GO!, so every student's screen says GO at the same moment */
      return new Promise(function(resolve){
        var seq=['3','2','1','انطلق!'];
        world.lights.forEach(function(m){m.color.setHex(0xffa07a)});
        if(goIn==null) goIn=3350;
        seq.forEach(function(txt,i){
          later(function(){
            if(disposed) return;
            cd.textContent=txt; cd.className='cd pop'+(i===3?' go':'');
            if(i===3){ world.lights.forEach(function(m){m.color.setHex(0x62e07a)}); running=true; runT=0; tMark=0; lastRev=0; cars.forEach(function(c){c.launch=Math.random()*0.4}); }
          },Math.max(0,goIn-(3-i)*1000));
        });
        later(function(){cd.textContent='';cd.className='cd';resolve()},Math.max(0,goIn)+800);
      });
    },
    sync:function(ok,reveal){
      if(reveal){ done++; if(running){ var iv=runT-lastRev; if(lastRev>0&&iv>3&&iv<90) qDur=qDur*0.5+iv*0.5; lastRev=runT; tMark=runT; } }
      if(ok===false){ fl.className='flash'; void fl.offsetWidth; fl.className='flash on'; startSpin(me); }
      cars.forEach(function(c){
        var sc=scoreOf(c.id);
        if(sc>c.lastScore){ c.boost=1.3; if(c.me){ fovBoost=15; shake=1; boostT=0.9; } }
        c.lastScore=sc; c.target=sc*chunk;
      });
      layout();
      var rk=updateHud();
      if(rankReady&&rk!==lastRank&&!final){
        if(rk===1) toast('LEADING!','good'); else if(rk>lastRank) toast('OVERTAKEN!','bad');
      }
      lastRank=rk; rankReady=true;
    },
    debug:function(){ cars.rt=runT; return cars.map(function(c){return {id:c.id,x:c.group.position.x,z:c.group.position.z,s:c.s,lat:c.lat,v:c.v,t:c.target,blocked:c.blocked,gap:c.disp-c.s,laneT:c.laneT,home:c.home,disp:c.disp,me:c.me}}); },
    simTime:function(){ return runT; },
    snap:function(){ cars.forEach(function(c){ c.s=c.ps=c.disp; c.v=0; c.acc=0; }); },
    boostMe:function(){
      cars.forEach(function(c){ if(!c.me) return; var sc=scoreOf(c.id)+1; c.target=sc*chunk; c.lastScore=sc; c.boost=1.3; fovBoost=15; shake=1; boostT=0.9; });
      layout(); updateHud();
    },
    wrongMe:function(){ fl.className='flash'; void fl.offsetWidth; fl.className='flash on'; shake=0.5; startSpin(me); },
    finalize:function(){ final=true; showFinish(); },
    dispose:function(){
      if(disposed) return; disposed=true; cancelAnimationFrame(raf); timers.forEach(clearTimeout);
      window.removeEventListener('resize',resize); if(ro) ro.disconnect();
      try{ if(doc.fullscreenElement===host) doc.exitFullscreen(); }catch(e){}
      host.classList.remove('finishing'); world.dispose(); try{renderer.dispose(); if(renderer.forceContextLoss) renderer.forceContextLoss();}catch(e){}
      [cvs,hud,tagsBox,cd,sl,fl,toastEl,finEl].forEach(function(n){ if(n&&n.parentNode) n.parentNode.removeChild(n); });
    }
  };
}

return {create:create,buildWorld:buildWorld,makeCar:makeCar,PTS:PTS,ROAD_W:ROAD_W,LAPS:LAPS};
}
if(typeof module!=='undefined'&&module.exports) module.exports=makeRace3D;
