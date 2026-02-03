import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ContactService, ContactInfo } from '../../../services/contact.service';
import { SiteConfigService } from '../../../services/site-config.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, CardModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="card">
      <h2 class="mb-4">Settings</h2>
      
      <div class="grid">
          <!-- Site Identity -->
          <div class="col-12 md:col-6">
              <p-card header="Site Identity" styleClass="h-full">
                <div class="p-fluid">
                     <div class="field mb-4">
                        <label for="logoUrl" class="block mb-2 font-bold">Logo</label>
                        
                        <div class="flex flex-column gap-2">
                            <input type="text" pInputText id="logoUrl" [(ngModel)]="logoUrl" placeholder="Enter Logo URL" class="w-full">
                            
                            <div class="flex align-items-center gap-2">
                                <span class="text-500">OR</span>
                                <input type="file" #logoInput (change)="onLogoUpload($event)" accept="image/*" class="hidden" />
                                <button pButton type="button" label="Upload Image" icon="pi pi-upload" class="p-button-outlined w-full" (click)="logoInput.click()"></button>
                            </div>
                        </div>
                        <small class="block mt-2 text-gray-500">Enter a URL or upload a small image (max 500KB, converted to Base64).</small>
                    </div>
                    
                    <div class="mt-3 p-3 border-round surface-ground border-1 border-200 text-center" *ngIf="logoUrl">
                        <p class="mb-2 font-bold text-sm">Preview:</p>
                        <img [src]="logoUrl" alt="Logo Preview" class="max-h-5rem border-round shadow-2 bg-white p-2">
                    </div>
                </div>
                <ng-template pTemplate="footer">
                    <p-button label="Save Identity" icon="pi pi-save" (click)="saveSiteConfig()" styleClass="w-full"></p-button>
                </ng-template>
              </p-card>
          </div>

          <!-- Contact Information -->
          <div class="col-12 md:col-6">
              <p-card header="Contact Information" styleClass="h-full">
                <div class="p-fluid">
                    <div class="field mb-4">
                        <label for="address" class="block mb-2 font-bold">Address</label>
                        <input type="text" pInputText id="address" [(ngModel)]="contactForm.address" class="w-full">
                    </div>
                    <div class="field mb-4">
                        <label for="phone" class="block mb-2 font-bold">Phone</label>
                        <input type="text" pInputText id="phone" [(ngModel)]="contactForm.phone" class="w-full">
                    </div>
                    <div class="field mb-4">
                        <label for="email" class="block mb-2 font-bold">Email</label>
                        <input type="text" pInputText id="email" [(ngModel)]="contactForm.email" class="w-full">
                    </div>
                </div>
                <ng-template pTemplate="footer">
                    <p-button label="Save Contact Info" icon="pi pi-save" (click)="saveContactInfo()" styleClass="w-full"></p-button>
                </ng-template>
              </p-card>
          </div>
      </div>
    </div>
    <p-toast></p-toast>
  `
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
    const file = event.target.files[0];
    if (file) {
        if (file.size > 500000) {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Image too large (max 500KB)' });
            return;
        }
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.logoUrl = e.target.result;
        };
        reader.readAsDataURL(file);
    }
  }
}
