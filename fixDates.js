const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src', 'pages');

const replaceInFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(/\.toLocaleDateString\(\)/g, ".toLocaleDateString('en-GB')");
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${filePath}`);
    }
};

const traverseDirectory = (dir) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            replaceInFile(fullPath);
        }
    });
};

traverseDirectory(directoryPath);
