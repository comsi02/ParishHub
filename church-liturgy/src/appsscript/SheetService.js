// SheetService.js
function getSheetData(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        // camelCase the header for JSON
        const key = header.charAt(0).toLowerCase() + header.slice(1);
        obj[key] = row[index];
      });
      return obj;
    });
  } catch (e) {
    console.error("Error reading sheet " + sheetName + ": " + e.toString());
    return [];
  }
}

function apiGetMasses() {
  return getSheetData(CONFIG.SHEET_MASSES);
}

function apiGetSlides(massId) {
  const slides = getSheetData(CONFIG.SHEET_SLIDES);
  let filtered = slides.filter(s => String(s.massId) === String(massId) && s.enabled !== false);
  
  // Handle pagination logic on the server side to match local
  const paginatedSlides = [];
  filtered.forEach(slide => {
    const content = String(slide.content || '');
    if (content.indexOf('---PAGE---') !== -1) {
      const parts = content.split('---PAGE---');
      parts.forEach((part, index) => {
        const newSlide = Object.assign({}, slide);
        newSlide.id = slide.id + '_p' + (index + 1);
        newSlide.title = slide.title + ' ' + (index + 1) + '/' + parts.length;
        newSlide.content = part.trim();
        paginatedSlides.push(newSlide);
      });
    } else {
      paginatedSlides.push(slide);
    }
  });
  
  return paginatedSlides;
}
