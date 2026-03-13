/**
 * AudioWorkletProcessor for Gemini Live audio capture
 * Replaces deprecated ScriptProcessorNode with modern AudioWorklet API
 *
 * This runs in a separate thread for better performance and stability
 */

class GeminiAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isMuted = false;
    this.packetCount = 0;

    // Listen for mute commands from main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'setMuted') {
        this.isMuted = event.data.value;
      }
    };
  }

  /**
   * Process audio in 128-sample chunks
   * @param {Float32Array[][]} inputs - Input audio buffers
   * @param {Float32Array[][]} outputs - Output audio buffers
   * @param {Object} parameters - Audio parameters
   * @returns {boolean} - true to keep processor alive
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const inputData = input[0]; // Mono channel

    // Don't process if muted
    if (this.isMuted) return true;

    // Calculate RMS (Root Mean Square) for volume detection
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) {
      sum += inputData[i] * inputData[i];
    }
    const rms = Math.sqrt(sum / inputData.length);

    // Convert Float32Array to PCM16 base64
    const pcm16Data = this.float32ToPcm16(inputData);
    const base64Data = this.arrayBufferToBase64(pcm16Data);

    // Send audio data and RMS to main thread
    this.packetCount++;
    this.port.postMessage({
      type: 'audioData',
      data: base64Data,
      rms: rms,
      packetCount: this.packetCount
    });

    return true; // Keep processor alive
  }

  /**
   * Convert Float32 audio samples to PCM16 format
   * @param {Float32Array} float32Array
   * @returns {ArrayBuffer}
   */
  float32ToPcm16(float32Array) {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit PCM
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16.buffer;
  }

  /**
   * Convert ArrayBuffer to base64 string
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Register the processor
registerProcessor('gemini-audio-processor', GeminiAudioProcessor);
