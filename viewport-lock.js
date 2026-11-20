// v0.8.16: prevent accidental document zoom without blocking normal page or
// app-list scrolling, horizontal component scrollers, or single-touch gestures.
(function installViewportLock(){
  if(typeof document==='undefined')return;
  const prevent=event=>{if(event.cancelable)event.preventDefault();};
  // Safari Home Screen PWAs still emit legacy gesture events for pinch zoom.
  for(const type of ['gesturestart','gesturechange'])
    document.addEventListener(type,prevent,{passive:false});
  // Fallback for WebKit builds that expose only multitouch touch events.
  document.addEventListener('touchmove',event=>{
    if(event.touches?.length>1)prevent(event);
  },{passive:false});
  // Trackpads can also send a pinch as ctrl+wheel (desktop testing).
  document.addEventListener('wheel',event=>{
    if(event.ctrlKey)prevent(event);
  },{passive:false});
})();
