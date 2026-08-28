import { DataProvider } from './DataProvider.js';
import { formatKoreanDate } from './FirebaseProvider.js';

export class LocalProvider extends DataProvider {
  async getMasses() {
    const res = await fetch('/mock/masses.json');
    let masses = await res.json();
    
    const addedMassesJSON = localStorage.getItem('liturgy_added_masses');
    const addedMasses = addedMassesJSON ? JSON.parse(addedMassesJSON) : [];
    
    const deletedMassesJSON = localStorage.getItem('liturgy_deleted_masses');
    const deletedMasses = deletedMassesJSON ? JSON.parse(deletedMassesJSON) : [];
    
    return [...masses, ...addedMasses]
      .filter(m => m.status === 'Active' && !deletedMasses.includes(String(m.id)));
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
    return slides.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }

  async updateMass(massId, updates) {
    const updatedMassesJSON = localStorage.getItem('liturgy_updated_masses');
    const updatedMasses = updatedMassesJSON ? JSON.parse(updatedMassesJSON) : {};
    updatedMasses[massId] = { ...(updatedMasses[massId] || {}), ...updates };
    localStorage.setItem('liturgy_updated_masses', JSON.stringify(updatedMasses));
    return true;
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
    if (updates.listTitle !== undefined) overrides[baseSlideId].listTitle = updates.listTitle;
    if (updates.contents !== undefined) {
      overrides[baseSlideId].contents = updates.contents;
    }
    if (updates.content !== undefined) {
      overrides[baseSlideId].content = updates.content;
    }
    if (updates.hideTitle !== undefined) {
      overrides[baseSlideId].hideTitle = updates.hideTitle;
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
    
    const formattedDate = formatKoreanDate(newMassData.date);

    // Copy slides from source mass
    if (sourceMassId) {
      const sourceSlides = await this.getSlides(sourceMassId);
      const addedSlidesJSON = localStorage.getItem('liturgy_added_slides');
      const addedSlides = addedSlidesJSON ? JSON.parse(addedSlidesJSON) : [];
      
      sourceSlides.forEach((slide, index) => {
        const newSlide = {
          ...slide,
          id: "local_" + Date.now() + "_" + Math.random().toString(36).substring(7),
          massId: newMassId
        };

        if (index === 0) {
          newSlide.listTitle = '시작';
          newSlide.title = newMassData.title || newSlide.title;
          newSlide.contents = [{
            text: formattedDate,
            align: 'center',
            role: 'none',
            bold: true
          }];
          newSlide.content = formattedDate;
        }

        addedSlides.push(newSlide);
      });
      localStorage.setItem('liturgy_added_slides', JSON.stringify(addedSlides));
    } else {
      const addedSlidesJSON = localStorage.getItem('liturgy_added_slides');
      const addedSlides = addedSlidesJSON ? JSON.parse(addedSlidesJSON) : [];
      addedSlides.push({
        id: "local_" + Date.now() + "_" + Math.random().toString(36).substring(7),
        massId: newMassId,
        sequence: 1,
        type: 'reading',
        listTitle: '시작',
        title: newMassData.title || '',
        contents: [{
          text: formattedDate,
          align: 'center',
          role: 'none',
          bold: true
        }],
        content: formattedDate,
        enabled: true,
        hideTitle: false
      });
      localStorage.setItem('liturgy_added_slides', JSON.stringify(addedSlides));
    }
    
    return newMass;
  }

  async deleteMass(massId) {
    const targetId = String(massId);
    const deletedMassesJSON = localStorage.getItem('liturgy_deleted_masses');
    const deletedMasses = deletedMassesJSON ? JSON.parse(deletedMassesJSON) : [];
    
    if (!deletedMasses.includes(targetId)) {
      deletedMasses.push(targetId);
      localStorage.setItem('liturgy_deleted_masses', JSON.stringify(deletedMasses));
    }

    const addedMassesJSON = localStorage.getItem('liturgy_added_masses');
    if (addedMassesJSON) {
      const addedMasses = JSON.parse(addedMassesJSON).filter(m => String(m.id) !== targetId);
      localStorage.setItem('liturgy_added_masses', JSON.stringify(addedMasses));
    }

    return true;
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
