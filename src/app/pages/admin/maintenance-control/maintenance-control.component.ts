import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TextareaModule } from 'primeng/textarea';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { MaintenanceService, MaintenanceRead, SiteConfigService } from '../../../core/services';;;

@Component({
  selector: 'app-maintenance-control',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    ToggleSwitchModule,
    TextareaModule,
    CalendarModule,
    ToastModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService],
  templateUrl: './maintenance-control.component.html',
  styleUrls: ['./maintenance-control.component.scss']
})
export class MaintenanceControlComponent implements OnInit, OnDestroy {
  private maintenanceService = inject(MaintenanceService);
  private siteConfigService = inject(SiteConfigService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);

  enabled = false;
  message = '';
  endsAt: Date | null = null;
  updatedAt: string | null = null;
  updatedBy: string | null = null;

  ngOnInit() {
    this.loadState();
  }

  ngOnDestroy() { }

  private loadState() {
    this.loading.set(true);
    this.maintenanceService.getAdminState().subscribe({
      next: (state) => this.applyState(state),
      error: (err) => {
        console.error('Failed to load maintenance state', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load maintenance state.' });
      },
      complete: () => this.loading.set(false)
    });
  }

  private applyState(state: MaintenanceRead) {
    this.enabled = !!state.enabled;
    this.message = state.message ?? '';
    this.endsAt = state.ends_at ? new Date(state.ends_at) : null;
    this.updatedAt = state.updated_at ?? null;
    this.updatedBy = state.updated_by ?? null;
  }

  onToggleChange(event: any) {
    const newValue = event.checked;

    this.confirmationService.confirm({
      message: newValue
        ? 'Are you sure you want to trigger Maintenance Mode? Customers will no longer be able to browse the shop.'
        : 'Are you sure you want to disable Maintenance Mode and go LIVE?',
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'pi pi-check mr-2',
      rejectIcon: 'pi pi-times mr-2',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      acceptButtonStyleClass: newValue ? 'p-button-danger' : 'p-button-success',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.enabled = newValue;
        this.save();
      },
      reject: () => {
        // Revert the toggle state
        this.enabled = !newValue;
      }
    });
  }

  save() {
    this.saving.set(true);
    const trimmedMessage = this.message.trim();
    const payload = {
      enabled: this.enabled,
      message: trimmedMessage ? trimmedMessage : null,
      ends_at: this.endsAt ? new Date(this.endsAt).toISOString() : null
    };

    this.maintenanceService.updateAdminState(payload).subscribe({
      next: (state) => {
        this.applyState(state);
        this.syncStorefront();
        this.messageService.add({
          life: 2000,
          severity: 'success',
          summary: 'Updated',
          detail: `Maintenance Mode is now ${this.enabled ? 'ON' : 'OFF'}`
        });
      },
      error: (err) => {
        console.error('Failed to update maintenance state', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update maintenance state.' });
        this.loadState();
      },
      complete: () => this.saving.set(false)
    });
  }

  private syncStorefront() {
    this.maintenanceService.refreshStatus().subscribe({
      next: (status) => {
        this.maintenanceService.status.set(status);
        this.siteConfigService.updateConfig({ isMaintenanceMode: status.enabled });
      },
      error: () => { /* fall back to poll */ }
    });
  }
}
