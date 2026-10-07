import { GoogleOAuthProvider } from './googleProvider.js';
import { BadRequestError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

/**
 * Enterprise Authentication Provider Registry.
 * Pluggable architecture allowing seamless addition of OAuth2, OIDC, and SAML 2.0 identity providers.
 */
class AuthProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    // Register Google OAuth 2.0 provider
    this.register('google', new GoogleOAuthProvider());

    // Register SAML extension point (stubbed for future enterprise SSO configuration)
    this.register('saml', {
      isConfigured: () => false,
      getAuthorizationUrl: () => {
        throw new BadRequestError('SAML 2.0 Enterprise SSO is not yet configured for this environment');
      },
      handleCallback: () => {
        throw new BadRequestError('SAML 2.0 Enterprise SSO is not yet configured for this environment');
      }
    });

    // Register generic OAuth2 extension point
    this.register('oauth2', {
      isConfigured: () => false,
      getAuthorizationUrl: () => {
        throw new BadRequestError('Generic OAuth 2.0 provider is not yet configured');
      }
    });
  }

  /**
   * Registers a provider instance under a unique provider name.
   */
  register(name, provider) {
    this.providers.set(name.toLowerCase(), provider);
    logger.debug(`[AuthProviderRegistry] Registered provider: "${name}"`);
  }

  /**
   * Retrieves a registered provider by name.
   */
  get(name) {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider) {
      throw new BadRequestError(`Unsupported authentication provider "${name}". Supported providers: ${this.listSupported().join(', ')}`);
    }
    return provider;
  }

  /**
   * Lists all supported provider keys.
   */
  listSupported() {
    return Array.from(this.providers.keys());
  }

  /**
   * Returns a status report of configured authentication providers.
   */
  getStatus() {
    const status = {};
    for (const [key, provider] of this.providers.entries()) {
      status[key] = {
        configured: typeof provider.isConfigured === 'function' ? provider.isConfigured() : false
      };
    }
    return status;
  }
}

export const authProviderRegistry = new AuthProviderRegistry();
export default authProviderRegistry;
