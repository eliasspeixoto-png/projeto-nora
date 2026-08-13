const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');

async function useFirestoreAuthState(collectionRef) {
    const writeData = async (data, file) => {
        try {
            const str = JSON.stringify(data, BufferJSON.replacer);
            await collectionRef.doc(file).set({ data: str });
        } catch (error) {
            console.error(`Erro ao salvar ${file} no Firestore:`, error);
        }
    };

    const readData = async (file) => {
        try {
            const snap = await collectionRef.doc(file).get();
            if (snap.exists) {
                const str = snap.data().data;
                return JSON.parse(str, BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            console.error(`Erro ao ler ${file} no Firestore:`, error);
            return null;
        }
    };

    const removeData = async (file) => {
        try {
            await collectionRef.doc(file).delete();
        } catch (error) {
            console.error(`Erro ao remover ${file} no Firestore:`, error);
        }
    };

    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        }
    };
}

module.exports = { useFirestoreAuthState };
