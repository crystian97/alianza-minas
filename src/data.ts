import type { Match } from './lib/agenda';
export const matches: Match[] = [
 {id:'1',opponent:'FC Real',initials:'FCR',color:'#ac3443',date:'2026-11-07T17:00:00-03:00',venue:'Arena Barbosa',competition:'Campeonato 2026',home:true,status:'Agendado'},
 {id:'2',opponent:'Veteranos FC',initials:'VFC',color:'#a18b4a',date:'2026-11-14T16:00:00-03:00',venue:'Arena Barbosa',competition:'Amistoso',home:true,status:'Agendado'},
 {id:'3',opponent:'União FC',initials:'UFC',color:'#3b71b9',date:'2026-11-22T15:30:00-03:00',venue:'Campo do União',competition:'Campeonato 2026',home:false,status:'Agendado'},
 {id:'4',opponent:'PFC Verde',initials:'PFC',color:'#448b67',date:'2026-11-28T17:00:00-03:00',venue:'Arena Barbosa',competition:'Amistoso',home:true,status:'Adiado',note:'Nova data ainda não definida. Acompanhe as atualizações da agenda.'},
 {id:'5',opponent:'R10 FC',initials:'R10',color:'#bc4d42',date:'2026-12-05T16:00:00-03:00',venue:'Campo do R10',competition:'Campeonato 2026',home:false,status:'Agendado'},
 {id:'6',opponent:'Estrela FC',initials:'EFC',color:'#8165a7',date:'2026-12-12T17:00:00-03:00',venue:'Arena Barbosa',competition:'Amistoso',home:true,status:'Cancelado',note:'Partida cancelada. Não há previsão de remarcação.'}
];
export const players = [{name:'Bruno Almeida',number:1,position:'Goleiro'},{name:'Gabriel Silva',number:3,position:'Defensor'},{name:'Diego Santos',number:4,position:'Defensor'},{name:'Daniel Souza',number:8,position:'Meio-campo'},{name:'Pedro Henrique',number:10,position:'Meio-campo'},{name:'Lucas Pereira',number:9,position:'Atacante'}];
