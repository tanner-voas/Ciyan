// The standalone Ciyan entry point; the host AppLauncher never includes this file.
// Registration is best-effort so a service worker failure never blocks study.
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})
    .catch(error=>console.warn('Offline support unavailable:',error));
}
// Ciyan's normal boot starts on its existing Study home screen.
await import('./app.js');
