const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // assuming it exists or we can init another way

// Instead of setting up firebase admin from scratch, let's just use the existing compiled code.
const { firestore } = require('./src/lib/firebase/admin-db'); // Wait, this uses 'firebase-admin'

async function fetchIt() {
    try {
        const snap = await firestore.collection('quotes')
            .where('companyId', '==', 'eliasspeixoto-png/projeto-nora')
            .get();
        const docs = snap.docs.map(d => d.data());
        const found = docs.filter(d => (d.quoteNumber || '').includes('145'));
        console.log("Found quotes:", found.map(f => f.quoteNumber));
    } catch(e) {
        console.error(e);
    }
}
fetchIt();
