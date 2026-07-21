import DOMPurify from 'dompurify';

/**
 * Sanitize HTML before rendering via dangerouslySetInnerHTML.
 * Strips scripts, event handlers, and unsafe attributes.
 */
export function sanitizeHTML(dirty: string | null | undefined): string {
  if (!dirty) return '';
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'a', 'img', 'hr',
      'blockquote', 'pre', 'code',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style',
      'colspan', 'rowspan', 'width', 'height', 'align',
      'valign', 'border', 'cellpadding', 'cellspacing',
      'target', 'rel',
    ],
    ALLOW_DATA_ATTR: false,
  }) as string;
}
