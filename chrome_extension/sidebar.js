import { speak } from "./audio_processing/tts.js";
import { transcribeFromMicContinuous, transcribeOnceFromMic, stopAllASR, startASR, getIsFirstSpeech, initSpeech } from './audio_processing/asr.js';
const conversationView = document.getElementById("conversation-view");
const userPromptInput = document.getElementById("user-prompt");
const sendButton = document.getElementById("send-button");
const resetButton = document.getElementById("reset-button");

let conversationHistory = [];
const SYSTEM_PROMPT = `You are an expert AI assistant designed to guide users through graphical user interfaces (GUIs) and can also perform actions on their behalf with confirmation.
Your capabilities include:
1. Analyzing screenshots and providing step-by-step instructions
2. Clicking buttons, links, and other clickable elements 
3. Filling text inputs, textareas, and form fields
4. Always requiring user confirmation before performing any action

When providing guidance:
- Analyze the screenshot carefully to understand the current state
- Provide clear, concise instructions referring to elements by their exact text
- Be helpful, patient, and encouraging

When taking actions:
- You can suggest performing actions like "I can click the 'Submit' button for you" 
- Always ask for confirmation before acting: "Would you like me to click/fill this for you?"
- Use specific selectors when possible (CSS selectors, button text, input labels)
- Describe what you're about to do clearly

Available action commands you can use:
- To click an element: Say "CLICK_ELEMENT: [CSS selector], [description]"
- To fill text: Say "FILL_TEXTBOX: [CSS selector], [text to fill], [description]"
- To highlight all interactive elements: Say "HIGHLIGHT_ELEMENTS"

Your tone should be helpful, patient, and encouraging. Always prioritize user safety by confirming actions.`;

let isListening = false;
const toggleAudioBtn = document.getElementById("toggle-audio-button");

toggleAudioBtn.addEventListener("click", async () => {
  if (isListening) {
    stopAllASR();
    toggleAudioBtn.textContent = "Start Mic";
    isListening = false;
    return;
  }

  startASR();
  toggleAudioBtn.textContent = "Stop Mic";
  isListening = true;

  try {
    if (getIsFirstSpeech()) {
      initSpeech();
      await speak("Hi there, I'm Llama your helpful assistant. You're in accessibility mode—let me know what I can help with!");
    }


    await transcribeFromMicContinuous((transcript) => {
      if (!isListening) return; // prevent any late response
      userPromptInput.value = transcript;
      handleSendClick();
    });
  } catch (err) {
    console.error("Transcription failed:", err);
  }
});
// document.getElementById("toggle-audio-button").addEventListener("click", async () => {
//   try {
//     await speak("Hi there, I'm Llama your helpful, (anything!) assistant. You're in accessibility mode, so let me know if there's anything I can help you with!")
//     await transcribeFromMicContinuous((transcript) => {
//       userPromptInput.value = transcript;
//       handleSendClick();
//     });
//   } catch (err) {
//     console.error("Transcription failed:", err);
//   }
// });

async function callLlamaAPI(text, base64Image, availableElements = []) {
  const apiKey = "LLM|1878124186367381|PZsjlEaCaJBnU-mW9Uwt4J8jIdg";

  if (apiKey === "YOUR_LLAMA_API_KEY") {
    displayMessage("API key not set. Please edit sidebar.js", "error");
    throw new Error("API Key not set");
  }

  const apiUrl = "https://api.llama.com/v1/chat/completions";

  let messagesForApi = [
    { role: "system", content: SYSTEM_PROMPT },
    ...conversationHistory,
  ];

  // Format elements list for Llama
  let elementsText = "";
  if (availableElements && availableElements.length > 0) {
    elementsText = "\n\nAVAILABLE INTERACTIVE ELEMENTS:\n";
    availableElements.forEach((el, index) => {
      if (el.type === 'clickable') {
        elementsText += `${index + 1}. CLICKABLE: "${el.text}" (selector: ${el.selector})\n`;
      } else if (el.type === 'input') {
        elementsText += `${index + 1}. INPUT: "${el.text}" - ${el.inputType} (selector: ${el.selector})\n`;
      }
    });
    elementsText += "\nWhen performing actions, use the EXACT selector provided above.\n";
  }

  messagesForApi.push({
    role: "user",
    content: [
      { type: "text", text: text + elementsText },
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
    displayMessage(`Error: ${error.message}`, "error");
    throw error;
  }
}

function displayMessage(text, role, interactive = false) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", `${role}-message`);

  if (interactive) {
    messageDiv.innerHTML = text; // Allow HTML for interactive content
  } else {
    messageDiv.textContent = text;
  }

  conversationView.appendChild(messageDiv);
  conversationView.scrollTop = conversationView.scrollHeight;
  return messageDiv;
}

const affirmativePhrases = [
  "yes", "confirm", "okay", "sure", "do it", "go ahead", "please", "yup", "yeah"
];

const negativePhrases = [
  "no", "cancel", "stop", "don't", "never mind", "nah", "abort"
];

function displayConfirmationMessage(message, onConfirm, onCancel) {
  const confirmText = `
    <div style="margin-bottom: 12px;">${message}</div>
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button class="confirm-cancel-btn" style="
        padding: 6px 12px;
        border: 1px solid #ddd;
        background: #f5f5f5;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Cancel</button>
      <button class="confirm-confirm-btn" style="
        padding: 6px 12px;
        border: 1px solid #007cba;
        background: #007cba;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Confirm</button>
    </div>
  `;

  const messageDiv = displayMessage(confirmText, "system", true);
  const cancelBtn = messageDiv.querySelector(".confirm-cancel-btn");
  const confirmBtn = messageDiv.querySelector(".confirm-confirm-btn");

  let cancelled = false;

  const stopListening = () => {
    cancelled = true;
    // Future-proof: manually stop ASR stream here if needed
    console.log("🛑 Stopping voice listener");
  };

  const handleVoiceConfirm = async () => {
    try {
      while (!cancelled) {
        const transcript = await transcribeOnceFromMic(); // assumed to resolve with string
        const normalized = transcript.trim().toLowerCase();

        if (affirmativePhrases.some(p => normalized.includes(p))) {
          console.log("✅ Heard confirmation:", normalized);
          messageDiv.remove();
          stopListening();
          return onConfirm();
        }

        if (negativePhrases.some(p => normalized.includes(p))) {
          console.log("❌ Heard cancellation:", normalized);
          messageDiv.remove();
          stopListening();
          return onCancel();
        }

        // Continue listening if uncertain
        displayMessage(`Heard: "${normalized}". Please say "yes" or "cancel".`, "system");
      }
    } catch (err) {
      console.error("🎙️ Voice input failed:", err);
    }
  };

  // Start audio transcription loop
  handleVoiceConfirm();

  // Manual UI button handlers
  cancelBtn.addEventListener("click", () => {
    messageDiv.remove();
    stopListening();
    onCancel();
  });

  confirmBtn.addEventListener("click", () => {
    messageDiv.remove();
    stopListening();
    onConfirm();
  });

  return messageDiv;
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

    // Get available interactive elements
    await ensureContentScriptLoaded(tab.id);
    const elementsResponse = await chrome.tabs.sendMessage(tab.id, {
      action: 'getInteractableElements'
    });

    const assistantResponse = await callLlamaAPI(userText, base64Image, elementsResponse.elements);
    // let messagedisplay  = assistantResponse
  let messageDisplay = assistantResponse
    .replace(/CLICK_ELEMENT:\s*[^,]+,\s*.+\n?/g, '')
    .replace(/FILL_TEXTBOX:\s*[^,]+,\s*[^,]+,\s*.+\n?/g, '')
    .replace(/HIGHLIGHT_ELEMENTS\n?/g, '')
    .replace(/\s*\(\s*$/g, '') // Remove trailing parentheses with optional whitespace
    .trim();

displayMessage(messageDisplay, "assistant");
await speak(messageDisplay);
    // displayMessage(assistantResponse, "assistant");
    // await speak(assistantResponse);

    // Process any action commands in the response
    await processActionCommands(assistantResponse);

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

async function handleResetClick() {
  conversationHistory = [];
  conversationView.innerHTML = "";
  userPromptInput.value = "";
  await chrome.storage.local.remove("conversationHistory");
}

sendButton.addEventListener("click", handleSendClick);
resetButton.addEventListener("click", handleResetClick);
userPromptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSendClick();
  }
});

// --- Action Processing Functions ---
async function processActionCommands(responseText) {
  const commands = [
    { pattern: /CLICK_ELEMENT:\s*([^,]+),\s*(.+)/g, type: 'click' },
    { pattern: /FILL_TEXTBOX:\s*([^,]+),\s*([^,]+),\s*(.+)/g, type: 'fill' },
    { pattern: /HIGHLIGHT_ELEMENTS/g, type: 'highlight' }
  ];

  for (const command of commands) {
    let match;
    while ((match = command.pattern.exec(responseText)) !== null) {
      await executeCommand(command.type, match);
    }
  }
}

async function executeCommand(type, match) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Ensure content script is injected
    await ensureContentScriptLoaded(tab.id);

    if (type === 'click') {
      const selector = match[1].trim();
      const description = match[2].trim();

      // First call to get confirmation info
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'clickElement',
        selector: selector,
        description: description,
        confirmed: false
      });

      if (response.needsConfirmation) {
        // Show confirmation in chat
        displayConfirmationMessage(
          `Do you want to click on: "${response.elementText}"?`,
          async () => {
            // User confirmed - execute the click
            try {
              const confirmResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'clickElement',
                selector: selector,
                description: description,
                confirmed: true
              });
              displayMessage(`✅ ${confirmResponse.message || confirmResponse.error}`, 'system');
            } catch (error) {
              displayMessage(`❌ Error: ${error.message}`, 'error');
            }
          },
          () => {
            // User cancelled
            displayMessage('❌ Action cancelled', 'system');
            // Remove highlight
            chrome.tabs.sendMessage(tab.id, { action: 'removeHighlights' });
          }
        );
      } else {
        displayMessage(`❌ ${response.error}`, 'error');
      }

    } else if (type === 'fill') {
      const selector = match[1].trim();
      const text = match[2].trim();
      const description = match[3].trim();

      // First call to get confirmation info
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'fillTextbox',
        selector: selector,
        text: text,
        description: description,
        confirmed: false
      });

      if (response.needsConfirmation) {
        // Show confirmation in chat
        displayConfirmationMessage(
          `Do you want to fill "${response.elementText}" with: "${text}"?`,
          async () => {
            // User confirmed - execute the fill
            try {
              const confirmResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'fillTextbox',
                selector: selector,
                text: text,
                description: description,
                confirmed: true
              });
              displayMessage(`✅ ${confirmResponse.message || confirmResponse.error}`, 'system');
            } catch (error) {
              displayMessage(`❌ Error: ${error.message}`, 'error');
            }
          },
          () => {
            // User cancelled
            displayMessage('❌ Action cancelled', 'system');
            // Remove highlight
            chrome.tabs.sendMessage(tab.id, { action: 'removeHighlights' });
          }
        );
      } else {
        displayMessage(`❌ ${response.error}`, 'error');
      }

    } else if (type === 'highlight') {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'highlightElements'
      });

      displayMessage('🔍 Interactive elements highlighted on the page', 'system');
    }
  } catch (error) {
    displayMessage(`❌ Error executing command: ${error.message}`, 'error');
  }
}

// Ensure content script is loaded
async function ensureContentScriptLoaded(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch (error) {
    // Content script not loaded, inject it
    console.log('Content script not found, injecting...');
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    // Wait a bit for the script to load
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// --- Additional UI Functions ---
function createActionButton(text, action) {
  const button = document.createElement('button');
  button.textContent = text;
  button.style.cssText = `
    margin: 5px;
    padding: 8px 12px;
    background: #007cba;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  `;
  button.addEventListener('click', action);
  return button;
}

let highlightsActive = false;

async function toggleHighlights() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await ensureContentScriptLoaded(tab.id);
    
    if (highlightsActive) {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'removeHighlights'
      });
      displayMessage('Highlights removed', 'system');
      highlightsActive = false;
    } else {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'highlightElements'
      });
      displayMessage('Interactive elements highlighted', 'system');
      highlightsActive = true;
    }
    
    // Update button text
    const toggleBtn = document.getElementById('toggle-highlights-btn');
    if (toggleBtn) {
      toggleBtn.textContent = highlightsActive ? 'Hide' : 'Reveal';
    }
  } catch (error) {
    displayMessage(`Error: ${error.message}`, 'error');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadConversation();

  // Add event listener for toggle highlights button
  document.getElementById('toggle-highlights-btn').addEventListener('click', toggleHighlights);
});
