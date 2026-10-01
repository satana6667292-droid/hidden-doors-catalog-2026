(()=>{
  const base=window.CATALOG_DATA;
  const master=window.CATALOG_PUBLIC_MASTER;
  if(!base?.pages?.length||!master?.pages?.length)return;
  const clone=v=>JSON.parse(JSON.stringify(v));

  // Editor draft always starts from the published master.
  // Public catalog never reads this local draft.
  const pages=clone(master.pages);
  const KEY='hiddenDoorsCatalog2026.plan.v12';

  let plan=null;
  try{plan=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  const map=new Map((plan?.pages||[]).map(x=>[Number(x.physicalIndex),x]));

  pages.forEach(p=>{
    const q=map.get(Number(p.physicalIndex));
    if(!q)return;
    // Only v12 draft fields may override the published master.
    ['order','included','pairWithNext','correctionType','correctionText','correctionId','images','status','statusText'].forEach(k=>{
      if(q[k]!==undefined)p[k]=q[k];
    });
  });

  // Uploaded image drafts are kept separately in IndexedDB/local metadata.
  let mediaDraft=null;
  try{mediaDraft=JSON.parse(localStorage.getItem('hiddenDoorsCatalog2026.media.v1')||'null')}catch{}
  if(mediaDraft?.pages){
    pages.forEach(p=>{
      const m=mediaDraft.pages[String(p.physicalIndex)];
      if(m?.images)p.images=m.images;
    });
  }

  // Stable ID 01 remains first in any draft.
  pages.sort((a,b)=>(a.order??999)-(b.order??999)||a.physicalIndex-b.physicalIndex);
  const cover=pages.find(p=>p.physicalIndex===1);
  if(cover){
    const i=pages.indexOf(cover);
    if(i>0){pages.splice(i,1);pages.unshift(cover)}
  }
  pages.forEach((p,i)=>p.order=i+1);

  window.CATALOG_EDITOR_BASE=clone(pages);
  window.CATALOG_DATA={...clone(base),pages:pages.filter(p=>p.included!==false)};
})();