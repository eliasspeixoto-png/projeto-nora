const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // We look for <h1, <h2, <CardTitle and remove 'uppercase' from their className
    const tagRegex = /<(h1|h2|CardTitle)([^>]*)className=["']([^"']+)["']([^>]*)>/g;

    const newContent = content.replace(tagRegex, (match, tag, beforeClass, classNameStr, afterClass) => {
        if (classNameStr.includes('uppercase')) {
            // Remove 'uppercase'
            let newClassStr = classNameStr.replace(/\buppercase\b/g, '').replace(/\s+/g, ' ').trim();
            
            // Because wide tracking looks weird on non-uppercase, we optionally remove extreme tracking too
            // But let's just stick to exactly what was requested: uppercase
            
            updated = true;
            return `<${tag}${beforeClass}className="${newClassStr}"${afterClass}>`;
        }
        return match;
    });

    if (updated) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated (removed uppercase): ${filePath}`);
    }
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

console.log('Iniciando a remoção do UPPRCASE dos títulos...');
traverse(directoryPath);
console.log('Concluído!');
