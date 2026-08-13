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

async function debugProducts() {
    const snap = await db.collection('products')
        .where("companyId", "==", companyId)
        .get();

    console.log("Raw docs count:", snap.size);

    let cameraDoc = null;
    snap.docs.forEach(d => {
        const data = d.data();
        const str = JSON.stringify(data);
        if (str.includes('798455423628') || str.includes('3220')) {
            cameraDoc = { id: d.id, ...data };
        }
    });

    if (cameraDoc) {
        console.log("Found camera doc:");
        console.log("ID:", cameraDoc.id);
        console.log("Status:", cameraDoc.status);
        console.log("DeletedAt:", cameraDoc.deletedAt);
        console.log("Item:", cameraDoc.item);
        console.log("Description:", cameraDoc.description);
        console.log("DetailedDescription:", cameraDoc.detailedDescription);
    } else {
        console.log("❌ Camera doc 798455423628 NOT FOUND in raw docs!");
    }

    process.exit(0);
}

debugProducts().catch(console.error);
