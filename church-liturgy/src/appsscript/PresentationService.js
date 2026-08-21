// PresentationService.js
function apiGetPresentationState() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CONFIG.STATE_CACHE_KEY);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const props = PropertiesService.getScriptProperties();
  const massId = props.getProperty('CURRENT_MASS_ID');
  const slideId = props.getProperty('CURRENT_SLIDE_ID');
  const theme = props.getProperty('CURRENT_THEME');
  
  return {
    massId: massId || '1',
    slideId: slideId || '1',
    theme: theme || 'dark'
  };
}

function apiSetPresentationState(state) {
  state.lastUpdated = new Date().getTime();
  const stateStr = JSON.stringify(state);
  
  // Cache for fast polling (max 6 hours)
  const cache = CacheService.getScriptCache();
  cache.put(CONFIG.STATE_CACHE_KEY, stateStr, 21600);
  
  // Persist to properties
  const props = PropertiesService.getScriptProperties();
  props.setProperty('CURRENT_MASS_ID', state.massId);
  props.setProperty('CURRENT_SLIDE_ID', state.slideId);
  if (state.theme) {
    props.setProperty('CURRENT_THEME', state.theme);
  }
  
  return true;
}
