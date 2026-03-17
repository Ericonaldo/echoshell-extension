// Chrome extension API mocks

global.chrome = {
  runtime: {
    sendMessage: jest.fn().mockResolvedValue({}),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    id: 'test-extension-id',
    getURL: jest.fn(path => `chrome-extension://test-id/${path}`),
    openOptionsPage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined)
    },
    session: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined)
    }
  },
  tabCapture: {
    getMediaStreamId: jest.fn().mockResolvedValue('test-stream-id')
  },
  offscreen: {
    createDocument: jest.fn().mockResolvedValue(undefined),
    hasDocument: jest.fn().mockResolvedValue(false),
    closeDocument: jest.fn().mockResolvedValue(undefined),
    Reason: {
      USER_MEDIA: 'USER_MEDIA',
      AUDIO_PLAYBACK: 'AUDIO_PLAYBACK'
    }
  },
  tabs: {
    sendMessage: jest.fn().mockResolvedValue({}),
    query: jest.fn().mockResolvedValue([]),
    get: jest.fn()
  },
  sidePanel: {
    open: jest.fn().mockResolvedValue(undefined)
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    }
  }
};

// Mock fetch
global.fetch = jest.fn();

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Note: Do NOT override global.Blob - jsdom's FormData requires the native Blob instance.
// Use jsdom's built-in Blob which is already available in the jsdom environment.

// Add TextEncoder/TextDecoder if not available (needed for streaming tests)
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock MediaRecorder
global.MediaRecorder = class MediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onerror = null;
  }
  start(interval) {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
  }
  requestData() {}
  static isTypeSupported() { return true; }
};

// Mock AudioContext
global.AudioContext = class AudioContext {
  constructor() {
    this.sampleRate = 44100;
  }
  createMediaStreamSource() {
    return {
      connect: jest.fn()
    };
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      connect: jest.fn(),
      getFloatTimeDomainData: jest.fn(arr => arr.fill(0)),
      getByteFrequencyData: jest.fn(arr => arr.fill(0))
    };
  }
  close() { return Promise.resolve(); }
};

// Mock navigator.mediaDevices
global.navigator.mediaDevices = {
  getUserMedia: jest.fn().mockResolvedValue({
    getTracks: jest.fn().mockReturnValue([{
      stop: jest.fn(),
      kind: 'audio'
    }])
  }),
  getDisplayMedia: jest.fn().mockResolvedValue({
    getVideoTracks: jest.fn().mockReturnValue([{
      stop: jest.fn(),
      kind: 'video'
    }]),
    getTracks: jest.fn().mockReturnValue([])
  })
};

// Mock ImageData
global.ImageData = class ImageData {
  constructor(dataOrWidth, widthOrHeight, height) {
    if (dataOrWidth instanceof Uint8ClampedArray) {
      this.data = dataOrWidth;
      this.width = widthOrHeight;
      this.height = height;
    } else {
      this.width = dataOrWidth;
      this.height = widthOrHeight;
      this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
    }
  }
};

// Mock canvas
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: jest.fn().mockReturnValue({
    putImageData: jest.fn(),
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1
    })
  }),
  toDataURL: jest.fn().mockReturnValue('data:image/png;base64,abc123')
};

const originalCreateElement = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation((tag) => {
  if (tag === 'canvas') return { ...mockCanvas };
  return originalCreateElement(tag);
});

