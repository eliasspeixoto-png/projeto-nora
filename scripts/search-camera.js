const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
const match = envContent.match(/FIREBASE_SERVICE_ACCOUNT=(.*)/);
const rawSA = JSON.parse(match[1].trim());

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(rawSA)
    });
}

const db = admin.firestore();
const companyId = 'Z6XlJobG4TfPoYMwLNC0';

async function searchCameraProduct() {
    console.log("=== SEARCHING PRODUCT IN FIRESTORE FOR ESP-TEC ===");
    const snapshot = await db.collection('products')
        .where('companyId', '==', companyId)
        .get();

    console.log(`Total products for ESP-TEC: ${snapshot.size}`);

    let matches = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const str = JSON.stringify(data).toLowerCase();
        if (str.includes('vhd') || str.includes('3220') || str.includes('798455423628') || str.includes('mini d')) {
            matches.push({ id: doc.id, ...data });
        }
    });

    console.log(`Found ${matches.length} matching products:`);
    matches.forEach(m => {
        console.log(`- ID: ${m.id} | Name: "${m.name || m.descricao || m.title}" | EAN: "${m.ean || m.codigoBarras || m.code || m.codigo}" | Stock: ${m.stock || m.estoque}`);
        console.log("  Full Doc Data:", JSON.stringify(m, null, 2));
    });

    process.exit(0);
}

searchCameraProduct().catch(console.error);
