(()=>{
  const BASE=window.CATALOG_EDITOR_BASE||[];
  if(!BASE.length)return;
  const KEY='hiddenDoorsCatalog2026.plan.v5';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const baseMap=new Map(BASE.map((p,i)=>[p.physicalIndex,{...clone(p),baseOrder:p.order??i+1,basePair:p.pairWithNext??(i>0&&i%2===1),baseIncluded:p.included!==false}]));
  const baseVisiblePos=new Map([...BASE].filter(p=>p.included!==false).sort((a,b)=>(a.order??0)-(b.order??0)).map((p,i)=>[p.physicalIndex,i+1]));
  let plan={pages:[]};try{plan=JSON.parse(localStorage.getItem(KEY)||'{"pages":[]}')}catch{} const resolved=new Set(window.CATALOG_RESOLVED_CORRECTIONS||[]);
  const savedMap=new Map((plan.pages||[]).map(p=>[p.physicalIndex,p]));
  let pages=BASE.map((p,i)=>{
    const s=savedMap.get(p.physicalIndex)||{};
    const done=!!(s.correctionId&&resolved.has(s.correctionId));
    return {...clone(p),order:s.order??p.order??i+1,pairWithNext:s.pairWithNext??p.pairWithNext??(i>0&&i%2===1),included:s.included??(p.included!==false),correctionType:done?'':(s.correctionType||''),correctionText:done?'':(s.correctionText||''),correctionDone:false,correctionId:done?'':(s.correctionId||'')};
  });
  const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function ordered(){return [...pages].sort((a,b)=>a.order-b.order||a.physicalIndex-b.physicalIndex)}
  function normalize(){ordered().forEach((p,i)=>p.order=i+1)}
  function newCorrectionId(p){return 'HD-'+Date.now().toString(36).toUpperCase()+'-'+String(p.physicalIndex).padStart(2,'0')+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
  function persist(){
    normalize();
    pages.forEach(p=>{
      const hasChange=bits(p).length>0;
      if(hasChange&&!p.correctionId)p.correctionId=newCorrectionId(p);
      if(!hasChange){p.correctionId='';p.correctionDone=false}
      if(p.correctionDone){p.correctionType='';p.correctionText='';p.correctionId='';p.correctionDone=false}
    });
    localStorage.setItem(KEY,JSON.stringify({version:5,pages:pages.map(p=>({physicalIndex:p.physicalIndex,order:p.order,pairWithNext:p.pairWithNext,included:p.included,correctionType:p.correctionType,correctionText:p.correctionText,correctionDone:p.correctionDone,correctionId:p.correctionId||''}))}));
    updateCount()
  }
  function status(p){return p.status==='approved'?'Согласовано':p.status==='reserved'?'Резерв':'В работе'}
  function typeLabel(v){return({move:'Сдвинуть / переставить',remove:'Убрать',text:'Исправить текст',image:'Заменить изображение',design:'Поправить дизайн',tech:'Исправить тех. данные',spread:'Изменить разворот',other:'Другое'})[v]||''}
  function bits(p){const b=baseMap.get(p.physicalIndex),a=[];if(!b)return a;if(p.included!==b.baseIncluded)a.push(p.included?'ВЕРНУТЬ В КАТАЛОГ':'УБРАТЬ ИЗ КАТАЛОГА');if(p.included&&b.baseIncluded){const curPos=new Map(ordered().filter(x=>x.included).map((x,i)=>[x.physicalIndex,i+1])).get(p.physicalIndex),basePos=baseVisiblePos.get(p.physicalIndex);if(curPos!==basePos)a.push(`переместить: позиция ${basePos} → ${curPos}`)}if(p.pairWithNext!==b.basePair)a.push(p.pairWithNext?'сделать левой страницей разворота со следующей':'не объединять со следующей страницей');if(p.correctionType)a.push(typeLabel(p.correctionType));if(p.correctionText.trim())a.push(p.correctionText.trim());return a}
  function changed(p){return bits(p).length>0}
  function corrections(){return ordered().map(p=>({p,b:bits(p)})).filter(x=>x.b.length&&!x.p.correctionDone)}
  function updateCount(){const n=corrections().length;const el=$('#hdCorrectionCount');if(el){el.textContent=n;el.classList.toggle('active',n>0)}}

  const actions=$('.top-actions');
  if(actions&&!$('#hdLayoutBtn')){
    const fit=$('#fitBtn');fit.insertAdjacentHTML('beforebegin','<button id="hdLayoutBtn" class="btn ghost">Монтаж</button><button id="hdCorrectionsBtn" class="btn ghost">Правки <span id="hdCorrectionCount" class="hd-count">0</span></button>');
  }
  document.body.insertAdjacentHTML('beforeend',`<section id="hdLayout" class="hd-work hidden"><div class="hd-head"><div><strong>Монтаж каталога</strong><span>Перестановка, развороты, удаление и комментарии по каждой странице.</span></div><div><button id="hdReset" class="btn ghost hd-danger">Сбросить</button><button id="hdApply" class="btn primary">Применить и вернуться</button></div></div><div class="hd-tip"><b>Порядок:</b> зажми карточку за <b>⠿ Перетащить</b> и брось слева/справа от нужной страницы — место вставки подсветится. Можно также жать ← →. <b>Разворот:</b> левая карточка должна иметь отметку «пара со следующей». Клик по карточке открывает точную правку справа.</div><div class="hd-layout-body"><div id="hdBoard" class="hd-board"></div><aside id="hdEdit" class="hd-edit"><div class="hd-empty">Выбери страницу.</div></aside></div></section><section id="hdCorrections" class="hd-work hidden"><div class="hd-head"><div><strong>Список правок</strong><span>Готовое ТЗ по отмеченным изменениям.</span></div><div><button id="hdCopy" class="btn primary">Скопировать ТЗ для ChatGPT</button><button id="hdJson" class="btn ghost">Скачать JSON</button><button id="hdCloseCorrections" class="icon-btn">×</button></div></div><div class="hd-tip">После ревизии скопируй ТЗ и отправь мне в чат. После публикации исправления выполненная правка будет удалена из списка автоматически.</div><div id="hdCorrectionList" class="hd-corrections"></div></section>`);
  const style=document.createElement('style');style.textContent=`.hd-count{display:inline-grid;place-items:center;min-width:19px;height:19px;padding:0 5px;margin-left:4px;border-radius:99px;background:#eee;font-size:10px}.hd-count.active{background:#f3a11a;color:#fff}.hd-work{position:fixed;inset:70px 0 0;background:#f1f1ef;z-index:90;overflow:auto}.hd-work.hidden{display:none}.hd-head{position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid #e5e5e5;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:16px}.hd-head>div:first-child{display:flex;flex-direction:column;gap:3px}.hd-head span{font-size:12px;color:#777}.hd-head>div:last-child{display:flex;gap:7px;align-items:center}.hd-danger{color:#bd3d3d!important}.hd-tip{max-width:1380px;margin:12px auto;background:#fff8e8;border:1px solid #efd89b;border-radius:11px;padding:10px 13px;font-size:12px}.hd-layout-body{max-width:1420px;margin:0 auto 50px;padding:0 10px;display:grid;grid-template-columns:1fr 350px;gap:12px;align-items:start}.hd-board{display:grid;gap:10px}.hd-spread{background:#fff;border:1px solid #ddd;border-radius:14px;padding:10px;display:grid;grid-template-columns:88px 1fr;gap:10px}.hd-spread-label{font-size:10px;font-weight:900;color:#777;display:flex;align-items:center;justify-content:center;text-align:center}.hd-pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.hd-cover .hd-pages{grid-template-columns:minmax(260px,580px)}.hd-drop-slot{min-height:146px;border:2px dashed #b9c3b4;border-radius:12px;background:#fafcf9;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#7b8777;gap:5px;transition:.15s}.hd-drop-slot b{font-size:10px;letter-spacing:.05em}.hd-drop-slot span{font-size:12px;font-weight:800}.hd-drop-slot.drop-active{border-color:#57c035;background:#effbea;color:#3c8d22;box-shadow:inset 0 0 0 2px #57c03533}.hd-drop-between{height:34px;margin:-3px 14px 2px 98px;border:2px dashed transparent;border-radius:9px;display:flex;align-items:center;justify-content:center;color:transparent;font-size:10px;font-weight:800;transition:.15s}.hd-drop-between:hover,.hd-drop-between.drop-active{border-color:#9fd88d;background:#f3fbf0;color:#4c9d32}.hd-drop-between.drop-active{border-color:#57c035;background:#eaf8e5;color:#318516}.hd-card{border:1px solid #e5e5e5;border-radius:11px;padding:8px;display:grid;grid-template-columns:118px 1fr;grid-template-rows:auto auto auto 1fr;gap:4px 10px;background:#fff;cursor:pointer;position:relative}.hd-card[draggable=true]{cursor:grab}.hd-card.dragging{opacity:.38;cursor:grabbing}.hd-card.drop-before:before,.hd-card.drop-after:after{content:'';position:absolute;top:-3px;bottom:-3px;width:6px;border-radius:99px;background:#57c035;z-index:5}.hd-card.drop-before:before{left:-8px}.hd-card.drop-after:after{right:-8px}.hd-drag{display:inline-flex;align-items:center;gap:4px;width:max-content;font-size:9px;font-weight:800;color:#57a832;background:#f3faef;border:1px dashed #a9d89a;border-radius:7px;padding:4px 7px;user-select:none}.hd-card.changed{box-shadow:inset 0 0 0 2px #6ba6e5}.hd-card.excluded{opacity:.48}.hd-card img{grid-row:1/5;width:118px;aspect-ratio:297/210;object-fit:cover;border:1px solid #ddd;border-radius:6px}.hd-card-top{display:flex;justify-content:space-between;gap:8px}.hd-pos{background:#231f20;color:#fff;border-radius:99px;padding:3px 7px;font-size:10px;font-weight:800}.hd-side{font-size:9px;color:#777;text-transform:uppercase}.hd-card b{font-size:11px;line-height:1.25}.hd-card small{font-size:9px;color:#777;font-weight:700}.hd-card-actions{display:flex;align-self:end;gap:5px}.hd-card-actions button{border:1px solid #ddd;background:#fff;border-radius:7px;padding:5px 8px;font-size:10px}.hd-card-actions button:last-child{margin-left:auto}.hd-edit{position:sticky;top:86px;background:#fff;border:1px solid #ddd;border-radius:14px;max-height:calc(100vh - 110px);overflow:auto;padding:14px}.hd-empty{font-size:12px;color:#777}.hd-edit h3{margin:0 0 4px;font-size:15px}.hd-edit .sub{font-size:11px;color:#777;margin-bottom:14px}.hd-field{margin-bottom:11px}.hd-field label{display:block;font-size:9px;text-transform:uppercase;font-weight:800;color:#777;margin-bottom:5px}.hd-field select,.hd-field textarea{width:100%;border:1px solid #ddd;border-radius:9px;padding:9px;background:#fff}.hd-field textarea{resize:vertical}.hd-moves{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}.hd-toggle{display:flex;justify-content:space-between;align-items:center;border:1px solid #e5e5e5;border-radius:9px;padding:9px;margin-bottom:7px;font-size:12px}.hd-toggle input{width:18px;height:18px}.hd-auto-note{font-size:10px;line-height:1.4;color:#56824a;background:#f2faef;border:1px solid #cfe6c6;border-radius:9px;padding:8px 9px;margin:8px 0}.hd-save{width:100%;margin-top:8px}.hd-corrections{max-width:1200px;margin:12px auto 50px;padding:0 10px;display:grid;gap:9px}.hd-correction{display:grid;grid-template-columns:110px 1fr auto;gap:12px;align-items:center;background:#fff;border:1px solid #e5e5e5;border-radius:13px;padding:9px}.hd-correction.done{opacity:.55}.hd-correction img{width:110px;aspect-ratio:297/210;object-fit:cover;border-radius:6px;border:1px solid #ddd}.hd-correction b{font-size:12px}.hd-correction ul{font-size:11px;line-height:1.4;margin:6px 0 0;padding-left:18px}.hd-none{background:#fff;border:1px dashed #ccc;border-radius:13px;padding:28px;text-align:center;color:#777}@media(max-width:900px){.hd-drop-between{margin-left:8px}.hd-work{inset:62px 0 0}.hd-head{padding:9px 10px}.hd-head>div:last-child{flex-wrap:wrap;justify-content:flex-end}.hd-tip{margin:9px}.hd-layout-body{display:block;padding:0 8px}.hd-edit{position:relative;top:auto;max-height:none;margin:10px 0}.hd-spread{grid-template-columns:1fr}.hd-spread-label{justify-content:flex-start}.hd-pages{grid-template-columns:1fr}.hd-card{grid-template-columns:95px 1fr}.hd-card img{width:95px}.hd-correction{grid-template-columns:80px 1fr}.hd-correction img{width:80px}.hd-correction>.btn{grid-column:2}.top-actions #hdLayoutBtn,.top-actions #hdCorrectionsBtn{padding:7px;font-size:10px}}`;document.head.appendChild(style);

  let selected=null,drag=null;
  function spreads(){const vis=ordered().filter(p=>p.included);const cover=vis.find(p=>p.physicalIndex===1)||vis[0],out=[];if(cover)out.push({cover:true,pages:[cover]});const rest=vis.filter(p=>p!==cover);for(let i=0;i<rest.length;){const p=rest[i];if(p.pairWithNext&&rest[i+1]){out.push({pages:[p,rest[i+1]]});i+=2}else{out.push({pages:[p]});i++}}return out}
  function card(p,side){return `<article class="hd-card ${changed(p)?'changed':''}" draggable="${p.physicalIndex!==1}" data-id="${p.physicalIndex}"><img src="${p.thumb}" draggable="false"><div class="hd-card-top"><span class="hd-pos">${p.order}</span><span class="hd-side">${p.physicalIndex===1?'отдельно':side}</span></div><b>${p.label} · ${esc(p.title)}</b><small>${status(p)}${changed(p)?' · ЕСТЬ ПРАВКА':''}</small><span class="hd-drag">⠿ Перетащить</span><div class="hd-card-actions"><button data-move="-1" ${p.physicalIndex===1?'disabled':''}>←</button><button data-move="1" ${p.physicalIndex===1?'disabled':''}>→</button><button data-remove="1" ${p.physicalIndex===1?'disabled':''}>Убрать</button></div></article>`}
  function renderBoard(){
    const board=$('#hdBoard');
    const ss=spreads();
    board.innerHTML=ss.map((sp,i)=>{
      const spreadNo=sp.cover?'ОБЛОЖКА':`РАЗВОРОТ ${i}`;
      let inside='';
      if(sp.cover){
        inside=card(sp.pages[0],'отдельно');
      }else if(sp.pages.length===2){
        inside=card(sp.pages[0],'левая')+card(sp.pages[1],'правая');
      }else{
        const left=sp.pages[0];
        inside=card(left,'левая')+`<div class="hd-drop-slot" data-after="${left.physicalIndex}" data-pair="1"><b>ПРАВАЯ СТРАНИЦА</b><span>Перетащите страницу сюда</span></div>`;
      }
      const last=sp.pages[sp.pages.length-1];
      const between=sp.cover?'':`<div class="hd-drop-between" data-after="${last.physicalIndex}"><span>＋ Перетащить сюда как следующую страницу</span></div>`;
      return `<div class="hd-spread ${sp.cover?'hd-cover':''}"><div class="hd-spread-label">${spreadNo}</div><div class="hd-pages">${inside}</div></div>${between}`;
    }).join('')+excludedHtml();
    wireBoard();
  }
  function excludedHtml(){const ex=ordered().filter(p=>!p.included);return ex.length?`<div class="hd-spread"><div class="hd-spread-label">УБРАНО</div><div class="hd-pages">${ex.map(p=>`<article class="hd-card excluded ${changed(p)?'changed':''}" data-id="${p.physicalIndex}"><img src="${p.thumb}"><div class="hd-card-top"><span class="hd-pos">${p.order}</span><span class="hd-side">убрана</span></div><b>${p.label} · ${esc(p.title)}</b><small>НЕ ПОКАЗЫВАЕТСЯ</small><div class="hd-card-actions"><button data-restore="1">Вернуть</button></div></article>`).join('')}</div></div>`:''}
  function clearDropMarks(){
    document.querySelectorAll('.hd-card,.hd-drop-slot,.hd-drop-between').forEach(x=>x.classList.remove('dragging','drop-before','drop-after','drop-active'));
  }
  function sourcePairCleanup(id){
    const vis=ordered().filter(p=>p.included);
    const i=vis.findIndex(p=>p.physicalIndex===id);
    if(i>0){
      const prev=vis[i-1];
      if(prev.pairWithNext) prev.pairWithNext=false;
    }
  }
  function insertRelative(id,toId,after=false,{makePair=false}={}){
    if(id===1||toId===1||id===toId)return;
    sourcePairCleanup(id);
    const a=ordered(),i=a.findIndex(p=>p.physicalIndex===id);
    if(i<0)return;
    const[m]=a.splice(i,1);
    let t=a.findIndex(p=>p.physicalIndex===toId);
    if(t<0)return;
    if(after)t++;
    a.splice(t,0,m);
    a.forEach((p,j)=>p.order=j+1);
    if(makePair){
      const left=find(toId);
      if(left)left.pairWithNext=true;
      m.pairWithNext=false;
    }
    persist();renderBoard();renderEdit();toast(`Страница ${m.label} перемещена`);
  }
  function wireBoard(){
    document.querySelectorAll('.hd-card').forEach(c=>{
      c.onclick=e=>{if(e.target.closest('button'))return;selected=Number(c.dataset.id);renderEdit()};
      c.ondragstart=e=>{
        const id=Number(c.dataset.id);
        if(id===1){e.preventDefault();return}
        drag=id;c.classList.add('dragging');
        e.dataTransfer.effectAllowed='move';
        try{e.dataTransfer.setData('text/plain',String(id))}catch{}
      };
      c.ondragend=()=>{drag=null;clearDropMarks()};
      c.ondragover=e=>{
        if(!drag||Number(c.dataset.id)===drag)return;
        e.preventDefault();e.dataTransfer.dropEffect='move';
        document.querySelectorAll('.hd-card').forEach(x=>x.classList.remove('drop-before','drop-after'));
        const r=c.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;
        c.classList.add(after?'drop-after':'drop-before');
      };
      c.ondragleave=e=>{if(!c.contains(e.relatedTarget))c.classList.remove('drop-before','drop-after')};
      c.ondrop=e=>{
        e.preventDefault();e.stopPropagation();
        const to=Number(c.dataset.id);
        if(!drag||!to||drag===to)return;
        const r=c.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;
        insertRelative(drag,to,after);drag=null;clearDropMarks();
      };
    });

    document.querySelectorAll('.hd-drop-slot').forEach(slot=>{
      slot.ondragover=e=>{if(!drag)return;e.preventDefault();e.dataTransfer.dropEffect='move';slot.classList.add('drop-active')};
      slot.ondragleave=e=>{if(!slot.contains(e.relatedTarget))slot.classList.remove('drop-active')};
      slot.ondrop=e=>{
        e.preventDefault();e.stopPropagation();
        const after=Number(slot.dataset.after);
        if(!drag||!after)return;
        insertRelative(drag,after,true,{makePair:true});drag=null;clearDropMarks();
      };
    });

    document.querySelectorAll('.hd-drop-between').forEach(zone=>{
      zone.ondragover=e=>{if(!drag)return;e.preventDefault();e.dataTransfer.dropEffect='move';zone.classList.add('drop-active')};
      zone.ondragleave=e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('drop-active')};
      zone.ondrop=e=>{
        e.preventDefault();e.stopPropagation();
        const after=Number(zone.dataset.after);
        if(!drag||!after)return;
        sourcePairCleanup(drag);
        const left=find(after); if(left)left.pairWithNext=false;
        insertRelative(drag,after,true);drag=null;clearDropMarks();
      };
    });

    document.querySelectorAll('.hd-card [data-move]').forEach(b=>b.onclick=e=>move(Number(e.target.closest('.hd-card').dataset.id),Number(b.dataset.move)));
    document.querySelectorAll('.hd-card [data-remove]').forEach(b=>b.onclick=e=>{const p=find(Number(e.target.closest('.hd-card').dataset.id));p.included=false;p.correctionType=p.correctionType||'remove';persist();renderBoard();renderEdit()});
    document.querySelectorAll('.hd-card [data-restore]').forEach(b=>b.onclick=e=>{const p=find(Number(e.target.closest('.hd-card').dataset.id));p.included=true;if(p.correctionType==='remove')p.correctionType='';persist();renderBoard();renderEdit()})
  }
  function find(id){return pages.find(p=>p.physicalIndex===id)}
  function move(id,d){if(id===1)return;const a=ordered(),i=a.findIndex(p=>p.physicalIndex===id),to=Math.max(1,Math.min(a.length-1,i+d));if(i===to)return;const[m]=a.splice(i,1);a.splice(to,0,m);a.forEach((p,j)=>p.order=j+1);persist();renderBoard();renderEdit()}
  function insertRelative(id,toId,after=false){if(id===1||toId===1)return;const a=ordered(),i=a.findIndex(p=>p.physicalIndex===id);if(i<0)return;const[m]=a.splice(i,1);let t=a.findIndex(p=>p.physicalIndex===toId);if(t<0)return;if(after)t++;a.splice(t,0,m);a.forEach((p,j)=>p.order=j+1);persist();renderBoard();renderEdit();toast(`Страница ${m.label} перемещена`)}
  function moveAfter(id,toId){if(id===1)return;const a=ordered(),i=a.findIndex(p=>p.physicalIndex===id);const[m]=a.splice(i,1);const t=a.findIndex(p=>p.physicalIndex===toId);a.splice(t+1,0,m);a.forEach((p,j)=>p.order=j+1);persist();renderBoard();renderEdit()}
  function renderEdit(){
    const box=$('#hdEdit'),p=find(selected);
    if(!p){box.innerHTML='<div class="hd-empty">Выбери страницу.</div>';return}
    const opts=ordered().filter(x=>x.physicalIndex!==p.physicalIndex).map(x=>`<option value="${x.physicalIndex}">${x.order}. ${x.label} · ${esc(x.title)}</option>`).join('');
    const extra=p.physicalIndex===1?'':`<div class="hd-field"><label>Поставить после страницы</label><select id="hdAfter">${opts}</select></div><button id="hdAfterBtn" class="btn ghost" style="width:100%;margin-bottom:10px">Перенести</button><label class="hd-toggle"><span>Показывать в каталоге</span><input id="hdIncluded" type="checkbox" ${p.included?'checked':''}></label><label class="hd-toggle"><span>Пара со следующей страницей</span><input id="hdPair" type="checkbox" ${p.pairWithNext?'checked':''}></label>`;
    box.innerHTML=`<h3>${p.label} · ${esc(p.title)}</h3><div class="sub">Позиция ${p.order} · ${status(p)}</div><div class="hd-moves"><button id="hdBack" class="btn ghost" ${p.physicalIndex===1?'disabled':''}>← На 1 назад</button><button id="hdNext" class="btn ghost" ${p.physicalIndex===1?'disabled':''}>На 1 вперёд →</button></div>${extra}<div class="hd-field"><label>Тип правки</label><select id="hdType"><option value="">Без отдельной правки</option><option value="move" ${p.correctionType==='move'?'selected':''}>Сдвинуть / переставить</option><option value="remove" ${p.correctionType==='remove'?'selected':''}>Убрать</option><option value="text" ${p.correctionType==='text'?'selected':''}>Исправить текст</option><option value="image" ${p.correctionType==='image'?'selected':''}>Заменить изображение</option><option value="design" ${p.correctionType==='design'?'selected':''}>Поправить дизайн</option><option value="tech" ${p.correctionType==='tech'?'selected':''}>Исправить тех. данные</option><option value="spread" ${p.correctionType==='spread'?'selected':''}>Изменить разворот</option><option value="other" ${p.correctionType==='other'?'selected':''}>Другое</option></select></div><div class="hd-field"><label>Что именно нужно сделать</label><textarea id="hdNote" rows="6" placeholder="Например: эту страницу поставить после HPL; заменить фото; убрать блок справа…">${esc(p.correctionText)}</textarea></div><div class="hd-auto-note">После того как исправление опубликовано, эта правка исчезнет из списка автоматически.</div><button id="hdSave" class="btn primary hd-save">Сохранить правку</button>`;
    $('#hdBack').onclick=()=>move(p.physicalIndex,-1);
    $('#hdNext').onclick=()=>move(p.physicalIndex,1);
    $('#hdAfterBtn')?.addEventListener('click',()=>moveAfter(p.physicalIndex,Number($('#hdAfter').value)));
    $('#hdSave').onclick=()=>{if(p.physicalIndex!==1){p.included=$('#hdIncluded').checked;p.pairWithNext=$('#hdPair').checked}p.correctionType=$('#hdType').value;p.correctionText=$('#hdNote').value.trim();p.correctionDone=false;persist();renderBoard();renderEdit();toast('Сохранено')};
  }
  function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1600)}
  function renderCorrections(){const list=$('#hdCorrectionList'),all=corrections();if(!all.length){list.innerHTML='<div class="hd-none">Правок пока нет. Открой «Монтаж», выбери страницу и отметь, что нужно сделать.</div>';return}list.innerHTML=all.map(({p,b})=>`<article class="hd-correction ${p.correctionDone?'done':''}" data-id="${p.physicalIndex}"><img src="${p.thumb}"><div><b>${p.label} · ${esc(p.title)}</b><ul>${b.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><button class="btn ghost">Открыть</button></article>`).join('');list.querySelectorAll('.hd-correction button').forEach(btn=>btn.onclick=e=>{selected=Number(e.target.closest('.hd-correction').dataset.id);$('#hdCorrections').classList.add('hidden');renderBoard();renderEdit();$('#hdLayout').classList.remove('hidden')})}
  function brief(){const all=corrections(),order=ordered().filter(p=>p.included).map(p=>p.label).join(' → '),lines=['HIDDEN DOORS 2026 — правки каталога','',`Итоговый порядок включённых страниц: ${order}`,'','Правки по страницам:'];if(!all.length)lines.push('- правок нет');all.forEach(({p,b})=>{lines.push(`\n[${p.label}] ${p.title}`);if(p.correctionId)lines.push(`- ID правки: ${p.correctionId}`);b.forEach(x=>lines.push(`- ${x}`))});return lines.join('\n')}
  async function copy(){const t=brief();try{await navigator.clipboard.writeText(t);toast('ТЗ скопировано — отправь его мне в чат')}catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast('ТЗ скопировано')}}
  function json(){persist();const blob=new Blob([localStorage.getItem(KEY)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hidden-doors-catalog-corrections.json';a.click();URL.revokeObjectURL(a.href)}

  $('#hdLayoutBtn').onclick=()=>{renderBoard();renderEdit();$('#hdLayout').classList.remove('hidden')};$('#hdCorrectionsBtn').onclick=()=>{renderCorrections();$('#hdCorrections').classList.remove('hidden')};$('#hdApply').onclick=()=>{persist();location.reload()};$('#hdCloseCorrections').onclick=()=>$('#hdCorrections').classList.add('hidden');$('#hdCopy').onclick=copy;$('#hdJson').onclick=json;$('#hdReset').onclick=()=>{if(confirm('Сбросить перестановки, удаление страниц и все комментарии?')){localStorage.removeItem(KEY);localStorage.removeItem('hiddenDoorsCatalog2026.plan.v4');localStorage.removeItem('hiddenDoorsCatalog2026.plan.v3');localStorage.removeItem('hiddenDoorsCatalog2026.plan.v2');location.reload()}};updateCount();
})();