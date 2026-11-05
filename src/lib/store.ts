import { matches as initialMatches } from '../data';
import type { Match } from './agenda';

export type ManagedMatch = Match & { published: boolean };
export const storageKey = 'alianza.agenda.v1';
export function readMatches(): ManagedMatch[] {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return initialMatches.map(match => ({ ...match, published: true }));
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every(isMatch)) throw new Error('Os dados locais não puderam ser lidos. Não foram sobrescritos.');
  return value;
}
function isMatch(value: unknown): value is ManagedMatch {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return ['id', 'opponent', 'initials', 'color', 'date', 'venue', 'competition'].every(key => typeof m[key] === 'string') && Number.isFinite(Date.parse(m.date as string)) && typeof m.home === 'boolean' && typeof m.published === 'boolean' && ['Agendado', 'Adiado', 'Cancelado'].includes(m.status as string) && (m.note === undefined || typeof m.note === 'string');
}
export function saveMatches(matches: ManagedMatch[]) {
  localStorage.setItem(storageKey, JSON.stringify(matches));
}
