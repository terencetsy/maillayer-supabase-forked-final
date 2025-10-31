// src/components/sequences/canvas/CanvasNode.js
import { Alert02, CheckmarkCircle02, Delete02, LeftToRightListTriangle, Mail02, Zap } from '@/lib/icons';
import { useRef } from 'react';

export default function CanvasNode({ type, data, index, isSelected, onClick, onDelete, onDragStart, position, isDragging }) {
    const nodeRef = useRef(null);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only left click
        if (onDragStart && nodeRef.current) {
            onDragStart(e, nodeRef.current);
        }
    };

    if (type === 'trigger') {
        const getTriggerIcon = () => {
            switch (data.triggerType) {
                case 'contact_list':
                    return <LeftToRightListTriangle size={20} />;
                case 'integration':
                    return <Zap size={20} />;
                default:
                    return <LeftToRightListTriangle size={20} />;
            }
        };

        const getTriggerLabel = () => {
            if (data.triggerType === 'contact_list' && data.triggerConfig?.contactListIds?.length > 0) {
                const count = data.triggerConfig.contactListIds.length;
                return `${count} List${count > 1 ? 's' : ''} Selected`;
            }
            if (data.triggerType === 'integration') {
                return data.triggerConfig?.integrationEvent || 'Integration Event';
            }
            return 'Click to Configure';
        };

        const isConfigured = data.triggerType === 'contact_list' ? data.triggerConfig?.contactListIds?.length > 0 : false;

        return (
            <div
                ref={nodeRef}
                className={`canvas-node trigger-node ${isSelected ? 'selected' : ''} ${!isConfigured ? 'warning' : ''} ${isDragging ? 'dragging' : ''}`}
                onClick={onClick}
                onMouseDown={handleMouseDown}
                style={{
                    position: 'absolute',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
            >
                <div className="node-icon trigger-icon">{getTriggerIcon()}</div>
                <div className="node-content">
                    <div className="node-label">Trigger</div>
                    <div className="node-title">{getTriggerLabel()}</div>
                </div>
                {!isConfigured && (
                    <div className="node-badge warning">
                        <Alert02 size={12} />
                    </div>
                )}
                <style jsx>{`
                    .canvas-node {
                        background: #fff;
                        border: 1px solid #8b8b8b;
                        border-radius: 10px;
                        box-shadow: rgb(220, 224, 224) 0px 1px 3px 0px;
                        padding: 1rem;
                        width: 300px;
                        transition: all 0.2s;
                        user-select: none;
                    }

                    .canvas-node:hover {
                        border-color: #ccc;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
                    }

                    .canvas-node.selected {
                        border-color: #1a1a1a;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
                    }

                    .canvas-node.dragging {
                        opacity: 0.8;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    }

                    .trigger-node {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    }

                    .node-icon {
                        width: 40px;
                        height: 40px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .trigger-icon {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #fff;
                    }

                    .trigger-icon svg path {
                        stroke: #fff !important;
                    }

                    .node-content {
                        flex: 1;
                        min-width: 0;
                    }

                    .node-label {
                        font-size: 0.75rem;
                        color: #999;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 4px;
                    }

                    .node-title {
                        font-size: 0.875rem;
                        font-weight: 500;
                        color: #1a1a1a;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .node-icon svg path {
                        color: #fff;
                    }

                    .node-badge {
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }

                    .node-badge.warning {
                        background: #f57c00;
                        color: #fff;
                    }
                `}</style>
            </div>
        );
    }

    if (type === 'email') {
        const isConfigured = data.subject && data.content;

        return (
            <div
                ref={nodeRef}
                className={`canvas-node email-node ${isSelected ? 'selected' : ''} ${!isConfigured ? 'warning' : ''} ${isDragging ? 'dragging' : ''}`}
                onClick={onClick}
                onMouseDown={handleMouseDown}
                style={{
                    position: 'absolute',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                }}
            >
                <div className="node-header">
                    <div className="node-icon email-icon">
                        <Mail02 size={20} />
                    </div>
                    <div className="node-content">
                        <div className="node-label">Email {index + 1}</div>
                        <div className="node-title">{data.subject || 'Untitled Email'}</div>
                    </div>
                    {isConfigured && (
                        <div className="node-badge success">
                            <CheckmarkCircle02 size={12} />
                        </div>
                    )}
                </div>
                {onDelete && (
                    <button
                        className="delete-node-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <Delete02 size={14} />
                    </button>
                )}
                <style jsx>{`
                    .canvas-node {
                        background: #fff;

                        border: 1px solid #8b8b8b;
                        border-radius: 10px;
                        box-shadow: rgb(220, 224, 224) 0px 1px 3px 0px;

                        padding: 1rem;
                        width: 300px;
                        transition: all 0.2s;
                        position: relative;
                        user-select: none;
                    }

                    .canvas-node:hover {
                        border-color: #ccc;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
                    }

                    .canvas-node.selected {
                        border-color: #1a1a1a;
                        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
                    }

                    .canvas-node.dragging {
                        opacity: 0.8;
                        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                    }

                    .node-header {
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                    }

                    .node-icon {
                        width: 40px;
                        height: 40px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }

                    .email-icon {
                        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                        color: #fff;
                    }

                    .trigger-icon svg path {
                        color: #fff;
                    }

                    .node-content {
                        flex: 1;
                        min-width: 0;
                    }

                    .node-label {
                        font-size: 0.75rem;
                        color: #999;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 4px;
                    }

                    .node-title {
                        font-size: 0.875rem;
                        font-weight: 500;
                        color: #1a1a1a;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }

                    .node-badge {
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    }

                    .node-badge.success {
                        background: #2e7d32;
                        color: #fff;
                    }

                    .delete-node-btn {
                        position: absolute;
                        top: -10px;
                        left: -10px;
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        background: #dc2626;
                        color: #fff;
                        border: 2px solid #fff;
                        display: none;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    }

                    .canvas-node:hover .delete-node-btn {
                        display: flex;
                    }

                    .delete-node-btn:hover {
                        background: #b91c1c;
                        transform: scale(1.1);
                    }
                `}</style>
            </div>
        );
    }

    return null;
}
