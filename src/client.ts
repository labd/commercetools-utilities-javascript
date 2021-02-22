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
import assert from 'assert';
import { getSecret } from '@labdigital/lambda-utilities';

assert(process.env.CT_PROJECT_KEY, 'CT_PROJECT_KEY missing');
const projectKey = process.env.CT_PROJECT_KEY;
assert(process.env.CT_API_URL, 'CT_API_URL missing');

const getAccessToken = async () => {
  /**
   * Retrieve commercetools access token from the AWS Secrets Manager.
   * This token is auto-rotated the by the commercetools token refresher component:
   * https://github.com/labd/mach-component-aws-commercetools-token-refresher
   */
  assert(
    process.env.CT_ACCESS_TOKEN_SECRET_NAME,
    'CT_ACCESS_TOKEN_SECRET_NAME missing'
  );
  try {
    const accessToken = await getSecret(
      process.env.CT_ACCESS_TOKEN_SECRET_NAME
    );
    return JSON.parse(accessToken).access_token;
  } catch (err) {
    console.error(err);
    throw new Error(`Could not retrieve CT access token from secretsmanager`);
  }
};

const getAuthMiddlewareWithClientCredentials = () => {
  console.warn(
    'CT_CLIENT_ID and CT_CLIENT_SECRET for local dev only; make sure this is not used in production'
  );
  assert(process.env.CT_AUTH_URL, 'CT_AUTH_URL missing');
  return createAuthMiddlewareForClientCredentialsFlow({
    host: process.env.CT_AUTH_URL,
    projectKey,
    credentials: {
      clientId: process.env.CT_CLIENT_ID,
      clientSecret: process.env.CT_CLIENT_SECRET,
    },
    scopes: process.env.CT_SCOPES?.split(','),
    fetch,
  });
};

const getAuthMiddlewareWithExistingToken = async () => {
  const token = await getAccessToken();
  return createAuthMiddlewareWithExistingToken(`Bearer ${token}`, {
    force: true,
  });
};

const getAuthMiddleware = async () => {
  if (
    process.env.CT_CLIENT_ID &&
    process.env.CT_CLIENT_SECRET &&
    process.env.CT_SCOPES &&
    process.env.NODE_ENV !== 'production'
  ) {
    return getAuthMiddlewareWithClientCredentials();
  }

  return await getAuthMiddlewareWithExistingToken();
};

const httpMiddleware = createHttpMiddleware({
  host: process.env.CT_API_URL,
  enableRetry: true,
  retryConfig: {
    maxRetries: 2,
    retryDelay: 300,
    maxDelay: 5000,
  },
  fetch,
});

export const getCtClientServer = async () => {
  const authMiddleware = await getAuthMiddleware();

  return createClient({
    middlewares: [authMiddleware, httpMiddleware, errorMiddleware],
  });
};

export const getApiRoot = async () => {
  const server = await getCtClientServer();
  return createApiBuilderWithRetryFromCtpClient(server).withProjectKey({
    projectKey,
  });
};

export const getApiRootForCustomer = (authorization: string) => {
  /**
   * Create commercetools API request builder configured for the me-endpoints for the project configured with the
   * CT_PROJECT_KEY environment variable.
   */
  const customerAuthMiddleware = createAuthMiddlewareWithExistingToken(
    authorization
  );
  const client = createClient({
    middlewares: [customerAuthMiddleware, httpMiddleware, errorMiddleware],
  });
  return createApiBuilderWithRetryFromCtpClient(client).withProjectKey({
    projectKey,
  });
};

export const validateResponse = (response: any, message: string): void => {
  if (![200, 201].includes(response.statusCode)) {
    throw new Error(message);
  }
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

export function createApiBuilderWithRetryFromCtpClient(
  ctpClient: any,
  baseUri?: string
): ApiRoot {
  async function retryOnConcurent(request: ClientRequest) {
    return retry(() => ctpClient.execute(request), 10, 10, request);
  }

  return new ApiRoot({
    executeRequest: retryOnConcurent,
    baseUri: baseUri,
  });
}

// types from https://github.com/commercetools/nodejs/tree/master/types/sdk.js
// middleware as https://github.com/commercetools/nodejs/tree/master/packages/sdk-middleware-logger
export const errorMiddleware = (next: any) => (request: any, response: any) => {
  const { error } = response;
  if (error && ![400, 401, 403, 409].includes(response.statusCode))
    throw new Error(
      `CT ${error.status} (${error.code}) error: ${error.message}`
    );

  next(request, response);
};

export const getApiRootWithoutRetry = async () => {
  const server = await getCtClientServer();
  return createApiBuilderFromCtpClient(server).withProjectKey({
    projectKey,
  });
};
