import { OPENAI_KEY } from "../env.js";/**
 * Generate speech from text using OpenAI's TTS API and play it back.
 * @param {string} text - The input text to be converted to speech.
 * @param {string} voice - One of: "nova", "shimmer", "echo", "onyx", "fable"
 * @returns {Promise<HTMLAudioElement>} - Resolves with the audio element after playback starts.
 */
export async function speak(text, voice = "echo") {
    console.log("Speaking ", text)
  if (!text || typeof text !== "string") throw new Error("Invalid input text");

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

  await audio.play();
  return audio; // Optional: return audio object if caller wants to do more
}
