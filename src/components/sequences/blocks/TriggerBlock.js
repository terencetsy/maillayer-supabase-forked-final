// src/components/sequences/blocks/TriggerBlock.js
import { List, Zap, AlertTriangle } from 'lucide-react';

export default function TriggerBlock({ sequence, isSelected, onClick }) {
    const getTriggerIcon = () => {
        switch (sequence.triggerType) {
            case 'contact_list':
                return <List size={22} />;
            case 'integration':
                return <Zap size={22} />;
            default:
                return <List size={22} />;
        }
    };

    const getTriggerLabel = () => {
        if (sequence.triggerType === 'contact_list' && sequence.triggerConfig?.contactListIds?.length > 0) {
            const count = sequence.triggerConfig.contactListIds.length;
            return `${count} List${count > 1 ? 's' : ''} Selected`;
        }
        if (sequence.triggerType === 'integration') {
            return sequence.triggerConfig?.integrationEvent || 'Integration Event';
        }
        return 'Not Configured';
    };

    const isConfigured = sequence.triggerType === 'contact_list' ? sequence.triggerConfig?.contactListIds?.length > 0 : false;

    return (
        <div
            className={`trigger-block ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
        >
            <div className="trigger-block-header">
                <div className="trigger-block-icon">{getTriggerIcon()}</div>
                <div className="trigger-block-content">
                    <div className="trigger-block-title">Trigger</div>
                    <div className="trigger-block-subtitle">{getTriggerLabel()}</div>
                </div>
            </div>

            {!isConfigured && (
                <div className="trigger-block-warning">
                    <AlertTriangle size={16} />
                    <span>Setup required</span>
                </div>
            )}
        </div>
    );
}
