import Link from 'next/link';
import { Users, Trash, UploadCloud, UserPlus, MoreVertical, Globe } from 'lucide-react';
import { useState } from 'react';

export default function ContactListItem({ list, brandId, onDelete, onImport }) {
    const [showDropdown, setShowDropdown] = useState(false);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleDropdownToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDropdown(!showDropdown);
    };

    const handleDeleteClick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (window.confirm(`Are you sure you want to delete the "${list.name}" contact list?`)) {
            onDelete(list._id);
        }

        setShowDropdown(false);
    };

    const handleImportClick = (method) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        onImport(list._id, method);
        setShowDropdown(false);
    };

    return (
        <Link
            href={`/brands/${brandId}/contacts/${list._id}`}
            className="contact-list-card"
        >
            <div className="card-icon">
                <Users size={24} />
            </div>
            <div className="card-content">
                <div className="card-header">
                    <h3>{list.name}</h3>
                    <div className="dropdown-container">
                        <button
                            className="more-button"
                            onClick={handleDropdownToggle}
                            aria-label="More options"
                        >
                            <MoreVertical size={18} />
                        </button>

                        {showDropdown && (
                            <div className="dropdown-menu">
                                <button
                                    className="dropdown-item"
                                    onClick={handleImportClick('manual')}
                                >
                                    <UserPlus size={16} />
                                    <span>Add Contact</span>
                                </button>
                                <button
                                    className="dropdown-item"
                                    onClick={handleImportClick('csv')}
                                >
                                    <UploadCloud size={16} />
                                    <span>Import CSV</span>
                                </button>
                                <div className="dropdown-divider"></div>
                                <button
                                    className="dropdown-item delete"
                                    onClick={handleDeleteClick}
                                >
                                    <Trash size={16} />
                                    <span>Delete List</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {list.description && <p className="description">{list.description}</p>}

                <div className="list-stats">
                    <div className="stat">
                        <span className="value">{list.contactCount || 0}</span>
                        <span className="label">Contacts</span>
                    </div>
                    <div className="stat">
                        <span className="value">{formatDate(list.createdAt)}</span>
                        <span className="label">Created</span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
