import {
  AuthMiddlewareOptions,
  ClientBuilder,
  createAuthForClientCredentialsFlow,
  createAuthWithExistingToken,
  createHttpClient,
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

let _instance: ApiRoot | undefined;
let _instanceCreatedAt: number | undefined;

export class CommercetoolsClient {
  private _options: Options;

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
    if (_instanceCreatedAt && _instanceCreatedAt + 900 > timestamp) {
      return _instance;
    }

    let auth = this._options.auth;
    if (typeof auth === 'function') {
      auth = await auth();
    }

    let clientBuilder = new ClientBuilder()
      .withMiddleware(
        typeof auth === 'string'
          ? createAuthWithExistingToken(
              auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`,
              {
                force: true,
              }
            )
          : createAuthForClientCredentialsFlow(
              populateAuthFromEnv(this._options.projectKey!, auth)
            )
      )
      .withMiddleware(
        createHttpClient(this.getHttpMiddlewareOptions(this._options))
      )
      .withProjectKey(this._options.projectKey!)
      .withMiddleware(errorMiddleware)
      .withMiddleware(tokenScopeChangeMiddleware);

    if (this._options.isLogEnabled) {
      clientBuilder = clientBuilder.withLoggerMiddleware();
    }

    const client = clientBuilder.build();

    _instance = createApiBuilderFromCtpClient(client);
    _instanceCreatedAt = timestamp;

    if (!_instance) {
      throw new Error('Client not initialized');
    }
    return _instance;
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
    fetch,
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

// when invalid token error occurs, we need to refresh the instance.
export const tokenScopeChangeMiddleware: Middleware = (
  next: Dispatch
) => async (request: MiddlewareRequest, response: MiddlewareResponse) => {
  const { error } = response;

  if (error && error.body?.message === 'invalid_token') {
    _instance = undefined;
    _instanceCreatedAt = undefined;
    await new CommercetoolsClient().getApiBuilder();
  }
  next(request, response);
};

const getEnvProperty = (key: string): string => {
  const value = process.env[`CT_${key}`] || process.env[`CTP_${key}`];
  if (!value) {
    throw new Error(`Missing env var CT_${key} / CTP_${key}`);
  }
  return value;
};
