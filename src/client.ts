import { createClient } from '@commercetools/sdk-client';
import {
  ApiRoot,
  createApiBuilderFromCtpClient,
} from '@commercetools/platform-sdk';
import { createHttpMiddleware } from '@commercetools/sdk-middleware-http';
import {
  createAuthMiddlewareWithExistingToken,
  createAuthMiddlewareForClientCredentialsFlow,
} from '@commercetools/sdk-middleware-auth';
import fetch from 'node-fetch';

export type Options = {
  host?: string;
  projectKey?: string;
  auth?: AuthOptions | (() => Promise<string | AuthOptions | undefined>);
};

export type AuthOptions = {
  host?: string;
  credentials: {
    clientId?: string;
    clientSecret?: string;
  };
  scopes?: string[];
};

export class CommercetoolsClient {
  private _options: Options;
  private _instance: ApiRoot | undefined;
  private _instanceCreatedAt: number | undefined;

  constructor(options?: Options) {
    this._options = options || {};

    if (!this._options.host) {
      this._options.host = getEnvProperty('API_URL');
    }
    if (!this._options.projectKey) {
      this._options.projectKey = getEnvProperty('PROJECT_KEY');
    }
  }

  public async getApiBuilder() {
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
      throw new Error('Client not initialized');
    }
    return this._instance;
  }

  public async getProjectApi() {
    if (!this._options.projectKey) {
      throw new Error('No projectKey defined');
    }

    const builder = await this.getApiBuilder();
    return builder.withProjectKey({
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
    let auth = this._options.auth;

    if (typeof auth === 'function') {
      const authData = await auth();
      if (typeof authData === 'string') {
        return createAuthMiddlewareWithExistingToken(`Bearer ${authData}`, {
          force: true,
        });
      }
      auth = authData;
    }
    return createAuthMiddlewareForClientCredentialsFlow({
      ...populateAuthFromEnv(auth),
      projectKey: this._options.projectKey,
      fetch,
    });
  }
}

const populateAuthFromEnv = (auth?: AuthOptions): AuthOptions => {
  return {
    host: auth?.host || getEnvProperty('AUTH_URL'),
    credentials: {
      clientId: auth?.credentials?.clientId || getEnvProperty('CLIENT_ID'),
      clientSecret:
        auth?.credentials?.clientSecret || getEnvProperty('CLIENT_SECRET'),
    },
    scopes: auth?.scopes || getEnvProperty('SCOPES').split(','),
  };
};

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
  const value = process.env[`CT_${key}`] || process.env[`CTP_${key}`];
  if (!value) {
    throw new Error(`Missing env var CT_${key} / CTP_${key}`);
  }
  return value;
};
