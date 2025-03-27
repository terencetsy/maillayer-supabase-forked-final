// src/components/editor/ImageResizeExtension.js
import { Extension } from '@tiptap/core';
import { NodeSelection } from 'prosemirror-state';
import { Plugin, PluginKey } from 'prosemirror-state';

/**
 * A simplified image resize extension for TipTap
 * This extension adds resize functionality to images in the editor
 */
export const ImageResize = Extension.create({
    name: 'imageResize',

    addProseMirrorPlugins() {
        let selectedImage = null;
        let dragStartX = null;
        let dragStartY = null;
        let dragStartWidth = null;
        let dragStartHeight = null;
        let dragHandle = null;

        // Create and add resize handles to the DOM
        const createResizeHandles = (view, node, pos) => {
            // Find the image DOM element
            const domNode = view.nodeDOM(pos);
            if (!domNode) return;

            // Add selectednode class directly to the image container
            const container = domNode.closest('.image-container') || domNode;
            container.classList.add('ProseMirror-selectednode');

            // Remove any existing handles
            const existingHandles = container.querySelectorAll('.resize-handle');
            existingHandles.forEach((handle) => handle.remove());

            // Add new handles
            const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'right', 'bottom', 'left'];
            handles.forEach((handleName) => {
                const handle = document.createElement('div');
                handle.className = `resize-handle ${handleName}`;
                handle.setAttribute('data-handle', handleName);
                container.appendChild(handle);
            });
        };

        // Remove resize handles from the DOM
        const removeResizeHandles = (view) => {
            const selectedNodes = view.dom.querySelectorAll('.ProseMirror-selectednode');
            selectedNodes.forEach((node) => {
                node.classList.remove('ProseMirror-selectednode');
                const handles = node.querySelectorAll('.resize-handle');
                handles.forEach((handle) => handle.remove());
            });
        };

        return [
            new Plugin({
                key: new PluginKey('imageResize'),

                view(editorView) {
                    return {
                        update(view, prevState) {
                            const { state } = view;

                            // Check if the selection is a node selection and if the selected node is an image
                            if (state.selection instanceof NodeSelection && state.selection.node.type.name === 'image') {
                                const { node, from } = state.selection;

                                // Add resize handles to the selected image
                                createResizeHandles(view, node, from);
                                selectedImage = { node, pos: from };
                            } else {
                                // Remove resize handles if there&apos; no selected image
                                removeResizeHandles(view);
                                selectedImage = null;
                            }
                        },

                        destroy() {
                            // Clean up when the editor is destroyed
                            removeResizeHandles(editorView);
                        },
                    };
                },

                props: {
                    handleDOMEvents: {
                        mousedown(view, event) {
                            // Check if we're clicking inside the editor
                            if (!view.dom.contains(event.target)) {
                                return false;
                            }

                            // Check if we clicked on a resize handle
                            if (event.target.classList && event.target.classList.contains('resize-handle')) {
                                // Get the handle direction
                                dragHandle = event.target.getAttribute('data-handle');

                                // Find the image element
                                const imageElement = event.target.closest('.ProseMirror-selectednode');

                                if (imageElement) {
                                    // Store initial mouse position
                                    dragStartX = event.clientX;
                                    dragStartY = event.clientY;

                                    // Store initial image dimensions
                                    dragStartWidth = imageElement.offsetWidth;
                                    dragStartHeight = imageElement.offsetHeight;

                                    // Stop event propagation
                                    event.preventDefault();
                                    event.stopPropagation();
                                    return true;
                                }
                            }

                            // Check if we clicked on an image
                            const target = event.target;
                            if (target.nodeName === 'IMG' || target.classList.contains('image-container')) {
                                // Find position of the node in the document
                                const result = findImageNode(view, target);

                                if (result && result.node) {
                                    // Create a node selection at the image position
                                    const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, result.pos));
                                    view.dispatch(tr);
                                    event.preventDefault();
                                    return true;
                                }
                            }

                            return false;
                        },

                        mousemove(view, event) {
                            // Only handle if we have an active resize operation
                            if (dragStartX === null || dragStartY === null || dragHandle === null) {
                                return false;
                            }

                            // Find the selected image
                            const selectedNode = view.dom.querySelector('.ProseMirror-selectednode');
                            if (!selectedNode) {
                                return false;
                            }

                            // Calculate the change in position
                            const dx = event.clientX - dragStartX;
                            const dy = event.clientY - dragStartY;

                            // Calculate new dimensions based on the active handle
                            let width = dragStartWidth;
                            let height = dragStartHeight;
                            const aspectRatio = dragStartHeight / dragStartWidth;

                            // Determine which dimension to adjust based on the handle being dragged
                            if (dragHandle.includes('right') || dragHandle.includes('left')) {
                                // Adjusting width, calculate height based on aspect ratio
                                if (dragHandle.includes('right')) {
                                    width = Math.max(20, dragStartWidth + dx);
                                } else if (dragHandle.includes('left')) {
                                    width = Math.max(20, dragStartWidth - dx);
                                }
                                height = Math.round(width * aspectRatio);
                            } else {
                                // Adjusting height, calculate width based on aspect ratio
                                if (dragHandle.includes('bottom')) {
                                    height = Math.max(20, dragStartHeight + dy);
                                } else if (dragHandle.includes('top')) {
                                    height = Math.max(20, dragStartHeight - dy);
                                }
                                width = Math.round(height / aspectRatio);
                            }

                            // Get the current selection
                            const { selection } = view.state;

                            if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
                                // Apply the new dimensions
                                const tr = view.state.tr.setNodeMarkup(selection.from, null, {
                                    ...selection.node.attrs,
                                    width,
                                    height,
                                });

                                view.dispatch(tr);

                                // Update the selected image immediately in the DOM for smoother resizing
                                const img = selectedNode.querySelector('img');
                                if (img) {
                                    img.style.width = `${width}px`;
                                    img.style.height = `${height}px`;
                                }
                            }

                            event.preventDefault();
                            return true;
                        },

                        mouseup() {
                            // Reset drag tracking variables
                            dragStartX = null;
                            dragStartY = null;
                            dragStartWidth = null;
                            dragStartHeight = null;
                            dragHandle = null;
                            return false;
                        },

                        mouseleave() {
                            // Reset drag tracking variables when mouse leaves the editor
                            dragStartX = null;
                            dragStartY = null;
                            dragStartWidth = null;
                            dragStartHeight = null;
                            dragHandle = null;
                            return false;
                        },
                    },
                },
            }),
        ];
    },
});

// Helper function to find an image node from a DOM element
function findImageNode(view, domElement) {
    let targetElement = domElement;

    // If we got a container or other element, try to find the image inside
    if (targetElement.nodeName !== 'IMG') {
        targetElement = targetElement.querySelector('img');
        if (!targetElement) return { node: null, pos: null };
    }

    let result = { node: null, pos: null };

    // Check all nodes to find the one that contains this DOM element
    view.state.doc.descendants((node, pos) => {
        if (result.node) return false; // Already found

        if (node.type.name === 'image') {
            const nodeDOM = view.nodeDOM(pos);
            if (nodeDOM && (nodeDOM === targetElement || nodeDOM.contains(targetElement))) {
                result = { node, pos };
                return false; // Stop searching
            }
        }

        return true; // Continue searching
    });

    return result;
}

export default ImageResize;
