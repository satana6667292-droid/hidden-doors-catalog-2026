(()=>{
  const master=window.CATALOG_PUBLIC_MASTER;
  const raw=(master?.visiblePages||[]).slice();
  if(!raw.length)return;

  const pid=p=>Number(p.physicalIndex??p.id);
  const pad=n=>String(n).padStart(3,'0');
  const ASSET_V='master36-no-second-numbering';;;;;;;;
  const pageSrc=p=>`assets/pages/page-${pad(pid(p))}.webp?v=${ASSET_V}`;
  const thumbSrc=p=>`assets/thumbs/page-${pad(pid(p))}.webp?v=${ASSET_V}`;
  const byId=new Map(raw.map(p=>[pid(p),p]));
  const publicNum=p=>p.catalogNumber||String((raw.indexOf(p)+1)).padStart(2,'0');
  const isMobile=()=>window.matchMedia('(max-width:760px)').matches;

  function buildSpreads(){
    const cover=raw.find(p=>pid(p)===1)||raw[0];
    const out=[{cover:true,pages:[cover]}];
    const rest=raw.filter(p=>p!==cover);
    for(let i=0;i<rest.length;){
      const p=rest[i];
      if(p.pairWithNext&&rest[i+1]){out.push({pages:[p,rest[i+1]]});i+=2}
      else{out.push({pages:[p]});i+=1}
    }
    return out;
  }
  const spreads=buildSpreads();
  const pageIndex=new Map(raw.map((p,i)=>[pid(p),i]));
  const spreadIndexByPage=new Map();
  spreads.forEach((s,i)=>s.pages.forEach(p=>spreadIndexByPage.set(pid(p),i)));

  const originalNumber=p=>parseInt(String(p.sourceLabel??p.label),10);
  const sections=[
    {key:'36',label:'36 мм',test:p=>{const n=originalNumber(p);return n>=4&&n<=21}},
    {key:'42',label:'42 мм',test:p=>{const n=originalNumber(p);return n>=22&&n<=29}},
    {key:'59',label:'59 мм',test:p=>{const n=originalNumber(p);return n>=30&&n<=39}},
    {key:'panels',label:'Панели',test:p=>{const n=originalNumber(p);return n>=40&&n<=41}},
    {key:'final',label:'Контакты',test:p=>{const n=originalNumber(p);return n>=42}}
  ];

  const numForSource=label=>{
    const p=raw.find(x=>String(x.sourceLabel??x.label)===String(label));
    return p?publicNum(p):'—';
  };
  const range=(a,b)=>`${numForSource(a)}–${numForSource(b)}`;

  let spreadIndex=0;
  let mobileIndex=0;
  let mode='spread';
  let lightScale=1;
  let lightBaseWidth=0;
  let lightPage=null;

  document.body.classList.add('hd-public-view');
  const root=document.createElement('div');
  root.id='hdCatalogPublic';
  root.innerHTML=`
    <header class="hdp-header">
      <a class="hdp-brand" href="../" aria-label="Hidden Doors — на главную">
        <img src="../assets/logo.png" alt="Hidden Doors" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="hdp-brand-fallback"><b>HIDDEN DOORS</b><small>Каталог 2026</small></span>
      </a>
      <nav class="hdp-sections" aria-label="Разделы каталога"></nav>
      <div class="hdp-head-actions">
        <button class="hdp-ghost" id="hdpContents">Содержание</button>
        <div class="hdp-view-toggle" role="group" aria-label="Вид каталога">
          <button data-mode="spread" class="active">Развороты</button>
          <button data-mode="grid">Все страницы</button>
        </div>
      </div>
    </header>

    <main class="hdp-main">
      <section class="hdp-toolbar hdp-toolbar-compact">
        <div class="hdp-progress"><b id="hdpCount"></b><span id="hdpPages"></span></div>
      </section>

      <section id="hdpSpreadView" class="hdp-spread-view">
        <button class="hdp-arrow prev" id="hdpPrev" aria-label="Назад">‹</button>
        <div class="hdp-spread" id="hdpSpread"></div>
        <button class="hdp-arrow next" id="hdpNext" aria-label="Вперёд">›</button>
      </section>

      <section id="hdpGridView" class="hdp-grid-view hidden"></section>
    </main>

    <aside class="hdp-drawer" id="hdpDrawer" aria-hidden="true">
      <div class="hdp-drawer-head"><div><b>Содержание</b><span>Перейти к нужной странице</span></div><button id="hdpDrawerClose">×</button></div>
      <div class="hdp-drawer-list" id="hdpDrawerList"></div>
    </aside>
    <div class="hdp-drawer-shade" id="hdpShade"></div>

    <div class="hdp-lightbox hidden" id="hdpLightbox">
      <div class="hdp-lightbox-head">
        <div><b id="hdpLightTitle">Страница</b><span>Увеличивайте и перетаскивайте страницу мышкой</span></div>
        <div class="hdp-light-tools">
          <button id="hdpZoomOut">−</button><span id="hdpZoomText">Вписано</span><button id="hdpZoomIn">＋</button>
          <button id="hdpZoomActual">100%</button><button id="hdpZoomFit">Вписать</button><button id="hdpLightClose" class="close">×</button>
        </div>
      </div>
      <div class="hdp-light-stage" id="hdpLightStage">
        <img id="hdpLightImg" alt="">
        <div id="hdpLightLive" class="hdp-light-live hidden"></div>
      </div>
    </div>`;
  document.body.appendChild(root);

  const $=q=>root.querySelector(q);
  const $$=q=>[...root.querySelectorAll(q)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const isCollectionPage=p=>String(p?.templateType||'').startsWith('collection-');

  // FOLIO MASTER v1 is baked into generated page assets during deploy.
  const folioMarkup=()=>''; 
  const legacyRepairMarkup=p=>{
    if(pid(p)!==36)return '';
    return `<span class="hdp-p36-work-mask" aria-hidden="true"></span>
      <span class="hdp-p36-edge hdp-p36-edge-main" aria-hidden="true"></span>
      <span class="hdp-p36-edge hdp-p36-edge-thumb" aria-hidden="true"></span>`;
  }; 

  function standardSheetMarkup(p,useThumb=false){
    const src=useThumb?thumbSrc(p):pageSrc(p);
    return `<div class="hdp-folio-sheet hdp-standard-sheet" data-folio-sheet="${pid(p)}">
      <img class="hdp-sheet-base" src="${src}" alt="${esc(p.title)}" loading="${useThumb?'lazy':'eager'}" crossorigin="anonymous">
      ${legacyRepairMarkup(p)}
      ${folioMarkup(p)}
    </div>`;
  }

  function collectionSheetMarkup(p,useThumb=false){
    const side=p.templateSide==='right'?'right':'left';
    const models=p.templateType==='collection-models';
    const src=useThumb?thumbSrc(p):pageSrc(p);
    const techMask=p.hideTopNote?'<span class="hdp-collection-tech-mask" aria-hidden="true"></span>':'';
    return `<div class="hdp-folio-sheet hdp-collection-sheet ${models?'is-models':'is-interior'} side-${side}" data-folio-sheet="${pid(p)}" data-collection-sheet="${pid(p)}">
      <img class="hdp-sheet-base hdp-collection-base" src="${src}" alt="${esc(p.title)}" loading="${useThumb?'lazy':'eager'}" crossorigin="anonymous">
      ${legacyRepairMarkup(p)}
      ${techMask}
      ${folioMarkup(p)}
    </div>`;
  }

  function prepareFolioSheets(scope=root){
    scope.querySelectorAll?.('[data-folio-sheet]').forEach(sheet=>{
      const img=sheet.querySelector('.hdp-sheet-base');
      if(!img||!sheet.classList.contains('hdp-collection-sheet'))return;
      const apply=()=>{
        if(!img.naturalWidth||!img.naturalHeight)return;
        try{
          const c=document.createElement('canvas');c.width=1;c.height=1;
          const ctx=c.getContext('2d',{willReadFrequently:true});
          const side=sheet.classList.contains('side-right')?'right':'left';
          const topX=Math.round(img.naturalWidth*(side==='left'?.35:.65));
          const topY=Math.round(img.naturalHeight*.055);
          ctx.drawImage(img,topX,topY,1,1,0,0,1,1);
          const [tr,tg,tb]=ctx.getImageData(0,0,1,1).data;
          sheet.style.setProperty('--collection-bg',`rgb(${tr} ${tg} ${tb})`);
          sheet.dataset.bgReady='1';
        }catch(_){
          sheet.style.setProperty('--collection-bg','#f8f7f3');
        }
      };
      if(img.complete)apply(); else img.addEventListener('load',apply,{once:true});
    });
  }

  function contentsHtml(){
    return `
      <div class="hdp-live-sheet hdp-toc-sheet">
        <div class="hdp-live-logo"><img src="../assets/logo.png" alt="Hidden Doors"></div>
        <div class="hdp-live-rule"></div>
        <h2>Содержание</h2>
        <p class="hdp-live-subtitle">Навигация по каталогу Hidden Doors 2026</p>

        <div class="hdp-toc-grid">
          <section class="hdp-toc-card">
            <div class="hdp-toc-head"><strong>36</strong><b>36 мм</b></div>
            <div class="hdp-toc-rows">
              <div class="hdp-toc-row"><em>${numForSource('04')}</em><span>Размеры и комплектация</span></div>
              <div class="hdp-toc-row"><em>${numForSource('05')}</em><span>Конструкция полотна и погонаж</span></div>
              <div class="hdp-toc-row"><em>${range('06','13')}</em><span>MODENA · SIENA · LUCCA · AXIS</span></div>
              <div class="hdp-toc-row"><em>${range('14','21')}</em><span>VECTOR · RHYTHM · ARC · FLUTE</span></div>
            </div>
          </section>

          <section class="hdp-toc-card">
            <div class="hdp-toc-head"><strong>42</strong><b>42 мм</b></div>
            <div class="hdp-toc-rows">
              <div class="hdp-toc-row"><em>${numForSource('22')}</em><span>Конструкция и размеры</span></div>
              <div class="hdp-toc-row"><em>${numForSource('23')}</em><span>Покрытия и комплектация</span></div>
              <div class="hdp-toc-row"><em>${range('26','27')}</em><span>Двустворчатая дверь</span></div>
              <div class="hdp-toc-row"><em>${range('28','29')}</em><span>Откатная дверь</span></div>
            </div>
          </section>

          <section class="hdp-toc-plain hdp-toc-wide">
            <div class="hdp-toc-head"><strong>59</strong><b>59 мм</b></div>
            <div class="hdp-toc-rows hdp-toc-rows-2col">
              <div class="hdp-toc-row"><em>${numForSource('30')}</em><span>Конструкция, размеры и короб</span></div>
              <div class="hdp-toc-row"><em>${numForSource('35')}</em><span>Натуральный шпон</span></div>
              <div class="hdp-toc-row"><em>${numForSource('31')}</em><span>Интегрируемые материалы</span></div>
              <div class="hdp-toc-row"><em>${numForSource('36')}</em><span>Керамогранит</span></div>
              <div class="hdp-toc-row"><em>${numForSource('32')}</em><span>Зеркало и стекло</span></div>
              <div class="hdp-toc-row"><em>${numForSource('37')}</em><span>Искусственный камень</span></div>
              <div class="hdp-toc-row"><em>${numForSource('33')}</em><span>Бамбук</span></div>
              <div class="hdp-toc-row"><em>${numForSource('38')}</em><span>МДФ с фрезеровкой в плёнке</span></div>
              <div class="hdp-toc-row"><em>${numForSource('34')}</em><span>HPL-пластик</span></div>
              <div class="hdp-toc-row"><em>${numForSource('39')}</em><span>Комбинированное решение</span></div>
            </div>
          </section>

          <section class="hdp-toc-plain">
            <div class="hdp-toc-head"><strong>SP</strong><b>Стеновые панели</b></div>
            <div class="hdp-toc-rows">
              <div class="hdp-toc-row"><em>${numForSource('40')}</em><span>Материалы и конструктив</span></div>
              <div class="hdp-toc-row"><em>${numForSource('41')}</em><span>Интерьерные решения</span></div>
              <div class="hdp-toc-row"><em>${numForSource('42')}</em><span>Контакты / каталог / конфигуратор</span></div>
              <div class="hdp-toc-row"><em>${numForSource('43')}</em><span>Задняя обложка</span></div>
            </div>
          </section>
        </div>

        <div class="hdp-live-note">Нумерация соответствует текущей сборке каталога.</div>
        <div class="hdp-live-page-no">03</div>
      </div>`;
  }

  function imagePageMarkup(p,side='',useThumb=false){
    const sheet=isCollectionPage(p)?collectionSheetMarkup(p,useThumb):standardSheetMarkup(p,useThumb);
    return `<article class="hdp-page${isCollectionPage(p)?' hdp-page-collection':''}" data-id="${pid(p)}">
      <button class="hdp-page-open" data-open="${pid(p)}" aria-label="Увеличить страницу ${publicNum(p)}">
        ${sheet}
      </button>
      <div class="hdp-page-caption"><span>${publicNum(p)}</span><b>${esc(p.title)}</b></div>
    </article>`;
  }

  function livePageMarkup(p,side=''){
    return `<article class="hdp-page hdp-page-live" data-id="${pid(p)}">
      <button class="hdp-page-open" data-open="${pid(p)}" aria-label="Увеличить страницу ${publicNum(p)}">
        ${contentsHtml()}
      </button>
      <div class="hdp-page-caption"><span>${publicNum(p)}</span><b>${esc(p.title)}</b></div>
    </article>`;
  }

  function pageMarkup(p,side='',useThumb=false){
    return imagePageMarkup(p,side,useThumb);
  }

  function currentSpread(){return spreads[Math.max(0,Math.min(spreadIndex,spreads.length-1))]}
  function syncIndexesFromPage(p){
    mobileIndex=pageIndex.get(pid(p))??0;
    spreadIndex=spreadIndexByPage.get(pid(p))??0;
  }

  function renderReading(){
    if(mode!=='spread')return;
    if(isMobile()){
      const p=raw[Math.max(0,Math.min(mobileIndex,raw.length-1))];
      $('#hdpSpread').className='hdp-spread single mobile-single'+(pid(p)===1?' cover':'');
      $('#hdpSpread').innerHTML=pageMarkup(p,pid(p)===1?'обложка':'');
      void 0;
      $('#hdpCount').textContent=`${mobileIndex+1} / ${raw.length}`;
      $('#hdpPages').textContent=`страница ${publicNum(p)}`;
      $('#hdpPrev').disabled=mobileIndex===0;
      $('#hdpNext').disabled=mobileIndex===raw.length-1;
    }else{
      const s=currentSpread();
      const single=s.pages.length===1;
      $('#hdpSpread').className='hdp-spread '+(single?'single':'double')+(s.cover?' cover':'');
      $('#hdpSpread').innerHTML=s.pages.map((p,i)=>pageMarkup(p,s.cover?'обложка':(i===0?'левая':'правая'))).join('');
      const titles=s.pages.map(p=>p.title).filter(Boolean);
      void 0;
      $('#hdpCount').textContent=`${spreadIndex+1} / ${spreads.length}`;
      $('#hdpPages').textContent=s.pages.length===1?`страница ${publicNum(s.pages[0])}`:`страницы ${s.pages.map(publicNum).join('–')}`;
      $('#hdpPrev').disabled=spreadIndex===0;
      $('#hdpNext').disabled=spreadIndex===spreads.length-1;
    }
    bindPageOpen();
    prepareFolioSheets(root);
  }

  function renderGrid(){
    $('#hdpGridView').innerHTML=raw.map(p=>pageMarkup(p,'',true)).join('');
    bindPageOpen();
    prepareFolioSheets(root);
  }

  function jumpTo(page){
    syncIndexesFromPage(page);
    mode='spread';
    setModeButtons();
    renderReading();
    closeDrawer();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function renderSections(){
    const nav=$('.hdp-sections');
    nav.innerHTML=sections.map(x=>`<button data-section="${x.key}">${x.label}</button>`).join('');
    nav.onclick=e=>{
      const b=e.target.closest('[data-section]');if(!b)return;
      const sec=sections.find(x=>x.key===b.dataset.section);
      const page=raw.find(sec.test);if(page)jumpTo(page);
    };
  }

  function renderDrawer(){
    const groups=sections.map(sec=>({sec,pages:raw.filter(sec.test)})).filter(g=>g.pages.length);
    $('#hdpDrawerList').innerHTML=groups.map(g=>`<section><h3>${g.sec.label}</h3>${g.pages.map(p=>`
      <button class="hdp-drawer-item" data-jump="${pid(p)}">
        <img src="${thumbSrc(p)}" alt="">
        <span><b>${publicNum(p)} · ${esc(p.title)}</b><small>Открыть страницу</small></span>
      </button>`).join('')}</section>`).join('');
    $('#hdpDrawerList').onclick=e=>{
      const b=e.target.closest('[data-jump]');if(!b)return;
      const p=byId.get(Number(b.dataset.jump));if(p)jumpTo(p);
    };
  }

  function openDrawer(){root.classList.add('drawer-open');$('#hdpDrawer').setAttribute('aria-hidden','false')}
  function closeDrawer(){root.classList.remove('drawer-open');$('#hdpDrawer').setAttribute('aria-hidden','true')}

  function setModeButtons(){
    $$('.hdp-view-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $('#hdpSpreadView').classList.toggle('hidden',mode!=='spread');
    $('#hdpGridView').classList.toggle('hidden',mode!=='grid');
    if(mode==='grid')renderGrid();else renderReading();
  }

  function fitWidth(){
    const stage=$('#hdpLightStage');
    const pad=isMobile()?24:56;
    return Math.max(300,Math.min(stage.clientWidth-pad,(stage.clientHeight-pad)*(297/210)));
  }

  function updateLightWidth(label){
    if(!lightPage)return;
    const target=$('#hdpLightLive');
    target.style.width=`${Math.round(lightBaseWidth*lightScale)}px`;
    $('#hdpZoomText').textContent=label||`${Math.round(lightScale*100)}%`;
  }

  function setLightFit(){
    if(!lightPage)return;
    lightBaseWidth=fitWidth();lightScale=1;
    updateLightWidth('Вписано');
    const stage=$('#hdpLightStage');stage.scrollLeft=0;stage.scrollTop=0;
  }

  function setLightActual(){
    if(!lightPage)return;
    lightBaseWidth=1400;lightScale=1;updateLightWidth('100%');
  }

  function openLight(page){
    lightPage=page;
    $('#hdpLightTitle').textContent=`${publicNum(page)} · ${page.title}`;
    $('#hdpLightbox').classList.remove('hidden');
    document.body.classList.add('hdp-no-scroll');
    const img=$('#hdpLightImg'),live=$('#hdpLightLive');
    img.classList.add('hidden');img.removeAttribute('src');
    live.classList.remove('hidden');
    live.innerHTML=isCollectionPage(page)?collectionSheetMarkup(page,false):standardSheetMarkup(page,false);
    $('#hdpZoomOut').disabled=false;$('#hdpZoomIn').disabled=false;$('#hdpZoomActual').disabled=false;$('#hdpZoomFit').disabled=false;
    lightBaseWidth=fitWidth();lightScale=1;updateLightWidth('Вписано');
    requestAnimationFrame(()=>prepareFolioSheets(live));
  }

  function closeLight(){
    $('#hdpLightbox').classList.add('hidden');
    document.body.classList.remove('hdp-no-scroll');
    lightPage=null;
  }

  function bindPageOpen(){
    $$('[data-open]').forEach(b=>b.onclick=()=>{
      const p=byId.get(Number(b.dataset.open));if(p)openLight(p);
    });
  }

  function go(delta){
    if(mode!=='spread')return;
    if(isMobile()){
      const ni=mobileIndex+delta;if(ni<0||ni>=raw.length)return;
      mobileIndex=ni;spreadIndex=spreadIndexByPage.get(pid(raw[mobileIndex]))??spreadIndex;
    }else{
      const ni=spreadIndex+delta;if(ni<0||ni>=spreads.length)return;
      spreadIndex=ni;mobileIndex=pageIndex.get(pid(spreads[spreadIndex].pages[0]))??mobileIndex;
    }
    renderReading();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  $('#hdpPrev').onclick=()=>go(-1);
  $('#hdpNext').onclick=()=>go(1);
  $('#hdpContents').onclick=openDrawer;
  $('#hdpDrawerClose').onclick=closeDrawer;
  $('#hdpShade').onclick=closeDrawer;
  $$('.hdp-view-toggle button').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;setModeButtons()});
  $('#hdpLightClose').onclick=closeLight;
  $('#hdpZoomOut').onclick=()=>{lightScale=Math.max(.35,lightScale-.25);updateLightWidth()};
  $('#hdpZoomIn').onclick=()=>{lightScale=Math.min(4,lightScale+.25);updateLightWidth()};
  $('#hdpZoomFit').onclick=setLightFit;
  $('#hdpZoomActual').onclick=setLightActual;

  // Drag-to-pan in the enlarged view.
  const stage=$('#hdpLightStage');
  let pan=null;
  stage.addEventListener('pointerdown',e=>{
    if($('#hdpLightbox').classList.contains('hidden')||!lightPage)return;
    pan={x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove',e=>{
    if(!pan)return;
    stage.scrollLeft=pan.left-(e.clientX-pan.x);
    stage.scrollTop=pan.top-(e.clientY-pan.y);
  });
  const stopPan=()=>{pan=null;stage.classList.remove('dragging')};
  stage.addEventListener('pointerup',stopPan);stage.addEventListener('pointercancel',stopPan);

  // Swipe on mobile reading mode.
  let swipeX=null;
  $('#hdpSpread').addEventListener('pointerdown',e=>{if(isMobile())swipeX=e.clientX});
  $('#hdpSpread').addEventListener('pointerup',e=>{
    if(swipeX==null||!isMobile())return;
    const dx=e.clientX-swipeX;swipeX=null;
    if(Math.abs(dx)>60)go(dx<0?1:-1);
  });

  document.addEventListener('keydown',e=>{
    if(!$('#hdpLightbox').classList.contains('hidden')){if(e.key==='Escape')closeLight();return}
    if(root.classList.contains('drawer-open')&&e.key==='Escape'){closeDrawer();return}
    if(mode==='spread'&&e.key==='ArrowLeft')go(-1);
    if(mode==='spread'&&e.key==='ArrowRight')go(1);
  });

  let lastMobile=isMobile();
  window.addEventListener('resize',()=>{
    const now=isMobile();
    if(now!==lastMobile){
      const p=now?(currentSpread()?.pages?.[0]||raw[0]):raw[mobileIndex]||raw[0];
      syncIndexesFromPage(p);lastMobile=now;renderReading();
    }
    if(!$('#hdpLightbox').classList.contains('hidden')&&lightPage&&$('#hdpZoomText').textContent==='Вписано')setLightFit();
  });

  renderSections();
  renderDrawer();
  renderReading();
})();