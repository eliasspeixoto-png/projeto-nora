const admin = require('firebase-admin');
const serviceAccount = require('./sa-temp.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const companyId = 'Z6XlJobG4TfPoYMwLNC0';

  // 1. Cadastra a pendência dos fusíveis com todas as tags ricas
  await db.collection('observations').add({
    companyId,
    tags: ['pendências', 'pendencias', 'os-0145/26', '145', 'fm terraplenagem', 'fusível', 'fusivel', 'bt 05', 'bt 019', 'bt 048', 'bt 145', 'bt 307', 'bt 315'],
    text: 'Trocar fusível de 3 amper por fusível de 1 amper nos caminhões BT 05, BT 019, BT 048, BT 145, BT 307 e BT 315.',
    author: 'Elias Schuindt Peixoto',
    createdAt: new Date().toISOString(),
    status: 'Ativo'
  });
  console.log("Pendência de fusíveis salva!");

  // 2. Atualiza a observação de defeito para conter a OS e o cliente
  await db.collection('observations').doc('aiQnWKexCbKtDIMJcZu8').update({
    tags: ['defeito', 'defeitos', 'os-0145/26', '145', 'fm terraplenagem', 'bt 307', 'bt 019', 'câmera', 'camera']
  });
  console.log("Observação de defeito vinculada à OS-0145/26!");
}

run();
