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
}
