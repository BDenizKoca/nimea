// map/js/routing/route-share.js - Minimal lean route sharing (TR/EN agnostic)
(function(window){
  'use strict';

  let bridge = null;

  // Public init
  function initRouteShare(bridgeObj){
    bridge = bridgeObj;
    // Attempt auto-decode once DOM & data ready (markers loaded later) -> poll until markers loaded or timeout
    tryAutoLoadSharedRoute();
  }

  // Encode current route into a compact string: m:<id> or w:<x>,<y>
  function encodeRoute(){
    if(!bridge || !bridge.state || !Array.isArray(bridge.state.route)) return '';
    const parts = bridge.state.route.map(stop => {
      if(stop.isWaypoint){
        // Waypoint uses its x,y already stored like marker structure (x=lng, y=lat)
        const x = Math.round(stop.x);
        const y = Math.round(stop.y);
        return `w:${x},${y}`;
      }
      return `m:${stop.id}`;
    });
    return 'v1|' + parts.join(';');
  }

  // Decode provided string and populate route
  function decodeRoute(code){
    if(!bridge || !code) return;
    const [version, payload] = code.split('|');
    if(version !== 'v1' || !payload) return;
    const items = payload.split(';').filter(Boolean);
    const newRoute = [];
    const missingMarkers = [];
    items.forEach(item => {
      if(item.startsWith('m:')){
        const id = item.slice(2);
        const marker = bridge.state.markers.find(m => m.id === id);
        if(marker){
          newRoute.push(marker);
        } else {
          missingMarkers.push(id);
        }
      } else if(item.startsWith('w:')){
        const rest = item.slice(2);
        const [xStr,yStr] = rest.split(',');
        const x = parseInt(xStr,10); const y = parseInt(yStr,10);
        if(Number.isFinite(x) && Number.isFinite(y)){
          // Recreate waypoint via routing module for consistency
          if(bridge.routingModule && bridge.routingModule.createWaypoint){
            const wp = bridge.routingModule.createWaypoint(y, x); // createWaypoint(lat,lng) -> our y=lat x=lng
            if(wp) newRoute.push(wp);
          } else {
            // Fallback raw object
            newRoute.push({ id: `wp_${x}_${y}`, name: 'Waypoint', x, y, isWaypoint: true });
          }
        }
      }
    });
    if(newRoute.length){
      bridge.state.route = newRoute;
      if(bridge.routingModule && bridge.routingModule.recomputeRoute){
        bridge.routingModule.recomputeRoute();
      }
      if(missingMarkers.length){
        notify(missingMarkers.length + ' marker eksik / missing: ' + missingMarkers.join(','));
      }
    }
  }

  // Copy current URL with route param
  function copyShareLink(){
    const code = encodeRoute();
    if(!code){
      notify('Rota yok / No route');
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('r', code);
    const finalUrl = url.toString();
    navigator.clipboard.writeText(finalUrl).then(()=>{
      notify(document.documentElement.lang === 'tr' ? 'Bağlantı kopyalandı' : 'Link copied');
    }).catch(()=>{
      notify('Copy failed');
    });
  }

  // Simple lightweight toast
  function notify(msg){
    let box = document.getElementById('route-share-toast');
    if(!box){
      box = document.createElement('div');
      box.id = 'route-share-toast';
      box.style.position='fixed';
      box.style.bottom='12px';
      box.style.left='50%';
      box.style.transform='translateX(-50%)';
      box.style.background='rgba(0,0,0,0.75)';
      box.style.color='#fff';
      box.style.padding='6px 12px';
      box.style.fontSize='13px';
      box.style.borderRadius='4px';
      box.style.zIndex='5000';
      box.style.fontFamily='inherit';
      document.body.appendChild(box);
    }
    box.textContent = msg;
    box.style.opacity='1';
    clearTimeout(box._hideTimer);
    box._hideTimer = setTimeout(()=>{ box.style.transition='opacity .4s'; box.style.opacity='0'; }, 1600);
  }

  // Auto decode on load after data present
  function tryAutoLoadSharedRoute(){
    const params = new URLSearchParams(window.location.search);
    const code = params.get('r');
    if(!code) return;
    // Wait until markers loaded
    const start = performance.now();
    const attempt = () => {
      if(bridge.state.markers && bridge.state.markers.length){
        decodeRoute(code);
      } else if(performance.now() - start < 8000){
        setTimeout(attempt, 200);
      } else {
        notify('Rota yüklenemedi / route load timeout');
      }
    };
    attempt();
  }

  // Expose
  window.__nimea_route_share = {
    initRouteShare,
    encodeRoute,
    decodeRoute,
    copyShareLink
  };

})(window);