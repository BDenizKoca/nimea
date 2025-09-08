// en/map/js/routing/route-share.js - Same minimal implementation reused for EN
(function(window){
  'use strict';
  // Reuse Turkish implementation logic by just referencing the global if already loaded.
  // If needed to diverge later for language-specific messages, we can fork.
  if(!window.__nimea_route_share){
    console.warn('Expected base route-share.js loaded in EN context.');
  }
})(window);
