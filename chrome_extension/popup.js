// --- Element References ---
const conversationView = document.getElementById("conversation-view");
const userPromptInput = document.getElementById("user-prompt");
const sendButton = document.getElementById("send-button");
const resetButton = document.getElementById("reset-button");
const addContextButton = document.getElementById("add-context-button");
const fileUploadInput = document.getElementById("file-upload");
const fileNameDisplay = document.getElementById("file-name");

// --- State Management ---
let conversationHistory = [];
let uploadedFile = null;
const SYSTEM_PROMPT = `You are an expert AI assistant designed to guide users through graphical user interfaces (GUIs).
Your primary function is to analyze screenshots of a user's screen and provide clear, step-by-step instructions to help them accomplish their stated goal.
Analyze the Screenshot: Carefully examine the provided screenshot to understand the current state of the application.
Provide Clear and Concise Instructions: Your instructions should be unambiguous and easy to follow. Refer to on-screen elements by their exact text or a clear description.
Your tone should be helpful, patient, and encouraging. You are an expert guide, here to make any software task easy for the user.`;

// --- API Call ---
async function callLlamaAPI(text, base64Image) {
  //
  // CRITICAL: REPLACE THE PLACEHOLDER TEXT WITH YOUR REAL API KEY
  //
  const apiKey = "LLM|1878124186367381|PZsjlEaCaJBnU-mW9Uwt4J8jIdg";

  if (apiKey === "YOUR_LLAMA_API_KEY") {
    displayMessage("API key not set. Please edit popup.js", "error");
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
      const fileContent = await readFileContent(uploadedFile);
      
      // Add a message to inform the user that file context is being used
      displayMessage(`Using context from file: ${uploadedFile.name}`, "system");
      
      // Add file context to API payload
      messagesForApi.push({
        role: "user",
        content: `Context from uploaded file "${uploadedFile.name}":\n${fileContent}`
      });
    } catch (error) {
      console.error("Error reading file content:", error);
      displayMessage("Error processing file. Please try again.", "error");
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
    displayMessage(`Error: ${error.message}`, "error");
    throw error;
  }
}

// --- UI and Event Handling ---
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
    sendButton.textContent = "Capture & Ask Llama";
    userPromptInput.focus();
  }
}

// --- Storage Functions ---
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

// --- Initial Setup ---
sendButton.addEventListener("click", handleSendClick);
resetButton.addEventListener("click", handleResetClick);
userPromptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    handleSendClick();
  }
});

document.addEventListener("DOMContentLoaded", loadConversation);
