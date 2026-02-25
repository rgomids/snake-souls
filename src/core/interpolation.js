"use strict";

/**
 * Interpolation — utilitários de lerp para posições de grade e câmera.
 *
 * SRP: única responsabilidade de calcular posições intermediárias.
 * Pura matemática, sem efeitos colaterais nem dependências externas.
 */
class Interpolation {
  /**
   * Lerp linear escalar.
   * @param {number} a
   * @param {number} b
   * @param {number} t  0..1
   * @returns {number}
   */
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Lerp de posição de grade.
   * Detecta teleporte (delta > maxCells) e retorna `cur` sem interpolar,
   * evitando slides fantasma quando a cobra reaparece no outro lado.
   *
   * @param {{x:number,y:number}|null} prev
   * @param {{x:number,y:number}}      cur
   * @param {number} t           0..1
   * @param {number} [maxCells=2]  limiar de teleporte em células
   * @returns {{x:number, y:number}}
   */
  static lerpGrid(prev, cur, t, maxCells = 2) {
    if (!prev || !cur) return cur;
    const dx = Math.abs(cur.x - prev.x);
    const dy = Math.abs(cur.y - prev.y);
    if (dx > maxCells || dy > maxCells) return cur;  // teleporte — snap direto
    return {
      x: Interpolation.lerp(prev.x, cur.x, t),
      y: Interpolation.lerp(prev.y, cur.y, t),
    };
  }

  /**
   * Smooth-follow da câmera — decaimento exponencial (frame-rate independent).
   *
   * Formula: pos = target + (current - target) * 0.5^(deltaMs / halfLifeMs)
   *
   * Propriedades:
   *  - Após `halfLifeMs` ms, 50% da distância restante é coberta.
   *  - Funciona para qualquer deltaMs sem depender de frame rate.
   *  - halfLifeMs menor = câmera mais responsiva / mais rígida.
   *  - halfLifeMs maior = câmera mais suave / mais lenta.
   *
   * @param {{x:number,y:number}} current  posição atual da câmera (célula)
   * @param {{x:number,y:number}} target   posição desejada (célula — head da cobra)
   * @param {number} deltaMs               ms desde o último frame
   * @param {number} [halfLifeMs=60]       ms para percorrer 50% da distância restante
   * @returns {{x:number,y:number}}
   */
  static cameraFollow(current, target, deltaMs, halfLifeMs = 60) {
    const decay = Math.pow(0.5, deltaMs / halfLifeMs);
    return {
      x: target.x + (current.x - target.x) * decay,
      y: target.y + (current.y - target.y) * decay,
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = Interpolation;
}
