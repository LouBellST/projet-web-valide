import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authFetch } from '../auth/useAuth';
import '../styles/MessagesFloatingButton.css';

function MessagesFloatingButton() {
    const { user } = useAuth();
    const navigate = useNavigate();


    if (!user) return null;

    return (

        <button
            className="floating-btn interested-btn"
            onClick={() => navigate('/my-interested')}
            title="Personnes intéressées par mes posts"
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <polygon points="12 2 15.09 10.26 24 10.26 17.55 16.74 20.64 25 12 19.52 3.36 25 6.45 16.74 0 10.26 8.91 10.26 12 2" />
            </svg>
        </button>


    );
}

export default MessagesFloatingButton;