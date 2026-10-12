const { server } = require('../server.js'); const WebSocket = require('ws'); const assert = require('assert');
function client(url){const ws=new WebSocket(url),log=[],w=[];ws.on('message',d=>{const m=JSON.parse(d);log.push(m);w.slice().forEach(x=>{if(x.f(m)){w.splice(w.indexOf(x),1);x.r(m)}})});
 return{log,open:new Promise(r=>ws.on('open',r)),send:m=>ws.send(JSON.stringify(m)),wait:(f,ms=12000)=>new Promise((res,rej)=>{const o=log.find(f);if(o)return res(o);w.push({f,r:res});setTimeout(()=>rej(new Error('timeout')),ms)}),ws}}
(async()=>{
 await new Promise(r=>server.listen(0,r)); const url='ws://localhost:'+server.address().port;
 const T=client(url); await T.open;
 T.send({t:'create',game:{title:'S',settings:{shuffleChoices:true},questions:[{type:'short',q:'عاصمة مصر؟',accepted:['القاهرة|Cairo'],secs:5,points:200}]}});
 const c=await T.wait(m=>m.t==='created');
 const A=client(url),B=client(url); await A.open; await B.open;
 A.send({t:'join',code:c.code,name:'أ'}); B.send({t:'join',code:c.code,name:'ب'});
 const ja=await A.wait(m=>m.t==='joined'); const jb=await B.wait(m=>m.t==='joined');
 T.send({t:'start'});
 const q=await A.wait(m=>m.t==='question'); assert(q.type==='short'&&q.choices.length===0&&!JSON.stringify(q).includes('Cairo'));
 A.send({t:'answer',n:0,text:'  القاهره! '}); B.send({t:'answer',n:0,text:'الاسكندرية'});
 const ak=await A.wait(m=>m.t==='ack'), bk=await B.wait(m=>m.t==='ack');
 assert(ak.ok===true&&ak.pts>=100&&bk.ok===false);
 const rv=await A.wait(m=>m.t==='reveal'); assert(rv.per[ja.pid].ok&&!rv.per[jb.pid].ok&&rv.correct==='القاهرة');
 const res=await A.wait(m=>m.t==='results',12000); assert(res.board[0].name==='أ');
 console.log('SHORT OK'); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
