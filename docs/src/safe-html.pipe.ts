import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  // Fix: Explicitly type `sanitizer` to `DomSanitizer` to fix the error where
  // its type was being inferred as `unknown`.
  private sanitizer: DomSanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      // Fix: Ensure that for falsy inputs, we return an empty SafeHtml object,
      // not a plain string, to match the declared return type.
      return this.sanitizer.bypassSecurityTrustHtml('');
    }
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
