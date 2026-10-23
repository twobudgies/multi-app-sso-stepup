import { selectProfile } from '../../../packages/idp-profile/index'
import apps from '../../../packages/ui-tokens/apps.json'

const env = import.meta.env
const profiles = import.meta.glob('../../../idp/profiles/*.json', { eager: true }) as Record<string, unknown>

export const config = {
  appId: 'customer-portal',
  appName: 'Customer Portal',
  issuer: (env.IDP_ISSUER as string) || 'http://localhost:8180/realms/stepup',
  clientId: 'app-react',
  apiUrl: `http://localhost:${(env.API_PORT as string) || '5100'}`,
  profile: selectProfile(profiles, (env.IDP_PROFILE as string) || 'keycloak'),
  apps,
}
