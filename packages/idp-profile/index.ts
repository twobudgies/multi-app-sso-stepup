// Minimal TypeScript side of the IdP adapter. Reads the SAME profile JSON as the C# side.
// Client side only BUILDS requests and parses challenges. Enforcement is server-side (API).
export interface IdpProfile {
  name: string;
  tested?: boolean;
  capabilities: { acrValues: boolean; maxAge: boolean; promptLogin: boolean; claimsParam: boolean; emitsAuthTime: boolean; emitsAmr: boolean };
  level: { claim: string; type: 'string' | 'array'; map: Record<string, string[]> };
  authTime: { claim: string | null };
  stepUpRequest: { acrValues: Record<string, string>; maxAge: boolean; promptLogin: 'never' | 'when-stale' | 'always'; claimsParam?: string };
}

/** Picks a profile by name from a map of imported JSON files and validates it (fails fast). */
export function selectProfile(all: Record<string, unknown>, name: string): IdpProfile {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('IDP_PROFILE may only contain letters, digits, - and _');
  const hit = Object.entries(all).find(([path]) => path.endsWith(`/${name}.json`));
  if (!hit) throw new Error(`IdP profile "${name}" not found in idp/profiles/`);
  const p = ((hit[1] as { default?: unknown }).default ?? hit[1]) as IdpProfile;
  if (!p.name || !p.level?.claim || !p.level.map?.['LoA1'] || !p.level.map?.['LoA2']) throw new Error(`IdP profile "${name}" is invalid`);
  if (!p.stepUpRequest?.acrValues?.['LoA2'] && !(p.capabilities.claimsParam && p.stepUpRequest?.claimsParam)) throw new Error(`IdP profile "${name}" cannot request LoA2`);
  return p;
}

/** Authorization request parameters that ask the IdP for LoA2 (and a fresh login). */
export function stepUpParams(p: IdpProfile, maxAgeSeconds?: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (p.capabilities.acrValues && p.stepUpRequest.acrValues['LoA2']) out['acr_values'] = p.stepUpRequest.acrValues['LoA2'];
  if (p.capabilities.maxAge && p.stepUpRequest.maxAge && maxAgeSeconds !== undefined) out['max_age'] = String(maxAgeSeconds);
  if (p.capabilities.promptLogin && p.stepUpRequest.promptLogin === 'always') out['prompt'] = 'login';
  if (p.capabilities.claimsParam && p.stepUpRequest.claimsParam) out['claims'] = p.stepUpRequest.claimsParam.replace('{level}', p.level.map['LoA2']?.[0] ?? '');
  return out;
}

/** Translates a token claim value (e.g. acr "2") into LoA1/LoA2, or null if unknown. */
export function levelFromClaims(p: IdpProfile, claims: Record<string, unknown>): 'LoA1' | 'LoA2' | null {
  const raw = claims[p.level.claim];
  const vals = (Array.isArray(raw) ? raw : [raw]).map(String);
  if (p.level.map['LoA2'].some((v) => vals.includes(v))) return 'LoA2';
  if (p.level.map['LoA1'].some((v) => vals.includes(v))) return 'LoA1';
  return null;
}

/** Parses an RFC 9470 WWW-Authenticate challenge. */
export function parseChallenge(header: string | null): { acrValues?: string; maxAge?: number } | null {
  if (!header || !/insufficient_user_authentication/.test(header)) return null;
  const acr = /acr_values="([^"]*)"/.exec(header)?.[1];
  const age = /max_age="(\d+)"/.exec(header)?.[1];
  return { acrValues: acr, maxAge: age ? Number(age) : undefined };
}

/** Only internal absolute paths are allowed as return targets (no open redirect). */
export function safeReturnPath(p: unknown): string {
  return typeof p === 'string' && /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/.test(p) ? p : '/';
}
