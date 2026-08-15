const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
let serviceAccountStr = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('FIREBASE_SERVICE_ACCOUNT=')) {
    serviceAccountStr = line.substring('FIREBASE_SERVICE_ACCOUNT='.length).trim();
    break;
  }
}

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(serviceAccountStr);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function updateCompanyCredentials() {
  const snap = await db.collection('companies').get();
  console.log(`Encontradas ${snap.docs.length} empresas.`);
  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(`Empresa: ${doc.id} - ${data.name || data.tradingName || 'Sem nome'}`);
    await doc.ref.update({
      email: data.email || 'contatoesp.tec@gmail.com',
      emailAppPassword: 'nhhkbeocckssjzpp',
    });
    console.log(`✅ Credenciais salvas no documento ${doc.id}`);
  }
}

updateCompanyCredentials();
