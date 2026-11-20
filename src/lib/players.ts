import { players as examples } from '../data.ts';

export const positions = ['Goleiro', 'Defensor', 'Meio-campo', 'Atacante'];
export type Player = {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  number: number;
  position: string;
  active: boolean;
  photo: string | null;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('alianza-players', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.createObjectStore('players', { keyPath: 'id' });
      examples.forEach((player, index) => {
        store.add({ ...player, id: `example-${index}`, active: true, photo: null });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Não foi possível abrir o armazenamento de jogadores.'));
    request.onblocked = () => reject(new Error('Feche outras abas do projeto e tente novamente.'));
  });
}

export async function listPlayers(): Promise<Player[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('players', 'readonly');
    const request = transaction.objectStore('players').getAll();
    transaction.oncomplete = () => {
      database.close();
      resolve((request.result as Player[]).sort((a, b) => a.number - b.number));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error('Não foi possível carregar o elenco.'));
    };
  });
}

export async function savePlayer(player: Player): Promise<void> {
  if (!player.name.trim() || !Number.isInteger(player.number) || player.number < 1 || player.number > 99 || !positions.includes(player.position)) {
    throw new Error('Informe nome, posição e número de camisa de 1 a 99.');
  }
  const cpf = (player.cpf ?? '').replace(/[.\-\s]/g, '');
  const email = (player.email ?? '').trim();
  const emergencyContactName = (player.emergencyContactName ?? '').trim();
  const emergencyContactPhone = (player.emergencyContactPhone ?? '').trim();
  if (cpf && !validCpf(cpf)) throw new Error('Informe um CPF válido com 11 dígitos.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  if (Boolean(emergencyContactName) !== Boolean(emergencyContactPhone)) {
    throw new Error('Preencha o nome e o telefone do contato de emergência.');
  }
  if (emergencyContactPhone && !/^\+?[\d\s().-]+$/.test(emergencyContactPhone)) {
    throw new Error('Informe um telefone de emergência válido, incluindo DDD.');
  }
  const phoneDigits = emergencyContactPhone.replace(/\D/g, '');
  if (emergencyContactPhone && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
    throw new Error('Informe um telefone de emergência válido, incluindo DDD.');
  }
  await writePlayer(player.id, {
    ...player,
    name: player.name.trim(),
    cpf,
    email,
    address: (player.address ?? '').trim(),
    emergencyContactName,
    emergencyContactPhone,
  });
}

function validCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let index = 0; index < length; index++) sum += Number(cpf[index]) * (length + 1 - index);
    const digit = (sum * 10 % 11) % 10;
    if (digit !== Number(cpf[length])) return false;
  }
  return true;
}

export async function deletePlayer(id: string): Promise<void> {
  await writePlayer(id);
}

async function writePlayer(id: string, player?: Player): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('players', 'readwrite');
    const store = transaction.objectStore('players');
    if (player) store.put(player);
    else store.delete(id);
    transaction.oncomplete = () => {
      database.close();
      window.dispatchEvent(new Event('players-changed'));
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error('Não foi possível salvar. Verifique o espaço disponível no navegador e tente novamente.'));
    };
  });
}

export async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecione uma foto JPG, PNG ou WebP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Não foi possível abrir essa imagem. Escolha outro arquivo.');
  });
  try {
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu preparar a foto.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.85);
  } finally {
    bitmap.close();
  }
}
