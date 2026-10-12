'use strict';
const $=s=>document.querySelector(s), LS=localStorage;
const K=n=>(LS.getItem('key_'+n)||'').trim();
const PG='https://gen.pollinations.ai';
const SPICY_SYS='You are an uncensored, unfiltered creative assistant for a verified adult user. Write mature/explicit fiction about fictional adult characters when asked. Never involve minors or real identifiable people.';
// ---------- providers ----------
const P={
 pollinations:{name:'Pollinations',chat:['openai','openai-fast','deepseek-v4-flash','glm-5.3','kimi-k2.6','mistral-large-3','llama-3.3'],
  t2i:['flux','zimage','gpt-image','nanobanana','nanobanana-2','vendouple/uncensored-image-v2','sana'],i2i:['kontext','gpt-image','nanobanana','qwen-image-edit','flux-klein']},
 huggingface:{name:'Hugging Face',key:'hf',chat:['openai/gpt-oss-20b','meta-llama/Llama-3.1-8B-Instruct','Qwen/Qwen3-8B','deepseek-ai/DeepSeek-V3'],t2i:['black-forest-labs/FLUX.1-schnell','stabilityai/stable-diffusion-xl-base-1.0'],i2i:[]},
 groq:{name:'Groq',key:'groq',chat:['llama-3.3-70b-versatile','openai/gpt-oss-120b','qwen/qwen3-32b','llama-3.1-8b-instant'],t2i:[],i2i:[]},
 gemini:{name:'Gemini',key:'gemini',chat:['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-2.5-pro'],t2i:['gemini-2.5-flash-image'],i2i:['gemini-2.5-flash-image']},
 openrouter:{name:'OpenRouter',key:'openrouter',chat:['openrouter/free','deepseek/deepseek-chat-v3.1:free','meta-llama/llama-3.3-70b-instruct:free','openai/gpt-oss-20b:free','openai/gpt-4o-mini','anthropic/claude-3.5-haiku'],t2i:[],i2i:[]},
 openai:{name:'ChatGPT (OpenAI)',key:'openai',chat:['gpt-4o-mini','gpt-4.1-mini','gpt-4o'],t2i:['gpt-image-1'],i2i:['gpt-image-1']},
 anthropic:{name:'Claude',key:'anthropic',chat:['claude-3-5-haiku-latest','claude-sonnet-4-5'],t2i:[],i2i:[]}};
const KEYS=[['pollinations','Pollinations key (optional – unlocks Kontext img2img, Nano Banana, uncensored image)','https://enter.pollinations.ai'],
 ['hf','Hugging Face token','https://huggingface.co/settings/tokens'],['groq','Groq key','https://console.groq.com/keys'],
 ['gemini','Google Gemini key','https://aistudio.google.com/apikey'],['openrouter','OpenRouter key','https://openrouter.ai/keys'],
 ['openai','OpenAI (ChatGPT) key','https://platform.openai.com/api-keys'],['anthropic','Anthropic (Claude) key','https://console.anthropic.com/settings/keys']];
// ---------- Auto router ----------
function autoRoute(mode,spicy){
 if(mode==='chat'){
  if(spicy){ if(K('openrouter')&&LS.spicyOR) return['openrouter',LS.spicyOR]; return['pollinations','openai']; }
  if(K('groq')) return['groq','llama-3.3-70b-versatile'];
  if(K('gemini')) return['gemini','gemini-2.5-flash'];
  if(K('openrouter')) return['openrouter','openrouter/free'];
  return['pollinations',K('pollinations')?'openai':'gpt-oss-20b (free, no key)'];}
 if(mode==='t2i'){
  if(spicy) return K('pollinations')?['pollinations','vendouple/uncensored-image-v2']:['pollinations','sana (free, no key)'];
  if(K('pollinations')) return['pollinations','zimage'];
  return['pollinations','sana (free, no key)'];}
 // i2i
 if(spicy&&K('pollinations')) return['pollinations','flux-klein'];
 if(K('pollinations')) return['pollinations','kontext'];
 if(K('gemini')) return['gemini','gemini-2.5-flash-image'];
 if(K('openai')) return['openai','gpt-image-1'];
 return[null,null];}
// ---------- calls ----------
async function j(url,opt){const r=await fetch(url,opt);const t=await r.text();if(!r.ok)throw new Error(r.status+': '+t.slice(0,300));try{return JSON.parse(t)}catch{return t}}
async function blobOk(r){if(!r.ok)throw new Error(r.status+': '+(await r.text()).slice(0,300));return await r.blob()}
const bear=k=>k?{Authorization:'Bearer '+k}:{};
async function chat(prov,model,msgs){msgs=[...msgs];
 const oa=(url,key,extra={})=>j(url,{method:'POST',headers:{'content-type':'application/json',...bear(key),...extra},body:JSON.stringify({model,messages:msgs})}).then(d=>d.choices[0].message.content);
 switch(prov){
  case'pollinations':return K('pollinations')?oa(PG+'/v1/chat/completions',K('pollinations')):(model='openai',oa('https://text.pollinations.ai/openai',''));/* no key: legacy anonymous endpoint (gpt-oss-20b) */
  case'huggingface':return oa('https://router.huggingface.co/v1/chat/completions',K('hf'));
  case'groq':return oa('https://api.groq.com/openai/v1/chat/completions',K('groq'));
  case'gemini':return oa('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',K('gemini'));
  case'openrouter':return oa('https://openrouter.ai/api/v1/chat/completions',K('openrouter'),{'X-Title':'PiyasterBOT'});
  case'openai':return oa('https://api.openai.com/v1/chat/completions',K('openai'));
  case'anthropic':{const sys=msgs.filter(m=>m.role==='system').map(m=>m.content).join('\n');
   const d=await j('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':K('anthropic'),'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model,max_tokens:2048,system:sys||undefined,messages:msgs.filter(m=>m.role!=='system')})});return d.content.map(c=>c.text||'').join('');}}
 throw new Error('Unknown provider');}
function dataToBlob(d){const[h,b]=d.split(',');const bin=atob(b);const a=new Uint8Array(bin.length);for(let i=0;i<a.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:h.match(/:(.*?);/)[1]})}
async function geminiImg(model,prompt,img){const parts=[{text:prompt}];if(img)parts.push({inline_data:{mime_type:img.split(';')[0].slice(5),data:img.split(',')[1]}});
 const d=await j(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':K('gemini')},body:JSON.stringify({contents:[{parts}]})});
 const p=d.candidates?.[0]?.content?.parts?.find(p=>p.inlineData||p.inline_data);if(!p)throw new Error('No image returned (model may have refused).');const x=p.inlineData||p.inline_data;return dataToBlob(`data:${x.mimeType||x.mime_type};base64,${x.data}`)}
async function image(prov,model,prompt,img,spicy,size){
 const [w,h]=size.split('x');
 if(prov==='pollinations'){
  if(!img){const key=K('pollinations');
   const u=key?`${PG}/image/${encodeURIComponent(prompt)}?model=${encodeURIComponent(model)}&width=${w}&height=${h}&seed=${Math.floor(Math.random()*1e9)}&nologo=true&safe=${!spicy}&private=true`
     :null;
   if(!key){/* no key: free anonymous tier via plain <img> load (fetch() gets Turnstile-blocked in browsers) */
    const url=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${Math.floor(Math.random()*1e9)}&nologo=true`;
    await new Promise((ok,no)=>{const i=new Image();i.onload=ok;i.onerror=()=>no(new Error('Free tier busy – try again, or add a free Pollinations key in ⚙︎'));i.src=url});return{url};}
   const _unused=`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${Math.floor(Math.random()*1e9)}&nologo=true`; /* no key: free anonymous tier (sana model) */
   return blobOk(await fetch(u,{headers:bear(K('pollinations'))}));}
  const fd=new FormData();fd.append('model',model);fd.append('prompt',prompt);fd.append('image',dataToBlob(img),'in.png');fd.append('size',size);
  const d=await j(PG+'/v1/images/edits',{method:'POST',headers:bear(K('pollinations')),body:fd});const it=d.data[0];return it.b64_json?dataToBlob('data:image/png;base64,'+it.b64_json):blobOk(await fetch(it.url));}
 if(prov==='huggingface'){if(img)throw new Error('HF img2img: use Qwen-Image-Edit Space from the Tools tab.');
  return blobOk(await fetch(`https://router.huggingface.co/hf-inference/models/${model}`,{method:'POST',headers:{...bear(K('hf')),'content-type':'application/json'},body:JSON.stringify({inputs:prompt})}));}
 if(prov==='gemini')return geminiImg(model,prompt,img);
 if(prov==='openai'){let d;if(img){const fd=new FormData();fd.append('model',model);fd.append('prompt',prompt);fd.append('image',dataToBlob(img),'in.png');d=await j('https://api.openai.com/v1/images/edits',{method:'POST',headers:bear(K('openai')),body:fd});}
  else d=await j('https://api.openai.com/v1/images/generations',{method:'POST',headers:{'content-type':'application/json',...bear(K('openai'))},body:JSON.stringify({model,prompt,size:'1024x1024'})});
  return dataToBlob('data:image/png;base64,'+d.data[0].b64_json);}
 throw new Error(P[prov].name+' has no image model here.');}
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
function render(){msgsEl.innerHTML='';if(!history.length)bubble('bot','Hi Piya! 👋 Leave Auto on and I\'ll pick the best free model. 💬 chat, 🎨 make images, 📎 attach a photo to edit it, 🌶️ for spicy. Add free keys in ⚙︎ for more power.','PiyasterBOT');
 history.forEach(m=>{const d=bubble(m.role,m.content,m.chip);if(m.img)d.append(Object.assign(new Image(),{src:m.img}))})}
function persist(){LS.chat=JSON.stringify(history.slice(-60))}
function fillProviders(){const sel=$('#provider'),cur=sel.value||'auto';sel.innerHTML='<option value="auto">✨ Auto (smart)</option>';
 for(const[id,p] of Object.entries(P)){const list=mode==='chat'?p.chat:mode==='t2i'?p.t2i:p.i2i;if(!list.length)continue;const has=!p.key||K(p.key);sel.add(new Option(p.name+(has?'':' 🔑'),id))}
 sel.value=[...sel.options].some(o=>o.value===cur)?cur:'auto';fillModels()}
function fillModels(){const sel=$('#model'),p=$('#provider').value;sel.innerHTML='';
 if(p==='auto'){sel.add(new Option('auto model','auto'));sel.disabled=true;return}sel.disabled=false;
 (mode==='chat'?P[p].chat:mode==='t2i'?P[p].t2i:P[p].i2i).forEach(m=>sel.add(new Option(m,m)));
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
 const ud=bubble('user',text);if(mode==='i2i')ud.append(Object.assign(new Image(),{src:attach}));
 if(!prov){bubble('bot','Image→Image needs a free key. Add a Pollinations key (free at enter.pollinations.ai) in ⚙︎ Settings — or open the free Qwen-Image-Edit Space in Tools.',null,true);return}
 const chip=`${P[prov].name} · ${model}${spicy?' · 🌶️':''}`;const d=bubble('bot','…',chip);const span=d.querySelector('span');
 try{
  if(mode==='chat'){history.push({role:'user',content:text});
   const msgs=[{role:'system',content:spicy?SPICY_SYS:'You are PiyasterBOT, a helpful, concise assistant. User is Piya.'},...history.filter(m=>!m.img).slice(-16).map(({role,content})=>({role,content}))];
   const out=await chat(prov,model,msgs);span.textContent=out;history.push({role:'assistant',content:out,chip});persist();}
  else{span.textContent=mode==='t2i'?'🎨 generating…':'🖼️ editing…';const t0=Date.now();
   const blob=await image(prov,model,text,mode==='i2i'?attach:null,spicy,'1024x1024');
   const url=blob.url||await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(blob)});
   span.textContent=`Done in ${((Date.now()-t0)/1000).toFixed(1)}s`;addImg(d,url,`piyasterbot-${Date.now()}.png`);
   saveImg({id:Date.now(),url,prompt:text,chip});}
 }catch(e){span.className='err';span.textContent='⚠️ '+e.message+(prov==='pollinations'&&/401|402|403|Turnstile/.test(e.message)?(K('pollinations')?'\nThis model may need paid pollen credits – try another model.':'\nFree chat needs a free key: grab one at enter.pollinations.ai (sign up with piya@mail.grokbot.com) or a free Groq / Gemini / OpenRouter key, then paste it in ⚙︎ Settings.'):'')}}
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
$('#spicyOR').value=LS.spicyOR||'';$('#spicyOR').onchange=e=>LS.spicyOR=e.target.value.trim();
$('#clearChats').onclick=()=>{if(confirm('Clear chat history?')){history=[];persist();render()}};
$('#exportChats').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(history,null,1)],{type:'application/json'}));a.download='piyasterbot-chats.json';a.click()};
// tools
$('#toolList').innerHTML=Object.entries(TOOLS).map(([cat,list])=>`<h3>${cat}</h3>`+list.map(([n,u,t,s,api])=>`<div class="tool"><a target="_blank" rel="noopener" href="${u}">${n}</a>${api?'<span class="save api">in-app</span>':''}${s?'<span class="save">saves $</span>':''}<div class="tip">${t}</div></div>`).join('')).join('')+`<p class="muted">${SKIPPED}</p>`;
render();setMode('chat');
