/**
 * Interface for Data Providers
 */
export class DataProvider {
  async getMasses() { throw new Error("Not implemented"); }
  async getSlides(massId) { throw new Error("Not implemented"); }
  async getPresentationState() { throw new Error("Not implemented"); }
  async setPresentationState(state) { throw new Error("Not implemented"); }
}
