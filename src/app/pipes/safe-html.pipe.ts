import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
    name: 'safeHtml',
    standalone: true,
    pure: true
})
export class SafeHtmlPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) { }

    transform(value: string | undefined | null): SafeHtml {
        if (!value) return '';
        // Replace &nbsp; (from Quill Editor) with regular spaces
        // so the browser can wrap text at word boundaries
        const cleaned = value
            .replace(/&nbsp;/g, ' ')    // HTML entity form
            .replace(/\u00A0/g, ' ');   // Unicode non-breaking space
        return this.sanitizer.bypassSecurityTrustHtml(cleaned);
    }
}
