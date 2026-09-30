(()=>{
  const BASE=window.CATALOG_EDITOR_BASE||[];
  if(!BASE.length)return;

  const KEY='hiddenDoorsCatalog2026.plan.v6';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const resolved=new Set(window.CATALOG_RESOLVED_CORRECTIONS||[]);
  const baseMap=new Map(BASE.map((p,i)=>[p.physicalIndex,{...clone(p),baseOrder:p.order??i+1,basePair:p.pairWithNext??false,baseIncluded:p.included!==false}]));
  const baseVisiblePos=new Map([...BASE].filter(p=>p.included!==false).sort((a,b)=>(a.order??0)-(b.order??0)).map((p,i)=>[p.physicalIndex,i+1]));

  let saved={pages:[]};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{"pages":[]}')}catch{}
  const savedMap=new Map((saved.pages||[]).map(p=>[p.physicalIndex,p]));
  let pages=BASE.map((p,i)=>{
    const s=savedMap.get(p.physicalIndex)||{};
    const solved=!!(s.correctionId&&resolved.has(s.correctionId));
    return {...clone(p),
      order:s.order??p.order??i+1,
      pairWithNext:s.pairWithNext??p.pairWithNext??false,
      included:s.included??(p.included!==false),
      correctionType:solved?'':(s.correctionType||''),
      correctionText:solved?'':(s.correctionText||''),
      correctionId:solved?'':(s.correctionId||'')
    };
  });

  const $=q=>document.querySelector(q);
  const $$=q=>[...document.querySelectorAll(q)];
  const orderedAll=()=>[...pages].sort((a,b)=>a.order-b.order||a.physicalIndex-b.physicalIndex);
  const visible=()=>orderedAll().filter(p=>p.included);
  const find=id=>pages.find(p=>p.physicalIndex===Number(id));
  const status=p=>p.status==='approved'?'Согласовано':p.status==='reserved'?'Резерв':'В работе';
  const typeLabel=v=>({move:'Переставить страницу',remove:'Убрать страницу',text:'Исправить текст',image:'Заменить изображение',design:'Поправить дизайн',tech:'Исправить тех. данные',spread:'Изменить разворот',other:'Другое'})[v]||'';

  function normalize(){
    const all=orderedAll();
    const cover=all.find(p=>p.physicalIndex===1);
    if(cover){
      const i=all.indexOf(cover);
      if(i>0){all.splice(i,1);all.unshift(cover)}
    }
    all.forEach((p,i)=>p.order=i+1);
  }
  function visiblePositionMap(){
    return new Map(visible().map((p,i)=>[p.physicalIndex,i+1]));
  }
  function bits(p){
    const b=baseMap.get(p.physicalIndex),a=[];
    if(!b)return a;
    if(p.included!==b.baseIncluded)a.push(p.included?'Вернуть страницу в каталог':'Убрать страницу из каталога');
    if(p.included&&b.baseIncluded){
      const cur=visiblePositionMap().get(p.physicalIndex),old=baseVisiblePos.get(p.physicalIndex);
      if(cur!==old)a.push(`Переместить: позиция ${old} → ${cur}`);
    }
    if(p.pairWithNext!==b.basePair)a.push(p.pairWithNext?'Объединить со следующей страницей в разворот':'Разорвать разворот со следующей страницей');
    if(p.correctionType)a.push(typeLabel(p.correctionType));
    if((p.correctionText||'').trim())a.push(p.correctionText.trim());
    return a;
  }
  function correctionRows(){return orderedAll().map(p=>({p,b:bits(p)})).filter(x=>x.b.length)}
  function newId(p){return 'HD-'+Date.now().toString(36).toUpperCase()+'-'+String(p.physicalIndex).padStart(2,'0')+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
  function persist(){
    normalize();
    pages.forEach(p=>{
      const has=bits(p).length>0;
      if(has&&!p.correctionId)p.correctionId=newId(p);
      if(!has)p.correctionId='';
    });
    localStorage.setItem(KEY,JSON.stringify({version:6,pages:pages.map(p=>({
      physicalIndex:p.physicalIndex,order:p.order,pairWithNext:p.pairWithNext,included:p.included,
      correctionType:p.correctionType||'',correctionText:p.correctionText||'',correctionId:p.correctionId||''
    }))}));
    updateBadge();
  }

  let tab='layout',selected=null,moveId=null,dragId=null,undoStack=[],redoStack=[];
  function snapshot(){return clone(pages.map(p=>({physicalIndex:p.physicalIndex,order:p.order,pairWithNext:p.pairWithNext,included:p.included,correctionType:p.correctionType,correctionText:p.correctionText,correctionId:p.correctionId})))}
  function restore(snap){
    const m=new Map(snap.map(x=>[x.physicalIndex,x]));
    pages.forEach(p=>Object.assign(p,m.get(p.physicalIndex)||{}));
    persist();render();
  }
  function mutate(fn){
    undoStack.push(snapshot()); if(undoStack.length>30)undoStack.shift(); redoStack=[];
    fn(); persist(); render();
  }
  function undo(){if(!undoStack.length)return;redoStack.push(snapshot());restore(undoStack.pop())}
  function redo(){if(!redoStack.length)return;undoStack.push(snapshot());restore(redoStack.pop())}

  function spreadRows(){
    const v=visible(),cover=v.find(p=>p.physicalIndex===1)||v[0],rows=[];
    if(cover)rows.push({cover:true,pages:[cover]});
    const rest=v.filter(p=>p!==cover);
    for(let i=0;i<rest.length;){
      const p=rest[i];
      if(p.pairWithNext&&rest[i+1]){rows.push({pages:[p,rest[i+1]]});i+=2}
      else{rows.push({pages:[p]});i++}
    }
    return rows;
  }
  function pairPattern(){
    const rest=visible().filter(p=>p.physicalIndex!==1);
    return rest.map(p=>!!p.pairWithNext);
  }
  function applyPairPattern(pattern){
    const rest=visible().filter(p=>p.physicalIndex!==1);
    rest.forEach((p,i)=>p.pairWithNext=!!pattern[i]);
    if(rest.length)rest[rest.length-1].pairWithNext=false;
  }
  function swapPages(aId,bId){
    if(aId===1||bId===1||aId===bId)return;
    mutate(()=>{
      const pattern=pairPattern(),a=find(aId),b=find(bId),t=a.order;a.order=b.order;b.order=t;
      normalize();applyPairPattern(pattern);
    });
  }
  function insertBefore(id,targetId){
    if(id===1||targetId===1||id===targetId)return;
    mutate(()=>{
      const pattern=pairPattern(),arr=orderedAll(),i=arr.findIndex(p=>p.physicalIndex===id);
      const [m]=arr.splice(i,1);let t=arr.findIndex(p=>p.physicalIndex===targetId);arr.splice(t,0,m);
      arr.forEach((p,j)=>p.order=j+1);normalize();applyPairPattern(pattern);
    });
    moveId=null;
  }
  function insertAfter(id,targetId){
    if(id===1||id===targetId)return;
    mutate(()=>{
      const pattern=pairPattern(),arr=orderedAll(),i=arr.findIndex(p=>p.physicalIndex===id);
      const [m]=arr.splice(i,1);let t=arr.findIndex(p=>p.physicalIndex===targetId);arr.splice(t+1,0,m);
      arr.forEach((p,j)=>p.order=j+1);normalize();applyPairPattern(pattern);
    });
    moveId=null;
  }
  function putInRightSlot(id,leftId){
    if(id===1||id===leftId)return;
    mutate(()=>{
      const arr=orderedAll(),i=arr.findIndex(p=>p.physicalIndex===id),[m]=arr.splice(i,1);
      const t=arr.findIndex(p=>p.physicalIndex===leftId);arr.splice(t+1,0,m);
      arr.forEach((p,j)=>p.order=j+1);normalize();
      const left=find(leftId);left.pairWithNext=true;m.pairWithNext=false;
    });
    moveId=null;
  }

  function pageCard(p,side){
    const selectedClass=selected===p.physicalIndex?' is-selected':'';
    const movingClass=moveId===p.physicalIndex?' is-moving':'';
    const changed=bits(p).length?' has-change':'';
    return `<article class="ce-card${selectedClass}${movingClass}${changed}" draggable="${p.physicalIndex!==1}" data-page="${p.physicalIndex}">
      <div class="ce-preview"><img src="${p.thumb}" alt="" draggable="false"><span class="ce-number">${p.label}</span><span class="ce-side">${p.physicalIndex===1?'обложка':side}</span></div>
      <div class="ce-card-body">
        <b>${esc(p.title)}</b>
        <span class="ce-status ${p.status}">${status(p)}</span>
        <div class="ce-card-actions">
          <button data-action="select">Открыть</button>
          ${p.physicalIndex!==1?'<button data-action="move">Переместить</button><button data-action="hide">Убрать</button>':''}
        </div>
      </div>
    </article>`;
  }

  function insertTarget(beforeId,label='Поставить сюда'){
    if(!moveId)return '';
    return `<button class="ce-insert-target" data-before="${beforeId}"><span>＋</span>${label}</button>`;
  }
  function afterTarget(afterId,label='Поставить после'){
    if(!moveId)return '';
    return `<button class="ce-insert-target ce-after-target" data-after="${afterId}"><span>＋</span>${label}</button>`;
  }

  function layoutHTML(){
    const rows=spreadRows();
    const board=rows.map((row,i)=>{
      if(row.cover){
        const p=row.pages[0];
        return `<section class="ce-spread ce-cover"><div class="ce-spread-title"><strong>Обложка</strong><span>Всегда первая и отдельно</span></div><div class="ce-pages">${pageCard(p,'отдельно')}</div></section>`;
      }
      const left=row.pages[0],right=row.pages[1];
      const before=insertTarget(left.physicalIndex,'Вставить перед разворотом');
      const after=afterTarget((right||left).physicalIndex,'Вставить после разворота');
      const rightHTML=right?pageCard(right,'правая'):(moveId?`<button class="ce-empty-slot active" data-right-of="${left.physicalIndex}"><span>＋</span><b>Поставить справа</b><small>создать разворот с ${left.label}</small></button>`:`<div class="ce-empty-slot"><b>Пустая правая сторона</b><small>Выберите страницу → «Переместить»</small></div>`);
      return `${before}<section class="ce-spread"><div class="ce-spread-title"><strong>Разворот ${i}</strong><span>${left.label}${right?' + '+right.label:''}</span></div><div class="ce-pages">${pageCard(left,'левая')}${rightHTML}</div></section>${after}`;
    }).join('');
    const hidden=orderedAll().filter(p=>!p.included);
    const hiddenHTML=hidden.length?`<section class="ce-hidden"><div class="ce-section-title"><strong>Убрано из каталога</strong><span>${hidden.length}</span></div><div class="ce-hidden-grid">${hidden.map(p=>`<article class="ce-hidden-card" data-page="${p.physicalIndex}"><img src="${p.thumb}"><div><b>${p.label} · ${esc(p.title)}</b><button data-action="restore">Вернуть в каталог</button></div></article>`).join('')}</div></section>`:'';
    return `<div class="ce-layout-tip"><b>Самый простой способ:</b> перетащи страницу прямо на другую — они поменяются местами. Для точной вставки нажми на странице <b>«Переместить»</b>, затем нажми зелёное место <b>«Поставить сюда»</b>.</div><div class="ce-board">${board}${hiddenHTML}</div>`;
  }

  function inspectorHTML(){
    const p=find(selected);
    if(!p)return `<div class="ce-inspector-empty"><b>Выберите страницу</b><span>Нажмите на карточку в каталоге. Здесь появятся действия и поле правки.</span></div>`;
    const canPair=p.physicalIndex!==1&&p.included;
    return `<div class="ce-inspector-head"><span>Страница ${p.label}</span><b>${esc(p.title)}</b></div>
      <div class="ce-inspector-block">
        ${p.physicalIndex!==1?`<button class="ce-big-action ${moveId===p.physicalIndex?'active':''}" id="ceMoveSelected">${moveId===p.physicalIndex?'Отменить перенос':'↔ Переместить страницу'}</button>`:''}
        ${p.physicalIndex!==1?`<button class="ce-big-action danger" id="ceHideSelected">${p.included?'Убрать из каталога':'Вернуть в каталог'}</button>`:''}
      </div>
      ${canPair?`<div class="ce-inspector-block"><label class="ce-switch-row"><div><b>Разворот со следующей</b><span>${p.pairWithNext?'Эта страница слева, следующая справа':'Страница отображается отдельно'}</span></div><input id="cePair" type="checkbox" ${p.pairWithNext?'checked':''}></label></div>`:''}
      <div class="ce-inspector-block">
        <label>Тип правки</label>
        <select id="ceType">
          <option value="">Без отдельной правки</option>
          <option value="text" ${p.correctionType==='text'?'selected':''}>Исправить текст</option>
          <option value="image" ${p.correctionType==='image'?'selected':''}>Заменить изображение</option>
          <option value="design" ${p.correctionType==='design'?'selected':''}>Поправить дизайн</option>
          <option value="tech" ${p.correctionType==='tech'?'selected':''}>Исправить тех. данные</option>
          <option value="spread" ${p.correctionType==='spread'?'selected':''}>Изменить разворот</option>
          <option value="other" ${p.correctionType==='other'?'selected':''}>Другое</option>
        </select>
        <label>Что нужно сделать</label>
        <textarea id="ceNote" rows="7" placeholder="Например: логотип меньше; заменить фото; убрать блок справа…">${esc(p.correctionText||'')}</textarea>
        <button class="ce-save" id="ceSaveNote">Сохранить правку</button>
        <small class="ce-auto">После публикации исправления выполненная правка удаляется автоматически.</small>
      </div>`;
  }

  function correctionsHTML(){
    const rows=correctionRows();
    if(!rows.length)return `<div class="ce-no-corrections"><b>Правок нет</b><span>Все отмеченные изменения уже применены либо каталог сейчас совпадает с опубликованной базой.</span></div>`;
    return `<div class="ce-correction-list">${rows.map(({p,b})=>`<article class="ce-correction" data-page="${p.physicalIndex}"><img src="${p.thumb}"><div><b>${p.label} · ${esc(p.title)}</b><ul>${b.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><button data-open-correction>Открыть</button></article>`).join('')}</div>`;
  }

  function render(){
    const root=$('#catalogEditor');
    if(!root)return;
    root.querySelector('#ceTabLayout').classList.toggle('active',tab==='layout');
    root.querySelector('#ceTabCorrections').classList.toggle('active',tab==='corrections');
    root.querySelector('#ceUndo').disabled=!undoStack.length;
    root.querySelector('#ceRedo').disabled=!redoStack.length;
    root.querySelector('#ceCorrectionBadge').textContent=correctionRows().length;
    root.querySelector('#ceMain').innerHTML=tab==='layout'?layoutHTML():correctionsHTML();
    root.querySelector('#ceInspector').innerHTML=tab==='layout'?inspectorHTML():`<div class="ce-inspector-empty"><b>Правки</b><span>Откройте нужную правку из списка. После публикации исправления она исчезнет автоматически.</span></div>`;
    wire();
  }

  function updateBadge(){
    const b=$('#catalogEditorButton .ce-top-badge');if(b)b.textContent=correctionRows().length;
  }

  function wire(){
    $$('.ce-card').forEach(card=>{
      const id=Number(card.dataset.page);
      card.addEventListener('click',e=>{
        const action=e.target.closest('[data-action]')?.dataset.action;
        if(action==='move'){moveId=moveId===id?null:id;selected=id;render();return}
        if(action==='hide'){mutate(()=>{const p=find(id);p.included=false;p.correctionType=p.correctionType||'remove'});return}
        selected=id;render();
      });
      card.addEventListener('dragstart',e=>{
        if(id===1){e.preventDefault();return}
        dragId=id;selected=id;card.classList.add('dragging');
        e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(id))}catch{}
      });
      card.addEventListener('dragover',e=>{if(!dragId||dragId===id)return;e.preventDefault();card.classList.add('drop-swap')});
      card.addEventListener('dragleave',()=>card.classList.remove('drop-swap'));
      card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drop-swap');if(dragId&&dragId!==id)swapPages(dragId,id);dragId=null});
      card.addEventListener('dragend',()=>{dragId=null;$$('.ce-card').forEach(x=>x.classList.remove('dragging','drop-swap'))});
    });
    $$('.ce-insert-target[data-before]').forEach(btn=>btn.onclick=()=>insertBefore(moveId,Number(btn.dataset.before)));
    $$('.ce-insert-target[data-after]').forEach(btn=>btn.onclick=()=>insertAfter(moveId,Number(btn.dataset.after)));
    $$('.ce-empty-slot[data-right-of]').forEach(btn=>btn.onclick=()=>putInRightSlot(moveId,Number(btn.dataset.rightOf)));
    $$('.ce-hidden-card [data-action="restore"]').forEach(btn=>btn.onclick=e=>{
      const id=Number(e.target.closest('.ce-hidden-card').dataset.page);
      mutate(()=>{const p=find(id);p.included=true;p.order=Math.max(...pages.map(x=>x.order))+1;p.correctionType='';});
    });
    $$('[data-open-correction]').forEach(btn=>btn.onclick=e=>{
      selected=Number(e.target.closest('.ce-correction').dataset.page);tab='layout';render();
      setTimeout(()=>document.querySelector(`.ce-card[data-page="${selected}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),30);
    });

    const moveBtn=$('#ceMoveSelected'); if(moveBtn)moveBtn.onclick=()=>{moveId=moveId===selected?null:selected;render()};
    const hideBtn=$('#ceHideSelected'); if(hideBtn)hideBtn.onclick=()=>mutate(()=>{const p=find(selected);p.included=!p.included;if(!p.included)p.correctionType=p.correctionType||'remove'});
    const pair=$('#cePair'); if(pair)pair.onchange=()=>mutate(()=>{find(selected).pairWithNext=pair.checked});
    const save=$('#ceSaveNote'); if(save)save.onclick=()=>mutate(()=>{const p=find(selected);p.correctionType=$('#ceType').value;p.correctionText=$('#ceNote').value.trim()});
  }

  function brief(){
    const rows=correctionRows(),order=visible().map(p=>p.label).join(' → ');
    const lines=['HIDDEN DOORS 2026 — правки каталога','',`Итоговый порядок включённых страниц: ${order}`,'','Правки по страницам:'];
    if(!rows.length)lines.push('- правок нет');
    rows.forEach(({p,b})=>{lines.push(`\n[${p.label}] ${p.title}`);if(p.correctionId)lines.push(`- ID правки: ${p.correctionId}`);b.forEach(x=>lines.push(`- ${x}`))});
    return lines.join('\n');
  }
  async function copyBrief(){
    const t=brief();
    try{await navigator.clipboard.writeText(t);showToast('ТЗ скопировано — отправьте его в чат')}
    catch{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();showToast('ТЗ скопировано')}
  }
  function showToast(t){const el=$('#ceToast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}

  const style=document.createElement('style');
  style.textContent=`
  #catalogEditor{position:fixed;inset:0;background:#f4f4f2;z-index:1000;color:#201f20;font-family:Arial,Manrope,sans-serif}
  #catalogEditor.hidden{display:none}.ce-top{height:72px;background:#fff;border-bottom:1px solid #ddd;display:flex;align-items:center;gap:14px;padding:0 18px;position:sticky;top:0;z-index:20}.ce-top-title{min-width:250px}.ce-top-title b{display:block;font-size:18px}.ce-top-title span{font-size:11px;color:#777}.ce-tabs{display:flex;gap:6px}.ce-tabs button,.ce-tools button,.ce-close{border:0;border-radius:10px;padding:10px 14px;font-weight:800;background:#f0f0ef;cursor:pointer}.ce-tabs button.active{background:#231f20;color:#fff}.ce-tools{margin-left:auto;display:flex;gap:6px;align-items:center}.ce-tools button:disabled{opacity:.35}.ce-primary{background:#57c035!important;color:#fff}.ce-close{font-size:18px;width:42px;padding:9px}.ce-badge,.ce-top-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:99px;background:#f0a020;color:#fff;font-size:10px;margin-left:5px}
  .ce-shell{display:grid;grid-template-columns:minmax(0,1fr) 360px;height:calc(100vh - 72px)}.ce-main{overflow:auto;padding:14px 18px 50px}.ce-inspector{background:#fff;border-left:1px solid #ddd;overflow:auto;padding:14px}.ce-layout-tip{max-width:1380px;margin:0 auto 12px;padding:12px 14px;border:1px solid #cfe5c6;background:#f3faef;border-radius:12px;font-size:12px;line-height:1.45}.ce-board{max-width:1380px;margin:0 auto;display:grid;gap:10px}.ce-spread{background:#fff;border:1px solid #ddd;border-radius:14px;padding:12px;display:grid;grid-template-columns:120px 1fr;gap:12px}.ce-spread-title{display:flex;flex-direction:column;justify-content:center}.ce-spread-title strong{font-size:12px;text-transform:uppercase}.ce-spread-title span{font-size:10px;color:#777;margin-top:4px}.ce-pages{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ce-cover .ce-pages{grid-template-columns:minmax(280px,620px)}.ce-card{border:2px solid transparent;border-radius:12px;background:#fff;padding:8px;display:grid;grid-template-columns:150px 1fr;gap:10px;cursor:pointer;box-shadow:0 1px 0 #00000008}.ce-card:hover{border-color:#c7dbc0}.ce-card.is-selected{border-color:#57c035}.ce-card.is-moving{box-shadow:0 0 0 3px #57c03533}.ce-card.has-change{background:#fbfdff}.ce-card.dragging{opacity:.38}.ce-card.drop-swap{border-color:#57c035;background:#effbea;box-shadow:0 0 0 4px #57c03522}.ce-preview{position:relative}.ce-preview img{display:block;width:150px;aspect-ratio:297/210;object-fit:cover;border:1px solid #ddd;border-radius:7px}.ce-number{position:absolute;top:6px;left:6px;background:#231f20;color:#fff;border-radius:99px;padding:3px 7px;font-size:10px;font-weight:900}.ce-side{position:absolute;top:6px;right:6px;background:#fff;border:1px solid #ddd;border-radius:99px;padding:3px 7px;font-size:8px;text-transform:uppercase}.ce-card-body{min-width:0;display:flex;flex-direction:column;gap:7px}.ce-card-body>b{font-size:12px;line-height:1.3}.ce-status{font-size:9px;font-weight:800;width:max-content;border-radius:99px;padding:4px 7px;background:#eee}.ce-status.approved{background:#eef8ea;color:#4c9634}.ce-status.work{background:#fff5df;color:#b87800}.ce-card-actions{display:flex;gap:5px;margin-top:auto;flex-wrap:wrap}.ce-card-actions button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer}.ce-card-actions button:nth-child(2){border-color:#a9d89a;color:#438f2d}.ce-card-actions button:last-child{color:#b64343}
  .ce-empty-slot{min-height:132px;border:2px dashed #c5c9c2;border-radius:12px;background:#fafbfa;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;color:#777}.ce-empty-slot.active{border-color:#79c95e;background:#f0faed;color:#3e9028;cursor:pointer}.ce-empty-slot span{font-size:23px}.ce-empty-slot small{font-size:10px}.ce-insert-target{height:34px;border:2px dashed #8bd073;background:#effbea;border-radius:10px;color:#3c9027;font-size:11px;font-weight:900;cursor:pointer;margin:0 18px 0 132px}.ce-insert-target:hover{background:#dff3d8}.ce-after-target{margin-top:-4px}
  .ce-hidden{margin-top:16px;background:#fff;border:1px solid #ddd;border-radius:14px;padding:12px}.ce-section-title{display:flex;justify-content:space-between;margin-bottom:10px}.ce-section-title span{font-size:11px;color:#777}.ce-hidden-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ce-hidden-card{display:grid;grid-template-columns:100px 1fr;gap:8px;border:1px solid #eee;border-radius:10px;padding:7px;opacity:.75}.ce-hidden-card img{width:100px}.ce-hidden-card b{font-size:10px;display:block}.ce-hidden-card button{margin-top:8px;border:0;border-radius:7px;padding:6px 8px;background:#eef8ea;color:#438f2d;font-weight:800;cursor:pointer}
  .ce-inspector-empty{padding:28px 10px;color:#777;display:flex;flex-direction:column;gap:6px}.ce-inspector-empty b{color:#231f20}.ce-inspector-head{padding-bottom:12px;border-bottom:1px solid #eee}.ce-inspector-head span{font-size:10px;color:#777;text-transform:uppercase}.ce-inspector-head b{display:block;margin-top:4px}.ce-inspector-block{padding:12px 0;border-bottom:1px solid #eee;display:grid;gap:8px}.ce-big-action{width:100%;border:1px solid #ddd;background:#f4f4f3;border-radius:9px;padding:10px;font-weight:800;cursor:pointer}.ce-big-action.active{background:#57c035;color:#fff;border-color:#57c035}.ce-big-action.danger{color:#b84343}.ce-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.ce-switch-row b{display:block;font-size:12px}.ce-switch-row span{font-size:9px;color:#777}.ce-switch-row input{width:20px;height:20px}.ce-inspector label{font-size:9px;text-transform:uppercase;color:#777;font-weight:900}.ce-inspector select,.ce-inspector textarea{width:100%;border:1px solid #ddd;border-radius:9px;padding:9px;font:inherit}.ce-inspector textarea{resize:vertical}.ce-save{border:0;border-radius:9px;background:#57c035;color:#fff;padding:10px;font-weight:900;cursor:pointer}.ce-auto{font-size:9px;color:#5d8b50;line-height:1.4}
  .ce-correction-list{max-width:1120px;margin:0 auto;display:grid;gap:9px}.ce-correction{display:grid;grid-template-columns:120px 1fr auto;gap:12px;align-items:center;background:#fff;border:1px solid #ddd;border-radius:13px;padding:9px}.ce-correction img{width:120px;border-radius:6px;border:1px solid #ddd}.ce-correction b{font-size:12px}.ce-correction ul{margin:6px 0 0;padding-left:18px;font-size:11px;line-height:1.45}.ce-correction button{border:1px solid #ddd;background:#fff;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer}.ce-no-corrections{max-width:700px;margin:80px auto;background:#fff;border:1px dashed #bbb;border-radius:16px;padding:34px;text-align:center;display:flex;flex-direction:column;gap:7px;color:#777}.ce-no-corrections b{font-size:18px;color:#231f20}
  #ceToast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,15px);background:#231f20;color:#fff;border-radius:99px;padding:10px 16px;font-size:12px;opacity:0;pointer-events:none;transition:.2s;z-index:1200}#ceToast.show{opacity:1;transform:translate(-50%,0)}
  @media(max-width:1000px){.ce-shell{grid-template-columns:1fr}.ce-inspector{position:fixed;right:0;top:72px;bottom:0;width:min(90vw,360px);z-index:30;box-shadow:-10px 0 25px #0002}.ce-top-title{min-width:auto}.ce-spread{grid-template-columns:1fr}.ce-pages{grid-template-columns:1fr}.ce-insert-target{margin-left:18px}.ce-hidden-grid{grid-template-columns:1fr}.ce-tools .ce-secondary{display:none}}
  `;
  document.head.appendChild(style);

  const oldLayout=$('#hdLayoutBtn'),oldCorr=$('#hdCorrectionsBtn');if(oldLayout)oldLayout.remove();if(oldCorr)oldCorr.remove();
  const top=$('.top-actions');
  if(top&&!$('#catalogEditorButton')){
    const fit=$('#fitBtn');
    const btn=document.createElement('button');btn.id='catalogEditorButton';btn.className='btn primary';btn.innerHTML='Редактор каталога <span class="ce-top-badge">0</span>';
    fit?.parentNode?.insertBefore(btn,fit);
  }

  document.body.insertAdjacentHTML('beforeend',`<section id="catalogEditor" class="hidden">
    <div class="ce-top">
      <div class="ce-top-title"><b>Редактор каталога</b><span>Порядок страниц, развороты и правки в одном месте</span></div>
      <div class="ce-tabs"><button id="ceTabLayout" class="active">Монтаж</button><button id="ceTabCorrections">Правки <span class="ce-badge" id="ceCorrectionBadge">0</span></button></div>
      <div class="ce-tools"><button class="ce-secondary" id="ceUndo">↶ Отменить</button><button class="ce-secondary" id="ceRedo">↷ Вернуть</button><button id="ceCopy">Скопировать ТЗ</button><button class="ce-primary" id="ceApply">Применить и посмотреть</button></div>
      <button class="ce-close" id="ceClose">×</button>
    </div>
    <div class="ce-shell"><main id="ceMain" class="ce-main"></main><aside id="ceInspector" class="ce-inspector"></aside></div>
    <div id="ceToast"></div>
  </section>`);

  $('#catalogEditorButton').onclick=()=>{$('#catalogEditor').classList.remove('hidden');render()};
  $('#ceClose').onclick=()=>$('#catalogEditor').classList.add('hidden');
  $('#ceApply').onclick=()=>{persist();location.reload()};
  $('#ceTabLayout').onclick=()=>{tab='layout';render()};
  $('#ceTabCorrections').onclick=()=>{tab='corrections';moveId=null;render()};
  $('#ceUndo').onclick=undo;$('#ceRedo').onclick=redo;$('#ceCopy').onclick=copyBrief;

  persist();updateBadge();
})();