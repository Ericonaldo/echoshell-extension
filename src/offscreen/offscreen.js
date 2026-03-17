import { MSG, VAD_CONFIG } from '../utils/constants.js';
import { transcribeAudio } from '../utils/asr-client.js';
import { computeRMS } from '../utils/audio-utils.js';

let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let isRecording = false;
let sessionId = null;
let asrSettings = null;
let chunkTimer = null;

/**
 * Start audio capture from the given stream ID
 */
async function startAudioCapture(streamId, sid, settings) {
  if (isRecording) {
    console.warn('EchoShell: Already recording, ignoring start request');
    return;
  }

  sessionId = sid;
  asrSettings = settings;

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(audioStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        await processAudioChunk(audioChunks, analyser);
        audioChunks = [];
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error('EchoShell: MediaRecorder error:', event.error);
      chrome.runtime.sendMessage({
        type: MSG.ERROR,
        error: `MediaRecorder error: ${event.error?.message || 'unknown'}`
      });
    };

    mediaRecorder.start(VAD_CONFIG.CHUNK_INTERVAL_MS);
    isRecording = true;

    // Also set a periodic flush timer
    chunkTimer = setInterval(() => {
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.requestData();
      }
    }, VAD_CONFIG.CHUNK_INTERVAL_MS);

  } catch (err) {
    console.error('EchoShell: Failed to start audio capture:', err);
    chrome.runtime.sendMessage({
      type: MSG.ERROR,
      error: `Audio capture failed: ${err.message}`
    });
  }
}

/**
 * Process a chunk of audio and optionally send to ASR
 */
async function processAudioChunk(chunks, analyser) {
  if (!chunks || chunks.length === 0) return;

  const audioBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });

  // VAD: check if there's significant audio energy
  if (analyser) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    const rms = computeRMS(dataArray);

    if (rms < VAD_CONFIG.SILENCE_THRESHOLD) {
      // Silent chunk, skip API call
      return;
    }
  }

  try {
    const text = await transcribeAudio(audioBlob, asrSettings);
    if (text && text.trim()) {
      await chrome.runtime.sendMessage({
        type: MSG.TRANSCRIPT_CHUNK,
        text: text.trim(),
        timestamp: Date.now(),
        sessionId,
        source: 'asr'
      });
    }
  } catch (err) {
    console.error('EchoShell: ASR error:', err);
    chrome.runtime.sendMessage({
      type: MSG.ERROR,
      error: `Transcription failed: ${err.message}`
    });
  }
}

/**
 * Stop audio capture
 */
function stopAudioCapture() {
  if (chunkTimer) {
    clearInterval(chunkTimer);
    chunkTimer = null;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }

  mediaRecorder = null;
  audioChunks = [];
  isRecording = false;
  sessionId = null;
  asrSettings = null;
}

/**
 * Message handler
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case MSG.START_AUDIO:
      startAudioCapture(message.streamId, message.sessionId, message.settings)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case MSG.STOP_AUDIO:
      stopAudioCapture();
      sendResponse({ success: true });
      return false;

    default:
      return false;
  }
});
