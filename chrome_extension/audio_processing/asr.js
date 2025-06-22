export const DEEPGRAM_API_KEY = "e038ecc755b662c1a80cdd5f18cbaf1f99063829";
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

/**
 * Continuously captures mic input and transcribes after silence is detected using Deepgram.
 * Calls `onTranscript(text)` for each utterance.
 */
export async function transcribeFromMicContinuous(onTranscript) {
  const SILENCE_THRESHOLD = 0.03;
  const SILENCE_MS = 1800;
  const CHUNK_MS = 1024 / 16000 * 1000; // ~64ms at 16kHz

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const input = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(1024, 1, 1);

  let mediaRecorder = null;
  let currentChunks = [];
  let recording = false;
  let silenceMs = 0;
  let shouldStop = false;

  const restartMediaRecorder = () => {
    currentChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) currentChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(currentChunks, { type: "audio/webm" });
      const arrayBuffer = await blob.arrayBuffer();

      try {
        const res = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${DEEPGRAM_API_KEY}`,
              "Content-Type": "audio/webm",
            },
            body: arrayBuffer,
          }
        );

        const json = await res.json();
        const transcript = json.results.channels[0].alternatives[0].transcript;
        console.log("🗣️", transcript);

        if (transcript.trim()) {
          onTranscript(transcript);
        }

        // Restart the recording loop

        recording = false;
        silenceMs = 0;
        restartMediaRecorder();
      } catch (err) {
        console.error("Transcription error:", err);
      }
    };
  };

  restartMediaRecorder();

  processor.onaudioprocess = e => {
    const inputData = e.inputBuffer.getChannelData(0);
    const rms = Math.sqrt(inputData.reduce((sum, s) => sum + s * s, 0) / inputData.length);

    if (rms > SILENCE_THRESHOLD) {
      if (!recording) {
        console.log("🎤 Recording started...");
        mediaRecorder.start();
        recording = true;
      }
      silenceMs = 0;
    } else if (recording) {
      silenceMs += CHUNK_MS;
      if (silenceMs > SILENCE_MS) {
        console.log("🛑 Silence detected, stopping...");
        mediaRecorder.stop();
      }
    }
  };

  input.connect(processor);
  processor.connect(audioContext.destination);
}
