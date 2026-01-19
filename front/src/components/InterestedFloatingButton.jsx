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
            ⭐
        </button>


    );
}

export default MessagesFloatingButton;