import { ConnectorUnsupportedError } from './errors.js';

/**
 * ConnectorRegistry maintains a secure, centralized catalog of supported connectors.
 * Dynamic module paths or eval-based loading are strictly prohibited to prevent arbitrary execution.
 */
export class ConnectorRegistry {
  constructor() {
    this._registry = new Map();
  }

  /**
   * Register a connector implementation for a specific type.
   * @param {string} type - Normalized source type (e.g. 'postgresql')
   * @param {typeof import('./BaseConnector.js').BaseConnector} connectorClass
   */
  register(type, connectorClass) {
    if (!type || typeof type !== 'string') {
      throw new Error('Connector type must be a non-empty string');
    }
    if (typeof connectorClass !== 'function') {
      throw new Error(`Connector class for "${type}" must be a constructor function`);
    }
    this._registry.set(type.toLowerCase().trim(), connectorClass);
  }

  /**
   * Check if a connector type is registered.
   * @param {string} type
   * @returns {boolean}
   */
  has(type) {
    if (!type) return false;
    return this._registry.has(type.toLowerCase().trim());
  }

  /**
   * Retrieve connector class for a type. Fails closed on unknown types.
   * @param {string} type
   * @returns {typeof import('./BaseConnector.js').BaseConnector}
   */
  get(type) {
    const normalized = String(type || '').toLowerCase().trim();
    const connectorClass = this._registry.get(normalized);
    if (!connectorClass) {
      throw new ConnectorUnsupportedError(
        `Connector type "${type}" is unsupported or has not been registered`,
        { supportedTypes: this.getSupportedTypes() }
      );
    }
    return connectorClass;
  }

  /**
   * List all registered connector types.
   * @returns {string[]}
   */
  getSupportedTypes() {
    return Array.from(this._registry.keys());
  }
}

export const connectorRegistry = new ConnectorRegistry();
export default connectorRegistry;
