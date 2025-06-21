import React, { useState, useRef, useEffect } from "react";
import DocumentationInput from "./components/DocumentationInput";
import ScreenCaptureFlow from "./components/ScreenCaptureFlow";
import StepInstructions from "./components/StepInstructions";
import Summary from "./components/Summary";
import "./App.css";

function App() {
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [summary, setSummary] = useState(null);
  const [docLink, setDocLink] = useState("");
  const [flowStarted, setFlowStarted] = useState(false);

  // Chatbot UI state
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi! How can I help you with your software usage guide?" }
  ]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [screenSocket, setScreenSocket] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // File upload handler
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Voice mode: record audio
  const handleRecord = async () => {
    if (isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new window.MediaRecorder(stream);
    let chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      setAudioURL(URL.createObjectURL(blob));
      // Here you can send the audio blob to backend for ASR
    };
    recorder.start();
    setMediaRecorder(recorder);
    setIsRecording(true);
  };

  // Screen share (WebRTC signaling)
  const handleScreenShare = async () => {
    if (screenSocket) return;
    const ws = new window.WebSocket("ws://localhost:5000/ws/signal");
    ws.onopen = () => {
      // Start screen capture
      navigator.mediaDevices.getDisplayMedia({ video: true }).then((stream) => {
        // You can display the stream in a video element or send signaling data
        // For demo, just notify
        ws.send(JSON.stringify({ type: "screen-share", message: "Screen sharing started" }));
      });
    };
    setScreenSocket(ws);
  };

  // Chatbot send
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !file && !audioURL) return;
    const userMsg = { sender: "user", text: input, file: file?.name, audio: audioURL };
    setMessages((msgs) => [...msgs, userMsg]);
    // Send text and file/audio to backend
    let botMsg = { sender: "bot", text: "..." };
    setMessages((msgs) => [...msgs, botMsg]);
    try {
      let response;
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        response = await fetch("http://localhost:5000/api/upload", {
          method: "POST",
          body: formData
        });
        const data = await response.json();
        botMsg = { sender: "bot", text: `File uploaded: ${data.filename}` };
      } else if (audioURL) {
        // Placeholder: send audio blob to backend for ASR
        botMsg = { sender: "bot", text: "(Voice message sent, ASR not implemented in demo)" };
      } else {
        response = await fetch("http://localhost:5000/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: input })
        });
        const data = await response.json();
        botMsg = { sender: "bot", text: data.choices?.[0]?.message?.content || data.response || JSON.stringify(data) };
      }
      setMessages((msgs) => [...msgs.slice(0, -1), botMsg]);
    } catch (err) {
      setMessages((msgs) => [...msgs.slice(0, -1), { sender: "bot", text: "Sorry, I couldn't reach the server." }]);
    }
    setInput("");
    setFile(null);
    setAudioURL(null);
  };

  return (
    <div className="chatgpt-bg">
      <div className="chatgpt-container">
        <h1 className="chatgpt-title">Software Usage Guide</h1>
        <div className="chatgpt-chatbox">
          {messages.map((msg, i) => (
            <div key={i} className={`chatgpt-msg ${msg.sender}`}>{msg.text}
              {msg.file && <div className="chatgpt-file">📎 {msg.file}</div>}
              {msg.audio && <audio src={msg.audio} controls style={{ width: '100%' }} />}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form className="chatgpt-input-row" onSubmit={sendMessage}>
          <input
            className="chatgpt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question..."
            autoFocus
          />
          <label className="chatgpt-attach">
            📎
            <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
          </label>
          <button type="button" className={`chatgpt-voice${isRecording ? " recording" : ""}`} onClick={handleRecord} title="Voice mode">
            🎤
          </button>
          <button type="button" className="chatgpt-screen" onClick={handleScreenShare} title="Screen share">
            🖥️
          </button>
          <button className="chatgpt-send" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default App;
