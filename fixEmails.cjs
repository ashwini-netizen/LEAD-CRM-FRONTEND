const fs = require('fs');
const path = require('path');

const emailRegexSrc = /const emailRegex = \/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\\.\[\^\\s@\]\+\$\/;/g;
const emailRegexTarget = "const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$/;";

const fixLeadForm = () => {
    const file = path.join(__dirname, 'src/pages/LeadForm.jsx');
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(emailRegexSrc, emailRegexTarget);
    c = c.replace(/const cleanedValue = stripEmojis\(value\);/g, "let cleanedValue = stripEmojis(value);\n        if (name === 'email') cleanedValue = cleanedValue.toLowerCase().replace(/\\s/g, '');");
    fs.writeFileSync(file, c);
};

const fixManageLead = () => {
    const file = path.join(__dirname, 'src/pages/ManageLead.jsx');
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/onChange={e => setEditFormData\(\{\.\.\.editFormData, email: stripEmojis\(e\.target\.value\)\}\)}/g, 
                  "onChange={e => setEditFormData({...editFormData, email: stripEmojis(e.target.value).toLowerCase().replace(/\\s/g, '')})}");
    
    // Add validation before saving client details
    c = c.replace(/const handleSaveClientDetails = async \(\) => \{/g, 
        `const handleSaveClientDetails = async () => {\n        const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$/;\n        if (editFormData.email && !emailRegex.test(editFormData.email)) return alert('Please enter a valid email address.');`);
    fs.writeFileSync(file, c);
};

const fixAdminPanel = () => {
    const file = path.join(__dirname, 'src/pages/AdminPanel.jsx');
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/const emailRegex = \/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\\.\[\^\\s@\]\+\$\/;/g, emailRegexTarget);
    c = c.replace(/value={newEmployee\.email} onChange=\{handleEmployeeChange\}/g, 
                  "value={newEmployee.email} onChange={(e) => handleEmployeeChange({ target: { name: 'email', value: stripEmojis(e.target.value).toLowerCase().replace(/\\s/g, '') }})}");
    fs.writeFileSync(file, c);
};

const fixLoginScreen = () => {
    const file = path.join(__dirname, 'src/pages/LoginScreen.jsx');
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/const emailRegex = \/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\\.\[\^\\s@\]\+\$\/;/g, emailRegexTarget);
    c = c.replace(/onChange=\{\(e\) => setEmail\(stripEmojis\(e\.target\.value\)\)\}/g, 
                  "onChange={(e) => setEmail(stripEmojis(e.target.value).toLowerCase().replace(/\\s/g, ''))}");
    fs.writeFileSync(file, c);
};

const fixProfile = () => {
    const file = path.join(__dirname, 'src/pages/Profile.jsx');
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/const emailRegex = \/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\\.\[\^\\s@\]\+\$\/;/g, emailRegexTarget);
    fs.writeFileSync(file, c);
};

fixLeadForm();
fixManageLead();
fixAdminPanel();
fixLoginScreen();
fixProfile();
console.log('Fixed emails!');
