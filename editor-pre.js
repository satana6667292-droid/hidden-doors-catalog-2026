(()=>{
  const base=window.CATALOG_DATA;
  if(!base?.pages)return;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const full=clone(base.pages);
  window.CATALOG_EDITOR_BASE=clone(full);
  let old=null,plan=null;
  try{old=JSON.parse(localStorage.getItem('hiddenDoorsCatalog2026.web.v01')||'null')}catch{}
  try{plan=JSON.parse(localStorage.getItem('hiddenDoorsCatalog2026.plan.v2')||'null')}catch{}
  const oldMap=new Map((old?.pages||[]).map(p=>[p.physicalIndex,p]));
  const planMap=new Map((plan?.pages||[]).map(p=>[p.physicalIndex,p]));
  full.forEach((p,i)=>{
    const o=oldMap.get(p.physicalIndex); if(o){['order','pairWithNext','title','status','statusText','locked'].forEach(k=>{if(o[k]!==undefined)p[k]=o[k]})}
    if(p.order==null)p.order=i+1;
    if(p.pairWithNext==null)p.pairWithNext=i>0&&i%2===1;
    p.included=true;
    const q=planMap.get(p.physicalIndex); if(q){['order','pairWithNext','included','title','status','statusText','locked'].forEach(k=>{if(q[k]!==undefined)p[k]=q[k]})}
  });
  full.sort((a,b)=>a.order-b.order||a.physicalIndex-b.physicalIndex).forEach((p,i)=>p.order=i+1);
  const visible=full.filter(p=>p.included!==false);
  window.CATALOG_DATA={...base,pages:visible};
  localStorage.setItem('hiddenDoorsCatalog2026.web.v01',JSON.stringify({pages:visible}));
})();