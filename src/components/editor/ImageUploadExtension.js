// src/components/editor/ImageUploadExtension.js
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

export const ImageUpload = Extension.create({
    name: 'imageUpload',

    addOptions() {
        return {
            uploadImage: () => Promise.resolve(null),
        };
    },

    addProseMirrorPlugins() {
        // Store the upload function from options so it&apos; available in the plugin
        const uploadImageFunc = this.options.uploadImage;

        return [
            new Plugin({
                key: new PluginKey('imageUpload'),
                props: {
                    handleDOMEvents: {
                        paste(view, event) {
                            const items = Array.from(event.clipboardData?.items || []);
                            const imageItem = items.find((item) => /image/.test(item.type));

                            if (imageItem) {
                                event.preventDefault();
                                const file = imageItem.getAsFile();
                                uploadImage(file, uploadImageFunc, view);
                                return true;
                            }

                            return false;
                        },
                        drop(view, event) {
                            const hasFiles = event.dataTransfer?.files?.length;

                            if (!hasFiles) {
                                return false;
                            }

                            const images = Array.from(event.dataTransfer.files).filter((file) => /image/i.test(file.type));

                            if (images.length === 0) {
                                return false;
                            }

                            event.preventDefault();

                            const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });

                            images.forEach((image) => {
                                // Use the stored upload function
                                uploadImage(image, uploadImageFunc, view, coordinates);
                            });

                            return true;
                        },
                    },
                },
            }),
        ];
    },
});

function uploadImage(file, uploadFunc, view, coordinates) {
    const { schema } = view.state;

    if (!uploadFunc) {
        console.error('Image upload function not provided.');
        return;
    }

    // Show loading indicator or placeholder
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
        const tempImageSrc = readerEvent.target.result;

        // Insert temporary image
        const tr = view.state.tr;

        if (coordinates && coordinates.pos !== undefined) {
            tr.insert(
                coordinates.pos,
                schema.nodes.image.create({
                    src: tempImageSrc,
                    alt: 'Uploading...',
                    title: 'Uploading...',
                })
            );
        } else {
            tr.replaceSelectionWith(
                schema.nodes.image.create({
                    src: tempImageSrc,
                    alt: 'Uploading...',
                    title: 'Uploading...',
                })
            );
        }

        view.dispatch(tr);

        // Upload image to server
        uploadFunc(file)
            .then((url) => {
                // Replace temp image with the uploaded one
                const { doc, selection } = view.state;
                let tempImageFound = false;

                // Find the temporary image and replace it
                doc.descendants((node, pos) => {
                    if (tempImageFound) return false;

                    if (node.type.name === 'image' && node.attrs.src === tempImageSrc) {
                        const tr = view.state.tr;
                        tr.setNodeMarkup(pos, undefined, {
                            src: url,
                            alt: file.name || 'Image',
                            title: file.name || 'Image',
                        });
                        view.dispatch(tr);
                        tempImageFound = true;
                        return false; // Stop searching
                    }

                    return true; // Continue searching
                });
            })
            .catch((error) => {
                console.error('Image upload failed:', error);
                // Optionally remove the temp image on failure
            });
    };

    reader.readAsDataURL(file);
}

export default ImageUpload;
