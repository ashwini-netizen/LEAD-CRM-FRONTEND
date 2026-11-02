import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const BackButton = ({ to, label = 'Back' }) => {
    const navigate = useNavigate();

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (to) {
            navigate(to, { replace: true });
        } else {
            navigate('/dashboard', { replace: true });
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.1)',
                color: 'var(--primary, #6366f1)',
                padding: '8px 16px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                marginRight: '15px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                e.currentTarget.style.transform = 'translateX(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                e.currentTarget.style.transform = 'translateX(0)';
            }}
        >
            <ArrowLeft size={18} />
            {label}
        </button>
    );
};

export default BackButton;
