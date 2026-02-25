"use strict";

/**
 * Camera — encapsula posição e dimensões da câmera de jogo do modo Souls.
 *
 * Princípio SRP: única responsabilidade de calcular bounds e visibilidade
 *   relativa à janela de câmera.
 * Elimina a duplicação de `getCameraBounds` e `buildSoulsCamera` entre
 *   souls-world.js e snake-modes.js.
 */

const MathUtils = (typeof require !== "undefined")
  ? require("../core/utils.js")
  : (typeof globalThis !== "undefined" ? globalThis.MathUtils : null);

class Camera {
  /**
   * @param {{ centerX: number, centerY: number, width: number, height: number }} options
   */
  constructor(options = {}) {
    this.centerX = options.centerX ?? 0;
    this.centerY = options.centerY ?? 0;
    this.width   = options.width   ?? 21;
    this.height  = options.height  ?? 21;
  }

  /**
   * Cria uma câmera centrada em uma posição para uso em spawns.
   * @param {{ x: number, y: number }} center
   * @param {"normal"|"boss"|"final_boss"} stageType
   * @returns {Camera}
   */
  static forSpawn(center, stageType = "normal") {
    const size = stageType === "normal" ? 21 : 31;
    return new Camera({ centerX: center.x, centerY: center.y, width: size, height: size });
  }

  /**
   * Retorna os limites absolutos da câmera com padding opcional.
   * @param {number} [padding=0]
   * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
   */
  getBounds(padding = 0) {
    const halfW = Math.floor(this.width  / 2);
    const halfH = Math.floor(this.height / 2);
    return {
      minX: this.centerX - halfW - padding,
      maxX: this.centerX + halfW + padding,
      minY: this.centerY - halfH - padding,
      maxY: this.centerY + halfH + padding,
    };
  }

  /**
   * Verifica se uma posição está dentro dos bounds da câmera.
   * @param {{ x: number, y: number }} position
   * @param {number} [padding=0]
   * @returns {boolean}
   */
  contains(position, padding = 0) {
    if (!position) return false;
    const b = this.getBounds(padding);
    return (
      position.x >= b.minX &&
      position.x <= b.maxX &&
      position.y >= b.minY &&
      position.y <= b.maxY
    );
  }

  /**
   * Atualiza o centro da câmera.
   * @param {number} cx
   * @param {number} cy
   */
  moveTo(cx, cy) {
    this.centerX = cx;
    this.centerY = cy;
  }

  /**
   * Retorna um POJO (plain object) compatível com o formato legado do estado Souls.
   * @returns {{ centerX: number, centerY: number, width: number, height: number }}
   */
  toPlain() {
    return { centerX: this.centerX, centerY: this.centerY, width: this.width, height: this.height };
  }

  /**
   * Constrói uma Camera a partir de um POJO legado.
   * @param {{ centerX: number, centerY: number, width: number, height: number }} plain
   * @returns {Camera}
   */
  static fromPlain(plain) {
    return new Camera(plain);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = Camera;
}
