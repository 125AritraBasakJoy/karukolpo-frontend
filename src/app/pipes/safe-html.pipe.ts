import { Pipe, PipeTransform, Inject, PLATFORM_ID, SecurityContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';

@Pipe({
    name: 'safeHtml',
    standalone: true,
    pure: true
})
export class SafeHtmlPipe implements PipeTransform {
    constructor(
        private sanitizer: DomSanitizer,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    transform(value: string | undefined | null): SafeHtml {
        if (!value) return '';
        // Replace &nbsp; (from Quill Editor) with regular spaces
        // so the browser can wrap text at word boundaries
        const cleaned = value
            .replace(/&nbsp;/g, ' ')    // HTML entity form
            .replace(/\u00A0/g, ' ');   // Unicode non-breaking space

        if (isPlatformBrowser(this.platformId)) {
            const purify = typeof (DOMPurify as any).sanitize === 'function' ? DOMPurify : (DOMPurify as any)(window);
            const sanitized = purify.sanitize(cleaned, {
                USE_PROFILES: { html: true },
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
            });
            return this.sanitizer.bypassSecurityTrustHtml(sanitized);
        }

        return this.sanitizer.sanitize(SecurityContext.HTML, cleaned) || '';
    }
}
