/**
 * Simple Web Audio API sound synthesizer for retro game sounds
 */
class SoundManager {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number, slide?: number) {
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(slide, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playLaunch() {
    this.playTone(400, 'sawtooth', 0.2, 0.1, 100);
  }

  playExplosion() {
    this.playTone(100, 'square', 0.5, 0.2, 40);
  }

  playImpact() {
    this.playTone(150, 'triangle', 0.3, 0.2, 50);
  }

  playWin() {
    this.playTone(440, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(554, 'sine', 0.1, 0.1), 100);
    setTimeout(() => this.playTone(659, 'sine', 0.3, 0.1), 200);
  }

  playLose() {
    this.playTone(200, 'sawtooth', 0.5, 0.2, 50);
  }
}

export const sounds = new SoundManager();
