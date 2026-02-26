"use strict";

/**
 * AudioManager — gerencia áudio de background e efeitos sonoros.
 *
 * SRP: única responsabilidade de carregar e reproduzir áudio.
 * Suporta uma trilha de BGM em loop por vez e SFX one-shot.
 *
 * Tracks BGM: "menu" | "music" | "skill-selection"
 * Tracks SFX: "death" | "powerup"
 */
class AudioManager {
  static BGM_MENU            = "menu";
  static BGM_MUSIC           = "music";
  static BGM_SKILL_SELECTION = "skill-selection";
  static SFX_DEATH           = "death";
  static SFX_POWERUP         = "powerup";

  static _TRACKS = {
    [AudioManager.BGM_MENU]:            { src: "resources/audio/menu.wav",            loop: true  },
    [AudioManager.BGM_MUSIC]:           { src: "resources/audio/music.wav",           loop: true  },
    [AudioManager.BGM_SKILL_SELECTION]: { src: "resources/audio/skill-selection.mp3", loop: false },
    [AudioManager.SFX_DEATH]:           { src: "resources/audio/death.mp3",           loop: false },
    [AudioManager.SFX_POWERUP]:         { src: "resources/audio/powerup.wav",         loop: false },
  };

  constructor() {
    /** @type {Map<string, HTMLAudioElement>} */
    this._clips     = new Map();
    /** @type {HTMLAudioElement|null} */
    this._bgm       = null;
    /** @type {string|null} */
    this._bgmKey    = null;
    this._muted     = false;
  }

  /**
   * Pré-carrega todos os arquivos de áudio.
   * Deve ser chamado uma única vez durante init do app.
   */
  init() {
    for (const [key, { src, loop }] of Object.entries(AudioManager._TRACKS)) {
      const el = new Audio(src);
      el.loop    = loop;
      el.preload = "auto";
      this._clips.set(key, el);
    }
  }

  /**
   * Toca uma trilha de BGM em loop (ou one-shot para skill-selection).
   * Interrompe qualquer BGM anterior.
   * @param {string} track  Uma das constantes BGM_*
   */
  playBgm(track) {
    if (this._bgmKey === track) return; // já tocando
    this._stopBgm();
    const clip = this._clips.get(track);
    if (!clip) return;
    this._bgm    = clip;
    this._bgmKey = track;
    if (!this._muted) {
      clip.currentTime = 0;
      clip.play().catch(() => {});
    }
  }

  /**
   * Toca um efeito sonoro one-shot.
   * @param {string} sfx  Uma das constantes SFX_*
   */
  playSfx(sfx) {
    if (this._muted) return;
    const clip = this._clips.get(sfx);
    if (!clip) return;
    // Clona para permitir sobreposição rápida se necessário
    const instance = clip.cloneNode();
    instance.play().catch(() => {});
  }

  /** Para o BGM atual. */
  stopBgm() {
    this._stopBgm();
  }

  /** Silencia/ativa todo o áudio. @param {boolean} muted */
  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this._muted) {
      this._stopBgm();
    }
  }

  /** @returns {boolean} */
  get muted() { return this._muted; }

  // ── Privado ────────────────────────────────────────────────────────────────

  _stopBgm() {
    if (this._bgm) {
      this._bgm.pause();
      this._bgm.currentTime = 0;
    }
    this._bgm    = null;
    this._bgmKey = null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = AudioManager;
}
