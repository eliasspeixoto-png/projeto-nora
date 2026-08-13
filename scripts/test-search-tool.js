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

async function testTool() {
    const companyId = 'Z6XlJobG4TfPoYMwLNC0';
    const snap = await db.collection('products')
        .where("companyId", "==", companyId)
        .get();

    const allProds = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.deletedAt && p.status !== 'Inativo');

    console.log("Total active prods:", allProds.length);

    const searchStr = "798455423628".toLowerCase();
    const normalize = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const targetNormalized = normalize(searchStr);

    const getFullProductText = (p) => normalize(`
        ${p.item || ''} 
        ${p.description || ''} 
        ${p.detailedDescription || ''} 
        ${p.code || ''} 
        ${p.ean || ''} 
        ${p.codigoBarras || ''} 
        ${p.codigo || ''} 
        ${p.model || ''} 
        ${p.manufacturer || ''} 
        ${p.name || ''} 
        ${p.title || ''}
    `);

    let filtered = allProds.filter((p) => {
        const text = getFullProductText(p);
        return text.includes(targetNormalized);
    });

    console.log("Filtered length for '798455423628':", filtered.length);
    if (filtered.length > 0) {
        console.log("Found Camera:", {
            id: filtered[0].id,
            item: filtered[0].item,
            description: filtered[0].description,
            materialPrice: filtered[0].materialPrice,
            sellingPrice: filtered[0].sellingPrice,
            stockQuantity: filtered[0].stockQuantity
        });
    }
    process.exit(0);
}

testTool().catch(console.error);
