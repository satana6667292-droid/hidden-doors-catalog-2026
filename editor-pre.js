(()=>{
  const base=window.CATALOG_DATA;
  if(!base?.pages)return;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const pages=clone(base.pages);

  // Published catalog baseline (already applied corrections).
  pages.forEach((p,i)=>{p.order=i+1;p.included=true;p.pairWithNext=false;});
  const hideLabels=new Set(['24','25']);
  pages.forEach(p=>{if(hideLabels.has(p.label))p.included=false;});
  const p28=pages.find(p=>p.label==='28'), p29=pages.find(p=>p.label==='29');
  if(p28&&p29){const t=p28.order;p28.order=p29.order;p29.order=t;}
  pages.sort((a,b)=>a.order-b.order||a.physicalIndex-b.physicalIndex).forEach((p,i)=>p.order=i+1);

  // Build spread pattern from current physical order, not from page identity.
  const visible=pages.filter(p=>p.included);
  visible.forEach(p=>p.pairWithNext=false);
  const rest=visible.filter(p=>p.physicalIndex!==1);
  for(let i=0;i<rest.length;i+=2){if(rest[i+1])rest[i].pairWithNext=true;}

  window.CATALOG_EDITOR_BASE=clone(pages);

  const KEY='hiddenDoorsCatalog2026.plan.v10';
  const OLD_KEYS=['hiddenDoorsCatalog2026.plan.v9','hiddenDoorsCatalog2026.plan.v8','hiddenDoorsCatalog2026.plan.v7','hiddenDoorsCatalog2026.plan.v6','hiddenDoorsCatalog2026.plan.v5','hiddenDoorsCatalog2026.plan.v4','hiddenDoorsCatalog2026.plan.v3','hiddenDoorsCatalog2026.plan.v2'];
  let plan=null;
  try{plan=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  if(!plan){
    for(const k of OLD_KEYS){
      try{
        const old=JSON.parse(localStorage.getItem(k)||'null');
        if(old?.pages?.length){
          plan={version:10,pages:old.pages.map(x=>{
            if(x.physicalIndex===28) return {...x,correctionType:'',correctionText:'',correctionId:''};
            return {...x};
          })};
          try{localStorage.setItem(KEY,JSON.stringify(plan))}catch{}
          break;
        }
      }catch{}
    }
  }

  const map=new Map((plan?.pages||[]).map(x=>[x.physicalIndex,x]));
  pages.forEach(p=>{
    if(p.physicalIndex===28){p.status='approved';p.statusText='Согласовано';}
    const q=map.get(p.physicalIndex);
    if(!q)return;
    ['order','included','pairWithNext','correctionType','correctionText','correctionId','images','status','statusText'].forEach(k=>{if(q[k]!==undefined)p[k]=q[k]});
  });

  let mediaDraft=null;try{mediaDraft=JSON.parse(localStorage.getItem('hiddenDoorsCatalog2026.media.v1')||'null')}catch{}
  if(mediaDraft?.pages){
    pages.forEach(p=>{const m=mediaDraft.pages[String(p.physicalIndex)];if(m?.images)p.images=m.images});
  }

  const approved27=pages.find(p=>p.physicalIndex===28);if(approved27){approved27.status='approved';approved27.statusText='Согласовано';approved27.correctionType='';approved27.correctionText='';approved27.correctionId='';}

  // Sanity: cover stays first; unique order; hidden applied pages stay hidden unless user explicitly restored them in v7 state.
  pages.sort((a,b)=>(a.order??999)-(b.order??999)||a.physicalIndex-b.physicalIndex);
  const cover=pages.find(p=>p.physicalIndex===1);
  if(cover){const i=pages.indexOf(cover);if(i>0){pages.splice(i,1);pages.unshift(cover)}}
  pages.forEach((p,i)=>p.order=i+1);

  window.CATALOG_EDITOR_BASE=clone(pages);
  window.CATALOG_DATA={...base,pages:pages.filter(p=>p.included!==false)};
  try{localStorage.setItem('hiddenDoorsCatalog2026.web.v01',JSON.stringify({pages:window.CATALOG_DATA.pages}))}catch{}
})();