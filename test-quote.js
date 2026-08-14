const admin = require('firebase-admin');
const serviceAccount = require('./sa-temp.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  // Update Elias Schuindt Peixoto to admin
  await db.collection('users').doc('8rudV6YszjfTySDBs449amyqxfz1').update({
    role: 'admin'
  });
  console.log("Updated Elias user to admin!");
}

run();
