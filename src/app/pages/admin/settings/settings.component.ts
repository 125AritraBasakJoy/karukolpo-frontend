import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { FileUploadModule } from 'primeng/fileupload';
import { ContactService, ContactInfo } from '../../../services/contact.service';
import { SiteConfigService } from '../../../services/site-config.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, ToastModule, FileUploadModule],
  providers: [MessageService],
  template: `
    <div class="settings-container">

      <p-card header="Site Identity" styleClass="mt-4">
        <div class="p-fluid">
             <div class="field mb-4">
                <label for="logoUrl" class="block mb-2">Logo</label>
                <div class="flex gap-2">
                    <input type="text" pInputText id="logoUrl" [(ngModel)]="logoUrl" placeholder="Enter Logo URL">
                    <p-fileUpload mode="basic" chooseLabel="Upload" name="logo" url="null" accept="image/*" [maxFileSize]="500000" (onSelect)="onLogoUpload($event)" [auto]="true"></p-fileUpload>
                </div>
                <small class="text-gray-500">Enter a URL or upload a small image (max 500KB, converted to Base64).</small>
            </div>
            <div class="mt-2" *ngIf="logoUrl">
                <p>Preview:</p>
                <img [src]="logoUrl" alt="Logo Preview" style="max-height: 50px; border: 1px solid #ddd; padding: 5px;">
            </div>
        </div>
        <ng-template pTemplate="footer">
            <p-button label="Save Identity" icon="pi pi-save" (click)="saveSiteConfig()"></p-button>
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
  contactForm: ContactInfo = { address: '', phone: '', email: '' };
  logoUrl: string = '';

  constructor(
    private messageService: MessageService,
    public contactService: ContactService,
    public siteConfigService: SiteConfigService
  ) {
    this.contactForm = { ...this.contactService.contactInfo() };
    this.logoUrl = this.siteConfigService.siteConfig().logoUrl;
  }

  ngOnInit() {
  }

  saveContactInfo() {
    this.contactService.updateContactInfo(this.contactForm);
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Contact Info Updated' });
  }

  saveSiteConfig() {
    this.siteConfigService.updateConfig({ logoUrl: this.logoUrl });
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Site Identity Updated' });
  }

  onLogoUpload(event: any) {
    const file = event.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.logoUrl = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

