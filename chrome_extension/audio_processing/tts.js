import { OPENAI_KEY } from "../env.js";
let currentAudio = null;

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
    console.log("🔇 TTS playback stopped");
  }
}

/**
 * Generate speech from text using OpenAI's TTS API and play it back.
 * @param {string} text - The input text to be converted to speech.
 * @param {string} voice - One of: "nova", "shimmer", "echo", "onyx", "fable"
 * @returns {Promise<HTMLAudioElement>} - Resolves with the audio element after playback starts.
 */
export async function speak(text, voice = "echo") {
  console.log("Speaking ", text)
  if (!text || typeof text !== "string") throw new Error("Invalid input text");

  // Stop any currently playing audio
  stopSpeaking();

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: voice,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS API error: ${response.status} - ${errorText}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  
  // Track the current audio
  currentAudio = audio;
  
  // Clean up when audio ends
  audio.addEventListener('ended', () => {
    if (currentAudio === audio) {
      currentAudio = null;
    }
    URL.revokeObjectURL(audioUrl);
  });

  await audio.play();
  return audio;
}

/**
 * Check if speech is currently playing
 */
export function isSpeaking() {
  return currentAudio && !currentAudio.paused;
}

