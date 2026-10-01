(()=>{
  const MEDIA_KEY='hiddenDoorsCatalog2026.media.v1';
  const DB_NAME='hiddenDoorsCatalogAssets';
  const DB_STORE='assets';
  const objectUrls=new Map();
  let viewerPageId=null;
  let zoom=1;

  const $=q=>document.querySelector(q);
  const $$=q=>[...document.querySelectorAll(q)];

  function loadMedia(){
    try{
      const v=JSON.parse(localStorage.getItem(MEDIA_KEY)||'null');
      if(v&&v.pages)return v;
    }catch{}
    return {version:1,pages:{}};
  }
  function saveMedia(v){
    try{localStorage.setItem(MEDIA_KEY,JSON.stringify(v))}catch{}
  }
  function pageMedia(id,create=false){
    const m=loadMedia(),key=String(id);
    if(create&&!m.pages[key])m.pages[key]={images:[]};
    return {root:m,page:m.pages[key]||{images:[]},key};
  }
  function selectedId(){
    const c=$('.ce-card.selected');
    return c?Number(c.dataset.id):null;
  }
  function selectedCard(id=selectedId()){
    return id?document.querySelector(`.ce-card[data-id="${id}"]`):null;
  }
  function pageInfo(id){
    const c=selectedCard(id);
    if(!c)return {id,label:String(id),title:'Страница',src:''};
    const label=c.querySelector('.ce-num')?.textContent?.trim()||String(id);
    const title=c.querySelector('.ce-body>b')?.textContent?.trim()||'Страница';
    const thumb=c.querySelector('.ce-img img')?.getAttribute('src')||'';
    const src=thumb.replace('/thumbs/','/pages/');
    return {id,label,title,src};
  }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const q=indexedDB.open(DB_NAME,1);
      q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(DB_STORE))q.result.createObjectStore(DB_STORE)};
      q.onsuccess=()=>resolve(q.result);
      q.onerror=()=>reject(q.error);
    });
  }
  async function putAsset(id,file){
    const db=await openDb();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(DB_STORE,'readwrite');
      tx.objectStore(DB_STORE).put(file,id);
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
    db.close();
  }
  async function getAsset(id){
    const db=await openDb();
    const result=await new Promise((resolve,reject)=>{
      const q=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(id);
      q.onsuccess=()=>resolve(q.result||null);
      q.onerror=()=>reject(q.error);
    });
    db.close();
    return result;
  }
  async function deleteAsset(id){
    try{
      const db=await openDb();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(DB_STORE,'readwrite');
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
      db.close();
    }catch{}
    const u=objectUrls.get(id);
    if(u){URL.revokeObjectURL(u);objectUrls.delete(id)}
  }
  async function assetUrl(id){
    if(objectUrls.has(id))return objectUrls.get(id);
    const blob=await getAsset(id);
    if(!blob)return '';
    const u=URL.createObjectURL(blob);
    objectUrls.set(id,u);
    return u;
  }
  function dimensions(file){
    return new Promise(resolve=>{
      const u=URL.createObjectURL(file),im=new Image();
      im.onload=()=>{resolve({w:im.naturalWidth||1,h:im.naturalHeight||1});URL.revokeObjectURL(u)};
      im.onerror=()=>{resolve({w:1,h:1});URL.revokeObjectURL(u)};
      im.src=u;
    });
  }

  function ensureUi(){
    if($('#ceMediaViewer'))return;
    const st=document.createElement('style');
    st.textContent=`
      .ce-media-clickable{cursor:zoom-in!important}
      .ce-addon-photo{font-size:9px;font-weight:800;border-radius:99px;padding:4px 7px;background:#e9f3ff;color:#326eae;margin-left:5px}
      .ce-assets{padding:12px 0;border-bottom:1px solid #eee;display:grid;gap:8px}.ce-assets-head b{display:block;font-size:11px}.ce-assets-head span{display:block;font-size:9px;color:#777;margin-top:3px;line-height:1.35}.ce-upload-image{border:1px dashed #82c96a!important;background:#f1faee!important;color:#3f8d2d!important;border-radius:9px;padding:10px;font-weight:900;cursor:pointer}.ce-local-note{font-size:8px;color:#777;line-height:1.35}
      .ce-asset-list,.ce-addon-list{display:grid;gap:5px;margin-top:6px}.ce-asset-row,.ce-addon-row{display:grid;grid-template-columns:1fr auto auto;gap:5px;align-items:center;border:1px solid #eee;border-radius:8px;padding:6px}.ce-asset-row span,.ce-addon-row span{min-width:0}.ce-asset-row b,.ce-addon-row b{display:block;font-size:9px;max-width:155px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ce-asset-row small,.ce-addon-row small{display:block;font-size:8px;color:#777}.ce-asset-row button,.ce-addon-row button{border:1px solid #ddd;background:#fff;border-radius:6px;padding:5px 7px;font-size:8px;font-weight:800;cursor:pointer}.ce-asset-row .danger,.ce-addon-row .danger{color:#b64242}
      #ceMediaViewer{position:fixed;inset:0;z-index:1500;background:#151615f5;color:#fff;display:grid;grid-template-rows:64px 1fr}#ceMediaViewer.hidden{display:none}
      .cem-top{display:flex;align-items:center;gap:12px;padding:0 16px;background:#202120;border-bottom:1px solid #ffffff1c}.cem-title{min-width:0;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cem-help{font-size:10px;color:#aaa}.cem-zoom{margin-left:auto;display:flex;align-items:center;gap:5px}.cem-top button{border:0;border-radius:8px;padding:8px 10px;background:#353635;color:#fff;font-weight:800;cursor:pointer}.cem-top .close{background:#fff;color:#231f20}
      .cem-scroll{overflow:auto;padding:24px;display:flex;align-items:flex-start;justify-content:center}.cem-canvas{position:relative;aspect-ratio:297/210;background:#fff;box-shadow:0 18px 60px #0009;flex:0 0 auto}.cem-base{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.cem-layer{position:absolute;inset:0}
      .cem-overlay{position:absolute;border:2px solid #57c035;box-shadow:0 0 0 2px #fff9;cursor:move;touch-action:none;background:#fff2}.cem-overlay img{width:100%;height:100%;display:block;object-fit:contain;pointer-events:none}.cem-delete{position:absolute;right:-12px;top:-12px;width:26px;height:26px;border:0;border-radius:99px;background:#b33b3b;color:#fff;font-size:17px;font-weight:900;cursor:pointer}.cem-resize{position:absolute;right:-8px;bottom:-8px;width:18px;height:18px;border-radius:4px;background:#57c035;border:2px solid #fff;cursor:nwse-resize}
      .cem-empty{position:absolute;inset:0;display:grid;place-items:center;color:#777;font-size:13px}
      @media(max-width:900px){.cem-help{display:none}.cem-scroll{padding:10px}.cem-top{padding:0 8px}.cem-top button{padding:7px 8px}}
    `;
    document.head.appendChild(st);
    document.body.insertAdjacentHTML('beforeend',`
      <section id="ceMediaViewer" class="hidden">
        <div class="cem-top">
          <div class="cem-title" id="cemTitle">Страница</div>
          <div class="cem-help">Страницу можно увеличить. Загруженное фото — двигать мышкой и менять размер за зелёный угол.</div>
          <div class="cem-zoom"><button id="cemMinus">−</button><span id="cemZoom">100%</span><button id="cemPlus">＋</button><button id="cemFit">По размеру</button></div>
          <button id="cemClose" class="close">Закрыть</button>
        </div>
        <div class="cem-scroll"><div id="cemCanvas" class="cem-canvas"></div></div>
      </section>`);
    $('#cemClose').onclick=closeViewer;
    $('#cemMinus').onclick=()=>{zoom=Math.max(.5,zoom-.25);renderViewer()};
    $('#cemPlus').onclick=()=>{zoom=Math.min(2.5,zoom+.25);renderViewer()};
    $('#cemFit').onclick=()=>{zoom=1;renderViewer()};
  }

  function decorate(){
    ensureUi();
    $$('.ce-card').forEach(card=>{
      const id=Number(card.dataset.id),img=card.querySelector('.ce-img');
      if(img)img.classList.add('ce-media-clickable');
      const count=pageMedia(id).page.images?.length||0;
      let badge=card.querySelector('.ce-addon-photo');
      if(count&&!card.querySelector('.ce-photo-badge')){
        const meta=card.querySelector('.ce-meta-line')||card.querySelector('.ce-body');
        if(meta){
          if(!badge){badge=document.createElement('span');badge.className='ce-addon-photo';meta.appendChild(badge)}
          badge.textContent=`Фото: ${count}`;
        }
      }else if(badge){badge.remove()}
    });
    decorateInspector();
  }

  function decorateInspector(){
    const id=selectedId(),box=$('.ce-assets');
    if(!id||!box)return;
    box.querySelectorAll('.ce-asset-list').forEach(x=>x.style.display='none');
    const images=pageMedia(id).page.images||[];
    let wrap=box.querySelector('.ce-addon-list');
    const sig=JSON.stringify(images.map(im=>[im.id,im.name]));
    if(!images.length){if(wrap)wrap.remove();return}
    if(!wrap){wrap=document.createElement('div');wrap.className='ce-addon-list';box.appendChild(wrap)}
    if(wrap.dataset.sig!==sig){
      wrap.dataset.sig=sig;
      wrap.innerHTML=images.map(im=>`<div class="ce-addon-row" data-addon-image="${im.id}"><span><b>${escapeHtml(im.name||'Изображение')}</b><small>рабочее фото</small></span><button data-addon-open>Открыть</button><button data-addon-delete class="danger">Удалить</button></div>`).join('');
    }
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function canvasWidth(){
    return Math.round(Math.max(720,Math.min(1450,window.innerWidth-90))*zoom);
  }
  async function renderViewer(){
    ensureUi();
    const info=pageInfo(viewerPageId),pm=pageMedia(viewerPageId).page;
    $('#cemTitle').textContent=`${info.label} · ${info.title}`;
    $('#cemZoom').textContent=`${Math.round(zoom*100)}%`;
    const canvas=$('#cemCanvas');
    canvas.style.width=canvasWidth()+'px';
    canvas.innerHTML=`<img class="cem-base" src="${info.src}" alt=""><div class="cem-layer">${(pm.images||[]).map(im=>`<div class="cem-overlay" data-img="${im.id}" style="left:${(im.x||0)*100}%;top:${(im.y||0)*100}%;width:${(im.w||.4)*100}%;height:${(im.h||.4)*100}%"><img data-asset="${im.assetId}" alt=""><button class="cem-delete" title="Удалить">×</button><span class="cem-resize" title="Изменить размер"></span></div>`).join('')}</div>`;
    for(const img of canvas.querySelectorAll('img[data-asset]')){
      const u=await assetUrl(img.dataset.asset);if(u)img.src=u;
    }
    wireOverlays();
  }
  function openViewer(id){
    if(!id)return;
    ensureUi();
    viewerPageId=Number(id);zoom=1;
    $('#ceMediaViewer').classList.remove('hidden');
    renderViewer();
  }
  function closeViewer(){
    viewerPageId=null;
    $('#ceMediaViewer')?.classList.add('hidden');
  }

  function wireOverlays(){
    const canvas=$('#cemCanvas'),{root,page,key}=pageMedia(viewerPageId,true);
    canvas.querySelectorAll('.cem-overlay').forEach(el=>{
      const im=(page.images||[]).find(x=>x.id===el.dataset.img);if(!im)return;
      el.querySelector('.cem-delete').onclick=e=>{
        e.stopPropagation();deleteAsset(im.assetId);
        page.images=page.images.filter(x=>x.id!==im.id);root.pages[key]=page;saveMedia(root);
        renderViewer();decorate();
      };
      const begin=(e,resize)=>{
        if(e.target.closest('.cem-delete'))return;
        e.preventDefault();e.stopPropagation();
        const rect=canvas.getBoundingClientRect(),sx=e.clientX,sy=e.clientY;
        const ox=im.x||0,oy=im.y||0,ow=im.w||.4,oh=im.h||.4,ratio=ow/Math.max(.001,oh);
        const move=ev=>{
          if(resize){
            const nw=Math.max(.08,Math.min(.95-ox,ow+(ev.clientX-sx)/rect.width));
            const nh=Math.max(.06,Math.min(.95-oy,nw/Math.max(.01,ratio)));
            im.w=nw;im.h=nh;
          }else{
            im.x=Math.max(0,Math.min(1-ow,ox+(ev.clientX-sx)/rect.width));
            im.y=Math.max(0,Math.min(1-oh,oy+(ev.clientY-sy)/rect.height));
          }
          el.style.left=(im.x*100)+'%';el.style.top=(im.y*100)+'%';el.style.width=(im.w*100)+'%';el.style.height=(im.h*100)+'%';
        };
        const up=()=>{
          window.removeEventListener('pointermove',move);
          root.pages[key]=page;saveMedia(root);decorate();
        };
        window.addEventListener('pointermove',move);
        window.addEventListener('pointerup',up,{once:true});
      };
      el.addEventListener('pointerdown',e=>{if(!e.target.closest('.cem-resize'))begin(e,false)});
      el.querySelector('.cem-resize').addEventListener('pointerdown',e=>begin(e,true));
    });
  }

  async function addImage(id,file){
    if(!id||!file)return;
    const dims=await dimensions(file);
    const assetId='asset-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    const imageId='img-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    await putAsset(assetId,file);
    const ar=(dims.w||1)/(dims.h||1),w=.42,h=Math.min(.72,w*(297/210)/Math.max(.01,ar));
    const {root,page,key}=pageMedia(id,true);
    page.images=Array.isArray(page.images)?page.images:[];
    page.images.push({id:imageId,assetId,name:file.name||'image',x:.08,y:.12,w,h,ratio:ar});
    root.pages[key]=page;saveMedia(root);
    decorate();
    openViewer(id);
  }
  function removeImage(id,imageId){
    const {root,page,key}=pageMedia(id,true);
    const im=(page.images||[]).find(x=>x.id===imageId);if(im)deleteAsset(im.assetId);
    page.images=(page.images||[]).filter(x=>x.id!==imageId);
    root.pages[key]=page;saveMedia(root);decorate();
  }

  // Event delegation survives editor re-renders.
  document.addEventListener('click',e=>{
    const card=e.target.closest('.ce-card');
    if(card&&e.target.closest('.ce-img')){
      e.preventDefault();e.stopPropagation();openViewer(Number(card.dataset.id));return;
    }
    if(e.target.closest('#ceOpenLarge')){
      e.preventDefault();openViewer(selectedId());return;
    }
    if(e.target.closest('#ceUploadImage')){
      e.preventDefault();$('#ceImageUpload')?.click();return;
    }
    const open=e.target.closest('[data-addon-open]');
    if(open){e.preventDefault();openViewer(selectedId());return}
    const del=e.target.closest('[data-addon-delete]');
    if(del){e.preventDefault();const row=del.closest('[data-addon-image]');removeImage(selectedId(),row.dataset.addonImage);return}
  },true);

  document.addEventListener('change',async e=>{
    if(e.target?.id!=='ceImageUpload')return;
    const f=e.target.files?.[0],id=selectedId();
    if(f&&id)await addImage(id,f);
    e.target.value='';
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!$('#ceMediaViewer')?.classList.contains('hidden')){closeViewer();e.stopPropagation()}
  },true);

  let decorateQueued=false;
  const mo=new MutationObserver(()=>{
    if(decorateQueued)return;
    decorateQueued=true;
    requestAnimationFrame(()=>{
      decorateQueued=false;
      mo.disconnect();
      try{decorate()}finally{mo.observe(document.body,{childList:true,subtree:true})}
    });
  });
  ensureUi();decorate();
  mo.observe(document.body,{childList:true,subtree:true});
})();