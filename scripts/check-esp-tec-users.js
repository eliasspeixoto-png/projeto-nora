const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
const rawSA = JSON.parse(match[1].trim());

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(rawSA),
        projectId: rawSA.project_id
    });
}

const db = admin.firestore();

async function checkEspTecUsers() {
    const snap = await db.collection('users').where('companyId', '==', 'Z6XlJobG4TfPoYMwLNC0').get();
    console.log(`Encontrados ${snap.size} documentos em 'users' para ESP-TEC:\n`);
    
    snap.docs.forEach((doc, i) => {
        const d = doc.data();
        console.log(`Documento #${i+1} [ID: ${doc.id}]:`);
        console.log(`  - displayName: ${JSON.stringify(d.displayName)}`);
        console.log(`  - name: ${JSON.stringify(d.name)}`);
        console.log(`  - email: ${JSON.stringify(d.email)}`);
        console.log(`  - role: ${JSON.stringify(d.role)}`);
        console.log(`  - userType: ${JSON.stringify(d.userType)}`);
        console.log(`  - isEmployee: ${JSON.stringify(d.isEmployee)}`);
        console.log(`  - deletedAt: ${JSON.stringify(d.deletedAt)}`);
        console.log("--------------------------------------------------");
    });

    process.exit(0);
}

checkEspTecUsers().catch(console.error);
