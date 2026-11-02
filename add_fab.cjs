const fs = require('fs');
let appContent = fs.readFileSync('src/App.jsx', 'utf-8');

// Add import
if (!appContent.includes('MessageSquare')) {
    appContent = appContent.replace("import { Toaster, toast } from 'react-hot-toast';", "import { Toaster, toast } from 'react-hot-toast';\nimport { MessageSquare } from 'lucide-react';");
}

// Add the button
const btnCode = `
            {user && location.pathname !== '/chat' && !chatPartner && (
                <button
                    onClick={() => navigate('/chat')}
                    className="floating-chat-btn"
                    title="Open Internal Chat"
                >
                    <MessageSquare size={26} />
                </button>
            )}
`;

if (!appContent.includes('floating-chat-btn')) {
    appContent = appContent.replace('<ChatTrigger onOpenChat={openChat} />', '<ChatTrigger onOpenChat={openChat} />\n' + btnCode);
    fs.writeFileSync('src/App.jsx', appContent);
}

let cssContent = fs.readFileSync('src/index.css', 'utf-8');
const newCss = `

.floating-chat-btn {
    position: fixed;
    bottom: 30px;
    right: 30px;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 999;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-chat-btn:hover {
    transform: translateY(-5px) scale(1.05);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.6);
}
`;

if (!cssContent.includes('.floating-chat-btn')) {
    fs.writeFileSync('src/index.css', cssContent + newCss);
}

console.log('App and CSS updated for floating chat button');
