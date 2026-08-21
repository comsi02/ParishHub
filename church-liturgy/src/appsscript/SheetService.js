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

function apiUpdateSlide(massId, slideId, updates) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_SLIDES);
    if (!sheet) return false;
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return false;
    
    const headers = data[0];
    const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
    const massIdIndex = headers.findIndex(h => h.toLowerCase() === 'massid');
    const titleIndex = headers.findIndex(h => h.toLowerCase() === 'title');
    const contentIndex = headers.findIndex(h => h.toLowerCase() === 'content');
    
    if (idIndex === -1 || massIdIndex === -1) return false;
    
    // Determine the base slide ID if it's paginated (e.g., '3_p1' -> '3')
    const baseSlideId = String(slideId).split('_p')[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === baseSlideId && String(data[i][massIdIndex]) === String(massId)) {
        // Found the row, update it
        // Note: For MVP, we overwrite the full content even if it's a paginated slide.
        if (updates.title !== undefined && titleIndex !== -1) {
          sheet.getRange(i + 1, titleIndex + 1).setValue(updates.title);
        }
        if (updates.content !== undefined && contentIndex !== -1) {
          sheet.getRange(i + 1, contentIndex + 1).setValue(updates.content);
        }
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error("Error updating slide: " + e.toString());
    return false;
  }
}

function apiAddSlide(massId, slideData) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_SLIDES);
    if (!sheet) return false;
    
    // Generate a new ID based on max ID
    const data = sheet.getDataRange().getValues();
    let maxId = 0;
    if (data.length > 1) {
      const idIndex = data[0].findIndex(h => h.toLowerCase() === 'id');
      if (idIndex !== -1) {
        for (let i = 1; i < data.length; i++) {
          const currentId = parseInt(data[i][idIndex], 10);
          if (!isNaN(currentId) && currentId > maxId) {
            maxId = currentId;
          }
        }
      }
    }
    
    const newId = String(maxId + 1);
    
    const rowData = [
      newId,
      String(massId),
      slideData.sequence || 999,
      slideData.type || 'hymn',
      slideData.title || '',
      slideData.content || '',
      slideData.subtitle || '',
      slideData.notes || '',
      true // Enabled
    ];
    
    sheet.appendRow(rowData);
    
    return Object.assign({}, slideData, { id: newId, massId: massId, enabled: true });
  } catch (e) {
    console.error("Error adding slide: " + e.toString());
    return null;
  }
}

function apiDeleteSlide(massId, slideId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_SLIDES);
    if (!sheet) return false;
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return false;
    
    const headers = data[0];
    const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
    const massIdIndex = headers.findIndex(h => h.toLowerCase() === 'massid');
    const enabledIndex = headers.findIndex(h => h.toLowerCase() === 'enabled');
    
    if (idIndex === -1 || massIdIndex === -1 || enabledIndex === -1) return false;
    
    const baseSlideId = String(slideId).split('_p')[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === baseSlideId && String(data[i][massIdIndex]) === String(massId)) {
        // Found the row, soft delete it (set Enabled to FALSE)
        sheet.getRange(i + 1, enabledIndex + 1).setValue(false);
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error("Error deleting slide: " + e.toString());
    return false;
  }
}

function apiCreateMass(newMassData, sourceMassId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const massesSheet = ss.getSheetByName(CONFIG.SHEET_MASSES);
    const slidesSheet = ss.getSheetByName(CONFIG.SHEET_SLIDES);
    
    if (!massesSheet || !slidesSheet) return null;
    
    // Generate new Mass ID
    const massesData = massesSheet.getDataRange().getValues();
    let maxMassId = 0;
    if (massesData.length > 1) {
      const idIndex = massesData[0].findIndex(h => h.toLowerCase() === 'id');
      if (idIndex !== -1) {
        for (let i = 1; i < massesData.length; i++) {
          const currentId = parseInt(massesData[i][idIndex], 10);
          if (!isNaN(currentId) && currentId > maxMassId) {
            maxMassId = currentId;
          }
        }
      }
    }
    const newMassId = String(maxMassId + 1);
    
    // Append new Mass
    const massRow = [
      newMassId,
      newMassData.date || '',
      newMassData.title || '',
      newMassData.language || 'ko',
      'Active'
    ];
    massesSheet.appendRow(massRow);
    
    // If copying from source
    if (sourceMassId) {
      const slidesData = slidesSheet.getDataRange().getValues();
      if (slidesData.length > 1) {
        const headers = slidesData[0];
        const idIdx = headers.findIndex(h => h.toLowerCase() === 'id');
        const massIdIdx = headers.findIndex(h => h.toLowerCase() === 'massid');
        const enabledIdx = headers.findIndex(h => h.toLowerCase() === 'enabled');
        
        let maxSlideId = 0;
        for (let i = 1; i < slidesData.length; i++) {
          const currentId = parseInt(slidesData[i][idIdx], 10);
          if (!isNaN(currentId) && currentId > maxSlideId) {
            maxSlideId = currentId;
          }
        }
        
        const rowsToAppend = [];
        for (let i = 1; i < slidesData.length; i++) {
          if (String(slidesData[i][massIdIdx]) === String(sourceMassId) && slidesData[i][enabledIdx] !== false) {
            maxSlideId++;
            const newRow = [...slidesData[i]];
            newRow[idIdx] = String(maxSlideId);
            newRow[massIdIdx] = newMassId;
            rowsToAppend.push(newRow);
          }
        }
        
        if (rowsToAppend.length > 0) {
          // Append in batch
          slidesSheet.getRange(slidesSheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
        }
      }
    }
    
    return {
      id: newMassId,
      date: newMassData.date,
      title: newMassData.title,
      language: newMassData.language,
      status: 'Active'
    };
    
    
  } catch (e) {
    console.error("Error creating mass: " + e.toString());
    return null;
  }
}

function apiReorderSlides(massId, orderedSlideIds) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_SLIDES);
    if (!sheet) return false;
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return false;
    
    const headers = data[0];
    const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
    const massIdIndex = headers.findIndex(h => h.toLowerCase() === 'massid');
    const sequenceIndex = headers.findIndex(h => h.toLowerCase() === 'sequence');
    
    if (idIndex === -1 || massIdIndex === -1 || sequenceIndex === -1) return false;
    
    // Create a map for quick lookup
    const idToSequenceMap = {};
    orderedSlideIds.forEach((id, index) => {
      const baseId = String(id).split('_p')[0];
      idToSequenceMap[baseId] = index + 1;
    });
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][massIdIndex]) === String(massId)) {
        const rowId = String(data[i][idIndex]);
        if (idToSequenceMap[rowId] !== undefined) {
          sheet.getRange(i + 1, sequenceIndex + 1).setValue(idToSequenceMap[rowId]);
        }
      }
    }
    
    return true;
  } catch (e) {
    console.error("Error reordering slides: " + e.toString());
    return false;
  }
}
