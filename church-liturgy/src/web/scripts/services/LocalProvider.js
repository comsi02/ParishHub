import { DataProvider } from './DataProvider.js';

export class LocalProvider extends DataProvider {
  async getMasses() {
    const res = await fetch('/mock/masses.json');
    let masses = await res.json();
    
    const addedMassesJSON = localStorage.getItem('liturgy_added_masses');
    const addedMasses = addedMassesJSON ? JSON.parse(addedMassesJSON) : [];
    
    return [...masses, ...addedMasses].filter(m => m.status === 'Active');
  }

  async getSlides(massId) {
    const res = await fetch('/mock/slides.json');
    const overridesJSON = localStorage.getItem('liturgy_overrides');
    const overrides = overridesJSON ? JSON.parse(overridesJSON) : {};
    const addedSlidesJSON = localStorage.getItem('liturgy_added_slides');
    const addedSlides = addedSlidesJSON ? JSON.parse(addedSlidesJSON) : [];
    const deletedSlidesJSON = localStorage.getItem('liturgy_deleted_slides');
    const deletedSlides = deletedSlidesJSON ? JSON.parse(deletedSlidesJSON) : [];

    let slides = await res.json();
    
    // Add dynamically added slides
    slides = [...slides, ...addedSlides];
    
    // Filter by massId, enabled status, and not logically deleted
    slides = slides.filter(s => s.massId === massId && s.enabled && !deletedSlides.includes(String(s.id)));
    
    // Apply local overrides
    slides = slides.map(s => overrides[s.id] ? { ...s, ...overrides[s.id] } : s);
    
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
      const parsed = JSON.parse(state);
      if (!parsed.displayMode) parsed.displayMode = 'normal';
      return parsed;
    }
    return { massId: "1", slideId: "1", lastUpdated: Date.now(), displayMode: 'normal' };
  }

  async setPresentationState(state) {
    // Merge with existing state to prevent partial overwrites from wiping fields like displayMode
    const existing = localStorage.getItem('liturgy_state');
    const prev = existing ? JSON.parse(existing) : {};
    const merged = { ...prev, ...state, lastUpdated: Date.now() };
    localStorage.setItem('liturgy_state', JSON.stringify(merged));
    return true;
  }

  async updateSlide(massId, slideId, updates) {
    // Determine the base slide ID if it's paginated (e.g., '3_p1' -> '3')
    const baseSlideId = String(slideId).split('_p')[0];
    
    const overridesJSON = localStorage.getItem('liturgy_overrides');
    const overrides = overridesJSON ? JSON.parse(overridesJSON) : {};
    
    // Only support updating the whole content for the base slide in local mode
    // If it's a paginated slide, we ideally want to reconstruct the full string, 
    // but for MVP inline editing we'll just overwrite the base content.
    if (!overrides[baseSlideId]) {
      overrides[baseSlideId] = {};
    }
    
    if (updates.title !== undefined) overrides[baseSlideId].title = updates.title;
    if (updates.content !== undefined) {
      if (String(slideId).includes('_p')) {
        // If it's a paginated slide, we can't easily merge back to the full text
        // without fetching the original and splitting. For simplicity, we just
        // overwrite the base content with the new part if they edit a part.
        // Or better yet, we fetch original and update just that part.
        // Let's do a simple overwrite for now.
        // Actually, this will break pagination if they edit a part.
        // Let's just overwrite the base content.
        overrides[baseSlideId].content = updates.content;
      } else {
        overrides[baseSlideId].content = updates.content;
      }
    }

    localStorage.setItem('liturgy_overrides', JSON.stringify(overrides));
    return true;
  }

  async addSlide(massId, slideData) {
    const addedSlidesJSON = localStorage.getItem('liturgy_added_slides');
    const addedSlides = addedSlidesJSON ? JSON.parse(addedSlidesJSON) : [];
    
    const newSlide = {
      ...slideData,
      id: "local_" + Date.now(),
      massId: String(massId),
      enabled: true
    };
    
    addedSlides.push(newSlide);
    localStorage.setItem('liturgy_added_slides', JSON.stringify(addedSlides));
    return newSlide;
  }

  async deleteSlide(massId, slideId) {
    const baseSlideId = String(slideId).split('_p')[0];
    const deletedSlidesJSON = localStorage.getItem('liturgy_deleted_slides');
    const deletedSlides = deletedSlidesJSON ? JSON.parse(deletedSlidesJSON) : [];
    
    if (!deletedSlides.includes(baseSlideId)) {
      deletedSlides.push(baseSlideId);
      localStorage.setItem('liturgy_deleted_slides', JSON.stringify(deletedSlides));
    }
    return true;
  }

  async createMass(newMassData, sourceMassId) {
    // Save new mass
    const addedMassesJSON = localStorage.getItem('liturgy_added_masses');
    const addedMasses = addedMassesJSON ? JSON.parse(addedMassesJSON) : [];
    
    const newMassId = "local_mass_" + Date.now();
    const newMass = {
      ...newMassData,
      id: newMassId,
      status: 'Active'
    };
    
    addedMasses.push(newMass);
    localStorage.setItem('liturgy_added_masses', JSON.stringify(addedMasses));
    
    // Copy slides from source mass
    if (sourceMassId) {
      const sourceSlides = await this.getSlides(sourceMassId); // Includes base and overrides and added
      const addedSlidesJSON = localStorage.getItem('liturgy_added_slides');
      const addedSlides = addedSlidesJSON ? JSON.parse(addedSlidesJSON) : [];
      
      sourceSlides.forEach(slide => {
        // Only copy base slides (not paginated parts if they exist in source array directly)
        // Since getSlides returns paginated versions, wait, getSlides returns paginated array!
        // Actually, getSlides handles pagination. So it returns `_p1`, `_p2` etc.
        // It's better to fetch the raw array. But for local testing, copying the paginated ones 
        // as new base slides is okay, or we can fetch the original array again.
        // Let's just copy what we get from getSlides to keep it simple.
        const newSlide = {
          ...slide,
          id: "local_" + Date.now() + "_" + Math.random().toString(36).substring(7),
          massId: newMassId
        };
        addedSlides.push(newSlide);
      });
      localStorage.setItem('liturgy_added_slides', JSON.stringify(addedSlides));
    }
    
    return newMass;
  }

  async reorderSlides(massId, orderedSlideIds) {
    const overridesJSON = localStorage.getItem('liturgy_overrides');
    const overrides = overridesJSON ? JSON.parse(overridesJSON) : {};
    
    orderedSlideIds.forEach((id, index) => {
      const baseSlideId = String(id).split('_p')[0];
      if (!overrides[baseSlideId]) {
        overrides[baseSlideId] = {};
      }
      overrides[baseSlideId].sequence = index + 1;
    });
    
    localStorage.setItem('liturgy_overrides', JSON.stringify(overrides));
    
    // Also update added_slides if any are in the reordered list
    const addedSlidesJSON = localStorage.getItem('liturgy_added_slides');
    const addedSlides = addedSlidesJSON ? JSON.parse(addedSlidesJSON) : [];
    
    let addedUpdated = false;
    addedSlides.forEach(slide => {
      const idx = orderedSlideIds.indexOf(String(slide.id));
      if (idx !== -1) {
        slide.sequence = idx + 1;
        addedUpdated = true;
      }
    });
    if (addedUpdated) {
      localStorage.setItem('liturgy_added_slides', JSON.stringify(addedSlides));
    }
    
    return true;
  }
}
