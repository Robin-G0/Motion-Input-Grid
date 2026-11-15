// A packaged worker keeps camera processing independent of window rendering.
setInterval(()=>postMessage("frame"),50);
