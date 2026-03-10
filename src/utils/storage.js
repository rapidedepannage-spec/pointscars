import { storage } from '../firebase'

// Upload un fichier vers Firebase Storage, retourne {url, storagePath}
export function uploadToStorage(storagePath, file) {
  return new Promise((resolve, reject) => {
    const ref = storage.ref(storagePath)
    const task = ref.put(file)
    task.on(
      'state_changed',
      null,
      (err) => reject(err),
      () => {
        task.snapshot.ref.getDownloadURL().then((url) => {
          resolve({ url, storagePath })
        }).catch(reject)
      }
    )
  })
}

// Upload une dataURL base64 vers Storage, retourne {url, storagePath}
export function uploadBase64ToStorage(storagePath, dataUrl) {
  return new Promise((resolve, reject) => {
    const ref = storage.ref(storagePath)
    ref.putString(dataUrl, 'data_url').then((snap) => {
      snap.ref.getDownloadURL().then((url) => {
        resolve({ url, storagePath })
      }).catch(reject)
    }).catch(reject)
  })
}

// Supprime un fichier du Storage
export function deleteFromStorage(storagePath) {
  if (!storagePath) return Promise.resolve()
  return storage.ref(storagePath).delete().catch((e) => {
    console.error('Storage delete error:', e)
  })
}
