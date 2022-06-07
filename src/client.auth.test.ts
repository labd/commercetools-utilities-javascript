import { CommercetoolsMock } from '@labdigital/commercetools-mock';
import nock from 'nock';
import { CommercetoolsClient } from './client';

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
    const apiRoot = await client.getProjectApi();
    const result = await apiRoot
      .products()
      .get()
      .execute();
    expect(result.body.count).toBe(0);
  });
});
