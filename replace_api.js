const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'supabase' || file === 'replace_api.js') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            replaceInDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            if (content.includes("'/api/pix'")) {
                content = content.replace(/'\/api\/pix'/g, "'https://ziznxwaehnifcinosenv.supabase.co/functions/v1/pix'");
                modified = true;
            }
            if (content.includes("'/api/track'")) {
                content = content.replace(/'\/api\/track'/g, "'https://ziznxwaehnifcinosenv.supabase.co/functions/v1/track'");
                modified = true;
            }
            if (content.includes("'/api/status'")) {
                content = content.replace(/'\/api\/status'/g, "'https://ziznxwaehnifcinosenv.supabase.co/functions/v1/status'");
                modified = true;
            }
            if (content.includes('"/api/pix"')) {
                content = content.replace(/"\/api\/pix"/g, '"https://ziznxwaehnifcinosenv.supabase.co/functions/v1/pix"');
                modified = true;
            }
            if (content.includes('"/api/track"')) {
                content = content.replace(/"\/api\/track"/g, '"https://ziznxwaehnifcinosenv.supabase.co/functions/v1/track"');
                modified = true;
            }
            if (content.includes('"/api/status"')) {
                content = content.replace(/"\/api\/status"/g, '"https://ziznxwaehnifcinosenv.supabase.co/functions/v1/status"');
                modified = true;
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Updated', fullPath);
            }
        }
    }
}

replaceInDir(process.cwd());
