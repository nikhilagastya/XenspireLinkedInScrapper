/**
 * xenhirely-auth.js
 * 
 * Content script injected into https://sandbox.platform.xenhirely.com/*
 * It acts as a bridge to sync localStorage auth tokens to the Chrome Extension's internal storage.
 */

// ==========================================
// USER CONFIGURATION NEEDED HERE
// ==========================================
// Replace "token" with the exact key name used in Xenhirely's LocalStorage!
const AUTH_LOCAL_STORAGE_KEY = "xen_auth_user"; 

function syncAuthToken() {
  try {
    const token = window.localStorage.getItem(AUTH_LOCAL_STORAGE_KEY);
    
    if (token) {
      // User is logged in. Save token to extension storage.
      chrome.storage.local.set({ xenhirely_auth_token: token });
    } else {
      // User is logged out or token is missing. Remove from extension storage.
      chrome.storage.local.remove(["xenhirely_auth_token"]);
    }
  } catch (err) {
    console.error("Xenspire Auth Bridge Error:", err);
  }
}

// Run immediately on load
syncAuthToken();

// Run periodically to catch login/logout events dynamically (e.g. in a Single Page App)
setInterval(syncAuthToken, 2000);
