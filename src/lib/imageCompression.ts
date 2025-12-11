/**
 * Compresses an image file using browser Canvas API.
 * Resizes images exceeding max dimensions (default 1920px) while preserving aspect ratio.
 * Converts to JPEG with specified quality (default 0.8).
 */
export async function compressImage(
    file: File,
    options: {
        maxWidth?: number;
        maxHeight?: number;
        quality?: number;
    } = {}
): Promise<File> {
    // Only process standard image types
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") {
        // Return original file for non-compressible types (SVGs, GIFs usually shouldn't be re-encoded as JPEGs)
        // or if it's already optimized. 
        // Note: User asked to "compress any images", but re-encoding GIFs kills animation, 
        // and SVGs are vector. We'll target raster images (png, jpeg, webp, bmp).
        return file;
    }

    const { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let width = img.width;
            let height = img.height;

            // Calculate new dimensions if resizing is needed
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                // Fallback to original if canvas context is unavailable
                resolve(file);
                return;
            }

            // Draw and resize
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file); // Fallback
                        return;
                    }

                    // Create new File object
                    // Use original name but change extension to .jpg if we forced conversion
                    // However, to keep it simple, we'll keep the original name to avoid confusing backend logic
                    // relative to extensions, although the content is now JPEG.
                    // Ideally, we rename to .jpg, but if the backend relies on extension validation, it might break.
                    // The mime type in the new File will be 'image/jpeg'.
                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                    const compressedFile = new File([blob], newName, {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    });

                    // Only return compressed version if it's actually smaller
                    // (Though for huge PNGs, even a larger JPEG might be preferred for compatibility,
                    // but usually we want to save space).
                    if (compressedFile.size < file.size) {
                        resolve(compressedFile);
                    } else {
                        // If compression made it bigger (rare, but possible with low-quality originals),
                        // return original.
                        // Exception: If the original was NOT jpeg/webp (e.g. huge PNG), 
                        // we might prefer the unified JPEG format even if size is similar, 
                        // but let's stick to size optimization as the primary goal.
                        resolve(file);
                    }
                },
                "image/jpeg",
                quality
            );
        };

        img.onerror = (error) => {
            URL.revokeObjectURL(url);
            console.warn("Image compression failed, uploading original:", error);
            resolve(file); // Fallback to original
        };

        img.src = url;
    });
}
