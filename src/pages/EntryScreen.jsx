import { useNavigate } from 'react-router-dom';
import { Phone, Users, UserCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import logo from '../assets/logo.png';

const roles = [
    { id: 'call_executive', title: 'Call Executive', desc: 'Manage calls & lead entry', icon: <Phone size={32} />, color: '#6366f1', gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
    { id: 'team_lead', title: 'Team Lead', desc: 'Drive field interest & events', icon: <Users size={32} />, color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' },
    { id: 'field_executive', title: 'Field Executive', desc: 'Direct meetings & conversion', icon: <UserCheck size={32} />, color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { id: 'admin', title: 'Admin', desc: 'System control & oversight', icon: <ShieldCheck size={32} />, color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
];

const EntryScreen = ({ onSelectRole }) => {
    const navigate = useNavigate();

    return (
        <div style={containerStyle}>
            {/* Background Elements */}
            <div className="mesh-bg"></div>
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={headerSectionStyle}
            >
                <img src={logo} alt="Navabharath Logo" style={{ height: '120px', marginBottom: '5px', objectFit: 'contain' }} />
                <h1 style={titleStyle}>
                    Lead <span className="text-gradient">Accelerator</span>
                </h1>
                <p style={subtitleStyle}>Empowering your workforce with precision lead management and real-time tracking.</p>
            </motion.div>

            <div style={gridStyle}>
                {roles.map((role, i) => (
                    <motion.div
                        key={role.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
                        whileHover={{ y: -12, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { onSelectRole(role.id); navigate('/login'); }}
                        className="premium-card"
                    >
                        <div style={{ ...iconContainerStyle, background: role.gradient }}>
                            {role.icon}
                        </div>
                        <h3 style={cardTitleStyle}>{role.title}</h3>
                        <p style={cardDescStyle}>{role.desc}</p>

                        <div className="card-footer">
                            <span>Get Started</span>
                            <div className="arrow">→</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');

                * { font-family: 'Outfit', sans-serif; }

                body { margin: 0; background: #f8fafc; overflow-x: hidden; }

                .mesh-bg {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: radial-gradient(circle at 0% 0%, #f0f4ff 0%, #ffffff 50%, #fdf2f8 100%);
                    z-index: -2;
                }

                .blob {
                    position: fixed; width: 600px; height: 600px;
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%);
                    filter: blur(80px); z-index: -1; pointer-events: none;
                }
                .blob-1 { top: -200px; right: -100px; animation: orbit 20s infinite linear; }
                .blob-2 { bottom: -200px; left: -100px; animation: orbit 20s infinite linear reverse; }

                @keyframes orbit {
                    0% { transform: rotate(0deg) translateX(100px) rotate(0deg); }
                    100% { transform: rotate(360deg) translateX(100px) rotate(-360deg); }
                }

                .text-gradient {
                    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .premium-card {
                    width: 280px;
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    border-radius: 32px;
                    padding: 40px 30px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.03);
                }

                .premium-card::before {
                    content: '';
                    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 100%);
                    opacity: 0; transition: 0.3s;
                }

                .premium-card:hover::before { opacity: 1; }

                .card-footer {
                    margin-top: 30px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-weight: 600;
                    color: #94a3b8;
                    transition: 0.3s;
                }

                .premium-card:hover .card-footer { color: #6366f1; }
                .premium-card:hover { box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: rgba(99, 102, 241, 0.1); }
                
                .arrow { transform: translateX(0); transition: 0.3s; }
                .premium-card:hover .arrow { transform: translateX(5px); }

                @media (max-width: 600px) {
                    .premium-card { width: 100%; }
                }
            `}</style>
        </div>
    );
};

const containerStyle = {
    minHeight: '100vh',
    padding: '40px 20px 60px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    boxSizing: 'border-box',
    color: '#1e293b',
};

const headerSectionStyle = {
    textAlign: 'center',
    maxWidth: '800px',
    marginBottom: '35px',
};

const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'white',
    color: '#6366f1',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '800',
    letterSpacing: '1px',
    marginBottom: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    border: '1px solid #f1f5f9',
};

const titleStyle = {
    fontSize: '4.2rem',
    fontWeight: '800',
    margin: '0 0 12px 0',
    letterSpacing: '-2px',
    lineHeight: '1',
    color: '#0f172a',
};

const subtitleStyle = {
    fontSize: '1.2rem',
    color: '#64748b',
    lineHeight: '1.6',
    margin: 0,
    maxWidth: '600px',
    marginInline: 'auto',
};

const gridStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '30px',
    maxWidth: '1300px',
};

const iconContainerStyle = {
    width: '70px',
    height: '70px',
    borderRadius: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    marginBottom: '24px',
    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
};

const cardTitleStyle = {
    fontSize: '1.4rem',
    fontWeight: '700',
    margin: '0 0 10px 0',
    color: '#1e293b',
};

const cardDescStyle = {
    fontSize: '0.9rem',
    color: '#64748b',
    lineHeight: '1.5',
    margin: 0,
};

export default EntryScreen;
