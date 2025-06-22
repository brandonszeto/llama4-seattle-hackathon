// asr.js

const DEEPGRAM_API_KEY = "e038ecc755b662c1a80cdd5f18cbaf1f99063829"; // 🔐 Replace with actual key

/**
 * Transcribes audio using Deepgram API
 * @param {File} audioFile - An audio File object from <input type="file">
 * @returns {Promise<string>} Transcript string
 */
export async function transcribeAudio(audioFile) {
  if (!audioFile) {
    throw new Error("No file provided for transcription.");
  }

  const arrayBuffer = await audioFile.arrayBuffer();

  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
    {
      method: "POST",
      headers: {
        "Authorization": `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": audioFile.type || "audio/wav",
      },
      body: arrayBuffer
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Deepgram error: ${error}`);
  }

  const result = await response.json();
  const transcript = result.results.channels[0].alternatives[0].transcript;
  return transcript;
}
