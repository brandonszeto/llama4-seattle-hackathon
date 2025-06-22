/**
 * PDF.js simplified version for Chrome extension use
 * Based on Mozilla's PDF.js library
 */

(function(root, factory) {
  root.pdfjsLib = factory();
}(this, function() {
  'use strict';

  // Define the PDFJS object that will be used
  var pdfjsLib = {};

  // Setup for CSP-compliant processing
  pdfjsLib.GlobalWorkerOptions = {
    workerSrc: chrome.runtime.getURL('pdf.worker.js')
  };
  
  console.log("PDF.js custom implementation initialized");

  // PDF document loading
  pdfjsLib.getDocument = function(source) {
    return {
      promise: new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();
        if (source.url) {
          request.open('GET', source.url, true);
          request.responseType = 'arraybuffer';
          
          request.onload = function() {
            if (request.status === 200 || request.status === 0) {
              var arrayBuffer = request.response;
              processPDF(arrayBuffer, resolve, reject);
            } else {
              reject(new Error('PDF loading error: ' + request.statusText));
            }
          };
          
          request.onerror = function() {
            reject(new Error('PDF loading error: Network error'));
          };
          
          request.send();
        } else if (source.data) {
          // For directly provided array buffer
          processPDF(source.data, resolve, reject);
        } else {
          reject(new Error('Invalid PDF source'));
        }
      })
    };
  };

  function processPDF(arrayBuffer, resolve, reject) {
    try {
      // Simple PDF parsing - in a real implementation, this would use the full PDF.js library
      var pdf = extractPDFData(arrayBuffer);
      resolve(pdf);
    } catch (e) {
      reject(new Error('PDF parsing error: ' + e.message));
    }
  }

  // Basic PDF data extraction - simplified for this implementation
  function extractPDFData(arrayBuffer) {
    // Create a PDF object with basic page information
    var pdf = {
      numPages: detectNumberOfPages(arrayBuffer),
        // Method to get a specific page
      getPage: function(pageNumber) {
        return Promise.resolve({
          getTextContent: function() {
            return Promise.resolve(extractPageText(arrayBuffer, pageNumber));
          }
        });
      }
    };
    
    return pdf;
  }

  // Detect PDF structure and estimate number of pages
  function detectNumberOfPages(arrayBuffer) {
    // This is a simplified implementation
    // In a real implementation, we would parse the PDF structure properly
    var view = new Uint8Array(arrayBuffer);
    var pageCount = 0;
    var pattern = [47, 80, 97, 103, 101]; // "/Page"
    
    for (var i = 0; i < view.length - 5; i++) {
      var match = true;
      for (var j = 0; j < pattern.length; j++) {
        if (view[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) pageCount++;
    }
    
    // Ensure at least 1 page
    return Math.max(1, pageCount);
  }

  // Extract text from a specific page
  function extractPageText(arrayBuffer, pageNumber) {
    // For this implementation, we'll use text extraction based on PDF format patterns
    // This is a simplified approach
    var view = new Uint8Array(arrayBuffer);
    var textChunks = [];
    
    // Look for text between "BT" and "ET" markers
    var btPattern = [66, 84]; // "BT"
    var etPattern = [69, 84]; // "ET"
    
    for (var i = 0; i < view.length - 2; i++) {
      // Find BT marker
      if (view[i] === btPattern[0] && view[i+1] === btPattern[1]) {
        var startPos = i + 2;
        // Find corresponding ET marker
        for (var j = startPos; j < view.length - 2; j++) {
          if (view[j] === etPattern[0] && view[j+1] === etPattern[1]) {
            // Extract content between BT and ET
            var textData = view.slice(startPos, j);
            var text = extractTextFromPDFData(textData);
            if (text) textChunks.push({ str: text });
            break;
          }
        }
      }
    }
    
    return { items: textChunks };
  }

  // Helper function to extract readable text from PDF data
  function extractTextFromPDFData(data) {
    try {
      // This is a simplified implementation
      // Convert bytes to string, filtering for printable ASCII
      var text = "";
      for (var i = 0; i < data.length; i++) {
        var charCode = data[i];
        if (charCode >= 32 && charCode <= 126) { // printable ASCII range
          text += String.fromCharCode(charCode);
        }
      }
      return text;
    } catch (e) {
      console.error('Error extracting text:', e);
      return "";
    }
  }

  return pdfjsLib;
}));
