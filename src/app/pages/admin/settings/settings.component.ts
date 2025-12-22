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
      <p-card header="Landing Page Configuration">
        <div class="p-fluid">
          <div class="field mb-4">
            <label for="tagline" class="block mb-2">Tagline</label>
            <input type="text" pInputText id="tagline" [(ngModel)]="config.tagline">
          </div>
          <div class="field mb-4">
            <label class="block mb-2">Background Image</label>
            <div class="flex flex-column gap-3">
                <input type="file" #fileInput (change)="onFileSelected($event)" accept="image/*" class="hidden" />
                <div class="flex align-items-center gap-3">
                    <button pButton type="button" label="Choose Image" icon="pi pi-image" class="p-button-outlined" (click)="fileInput.click()"></button>
                </div>
            </div>
          </div>
          <div class="field mb-4" *ngIf="config.image">
              <label class="block mb-2">Preview</label>
              <img [src]="config.image" style="max-width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px;">
          </div>
        </div>
        <ng-template pTemplate="footer">
            <p-button label="Save Configuration" icon="pi pi-save" (click)="saveConfig()"></p-button>
        </ng-template>
      </p-card>

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
  config = {
    tagline: 'Authentic Bangladeshi Handcrafts',
    image: 'assets/landing-bg.jpg'
  };

  contactForm: ContactInfo = { address: '', phone: '', email: '' };

  constructor(
    private messageService: MessageService,
    public contactService: ContactService
  ) {
    this.contactForm = { ...this.contactService.contactInfo() };
  }

  ngOnInit() {
    const savedConfig = localStorage.getItem('landingConfig');
    if (savedConfig) {
      this.config = JSON.parse(savedConfig);
    }
  }

  saveConfig() {
    localStorage.setItem('landingConfig', JSON.stringify(this.config));
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Configuration Saved' });
  }

  saveContactInfo() {
    this.contactService.updateContactInfo(this.contactForm);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Contact Info Updated' });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.config.image = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }
}
