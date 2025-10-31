// src/components/sequences/SequenceBuilder.js
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import NodePanel from './canvas/NodePanel';
import CanvasNode from './canvas/CanvasNode';
import NodeConfigDrawer from './canvas/NodeConfigDrawer';
import { ArrowLeft02, Close, Mail02, Pause, Play, PlusSign, SaveFloppy } from '@/lib/icons';

export default function SequenceBuilder({ sequence, onUpdate, onSave, onToggleActive, isSaving, hasUnsavedChanges, error, onClearError, brandId }) {
    const [selectedNode, setSelectedNode] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [nodePositions, setNodePositions] = useState({});
    const [draggingNode, setDraggingNode] = useState(null);
    const [nodeDragStart, setNodeDragStart] = useState({ x: 0, y: 0 });
    const [hasDragged, setHasDragged] = useState(false);

    const canvasRef = useRef(null);
    const savePositionsTimeoutRef = useRef(null);

    // Load positions from sequence or initialize
    useEffect(() => {
        if (sequence) {
            const centerX = window.innerWidth / 2 - 100;
            const centerY = 100;

            // Check if sequence has saved positions
            if (sequence.canvasPositions && Object.keys(sequence.canvasPositions).length > 0) {
                console.log('Loading saved positions:', sequence.canvasPositions);
                setNodePositions(sequence.canvasPositions);
            } else {
                // Initialize default centered positions
                const positions = {
                    trigger: { x: centerX, y: centerY },
                };

                sequence.emails?.forEach((email, index) => {
                    positions[email.id] = {
                        x: centerX,
                        y: centerY + 250 + index * 220,
                    };
                });

                console.log('Initializing default positions:', positions);
                setNodePositions(positions);

                // Save initial positions immediately
                savePositionsToDatabase(positions);
            }
        }
    }, [sequence?._id]); // Only run when sequence ID changes

    // Add new email nodes with positions
    useEffect(() => {
        if (sequence?.emails && nodePositions['trigger']) {
            const centerX = window.innerWidth / 2 - 100;
            const centerY = 100;
            let hasNewNodes = false;
            const updatedPositions = { ...nodePositions };

            sequence.emails.forEach((email, index) => {
                if (!updatedPositions[email.id]) {
                    updatedPositions[email.id] = {
                        x: centerX,
                        y: centerY + 250 + index * 220,
                    };
                    hasNewNodes = true;
                }
            });

            if (hasNewNodes) {
                console.log('Adding new node positions:', updatedPositions);
                setNodePositions(updatedPositions);
                savePositionsToDatabase(updatedPositions);
            }
        }
    }, [sequence?.emails?.length]);

    // Save positions to database directly
    const savePositionsToDatabase = async (positions) => {
        if (savePositionsTimeoutRef.current) {
            clearTimeout(savePositionsTimeoutRef.current);
        }

        savePositionsTimeoutRef.current = setTimeout(async () => {
            try {
                console.log('Saving positions to database:', positions);

                // Use the correct API endpoint - note it's /email-sequences/ not /sequences/
                const response = await fetch(`/api/brands/${brandId}/email-sequences/${sequence._id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        canvasPositions: positions,
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Failed to save canvas positions:', errorData);
                } else {
                    const result = await response.json();
                    console.log('Canvas positions saved successfully:', result);
                }
            } catch (error) {
                console.error('Error saving canvas positions:', error);
            }
        }, 500); // Save after 500ms of no position changes
    };

    const handleCanvasMouseDown = (e) => {
        if (e.target === canvasRef.current || e.target.closest('.canvas-background')) {
            setIsDraggingCanvas(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            setSelectedNode(null);
        }
    };

    const handleCanvasMouseMove = (e) => {
        if (isDraggingCanvas) {
            setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }

        if (draggingNode) {
            setHasDragged(true); // Mark that we've actually dragged

            const rect = canvasRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left - pan.x) / zoom - nodeDragStart.offsetX;
            const y = (e.clientY - rect.top - pan.y) / zoom - nodeDragStart.offsetY;

            const newPositions = {
                ...nodePositions,
                [draggingNode]: { x, y },
            };

            setNodePositions(newPositions);
        }
    };

    const handleCanvasMouseUp = () => {
        setIsDraggingCanvas(false);

        // Save positions when drag ends
        if (draggingNode) {
            console.log('Drag ended, saving positions');
            savePositionsToDatabase(nodePositions);
            setDraggingNode(null);

            // Reset drag flag after a short delay
            setTimeout(() => {
                setHasDragged(false);
            }, 100);
        }
    };

    const handleNodeDragStart = (nodeId, e, nodeElement) => {
        e.stopPropagation();
        setHasDragged(false); // Reset drag flag

        const rect = nodeElement.getBoundingClientRect();

        setDraggingNode(nodeId);
        setNodeDragStart({
            offsetX: (e.clientX - rect.left) / zoom,
            offsetY: (e.clientY - rect.top) / zoom,
        });
    };

    const handleNodeClick = (nodeId) => {
        // Only open drawer if we didn't drag
        if (!hasDragged) {
            setSelectedNode(nodeId);
        }
    };

    const handleZoom = (delta) => {
        setZoom((prev) => Math.max(0.5, Math.min(1.5, prev + delta)));
    };

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
        }
    };

    const validateForActivation = () => {
        if (sequence.triggerType === 'contact_list') {
            if (!sequence.triggerConfig?.contactListIds?.length) {
                return 'Configure trigger lists first';
            }
        }

        if (!sequence.emails || sequence.emails.length === 0) {
            return 'Add at least one email';
        }

        const incompleteEmails = sequence.emails.filter((email) => !email.subject || !email.content);
        if (incompleteEmails.length > 0) {
            return `Complete Email ${incompleteEmails[0].order}`;
        }

        return null;
    };

    const handleToggleClick = async () => {
        if (sequence.status !== 'active') {
            const error = validateForActivation();
            if (error) {
                alert(error);
                return;
            }
        }

        await onToggleActive();
    };

    const handleAddEmail = () => {
        const newEmailId = `email-${Date.now()}`;
        const currentEmails = sequence.emails || [];

        const newEmail = {
            id: newEmailId,
            order: currentEmails.length + 1,
            subject: '',
            content: '',
            delayAmount: 1,
            delayUnit: 'days',
        };

        onUpdate({
            emails: [...currentEmails, newEmail],
        });

        setTimeout(() => {
            setSelectedNode(newEmailId);
        }, 100);
    };

    const handleDeleteEmail = (emailId) => {
        if (sequence.emails.length === 1) {
            alert('Cannot delete the last email. Sequence must have at least one email.');
            return;
        }

        if (!window.confirm('Are you sure you want to delete this email?')) {
            return;
        }

        const updatedEmails = sequence.emails.filter((e) => e.id !== emailId).map((e, index) => ({ ...e, order: index + 1 }));

        // Remove position for deleted node
        const newPositions = { ...nodePositions };
        delete newPositions[emailId];

        setNodePositions(newPositions);
        setSelectedNode(null);

        onUpdate({
            emails: updatedEmails,
        });

        // Save updated positions
        savePositionsToDatabase(newPositions);
    };

    const getSaveButtonText = () => {
        if (isSaving) return 'Saving...';
        if (hasUnsavedChanges) return 'Save';
        return 'Saved';
    };

    // Calculate connection paths
    const getConnectionPath = (fromPos, toPos) => {
        if (!fromPos || !toPos) return '';

        const fromX = fromPos.x + 150;
        const fromY = fromPos.y + 80;
        const toX = toPos.x + 150;
        const toY = toPos.y;

        const midY = (fromY + toY) / 2;

        return `M ${fromX} ${fromY} 
                L ${fromX} ${midY}
                L ${toX} ${midY}
                L ${toX} ${toY}`;
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (savePositionsTimeoutRef.current) {
                clearTimeout(savePositionsTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="sequence-builder">
            {/* Top Bar */}
            <div className="builder-topbar">
                <div className="topbar-left">
                    <Link
                        href={`/brands/${brandId}/sequences`}
                        className="back-link"
                    >
                        <ArrowLeft02 size={16} />
                        Back
                    </Link>
                    <div className="sequence-title">
                        <h1>{sequence.name}</h1>
                        <span className={`status-badge status-${sequence.status}`}>{sequence.status === 'active' ? 'Active' : sequence.status === 'paused' ? 'Paused' : 'Draft'}</span>
                    </div>
                </div>
                <div className="topbar-right">
                    {sequence.emailConfig?.fromEmail && (
                        <div className="email-config-info">
                            <Mail02 size={14} />
                            <span className="from-email">{sequence.emailConfig.fromEmail}</span>
                            {sequence.emailConfig.replyToEmail && <span className="reply-email">→ {sequence.emailConfig.replyToEmail}</span>}
                        </div>
                    )}
                    <div className="zoom-controls">
                        <button
                            onClick={() => handleZoom(-0.1)}
                            className="zoom-btn"
                        >
                            −
                        </button>
                        <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => handleZoom(0.1)}
                            className="zoom-btn"
                        >
                            +
                        </button>
                    </div>
                    <button
                        className="button button--secondary"
                        onClick={onSave}
                        disabled={isSaving || !hasUnsavedChanges}
                    >
                        <SaveFloppy size={15} />
                        {getSaveButtonText()}
                    </button>
                    <button
                        className={`button ${sequence.status === 'active' ? 'button--secondary' : 'button--primary'}`}
                        onClick={handleToggleClick}
                    >
                        {sequence.status === 'active' ? (
                            <>
                                <Pause size={15} />
                                Pause
                            </>
                        ) : (
                            <>
                                <Play size={15} />
                                Activate
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Toast */}
            {error && (
                <div className="error-toast">
                    <span>{error}</span>
                    <button onClick={onClearError}>
                        <Close size={16} />
                    </button>
                </div>
            )}

            {/* Saving Indicator */}
            {isSaving && (
                <div className="saving-toast">
                    <div className="spinner" />
                    <span>Saving...</span>
                </div>
            )}

            {/* Canvas */}
            <div
                ref={canvasRef}
                className="canvas-container"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onWheel={handleWheel}
            >
                <div className="canvas-background" />
                <div
                    className="canvas-content"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    }}
                >
                    {/* Connection Lines */}
                    <svg className="connection-lines">
                        {/* Trigger to first email */}
                        {sequence.emails && sequence.emails.length > 0 && nodePositions['trigger'] && nodePositions[sequence.emails[0].id] && (
                            <g>
                                <path
                                    d={getConnectionPath(nodePositions['trigger'], nodePositions[sequence.emails[0].id])}
                                    stroke="#d0d0d0"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="5,5"
                                />
                            </g>
                        )}

                        {/* Email to email connections */}
                        {sequence.emails?.map((email, index) => {
                            if (index === sequence.emails.length - 1) return null;
                            const nextEmail = sequence.emails[index + 1];
                            if (!nodePositions[email.id] || !nodePositions[nextEmail.id]) return null;

                            return (
                                <g key={`connection-${email.id}`}>
                                    <path
                                        d={getConnectionPath(nodePositions[email.id], nodePositions[nextEmail.id])}
                                        stroke="#d0d0d0"
                                        strokeWidth="2"
                                        fill="none"
                                        strokeDasharray="5,5"
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Trigger Node */}
                    {nodePositions['trigger'] && (
                        <CanvasNode
                            type="trigger"
                            data={sequence}
                            isSelected={selectedNode === 'trigger'}
                            onClick={() => handleNodeClick('trigger')}
                            onDragStart={(e, element) => handleNodeDragStart('trigger', e, element)}
                            position={nodePositions['trigger']}
                            isDragging={draggingNode === 'trigger'}
                        />
                    )}

                    {/* Email Nodes with Delay Badges */}
                    {sequence.emails?.map((email, index) => {
                        if (!nodePositions[email.id]) return null;

                        const prevNodeId = index === 0 ? 'trigger' : sequence.emails[index - 1].id;
                        const prevPos = nodePositions[prevNodeId];
                        const currentPos = nodePositions[email.id];

                        return (
                            <div key={email.id}>
                                {/* Delay Badge */}
                                {prevPos && currentPos && (
                                    <div
                                        className="delay-badge"
                                        style={{
                                            position: 'absolute',
                                            left: `${prevPos.x + 85}px`,
                                            top: `${prevPos.y + 80 + (currentPos.y - prevPos.y - 80) / 2 - 12}px`,
                                        }}
                                    >
                                        {email.delayAmount} {email.delayUnit}
                                        {index > 0 ? ' after previous' : ' after trigger'}
                                    </div>
                                )}

                                {/* Email Node */}
                                <CanvasNode
                                    type="email"
                                    data={email}
                                    index={index}
                                    isSelected={selectedNode === email.id}
                                    onClick={() => handleNodeClick(email.id)}
                                    onDelete={() => handleDeleteEmail(email.id)}
                                    onDragStart={(e, element) => handleNodeDragStart(email.id, e, element)}
                                    position={currentPos}
                                    isDragging={draggingNode === email.id}
                                />
                            </div>
                        );
                    })}

                    {/* Add Email Button */}
                    {nodePositions['trigger'] && (
                        <button
                            className="add-node-btn"
                            onClick={handleAddEmail}
                            style={{
                                position: 'absolute',
                                left: sequence.emails && sequence.emails.length > 0 && nodePositions[sequence.emails[sequence.emails.length - 1].id] ? `${nodePositions[sequence.emails[sequence.emails.length - 1].id].x + 100}px` : `${nodePositions['trigger'].x + 100}px`,
                                top: sequence.emails && sequence.emails.length > 0 && nodePositions[sequence.emails[sequence.emails.length - 1].id] ? `${nodePositions[sequence.emails[sequence.emails.length - 1].id].y + 100}px` : `${nodePositions['trigger'].y + 160}px`,
                            }}
                        >
                            <PlusSign size={20} />
                            Add Email
                        </button>
                    )}
                </div>
            </div>

            {/* Node Configuration Drawer */}
            <NodeConfigDrawer
                isOpen={!!selectedNode}
                nodeId={selectedNode}
                sequence={sequence}
                onUpdate={onUpdate}
                onClose={() => setSelectedNode(null)}
                brandId={brandId}
            />
        </div>
    );
}
