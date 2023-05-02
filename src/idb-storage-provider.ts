import { StorageProvider } from './storage-provider'

/**
 * An implementation of the `StorageProvider` interface that uses
 * [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
 * as its backing data store.
 *
 * Note for NodeJS: To use this class from within NodeJS, you must first polyfill
 * an indexeddb implemention, e.g.:
 *   ```
 *   require('fake-indexeddb/auto')
 *   ```
 */
export class IDBStorageProvider implements StorageProvider {
  private storage: Promise<IDBDatabase>

  constructor(databaseName = 'com.sudoplatform.safebrowsing.cache') {
    this.storage = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1)

      request.onsuccess = () => {
        const db = request.result
        resolve(db)
      }

      request.onerror = () => {
        reject(request.error)
      }

      request.onupgradeneeded = (event) => {
        if (event.oldVersion === 0 && event.newVersion === 1) {
          const db = request.result

          // Migrate DB tables from version 0 to version 1
          db.createObjectStore('reputationCache', {
            keyPath: 'key',
            autoIncrement: false,
          })
        }
      }
    })
  }

  async getItem(key: string): Promise<string | undefined> {
    const db = await this.storage
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(['reputationCache'], 'readonly')
        .objectStore('reputationCache')
        .get(key)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result?.value)
      }
    })
  }

  async setItem(key: string, value: string): Promise<void> {
    const db = await this.storage
    await new Promise<void>((resolve, reject) => {
      const registrationRequest = db
        .transaction(['reputationCache'], 'readwrite')
        .objectStore('reputationCache')
        .add({ key, value })

      registrationRequest.onsuccess = () => {
        resolve()
      }
      registrationRequest.onerror = () => {
        reject(registrationRequest.error)
      }
    })
  }

  async clearItem(key: string): Promise<void> {
    const db = await this.storage
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['reputationCache'], 'readwrite')

      transaction.objectStore('reputationCache').delete(key)

      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
    })
  }

  async keys(): Promise<string[]> {
    const db = await this.storage
    return new Promise<string[]>((resolve, reject) => {
      const transaction = db.transaction(['reputationCache'], 'readwrite')

      const request = transaction.objectStore('reputationCache').getAllKeys()

      transaction.oncomplete = () => resolve(request.result as string[])
      transaction.onabort = () => reject(transaction.error)
    })
  }

  async clear(): Promise<void> {
    const db = await this.storage
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['reputationCache'], 'readwrite')

      transaction.objectStore('reputationCache').clear()

      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error)
    })
  }
}
