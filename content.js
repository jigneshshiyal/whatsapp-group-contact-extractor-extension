async function getIndexedDBData() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("model-storage");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const readStore = (name) => new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(name)) return resolve([]);
    const tx = db.transaction(name, "readonly");
    const store = tx.objectStore(name);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const [groups, participants, contacts] = await Promise.all([
    readStore("group-metadata"),
    readStore("participant"),
    readStore("contact")
  ]);

  return { groups, participants, contacts };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "get_whatsapp_data") {
    getIndexedDBData().then(data => {
      sendResponse({ success: true, data });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});
