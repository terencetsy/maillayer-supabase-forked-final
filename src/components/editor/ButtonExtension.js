// src/components/editor/ButtonExtension.js
import { Node } from '@tiptap/core';
import { mergeAttributes } from '@tiptap/react';

export const CustomButton = Node.create({
    name: 'button',
    group: 'inline',
    inline: true,
    selectable: true,
    atom: true,

    addAttributes() {
        return {
            href: {
                default: null,
            },
            target: {
                default: '_blank',
            },
            rel: {
                default: 'noopener noreferrer',
            },
            buttonStyle: {
                default: 'primary', // primary, secondary, etc.
            },
            buttonText: {
                default: 'Click me',
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'a[data-type="button"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const buttonStyles = {
            primary: 'display: inline-block; padding: 8px 16px; margin: 8px 0; border-radius: 4px; text-decoration: none; font-weight: 500; text-align: center; transition: all 0.2s ease; background-color: #3b82f6; color: white;',
            secondary: 'display: inline-block; padding: 8px 16px; margin: 8px 0; border-radius: 4px; text-decoration: none; font-weight: 500; text-align: center; transition: all 0.2s ease; background-color: #6b7280; color: white;',
            // Add more button styles as needed
        };

        const style = buttonStyles[HTMLAttributes.buttonStyle] || buttonStyles.primary;

        return ['a', mergeAttributes({ 'data-type': 'button', style }, HTMLAttributes), HTMLAttributes.buttonText];
    },
});
