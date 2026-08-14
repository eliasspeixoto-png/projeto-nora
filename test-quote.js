const { searchQuoteByCodeAdmin } = require('./src/lib/firebase/admin-db');

async function test() {
    try {
        const res = await searchQuoteByCodeAdmin("eliasspeixoto-png/projeto-nora", "OS-0145/26");
        console.log("Result:", res);
    } catch (e) {
        console.error(e);
    }
}
test();
