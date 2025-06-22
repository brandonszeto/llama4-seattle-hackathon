// Enhanced content script for GUI interactions

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ping") {
    sendResponse({ success: true });
  } else if (request.action === "getDOM") {
    sendResponse({ dom: document.documentElement.outerHTML });
  } else if (request.action === "getInteractableElements") {
    const elements = getInteractableElementsInfo();
    sendResponse({ elements: elements });
  } else if (request.action === "clickElement") {
    handleElementClick(request.selector, request.description, sendResponse, request.confirmed);
    return true; // Keep message channel open for async response
  } else if (request.action === "fillTextbox") {
    handleTextboxFill(request.selector, request.text, request.description, sendResponse, request.confirmed);
    return true; // Keep message channel open for async response
  } else if (request.action === "highlightElements") {
    highlightInteractableElements();
    sendResponse({ success: true });
  } else if (request.action === "removeHighlights") {
    removeHighlights();
    sendResponse({ success: true });
  }
});

// Highlight all clickable elements on the page
function highlightInteractableElements() {
  removeHighlights(); // Remove existing highlights first
  
  const clickableSelectors = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'a[href]',
    '[onclick]',
    '[role="button"]',
    'input[type="text"]',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="search"]',
    'textarea',
    'select'
  ];
  
  clickableSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element, index) => {
      if (isElementVisible(element)) {
        const highlight = document.createElement('div');
        highlight.className = 'llama-element-highlight';
        highlight.style.cssText = `
          position: absolute;
          border: 2px solid #ff4444;
          background: rgba(255, 68, 68, 0.1);
          pointer-events: none;
          z-index: 10000;
          border-radius: 4px;
        `;
        
        const rect = element.getBoundingClientRect();
        highlight.style.left = (rect.left + window.scrollX) + 'px';
        highlight.style.top = (rect.top + window.scrollY) + 'px';
        highlight.style.width = rect.width + 'px';
        highlight.style.height = rect.height + 'px';
        
        // Add element identifier
        element.setAttribute('data-llama-id', `llama-${selector.replace(/[^\w]/g, '')}-${index}`);
        
        document.body.appendChild(highlight);
      }
    });
  });
}

// Remove all highlights
function removeHighlights() {
  const highlights = document.querySelectorAll('.llama-element-highlight');
  highlights.forEach(highlight => highlight.remove());
}

// Check if element is visible
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && 
         rect.height > 0 && 
         style.visibility !== 'hidden' && 
         style.display !== 'none' &&
         rect.top < window.innerHeight &&
         rect.bottom > 0;
}

// Handle element clicks (no confirmation here - handled in sidebar)
async function handleElementClick(selector, description, sendResponse, confirmed = false) {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      sendResponse({ success: false, error: 'Element not found' });
      return;
    }
    
    if (!confirmed) {
      // Highlight the element and return info for confirmation
      highlightElement(element);
      sendResponse({ 
        success: false, 
        needsConfirmation: true,
        message: `Ready to click: ${description || element.textContent || element.type || 'this element'}`,
        elementText: getElementText(element)
      });
      return;
    }
    
    // Execute the click
    removeElementHighlight();
    element.click();
    sendResponse({ success: true, message: 'Element clicked successfully' });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle textbox filling (no confirmation here - handled in sidebar)
async function handleTextboxFill(selector, text, description, sendResponse, confirmed = false) {
  try {
    const element = document.querySelector(selector);
    if (!element) {
      sendResponse({ success: false, error: 'Element not found' });
      return;
    }
    
    if (!['input', 'textarea'].includes(element.tagName.toLowerCase())) {
      sendResponse({ success: false, error: 'Element is not a text input' });
      return;
    }
    
    if (!confirmed) {
      // Highlight the element and return info for confirmation
      highlightElement(element);
      sendResponse({ 
        success: false, 
        needsConfirmation: true,
        message: `Ready to fill "${description || element.placeholder || 'this field'}" with: "${text}"`,
        elementText: getElementText(element),
        fillText: text
      });
      return;
    }
    
    // Execute the fill
    removeElementHighlight();
    element.focus();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    sendResponse({ success: true, message: 'Text filled successfully' });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// Highlight a single element
function highlightElement(element) {
  removeElementHighlight(); // Remove any existing highlight
  
  element.style.outline = '3px solid #ff4444';
  element.style.outlineOffset = '2px';
  element.style.transition = 'outline 0.3s ease';
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  element.setAttribute('data-llama-highlighted', 'true');
}

// Remove element highlight
function removeElementHighlight() {
  const highlighted = document.querySelector('[data-llama-highlighted="true"]');
  if (highlighted) {
    highlighted.style.outline = '';
    highlighted.style.outlineOffset = '';
    highlighted.style.transition = '';
    highlighted.removeAttribute('data-llama-highlighted');
  }
}


// Get detailed information about interactable elements
function getInteractableElementsInfo() {
  const clickableSelectors = [
    'button',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'a[href]',
    '[onclick]',
    '[role="button"]'
  ];
  
  const inputSelectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="password"]',
    'input[type="search"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[type="number"]',
    'textarea',
    'select'
  ];
  
  const elements = [];
  let elementIndex = 0;
  
  // Process clickable elements
  clickableSelectors.forEach(selector => {
    const foundElements = document.querySelectorAll(selector);
    foundElements.forEach((element) => {
      if (isElementVisible(element)) {
        const elementInfo = {
          type: 'clickable',
          selector: generateUniqueSelector(element, elementIndex),
          text: getElementText(element),
          tagName: element.tagName.toLowerCase(),
          id: element.id || '',
          className: element.className || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          title: element.title || '',
          href: element.href || '',
          index: elementIndex
        };
        elements.push(elementInfo);
        element.setAttribute('data-llama-index', elementIndex);
        elementIndex++;
      }
    });
  });
  
  // Process input elements
  inputSelectors.forEach(selector => {
    const foundElements = document.querySelectorAll(selector);
    foundElements.forEach((element) => {
      if (isElementVisible(element)) {
        const elementInfo = {
          type: 'input',
          selector: generateUniqueSelector(element, elementIndex),
          text: getElementText(element),
          tagName: element.tagName.toLowerCase(),
          id: element.id || '',
          className: element.className || '',
          placeholder: element.placeholder || '',
          ariaLabel: element.getAttribute('aria-label') || '',
          inputType: element.type || '',
          name: element.name || '',
          index: elementIndex
        };
        elements.push(elementInfo);
        element.setAttribute('data-llama-index', elementIndex);
        elementIndex++;
      }
    });
  });
  
  return elements;
}

// Generate a unique and reliable selector for an element
function generateUniqueSelector(element, index) {
  // First try data attribute we set
  if (element.hasAttribute('data-llama-index')) {
    return `[data-llama-index="${element.getAttribute('data-llama-index')}"]`;
  }
  
  // Set our own index attribute
  element.setAttribute('data-llama-index', index);
  return `[data-llama-index="${index}"]`;
}

// Get meaningful text from an element
function getElementText(element) {
  // For inputs, try placeholder, aria-label, or nearby label
  if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
    if (element.placeholder) return element.placeholder;
    if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
    
    // Look for associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }
    
    // Look for nearby label
    const parent = element.parentElement;
    if (parent) {
      const label = parent.querySelector('label');
      if (label) return label.textContent.trim();
    }
    
    return element.name || element.type || 'input field';
  }
  
  // For other elements, get visible text
  const text = element.textContent || element.innerText || '';
  if (text.trim()) return text.trim().substring(0, 100);
  
  // Fallback to attributes
  if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
  if (element.title) return element.title;
  if (element.alt) return element.alt;
  
  return element.tagName.toLowerCase();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('Llama GUI interaction content script loaded');
});