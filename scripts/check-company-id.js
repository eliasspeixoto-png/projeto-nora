const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'nora-d75ea'
    });
}

const db = admin.firestore();

async function checkCompanyIds() {
    console.log("Checking products in Firestore...");
    const productsSnap = await db.collection('products').limit(10).get();
    console.log(`Found ${productsSnap.size} products in Firestore:`);
    
    productsSnap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`- Product ID: ${doc.id} | Name: "${data.description || data.name}" | companyId: "${data.companyId}"`);
    });

    process.exit(0);
}

checkCompanyIds().catch(err => {
    console.error(err);
    process.exit(1);
});
