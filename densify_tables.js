const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src');

function processFile(filePath) {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Se não tem tabela, ignoramos para não mexer em formulários nativos ou botões de cabeçalho alheios
    if (!content.includes('<Table ' ) && !content.includes('<Table>')) return;

    // 1. Table Wrapper: rounded-[2.5rem] -> rounded-xl, rounded-[2rem] -> rounded-xl (onde estiver perto de shadow-executive)
    content = content.replace(/rounded-\[2\.5rem\](.*?shadow-executive)/g, 'rounded-xl$1');
    content = content.replace(/rounded-\[2rem\](.*?shadow-executive)/g, 'rounded-xl$1');

    // 2. TableHead
    content = content.replace(/<TableHead([^>]*)className=["']([^"']+)["']([^>]*)>/g, (match, beforeClass, classNameStr, afterClass) => {
        let newClass = classNameStr.replace(/\bh-\d+\b/g, '').replace(/\bh-\[\d+px\]\b/g, '').trim();
        if (!newClass.includes('h-[34px]')) newClass += ' h-[34px]';
        return `<TableHead${beforeClass}className="${newClass.replace(/\s+/g, ' ')}"${afterClass}>`;
    });

    // 3. TableRow
    content = content.replace(/<TableRow([^>]*)className=["']([^"']+)["']([^>]*)>/g, (match, beforeClass, classNameStr, afterClass) => {
        let newClass = classNameStr.replace(/\bh-\d+\b/g, '').replace(/\bh-\[\d+px\]\b/g, '').trim();
        if (!newClass.includes('h-[34px]')) newClass += ' h-[34px]';

        // Add zebra striping to data rows (ones that have 'group')
        if (newClass.includes('group') || newClass.includes('cursor-pointer')) {
            // Remove old hovers and evens
            newClass = newClass.replace(/hover:bg-[a-zA-Z0-9/-]+/g, '')
                               .replace(/even:bg-[a-zA-Z0-9/-]+/g, '')
                               .replace(/dark:even:bg-[a-zA-Z0-9/-]+/g, '')
                               .trim();
            // Inject new ones
            newClass = `${newClass} hover:bg-primary/10 even:bg-blue-50 dark:even:bg-blue-900/30`;
        }
        return `<TableRow${beforeClass}className="${newClass.replace(/\s+/g, ' ')}"${afterClass}>`;
    });

    // 4. TableCell
    content = content.replace(/<TableCell([^>]*)className=["']([^"']+)["']([^>]*)>/g, (match, beforeClass, classNameStr, afterClass) => {
        let newClass = classNameStr.replace(/\bpy-\d+\b/g, '').replace(/\btext-sm\b/g, 'text-xs').replace(/\btext-\[11px\]\b/g, 'text-xs').replace(/\btext-\[15px\]\b/g, 'text-xs').trim();
        if (!newClass.includes('py-0')) newClass = `py-0 ${newClass}`;
        return `<TableCell${beforeClass}className="${newClass.replace(/\s+/g, ' ')}"${afterClass}>`;
    });

    // 5. Header Bars & Buttons within tables module
    // To be safe we only minify ones that look like they belong to toolbar:
    // replacing h-12 with h-9, rounded-2xl with rounded-lg, text sizes dropping.
    content = content.replace(/<Input([^>]*)className=["']([^"']+)["']/g, (match, beforeClass, classNameStr) => {
        if (classNameStr.includes('h-12')) {
            let newClass = classNameStr.replace('h-12', 'h-9').replace('rounded-2xl', 'rounded-lg').replace('rounded-[2rem]', 'rounded-lg');
            if(!newClass.includes('text-xs')) newClass += ' text-xs';
            return `<Input${beforeClass}className="${newClass}"`;
        }
        return match;
    });

    content = content.replace(/<SelectTrigger([^>]*)className=["']([^"']+)["']/g, (match, beforeClass, classNameStr) => {
        if (classNameStr.includes('h-12')) {
            let newClass = classNameStr.replace('h-12', 'h-9').replace('rounded-2xl', 'rounded-lg').replace('rounded-[2rem]', 'rounded-lg');
            if(!newClass.includes('text-xs')) newClass += ' text-xs';
            return `<SelectTrigger${beforeClass}className="${newClass}"`;
        }
        return match;
    });

    content = content.replace(/<SelectContent([^>]*)className=["']([^"']+)["']/g, (match, beforeClass, classNameStr) => {
        if (classNameStr.includes('rounded-2xl') || classNameStr.includes('rounded-[2rem]')) {
            let newClass = classNameStr.replace('rounded-2xl', 'rounded-lg').replace('rounded-[2rem]', 'rounded-lg');
            return `<SelectContent${beforeClass}className="${newClass}"`;
        }
        return match;
    });

    content = content.replace(/<Button([^>]*)className=["']([^"']+)["']/g, (match, beforeClass, classNameStr) => {
        // Only modify standard Action buttons with h-12
        if (classNameStr.includes('h-12')) {
            let newClass = classNameStr.replace('h-12', 'h-9').replace('rounded-2xl', 'rounded-lg').replace('rounded-[2rem]', 'rounded-lg');
            if(!newClass.includes('text-xs')) newClass += ' text-xs';
            return `<Button${beforeClass}className="${newClass}"`;
        }
        // Also modify the h-8 w-8 inside Tables to h-6 w-6
        if(classNameStr.includes('h-10 w-10 p-0')) {
             let newClass = classNameStr.replace('h-10 w-10', 'h-6 w-6').replace('rounded-xl', 'rounded-md').replace('rounded-2xl', 'rounded-md');
             return `<Button${beforeClass}className="${newClass}"`;
        }
        if(classNameStr.includes('h-8 w-8 p-0')) {
             let newClass = classNameStr.replace('h-8 w-8', 'h-6 w-6').replace('rounded-lg', 'rounded-md');
             return `<Button${beforeClass}className="${newClass}"`;
        }
        return match;
    });

    // Fix icons inside the minified buttons inside tables
    content = content.replace(/<MoreHorizontal([^>]*)className=["']([^"']+)["']/g, (match, beforeClass, classNameStr) => {
        if(classNameStr.includes('h-5 w-5')) {
             let newClass = classNameStr.replace('h-5 w-5', 'h-4 w-4');
             return `<MoreHorizontal${beforeClass}className="${newClass}"`;
        }
        return match;
    });

    // Pagination Wrapper
    content = content.replace(/bg-background\/20 backdrop-blur-3xl rounded-\[1\.5rem\](.*?mb-10)/g, 'bg-background/20 backdrop-blur-3xl rounded-xl$1');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Densificado: ${filePath}`);
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

console.log('Iniciando densificação Global de Tabelas (High-Density 34px)...');
traverse(directoryPath);
console.log('Concluído!');
