import { CommercetoolsMock } from '@labdigital/commercetools-mock';
import nock from 'nock';
import { CommercetoolsClient } from './client';

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

    const apiRoot = await client.getApiRoot();
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

    const apiRoot = await client.getApiRoot();
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

    const apiRoot = await client.getApiRoot();
    await expect(
      apiRoot
        .products()
        .get()
        .execute()
    ).rejects.toThrowError();
  });
});

describe('Auth disabled', () => {
  const ctMock = new CommercetoolsMock({
    enableAuthentication: false,
    validateCredentials: false,
  });

  beforeEach(() => {
    nock.cleanAll();
    ctMock.start();
  });
  afterEach(() => {
    ctMock.stop();
    ctMock.clear();
  });

  it('auth callback ok', async () => {
    const client = new CommercetoolsClient({
      host: 'https://api.europe-west1.gcp.commercetools.com/',
      projectKey: 'my-project',
      auth: async () => {
        return 'foo';
      },
    });
    const apiRoot = await client.getApiRoot();
    const result = await apiRoot
      .products()
      .get()
      .execute();
    expect(result.body.count).toBe(0);
  });
});
