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

async function findCompanies() {
    console.log("==================================================");
    console.log("🏢 EMPRESAS CADASTRADAS NO FIRESTORE:");
    console.log("==================================================");
    const companiesSnap = await db.collection('companies').get();
    companiesSnap.docs.forEach(doc => {
        const d = doc.data();
        console.log(`ID: "${doc.id}" | Nome Fantasia: "${d.tradeName || d.name}" | Razão Social: "${d.companyName}"`);
    });

    console.log("\n==================================================");
    console.log("📦 SAMPLE PRODUTOS:");
    console.log("==================================================");
    const productsSnap = await db.collection('products').limit(5).get();
    productsSnap.docs.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Descrição: "${d.description || d.name}" | companyId: "${d.companyId}"`);
    });

    console.log("\n==================================================");
    console.log("👷 SAMPLE USERS (USUÁRIOS/FUNCIONÁRIOS):");
    console.log("==================================================");
    const usersSnap = await db.collection('users').limit(10).get();
    usersSnap.docs.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Nome: "${d.displayName || d.name}" | Role: "${d.role}" | companyId: "${d.companyId}"`);
    });

    process.exit(0);
}

findCompanies().catch(err => {
    console.error("Erro ao buscar empresas:", err);
    process.exit(1);
});
