import fs from 'fs';

let content = fs.readFileSync('src/index.css', 'utf-8');

const fixedPart = `
    background: linear-gradient(135deg, #f8fafc, #f1f5f9);
    color: #475569;
    border: 1px solid #e2e8f0;
    padding: 12px 24px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}

.btn-secondary:hover {
    background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
    border-color: #cbd5e1;
    transform: translateY(-2px);
    color: #1e293b;
    box-shadow: 0 6px 16px rgba(148, 163, 184, 0.15);
}

.logout-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #ef4444;
    background: none;
    border: none;
    cursor: pointer;
    padding: 12px 15px;
    font-weight: 600;
    width: 100%;
    transition: all 0.3s ease;
    border-radius: 8px;
}

.logout-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    transform: translateX(5px);
}

.input-field {
    width: 100%;
    padding: 14px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    color: var(--text-main);
    outline: none;
    transition: 0.3s;
}

`;

const newContent = content.split('.btn-secondary {')[0] + '.btn-secondary {' + fixedPart + '.input-field:focus {' + content.split('.input-field:focus {')[1];
fs.writeFileSync('src/index.css', newContent);
console.log('Fixed CSS syntax issue and added logout-btn');
