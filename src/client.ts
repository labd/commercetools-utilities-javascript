import { createClient } from '@commercetools/sdk-client';
import {
  ApiRoot,
  ClientRequest,
  createApiBuilderFromCtpClient,
} from '@commercetools/platform-sdk';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';
import {
  createAuthMiddlewareWithExistingToken,
  createAuthMiddlewareForClientCredentialsFlow,
} from '@commercetools/sdk-middleware-auth';
import fetch from 'node-fetch';

export type Options = {
  host: string;
  projectKey: string;
  auth?: AuthOptions | (() => Promise<string>);
};

export type AuthOptions = {
  host: string;
  credentials: {
    clientId: string;
    clientSecret: string;
  };
  scopes: string[];
};

export class CommercetoolsClient {
  private _options: Options;
  private _instance: ApiRoot | undefined;
  private _instanceCreatedAt: number | undefined;

  constructor(options?: Options) {
    this._options = options || {
      host: getEnvProperty('CT_API_URL'),
      projectKey: getEnvProperty('CT_PROJECT_KEY'),
    };
  }

  public async getApiRoot() {
    const timestamp = new Date().getTime() / 1000;

    if (!this._instanceCreatedAt || this._instanceCreatedAt < timestamp - 900) {
      const middleware = [
        await this.getAuthMiddleware(),
        this.getHttpMiddleware(),
        errorMiddleware,
      ];

      const client = createClient({
        middlewares: middleware,
      });
      this._instance = createApiBuilderFromCtpClient(client);
      this._instanceCreatedAt = timestamp;
    }

    if (!this._instance) {
      throw new Error('Instance not intialized');
    }

    return this._instance.withProjectKey({
      projectKey: this._options.projectKey,
    });
  }

  private getHttpMiddleware() {
    return createHttpMiddleware({
      host: this._options.host,
      enableRetry: true,
      retryConfig: {
        maxRetries: 2,
        retryDelay: 300,
        maxDelay: 5000,
      },
      fetch: fetch,
    });
  }

  private async getAuthMiddleware() {
    if (typeof this._options.auth === 'function') {
      const token = await this._options.auth();
      return createAuthMiddlewareWithExistingToken(`Bearer ${token}`, {
        force: true,
      });
    } else {
      const auth = this._options.auth
        ? { ...this._options.auth }
        : {
            host: getEnvProperty('CT_AUTH_URL'),
            credentials: {
              clientId: getEnvProperty('CT_CLIENT_ID'),
              clientSecret: getEnvProperty('CT_CLIENT_SECRET'),
            },
            scopes: getEnvProperty('CT_SCOPES').split(','),
          };
      return createAuthMiddlewareForClientCredentialsFlow({
        ...auth,
        projectKey: this._options.projectKey,
        fetch,
      });
    }
  }
}

// types from https://github.com/commercetools/nodejs/tree/master/types/sdk.js
// middleware as https://github.com/commercetools/nodejs/tree/master/packages/sdk-middleware-logger
export const errorMiddleware = (next: any) => (request: any, response: any) => {
  const { error } = response;
  if (error && (response.statusCode < 400 || response.statusCode >= 500))
    throw new Error(
      `CT ${error.status} (${error.code}) error: ${error.message}`
    );

  next(request, response);
};

// retry on concurrent modification errors
export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
export const retry = async (
  fn: () => any,
  times: number,
  delayTimeMs: number,
  request: ClientRequest
): Promise<any> => {
  try {
    return await fn();
  } catch (err) {
    if (err.statusCode === 409 && times > 1) {
      if (request.body.version) {
        const newVersion: number = err.body?.errors[0]?.currentVersion;
        if (!newVersion)
          throw new Error(
            `could not find currentVersion on body of ${JSON.stringify(err)} `
          );
        console.log(
          `Conflicting version, retrying with updated version: ${newVersion}`
        );
        request.body.version = newVersion;
      }
      await delay(delayTimeMs);
      return retry(fn, times - 1, delayTimeMs * 2, request);
    } else {
      throw err;
    }
  }
};

const getEnvProperty = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env var ${key}`);
  }
  return value;
};
