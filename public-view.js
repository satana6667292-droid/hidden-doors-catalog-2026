(()=>{
  const raw=(window.CATALOG_EDITOR_BASE?.length?window.CATALOG_EDITOR_BASE:(window.CATALOG_DATA?.pages||[]))
    .filter(p=>p.included!==false)
    .sort((a,b)=>(a.order??999)-(b.order??999)||(a.physicalIndex??a.id)-(b.physicalIndex??b.id));
  if(!raw.length)return;

  const byId=new Map(raw.map(p=>[Number(p.physicalIndex??p.id),p]));
  const pid=p=>Number(p.physicalIndex??p.id);
  const fullSrc=p=>{
    const t=String(p.page||p.src||p.image||p.thumb||'');
    return t.includes('/thumbs/')?t.replace('/thumbs/','/pages/'):t;
  };
  const thumbSrc=p=>p.thumb||fullSrc(p);

  function buildSpreads(){
    const visible=[...raw];
    const cover=visible.find(p=>pid(p)===1)||visible[0];
    const out=[{cover:true,pages:[cover]}];
    const rest=visible.filter(p=>p!==cover);
    for(let i=0;i<rest.length;){
      const p=rest[i];
      if(p.pairWithNext&&rest[i+1]){out.push({pages:[p,rest[i+1]]});i+=2}
      else{out.push({pages:[p]});i+=1}
    }
    return out;
  }
  const spreads=buildSpreads();

  const sections=[
    {key:'all',label:'Все',test:()=>true},
    {key:'36',label:'36 мм',test:p=>{const n=parseInt(p.label,10);return n>=4&&n<=21}},
    {key:'42',label:'42 мм',test:p=>{const n=parseInt(p.label,10);return n>=22&&n<=29}},
    {key:'59',label:'59 мм',test:p=>{const n=parseInt(p.label,10);return n>=30&&n<=39}},
    {key:'panels',label:'Панели',test:p=>{const n=parseInt(p.label,10);return n>=40&&n<=41}},
    {key:'final',label:'Контакты',test:p=>{const n=parseInt(p.label,10);return n>=42}}
  ];

  let spreadIndex=0, mode='spread', zoom=1;

  document.body.classList.add('hd-public-view');
  const root=document.createElement('div');
  root.id='hdCatalogPublic';
  root.innerHTML=`
    <header class="hdp-header">
      <a class="hdp-brand" href="../" aria-label="Hidden Doors — на главную">
        <span class="hdp-mark">H</span>
        <span><b>HIDDEN DOORS</b><small>Каталог 2026</small></span>
      </a>
      <nav class="hdp-sections" aria-label="Разделы каталога"></nav>
      <div class="hdp-head-actions">
        <button class="hdp-ghost" id="hdpContents">Содержание</button>
        <div class="hdp-view-toggle" role="group" aria-label="Вид каталога">
          <button data-mode="spread" class="active">Развороты</button>
          <button data-mode="grid">Все страницы</button>
        </div>
        <button class="hdp-editor" id="hdpEditor">Редактор</button>
      </div>
    </header>

    <main class="hdp-main">
      <section class="hdp-toolbar">
        <div>
          <span class="hdp-kicker">HIDDEN DOORS / КАТАЛОГ 2026</span>
          <h1 id="hdpTitle">Каталог дверей Hidden Doors</h1>
        </div>
        <div class="hdp-progress"><b id="hdpCount"></b><span id="hdpPages"></span></div>
      </section>

      <section id="hdpSpreadView" class="hdp-spread-view">
        <button class="hdp-arrow prev" id="hdpPrev" aria-label="Предыдущий разворот">‹</button>
        <div class="hdp-spread" id="hdpSpread"></div>
        <button class="hdp-arrow next" id="hdpNext" aria-label="Следующий разворот">›</button>
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
        <div><b id="hdpLightTitle">Страница</b><span>Кликните и перетаскивайте область при увеличении</span></div>
        <div class="hdp-light-tools">
          <button id="hdpZoomOut">−</button><span id="hdpZoomText">100%</span><button id="hdpZoomIn">＋</button>
          <button id="hdpZoomFit">По размеру</button><button id="hdpLightClose" class="close">×</button>
        </div>
      </div>
      <div class="hdp-light-stage"><img id="hdpLightImg" alt=""></div>
    </div>`;
  document.body.appendChild(root);

  const $=q=>root.querySelector(q);
  const $$=q=>[...root.querySelectorAll(q)];

  function spreadForPage(page){
    return spreads.findIndex(s=>s.pages.some(p=>pid(p)===pid(page)));
  }
  function currentSpread(){return spreads[Math.max(0,Math.min(spreadIndex,spreads.length-1))]}
  function pageMarkup(p,side=''){
    return `<article class="hdp-page" data-id="${pid(p)}">
      <button class="hdp-page-open" data-open="${pid(p)}" aria-label="Увеличить страницу ${p.label}">
        <img src="${fullSrc(p)}" alt="${String(p.title||'').replace(/"/g,'&quot;')}" loading="eager">
      </button>
      <div class="hdp-page-caption"><span>${p.label}</span><b>${p.title||''}</b>${side?`<small>${side}</small>`:''}</div>
    </article>`;
  }
  function renderSpread(){
    const s=currentSpread();
    const single=s.pages.length===1;
    $('#hdpSpread').className='hdp-spread '+(single?'single':'double')+(s.cover?' cover':'');
    $('#hdpSpread').innerHTML=s.pages.map((p,i)=>pageMarkup(p,s.cover?'обложка':(i===0?'левая':'правая'))).join('');
    const titles=s.pages.map(p=>p.title).filter(Boolean);
    $('#hdpTitle').textContent=s.cover?'Каталог Hidden Doors 2026':titles.join(' / ');
    $('#hdpCount').textContent=`${spreadIndex+1} / ${spreads.length}`;
    $('#hdpPages').textContent=s.pages.length===1?`страница ${s.pages[0].label}`:`страницы ${s.pages.map(p=>p.label).join('–')}`;
    $('#hdpPrev').disabled=spreadIndex===0;
    $('#hdpNext').disabled=spreadIndex===spreads.length-1;
    bindPageOpen();
  }
  function renderGrid(){
    $('#hdpGridView').innerHTML=raw.map(p=>pageMarkup(p)).join('');
    bindPageOpen();
  }
  function renderSections(){
    const nav=$('.hdp-sections');
    nav.innerHTML=sections.filter(x=>x.key!=='all').map(x=>`<button data-section="${x.key}">${x.label}</button>`).join('');
    nav.onclick=e=>{
      const b=e.target.closest('[data-section]');if(!b)return;
      const sec=sections.find(x=>x.key===b.dataset.section);
      const page=raw.find(sec.test);if(!page)return;
      mode='spread';setModeButtons();spreadIndex=Math.max(0,spreadForPage(page));renderSpread();
      window.scrollTo({top:0,behavior:'smooth'});
    };
  }
  function renderDrawer(){
    const groups=sections.filter(s=>s.key!=='all').map(sec=>({sec,pages:raw.filter(sec.test)})).filter(g=>g.pages.length);
    $('#hdpDrawerList').innerHTML=groups.map(g=>`<section><h3>${g.sec.label}</h3>${g.pages.map(p=>`
      <button class="hdp-drawer-item" data-jump="${pid(p)}">
        <img src="${thumbSrc(p)}" alt="">
        <span><b>${p.label} · ${p.title}</b><small>Открыть страницу</small></span>
      </button>`).join('')}</section>`).join('');
    $('#hdpDrawerList').onclick=e=>{
      const b=e.target.closest('[data-jump]');if(!b)return;
      const page=byId.get(Number(b.dataset.jump));if(!page)return;
      spreadIndex=Math.max(0,spreadForPage(page));mode='spread';setModeButtons();renderSpread();closeDrawer();
    };
  }
  function openDrawer(){root.classList.add('drawer-open');$('#hdpDrawer').setAttribute('aria-hidden','false')}
  function closeDrawer(){root.classList.remove('drawer-open');$('#hdpDrawer').setAttribute('aria-hidden','true')}
  function setModeButtons(){
    $$('.hdp-view-toggle button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $('#hdpSpreadView').classList.toggle('hidden',mode!=='spread');
    $('#hdpGridView').classList.toggle('hidden',mode!=='grid');
    if(mode==='grid')renderGrid();else renderSpread();
  }

  function openLight(page){
    zoom=1;
    $('#hdpLightTitle').textContent=`${page.label} · ${page.title}`;
    $('#hdpLightImg').src=fullSrc(page);
    $('#hdpLightbox').classList.remove('hidden');
    document.body.classList.add('hdp-no-scroll');
    updateZoom();
  }
  function closeLight(){$('#hdpLightbox').classList.add('hidden');document.body.classList.remove('hdp-no-scroll')}
  function updateZoom(){
    $('#hdpZoomText').textContent=`${Math.round(zoom*100)}%`;
    $('#hdpLightImg').style.width=`${Math.round(Math.min(2400,1200*zoom))}px`;
  }
  function bindPageOpen(){
    $$('[data-open]').forEach(b=>b.onclick=()=>{const p=byId.get(Number(b.dataset.open));if(p)openLight(p)});
  }

  $('#hdpPrev').onclick=()=>{if(spreadIndex>0){spreadIndex--;renderSpread();window.scrollTo({top:0,behavior:'smooth'})}};
  $('#hdpNext').onclick=()=>{if(spreadIndex<spreads.length-1){spreadIndex++;renderSpread();window.scrollTo({top:0,behavior:'smooth'})}};
  $('#hdpContents').onclick=openDrawer;$('#hdpDrawerClose').onclick=closeDrawer;$('#hdpShade').onclick=closeDrawer;
  $$('.hdp-view-toggle button').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;setModeButtons()});
  $('#hdpEditor').onclick=()=>document.querySelector('#catalogEditorButton')?.click();
  $('#hdpLightClose').onclick=closeLight;$('#hdpZoomOut').onclick=()=>{zoom=Math.max(.5,zoom-.25);updateZoom()};$('#hdpZoomIn').onclick=()=>{zoom=Math.min(2.5,zoom+.25);updateZoom()};$('#hdpZoomFit').onclick=()=>{zoom=1;updateZoom()};
  document.addEventListener('keydown',e=>{
    if(!$('#hdpLightbox').classList.contains('hidden')){if(e.key==='Escape')closeLight();return}
    if(root.classList.contains('drawer-open')&&e.key==='Escape'){closeDrawer();return}
    if(mode==='spread'&&e.key==='ArrowLeft'&&spreadIndex>0){spreadIndex--;renderSpread()}
    if(mode==='spread'&&e.key==='ArrowRight'&&spreadIndex<spreads.length-1){spreadIndex++;renderSpread()}
  });

  renderSections();renderDrawer();renderSpread();
})();