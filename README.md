# Lab Digital Commercetools Utilities

## CommercetoolsClient

This is a more straight-forward helper to create a commercetools client for
interacting with Commercetools.

```ts
const client = CommercetoolsClient({
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

const projectApi = await client.getProjectApi();
projectApi.products().get().execute()
```

When the options are not passed it will read it from the ENV vars:

- `CT_PROJECT_KEY`
- `CT_API_URL`
- `CT_AUTH_URL`
- `CT_CLIENT_ID`
- `CT_CLIENT_SECRET`
- `CT_SCOPES`

```ts
const client = CommercetoolsClient();
client.getApiRoot();
```

You can also pass a callable to `auth` which returns a token to be used.

```ts
const client = createClient({
  host: process.env.CT_API_URL,
  projectKey,
  auth: async () => {
    return 'mytoken';
  },
});

client.getApiRoot();
```

Note that the ApiRoot object is cached on the client instance for 900 seconds
