import { test } from 'node:test';
import assert from 'node:assert/strict';
import { availableFilter, filterMatches, matchDate, type Match } from './agenda.ts';
const sample: Match[] = [
 {id:'a',opponent:'União FC',initials:'U',color:'#fff',date:'2026-12-01T01:00:00-03:00',venue:'Arena',competition:'Amistoso',home:false,status:'Adiado'},
 {id:'b',opponent:'Real',initials:'R',color:'#fff',date:'2026-11-07T17:00:00-03:00',venue:'Arena',competition:'Copa',home:true,status:'Agendado'}
];
test('busca sem acentos e filtros combinados',()=>{assert.deepEqual(filterMatches(sample,'uniao','Amistoso','2026-12').map(m=>m.id),['a']);assert.equal(filterMatches(sample,'uniao','Copa','Todos').length,0)});
test('ordena sem alterar origem e preserva avisos de adiamento',()=>{assert.deepEqual(filterMatches(sample,'','Todos','Todos').map(m=>m.id),['b','a']);assert.equal(sample[0].id,'a');assert.equal(filterMatches(sample,'','Amistoso','Todos')[0].status,'Adiado')});
test('exibe data e hora de Brasília independentemente do computador',()=>{const date=matchDate('2026-11-08T01:00:00Z');assert.equal(date.day,'07');assert.equal(date.time,'22:00')});
test('mês removido da agenda não mantém filtro invisível após despublicação',()=>{
 const published = sample.filter(m=>m.id==='b');
 const month = availableFilter('2026-12', published.map(m=>m.date.slice(0,7)));
 assert.equal(month,'Todos');
 assert.deepEqual(filterMatches(published,'','Todos',month).map(m=>m.id),['b']);
});
test('competição removida volta a Todos e opção existente é preservada',()=>{
 assert.equal(availableFilter('Amistoso',['Copa']),'Todos');
 assert.equal(availableFilter('Copa',['Copa']),'Copa');
});
