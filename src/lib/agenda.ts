export type Match = { id: string; opponent: string; initials: string; color: string; date: string; venue: string; competition: string; home: boolean; status: 'Agendado' | 'Adiado' | 'Cancelado' | 'Finalizado'; note?: string; opponentId?: string; crest?: string | null; goalsFor?: number | null; goalsAgainst?: number | null; version?: number };
export function availableFilter(value: string, options: string[]) {
  return options.includes(value) ? value : 'Todos';
}
export function filterMatches(matches: Match[], query: string, competition: string, month: string) {
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return matches.filter(match => normalize(`${match.opponent} ${match.venue}`).includes(normalize(query)) && (competition === 'Todos' || match.competition === competition) && (month === 'Todos' || match.date.slice(0, 7) === month)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function matchDate(date: string) {
  const value = new Date(date);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...options }).format(value);
  return { day: format({day:'2-digit'}), month: format({month:'short'}).replace('.', ''), weekday: format({weekday:'short'}).replace('.', ''), time: format({hour:'2-digit', minute:'2-digit'}), full: format({day:'numeric', month:'long', year:'numeric'}) };
}
