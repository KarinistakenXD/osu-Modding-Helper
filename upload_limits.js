/* Conservative osu! discussion image-embed file size policy.
   osu! community reports a 4 MB cap for cached/external image embeds.
   This is NOT the maximum storage size offered by external file hosts.
   Choosing 4,000,000 bytes errs on the safe side of the MB/MiB ambiguity. */
(function (root) {
  'use strict';
  const MAX_EMBED_BYTES = 4_000_000;
  const inlineExtensions = /\.(?:png|jpe?g|gif|webp|avif|apng|bmp|svg|ico)$/i;
  const inlineMimeTypes = new Set([
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
    'image/apng', 'image/bmp', 'image/svg+xml', 'image/x-icon',
    'image/vnd.microsoft.icon'
  ]);
  const named = file => String(file?.name || '').trim();
  const typed = file => String(file?.type || '').trim().toLowerCase();
  const isInlineImage = file => inlineExtensions.test(named(file)) || inlineMimeTypes.has(typed(file));
  const isGif = file => /\.gif$/i.test(named(file)) || typed(file) === 'image/gif';
  const readableSize = bytes => (bytes / 1_000_000).toFixed(2);

  function validate(file) {
    if (!isInlineImage(file)) return {ok: true, isImage: false};
    const bytes = Number(file?.size);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return {ok: false, code: 'OSU_IMAGE_SIZE_UNKNOWN', message: 'The image size could not be verified. Upload cancelled.'};
    }
    if (bytes > MAX_EMBED_BYTES) {
      const kind = isGif(file) ? 'GIF' : 'Image';
      return {
        ok: false, code: 'OSU_EMBED_TOO_LARGE', limit: MAX_EMBED_BYTES,
        size: bytes, isImage: true,
        message: `${kind} rejected: ${named(file) || 'clipboard image'} is ${readableSize(bytes)} MB (${bytes.toLocaleString('en-US')} bytes). The conservative osu! discussion image-embed limit is 4 MB (4,000,000 bytes). Reduce the file to 4 MB or less and try again. No upload was attempted.`
      };
    }
    return {ok: true, isImage: true};
  }

  root.KmhUploadLimits = Object.freeze({MAX_EMBED_BYTES, isInlineImage, isGif, validate});
})(typeof self !== 'undefined' ? self : window);
