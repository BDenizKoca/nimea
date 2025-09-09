// map/js/utils/logger.js - simple debug logger wrapper
(function(window){
  'use strict';
  const key = 'nimea.debug';
  function isEnabled(){
    try { return localStorage.getItem(key) === '1' || /[?&]debug=1\b/.test(location.search); } catch { return false; }
  }
  function log(){ if (isEnabled()) try { console.log.apply(console, arguments); } catch(_){}
  }
  function warn(){ if (isEnabled()) try { console.warn.apply(console, arguments); } catch(_){}
  }
  function error(){ try { console.error.apply(console, arguments); } catch(_){}
  }
  window.__nimea_log = { log, warn, error, isEnabled };
})(window);
