chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getDOM") {
    sendResponse({ dom: document.documentElement.outerHTML });
  }
});