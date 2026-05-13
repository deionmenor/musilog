import { createHash } from 'crypto';

export function signParams(params: Record<string, string>, secret: string): string {
  const str = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('') + secret;
  return createHash('md5').update(str).digest('hex');
}
