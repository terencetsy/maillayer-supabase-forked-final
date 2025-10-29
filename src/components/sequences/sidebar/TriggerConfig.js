// src/components/sequences/sidebar/TriggerConfig.js
import { useState, useEffect } from 'react';
import { List, Zap, Check } from 'lucide-react';

export default function TriggerConfig({ sequence, onUpdate }) {
    const [contactLists, setContactLists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchContactLists();
    }, []);

    const fetchContactLists = async () => {
        try {
            const response = await fetch(`/api/brands/${sequence.brandId}/contact-lists`, {
                credentials: 'same-origin',
            });
            if (response.ok) {
                const data = await response.json();
                setContactLists(data);
            }
        } catch (error) {
            console.error('Error fetching contact lists:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTriggerTypeChange = (type) => {
        onUpdate({
            triggerType: type,
            triggerConfig: {
                contactListIds: type === 'contact_list' ? [] : undefined,
            },
        });
    };

    const handleListToggle = (listId) => {
        const currentLists = sequence.triggerConfig?.contactListIds || [];
        const newLists = currentLists.includes(listId) ? currentLists.filter((id) => id !== listId) : [...currentLists, listId];

        onUpdate({
            triggerConfig: {
                ...sequence.triggerConfig,
                contactListIds: newLists,
            },
        });
    };

    return (
        <div className="trigger-config">
            <h2>Configure Trigger</h2>
            <p className="subtitle">Choose how contacts enter this sequence</p>

            {/* Trigger Type */}
            <div className="form-section">
                <label className="form-label">Trigger Type</label>
                <div className="trigger-type-options">
                    <button
                        className={`trigger-type-option ${sequence.triggerType === 'contact_list' ? 'selected' : ''}`}
                        onClick={() => handleTriggerTypeChange('contact_list')}
                    >
                        <List size={16} />
                        <span>Lists</span>
                        {sequence.triggerType === 'contact_list' && (
                            <Check
                                size={15}
                                className="check-icon"
                            />
                        )}
                    </button>

                    <button
                        className={`trigger-type-option ${sequence.triggerType === 'integration' ? 'selected' : ''}`}
                        onClick={() => handleTriggerTypeChange('integration')}
                    >
                        <Zap size={16} />
                        <span>Integration</span>
                        {sequence.triggerType === 'integration' && (
                            <Check
                                size={15}
                                className="check-icon"
                            />
                        )}
                    </button>
                </div>
            </div>

            {/* Contact List Selection */}
            {sequence.triggerType === 'contact_list' && (
                <div className="form-section">
                    <label className="form-label">Select Lists</label>
                    <p className="helper-text">Contacts added to these lists will enter the sequence</p>

                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : contactLists.length === 0 ? (
                        <div className="empty-state">
                            <p>No contact lists found</p>
                        </div>
                    ) : (
                        <div className="list-options">
                            {contactLists.map((list) => {
                                const isSelected = sequence.triggerConfig?.contactListIds?.includes(list._id);
                                return (
                                    <label
                                        key={list._id}
                                        className={`list-option ${isSelected ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleListToggle(list._id)}
                                        />
                                        <div className="list-option-content">
                                            <div className="list-option-name">{list.name}</div>
                                            <div className="list-option-count">{list.contactCount || 0} contacts</div>
                                        </div>
                                        {isSelected && (
                                            <Check
                                                size={16}
                                                className="check-icon"
                                            />
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
