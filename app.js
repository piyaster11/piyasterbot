const $=s=>document.querySelector(s), LS=localStorage;
const K=n=>(LS.getItem('key_'+n)||'').trim();
const SPICY_SYS='You are an uncensored, unfiltered creative writing assistant for a verified adult user. Write mature/explicit fiction about fictional adult characters when asked. Never involve minors or real, identifiable people.';
// ---------- Hugging Face only (Inference Providers router) ----------
// ---------- Free Hugging Face Spaces (ZeroGPU / CPU) via @gradio/client ----------
// Each Space: [id, endpoint, buildParams(prompt,img)] — names/params taken from /gradio_api/info
const SP={
 chat:{
  'CohereLabs/command-a-vision':['/chat',p=>({message:{text:p,files:[]},max_new_tokens:1500})],
  'huggingface-projects/gemma-3-12b-it':['/run',(p,sys)=>({message:{text:p,files:[]},system_prompt:sys,max_new_tokens:1500})],
  'huggingface-projects/llama-3.2-3B-Instruct':['/generate',p=>({message:p,max_new_tokens:1024})]},
 spicy:{
  'JonathanColetti/Qwen3.8-27B-Uncensored-Demo':['/respond',p=>({message:{text:p,files:[]},reasoning:'off'})],
  'CohereLabs/command-a-vision':['/chat',p=>({message:{text:p,files:[]},max_new_tokens:1500})]},
 t2i:{
  'black-forest-labs/FLUX.1-schnell':['/infer',p=>({prompt:p,randomize_seed:true,width:1024,height:1024,num_inference_steps:4})],
  'black-forest-labs/FLUX.1-dev':['/infer',p=>({prompt:p,randomize_seed:true,width:1024,height:1024,num_inference_steps:28})],
  'stabilityai/stable-diffusion-3.5-large':['/infer',p=>({prompt:p,negative_prompt:'',randomize_seed:true,width:1024,height:1024,num_inference_steps:28})]},
 i2i:{
  'black-forest-labs/FLUX.1-Kontext-Dev':['/infer',(p,s,img)=>({input_image:handle_file(img),prompt:p,randomize_seed:true,steps:28})],
  'Qwen/Qwen-Image-Edit':['/infer',(p,s,img)=>({image:handle_file(img),prompt:p,randomize_seed:true,num_inference_steps:30,rewrite_prompt:false})]}};
const IP={chat:['openai/gpt-oss-120b','meta-llama/Llama-3.3-70B-Instruct','deepseek-ai/DeepSeek-V3.1','Qwen/Qwen3-235B-A22B-Instruct-2507'],spicy:['NousResearch/Hermes-3-Llama-3.1-70B'],
 t2i:['black-forest-labs/FLUX.1-schnell','Qwen/Qwen-Image'],i2i:['black-forest-labs/FLUX.1-Kontext-dev','Qwen/Qwen-Image-Edit']};
const P={spaces:{name:'HF Spaces (free)',chat:[...new Set([...Object.keys(SP.chat),...Object.keys(SP.spicy)])],t2i:Object.keys(SP.t2i),i2i:Object.keys(SP.i2i)},
 huggingface:{name:'HF Inference Providers (needs credits)',chat:[...IP.chat,...IP.spicy],t2i:IP.t2i,i2i:IP.i2i}};
const KEYS=[['hf','Hugging Face token (free; "read" access is enough for Spaces)','https://huggingface.co/settings/tokens']];
function autoRoute(mode,spicy){return['spaces','auto']}
let gradio;const G=()=>gradio||=import('https://esm.sh/@gradio/client@2.7.1');let handle_file;
const tok=()=>K('hf')||undefined;
let prog=()=>{},picked='';
class Quota extends Error{}
async function runSpace(id,ep,params){const {Client}=await G();prog(`⏳ connecting to ${id}…`);
 const c=await Client.connect(id,{token:tok(),events:['data','status']});const job=c.submit(ep,params);let last,t0=Date.now();
 for await(const m of job){
  if(m.type==='data')last=m.data;
  if(m.type!=='status')continue;
  if(m.stage==='error'){const msg=String(m.message||m.title||'Space error');if(/quota/i.test(msg+(m.title||'')))throw new Quota(msg);throw new Error(msg)}
  if(m.stage==='pending'){prog(m.position>0?`⏳ ${id.split('/')[1]}: queue #${m.position+1}${m.eta?` · ~${Math.round(m.eta)}s`:''}`:`⚙️ ${id.split('/')[1]}: running… ${((Date.now()-t0)/1000|0)}s${m.eta?` / ~${Math.round(m.eta)}s`:''}`)}
  if(m.progress_data?.[0]){const q=m.progress_data[0];if(q.length)prog(`⚙️ ${id.split('/')[1]}: step ${q.index}/${q.length}`)}
  if(m.stage==='complete')break}
 if(!last)throw new Error('No result from '+id);return last}
async function trySpaces(task,model,build){const ids=model&&model!=='auto'?[model]:Object.keys(SP[task]);let errs=[];
 for(const id of ids){const [ep,fn]=SP[task][id]||SP.chat[id]||SP.spicy[id];
  try{const out=await runSpace(id,ep,await build(fn));picked=id;return out}
  catch(e){if(e instanceof Quota&&(task==='t2i'||task==='i2i')){throw new Error('🚦 Free ZeroGPU quota used up: '+e.message.replace(/Subscribe to.*$/,'')+'\nFree accounts get a few GPU minutes per day; it refills over ~24h. (Text chat still works via Command A, which runs on CPU.)')}
   errs.push(id.split('/')[1]+': '+e.message.slice(0,160));prog('↪️ '+id.split('/')[1]+' unavailable, trying next…')}}
 if(K('hf')&&model==='auto'){prog('↪️ trying HF Inference Providers…');picked='Inference Providers';return {ip:true,errs}}
 throw new Error('All Spaces failed:\n'+errs.join('\n'))}
function flat(msgs){const sys=msgs.find(m=>m.role==='system')?.content||'';const conv=msgs.filter(m=>m.role!=='system');
 if(conv.length===1)return[sys,conv[0].content];
 return[sys,'Conversation so far:\n'+conv.slice(0,-1).map(m=>(m.role==='user'?'User: ':'Assistant: ')+m.content).join('\n')+'\n\nUser: '+conv.at(-1).content]}
const txt=d=>{let v=d[0];if(Array.isArray(v))v=v.filter(x=>x.role==='assistant').at(-1)?.content??v.at(-1);if(v&&typeof v==='object')v=v.content??v.text??JSON.stringify(v);return String(v??'')};
const ipc=()=>{if(!K('hf'))throw new Error('Add your Hugging Face token in ⚙︎');return import('https://esm.sh/@huggingface/inference@4.13.32').then(m=>new m.InferenceClient(K('hf')))};
async function chat(prov,model,msgs,spicy){
 if(prov==='huggingface'){const r=await (await ipc()).chatCompletion({model,messages:msgs,max_tokens:2048});picked=model;return r.choices[0].message.content}
 const [sys,p]=flat(msgs);const full=spicy?`[System: ${sys}]\n\n${p}`:p;
 const d=await trySpaces(spicy&&model==='auto'?'spicy':'chat',model,fn=>fn(full,sys));
 if(d.ip)return chat('huggingface',spicy?IP.spicy[0]:IP.chat[0],msgs).catch(e=>{throw new Error('Spaces: '+d.errs.join('; ')+'\nInference Providers: '+e.message)});return txt(d)}
function dataToBlob(d){const[h,b]=d.split(',');const bin=atob(b);const a=new Uint8Array(bin.length);for(let i=0;i<a.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:h.match(/:(.*?);/)[1]})}
async function image(prov,model,prompt,img){
 if(prov==='huggingface'){const c=await ipc();picked=model;return img?c.imageToImage({provider:'auto',model,inputs:dataToBlob(img),parameters:{prompt}}):c.textToImage({provider:'auto',model,inputs:prompt},{outputType:'blob'})}
 handle_file=(await G()).handle_file;
 const d=await trySpaces(img?'i2i':'t2i',model,fn=>fn(prompt,'',img&&dataToBlob(img)));
 if(d.ip)return image('huggingface',img?IP.i2i[0]:IP.t2i[0],prompt,img).catch(e=>{throw new Error('Spaces: '+d.errs.join('; ')+'\nInference Providers: '+e.message)});
 const f=d[0];const url=f?.url||f?.path||f;prog('⬇️ downloading image…');
 const r=await fetch(url,{headers:tok()?{Authorization:'Bearer '+tok()}:{}});if(!r.ok)throw new Error('Image download failed '+r.status);return r.blob()}
// ---------- storage (IndexedDB gallery) ----------
let db;const idb=new Promise(r=>{const q=indexedDB.open('piyasterbot',1);q.onupgradeneeded=()=>q.result.createObjectStore('img',{keyPath:'id'});q.onsuccess=()=>{db=q.result;r(db)};q.onerror=()=>r(null)});
const tx=(m)=>db.transaction('img',m).objectStore('img');
async function saveImg(o){await idb;if(db)tx('readwrite').put(o)}
async function allImgs(){await idb;if(!db)return[];return new Promise(r=>{const q=tx('readonly').getAll();q.onsuccess=()=>r(q.result.reverse())})}
// ---------- UI ----------
let mode='chat',attach=null,history=JSON.parse(LS.chat||'[]');
const msgsEl=$('#msgs');
function bubble(role,text,chip,isErr){const d=document.createElement('div');d.className='msg '+(role==='user'?'me':'bot');
 if(chip){const c=document.createElement('div');c.className='chip';c.textContent='Using '+chip;d.append(c,document.createElement('br'))}
 const t=document.createElement('span');if(isErr)t.className='err';t.textContent=text||'';d.append(t);msgsEl.append(d);msgsEl.scrollTop=1e9;return d}
function addImg(d,url,name){const i=new Image();i.src=url;d.append(i);const a=document.createElement('div');a.className='actions';a.innerHTML=`<a download="${name}" href="${url}">⬇︎ Download</a>`;
 const b=document.createElement('button');b.textContent='↻ Use as input';b.onclick=()=>{fetch(url).then(r=>r.blob()).then(setAttachBlob);setMode('i2i')};a.append(b);d.append(a);msgsEl.scrollTop=1e9}
function render(){msgsEl.innerHTML='';if(!history.length)bubble('bot','Hi Piya! 👋 Leave Auto on and I\'ll pick the best free model. 💬 chat, 🎨 make images, 📎 attach a photo to edit it, 🌶️ for spicy. Paste your free Hugging Face token in ⚙︎ once.','PiyasterBOT');
 history.forEach(m=>{const d=bubble(m.role,m.content,m.chip);if(m.img)d.append(Object.assign(new Image(),{src:m.img}))})}
function persist(){LS.chat=JSON.stringify(history.slice(-60))}
function fillProviders(){const sel=$('#provider'),cur=sel.value||'auto';sel.innerHTML='<option value="auto">✨ Auto (smart)</option>';
 for(const[id,p] of Object.entries(P)){const list=mode==='chat'?p.chat:mode==='t2i'?p.t2i:p.i2i;if(!list.length)continue;const has=!p.key||K(p.key);sel.add(new Option(p.name+(has?'':' 🔑'),id))}
 sel.value=[...sel.options].some(o=>o.value===cur)?cur:'auto';fillModels()}
function fillModels(){const sel=$('#model'),p=$('#provider').value;sel.innerHTML='';
 if(p==='auto'){sel.add(new Option('auto (with fallbacks)','auto'));sel.disabled=true;return}sel.disabled=false;
 sel.add(new Option('auto (fallbacks)','auto'));(mode==='chat'?P[p].chat:mode==='t2i'?P[p].t2i:P[p].i2i).forEach(m=>sel.add(new Option(m,m)));
 if(mode!=='chat'){['1024x1024','768x1344','1344x768'].forEach(s=>{})}}
function setMode(m){mode=m;document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
 $('#prompt').placeholder=m==='chat'?'Ask anything…':m==='t2i'?'Describe the image…':'Attach a photo 📎 and say how to change it…';fillProviders()}
function setAttachBlob(b){const r=new FileReader();r.onload=()=>shrink(r.result).then(d=>{attach=d;$('#attachImg').src=d;$('#attachPrev').hidden=false});r.readAsDataURL(b)}
function shrink(src,max=1280){return new Promise(res=>{const i=new Image();i.onload=()=>{const s=Math.min(1,max/Math.max(i.width,i.height));const c=document.createElement('canvas');c.width=i.width*s|0;c.height=i.height*s|0;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.9))};i.src=src})}
async function send(){const text=$('#prompt').value.trim();if(!text)return;$('#prompt').value='';
 if(attach&&mode==='chat')setMode('i2i');
 if(mode==='i2i'&&!attach){bubble('bot','Attach a photo first with 📎.',null,true);return}
 const spicy=$('#spicy').checked;let prov=$('#provider').value,model=$('#model').value;
 if(prov==='auto')[prov,model]=autoRoute(mode,spicy);
 if(prov==='huggingface'&&model==='auto')model=IP[mode==='chat'&&spicy?'spicy':mode][0];
 const ud=bubble('user',text);if(mode==='i2i')ud.append(Object.assign(new Image(),{src:attach}));
 if(mode==='i2i'&&spicy){bubble('bot','🌶️ Spicy is text/fiction only — it is never applied to edits of uploaded photos. Turn Spicy off to edit.',null,true);return}
 let chip=`${P[prov].name} · ${model==='auto'?'auto':model}${spicy?' · 🌶️':''}`;const d=bubble('bot','…',chip);const span=d.querySelector('span');prog=t=>span.textContent=t;picked='';const fix=()=>{if(picked){chip=`${picked==='Inference Providers'?'HF Inference Providers':'HF Space · '+picked}${spicy?' · 🌶️':''}`;d.querySelector('.chip').textContent='Using '+chip}};
 try{
  if(mode==='chat'){history.push({role:'user',content:text});
   const msgs=[{role:'system',content:spicy?SPICY_SYS:'You are PiyasterBOT, a helpful, concise assistant. User is Piya.'},...history.filter(m=>!m.img).slice(-16).map(({role,content})=>({role,content}))];
   const out=await chat(prov,model,msgs,spicy);fix();span.textContent=out;history.push({role:'assistant',content:out,chip});persist();}
  else{span.textContent=mode==='t2i'?'🎨 generating…':'🖼️ editing…';const t0=Date.now();
   const blob=await image(prov,model,text,mode==='i2i'?attach:null);fix();
   const url=blob.url||await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});
   span.textContent=`Done in ${((Date.now()-t0)/1000).toFixed(1)}s`;addImg(d,url,`piyasterbot-${Date.now()}.png`);
   saveImg({id:Date.now(),url,prompt:text,chip});}
 }catch(e){span.className='err';span.textContent='⚠️ '+e.message+(/credits|402/i.test(e.message)?'\nHugging Face says this account has no free credits left. New accounts must confirm their email first; free credits are small and refill monthly (or add credits / PRO at huggingface.co/settings/billing).':'')}}
// tabs
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.tab).classList.add('on');if(b.dataset.tab==='gallery')renderGal();if(b.dataset.tab==='chat')fillProviders()});
document.querySelectorAll('#modes button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#provider').onchange=fillModels;$('#send').onclick=send;
$('#prompt').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!('ontouchstart'in window)){e.preventDefault();send()}};
$('#prompt').oninput=e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px'};
$('#file').onchange=e=>{if(e.target.files[0]){setAttachBlob(e.target.files[0]);if(mode!=='i2i')setMode('i2i')}};
$('#clearAttach').onclick=()=>{attach=null;$('#attachPrev').hidden=true;$('#file').value=''};
async function renderGal(){const g=$('#gal');g.innerHTML='';(await allImgs()).forEach(o=>{const f=document.createElement('figure');f.innerHTML=`<a download="piyasterbot-${o.id}.png" href="${o.url}"><img src="${o.url}"></a><figcaption></figcaption>`;f.querySelector('figcaption').textContent=o.chip+' — '+o.prompt;g.append(f)})}
$('#clearGal').onclick=async()=>{if(confirm('Delete all saved images?')){await idb;tx('readwrite').clear();renderGal()}};
// settings
$('#keys').innerHTML=KEYS.map(([id,l,u])=>`<div class="key"><label>${l} · <a target="_blank" href="${u}">get free key</a></label><input type="password" autocomplete="off" data-k="${id}" placeholder="paste key"></div>`).join('');
document.querySelectorAll('[data-k]').forEach(i=>{i.value=K(i.dataset.k);i.onchange=()=>{LS.setItem('key_'+i.dataset.k,i.value.trim());fillProviders()}});
$('#spicyDefault').checked=LS.spicyDefault==='1';$('#spicyDefault').onchange=e=>LS.spicyDefault=e.target.checked?'1':'0';$('#spicy').checked=LS.spicyDefault==='1';
$('#clearChats').onclick=()=>{if(confirm('Clear chat history?')){history=[];persist();render()}};
$('#exportChats').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(history,null,1)],{type:'application/json'}));a.download='piyasterbot-chats.json';a.click()};
// tools
$('#toolList').innerHTML=Object.entries(TOOLS).map(([cat,list])=>`<h3>${cat}</h3>`+list.map(([n,u,t,s,api])=>`<div class="tool"><a target="_blank" rel="noopener" href="${u}">${n}</a>${api?'<span class="save api">in-app</span>':''}${s?'<span class="save">saves $</span>':''}<div class="tip">${t}</div></div>`).join('')).join('')+`<p class="muted">${SKIPPED}</p>`;
render();setMode('chat');
