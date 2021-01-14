import { QueryParam } from '@commercetools/platform-sdk';
import { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk/dist/generated/client/by-project-key-request-builder';
import { ByProjectKeyMeRequestBuilder } from '@commercetools/platform-sdk/dist/generated/client/me/by-project-key-me-request-builder';
import { getApiRoot, getApiRootForCustomer } from './client';

// this is a CT type but they do not export it nicely
interface MethordArgs {
  queryArgs?: {
    expand?: string | string[];
    [key: string]: QueryParam;
  };
}

/*
 * These CT actions will use the customers token to be performed, meaning that all actions will be within the users scope.
 * e.g. Only the users own orders will be fetchable with this token.
 */
export const getTokenScopedCtActions = async ({
  customerToken,
}: {
  customerToken: string;
}) => {
  const apiRootForCustomer = getApiRootForCustomer(customerToken).me();

  return {
    payments: {
      getMyPayment: genericGetPayment(apiRootForCustomer),
    },
    orders: {
      getMyOrder: genericGetOrder(apiRootForCustomer),
    },
  };
};

/*
 * These CT actions have all the scopes defined in your components CT client
 */
export const getCtActions = async () => {
  const apiRootServer = await getApiRoot();

  return {
    payments: {
      getMyPayment: genericGetPayment(apiRootServer),
    },
    orders: {
      getMyOrder: genericGetOrder(apiRootServer),
      getOrderByOrderNumber: ({
        orderNumber,
        getMethodArgs,
      }: {
        orderNumber: string;
        getMethodArgs?: MethordArgs;
      }) => {
        return apiRootServer
          .orders()
          .withOrderNumber({ orderNumber })
          .get(getMethodArgs)
          .execute();
      },
    },
  };
};

const genericGetPayment = (
  apiRoot: ByProjectKeyRequestBuilder | ByProjectKeyMeRequestBuilder
) => async ({
  id,
  getMethodArgs,
}: {
  id: string;
  getMethodArgs?: MethordArgs;
}) => {
  return apiRoot
    .payments()
    .withId({ ID: id })
    .get(getMethodArgs)
    .execute()
    .then(res => res.body);
};

const genericGetOrder = (
  apiRoot: ByProjectKeyRequestBuilder | ByProjectKeyMeRequestBuilder
) => ({ id, getMethodArgs }: { id: string; getMethodArgs?: MethordArgs }) => {
  return apiRoot
    .orders()
    .withId({ ID: id })
    .get(getMethodArgs)
    .execute()
    .then(res => res.body);
};
