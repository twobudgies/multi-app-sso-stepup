import { selectProfile } from '../../../../packages/idp-profile/index';
import apps from '../../../../packages/ui-tokens/apps.json';
import keycloak from '../../../../idp/profiles/keycloak.json';
import generic from '../../../../idp/profiles/generic.json';
import { ENV } from './env.generated';

const all = { '/keycloak.json': keycloak, '/generic.json': generic } as Record<string, unknown>;

export const config = {
  appId: 'payments',
  appName: 'Payments and Transfers',
  issuer: ENV.IDP_ISSUER,
  clientId: 'app-angular',
  apiUrl: `http://localhost:${ENV.API_PORT}`,
  profile: selectProfile(all, ENV.IDP_PROFILE),
  apps,
};
