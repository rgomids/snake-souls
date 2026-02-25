"use strict";

/**
 * IGameMode — interface contratual que todos os modos de jogo devem satisfazer.
 *
 * Princípio LSP: TraditionalMode, LevelsMode e SoulsMode são substituíveis
 *   em qualquer contexto que espere IGameMode.
 * Princípio ISP: a interface é mínima — apenas os contratos que todos os modos
 *   de fato precisam.
 * Princípio OCP: novos modos implementam esta interface sem alterar
 *   GameLoop ou GameApp.
 *
 * Em JavaScript puro (sem TypeScript), este arquivo documenta o contrato e
 * fornece implementações padrão que lançam erro "não implementado".
 */
class IGameMode {
  /**
   * Identificador único do modo.
   * @type {string}
   */
  get id() { throw new Error("IGameMode.id: não implementado."); }

  /**
   * Avança o estado do jogo por um passo lógico.
   * @param {{ direction?: string }} [input]
   * @returns {void}
   */
  step(input = {}) {
    throw new Error("IGameMode.step: não implementado.");
  }

  /**
   * Enfileira uma direção de movimento.
   * @param {string} direction
   * @returns {void}
   */
  queueDirection(direction) {
    throw new Error("IGameMode.queueDirection: não implementado.");
  }

  /**
   * Alterna pausa/resume.
   * @returns {void}
   */
  togglePause() {
    throw new Error("IGameMode.togglePause: não implementado.");
  }

  /**
   * Reinicia o modo do zero.
   * @returns {void}
   */
  restart() {
    throw new Error("IGameMode.restart: não implementado.");
  }

  /**
   * Retorna o estado atual como POJO imutável.
   * @returns {object}
   */
  getState() {
    throw new Error("IGameMode.getState: não implementado.");
  }

  /**
   * Indica se a partida acabou.
   * @returns {boolean}
   */
  get isGameOver() {
    throw new Error("IGameMode.isGameOver: não implementado.");
  }

  /**
   * Indica se o jogo está pausado.
   * @returns {boolean}
   */
  get isPaused() {
    throw new Error("IGameMode.isPaused: não implementado.");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = IGameMode;
}
