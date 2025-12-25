import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ContactService, ContactInfo } from '../../../services/contact.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="settings-container">

      <p-card header="Contact Information" styleClass="mt-4">
        <div class="p-fluid">
            <div class="field mb-4">
                <label for="address" class="block mb-2">Address</label>
                <input type="text" pInputText id="address" [(ngModel)]="contactForm.address">
            </div>
            <div class="field mb-4">
                <label for="phone" class="block mb-2">Phone</label>
                <input type="text" pInputText id="phone" [(ngModel)]="contactForm.phone">
            </div>
            <div class="field mb-4">
                <label for="email" class="block mb-2">Email</label>
                <input type="text" pInputText id="email" [(ngModel)]="contactForm.email">
            </div>
        </div>
        <ng-template pTemplate="footer">
            <p-button label="Save Contact Info" icon="pi pi-save" (click)="saveContactInfo()"></p-button>
        </ng-template>
      </p-card>
    </div>
    <p-toast></p-toast>
  `,
  styles: [`
    .settings-container {
      max-width: 600px;
      margin: 0 auto;
    }
  `]
})
export class SettingsComponent implements OnInit {
  contactForm: ContactInfo = { address: '', phone: '', email: '' };

  constructor(
    private messageService: MessageService,
    public contactService: ContactService
  ) {
    this.contactForm = { ...this.contactService.contactInfo() };
  }

  ngOnInit() {
  }

  saveContactInfo() {
    this.contactService.updateContactInfo(this.contactForm);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Contact Info Updated' });
  }
}
