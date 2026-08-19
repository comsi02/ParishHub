import { DataProvider } from './DataProvider.js';

export class LocalProvider extends DataProvider {
  async getMasses() {
    const res = await fetch('/mock/masses.json');
    return await res.json();
  }

  async getSlides(massId) {
    const res = await fetch('/mock/slides.json');
    let slides = await res.json();
    slides = slides.filter(s => s.massId === massId && s.enabled);
    
    // Handle pagination (---PAGE---)
    const paginatedSlides = [];
    slides.forEach(slide => {
      if (slide.content.includes('---PAGE---')) {
        const parts = slide.content.split('---PAGE---');
        parts.forEach((part, index) => {
          paginatedSlides.push({
            ...slide,
            id: `${slide.id}_p${index + 1}`,
            title: `${slide.title} ${index + 1}/${parts.length}`,
            content: part.trim()
          });
        });
      } else {
        paginatedSlides.push(slide);
      }
    });
    
    return paginatedSlides;
  }

  async getPresentationState() {
    const state = localStorage.getItem('liturgy_state');
    if (state) {
      return JSON.parse(state);
    }
    return { massId: "1", slideId: "1", lastUpdated: Date.now() };
  }

  async setPresentationState(state) {
    state.lastUpdated = Date.now();
    localStorage.setItem('liturgy_state', JSON.stringify(state));
    return true;
  }
}
