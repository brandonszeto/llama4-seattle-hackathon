const conversationView = document.getElementById("conversation-view");
const userPromptInput = document.getElementById("user-prompt");
const sendButton = document.getElementById("send-button");
const resetButton = document.getElementById("reset-button");
const addContextButton = document.getElementById("add-context-button");
const fileUploadInput = document.getElementById("file-upload");
const fileNameDisplay = document.getElementById("file-name");
const showExtractedTextButton = document.getElementById("show-extracted-text");
const extractedTextPreview = document.getElementById("extracted-text-preview");

let conversationHistory = [];
let uploadedFile = null;
const SYSTEM_PROMPT = `You are an expert AI assistant designed to guide users through graphical user interfaces (GUIs).
Your primary function is to analyze screenshots of a user's screen and provide clear, step-by-step instructions to help them accomplish their stated goal.
Analyze the Screenshot: Carefully examine the provided screenshot to understand the current state of the application.
Provide Clear and Concise Instructions: Your instructions should be unambiguous and easy to follow. Refer to on-screen elements by their exact text or a clear description.
Your tone should be helpful, patient, and encouraging. You are an expert guide, here to make any software task easy for the user.`;

async function callLlamaAPI(text, base64Image) {
  const apiKey = "LLM|1878124186367381|PZsjlEaCaJBnU-mW9Uwt4J8jIdg";

  if (apiKey === "YOUR_LLAMA_API_KEY") {
    // displayMessage("API key not set. Please edit sidebar.js", "error");
    throw new Error("API Key not set");
  }

  const apiUrl = "https://api.llama.com/v1/chat/completions";
  let messagesForApi = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
  ];
  // Add file context if available
  if (uploadedFile) {
    try {
      // displayMessage(`Extracting content from file: ${uploadedFile.name}...`, "system");
      
      // Extract text content from the file
      const fileContent = await readFileContent(uploadedFile);      // Add file content to the system prompt to ensure it's used as context
      // Process the content to make it more digestible
      let processedContent = fileContent;
      
      // Check if the extracted content appears to be meaningful text
      if (!isMeaningfulText(processedContent)) {
        console.warn("⚠️ Extracted file content appears to be binary data or encoded text");
        // displayMessage(`Warning: The extracted content from "${uploadedFile.name}" doesn't appear to be readable text. Try a different PDF or check if the file is password-protected.`, "error");
        processedContent = `[The content of "${uploadedFile.name}" could not be extracted properly. The file may be encrypted, password-protected, or use an unsupported encoding.]`;
      }
      // If extracted content contains PDF structure metadata markers, it may indicate poor extraction
      else if (processedContent.includes('BT') && processedContent.includes('ET') && 
          processedContent.includes('obj') && processedContent.includes('endobj')) {
        console.log("Detected raw PDF structure in extracted text, attempting to clean...");
        // This is likely raw PDF structure data, not the human-readable content
        // Try to extract only the most likely human-readable parts
        const textParts = processedContent.match(/\((.*?)\)/g) || [];
        if (textParts.length > 0) {
          processedContent = textParts
            .map(part => part.substring(1, part.length - 1))
            .filter(part => part.length > 3) // Filter out very short strings
            .join(' ');
        }
      }

      // Clean up common PDF extraction artifacts
      processedContent = processedContent
        .replace(/\s+/g, ' ')  // Replace multiple whitespaces with single space
        .replace(/(\w)-\s+(\w)/g, '$1$2')  // Fix hyphenated words
        .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable ASCII characters
        .trim();
          const contextMessage = `
===== DOCUMENT CONTENT FROM "${uploadedFile.name}" =====
${processedContent}
===== END OF DOCUMENT CONTENT =====

The above text contains the actual content extracted from the uploaded file "${uploadedFile.name}". 
This is a ${uploadedFile.type} file and the text represents the visible content from the document.
When responding to questions about this document:
1. Focus on the specific content extracted from the document
2. Refer directly to information found in the document
3. If asked what's in the document, summarize the key information from the content above
4. Avoid discussing PDF structure or metadata unless specifically requested
5. If the extraction appears incomplete or contains errors, acknowledge this but still try to work with what's available

Use this content to answer the user's questions when relevant. 
`;
        // Add a message to inform the user that file context is being used
      const previewText = fileContent.length > 100 ? 
                          fileContent.substring(0, 100) + '...' : 
                          fileContent;
      
      // displayMessage(`Using context from file: ${uploadedFile.name}`, "system");      // Display the extracted content in console for debugging
      console.group("📄 Extracted Document Content");
      console.log("File name:", uploadedFile.name);
      console.log("File type:", uploadedFile.type);
      console.log("Raw content length:", fileContent.length);
      console.log("Processed content length:", processedContent.length);
      console.log("Content preview:", previewText);
      console.log("--- FULL EXTRACTED TEXT ---");
      console.log(processedContent);
      console.log("--- END OF EXTRACTED TEXT ---");
      console.groupEnd();
      
      // Add an easy way for users to see the extracted content
      // displayMessage(`Content extracted from file. Check browser console (F12 > Console tab) to view the full extracted text.`, "system");
      
      // If we have enough content, add it to the API payload
      if (processedContent.length > 20) {
        // Add file context to API payload as a system message for better context integration
        messagesForApi.push({
          role: "system",
          content: contextMessage
        });
      } else {
        // displayMessage("Warning: Very little content could be extracted from the file", "error");
      }
    } catch (error) {
      console.error("Error reading file content:", error);
      // displayMessage("Error processing file. Please try again.", "error");
    }
  }

  messagesForApi.push({
    role: "user",
    content: [
      { type: "text", text: text },
      {
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64Image}` },
      },
    ],
  });

  const bodyPayload = {
    model: "Llama-4-Maverick-17B-128E-Instruct-FP8",
    messages: messagesForApi,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `API Error: ${response.status} - ${errorData.detail || "Unknown error"}`,
      );
    }

    const responseData = await response.json();
    return responseData.completion_message.content.text;
  } catch (error) {
    console.error("Failed to call Llama API:", error);
    // displayMessage(`Error: ${error.message}`, "error");
    throw error;
  }
}

function displayMessage(text, role) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", `${role}-message`);
  messageDiv.textContent = text;
  conversationView.appendChild(messageDiv);
  conversationView.scrollTop = conversationView.scrollHeight;
}

function renderConversation() {
  conversationView.innerHTML = "";
  conversationHistory.forEach((turn) => {
    displayMessage(turn.content, turn.role);
  });
}

async function handleSendClick() {
  const userText = userPromptInput.value.trim();
  if (!userText) return;

  displayMessage(userText, "user");
  sendButton.disabled = true;
  sendButton.textContent = "Processing...";
  userPromptInput.value = "";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });
    const base64Image = dataUrl.split(",")[1];

    const assistantResponse = await callLlamaAPI(userText, base64Image);

    displayMessage(assistantResponse, "assistant");

    conversationHistory.push({ role: "user", content: userText });
    conversationHistory.push({ role: "assistant", content: assistantResponse });
    await saveConversation();
  } catch (error) {
    console.error("An error occurred in handleSendClick:", error);
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Capture & Ask Meta";
    userPromptInput.focus();
  }
}

async function saveConversation() {
  await chrome.storage.local.set({ conversationHistory });
}

async function loadConversation() {
  const data = await chrome.storage.local.get("conversationHistory");
  if (data.conversationHistory) {
    conversationHistory = data.conversationHistory;
    renderConversation();
  }
}

// Function to load saved file context
async function loadFileContext() {
  try {
    const data = await chrome.storage.local.get(["contextFileName", "contextFileType", "contextFileData", "extractedText"]);
      if (data.contextFileName && data.contextFileData && data.extractedText) {
      // Create a File object from stored data
      const fileBlob = dataURItoBlob(data.contextFileData);
      uploadedFile = new File([fileBlob], data.contextFileName, { type: data.contextFileType });
      
      // Update UI to show the file is loaded
      fileNameDisplay.innerHTML = `${data.contextFileName} <span class="remove-file">&times;</span>`;
      
      // Update the extracted text preview
      updateExtractedTextPreview(data.extractedText);
      
      // Reattach the remove event listener
      document.querySelector('.remove-file').addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedFile = null;
        fileNameDisplay.textContent = "";
        fileUploadInput.value = "";
        chrome.storage.local.remove(["contextFileName", "contextFileType", "contextFileData", "extractedText"]);
        // displayMessage("Context file removed", "system");
      });
      
      // displayMessage(`Loaded context from file: ${data.contextFileName}`, "system");
    }
  } catch (error) {
    console.error("Error loading file context:", error);
  }
}

// Helper function to convert data URI to Blob
function dataURItoBlob(dataURI) {
  // Check if dataURI is a valid base64 string
  if (!dataURI || typeof dataURI !== 'string' || !dataURI.includes(',')) {
    console.error('Invalid data URI format');
    return new Blob();
  }
  
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
  } catch (error) {
    console.error('Error converting data URI to Blob:', error);
    return new Blob();
  }
}

async function handleResetClick() {
  conversationHistory = [];
  conversationView.innerHTML = "";
  userPromptInput.value = "";
  await chrome.storage.local.remove("conversationHistory");
}

sendButton.addEventListener("click", handleSendClick);
resetButton.addEventListener("click", handleResetClick);
addContextButton.addEventListener("click", () => fileUploadInput.click());
fileUploadInput.addEventListener("change", handleFileUpload);
userPromptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSendClick();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadConversation();
  await loadFileContext();
  
  // Setup show extracted text button event handler
  showExtractedTextButton.addEventListener("click", toggleExtractedTextPreview);
});

// --- File Upload Handling ---
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  uploadedFile = file;
  fileNameDisplay.textContent = file.name;
    // Show file name and an X button to remove it
  fileNameDisplay.innerHTML = `<span id="file-name-text">${file.name}</span><span class="remove-file">&times;</span>`;
  
  // Add click handler to remove file
  document.querySelector('.remove-file').addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedFile = null;
    fileNameDisplay.textContent = "";
    fileUploadInput.value = "";
    chrome.storage.local.remove(["contextFileName", "contextFileType", "contextFileData", "extractedText"]);
    // displayMessage("Context file removed", "system");
  });    // Display that the file was uploaded
  // displayMessage(`Added context file: ${file.name}`, "system");
    // Add processing indicator
  fileNameDisplay.innerHTML = `<span id="file-name-text">${file.name}</span> <span class="processing-indicator">(Processing...)</span> <span class="remove-file">&times;</span>`;
  
  // Hide the preview button while processing
  showExtractedTextButton.style.display = "none";
  extractedTextPreview.style.display = "none";
  
  // Reattach the remove event listener since we updated the HTML
  document.querySelector('.remove-file').addEventListener('click', (e) => {
    e.stopPropagation();
    uploadedFile = null;
    fileNameDisplay.textContent = "";
    fileUploadInput.value = "";
    chrome.storage.local.remove(["contextFileName", "contextFileType", "contextFileData", "extractedText"]);
    // displayMessage("Context file removed", "system");
  });
  
  try {
    // Extract text content for direct use
    // displayMessage(`Extracting text from file...`, "system");
    const extractedText = await readFileContent(file);
    
    // Store both the file data (for recreation) and extracted text (for use)
    const fileData = await readAsBase64(file);
      // displayMessage(`File processed successfully!`, "system");
      // Remove processing indicator
    fileNameDisplay.innerHTML = `<span id="file-name-text">${file.name}</span><span class="remove-file">&times;</span>`;
    
    // Update the extracted text preview
    updateExtractedTextPreview(extractedText);
    showExtractedTextButton.style.display = "inline-block";
    
    // Reattach the remove event listener
    document.querySelector('.remove-file').addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedFile = null;
      fileNameDisplay.textContent = "";
      fileUploadInput.value = "";
      chrome.storage.local.remove(["contextFileName", "contextFileType", "contextFileData", "extractedText"]);
      // displayMessage("Context file removed", "system");
    });
    
    // Store file info in chrome.storage
    await chrome.storage.local.set({
      contextFileName: file.name,
      contextFileType: file.type,
      contextFileData: fileData,
      extractedText: extractedText
    });  } catch (error) {
    console.error("Error processing file:", error);
    // displayMessage(`Error processing file: ${error.message}`, "error");
    
    // Remove processing indicator even if error occurred
    fileNameDisplay.innerHTML = `${file.name} <span class="remove-file">&times;</span>`;
    
    // Reattach the remove event listener
    document.querySelector('.remove-file').addEventListener('click', (e) => {
      e.stopPropagation();
      uploadedFile = null;
      fileNameDisplay.textContent = "";
      fileUploadInput.value = "";
      chrome.storage.local.remove(["contextFileName", "contextFileType", "contextFileData", "extractedText"]);
      // displayMessage("Context file removed", "system");
    });
  }
}

// Function to read file as base64 for storage
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// Function to read file content based on file type
async function readFileContent(file) {
  return new Promise(async (resolve, reject) => {
    try {
      // First attempt server-side processing
      const serverUrl = "http://localhost:5000/process-document";
      
      try {
        // displayMessage(`Sending file to server for processing...`, "system");
        console.log("🌐 Attempting server-side extraction...");
        
        // Convert file to base64
        const fileData = await readAsBase64(file);
        
        // Send to server
        const response = await fetch(serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            content: fileData
          })
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (result.success && result.text) {
          console.log("✅ Server-side extraction successful, length:", result.text.length);
          resolve(result.text);
          return;
        } else {
          throw new Error(result.error || "Server extraction failed");
        }
      } catch (serverError) {
        console.error("❌ Server-side extraction failed:", serverError);
        // displayMessage(`Server processing failed, falling back to browser extraction...`, "system");
        
        // If server fails, fall back to client-side processing
        if (file.type === 'application/pdf') {
          // For PDF files, try multiple extraction methods
          try {
            // First try direct extraction which is more reliable in browser extensions
            directExtractText(file).then(resolve).catch((error) => {
              console.log("Direct extraction failed, falling back to PDF.js:", error);
              // Fall back to PDF.js approach
              console.log("🔄 Falling back to PDF.js extraction");
              const reader = new FileReader();
              reader.onload = async (event) => {
                try {
                  const arrayBuffer = event.target.result;
                  console.log("⏳ Starting PDF.js extraction...");
                  const text = await extractTextFromPDF(arrayBuffer);
                  console.log("✅ PDF.js extraction complete, length:", text.length);
                  
                  // Verify that the text looks meaningful
                  if (isMeaningfulText(text)) {
                    resolve(text);
                  } else {
                    throw new Error("Extracted text doesn't appear to be readable");
                  }
                } catch (pdfError) {
                  console.error("❌ Standard extraction methods failed:", pdfError);
                  
                  // Try robust fallback extraction for problematic PDFs
                  try {
                    console.log("🔄 Trying robust fallback methods...");
                    const fallbackText = await extractTextWithRobustFallbacks(file);
                    if (fallbackText && fallbackText.length > 50) {
                      resolve(fallbackText);
                    } else {
                      throw new Error("Fallback extraction yielded insufficient text");
                    }
                  } catch (fallbackError) {
                    console.error("❌ All extraction methods failed:", fallbackError);
                    reject(fallbackError);
                  }
                }
              };
              reader.onerror = (readerError) => {
                console.error("Error reading file:", readerError);
                reject(readerError);
              };
              reader.readAsArrayBuffer(file);
            });
          } catch (error) {
            console.error("Error initiating PDF extraction:", error);
            reject(error);
          }
        } else if (file.type === 'application/msword' || 
                  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          // For Word documents
          const reader = new FileReader();
          reader.onload = (event) => {
            // Since we can't easily extract text from DOC/DOCX in browser
            // We'll let user know the file is being processed but content might be limited
            resolve(`[Document content from ${file.name}. Please ask questions about this document.]`);
          };
          reader.onerror = (error) => {
            console.error("Error reading file:", error);
            reject(error);
          };
          reader.readAsText(file);
        } else {
          // For text files
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve(event.target.result);
          };
          reader.onerror = (error) => {
            console.error("Error reading file:", error);
            reject(error);
          };
          reader.readAsText(file);
        }
      }
    } catch (error) {
      reject(error);
    }
  });
}

// Function to extract text from PDF using PDF.js
async function extractTextFromPDF(arrayBuffer) {
  try {
    // Try extracting with PDF.js first
    try {
      console.log("Attempting to extract PDF text with PDF.js");
      // Using the PDF.js library loaded in the HTML
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let textContent = '';
        // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          
          // Check if getTextContent exists
          if (typeof page.getTextContent !== 'function') {
            console.warn("page.getTextContent is not a function, using alternative method");
            throw new Error("page.getTextContent is not a function");
          }
          
          const content = await page.getTextContent();
          if (!content || !content.items) {
            console.warn("Invalid content structure");
            throw new Error("Invalid content structure");
          }
          
          const strings = content.items.map(item => item.str || "");
          textContent += strings.join(' ') + '\n\n';
        } catch (pageError) {
          console.warn(`Error extracting text from page ${i}:`, pageError);
          // Continue with next page
        }
      }
      
      if (textContent.trim().length > 0) {
        console.log("Successfully extracted PDF text with PDF.js:", textContent.substring(0, 200) + "..."); 
        return textContent;
      } else {
        throw new Error("No text extracted with PDF.js");
      }
    } catch (pdfJsError) {
      console.warn("PDF.js extraction failed, trying alternative method:", pdfJsError);
      // Fallback to alternative extraction method
      return extractTextFromPDFAlternative(arrayBuffer);
    }  } catch (error) {
    console.error("All PDF extraction methods failed:", error);
    
    // Try one more desperate approach - just look for any text in the binary data
    try {
      console.log("Attempting last-resort text extraction");
      const view = new Uint8Array(arrayBuffer);
      let rawText = "";
      let inTextSequence = false;
      let textSequence = "";
      
      for (let i = 0; i < view.length; i++) {
        const charCode = view[i];
        
        // Look for sequences of printable ASCII characters
        if (charCode >= 32 && charCode <= 126) {
          inTextSequence = true;
          textSequence += String.fromCharCode(charCode);
        } else {
          if (inTextSequence && textSequence.length >= 4) {
            // If sequence looks like a word
            if (/[a-zA-Z]{2,}/.test(textSequence)) {
              rawText += textSequence + " ";
            }
          }
          inTextSequence = false;
          textSequence = "";
        }
      }
      
      if (rawText.length > 50) {
        console.log("Last-resort extraction found some text:", rawText.substring(0, 100) + "...");
        return rawText;
      }
    } catch (lastError) {
      console.error("Last-resort extraction also failed:", lastError);
    }
    
    return `[This PDF document appears to contain images or scanned text that couldn't be extracted. You may ask questions about what you can see in the PDF document.]`;
  }
}

// Alternative text extraction for PDFs
function extractTextFromPDFAlternative(arrayBuffer) {
  try {
    console.log("Using alternative PDF text extraction method");
    const view = new Uint8Array(arrayBuffer);
    let text = "";
    
    // First, let's try to detect text using common PDF text indicators
    // Look for TJ operator and BT/ET text blocks which are common in PDF text
    const textMarkers = [
      {start: [47, 84, 106], name: "TJ operator"}, // /TJ
      {start: [66, 84], name: "BT block"}, // BT (Begin Text)
      {start: [84, 106], name: "Tj operator"} // Tj
    ];
    
    const words = new Set();
    const wordPattern = /[a-zA-Z]{3,}/g;
    
    // Convert array buffer to string for more pattern matching
    const pdfString = new TextDecoder().decode(view);
    
    // Regular expression pattern for potentially extracting text from PDF
    const textBlockPattern = /BT\s*\[(.*?)\]\s*TJ|BT\s*\((.*?)\)\s*Tj/gs;
    const matches = pdfString.matchAll(textBlockPattern);
    
    for (const match of matches) {
      const content = match[1] || match[2] || "";
      if (content) {
        // Clean up common PDF encoding issues
        const cleaned = content
          .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
          .replace(/\\n/g, "\n")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")");
          
        text += cleaned + " ";
      }
    }
    
    // If that didn't work, try simpler approach with character extraction
    if (text.trim().length < 50) {
      console.log("First pass extraction insufficient, trying character-based extraction");
      
      // Simple pattern matching for text streams in PDF
      const stringStart = [40]; // '('
      const stringEnd = [41];   // ')'
      
      for (let i = 0; i < view.length - 2; i++) {
        // Look for string patterns
        if (view[i] === stringStart[0]) {
          let startPos = i + 1;
          // Find corresponding end marker
          let depth = 1; // Handle nested parentheses
          for (let j = startPos; j < Math.min(startPos + 2000, view.length); j++) {
            if (view[j] === 92) { // backslash escape
              j++; // Skip next character
              continue;
            }
            if (view[j] === stringStart[0]) {
              depth++;
            } else if (view[j] === stringEnd[0]) {
              depth--;
              if (depth === 0) {
                // Extract potential text
                let textChunk = "";
                for (let k = startPos; k < j; k++) {
                  if (view[k] === 92 && k + 1 < j) { // backslash
                    // Handle octal escapes
                    if (view[k+1] >= 48 && view[k+1] <= 57) { // 0-9
                      let octal = "";
                      for (let o = 0; o < 3 && k+1+o < j && view[k+1+o] >= 48 && view[k+1+o] <= 57; o++) {
                        octal += String.fromCharCode(view[k+1+o]);
                      }
                      if (octal) {
                        textChunk += String.fromCharCode(parseInt(octal, 8));
                        k += octal.length;
                      }
                    } else {
                      // Skip escape and include next character directly
                      k++;
                      if (view[k] >= 32 && view[k] <= 126) {
                        textChunk += String.fromCharCode(view[k]);
                      }
                    }
                  } else if (view[k] >= 32 && view[k] <= 126) { // printable ASCII
                    textChunk += String.fromCharCode(view[k]);
                  }
                }
                
                // If chunk looks like actual text (not binary data)
                if (textChunk.length > 3) {
                  // Extract words that look like English
                  const matches = textChunk.match(wordPattern);
                  if (matches && matches.length > 0) {
                    matches.forEach(word => words.add(word));
                    text += textChunk + " ";
                  }
                }
                break;
              }
            }
          }
        }
      }
    }
    
    // Add any additional words found
    if (words.size > 0) {
      text += " " + Array.from(words).join(" ");
    }
    
    // Final cleaning
    text = text
      .replace(/\s+/g, ' ')
      .replace(/(\w)-\s+(\w)/g, '$1$2')
      .trim();
      
    console.log("Alternative extraction result:", text.substring(0, 200) + "...");
    
    // If we found some text, return it, otherwise throw error to trigger user message
    if (text.trim().length > 30) {
      return text;
    } else {
      throw new Error("Alternative extraction found insufficient text");
    }
  } catch (error) {
    console.error("Alternative PDF extraction failed:", error);
    throw error; // Let the main function handle this
  }
}

// Direct text extraction from PDFs without relying on PDF.js
function directExtractText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(event) {      try {
        console.log("🔍 Starting direct text extraction");
        const arrayBuffer = event.target.result;
        const view = new Uint8Array(arrayBuffer);
        console.log("📊 File size:", view.length, "bytes");
        
        // Combine multiple extraction methods to get more complete text
        let results = [];
        
        // Extract parenthesized text (usually contains the actual visible text)
        const parenthesisText = extractParenthesizedText(view);
        if (parenthesisText && parenthesisText.length > 50) {
          results.push(parenthesisText);
        }
        
        // Look for text between BT and ET markers (BeginText/EndText operators)
        const btEtText = extractTextBetweenMarkers(view, [66, 84], [69, 84]); 
        if (btEtText && btEtText.length > 50) {
          results.push(btEtText);
        }
        
        // Extract all printable ASCII as a fallback
        const asciiText = extractASCIIText(view);
        if (asciiText && asciiText.length > 50) {
          results.push(asciiText);
        }
          // Process the results to get the best text
        if (results.length > 0) {
          // Sort by length (descending) and get the longest result
          results.sort((a, b) => b.length - a.length);
          
          // Take the longest result as it likely has the most content
          const text = results[0];
          console.log("✅ Direct extraction succeeded, text length:", text.length);
          console.log("📝 Sample from start:", text.substring(0, 100) + "...");
          
          // Check if the extracted text appears to be meaningful
          if (!isMeaningfulText(text)) {
            console.warn("⚠️ Extracted text appears to be binary or encoded data, not meaningful text");
            reject(new Error("Extracted content doesn't appear to be readable text"));
            return;
          }
          
          // Further clean the text to make it more readable
          const cleaned = text
            .replace(/\\n/g, '\n')  // Convert escaped newlines
            .replace(/\\r/g, '')    // Remove carriage returns
            .replace(/\\t/g, ' ')   // Convert tabs to spaces
            .replace(/\\/g, '')     // Remove remaining backslashes
            .replace(/\s+/g, ' ')   // Normalize whitespace
            .replace(/\(|\)/g, '')  // Remove parentheses
            .trim();
          
          resolve(cleaned);
        } else {
          reject(new Error("Direct extraction found insufficient text"));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = function(event) {
      reject(new Error("FileReader error: " + event.target.error));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Fallback method for problematic PDFs 
async function extractTextWithRobustFallbacks(file) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🔍 Attempting robust fallback extraction for problematic PDF");
      
      // Try different approaches and use the first one that works
      let extractionMethods = [
        // Method 1: Direct binary analysis with stricter text criteria
        async () => {
          const buffer = await readAsArrayBuffer(file);
          const view = new Uint8Array(buffer);
          
          // Look specifically for text chunks between stream and endstream
          let textChunks = [];
          let inStream = false;
          let startPos = 0;
          
          for (let i = 0; i < view.length - 10; i++) {
            // Check for "stream" marker
            if (!inStream && 
                view[i] === 115 && view[i+1] === 116 && 
                view[i+2] === 114 && view[i+3] === 101 && 
                view[i+4] === 97 && view[i+5] === 109) {
              inStream = true;
              startPos = i + 6;
              i += 5;
            } 
            // Check for "endstream" marker
            else if (inStream && 
                    view[i] === 101 && view[i+1] === 110 && 
                    view[i+2] === 100 && view[i+3] === 115 && 
                    view[i+4] === 116 && view[i+5] === 114 && 
                    view[i+6] === 101 && view[i+7] === 97 && 
                    view[i+8] === 109) {
              inStream = false;
              
              // Extract text from this stream
              const streamBytes = view.slice(startPos, i);
              try {
                // Try to decode as UTF-8
                const decoder = new TextDecoder('utf-8');
                const streamText = decoder.decode(streamBytes);
                
                // Only keep if it looks like text (contains words and spaces)
                if (/[a-zA-Z]{3,}/.test(streamText) && /\s/.test(streamText)) {
                  textChunks.push(streamText);
                }
              } catch (e) {
                console.log("Stream decoding error:", e);
              }
              
              i += 8;
            }
          }
          
          return textChunks.join("\n\n");
        },
        
        // Method 2: Extract text as plain text ignoring PDF structure
        async () => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              const text = event.target.result;
              
              // Extract sequences that look like words
              const wordMatches = text.match(/[a-zA-Z]{3,}[a-zA-Z\s\.,:;!?]{2,}/g) || [];
              if (wordMatches.length > 0) {
                resolve(wordMatches.join(" "));
              } else {
                resolve("");
              }
            };
            reader.onerror = () => resolve("");
            reader.readAsText(file);
          });
        }
      ];
      
      // Try each extraction method until one succeeds
      for (const method of extractionMethods) {
        try {
          const result = await method();
          if (result && result.length > 50 && isMeaningfulText(result)) {
            console.log("✅ Fallback extraction succeeded with length:", result.length);
            return resolve(result);
          }
        } catch (err) {
          console.log("Fallback method failed:", err);
        }
      }
      
      // If all fallbacks fail
      reject(new Error("All robust extraction methods failed"));
    } catch (err) {
      reject(err);
    }
  });
}

// Helper to read file as ArrayBuffer
function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsArrayBuffer(file);
  });
}


// Helper for BT/ET text blocks in PDFs
function extractTextBetweenMarkers(view, startMarker, endMarker) {
  let result = "";
  
  for (let i = 0; i < view.length - startMarker.length; i++) {
    // Check for start marker
    let isStartMatch = true;
    for (let j = 0; j < startMarker.length; j++) {
      if (view[i + j] !== startMarker[j]) {
        isStartMatch = false;
        break;
      }
    }
    
    if (isStartMatch) {
      // Find end marker
      for (let k = i + startMarker.length; k < view.length - endMarker.length; k++) {
        let isEndMatch = true;
        for (let m = 0; m < endMarker.length; m++) {
          if (view[k + m] !== endMarker[m]) {
            isEndMatch = false;
            break;
          }
        }
        
        if (isEndMatch) {
          // Extract text between markers
          const textBytes = view.slice(i + startMarker.length, k);
          let blockText = "";
          
          for (let n = 0; n < textBytes.length; n++) {
            if (textBytes[n] >= 32 && textBytes[n] <= 126) {
              blockText += String.fromCharCode(textBytes[n]);
            }
          }
          
          // Only add text that looks meaningful
          if (blockText.length > 3 && /[a-zA-Z]{2,}/.test(blockText)) {
            result += blockText + " ";
          }
          
          i = k + endMarker.length - 1; // Skip to after this block
          break;
        }
      }
    }
  }
  
  return result;
}

// Helper for parenthesized text in PDFs
function extractParenthesizedText(view) {
  let result = "";
  const textSegments = [];
  
  for (let i = 0; i < view.length - 1; i++) {
    if (view[i] === 40) { // '('
      let j = i + 1;
      let text = "";
      let depth = 1;
      
      while (j < view.length && depth > 0) {
        if (view[j] === 92) { // backslash
          j++; // Skip escape character
          if (j < view.length) {
            if (view[j] === 110) { // \n
              text += '\n';
            } else if (view[j] === 114) { // \r
              // Ignore carriage return
            } else if (view[j] === 116) { // \t
              text += ' ';
            } else if (view[j] >= 32 && view[j] <= 126) {
              text += String.fromCharCode(view[j]);
            }
            j++;
          }
        } else if (view[j] === 40) { // '('
          depth++;
          text += '(';
          j++;
        } else if (view[j] === 41) { // ')'
          depth--;
          if (depth > 0) {
            text += ')';
          }          j++;
        } else if (view[j] >= 32 && view[j] <= 126) {
          text += String.fromCharCode(view[j]);
          j++;
        } else {
          j++;
        }
      }
      
      // Only keep text segments that look meaningful
      if (text.length > 2) {
        // Check if text contains readable content (at least some letters)
        if (/[a-zA-Z]{2,}/.test(text)) {
          textSegments.push(text);
        }
      }      
      i = j - 1;
    }
  }
  
  // Process the collected text segments
  if (textSegments.length > 0) {
    // Sort by length (longer segments are more likely to be actual content)
    textSegments.sort((a, b) => b.length - a.length);
    
    // Filter out segments that are too similar to avoid repetition
    const uniqueSegments = [];
    for (const segment of textSegments) {
      // Only add if it's not too similar to existing segments
      let isDuplicate = false;
      for (const existing of uniqueSegments) {
        if (segment.includes(existing) || existing.includes(segment)) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        uniqueSegments.push(segment);
      }
    }
    
    // Join segments, attempt to detect when new paragraphs or sections start
    // More likely to be a new paragraph/section if:
    // - Begins with capital letter
    // - Previous segment ends with period
    result = uniqueSegments.map((segment, i) => {
      if (i > 0) {
        const prevEndsWithPeriod = /[.!?]$/.test(uniqueSegments[i-1]);
        const startsWithCapital = /^[A-Z]/.test(segment);
        return (prevEndsWithPeriod && startsWithCapital) ? '\n\n' + segment : ' ' + segment;
      }
      return segment;
    }).join('');
  }
  
  return result;
}

// Helper for ASCII text
function extractASCIIText(view) {
  let result = "";
  let currentWord = "";
  let wordCount = 0;
  
  for (let i = 0; i < view.length; i++) {
    if ((view[i] >= 65 && view[i] <= 90) || (view[i] >= 97 && view[i] <= 122)) {
      // Letter
      currentWord += String.fromCharCode(view[i]);
    } else if (view[i] === 32 || view[i] === 9 || view[i] === 10 || view[i] === 13) {
      // Space or tab or newline
      if (currentWord.length > 2) {
        result += currentWord + " ";
        wordCount++;
      }
      currentWord = "";
    } else {
      // Other characters
      if (currentWord.length > 2) {
        result += currentWord + " ";
        wordCount++;
      }
      currentWord = "";
    }
  }
  
  if (currentWord.length > 2) {
    result += currentWord;
    wordCount++;
  }
  
  console.log(`Extracted ${wordCount} words using ASCII method`);
  return result;
}

// Function to toggle the extracted text preview
function toggleExtractedTextPreview() {
  if (extractedTextPreview.style.display === "none") {
    extractedTextPreview.style.display = "block";
    showExtractedTextButton.textContent = "Hide Extracted Text";
  } else {
    extractedTextPreview.style.display = "none";
    showExtractedTextButton.textContent = "Show Extracted Text";
  }
}

// Function to update the extracted text preview
function updateExtractedTextPreview(text) {
  // Check if the text appears to be meaningful
  if (text && !isMeaningfulText(text)) {
    extractedTextPreview.innerHTML = text;
  } else {
    extractedTextPreview.textContent = text;
  }
  
  showExtractedTextButton.style.display = "inline-block";
}

// Function to check if text appears to be binary or encoded garbage
function isMeaningfulText(text) {
  if (!text || text.length < 10) return false;
  
  // Check the ratio of printable ASCII characters
  let printableCount = 0;
  for (let i = 0; i < Math.min(text.length, 1000); i++) {
    const code = text.charCodeAt(i);
    // Count standard ASCII printable characters
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      printableCount++;
    }
  }
  
  const sampleLength = Math.min(text.length, 1000);
  const printableRatio = printableCount / sampleLength;
  
  // Check for common text patterns
  const hasWords = /[a-zA-Z]{2,}/.test(text); // Contains word-like patterns
  const hasSpaces = /\s/.test(text); // Contains whitespace
  const hasExcessiveSymbols = /%|@|\^|~|\{|\}|\[|\]/.test(text.substring(0, 100)); // Many unusual symbols early on
  
  // If text has many non-standard characters or looks like encoded/binary data
  if (printableRatio < 0.7 || !hasWords || !hasSpaces || hasExcessiveSymbols) {
    
    return false;
  }
  
  return true;
}
