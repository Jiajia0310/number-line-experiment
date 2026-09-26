// Deterministic app-state tests. No network requests or real submissions.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(`${__dirname}/experiment.js`,'utf8');
function harness(result, options={}) {
  const nodes = new Map(), store = new Map(), timers = new Map(), calls = [], errors = [];
  let now=0, timerId=0;
  class Element {
    constructor(){this.style={};this.listeners={};this.textContent='';this.children=[];this.value='';}
    set innerHTML(html){this.html=html; for(const match of html.matchAll(/id="([^"]+)"/g)) nodes.set('#'+match[1],new Element());}
    get innerHTML(){return this.html || '';}
    append(...children){this.children.push(...children);}
    addEventListener(name,fn){this.listeners[name]=fn;}
    getBoundingClientRect(){return {left:100,width:600};}
    querySelector(selector){return nodes.get(selector)||new Element();}
  }
  nodes.set('#app',new Element()); nodes.set('#progress',new Element());
  const context = {document:{querySelector:s=>nodes.get(s),createElement:()=>new Element(),createTextNode:t=>t},location:{search:'?test=1'},URLSearchParams,URL,Blob,Date,Math,crypto:require('node:crypto').webcrypto,performance:{now:()=>now},screen:{width:1920,height:1080},innerWidth:1000,innerHeight:800,navigator:{userAgent:'UnitTest'},sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)},console:{info(){},error:(...args)=>errors.push(args)},setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,time:now+delay});return timerId;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),addEventListener(){},DataPipe:{saveData:async data=>{calls.push(data); if(options.throw) throw Error('network');return result;}}};
  context.window=context;
  vm.runInNewContext(source,context);
  const tick = ms => {
    const end=now+ms;
    while(true){ const next=[...timers].filter(([,t])=>t.time<=end).sort((a,b)=>a[1].time-b[1].time)[0];if(!next) break; now=next[1].time;timers.delete(next[0]);next[1].fn(); }
    now=end;
  };
  const saved = () => JSON.parse([...store.values()][0]||'null');
  return {nodes,calls,errors,tick,saved,start(){nodes.get('#participant').value='TEST_UNIT';nodes.get('#entry').onsubmit({preventDefault(){}});nodes.get('#practice').onclick();},click(x=400){nodes.get('#line').listeners.pointerdown({clientX:x,button:0,isPrimary:true});}};
}
async function finish(h) {
  h.start();
  for(let i=0;i<25;i++){
    assert.equal(h.saved().rows.length,i);
    h.click(); // Before target onset: ignored.
    assert.equal(h.saved().rows.length,i);
    h.tick(1000); h.tick(123);
    h.click(i===0?100:i===1?700:400);
    h.click(); // Double click: ignored.
    assert.equal(h.saved().rows.length,i+1);
    h.tick(1000);
    if(i===2) h.nodes.get('#formal').onclick();
  }
  await new Promise(resolve=>setImmediate(resolve));
}
test('25 trials, endpoint mapping, timing, locking, CSV and single successful submission',async()=>{
  const h=harness({ok:true,status:201,body:{message:'Success'}});await finish(h);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].experiment_id,'9g92tharOXFX');
  const lines=h.calls[0].data.trim().split('\r\n');assert.equal(lines.length,26);
  const header=lines[0].split(',');const rows=lines.slice(1).map(line=>Object.fromEntries(line.split(',').map((v,i)=>[header[i],JSON.parse(v)])));
  assert.equal(rows.filter(r=>r.phase==='practice').length,3);assert.equal(rows.filter(r=>r.phase==='formal').length,22);
  assert.equal(+rows[0].estimated_number,1);assert.equal(+rows[1].estimated_number,100);assert.equal(+rows[2].estimated_number,50.5);
  const targets=[2,4,9,11,14,17,23,26,31,38,44,45,52,59,61,66,73,78,84,86,92,99];
  assert.deepEqual(rows.slice(3).map(r=>+r.target_number).sort((a,b)=>a-b),targets);
  for(const [i,r] of rows.entries()){assert.equal(+r.trial_index,i);assert.equal(+r.trial_order,i<3?i+1:i-2);assert.equal(+r.reaction_time_ms,123);assert.equal(+r.signed_error,+r.estimated_number-r.target_number);assert.equal(+r.absolute_error,Math.abs(+r.signed_error));assert.equal(r.is_test,'true');}
  assert.match(h.nodes.get('#app').innerHTML,/实验已完成/);assert.equal(h.saved(),null);assert.equal(h.errors.length,0);
});
for(const [name,result] of Object.entries({queued:{ok:true,status:202,body:{error:null}},rejected:{ok:false,status:400,body:{error:'DATA_COLLECTION_NOT_ACTIVE'}},network:{ok:false,status:0,body:{}},unexpected:{ok:true,status:500,body:{}},badBody:{ok:true,status:201,body:{error:'UPLOAD_ERROR'}}})) {
  test(`upload handling: ${name}`,async()=>{const h=harness(result);await finish(h);assert.equal(h.calls.length,1);if(name==='queued'){assert.match(h.nodes.get('#app').innerHTML,/实验已完成/);assert.match(h.nodes.get('#save-status').textContent,/等待自动转存/);}else{assert.match(h.nodes.get('#app').innerHTML,/数据保存失败/);assert.doesNotMatch(h.nodes.get('#app').innerHTML,/实验已完成/);assert.equal(h.saved().rows.length,25);assert.equal(h.errors.length,1);}});
}
test('exception keeps data and failure page',async()=>{const h=harness(null,{throw:true});await finish(h);assert.match(h.nodes.get('#app').innerHTML,/数据保存失败/);assert.equal(h.saved().rows.length,25);});
