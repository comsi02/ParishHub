// Config.js
const CONFIG = {
  // The user should replace this with their actual Spreadsheet ID
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || 'YOUR_SPREADSHEET_ID_HERE',
  SHEET_MASSES: 'Masses',
  SHEET_SLIDES: 'Slides',
  STATE_CACHE_KEY: 'LITURGY_STATE'
};
