const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'www');

// Clean and recreate www
if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir, { recursive: true });

const itemsToCopy = ['index.html', 'css', 'js', 'o3dv', 'app_plugins', 'assets'];

function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItem => {
            copyRecursive(path.join(src, childItem), path.join(dest, childItem));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

itemsToCopy.forEach(item => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, destPath);
    }
});

console.log('www/ bundle created successfully.');
