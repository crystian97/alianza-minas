import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deletePlayer, listPlayers, preparePhoto, savePlayer, type Player } from './players.ts';

Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true });

test('CRUD persiste foto, edita pelo ID e exclui sem recriar exemplos', async () => {
  const initial = await listPlayers();
  const player: Player = { id: 'test-player', name: ' Atleta de teste ', number: 18, position: 'Atacante', active: true, photo: 'data:image/webp;base64,dGVzdA==' };
  await savePlayer(player);
  let stored = (await listPlayers()).find(item => item.id === player.id);
  assert.equal(stored?.name, 'Atleta de teste');
  assert.equal(stored?.photo, player.photo);
  await savePlayer({ ...player, name: 'Nome atualizado', active: false, photo: null });
  const updated = await listPlayers();
  stored = updated.find(item => item.id === player.id);
  assert.equal(updated.length, initial.length + 1);
  assert.equal(stored?.active, false);
  assert.equal(stored?.photo, null);
  await deletePlayer(player.id);
  assert.equal((await listPlayers()).length, initial.length);
  for (const item of initial) await deletePlayer(item.id);
  assert.deepEqual(await listPlayers(), []);
});

test('cadastro inválido é rejeitado antes de gravar', async () => {
  await assert.rejects(savePlayer({ id: 'invalid', name: ' ', number: 100, position: 'Inválida', active: true, photo: null }), /Informe nome/);
});

test('upload rejeita arquivos incompatíveis e acima de 5 MB', async () => {
  await assert.rejects(preparePhoto(new File(['text'], 'arquivo.txt', { type: 'text/plain' })), /JPG, PNG ou WebP/);
  await assert.rejects(preparePhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'foto.png', { type: 'image/png' })), /até 5 MB/);
});

test('dados pessoais persistem e cadastro antigo continua editável', async () => {
  const legacy: Player = { id: 'personal-test', name: 'Pessoa de teste', number: 20, position: 'Defensor', active: true, photo: null };
  await savePlayer(legacy);
  assert.equal((await listPlayers()).find(player => player.id === legacy.id)?.cpf, '');
  await savePlayer({ ...legacy, cpf: '529.982.247-25', email: 'atleta@example.com', address: 'Endereço fictício', emergencyContactName: 'Contato de teste', emergencyContactPhone: '(31) 99999-9999' });
  const saved = (await listPlayers()).find(player => player.id === legacy.id)!;
  assert.equal(saved.cpf, '52998224725');
  assert.equal(saved.email, 'atleta@example.com');
  assert.equal(saved.address, 'Endereço fictício');
  assert.equal(saved.emergencyContactName, 'Contato de teste');
  assert.equal(saved.emergencyContactPhone, '(31) 99999-9999');
  await assert.rejects(savePlayer({ ...saved, cpf: '11111111111' }), /CPF válido/);
  await assert.rejects(savePlayer({ ...saved, email: 'invalido' }), /e-mail válido/);
  await assert.rejects(savePlayer({ ...saved, emergencyContactPhone: '' }), /nome e o telefone/);
  await assert.rejects(savePlayer({ ...saved, emergencyContactPhone: '123' }), /telefone de emergência válido/);
  assert.equal((await listPlayers()).find(player => player.id === legacy.id)?.email, 'atleta@example.com');
  await deletePlayer(legacy.id);
});
