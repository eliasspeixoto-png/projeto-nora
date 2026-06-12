const fs = require('fs');
const path = require('path');

function getFiles(dirPath, ext, arrayOfFiles) {
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (e) {
    return arrayOfFiles || [];
  }

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getFiles(path.join(dirPath, file), ext, arrayOfFiles);
    } else {
      if (file.endsWith(ext) || file.endsWith('.ts')) {
          arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });

  return arrayOfFiles;
}

const dir = 'C:/Users/Administrador/Documents/PROJETO NORA/src';
const files = getFiles(dir, '.tsx');

let count = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('font-black')) {
    const newContent = content.replace(/font-black/g, 'font-semibold');
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated: ' + file);
    count++;
  }
});

console.log('Total files updated: ' + count);
