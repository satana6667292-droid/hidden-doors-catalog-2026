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
  const approvedPhysical=new Set([4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,28,32]);
  pages.forEach(p=>{if(approvedPhysical.has(p.physicalIndex)){p.status='approved';p.statusText='Согласовано';}});

  // Collection pages 06–21 are rendered through two reusable templates.
  // The original page stays the content source; the shared shell owns logo + page number.
  const collectionTemplates={
    6:{type:'collection-interior',side:'left'},
    7:{type:'collection-models',side:'right'},
    8:{type:'collection-models',side:'left'},
    9:{type:'collection-interior',side:'right'},
    10:{type:'collection-interior',side:'left'},
    11:{type:'collection-models',side:'right'},
    12:{type:'collection-models',side:'left',hideTopNote:true},
    13:{type:'collection-interior',side:'right'},
    14:{type:'collection-interior',side:'left'},
    15:{type:'collection-models',side:'right'},
    16:{type:'collection-models',side:'left'},
    17:{type:'collection-interior',side:'right'},
    18:{type:'collection-interior',side:'left'},
    19:{type:'collection-models',side:'right'},
    20:{type:'collection-models',side:'left'},
    21:{type:'collection-interior',side:'right'}
  };
  pages.forEach(p=>{
    const t=collectionTemplates[p.physicalIndex];
    if(t){
      p.templateType=t.type;
      p.templateSide=t.side;
      p.hideTopNote=!!t.hideTopNote;
      p.shellVersion='collection-v1';
    }
  });

  // FOLIO MASTER v1 — approved 2026-10-02.
  // Visual folio is rendered by one shared component. Legacy embedded folios
  // are masked only where they actually exist in source artwork.
  const legacyFolioSide={
    2:'left',3:'right',4:'left',5:'right',
    7:'right',8:'left',11:'right',12:'left',15:'right',16:'left',19:'right',20:'left',
    27:'right',28:'right',29:'right',30:'right',31:'right',32:'right',33:'right',34:'right',
    35:'right',36:'right',37:'right',38:'right',39:'right',40:'right',41:'right',42:'right',
    43:'right',44:'right'
  };
  pages.forEach(p=>{
    p.legacyFolioSide=legacyFolioSide[p.physicalIndex]||null;
    p.folioMaster='v1';
  });

  const visible=pages.filter(p=>p.included);
  const cover=visible.find(p=>p.physicalIndex===1)||visible[0];
  const reading=visible.filter(p=>p!==cover);
  for(let i=0;i<reading.length;i+=2){
    if(reading[i+1]) reading[i].pairWithNext=true;
  }
  visible.forEach((p,i)=>{
    p.catalogNumber=String(i+1).padStart(2,'0');
    p.catalogIndex=i;
    p.folioSide=p.physicalIndex===1?null:(Number(p.catalogNumber)%2===0?'left':'right');
    p.showFolio=p.physicalIndex!==1;
    p.folioHalo=String(p.templateType||'').includes('interior');
  });

  const byPhysical=new Map(pages.map(p=>[p.physicalIndex,p]));
  window.CATALOG_PUBLIC_MASTER={
    ...clone(base),
    pages,
    visiblePages:visible,
    byPhysical,
    version:'2026-10-02-folio-master-v1'
  };
})();