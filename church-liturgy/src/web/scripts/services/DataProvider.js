/**
 * Interface for Data Providers
 */
export class DataProvider {
  async getMasses() { throw new Error("Not implemented"); }
  async getSlides(massId) { throw new Error("Not implemented"); }
  async getPresentationState() { throw new Error("Not implemented"); }
  async setPresentationState(state) { throw new Error("Not implemented"); }
  async updateSlide(massId, slideId, updates) { throw new Error("Not implemented"); }
  async addSlide(massId, slideData) { throw new Error("Not implemented"); }
  async deleteSlide(massId, slideId) { throw new Error("Not implemented"); }
  async createMass(newMassData, sourceMassId) { throw new Error("Not implemented"); }
  async reorderSlides(massId, orderedSlideIds) { throw new Error("Not implemented"); }
}
