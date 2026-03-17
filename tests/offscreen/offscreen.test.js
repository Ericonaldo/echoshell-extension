/**
 * Offscreen document tests
 */

describe('offscreen audio capture', () => {
  let messageHandlers;
  let mockMediaStream;
  let mockRecorder;

  beforeEach(() => {
    messageHandlers = [];
    chrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      messageHandlers.push(handler);
    });

    // Setup mock MediaStream
    mockMediaStream = {
      getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }]),
      getAudioTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
    };

    navigator.mediaDevices.getUserMedia.mockResolvedValue(mockMediaStream);

    jest.resetModules();
  });

  async function loadOffscreen() {
    await import('../../src/offscreen/offscreen.js');
    return messageHandlers[messageHandlers.length - 1];
  }

  test('registers onMessage listener', async () => {
    await loadOffscreen();
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  test('starts MediaRecorder when receiving START_AUDIO message', async () => {
    const handler = await loadOffscreen();
    const sendResponse = jest.fn();

    handler(
      {
        type: 'START_AUDIO',
        streamId: 'test-stream-id',
        sessionId: 'sess-1',
        settings: { provider: 'openai', apiKey: 'sk-key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      sendResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: expect.objectContaining({
          mandatory: expect.objectContaining({
            chromeMediaSource: 'tab',
            chromeMediaSourceId: 'test-stream-id'
          })
        })
      })
    );
  });

  test('STOP_AUDIO stops recorder and clears stream', async () => {
    const handler = await loadOffscreen();
    const startResponse = jest.fn();
    const stopResponse = jest.fn();

    // Start first
    handler(
      {
        type: 'START_AUDIO',
        streamId: 'test-stream',
        sessionId: 'sess-1',
        settings: { provider: 'openai', apiKey: 'sk-key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      startResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    // Stop
    handler({ type: 'STOP_AUDIO' }, {}, stopResponse);
    expect(stopResponse).toHaveBeenCalledWith({ success: true });
  });

  test('silent chunk does not trigger ASR API call', async () => {
    // Configure analyser to return silence
    const silentAnalyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: jest.fn(),
      getFloatTimeDomainData: jest.fn(arr => arr.fill(0)) // silence
    };

    global.AudioContext = class {
      get sampleRate() { return 44100; }
      createMediaStreamSource() { return { connect: jest.fn() }; }
      createAnalyser() { return silentAnalyser; }
      close() { return Promise.resolve(); }
    };

    const handler = await loadOffscreen();

    handler(
      {
        type: 'START_AUDIO',
        streamId: 'stream-1',
        sessionId: 'sess-1',
        settings: { provider: 'openai', apiKey: 'sk-key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      jest.fn()
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    // fetch should not have been called (silent audio skipped)
    expect(fetch).not.toHaveBeenCalled();
  });

  test('non-empty ASR response is sent as TRANSCRIPT_CHUNK', async () => {
    // Set up non-silent audio
    const noisyAnalyser = {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: jest.fn(),
      getFloatTimeDomainData: jest.fn(arr => arr.fill(0.5)) // loud signal
    };

    global.AudioContext = class {
      get sampleRate() { return 44100; }
      createMediaStreamSource() { return { connect: jest.fn() }; }
      createAnalyser() { return noisyAnalyser; }
      close() { return Promise.resolve(); }
    };

    fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ text: 'transcribed audio' })
    });

    const handler = await loadOffscreen();

    // Manually trigger data available event
    let dataHandler;
    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onerror = null;
      }
      start(interval) {
        this.state = 'recording';
        // Simulate data available
        setTimeout(() => {
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['audio data'], { type: 'audio/webm' }) });
          }
        }, 50);
      }
      stop() { this.state = 'inactive'; }
      requestData() {}
    };

    handler(
      {
        type: 'START_AUDIO',
        streamId: 'stream-1',
        sessionId: 'sess-1',
        settings: { provider: 'openai', apiKey: 'sk-key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      jest.fn()
    );

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TRANSCRIPT_CHUNK', text: 'transcribed audio' })
    );
  });

  test('rejects duplicate start (already recording)', async () => {
    const handler = await loadOffscreen();

    const firstStartResponse = jest.fn();
    const secondStartResponse = jest.fn();

    handler(
      {
        type: 'START_AUDIO',
        streamId: 'stream-1',
        sessionId: 'sess-1',
        settings: { provider: 'openai', apiKey: 'key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      firstStartResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    // Second start should be ignored (state guard)
    handler(
      {
        type: 'START_AUDIO',
        streamId: 'stream-2',
        sessionId: 'sess-2',
        settings: { provider: 'openai', apiKey: 'key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      secondStartResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));
    // getUserMedia should only be called once
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
  });

  test('MediaRecorder onerror sends ERROR message to background', async () => {
    let recorderInstance;
    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onerror = null;
        recorderInstance = this;
      }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; }
      requestData() {}
    };

    const handler = await loadOffscreen();

    handler(
      {
        type: 'START_AUDIO',
        streamId: 'stream-1',
        sessionId: 'sess-1',
        settings: { provider: 'openai', apiKey: 'key', endpoint: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' }
      },
      {},
      jest.fn()
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    // Trigger error
    if (recorderInstance && recorderInstance.onerror) {
      recorderInstance.onerror({ error: { message: 'recorder failed' } });
    }

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ERROR' })
    );
  });
});
