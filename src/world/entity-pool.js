"use strict";

/**
 * EntityPool — pool genérico de objetos reutilizáveis para reduzir GC.
 *
 * Princípio SRP: única responsabilidade de reciclar e fornecer entidades,
 *   independente do tipo de entidade.
 * Princípio OCP: qualquer tipo de entidade pode usar este pool sem alterar
 *   a implementação.
 */
class EntityPool {
  /**
   * @param {number} [maxSize=800]
   */
  constructor(maxSize = 800) {
    this._pool = [];
    this._maxSize = Math.max(1, Math.floor(maxSize));
  }

  /**
   * Pega um objeto do pool (ou cria um novo) com as coordenadas fornecidas.
   * @param {number} x
   * @param {number} y
   * @returns {{ x: number, y: number }}
   */
  take(x, y) {
    const obj = this._pool.pop();
    if (obj) {
      obj.x = x;
      obj.y = y;
      return obj;
    }
    return { x, y };
  }

  /**
   * Devolve um objeto ao pool para reutilização.
   * @param {{ x: number, y: number } | null | undefined} obj
   */
  recycle(obj) {
    if (!obj) return;
    this._pool.push(obj);
    this._trim();
  }

  /**
   * Recicla todos os objetos de um array.
   * @param {Array<{ x: number, y: number }>} arr
   */
  recycleAll(arr) {
    for (const obj of arr) {
      this._pool.push(obj);
    }
    this._trim();
  }

  /** @returns {number} */
  get size() { return this._pool.length; }

  /** @returns {number} */
  get maxSize() { return this._maxSize; }

  /** @private */
  _trim() {
    if (this._pool.length > this._maxSize) {
      this._pool.splice(0, this._pool.length - this._maxSize);
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = EntityPool;
}
