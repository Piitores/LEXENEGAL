import React from 'react';
import './ActionButton.css';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon?: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
}

/** Bouton d'action standard des pages de ressources (décision, article, code, doctrine…). */
const ActionButton: React.FC<ActionButtonProps> = ({ icon, variant = 'secondary', children, className, ...rest }) => (
    <button className={`action-btn action-btn--${variant}${className ? ` ${className}` : ''}`} {...rest}>
        {icon}
        <span>{children}</span>
    </button>
);

export default ActionButton;
