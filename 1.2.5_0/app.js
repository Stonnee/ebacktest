function runWhenIdleAndReady(callback) {
    const isDocumentReady = document.readyState === "complete" || document.readyState === "interactive";
  
    const runCallback = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(callback);
      } else {
        setTimeout(callback, 300); 
      }
    };
  
    if (isDocumentReady) {
      runCallback();
    } else {
      document.addEventListener("DOMContentLoaded", runCallback);
    }
  }
