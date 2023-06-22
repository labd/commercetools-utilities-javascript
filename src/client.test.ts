import { CommercetoolsMock } from '@labdigital/commercetools-mock';
import nock from 'nock';
import { CommercetoolsClient } from './client';
import {
  Dispatch,
  MiddlewareRequest,
  MiddlewareResponse,
} from '@commercetools/sdk-client-v2';

describe('init', () => {
  const ctMock = new CommercetoolsMock({
    enableAuthentication: true,
    validateCredentials: true,
  });

  beforeEach(() => {
    nock.cleanAll();
    ctMock.start();
  });

  afterEach(() => {
    ctMock.stop();
    ctMock.clear();
  });

  it('basic options', async () => {
    const client = new CommercetoolsClient({
      host: 'https://api.europe-west1.gcp.commercetools.com/',
      projectKey: 'my-project',
      auth: {
        host: 'https://auth.europe-west1.gcp.commercetools.com/',
        credentials: {
          clientId: 'my-client-id',
          clientSecret: 'my-client-secret',
        },
        scopes: ['view_orders:my-project', 'view_products:my-project'],
      },
    });

    const apiRoot = await client.getProjectApi();
    const products = await apiRoot
      .products()
      .get()
      .execute();
    expect(products.body.count).toBe(0);
  });

  it('env vars', async () => {
    process.env = {
      CT_PROJECT_KEY: 'my-project',
      CT_API_URL: 'https://api.europe-west1.gcp.commercetools.com/',
      CT_AUTH_URL: 'https://auth.europe-west1.gcp.commercetools.com/',
      CT_CLIENT_ID: 'my-client-id',
      CT_CLIENT_SECRET: 'my-client-secret',
      CT_SCOPES: 'view_orders:my-project, view_products:my-project',
    };

    const client = new CommercetoolsClient();

    const apiRoot = await client.getProjectApi();
    const products = await apiRoot
      .products()
      .get()
      .execute();
    expect(products.body.count).toBe(0);
  });

  it('auth callback errored', async () => {
    const client = new CommercetoolsClient({
      host: 'https://api.europe-west1.gcp.commercetools.com/',
      projectKey: 'my-project',
      auth: async () => {
        return 'foo';
      },
    });

    const apiRoot = await client.getProjectApi();
    await expect(
      apiRoot
        .products()
        .get()
        .execute()
    ).rejects.toThrowError();
  });

  it('calls an external middleware when api request is made', async () => {
    const middlewareMock = jest.fn();
    const middlewareMockWrapper = (next: Dispatch) => (
      request: MiddlewareRequest,
      response: MiddlewareResponse
    ) => {
      middlewareMock();
      next(request, response);
    };

    const client = new CommercetoolsClient({
      host: 'https://api.europe-west1.gcp.commercetools.com/',
      projectKey: 'my-project',
      auth: {
        host: 'https://auth.europe-west1.gcp.commercetools.com/',
        credentials: {
          clientId: 'my-client-id',
          clientSecret: 'my-client-secret',
        },
        scopes: ['view_orders:my-project', 'view_products:my-project'],
      },
      middlewares: [middlewareMockWrapper],
    });

    const apiRoot = await client.getProjectApi();
    await apiRoot
      .products()
      .get()
      .execute();
    await apiRoot
      .productTypes()
      .get()
      .execute();

    expect(middlewareMock).toHaveBeenCalledTimes(2);
  });

  it('does not call an external middleware when no api requests are made', async () => {
    const middlewareMock = jest.fn();
    const middlewareMockWrapper = (next: Dispatch) => (
      request: MiddlewareRequest,
      response: MiddlewareResponse
    ) => {
      middlewareMock();
      next(request, response);
    };

    const client = new CommercetoolsClient({
      host: 'https://api.europe-west1.gcp.commercetools.com/',
      projectKey: 'my-project',
      auth: {
        host: 'https://auth.europe-west1.gcp.commercetools.com/',
        credentials: {
          clientId: 'my-client-id',
          clientSecret: 'my-client-secret',
        },
        scopes: ['view_orders:my-project', 'view_products:my-project'],
      },
      middlewares: [middlewareMockWrapper],
    });

    await client.getProjectApi();
    expect(middlewareMock).toHaveBeenCalledTimes(0);
  });
});
