(()=>{
  const base=window.CATALOG_DATA;
  if(!base?.pages?.length)return;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const pages=clone(base.pages).map((p,i)=>({
    ...p,
    physicalIndex:Number(p.physicalIndex??p.id??(i+1)),
    sourceLabel:String(p.label??String(i+1).padStart(2,'0')),
    order:i+1,
    included:true,
    pairWithNext:false
  }));

  // Published master. Stable source IDs stay unchanged; public numbering is derived.
  const hidden=new Set(['23A','24','25']);
  pages.forEach(p=>{ if(hidden.has(p.sourceLabel)) p.included=false; });
  // Explicit approvals already fixed in the published catalog.
  const approvedPhysical=new Set([4,5,28,32]);
  pages.forEach(p=>{if(approvedPhysical.has(p.physicalIndex)){p.status='approved';p.statusText='Согласовано';}});

  const visible=pages.filter(p=>p.included);
  const cover=visible.find(p=>p.physicalIndex===1)||visible[0];
  const reading=visible.filter(p=>p!==cover);
  for(let i=0;i<reading.length;i+=2){
    if(reading[i+1]) reading[i].pairWithNext=true;
  }
  visible.forEach((p,i)=>{
    p.catalogNumber=String(i+1).padStart(2,'0');
    p.catalogIndex=i;
  });

  const byPhysical=new Map(pages.map(p=>[p.physicalIndex,p]));
  window.CATALOG_PUBLIC_MASTER={
    ...clone(base),
    pages,
    visiblePages:visible,
    byPhysical,
    version:'2026-10-01-master-12'
  };
})();