import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl } from '@angular/forms';
import { getValidatorErrorMessage } from '../../utils/validation-messages';

@Component({
  selector: 'app-validation-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <small *ngIf="errorMessage !== null" class="error-message p-error block mt-1">
      {{ errorMessage }}
    </small>
  `,
  styles: [`
    .error-message {
      color: #ef4444;
      font-size: 0.875rem;
    }
  `]
})
export class ValidationMessageComponent {
  @Input() control: AbstractControl | null = null;

  get errorMessage(): string | null {
    if (this.control && this.control.errors && (this.control.touched || this.control.dirty)) {
      for (const propertyName in this.control.errors) {
        if (this.control.errors.hasOwnProperty(propertyName)) {
          return getValidatorErrorMessage(propertyName, this.control.errors[propertyName]);
        }
      }
    }
    return null;
  }
}
