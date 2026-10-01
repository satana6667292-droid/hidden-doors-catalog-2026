(()=>{
  const BASE=window.CATALOG_EDITOR_BASE||[];
  if(!BASE.length)return;
  const KEY='hiddenDoorsCatalog2026.plan.v12';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=q=>document.querySelector(q), $$=q=>[...document.querySelectorAll(q)];
  const resolved=new Set(window.CATALOG_RESOLVED_CORRECTIONS||[]);

  const baseline=clone(BASE);
  const baseMap=new Map(baseline.map(p=>[p.physicalIndex,clone(p)]));
  const baseVisiblePos=()=>new Map(baseline.filter(p=>p.included!==false).sort((a,b)=>a.order-b.order).map((p,i)=>[p.physicalIndex,i+1]));

  let saved={pages:[]};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{"pages":[]}')}catch{}
  const savedMap=new Map((saved.pages||[]).map(p=>[p.physicalIndex,p]));
  let pages=baseline.map(p=>{
    const s=savedMap.get(p.physicalIndex)||{};
    const solved=!!(s.correctionId&&resolved.has(s.correctionId));
    return {...clone(p),
      order:s.order??p.order,
      included:s.included??p.included,
      pairWithNext:s.pairWithNext??p.pairWithNext,
      correctionType:solved?'':(s.correctionType||''),
      correctionText:solved?'':(s.correctionText||''),
      correctionId:solved?'':(s.correctionId||''),
      moved:!!s.moved, pairEdited:!!s.pairEdited, images:solved?[]:(Array.isArray(s.images)?clone(s.images):[]), status:s.status??p.status, statusText:s.statusText??p.statusText
    };
  });

  let open=false,tab='layout',selected=null,moveId=null,dragId=null,undoStack=[],redoStack=[];
  let viewerPageId=null,viewerZoom=1;
  const DB_NAME='hiddenDoorsCatalogAssets',DB_STORE='assets';
  const assetUrls=new Map();
  function fullSrc(p){const t=String(p?.thumb||'');return p?.page||p?.src||p?.image||t.replace('/thumbs/','/pages/');}
  function openAssetDb(){return new Promise((resolve,reject)=>{const q=indexedDB.open(DB_NAME,1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(DB_STORE))q.result.createObjectStore(DB_STORE)};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
  async function putAsset(id,file){const db=await openAssetDb();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
  async function getAsset(id){const db=await openAssetDb();const v=await new Promise((resolve,reject)=>{const q=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)});db.close();return v}
  async function deleteAsset(id){try{const db=await openAssetDb();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch{}const u=assetUrls.get(id);if(u){URL.revokeObjectURL(u);assetUrls.delete(id)}}
  async function assetUrl(id){if(assetUrls.has(id))return assetUrls.get(id);const blob=await getAsset(id);if(!blob)return'';const u=URL.createObjectURL(blob);assetUrls.set(id,u);return u}
  function fileDimensions(file){return new Promise(resolve=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{resolve({w:im.naturalWidth||1,h:im.naturalHeight||1});URL.revokeObjectURL(u)};im.onerror=()=>{resolve({w:1,h:1});URL.revokeObjectURL(u)};im.src=u})}
  const ordered=()=>[...pages].sort((a,b)=>a.order-b.order||a.physicalIndex-b.physicalIndex);
  const visible=()=>ordered().filter(p=>p.included!==false);
  const find=id=>pages.find(p=>p.physicalIndex===Number(id));
  const status=p=>p.status==='approved'?'Согласовано':p.status==='reserved'?'Резерв':'В работе';
  const typeLabel=v=>({text:'Исправить текст',image:'Заменить изображение',design:'Поправить дизайн',tech:'Исправить тех. данные',spread:'Изменить разворот',other:'Другое'})[v]||'';

  function normalize(){
    const all=ordered();
    const cover=all.find(p=>p.physicalIndex===1);
    if(cover){const i=all.indexOf(cover);if(i>0){all.splice(i,1);all.unshift(cover)}}
    all.forEach((p,i)=>p.order=i+1);
  }
  function currentVisiblePos(){return new Map(visible().map((p,i)=>[p.physicalIndex,i+1]));}
  function bits(p){
    const b=baseMap.get(p.physicalIndex),a=[]; if(!b)return a;
    if(p.included!==b.included)a.push(p.included?'Вернуть страницу в каталог':'Убрать страницу из каталога');
    if(p.moved&&p.included&&b.included){
      const cur=currentVisiblePos().get(p.physicalIndex),old=baseVisiblePos().get(p.physicalIndex);
      if(cur!==old)a.push(`Переместить: позиция ${old} → ${cur}`);
    }
    if(p.pairEdited&&p.pairWithNext!==b.pairWithNext)a.push(p.pairWithNext?'Сделать разворот со следующей страницей':'Разорвать разворот со следующей страницей');
    if(p.correctionType)a.push(typeLabel(p.correctionType));
    if((p.correctionText||'').trim())a.push(p.correctionText.trim());
    (p.images||[]).forEach(im=>a.push(`Разместить изображение «${im.name||'изображение'}» — X ${Math.round((im.x||0)*100)}%, Y ${Math.round((im.y||0)*100)}%, ширина ${Math.round((im.w||0)*100)}%`));
    return a;
  }
  function correctionRows(){return ordered().map(p=>({p,b:bits(p)})).filter(x=>x.b.length);}
  function newId(p){return 'HD-'+Date.now().toString(36).toUpperCase()+'-'+String(p.physicalIndex).padStart(2,'0')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();}
  function persist(){
    normalize();
    const bpos=baseVisiblePos(),cpos=currentVisiblePos();
    pages.forEach(p=>{
      if(p.moved&&p.included&&baseMap.get(p.physicalIndex)?.included&&bpos.get(p.physicalIndex)===cpos.get(p.physicalIndex))p.moved=false;
      if(p.pairEdited&&p.pairWithNext===baseMap.get(p.physicalIndex)?.pairWithNext)p.pairEdited=false;
      const has=bits(p).length>0;if(has&&!p.correctionId)p.correctionId=newId(p);if(!has)p.correctionId='';
    });
    try{localStorage.setItem(KEY,JSON.stringify({version:12,pages:pages.map(p=>({physicalIndex:p.physicalIndex,order:p.order,included:p.included,pairWithNext:p.pairWithNext,correctionType:p.correctionType||'',correctionText:p.correctionText||'',correctionId:p.correctionId||'',moved:!!p.moved,pairEdited:!!p.pairEdited,images:Array.isArray(p.images)?clone(p.images):[],status:p.status,statusText:p.statusText}))}))}catch{}
    updateTopBadge();
  }
  function snapshot(){return clone(pages.map(p=>({physicalIndex:p.physicalIndex,order:p.order,included:p.included,pairWithNext:p.pairWithNext,correctionType:p.correctionType,correctionText:p.correctionText,correctionId:p.correctionId,moved:!!p.moved,pairEdited:!!p.pairEdited,images:Array.isArray(p.images)?clone(p.images):[],status:p.status,statusText:p.statusText})));}
  function restore(s){const m=new Map(s.map(x=>[x.physicalIndex,x]));pages.forEach(p=>Object.assign(p,m.get(p.physicalIndex)||{}));persist();render();}
  function mutate(fn){undoStack.push(snapshot());if(undoStack.length>40)undoStack.shift();redoStack=[];fn();persist();render();}
  function undo(){if(!undoStack.length)return;redoStack.push(snapshot());restore(undoStack.pop());}
  function redo(){if(!redoStack.length)return;undoStack.push(snapshot());restore(redoStack.pop());}

  // Keep the visual spread slots stable when merely reordering pages.
  function spreadPattern(){return visible().filter(p=>p.physicalIndex!==1).map(p=>!!p.pairWithNext);}
  function applyPattern(pattern){const rest=visible().filter(p=>p.physicalIndex!==1);rest.forEach((p,i)=>p.pairWithNext=!!pattern[i]);if(rest.length)rest[rest.length-1].pairWithNext=false;}
  function insertAt(id,targetId,where='before'){
    if(id===1||targetId===1||id===targetId)return;
    selected=id;moveId=null;
    mutate(()=>{
      const pat=spreadPattern(),arr=ordered(),i=arr.findIndex(p=>p.physicalIndex===id);const [m]=arr.splice(i,1);
      let t=arr.findIndex(p=>p.physicalIndex===targetId);if(where==='after')t++;
      arr.splice(t,0,m);arr.forEach((p,j)=>p.order=j+1);normalize();applyPattern(pat);m.moved=true;
    });
  }
  function putRightOf(id,leftId){
    if(id===1||id===leftId)return;
    selected=id;moveId=null;
    mutate(()=>{
      const arr=ordered(),i=arr.findIndex(p=>p.physicalIndex===id),[m]=arr.splice(i,1),t=arr.findIndex(p=>p.physicalIndex===leftId);
      arr.splice(t+1,0,m);arr.forEach((p,j)=>p.order=j+1);normalize();
      const left=find(leftId);left.pairWithNext=true;left.pairEdited=true;m.pairWithNext=false;m.moved=true;
    });
  }

  function spreads(){
    const v=visible(),cover=v.find(p=>p.physicalIndex===1)||v[0],out=[];
    if(cover)out.push({cover:true,pages:[cover]});
    const rest=v.filter(p=>p!==cover);
    for(let i=0;i<rest.length;){const p=rest[i];if(p.pairWithNext&&rest[i+1]){out.push({pages:[p,rest[i+1]]});i+=2}else{out.push({pages:[p]});i++}}
    return out;
  }

  function hidePage(id){
    if(id===1)return;
    mutate(()=>{
      const pat=spreadPattern(),p=find(id);p.included=false;normalize();applyPattern(pat);
    });
    if(selected===id) selected=null;
    if(moveId===id) moveId=null;
  }
  function setPair(id,value){
    mutate(()=>{
      const v=visible(),i=v.findIndex(p=>p.physicalIndex===id),p=find(id);
      if(!p||p.physicalIndex===1)return;
      if(value){
        if(i<0||i>=v.length-1)return;
        const prev=v[i-1]; if(prev?.pairWithNext){prev.pairWithNext=false;prev.pairEdited=true;}
        p.pairWithNext=true;p.pairEdited=true;
      }else{p.pairWithNext=false;p.pairEdited=true;}
    });
  }

  function card(p,side){
    return `<article class="ce-card ${selected===p.physicalIndex?'selected':''} ${moveId===p.physicalIndex?'moving':''} ${bits(p).length?'changed':''}" data-id="${p.physicalIndex}">
      <div class="ce-img"><img src="${p.thumb}" draggable="false" alt=""><span class="ce-num">${p.label}</span><span class="ce-side">${side}</span></div>
      <div class="ce-body"><b>${esc(p.title)}</b><div class="ce-meta-line"><span class="ce-status ${p.status}">${status(p)}</span>${(p.images||[]).length?`<span class="ce-photo-badge">Фото: ${p.images.length}</span>`:''}</div>
        <div class="ce-actions"><button data-act="open">Правка</button>${p.status==='approved'?'<button class="ce-quick-approved" disabled>✓ Согласовано</button>':'<button data-act="approve" class="ce-quick-approve">✓ Согласовать</button>'}${p.physicalIndex!==1?'<button data-act="move">Переместить</button><button data-act="hide" class="ce-hide-action">Убрать</button>':''}</div>${p.physicalIndex!==1?'<div class="ce-drag-handle" draggable="true" title="Зажмите и перетащите">⠿ Тянуть мышкой</div>':''}
      </div>
    </article>`;
  }
  function slotButton(attrs,text,sub=''){
    return `<button class="ce-slot" ${attrs}><span class="plus">＋</span><b>${text}</b>${sub?`<small>${sub}</small>`:''}</button>`;
  }
  function layoutHtml(){
    const rows=spreads();
    let html=`<div class="ce-guide"><strong>Как менять порядок</strong><div><span>1</span> Перетащи страницу на другую — они поменяются местами.</div><div><span>2</span> Или нажми <b>«Переместить»</b> на странице, затем зелёное место <b>«Поставить сюда»</b>.</div><div><span>3</span> Нажми <b>«Применить и посмотреть»</b>, когда закончишь.</div></div>`;
    if(moveId){const mp=find(moveId);html+=`<div class="ce-move-banner"><div><b>Перемещаем страницу ${mp?.label||''}</b><span>Нажмите зелёное место, куда её поставить.</span></div><button id="ceCancelMove">Отменить</button></div>`;}html+='<div class="ce-board">';
    rows.forEach((r,i)=>{
      if(r.cover){html+=`<section class="ce-spread cover"><div class="ce-spread-label"><b>Обложка</b><span>отдельно</span></div><div class="ce-pages one">${card(r.pages[0],'обложка')}</div></section>`;return;}
      const l=r.pages[0],rr=r.pages[1];
      if(moveId)html+=slotButton(`data-before="${l.physicalIndex}"`,'Поставить перед этим разворотом');
      html+=`<section class="ce-spread"><div class="ce-spread-label"><b>Разворот ${i}</b><span>${l.label}${rr?' + '+rr.label:''}</span></div><div class="ce-pages">${card(l,'левая')}${rr?card(rr,'правая'):(moveId?slotButton(`data-right="${l.physicalIndex}"`,'Поставить справа',`создать разворот с ${l.label}`):`<div class="ce-empty" data-empty-right="${l.physicalIndex}"><b>Пустая правая сторона</b><span>Перетащите страницу сюда или нажмите «Переместить»</span></div>`)}</div></section>`;
      if(moveId)html+=slotButton(`data-after="${(rr||l).physicalIndex}"`,'Поставить после этого разворота');
    });
    const hidden=ordered().filter(p=>!p.included);
    if(hidden.length){html+=`<section class="ce-hidden"><div class="ce-hidden-title"><b>Убрано из каталога</b><span>${hidden.length}</span></div><div class="ce-hidden-grid">${hidden.map(p=>`<div class="ce-hidden-card" data-id="${p.physicalIndex}"><img src="${p.thumb}"><div><b>${p.label} · ${esc(p.title)}</b><button data-restore>Вернуть</button></div></div>`).join('')}</div></section>`;}
    html+='</div>';return html;
  }

  function inspectorHtml(){
    const p=find(selected);
    if(!p)return '<div class="ce-inspector-empty"><b>Выберите страницу</b><span>Нажмите на карточку. Здесь появятся действия и поле для комментария.</span></div>';
    return `<div class="ce-inspector-head"><span>Страница ${p.label}</span><b>${esc(p.title)}</b><small>Позиция ${currentVisiblePos().get(p.physicalIndex)??'—'} · ${status(p)}</small></div>
      <div class="ce-inspector-actions"><button id="ceOpenLarge">⛶ Увеличить страницу</button>
        ${p.status==='approved'
          ? '<button id="ceApprovedBtn" class="approved" disabled>✓ СОГЛАСОВАНО</button><button id="ceReturnWorkBtn" class="secondary-status">Вернуть в работу</button>'
          : '<button id="ceApproveBtn" class="approve">✓ СОГЛАСОВАТЬ СТРАНИЦУ</button>'}
        ${p.physicalIndex!==1?`<button id="ceMoveBtn" class="${moveId===p.physicalIndex?'on':''}">${moveId===p.physicalIndex?'Отменить перенос':'↔ Переместить страницу'}</button><button id="ceHideBtn" class="danger">${p.included?'Убрать из каталога':'Вернуть в каталог'}</button>`:''}</div>
      ${p.physicalIndex!==1&&p.included?`<div class="ce-control"><label><b>Разворот со следующей</b><span>${p.pairWithNext?'Следующая страница будет справа':'Эта страница будет отдельной'}</span></label><input id="cePair" type="checkbox" ${p.pairWithNext?'checked':''}></div>`:''}
      <div class="ce-assets"><div class="ce-assets-head"><div><b>Изображения на странице</b><span>Загрузи фото и расположи его прямо на увеличенной странице.</span></div></div>
        <input id="ceImageUpload" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <button id="ceUploadImage" class="ce-upload-image">＋ Загрузить изображение</button>
        ${(p.images||[]).length?`<div class="ce-asset-list">${p.images.map(im=>`<div class="ce-asset-row" data-image-id="${im.id}"><span><b>${esc(im.name||'Изображение')}</b><small>на странице</small></span><button data-place-image>Открыть</button><button data-delete-image class="danger">Удалить</button></div>`).join('')}</div>`:''}
        <small class="ce-local-note">Изображение хранится в этом браузере как рабочий макет до публикации.</small>
      </div>
      <div class="ce-note"><label>Тип правки</label><select id="ceType"><option value="">Без отдельной правки</option><option value="text" ${p.correctionType==='text'?'selected':''}>Исправить текст</option><option value="image" ${p.correctionType==='image'?'selected':''}>Заменить изображение</option><option value="design" ${p.correctionType==='design'?'selected':''}>Поправить дизайн</option><option value="tech" ${p.correctionType==='tech'?'selected':''}>Исправить тех. данные</option><option value="spread" ${p.correctionType==='spread'?'selected':''}>Изменить разворот</option><option value="other" ${p.correctionType==='other'?'selected':''}>Другое</option></select><label>Что изменить</label><textarea id="ceNote" rows="7" placeholder="Например: уменьшить логотип; заменить фото; убрать блок справа…">${esc(p.correctionText||'')}</textarea><button id="ceSaveNote">Сохранить правку</button><small>После публикации исправления правка исчезнет автоматически.</small></div>`;
  }
  function correctionsHtml(){
    const rows=correctionRows();
    if(!rows.length)return '<div class="ce-empty-corr"><b>Правок нет</b><span>Все отмеченные изменения уже применены.</span></div>';
    return `<div class="ce-corrections">${rows.map(({p,b})=>`<article data-id="${p.physicalIndex}"><img src="${p.thumb}"><div><b>${p.label} · ${esc(p.title)}</b><ul>${b.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><button data-open>Открыть</button></article>`).join('')}</div>`;
  }

  function render(){
    if(!open)return;
    $('#ceTabLayout').classList.toggle('active',tab==='layout');$('#ceTabCorr').classList.toggle('active',tab==='corrections');
    $('#ceUndo').disabled=!undoStack.length;$('#ceRedo').disabled=!redoStack.length;$('#ceCorrBadge').textContent=correctionRows().length;
    $('#ceMain').innerHTML=tab==='layout'?layoutHtml():correctionsHtml();
    $('#ceInspector').innerHTML=tab==='layout'?inspectorHtml():'<div class="ce-inspector-empty"><b>Список правок</b><span>Открой нужную правку из списка слева.</span></div>';
    wire();
  }
  function wire(){
    $$('.ce-card').forEach(c=>{
      const id=Number(c.dataset.id);
      c.addEventListener('click',e=>{
        const a=e.target.closest('[data-act]')?.dataset.act;
        if(a==='approve'){selected=id;mutate(()=>{const p=find(id);if(!p)return;p.status='approved';p.statusText='Согласовано'});toast('Страница согласована');return}
        if(a==='move'){selected=id;moveId=moveId===id?null:id;render();return}
        if(a==='hide'){selected=id;hidePage(id);return}
        selected=id;render();
      });
      c.addEventListener('dragover',e=>{if(!dragId||dragId===id)return;e.preventDefault();e.dataTransfer.dropEffect='move';const r=c.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;c.classList.toggle('drop-before',!after);c.classList.toggle('drop-after',after)});
      c.addEventListener('dragleave',()=>c.classList.remove('drop-before','drop-after'));
      c.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();const r=c.getBoundingClientRect(),after=e.clientX>r.left+r.width/2;c.classList.remove('drop-before','drop-after');if(dragId&&dragId!==id)insertAt(dragId,id,after?'after':'before');dragId=null});
      const h=c.querySelector('.ce-drag-handle');
      if(h){h.addEventListener('dragstart',e=>{dragId=id;selected=id;c.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(id))}catch{}});h.addEventListener('dragend',()=>{dragId=null;$$('.ce-card').forEach(x=>x.classList.remove('dragging','drop-before','drop-after'))});}
    });
    $$('.ce-empty[data-empty-right]').forEach(z=>{z.ondragover=e=>{if(dragId){e.preventDefault();z.classList.add('drag-over')}};z.ondragleave=()=>z.classList.remove('drag-over');z.ondrop=e=>{e.preventDefault();z.classList.remove('drag-over');if(dragId)putRightOf(dragId,Number(z.dataset.emptyRight));dragId=null}});
    $('#ceCancelMove')?.addEventListener('click',()=>{moveId=null;render()});
    $$('.ce-slot[data-before]').forEach(b=>{b.onclick=()=>insertAt(moveId,Number(b.dataset.before),'before');b.ondragover=e=>{if(dragId){e.preventDefault();b.classList.add('drag-over')}};b.ondragleave=()=>b.classList.remove('drag-over');b.ondrop=e=>{e.preventDefault();b.classList.remove('drag-over');if(dragId)insertAt(dragId,Number(b.dataset.before),'before');dragId=null}});
    $$('.ce-slot[data-after]').forEach(b=>{b.onclick=()=>insertAt(moveId,Number(b.dataset.after),'after');b.ondragover=e=>{if(dragId){e.preventDefault();b.classList.add('drag-over')}};b.ondragleave=()=>b.classList.remove('drag-over');b.ondrop=e=>{e.preventDefault();b.classList.remove('drag-over');if(dragId)insertAt(dragId,Number(b.dataset.after),'after');dragId=null}});
    $$('.ce-slot[data-right]').forEach(b=>{b.onclick=()=>putRightOf(moveId,Number(b.dataset.right));b.ondragover=e=>{if(dragId){e.preventDefault();b.classList.add('drag-over')}};b.ondragleave=()=>b.classList.remove('drag-over');b.ondrop=e=>{e.preventDefault();b.classList.remove('drag-over');if(dragId)putRightOf(dragId,Number(b.dataset.right));dragId=null}});
    $$('[data-restore]').forEach(b=>b.onclick=e=>{const id=Number(e.target.closest('.ce-hidden-card').dataset.id);selected=id;mutate(()=>{const p=find(id);p.included=true;p.order=Math.max(...pages.map(x=>x.order))+1;p.pairWithNext=false;});});
    $$('[data-open]').forEach(b=>b.onclick=e=>{selected=Number(e.target.closest('article').dataset.id);tab='layout';render();setTimeout(()=>document.querySelector(`.ce-card[data-id="${selected}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),20)});
    $('#ceMoveBtn')?.addEventListener('click',()=>{moveId=moveId===selected?null:selected;render()});
    $('#ceHideBtn')?.addEventListener('click',()=>{const p=find(selected);if(!p)return;if(p.included)hidePage(selected);else mutate(()=>{p.included=true;p.order=Math.max(...pages.map(x=>x.order))+1;p.pairWithNext=false;})});
    $('#ceApproveBtn')?.addEventListener('click',()=>{mutate(()=>{const p=find(selected);if(!p)return;p.status='approved';p.statusText='Согласовано'});toast('Страница согласована')});
    $('#ceReturnWorkBtn')?.addEventListener('click',()=>{if(!confirm('Вернуть эту страницу в статус «В работе»?'))return;mutate(()=>{const p=find(selected);if(!p)return;p.status='work';p.statusText='В работе'});toast('Страница возвращена в работу')});
    $('#cePair')?.addEventListener('change',e=>setPair(selected,e.target.checked));
    $('#ceSaveNote')?.addEventListener('click',()=>mutate(()=>{const p=find(selected);p.correctionType=$('#ceType').value;p.correctionText=$('#ceNote').value.trim()}));
  }

  function updateTopBadge(){const b=$('#catalogEditorButton .ce-top-badge');if(b)b.textContent=correctionRows().length;}
  function brief(){const rows=correctionRows(),lines=['HIDDEN DOORS 2026 — правки каталога','',`Итоговый порядок включённых страниц: ${visible().map(p=>p.label).join(' → ')}`,'','Правки по страницам:'];if(!rows.length)lines.push('- правок нет');rows.forEach(({p,b})=>{lines.push(`\n[${p.label}] ${p.title}`);if(p.correctionId)lines.push(`- ID правки: ${p.correctionId}`);b.forEach(x=>lines.push(`- ${x}`))});return lines.join('\n');}
  async function copyBrief(){const t=brief();try{await navigator.clipboard.writeText(t);toast('ТЗ скопировано')}catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast('ТЗ скопировано')}}
  function toast(t){const x=$('#ceToast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1700);}

  const css=document.createElement('style');css.textContent=`
  #catalogEditor{position:fixed;inset:0;z-index:1000;background:#f2f3f0;color:#231f20;font-family:Arial,Manrope,sans-serif}#catalogEditor.hidden{display:none}.ce-top{height:72px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;gap:12px;padding:0 16px}.ce-title{min-width:230px}.ce-title b{display:block;font-size:18px}.ce-title span{font-size:11px;color:#777}.ce-tabs,.ce-tools{display:flex;gap:6px}.ce-tools{margin-left:auto}.ce-top button{border:0;border-radius:10px;padding:10px 13px;font-weight:800;background:#efefee;cursor:pointer}.ce-top button.active{background:#231f20;color:#fff}.ce-top .primary{background:#57c035;color:#fff}.ce-top button:disabled{opacity:.35}.ce-close{width:40px}.ce-badge,.ce-top-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:99px;background:#f0a020;color:#fff;font-size:10px;margin-left:4px}.ce-shell{height:calc(100vh - 72px);display:grid;grid-template-columns:minmax(0,1fr) 360px}.ce-main{overflow:auto;padding:14px 18px 50px}.ce-inspector{background:#fff;border-left:1px solid #ddd;overflow:auto;padding:14px}.ce-guide{max-width:1380px;margin:0 auto 12px;background:#fff;border:1px solid #d9e7d4;border-radius:14px;padding:12px 14px;display:flex;gap:18px;align-items:center;font-size:11px}.ce-guide strong{font-size:12px}.ce-guide div{display:flex;gap:6px;align-items:center}.ce-guide div span{display:grid;place-items:center;width:20px;height:20px;border-radius:99px;background:#57c035;color:#fff;font-weight:900}.ce-move-banner{max-width:1380px;margin:0 auto 10px;background:#231f20;color:#fff;border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between}.ce-move-banner div{display:flex;flex-direction:column;gap:2px}.ce-move-banner span{font-size:10px;opacity:.75}.ce-move-banner button{border:0;border-radius:8px;background:#fff;color:#231f20;padding:7px 10px;font-weight:800;cursor:pointer}.ce-board{max-width:1380px;margin:0 auto;display:grid;gap:9px}.ce-spread{background:#fff;border:1px solid #dcdcdc;border-radius:14px;padding:10px;display:grid;grid-template-columns:110px 1fr;gap:10px}.ce-spread-label{display:flex;flex-direction:column;justify-content:center}.ce-spread-label b{font-size:11px;text-transform:uppercase}.ce-spread-label span{font-size:10px;color:#777;margin-top:4px}.ce-pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ce-pages.one{grid-template-columns:minmax(280px,620px)}.ce-card{border:2px solid transparent;border-radius:12px;padding:7px;background:#fff;display:grid;grid-template-columns:145px 1fr;gap:9px;cursor:pointer;transition:.12s}.ce-card:hover{border-color:#c9ddc2}.ce-card.selected{border-color:#57c035}.ce-card.moving{box-shadow:0 0 0 4px #57c03530}.ce-card.changed{background:#fbfdff}.ce-card.dragging{opacity:.35}.ce-card.drop-before,.ce-card.drop-after{border-color:#57c035;background:#ecf9e8;position:relative}.ce-card.drop-before:before,.ce-card.drop-after:after{content:'';position:absolute;top:-4px;bottom:-4px;width:6px;background:#57c035;border-radius:99px;z-index:5}.ce-card.drop-before:before{left:-8px}.ce-card.drop-after:after{right:-8px}.ce-img{position:relative}.ce-img img{display:block;width:145px;aspect-ratio:297/210;object-fit:cover;border-radius:6px;border:1px solid #ddd}.ce-num{position:absolute;top:5px;left:5px;background:#231f20;color:#fff;border-radius:99px;padding:3px 7px;font-size:10px;font-weight:900}.ce-side{position:absolute;top:5px;right:5px;background:#fff;border:1px solid #ddd;border-radius:99px;padding:3px 6px;font-size:8px;text-transform:uppercase}.ce-body{display:flex;flex-direction:column;gap:6px;min-width:0}.ce-body>b{font-size:12px;line-height:1.25}.ce-status{font-size:9px;font-weight:800;border-radius:99px;padding:4px 7px;width:max-content;background:#eee}.ce-status.approved{background:#eef8ea;color:#479432}.ce-status.work{background:#fff3d8;color:#b27600}.ce-actions{display:flex;gap:5px;margin-top:auto;flex-wrap:wrap}.ce-actions button{border:1px solid #ddd;background:#fff;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800;cursor:pointer}.ce-actions button:nth-child(2){border-color:#9fd08e;color:#3f8d2b}.ce-actions button.ce-quick-approve,.ce-actions button.ce-quick-approved{background:#57c035;color:#fff;border-color:#57c035}.ce-actions button.ce-quick-approved:disabled{opacity:1;cursor:default}.ce-actions button.ce-hide-action{color:#b64242}.ce-drag-handle{margin-top:2px;width:max-content;border:1px dashed #9bcf89;background:#f2faef;color:#3e8d2b;border-radius:7px;padding:5px 8px;font-size:9px;font-weight:900;cursor:grab;user-select:none}.ce-drag-handle:active{cursor:grabbing}.ce-empty{min-height:128px;border:2px dashed #c6cac4;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#7b7b7b;text-align:center;gap:5px}.ce-empty.drag-over{border-color:#57c035;background:#ecf9e8;color:#3d9029}.ce-empty b{font-size:11px}.ce-empty span{font-size:9px}.ce-slot{height:38px;border:2px dashed #7bc760;background:#effbea;border-radius:10px;color:#3d9029;font-size:10px;font-weight:900;cursor:pointer;margin:0 12px 0 122px;display:flex;align-items:center;justify-content:center;gap:7px}.ce-slot:hover,.ce-slot.drag-over{background:#d9f2d0;box-shadow:0 0 0 3px #57c0352b}.ce-slot .plus{font-size:18px}.ce-slot small{font-weight:600}.ce-hidden{background:#fff;border:1px solid #ddd;border-radius:14px;padding:10px;margin-top:8px}.ce-hidden-title{display:flex;justify-content:space-between;margin-bottom:8px}.ce-hidden-title span{font-size:10px;color:#777}.ce-hidden-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ce-hidden-card{border:1px solid #eee;border-radius:10px;padding:7px;display:grid;grid-template-columns:95px 1fr;gap:7px;opacity:.75}.ce-hidden-card img{width:95px}.ce-hidden-card b{font-size:10px}.ce-hidden-card button{margin-top:8px;border:0;border-radius:7px;padding:6px;background:#eef8ea;color:#438f2d;font-weight:800;cursor:pointer}.ce-inspector-empty{padding:24px 8px;display:flex;flex-direction:column;gap:6px;color:#777}.ce-inspector-empty b{color:#231f20}.ce-inspector-head{padding-bottom:12px;border-bottom:1px solid #eee}.ce-inspector-head span{font-size:9px;color:#777;text-transform:uppercase}.ce-inspector-head b{display:block;margin:4px 0}.ce-inspector-head small{font-size:9px;color:#777}.ce-inspector-actions{padding:12px 0;border-bottom:1px solid #eee;display:grid;gap:7px}.ce-inspector-actions button{border:1px solid #ddd;background:#f4f4f3;border-radius:9px;padding:10px;font-weight:800;cursor:pointer}.ce-inspector-actions button.on{background:#57c035;color:#fff;border-color:#57c035}.ce-inspector-actions button.approve,.ce-inspector-actions button.approved{background:#57c035;color:#fff;border-color:#57c035}.ce-inspector-actions button.approved:disabled{opacity:1;cursor:default}.ce-inspector-actions button.secondary-status{background:#f2faef;color:#4b8f37;border-color:#c7dfbf;font-size:11px}.ce-inspector-actions button.danger{color:#b64242}.ce-control{padding:12px 0;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between}.ce-control label b{display:block;font-size:11px}.ce-control label span{font-size:9px;color:#777}.ce-control input{width:20px;height:20px}.ce-note{padding-top:12px;display:grid;gap:7px}.ce-note label{font-size:9px;text-transform:uppercase;color:#777;font-weight:900}.ce-note select,.ce-note textarea{width:100%;border:1px solid #ddd;border-radius:9px;padding:9px;font:inherit}.ce-note textarea{resize:vertical}.ce-note button{border:0;border-radius:9px;background:#57c035;color:#fff;padding:10px;font-weight:900;cursor:pointer}.ce-note small{font-size:9px;color:#56864b;line-height:1.4}.ce-empty-corr{max-width:680px;margin:80px auto;background:#fff;border:1px dashed #bbb;border-radius:16px;padding:32px;text-align:center;display:flex;flex-direction:column;gap:6px;color:#777}.ce-empty-corr b{font-size:18px;color:#231f20}.ce-corrections{max-width:1100px;margin:0 auto;display:grid;gap:9px}.ce-corrections article{background:#fff;border:1px solid #ddd;border-radius:12px;padding:8px;display:grid;grid-template-columns:115px 1fr auto;gap:10px;align-items:center}.ce-corrections img{width:115px}.ce-corrections b{font-size:11px}.ce-corrections ul{font-size:10px;line-height:1.4;margin:5px 0 0;padding-left:18px}.ce-corrections button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:8px;font-weight:800;cursor:pointer}#ceToast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,14px);background:#231f20;color:#fff;padding:10px 16px;border-radius:99px;font-size:11px;opacity:0;transition:.2s;z-index:1200}#ceToast.show{opacity:1;transform:translate(-50%,0)}
  @media(max-width:1050px){.ce-shell{grid-template-columns:1fr}.ce-inspector{position:fixed;right:0;top:72px;bottom:0;width:min(92vw,360px);z-index:30;box-shadow:-10px 0 25px #0002}.ce-guide{align-items:flex-start;flex-direction:column;gap:7px}.ce-spread{grid-template-columns:1fr}.ce-pages{grid-template-columns:1fr}.ce-slot{margin-left:12px}.ce-hidden-grid{grid-template-columns:1fr}.ce-title{min-width:auto}.ce-tools .secondary{display:none}}
  `;document.head.appendChild(css);

  const old=$('#catalogEditor');if(old)old.remove();const legacy=$('#editorBtn');if(legacy)legacy.style.display='none';
  $$('#hdLayoutBtn,#hdCorrectionsBtn').forEach(x=>x.remove());
  const top=$('.top-actions');
  if(top&&!$('#catalogEditorButton')){const btn=document.createElement('button');btn.id='catalogEditorButton';btn.className='btn primary';btn.innerHTML='Редактор каталога <span class="ce-top-badge">0</span>';top.insertBefore(btn,$('#fitBtn')||top.lastChild);}
  document.body.insertAdjacentHTML('beforeend',`<section id="catalogEditor" class="hidden"><div class="ce-top"><div class="ce-title"><b>Редактор каталога</b><span>Порядок, развороты и правки</span></div><div class="ce-tabs"><button id="ceTabLayout" class="active">Монтаж</button><button id="ceTabCorr">Правки <span class="ce-badge" id="ceCorrBadge">0</span></button></div><div class="ce-tools"><button class="secondary" id="ceUndo">↶ Отменить</button><button class="secondary" id="ceRedo">↷ Вернуть</button><button id="ceCopy">Скопировать ТЗ</button><button id="ceReset">Сбросить изменения</button><button class="primary" id="ceApply">Применить и посмотреть</button></div><button class="ce-close" id="ceClose">×</button></div><div class="ce-shell"><main id="ceMain" class="ce-main"></main><aside id="ceInspector" class="ce-inspector"></aside></div><div id="ceToast"></div></section>`);

  $('#catalogEditorButton').onclick=()=>{open=true;$('#catalogEditor').classList.remove('hidden');render()};
  $('#ceClose').onclick=()=>{open=false;$('#catalogEditor').classList.add('hidden')};
  $('#ceApply').onclick=()=>{persist();location.reload()};
  $('#ceTabLayout').onclick=()=>{tab='layout';render()};$('#ceTabCorr').onclick=()=>{tab='corrections';moveId=null;render()};
  $('#ceUndo').onclick=undo;$('#ceRedo').onclick=redo;$('#ceCopy').onclick=copyBrief;$('#ceReset').onclick=()=>{if(confirm('Сбросить все несохранённые изменения редактора и вернуться к опубликованной версии каталога?')){try{localStorage.removeItem(KEY)}catch{}location.reload()}};document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'&&moveId){moveId=null;render()}});
  persist();updateTopBadge();
})();