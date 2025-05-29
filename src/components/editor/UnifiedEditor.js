// src/components/editor/UnifiedEditor.js
import { useState, useEffect } from 'react';
import { Edit3, Code, Settings } from 'lucide-react';
import RichTextEditor from './RichTextEditor';
import HtmlEditor from './HtmlEditor';

const UnifiedEditor = ({
    value,
    onChange,
    placeholder = 'Start writing...',
    editable = true,
    defaultMode = 'visual', // 'visual' or 'html'
}) => {
    const [editorMode, setEditorMode] = useState(defaultMode);
    const [content, setContent] = useState(value || '');

    useEffect(() => {
        setContent(value || '');
    }, [value]);

    const handleContentChange = (newContent) => {
        setContent(newContent);
        onChange(newContent);
    };

    const switchToVisual = () => {
        if (editorMode === 'html') {
            // When switching from HTML to visual, keep the HTML content
            setEditorMode('visual');
        }
    };

    const switchToHtml = () => {
        if (editorMode === 'visual') {
            // When switching from visual to HTML, convert TipTap content to HTML
            setEditorMode('html');
        }
    };

    return (
        <div className="unified-editor">
            <div className="editor-mode-selector">
                <div className="mode-tabs">
                    <button
                        type="button"
                        className={`mode-tab ${editorMode === 'visual' ? 'active' : ''}`}
                        onClick={switchToVisual}
                        disabled={!editable}
                    >
                        <Edit3 size={16} />
                        <span>Visual</span>
                    </button>

                    <button
                        type="button"
                        className={`mode-tab ${editorMode === 'html' ? 'active' : ''}`}
                        onClick={switchToHtml}
                        disabled={!editable}
                    >
                        <Code size={16} />
                        <span>HTML</span>
                    </button>
                </div>

                <div className="editor-info">
                    <span className="current-mode">{editorMode === 'visual' ? 'Visual Editor' : 'HTML Editor'}</span>
                </div>
            </div>

            <div className="editor-content-area">
                {editorMode === 'visual' ? (
                    <RichTextEditor
                        value={content}
                        onChange={handleContentChange}
                        placeholder={placeholder}
                        editable={editable}
                    />
                ) : (
                    <HtmlEditor
                        value={content}
                        onChange={handleContentChange}
                        placeholder="Enter your HTML content here..."
                        editable={editable}
                    />
                )}
            </div>
        </div>
    );
};

export default UnifiedEditor;
