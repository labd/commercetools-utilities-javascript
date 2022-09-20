import {
  AuthMiddlewareOptions,
  ClientBuilder,
  Dispatch,
  HttpMiddlewareOptions,
  Middleware,
  MiddlewareRequest,
  MiddlewareResponse,
} from '@commercetools/sdk-client-v2';
import {
  ApiRoot,
  createApiBuilderFromCtpClient,
} from '@commercetools/platform-sdk';
import fetch from 'node-fetch';
import { assert } from 'console';

export type Options = {
  isLogEnabled?: boolean;
  host?: string;
  projectKey?: string;
  auth?:
    | AuthOptions
    | string
    | (() => Promise<string | AuthOptions | undefined>);
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
    if (this._instanceCreatedAt && this._instanceCreatedAt + 900 > timestamp) {
      return this._instance;
    }

    let auth = this._options.auth;
    if (typeof auth === 'function') {
      auth = await auth();
    }
    let clientBuilder =
      typeof auth === 'string'
        ? new ClientBuilder().withExistingTokenFlow(
            auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`,
            {
              force: true,
            }
          )
        : new ClientBuilder().withClientCredentialsFlow(
            populateAuthFromEnv(this._options.projectKey!, auth)
          );

    clientBuilder = clientBuilder
      .withProjectKey(this._options.projectKey!)
      .withHttpMiddleware(this.getHttpMiddlewareOptions(this._options))
      .withMiddleware(errorMiddleware);

    if (this._options.isLogEnabled) {
      clientBuilder = clientBuilder.withLoggerMiddleware();
    }

    const client = clientBuilder.build();

    this._instance = createApiBuilderFromCtpClient(client);
    this._instanceCreatedAt = timestamp;
    if (!this._instance) {
      throw new Error('Client not initialized');
    }
    return this._instance;
  }

  public async getProjectApi() {
    const builder = await this.getApiBuilder();
    return builder!.withProjectKey({
      projectKey: this._options.projectKey!,
    });
  }

  private getHttpMiddlewareOptions(options: Options): HttpMiddlewareOptions {
    return {
      host: options.host!,
      enableRetry: true,
      includeResponseHeaders: true,
      retryConfig: {
        maxRetries: 2,
        retryDelay: 300,
        maxDelay: 5000,
      },
      fetch: fetch,
    };
  }
}

const populateAuthFromEnv = (
  projectKey: string,
  auth?: AuthOptions
): AuthMiddlewareOptions => {
  const filledAuth = {
    projectKey: projectKey,
    host: auth?.host || getEnvProperty('AUTH_URL'),
    credentials: {
      clientId: auth?.credentials?.clientId || getEnvProperty('CLIENT_ID'),
      clientSecret:
        auth?.credentials?.clientSecret || getEnvProperty('CLIENT_SECRET'),
    },
    scopes: auth?.scopes || getEnvProperty('SCOPES').split(','),
  };

  assert(
    auth?.credentials.clientId,
    'CT client ID missing. Pass it in auth config or set it as CT_CLIENT_ID in env.'
  );
  assert(
    auth?.credentials.clientSecret,
    'CT client secret missing. Pass it in auth config or set it as CT_CLIENT_SECRET in env.'
  );
  return filledAuth;
};

export const errorMiddleware: Middleware = (next: Dispatch) => (
  request: MiddlewareRequest,
  response: MiddlewareResponse
) => {
  const { error } = response;
  if (error && (response.statusCode < 400 || response.statusCode >= 500))
    throw new Error(
      `CT ${error.status} (${error.code}) error: ${error.message}`
    );

  next(request, response);
};

const getEnvProperty = (key: string): string => {
  const value = process.env[`CT_${key}`] || process.env[`CTP_${key}`];
  if (!value) {
    throw new Error(`Missing env var CT_${key} / CTP_${key}`);
  }
  return value;
};
