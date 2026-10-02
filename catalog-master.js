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
  // Every legacy source folio is explicitly masked before the single global folio is rendered.
  // Rectangles are percentages of the page and are deliberately tight so content rules are untouched.
  const legacyFolioMasks={
    2:[{x:3.4,y:92.0,w:3.6,h:3.8}],
    3:[{x:92.7,y:91.8,w:4.0,h:4.5}],
    4:[{x:3.5,y:92.4,w:3.4,h:3.1}],
    5:[{x:93.2,y:92.0,w:3.2,h:3.8}],

    7:[{x:93.6,y:96.0,w:4.9,h:2.8}],
    8:[{x:2.5,y:96.0,w:4.9,h:2.8}],
    11:[{x:93.6,y:96.0,w:4.9,h:2.8}],
    12:[{x:2.5,y:96.0,w:4.9,h:2.8}],
    15:[{x:93.6,y:96.0,w:4.9,h:2.8}],
    16:[{x:2.5,y:96.0,w:4.9,h:2.8}],
    19:[{x:93.6,y:96.0,w:4.9,h:2.8}],
    20:[{x:2.5,y:96.0,w:4.9,h:2.8}],

    27:[{x:84.2,y:86.5,w:2.8,h:2.3}],
    28:[{x:94.0,y:93.6,w:3.8,h:3.6}],
    29:[{x:84.2,y:84.1,w:2.8,h:2.4}],
    30:[{x:92.3,y:94.5,w:3.9,h:3.7}],
    31:[{x:92.6,y:93.1,w:3.9,h:3.8}],
    32:[{x:93.9,y:93.0,w:3.6,h:3.7}],
    33:[{x:94.8,y:94.5,w:3.9,h:3.9}],
    34:[{x:94.8,y:94.5,w:3.9,h:3.9}],
    35:[{x:94.8,y:94.5,w:3.9,h:3.9}],
    36:[
      {x:94.8,y:93.7,w:3.6,h:2.8},
      {x:96.4,y:96.1,w:3.6,h:3.6}
    ],
    37:[{x:96.3,y:96.2,w:3.7,h:3.6}],
    38:[{x:71.4,y:96.2,w:3.8,h:3.6}],
    39:[
      {x:94.8,y:94.2,w:3.7,h:2.5},
      {x:96.3,y:96.2,w:3.7,h:3.6}
    ],
    40:[{x:92.4,y:91.7,w:3.5,h:2.2}],
    41:[
      {x:92.8,y:91.8,w:2.8,h:2.6},
      {x:96.3,y:96.1,w:3.7,h:3.6}
    ],
    42:[
      {x:93.2,y:93.0,w:2.9,h:2.8},
      {x:96.3,y:96.1,w:3.7,h:3.6}
    ],
    43:[{x:94.0,y:93.6,w:3.8,h:3.6}],
    44:[{x:91.7,y:91.3,w:3.9,h:3.7}]
  };
  pages.forEach(p=>{
    p.legacyFolioMasks=legacyFolioMasks[p.physicalIndex]||[];
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
    version:'2026-10-02-folio-master-v1-baked-final'
  };
})();