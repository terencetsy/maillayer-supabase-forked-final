// src/components/sequences/blocks/AddEmailButton.js
import { Plus } from 'lucide-react';

export default function AddEmailButton({ onClick }) {
    return (
        <button
            className="add-email-button"
            onClick={onClick}
        >
            <div className="add-email-icon">
                <Plus size={20} />
            </div>
            <span>Add Email</span>
        </button>
    );
}
