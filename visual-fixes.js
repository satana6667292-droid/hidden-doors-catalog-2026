(()=>{
  const css=document.createElement('style');
  css.textContent=`
    .catalog-page[data-page="3"],.catalog-page[data-page="4"]{position:relative;overflow:hidden}
    .hd-logo-patch{position:absolute;z-index:3;background:#fff;pointer-events:none}
    .hd-logo-clone{position:absolute;z-index:4;top:0;width:100%;height:auto;pointer-events:none;max-width:none!important}
    .catalog-page[data-page="3"] .hd-logo-patch{left:2.3%;top:3.5%;width:20.5%;height:10.7%}
    .catalog-page[data-page="3"] .hd-logo-clone{left:75.6%;clip-path:inset(4.6% 78.7% 86.7% 3%)}
    .catalog-page[data-page="4"] .hd-logo-patch{left:2.2%;top:2.8%;width:25%;height:10.5%}
    .catalog-page[data-page="4"] .hd-logo-clone{left:0;clip-path:inset(4.6% 78.7% 86.7% 3%)}
  `;
  document.head.appendChild(css);
  function apply(){
    document.querySelectorAll('.catalog-page[data-page="3"],.catalog-page[data-page="4"]').forEach(el=>{
      if(el.dataset.hdLogoFixed)return;
      el.dataset.hdLogoFixed='1';
      const patch=document.createElement('span');patch.className='hd-logo-patch';el.appendChild(patch);
      const clone=document.createElement('img');clone.className='hd-logo-clone';clone.alt='';clone.draggable=false;clone.src='assets/pages/page-003.webp';el.appendChild(clone);
    });
  }
  apply();
  new MutationObserver(apply).observe(document.body,{subtree:true,childList:true});
})();