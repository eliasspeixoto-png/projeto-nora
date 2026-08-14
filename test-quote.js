const admin = require('firebase-admin');
const serviceAccount = require('./sa-temp.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const osDocRef = db.collection('quotes').doc('NFlwBCayBSdhnfkI8t2v');
  const osSnap = await osDocRef.get();
  
  if (!osSnap.exists) {
    console.error("OS document not found!");
    return;
  }

  const osNotes = [
    {
      id: "note_1786734000001",
      type: "pendencia",
      text: "Trocar fusível de 3 amper por fusível de 1 amper nos caminhões BT 05, BT 019, BT 048, BT 145, BT 307 e BT 315.",
      author: "Elias Schuindt Peixoto",
      createdAt: new Date().toISOString(),
      status: "Pendente"
    },
    {
      id: "note_1786734000002",
      type: "defeito",
      text: "BT 307 gerou erro de HD, reiniciado e a falha foi corrigida. BT 019 está com a câmera do lado carona parada.",
      author: "Elias Schuindt Peixoto",
      createdAt: new Date().toISOString(),
      status: "Pendente"
    },
    {
      id: "note_1786734000003",
      type: "observacao",
      text: "Durante a instalação identificamos suporte da bomba de óleo torado. Informado ao mecânico (BT 019).",
      author: "Elias Schuindt Peixoto",
      createdAt: new Date().toISOString(),
      status: "Registrado"
    }
  ];

  await osDocRef.update({
    osNotes: osNotes
  });

  console.log("MIGRAÇÃO CONCLUÍDA: osNotes adicionado com sucesso ao documento da OS-0145/26!");
}

run();
