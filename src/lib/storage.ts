import { failedLogin, loginBlocked, loginBlockError, type LoginAttemptState } from './loginPolicy';
export interface SealedVault {
  version: 1 | 2;
  salt?: Uint8Array<ArrayBuffer>;
  accounts?: Array<{
    email: string;
    salt: Uint8Array<ArrayBuffer>;
    wrapIv: Uint8Array<ArrayBuffer>;
    wrappedKey: ArrayBuffer;
    mustChangePassword?: boolean;
  }>;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
  revision: number;
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('patra-private-workspace', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error('Browser storage is unavailable. Enable site storage to continue.'));
  });
}
export async function readVault(): Promise<SealedVault | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readonly');
    const request = tx.objectStore('vault').get('main');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function writeVault(
  vault: SealedVault,
  expectedRevision: number,
  loginEmail?: string,
  clearLoginEmails: string[] = [],
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    const store = tx.objectStore('vault');
    const request = store.get('main');
    let conflict = false;
    let blocked: Error | undefined;
    const commit = () => {
      store.put(vault, 'main');
      for (const email of clearLoginEmails) store.delete(loginKey(email));
    };
    request.onsuccess = () => {
      if ((request.result?.revision ?? 0) !== expectedRevision) {
        conflict = true;
        tx.abort();
        return;
      }
      if (!loginEmail) {
        commit();
        return;
      }
      const access = store.get(loginKey(loginEmail));
      access.onsuccess = () => {
        if (loginBlocked(access.result)) {
          blocked = loginBlockError(access.result);
          tx.abort();
        } else commit();
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        blocked ||
          new Error(
            conflict
              ? 'This workspace changed in another tab. Lock and sign in again before editing.'
              : 'Could not save. Browser storage may be full; your changes are still on screen.',
          ),
      );
    };
  });
}

const loginKey = (email: string) => `login-attempt:${email.trim().toLowerCase()}`;
export async function localLoginState(email: string): Promise<LoginAttemptState | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readonly');
    const request = tx.objectStore('vault').get(loginKey(email));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function checkLocalLogin(email: string) {
  const state = await localLoginState(email);
  if (loginBlocked(state)) throw loginBlockError(state!);
}
// The failure counter lives beside the ciphertext, never inside a stale workspace snapshot.
export async function updateLocalLogin(
  email: string,
  action: 'failure' | 'success' | 'clear',
  expectedRevision?: number,
): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('vault', 'readwrite');
    const store = tx.objectStore('vault');
    let error: Error | undefined;
    let blocked = false;
    const main = store.get('main');
    main.onsuccess = () => {
      if (expectedRevision !== undefined && main.result?.revision !== expectedRevision) {
        error = new Error('Workspace access changed. Please sign in again.');
        tx.abort();
        return;
      }
      const request = store.get(loginKey(email));
      request.onsuccess = () => {
        if (action === 'clear') {
          store.delete(loginKey(email));
          return;
        }
        const state: LoginAttemptState | undefined = request.result;
        if (loginBlocked(state)) {
          error = loginBlockError(state!);
          return;
        }
        if (action === 'success') {
          store.delete(loginKey(email));
          return;
        }
        const next = failedLogin(state);
        store.put(next, loginKey(email));
        if (loginBlocked(next)) {
          blocked = true;
          error = loginBlockError(next);
        }
      };
    };
    tx.oncomplete = () => {
      db.close();
      if (blocked) {
        const channel = new BroadcastChannel('patra-access');
        channel.postMessage({ type: 'login-blocked', email: email.trim().toLowerCase() });
        channel.close();
      }
      if (error) reject(error);
      else resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        error ||
          new Error('Could not update sign-in protection. Enable browser storage and try again.'),
      );
    };
  });
}
