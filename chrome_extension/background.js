chrome.runtime.onInstalled.addListener(() => {
  console.log("Llama Sidebar Helper installed");
  chrome.sidePanel.setOptions({ enabled: true, path: "sidebar.html" });
});

chrome.action.onClicked.addListener((tab) => {
  console.log("Action icon clicked");
  chrome.sidePanel.open({ windowId: tab.windowId });
});