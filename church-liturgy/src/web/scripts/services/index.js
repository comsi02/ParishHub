import { LocalProvider } from './LocalProvider.js';
import { GasProvider } from './GasProvider.js';

export function getProvider() {
  if (typeof google !== 'undefined' && typeof google.script !== 'undefined') {
    return new GasProvider();
  }
  return new LocalProvider();
}
