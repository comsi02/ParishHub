// Code.js
function doGet(e) {
  const page = e.parameter.page || 'display';
  
  let template;
  try {
    template = HtmlService.createTemplateFromFile(page);
  } catch (err) {
    template = HtmlService.createTemplateFromFile('display');
  }
  
  return template.evaluate()
    .setTitle('Liturgy Presentation System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
