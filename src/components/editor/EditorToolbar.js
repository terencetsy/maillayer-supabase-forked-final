// src/components/editor/EditorToolbar.js
import React, { useEffect, useState } from 'react';
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, MousePointer, Square, Maximize, Minimize, Type } from 'lucide-react';
import styles from '@/styles/TipTapEditor.module.scss';

const FONT_OPTIONS = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
];

export default function EditorToolbar({ editor }) {
    const [showImageControls, setShowImageControls] = useState(false);
    const [currentFont, setCurrentFont] = useState('');

    useEffect(() => {
        if (!editor) return;

        const updateImageControls = () => {
            // Check if an image is selected
            let isImageSelected = false;
            const { selection } = editor.state;

            if (selection.node && selection.node.type.name === 'image') {
                isImageSelected = true;
            }

            setShowImageControls(isImageSelected);

            // Update the current font
            try {
                const marks = editor.getAttributes('textStyle');
                setCurrentFont(marks.fontFamily || '');
            } catch (e) {
                // Silently handle if textStyle isn't available yet
            }
        };

        editor.on('selectionUpdate', updateImageControls);
        editor.on('transaction', updateImageControls);
        updateImageControls(); // Initial check

        return () => {
            editor.off('selectionUpdate', updateImageControls);
            editor.off('transaction', updateImageControls);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    const addImage = () => {
        const url = window.prompt('Enter the URL of the image:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter the URL:', previousUrl);

        // cancelled
        if (url === null) {
            return;
        }

        // empty
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        // update link
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    const addButton = () => {
        const text = window.prompt('Button text:');
        const url = window.prompt('Button URL:');

        if (text && url) {
            editor.chain().focus().insertContent(`<a href="${url}" class="button button-primary" target="_blank">${text}</a>`).run();
        }
    };

    const resizeImage = (size) => {
        if (!editor.isActive('image')) return;

        const attrs = editor.getAttributes('image');

        // Calculate aspect ratio from current dimensions
        const aspectRatio = attrs.height / attrs.width;

        // Calculate new width based on size parameter
        let newWidth, newHeight;

        if (size === 'small') {
            newWidth = 300;
            newHeight = Math.round(newWidth * aspectRatio);
        } else if (size === 'medium') {
            newWidth = 500;
            newHeight = Math.round(newWidth * aspectRatio);
        } else if (size === 'large') {
            newWidth = 800;
            newHeight = Math.round(newWidth * aspectRatio);
        } else if (size === 'reset') {
            // Reset to original size
            newWidth = null;
            newHeight = null;
        } else if (size === 'custom') {
            // Prompt for custom width
            const customWidth = window.prompt('Enter image width in pixels:', attrs.width || '500');
            if (customWidth === null) return; // User cancelled
            newWidth = parseInt(customWidth);
            if (isNaN(newWidth) || newWidth < 50) newWidth = 300; // Minimum width
            newHeight = Math.round(newWidth * aspectRatio);
        }

        // Update the image with maintained aspect ratio
        editor
            .chain()
            .focus()
            .updateAttributes('image', {
                width: newWidth,
                height: newHeight,
            })
            .run();
    };

    const setFont = (fontFamily) => {
        if (!fontFamily || fontFamily === '') {
            editor.chain().focus().unsetFontFamily().run();
        } else {
            editor.chain().focus().setFontFamily(fontFamily).run();
        }
    };

    return (
        <div className={styles.editorToolbar}>
            {/* Font Family Dropdown */}
            <div className={styles.fontFamilyContainer}>
                <select
                    className={styles.fontFamilySelect}
                    value={currentFont}
                    onChange={(e) => setFont(e.target.value)}
                >
                    <option value="">Font Family</option>
                    {FONT_OPTIONS.map((font) => (
                        <option
                            key={font.value}
                            value={font.value}
                        >
                            {font.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className={styles.toolbarDivider}></div>

            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`${styles.toolbarButton} ${editor.isActive('bold') ? styles.isActive : ''}`}
                title="Bold"
            >
                <Bold size={16} />
            </button>

            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`${styles.toolbarButton} ${editor.isActive('italic') ? styles.isActive : ''}`}
                title="Italic"
            >
                <Italic size={16} />
            </button>

            <div className={styles.toolbarDivider}></div>

            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`${styles.toolbarButton} ${editor.isActive('heading', { level: 2 }) ? styles.isActive : ''}`}
                title="Heading 2"
            >
                <Heading2 size={16} />
            </button>

            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`${styles.toolbarButton} ${editor.isActive('heading', { level: 3 }) ? styles.isActive : ''}`}
                title="Heading 3"
            >
                <Heading3 size={16} />
            </button>

            <div className={styles.toolbarDivider}></div>

            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`${styles.toolbarButton} ${editor.isActive('bulletList') ? styles.isActive : ''}`}
                title="Bullet List"
            >
                <List size={16} />
            </button>

            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`${styles.toolbarButton} ${editor.isActive('orderedList') ? styles.isActive : ''}`}
                title="Ordered List"
            >
                <ListOrdered size={16} />
            </button>

            <div className={styles.toolbarDivider}></div>

            <button
                onClick={setLink}
                className={`${styles.toolbarButton} ${editor.isActive('link') ? styles.isActive : ''}`}
                title="Link"
            >
                <LinkIcon size={16} />
            </button>

            <button
                onClick={addImage}
                className={styles.toolbarButton}
                title="Image"
            >
                <ImageIcon size={16} />
            </button>

            <div className={styles.toolbarDivider}></div>

            <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'left' }) ? styles.isActive : ''}`}
                title="Align Left"
            >
                <AlignLeft size={16} />
            </button>

            <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'center' }) ? styles.isActive : ''}`}
                title="Align Center"
            >
                <AlignCenter size={16} />
            </button>

            <button
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={`${styles.toolbarButton} ${editor.isActive({ textAlign: 'right' }) ? styles.isActive : ''}`}
                title="Align Right"
            >
                <AlignRight size={16} />
            </button>

            <div className={styles.toolbarDivider}></div>

            <button
                onClick={addButton}
                className={styles.toolbarButton}
                title="Insert Button"
            >
                <Square size={16} />
            </button>

            {/* Image resize controls - only shown when an image is selected */}
            {showImageControls && (
                <>
                    <div className={styles.toolbarDivider}></div>

                    <button
                        onClick={() => resizeImage('small')}
                        className={styles.toolbarButton}
                        title="Small Image (300px)"
                    >
                        <Minimize size={16} />
                    </button>

                    <button
                        onClick={() => resizeImage('medium')}
                        className={styles.toolbarButton}
                        title="Medium Image (500px)"
                    >
                        <ImageIcon size={16} />
                    </button>

                    <button
                        onClick={() => resizeImage('large')}
                        className={styles.toolbarButton}
                        title="Large Image (800px)"
                    >
                        <Maximize size={16} />
                    </button>

                    <button
                        onClick={() => resizeImage('custom')}
                        className={styles.toolbarButton}
                        title="Custom Size"
                    >
                        <MousePointer size={16} />
                    </button>

                    <button
                        onClick={() => resizeImage('reset')}
                        className={styles.toolbarButton}
                        title="Reset to Original Size"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );
}
