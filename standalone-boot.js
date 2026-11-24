// Standalone Ciyan only; AppLauncher owns hosted registration.
import {registerStandaloneWorker} from './browser-host.js';
registerStandaloneWorker({onError:error=>console.warn('Offline support unavailable:',error)});
await import('./app.js');
