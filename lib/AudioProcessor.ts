import { VISEMES } from '../types';

// These frequency ranges are estimates for different phonetic groups.
// They may require tuning for different microphones or voice types.
const VISEME_RANGES: Record<string, [number, number]> = {
  // Vowels
  [VISEMES.aa]: [800, 1200],
  [VISEMES.E]:  [450, 650],
  [VISEMES.I]:  [250, 450],
  [VISEMES.O]:  [650, 800],
  [VISEMES.U]:  [150, 250],
  
  // Consonants and other sounds
  [VISEMES.PP]: [100, 300],   // Bilabial plosives (p, b, m), low frequency
  [VISEMES.FF]: [4000, 6000], // Labiodental fricatives (f, v), high frequency
  [VISEMES.TH]: [5000, 8000], // Dental fricatives (th), very high frequency noise
  [VISEMES.DD]: [300, 700],   // Alveolar stops (d, t, n)
  [VISEMES.kk]: [1500, 4000], // Velar stops (k, g), mid-high frequency burst
  [VISEMES.CH]: [3000, 7000], // Palato-alveolar (ch, sh, j), broadband noise
  [VISEMES.SS]: [6000, 10000], // Alveolar fricatives (s, z), highest frequency noise
  [VISEMES.nn]: [100, 500],   // Nasals (n, m, ng), low frequency resonance
  [VISEMES.RR]: [1000, 2000], // Approximants (r, l)
};

// This class encapsulates the Web Audio API logic for lip-syncing.
export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array = new Uint8Array(0);
  private isProcessing: boolean = false;
  
  private smoothedVolumes: { [key: string]: number } = {};
  private smoothingFactor = 0.75; // Adjust for smoother or more responsive animation
  private silenceThreshold = 5; // Adjust based on microphone sensitivity

  private gainNode: GainNode | null = null;

  constructor() {
    // Initialize smoothed volumes for all visemes
    Object.values(VISEMES).forEach(viseme => {
      this.smoothedVolumes[viseme] = 0;
    });
  }

  private initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public async startFromMic(): Promise<void> {
    if (this.isProcessing) return;
    this.initAudioContext();
    if (!this.audioContext) throw new Error("AudioContext could not be created.");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.setupAnalyser();
      this.isProcessing = true;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw new Error("Microphone access was denied. Please allow microphone access in your browser settings.");
    }
  }

  public startFromFile(audioElement: HTMLAudioElement): void {
    if (this.isProcessing) return;
    this.initAudioContext();
    if (!this.audioContext) throw new Error("AudioContext could not be created.");

    // Resume context if it's suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // FIX: Only create the source node once for the lifetime of the audio context.
    // This prevents the "already connected" error on subsequent plays.
    if (!this.source) {
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.setupAnalyser();
    }
    
    if (this.gainNode) {
      this.gainNode.gain.value = 1; // Unmute for file playback
    }
    this.isProcessing = true;
  }

  private setupAnalyser(): void {
    if (!this.audioContext || !this.source) return;
    
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 0; // Muted by default, for mic monitoring

    this.source.connect(this.analyser);
    this.source.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  public stop(): void {
    if (!this.isProcessing) return;

    // For microphone streams, we do a full teardown.
    if (this.source instanceof MediaStreamAudioSourceNode) {
      this.source.mediaStream.getTracks().forEach(track => track.stop());
      this.source?.disconnect();
      this.analyser?.disconnect();
      this.gainNode?.disconnect();

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      
      this.source = null;
      this.audioContext = null;
      this.analyser = null;
      this.gainNode = null;
    }
    
    // For all types of sources, we mark processing as false.
    // For MediaElementAudioSource, we leave the context and nodes intact for reuse.
    this.isProcessing = false;
  }
  
  public updateFrequencyData(): void {
    if (!this.analyser || !this.isProcessing) return;
    this.analyser.getByteFrequencyData(this.dataArray);
  }
  
  public getAverageVolume(): number {
    if (!this.analyser) return 0;
    
    const lowerBinCount = 12;
    const relevantFrequencies = this.dataArray.slice(0, lowerBinCount);
    const sum = relevantFrequencies.reduce((a, b) => a + b, 0);
    const averageVolume = sum / lowerBinCount;

    return averageVolume / 255;
  }

  public getViseme(): VISEMES {
    if (!this.analyser || !this.isProcessing) return VISEMES.sil;

    let totalEnergy = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
        totalEnergy += this.dataArray[i];
    }
    const avgEnergy = totalEnergy / this.dataArray.length;

    if (avgEnergy < this.silenceThreshold) {
      for(const viseme in this.smoothedVolumes){
          this.smoothedVolumes[viseme] *= this.smoothingFactor;
      }
      return VISEMES.sil;
    }

    const rawVolumes: { [key: string]: number } = {};
    let totalVisemeEnergy = 0;
    for (const viseme in VISEME_RANGES) {
      const [from, to] = VISEME_RANGES[viseme];
      const volume = this.getVolumeForFrequencyRange(from, to);
      rawVolumes[viseme] = volume;
      totalVisemeEnergy += volume;
    }

    if (totalVisemeEnergy < 1) {
        // If there's negligible energy in the viseme bands, treat as silence.
        for(const viseme in this.smoothedVolumes){
          this.smoothedVolumes[viseme] *= this.smoothingFactor;
        }
        return VISEMES.sil;
    }

    // Normalize volumes to get relative strength of each frequency band
    const normalizedVolumes: { [key: string]: number } = {};
    for (const viseme in rawVolumes) {
        normalizedVolumes[viseme] = rawVolumes[viseme] / totalVisemeEnergy;
    }

    // Apply smoothing to the normalized values
    for (const viseme in normalizedVolumes) {
      this.smoothedVolumes[viseme] = 
        this.smoothedVolumes[viseme] * this.smoothingFactor + 
        normalizedVolumes[viseme] * (1 - this.smoothingFactor);
    }
    
    let maxVolume = -1;
    let detectedViseme: VISEMES = VISEMES.sil;

    for (const viseme in this.smoothedVolumes) {
      if (this.smoothedVolumes[viseme] > maxVolume) {
        maxVolume = this.smoothedVolumes[viseme];
        detectedViseme = viseme as VISEMES;
      }
    }
    
    return detectedViseme;
  }

  private getVolumeForFrequencyRange(from: number, to: number): number {
    if (!this.analyser || !this.audioContext) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const sampleRate = this.audioContext.sampleRate;
    
    const start = Math.floor(from / sampleRate * bufferLength);
    const end = Math.floor(to / sampleRate * bufferLength);
    
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += this.dataArray[i];
    }
    
    const numFrequencies = (end - start + 1);
    return numFrequencies > 0 ? sum / numFrequencies : 0;
  }
  
  public setMuted(muted: boolean): void {
    if (this.gainNode && this.audioContext) {
        this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.audioContext.currentTime);
    }
  }
}