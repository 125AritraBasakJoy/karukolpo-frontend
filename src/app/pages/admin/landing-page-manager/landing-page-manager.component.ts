import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-landing-page-manager',
    imports: [
        CommonModule,
        FormsModule,
        CardModule,
        InputTextModule,
        ButtonModule,
        ToastModule
    ],
    providers: [MessageService],
    templateUrl: './landing-page-manager.component.html',
    styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class LandingPageManagerComponent implements OnInit {
    tagline = '';
    imageUrl = '';

    constructor(private messageService: MessageService) { }

    ngOnInit() {
        this.loadConfig();
    }

    loadConfig() {
        const config = localStorage.getItem('landingConfig');
        if (config) {
            const parsed = JSON.parse(config);
            this.tagline = parsed.tagline || '';
            this.imageUrl = parsed.image || '';
        } else {
            // Defaults
            this.tagline = 'Authentic Bangladeshi Handcrafts';
            this.imageUrl = 'assets/landing-bg.jpg';
        }
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.compressImage(file, 800, 0.7).then(compressed => {
                this.imageUrl = compressed;
                this.messageService.add({ severity: 'info', summary: 'Image Processed', detail: 'Image compressed for storage.' });
            }).catch(err => {
                console.error('Compression error', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to process image.' });
            });
        }
    }

    compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event: any) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    }

    saveConfig() {
        const config = {
            tagline: this.tagline,
            image: this.imageUrl
        };
        try {
            localStorage.setItem('landingConfig', JSON.stringify(config));
            this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Landing page configuration saved!' });

            // Dispatch event for same-window updates if needed
            window.dispatchEvent(new Event('storage'));
        } catch (e) {
            console.error('Error saving config', e);
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save configuration' });
        }
    }
}
