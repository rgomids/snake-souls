"use strict";

/**
 * DevPanel — exibe/oculta o painel de debug e executa comandos de dev.
 *
 * SRP: única responsabilidade de gerenciar o ciclo de vida do painel dev.
 * DIP: elementos DOM, parser de código e executor de comando são injetados.
 */
class DevPanel {
  /**
   * @param {object}          deps
   * @param {HTMLElement}     deps.panelEl          O painel completo
   * @param {HTMLInputElement} deps.inputEl         Campo de texto do cod dev
   * @param {HTMLElement}     deps.feedbackEl       Área de feedback de texto
   * @param {Function}        deps.parseCommand     (raw: string) → { command, params } | null
   * @param {Function}        deps.executeCommand   (parsed) → string (mensagem de resultado)
   */
  constructor(deps) {
    if (!deps?.panelEl)    throw new Error("DevPanel: deps.panelEl é obrigatório.");
    if (!deps?.feedbackEl) throw new Error("DevPanel: deps.feedbackEl é obrigatório.");

    this._panelEl   = deps.panelEl;
    this._inputEl   = deps.inputEl ?? null;
    this._feedbackEl = deps.feedbackEl;
    this._parse     = deps.parseCommand;
    this._execute   = deps.executeCommand;

    this._isOpen    = false;
    this._feedback  = "";
    this._feedbackType = "info";  // "info" | "success" | "error"
  }

  // ── Estado ──────────────────────────────────────────────────────────────────

  /** @returns {boolean} */
  get isOpen() { return this._isOpen; }

  /** Alterna visibilidade do painel. */
  toggle() {
    this._isOpen = !this._isOpen;
    if (this._isOpen && this._inputEl) {
      window.setTimeout(() => {
        this._inputEl.focus();
        this._inputEl.select();
      }, 0);
    }
    this._syncDOM();
  }

  /** Fecha o painel. */
  close() {
    this._isOpen = false;
    this._syncDOM();
  }

  // ── Execução de comandos ────────────────────────────────────────────────────

  /**
   * Tenta parsear e executar o conteúdo atual do input.
   * @returns {{ success: boolean, message: string }}
   */
  submitCommand() {
    if (!this._inputEl || !this._parse || !this._execute) {
      return { success: false, message: "DevPanel não configurado completamente." };
    }

    const raw = this._inputEl.value?.trim() ?? "";
    if (!raw) return { success: false, message: "Código vazio." };

    const parsed = this._parse(raw);
    if (!parsed) {
      this.setFeedback(`Código desconhecido: "${raw}"`, "error");
      return { success: false, message: `Código desconhecido: "${raw}"` };
    }

    try {
      const result = this._execute(parsed);
      this.setFeedback(result ?? "Comando executado.", "success");
      return { success: true, message: result ?? "Comando executado." };
    } catch (err) {
      const msg = err?.message ?? String(err);
      this.setFeedback(msg, "error");
      return { success: false, message: msg };
    }
  }

  /**
   * Define a mensagem de feedback manualmente.
   * @param {string} message
   * @param {"info"|"success"|"error"} [type="info"]
   */
  setFeedback(message, type = "info") {
    this._feedback      = message;
    this._feedbackType  = ["success", "error"].includes(type) ? type : "info";
    this._syncFeedback();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  /** Sincroniza todo o painel com o estado. */
  render() {
    this._syncDOM();
  }

  _syncDOM() {
    this._panelEl.classList.toggle("hidden", !this._isOpen);
    this._syncFeedback();
  }

  _syncFeedback() {
    this._feedbackEl.textContent = this._feedback;
    this._feedbackEl.className   = `dev-feedback ${this._feedbackType}`;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = DevPanel;
}
