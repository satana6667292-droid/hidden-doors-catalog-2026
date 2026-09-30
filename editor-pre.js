(()=>{
  const base=window.CATALOG_DATA;
  if(!base?.pages)return;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const full=clone(base.pages);

  // Согласованная базовая структура после ревизии 30.09.2026.
  // 24/25 (Classic/Reverse) скрыты; визуальная 29 идёт перед технической 28.
  full.forEach((p,i)=>{
    p.order=i+1;
    p.pairWithNext=p.pairWithNext ?? (i>0&&i%2===1);
    p.included=true;
  });
  const p24=full.find(p=>p.label==='24'); if(p24)p24.included=false;
  const p25=full.find(p=>p.label==='25'); if(p25)p25.included=false;
  const p28=full.find(p=>p.label==='28');
  const p29=full.find(p=>p.label==='29');
  if(p28&&p29){ const t=p28.order; p28.order=p29.order; p29.order=t; }

  window.CATALOG_EDITOR_BASE=clone(full);

  const KEY='hiddenDoorsCatalog2026.plan.v6';
  const OLD_KEYS=['hiddenDoorsCatalog2026.plan.v5','hiddenDoorsCatalog2026.plan.v4','hiddenDoorsCatalog2026.plan.v3','hiddenDoorsCatalog2026.plan.v2'];
  let plan=null;
  try{plan=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  if(!plan){
    for(const oldKey of OLD_KEYS){
      try{
        const old=JSON.parse(localStorage.getItem(oldKey)||'null');
        if(old?.pages?.length){
          const applied=new Set([3,4,25,26,29,30]);
          const baseline=new Map(full.map(p=>[p.physicalIndex,p]));
          plan={version:6,pages:old.pages.map(x=>{
            if(!applied.has(x.physicalIndex)) return x;
            const b=baseline.get(x.physicalIndex)||{};
            return {...x,order:b.order??x.order,included:b.included!==false,pairWithNext:b.pairWithNext,correctionType:'',correctionText:'',correctionDone:false,correctionId:''};
          })};
          localStorage.setItem(KEY,JSON.stringify(plan));
          break;
        }
      }catch{}
    }
  }

  const planMap=new Map((plan?.pages||[]).map(p=>[p.physicalIndex,p]));
  full.forEach(p=>{
    const q=planMap.get(p.physicalIndex);
    if(q){
      ['order','pairWithNext','included','title','status','statusText','locked'].forEach(k=>{if(q[k]!==undefined)p[k]=q[k]});
    }
  });

  full.sort((a,b)=>a.order-b.order||a.physicalIndex-b.physicalIndex);
  const cover=full.find(p=>p.physicalIndex===1);
  if(cover){
    const i=full.indexOf(cover); if(i>0){full.splice(i,1);full.unshift(cover)}
  }
  full.forEach((p,i)=>p.order=i+1);

  const visible=full.filter(p=>p.included!==false);
  window.CATALOG_DATA={...base,pages:visible};
  localStorage.setItem('hiddenDoorsCatalog2026.web.v01',JSON.stringify({pages:visible}));
})();