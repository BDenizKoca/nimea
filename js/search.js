(()=>{
  const STATE = { index:null, loaded:false, container:null, input:null, resultsEl:null, pendingFetch:false };
  function $(sel){ return document.querySelector(sel);}    
  function createUI(){
    if (STATE.container) return;
    const mount = document.querySelector('.search-mount') || document.querySelector('header nav');
    if(!mount) return;
    const wrap = document.createElement('div');
    wrap.className = 'global-search';
    wrap.innerHTML = `\n      <input type="search" id="global-search-input" placeholder="${document.documentElement.lang==='en'?'Search ( / )':'Ara ( / )'}" autocomplete="off" />\n      <div id="global-search-results" class="search-results" aria-live="polite"></div>`;
    mount.appendChild(wrap);
    STATE.container = wrap;
    STATE.input = wrap.querySelector('#global-search-input');
    STATE.resultsEl = wrap.querySelector('#global-search-results');
    STATE.input.addEventListener('input', handleInput);
    STATE.input.addEventListener('keydown', e=>{ if(e.key==='Escape'){ clear(); }});
    document.addEventListener('keydown', e=>{
      if(e.key==='/' && document.activeElement!==STATE.input){ e.preventDefault(); STATE.input.focus(); }
    });
    document.addEventListener('click', e=>{ if(!wrap.contains(e.target)) clear(); });
  }
  function fetchIndex(){
    if(STATE.loaded || STATE.pendingFetch) return;
    STATE.pendingFetch = true;
    fetch('/search-index.json').then(r=>r.json()).then(data=>{ STATE.index=data; STATE.loaded=true; STATE.pendingFetch=false; }).catch(()=>{STATE.pendingFetch=false;});
  }
  function scoreRecord(rec, qTokens){
    let score=0;
    for(const qt of qTokens){
      if(rec.tokens.includes(qt)) score += 5; else {
        if(rec.title.toLowerCase().includes(qt)) score += 3; else if(rec.summary.toLowerCase().includes(qt)) score += 1;
      }
      if(rec.title.toLowerCase().startsWith(qt)) score += 2;
    }
    if(rec.type==='marker') score -= 0.2;
    return score;
  }
  function search(query){
    if(!STATE.loaded || !STATE.index) return [];
    const q = query.toLowerCase().trim();
    if(q.length<2) return [];
    const qTokens = q.split(/\s+/).filter(t=>t.length>0);
    const scored = [];
    for(const rec of STATE.index){
      const pageLang = document.documentElement.lang || 'tr';
      if(rec.lang!=='neutral' && rec.lang!==pageLang) continue;
      const s = scoreRecord(rec, qTokens);
      if(s>0) scored.push({rec, score:s});
    }
    scored.sort((a,b)=> b.score - a.score || a.rec.title.localeCompare(b.rec.title));
    return scored.slice(0,12).map(s=>s.rec);
  }
  function render(results){
    if(!STATE.resultsEl) return;
    if(results.length===0){ STATE.resultsEl.innerHTML=''; STATE.resultsEl.classList.remove('visible'); return; }
    STATE.resultsEl.innerHTML = results.map(r=>{
      const typeLabel = r.type==='wiki' ? (document.documentElement.lang==='en'?'Wiki':'Külliyat') : (document.documentElement.lang==='en'?'Marker':'İşaret');
      return `<div class="sr-item" data-url="${r.url}">\n        <div class=\"sr-line\"><span class=\"sr-title\">${r.title}</span> <span class=\"sr-badge\">${typeLabel}</span></div>\n        <div class=\"sr-summary\">${(r.summary||'').slice(0,120)}</div>\n      </div>`;
    }).join('');
    STATE.resultsEl.classList.add('visible');
    STATE.resultsEl.querySelectorAll('.sr-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        const url = el.getAttribute('data-url');
        if(!url) return;
        if(url.startsWith('/map/') && window.location.pathname.includes('/map')){
          const u = new URL(url, window.location.origin);
            const focusId = u.searchParams.get('focus');
            if(focusId){
              if(window.routeUI && typeof window.routeUI.focusMarker === 'function') {
                window.routeUI.focusMarker(focusId);
              } else {
                window.location.href = url;
              }
            }
        } else {
          window.location.href = url;
        }
        clear();
      });
    });
  }
  function handleInput(){
    const q = STATE.input.value;
    if(!STATE.loaded) fetchIndex();
    if(q.trim().length<2){ render([]); return; }
    render(search(q));
  }
  function clear(){
    if(STATE.input) STATE.input.value='';
    if(STATE.resultsEl){ STATE.resultsEl.innerHTML=''; STATE.resultsEl.classList.remove('visible'); }
  }
  document.addEventListener('DOMContentLoaded', ()=>{ createUI(); });
})();
