import { DataProvider } from './DataProvider.js';

export class GasProvider extends DataProvider {
  _runGasFunction(funcName, ...args) {
    return new Promise((resolve, reject) => {
      if (typeof google === 'undefined' || typeof google.script === 'undefined') {
        reject(new Error("Google Apps Script not available"));
        return;
      }
      
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        [funcName](...args);
    });
  }

  async getMasses() {
    return this._runGasFunction('apiGetMasses');
  }

  async getSlides(massId) {
    return this._runGasFunction('apiGetSlides', massId);
  }

  async getPresentationState() {
    return this._runGasFunction('apiGetPresentationState');
  }

  async setPresentationState(state) {
    return this._runGasFunction('apiSetPresentationState', state);
  }

  async updateSlide(massId, slideId, updates) {
    return this._runGasFunction('apiUpdateSlide', massId, slideId, updates);
  }

  async addSlide(massId, slideData) {
    return this._runGasFunction('apiAddSlide', massId, slideData);
  }

  async deleteSlide(massId, slideId) {
    return this._runGasFunction('apiDeleteSlide', massId, slideId);
  }

  async createMass(newMassData, sourceMassId) {
    return this._runGasFunction('apiCreateMass', newMassData, sourceMassId);
  }

  async reorderSlides(massId, orderedSlideIds) {
    return this._runGasFunction('apiReorderSlides', massId, orderedSlideIds);
  }
}
