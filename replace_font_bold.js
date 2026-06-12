const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function findAndReplace(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            findAndReplace(filePath);
            return;
        }

        if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            let content = fs.readFileSync(filePath, 'utf8');
            let updated = false;

            if (content.includes('font-bold')) {
                content = content.replace(/font-bold/g, 'font-semibold');
                updated = true;
            }

            if (updated) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated: ${filePath}`);
            }
        }
    });
}

findAndReplace(directoryPath);
console.log('Script completed.');
