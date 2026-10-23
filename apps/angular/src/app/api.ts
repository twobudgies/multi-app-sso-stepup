import { parseChallenge } from '../../../../packages/idp-profile/index';
import { config } from './config';

export class StepUpRequired extends Error {
  maxAge?: number;
  constructor(message: string, maxAge?: number) { super(message); this.maxAge = maxAge; }
}
export class ApiError extends Error {}

export async function api<T = any>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(config.apiUrl + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const ch = parseChallenge(res.headers.get('WWW-Authenticate'));
    if (ch) {
      const friendly: Record<string, string> = {
        level_too_low: 'So far you signed in with a password only (LoA1). This action needs password + authenticator code (LoA2).',
        auth_too_old: `Your last verification is too old (${j.message ?? ''}).`,
      };
      throw new StepUpRequired(friendly[j.code] ?? j.message ?? 'Stronger authentication required', ch.maxAge);
    }
    throw new ApiError('Your session is not valid any more. Please sign in again.');
  }
  if (!res.ok) throw new ApiError(j.message ?? `Request failed (${res.status})`);
  return j as T;
}
