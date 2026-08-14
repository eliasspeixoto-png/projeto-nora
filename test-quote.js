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
  const nowISO = new Date().toISOString();

  // 1. Marca como pago as faturas do Fabio Fontes
  await db.collection('accountsReceivable').doc('AjqDfiSGjRJL9pPQOJwI').update({
    status: 'Pago',
    paymentDate: nowISO
  });

  await db.collection('accountsReceivable').doc('sZ2kNkBjgRZfiMl58Dmk').update({
    status: 'Pago',
    paymentDate: nowISO
  });

  console.log("SUCESSO: As 2 contas a receber do Fabio Fontes foram marcadas como PAGAS no Firestore!");
}

run();
