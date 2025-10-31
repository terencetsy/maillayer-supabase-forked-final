// src/components/sequences/canvas/NodePanel.js
import { X, Mail, Clock, Workflow } from 'lucide-react';

export default function NodePanel({ isOpen, onClose, onAddNode }) {
    if (!isOpen) return null;

    const nodeTypes = [
        {
            id: 'email',
            icon: Mail,
            label: 'Email',
            description: 'Send an email to contacts',
        },
        {
            id: 'delay',
            icon: Clock,
            label: 'Delay',
            description: 'Wait before next action',
        },
        {
            id: 'condition',
            icon: Workflow,
            label: 'Condition',
            description: 'Split based on criteria',
        },
    ];

    return (
        <div className="node-panel">
            <div className="panel-header">
                <h3>Add Node</h3>
                <button
                    onClick={onClose}
                    className="close-btn"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="panel-content">
                {nodeTypes.map((node) => {
                    const Icon = node.icon;
                    return (
                        <button
                            key={node.id}
                            className="node-type-btn"
                            onClick={() => {
                                onAddNode(node.id);
                                onClose();
                            }}
                        >
                            <div className="node-type-icon">
                                <Icon size={24} />
                            </div>
                            <div className="node-type-info">
                                <div className="node-type-label">{node.label}</div>
                                <div className="node-type-description">{node.description}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <style jsx>{`
                .node-panel {
                    position: fixed;
                    right: 20px;
                    top: 80px;
                    width: 300px;
                    background: #fff;
                    border: 1px solid #e0e0e0;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                    z-index: 100;
                    animation: slideIn 0.3s ease-out;
                }

                .panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid #e0e0e0;
                }

                .panel-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 500;
                }

                .close-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #666;
                    display: flex;
                    padding: 0.25rem;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    background: #f5f5f5;
                    color: #1a1a1a;
                }

                .panel-content {
                    padding: 0.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .node-type-btn {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    background: #fff;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                }

                .node-type-btn:hover {
                    background: #fafafa;
                    border-color: #ccc;
                }

                .node-type-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .node-type-info {
                    flex: 1;
                }

                .node-type-label {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #1a1a1a;
                    margin-bottom: 4px;
                }

                .node-type-description {
                    font-size: 0.75rem;
                    color: #999;
                }

                @keyframes slideIn {
                    from {
                        transform: translateX(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
}
