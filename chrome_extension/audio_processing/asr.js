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


/**
 * Captures audio from the microphone and transcribes it using Deepgram API
 * @param {number} recordTimeMs - Duration to record in milliseconds (e.g., 5000 = 5 sec)
 * @returns {Promise<string>} Transcript string
 */
export async function transcribeFromMic(recordTimeMs = 5000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Browser does not support microphone access.");
  }

  // Request microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Record using MediaRecorder
  const mediaRecorder = new MediaRecorder(stream);
  const audioChunks = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop()); // stop the mic

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();

      try {
        const response = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
          {
            method: "POST",
            headers: {
              "Authorization": `Token ${DEEPGRAM_API_KEY}`,
              "Content-Type": "audio/webm",
            },
            body: arrayBuffer
          }
        );

        if (!response.ok) {
          const error = await response.text();
          reject(new Error(`Deepgram error: ${error}`));
          return;
        }

        const result = await response.json();
        const transcript = result.results.channels[0].alternatives[0].transcript;
        resolve(transcript);
      } catch (err) {
        reject(err);
      }
    };

    mediaRecorder.onerror = err => {
      reject(err.error || err);
    };

    // Start recording
    mediaRecorder.start();

    // Stop recording after specified duration
    setTimeout(() => {
      mediaRecorder.stop();
    }, recordTimeMs);
  });
}
