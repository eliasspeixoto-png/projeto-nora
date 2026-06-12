const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

// These are the classes we want to remove
const classesToRemoveRegex = /\b(sm:|md:|lg:|xl:)?text-(lg|2xl|3xl|4xl|5xl|6xl|7xl|8xl)\b/g;

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // We will look for <h1, <h2, <CardTitle and replace their sizing classes
    // A simple approach is to use a regex replacement with a custom function
    const tagRegex = /<(h1|h2|CardTitle)([^>]*)className=["']([^"']+)["']([^>]*)>/g;

    const newContent = content.replace(tagRegex, (match, tag, beforeClass, classNameStr, afterClass) => {
        // Did we find sizing classes?
        if (classesToRemoveRegex.test(classNameStr)) {
            // Remove them
            let newClassStr = classNameStr.replace(classesToRemoveRegex, '').replace(/\s+/g, ' ').trim();
            
            // Add 'text-xl' (20px) if not already there and if 'text-' is completely removed
            if (!newClassStr.includes('text-xl')) {
                // Ensure we don't accidentally double-add it if we have something like text-red-500
                // Actually, text-xl relates to font-size, so we just append it
                newClassStr = newClassStr + ' text-xl';
            }
            
            updated = true;
            return `<${tag}${beforeClass}className="${newClassStr.trim()}"${afterClass}>`;
        }
        return match; // No changes
    });

    if (updated) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated: ${filePath}`);
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

console.log('Iniciando o redimensionamento de títulos (20px)...');
traverse(directoryPath);
console.log('Concluído!');
