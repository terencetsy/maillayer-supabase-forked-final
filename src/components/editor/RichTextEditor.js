// src/components/editor/RichTextEditor.js
import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import { NodeSelection } from 'prosemirror-state';
import { uploadImageToSpaces } from '@/lib/imageUploadService';
import EditorToolbar from './EditorToolbar';
import { ImageUpload } from './ImageUploadExtension';
import { ImageResize } from './ImageResizeExtension';
import styles from '@/styles/TipTapEditor.module.scss';

export default function RichTextEditor({ value = '', onChange, placeholder = 'Start writing or drag an image...', editable = true }) {
    const [isMounted, setIsMounted] = useState(false);

    // Handle image uploads
    const handleImageUpload = async (file) => {
        try {
            // Upload the image to DigitalOcean Spaces
            const imageUrl = await uploadImageToSpaces(file);
            console.log('Image uploaded successfully', 'success');
            return imageUrl;
        } catch (error) {
            console.log('Failed to upload image. Please try again.', 'error');
            console.error('Image upload error:', error);
            throw error;
        }
    };

    // Create a custom image extension with proper node view
    const CustomImage = Image.extend({
        addAttributes() {
            return {
                ...this.parent?.(),
                width: {
                    default: null,
                    parseHTML: (element) => element.getAttribute('width'),
                    renderHTML: (attributes) => {
                        if (!attributes.width) {
                            return {};
                        }
                        return { width: attributes.width };
                    },
                },
                height: {
                    default: null,
                    parseHTML: (element) => element.getAttribute('height'),
                    renderHTML: (attributes) => {
                        if (!attributes.height) {
                            return {};
                        }
                        return { height: attributes.height };
                    },
                },
                'data-resizable': {
                    default: 'true',
                    renderHTML: () => ({ 'data-resizable': 'true' }),
                },
            };
        },
        addNodeView() {
            return ({ node, editor, getPos }) => {
                // Create container element
                const container = document.createElement('div');
                container.classList.add('image-container');

                // Create the image
                const img = document.createElement('img');
                img.src = node.attrs.src;
                img.alt = node.attrs.alt || '';
                img.className = 'editor-image';

                if (node.attrs.width) {
                    img.width = node.attrs.width;
                    img.style.width = `${node.attrs.width}px`;
                }

                if (node.attrs.height) {
                    img.height = node.attrs.height;
                    img.style.height = `${node.attrs.height}px`;
                }

                img.setAttribute('data-resizable', 'true');

                // Add click handler to select the image
                container.addEventListener('click', (event) => {
                    if (typeof getPos === 'function') {
                        const pos = getPos();
                        const { state, dispatch } = editor.view;
                        const nodeSelection = NodeSelection.create(state.doc, pos);
                        dispatch(state.tr.setSelection(nodeSelection));
                        editor.view.focus();
                    }
                });

                container.appendChild(img);

                // Return an object with dom and update properties
                return {
                    dom: container,
                    update: (updatedNode) => {
                        // Update image attributes if necessary
                        const img = container.querySelector('img');
                        if (img) {
                            img.src = updatedNode.attrs.src;
                            img.alt = updatedNode.attrs.alt || '';

                            if (updatedNode.attrs.width) {
                                img.width = updatedNode.attrs.width;
                                img.style.width = `${updatedNode.attrs.width}px`;
                            }

                            if (updatedNode.attrs.height) {
                                img.height = updatedNode.attrs.height;
                                img.style.height = `${updatedNode.attrs.height}px`;
                            }
                        }
                        return true;
                    },
                };
            };
        },
    });

    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle, // Add TextStyle extension first
            FontFamily.configure(), // FontFamily requires TextStyle
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'editor-link',
                },
            }),
            CustomImage.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'editor-image',
                },
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Placeholder.configure({
                placeholder,
            }),
            ImageUpload.configure({
                uploadImage: handleImageUpload,
            }),
            ImageResize,
        ],
        editable,
        content: value || getDefaultEmailTemplate(),
        onUpdate: ({ editor }) => {
            if (onChange) {
                onChange(editor.getHTML());
            }
        },
    });

    // Initialize when component mounts
    useEffect(() => {
        setIsMounted(true);

        return () => {
            if (editor) {
                editor.destroy();
            }
        };
    }, []);

    // Update content when value prop changes
    useEffect(() => {
        if (editor && value !== undefined && value !== editor.getHTML()) {
            editor.commands.setContent(value || getDefaultEmailTemplate(), false);
        }
    }, [value, editor]);

    // Handle drag and drop behaviors for better user experience
    const handleDrop = (e) => {
        // Editor&apos; extensions will handle the drop event
    };

    // Handle paste events
    const handlePaste = (e) => {
        // Editor&apos; extensions will handle the paste event
    };

    if (!isMounted) {
        return <div className={styles.editorLoading}>Loading editor...</div>;
    }

    return (
        <div className={styles.editorContainer}>
            {editor && <EditorToolbar editor={editor} />}

            <div
                className={`${styles.editorWrapper} ${styles.resizeHandleWrapper}`}
                onDrop={handleDrop}
                onPaste={handlePaste}
            >
                <EditorContent
                    editor={editor}
                    className={styles.tipTapEditor}
                />
            </div>
        </div>
    );
}

// Default email template with a standard email font
function getDefaultEmailTemplate() {
    return `
    <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto;">
        <h2>Email Title</h2>
        <p>Hello,</p>
        <p>Edit this template to create your email content.</p>
        <p>Best regards,</p>
        <p>Your Name</p>
    </div>
    `;
}
