import { getApiRoot, getApiRootForCustomer } from './client';

export { getApiRoot, getApiRootForCustomer };

// reexport everything, so project always uses the same package version of platform sdk
export * from '@commercetools/platform-sdk';
