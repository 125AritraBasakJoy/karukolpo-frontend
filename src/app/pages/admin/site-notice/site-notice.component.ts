import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TextareaModule } from 'primeng/textarea';
import { CalendarModule } from 'primeng/calendar';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  SiteNoticeService,
  SiteNoticeRead,
  SiteNotice
} from '../../../core/services';
import { SiteNoticeComponent } from '../../../components/site-notice/site-notice.component';

@Component({
  selector: 'app-admin-site-notice',
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
    ConfirmDialogModule,
    SiteNoticeComponent
  ],
  providers: [ConfirmationService],
  templateUrl: './site-notice.component.html',
  styleUrls: ['./site-notice.component.scss']
})
export class AdminSiteNoticeComponent implements OnInit {
  private noticeService = inject(SiteNoticeService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);

  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  hasLoadError = signal<boolean>(false);

  // Form model
  enabled = false;
  message = '';
  startsAt: Date | null = null;
  endsAt: Date | null = null;

  // Authoritative server state
  serverState: SiteNoticeRead | null = null;

  get previewNotice(): SiteNotice {
    return {
      message: this.message || 'Notice preview message will scroll here...',
      tone: 'info',
      starts_at: null,
      ends_at: null
    };
  }

  get stateTagLabel(): string {
    if (!this.serverState) return 'Unknown';
    switch (this.serverState.state) {
      case 'live':
        return 'Live';
      case 'scheduled':
        return 'Scheduled';
      case 'ended':
        return 'Ended';
      case 'off':
      default:
        return 'Off';
    }
  }

  get stateTagClass(): string {
    if (!this.serverState) return 'state-off';
    switch (this.serverState.state) {
      case 'live':
        return 'state-live';
      case 'scheduled':
        return 'state-scheduled';
      case 'ended':
        return 'state-ended';
      case 'off':
      default:
        return 'state-off';
    }
  }

  ngOnInit(): void {
    this.loadState();
  }

  loadState(): void {
    this.loading.set(true);
    this.hasLoadError.set(false);
    this.noticeService
      .getAdmin()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: state => {
          this.applyState(state);
        },
        error: err => {
          this.hasLoadError.set(true);
          const detail = this.extractErrorMessage(err, 'Failed to load notice configuration.');
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
        }
      });
  }

  private applyState(state: SiteNoticeRead): void {
    this.serverState = state;
    this.enabled = !!state.enabled;
  }

  onToggleChange(event: any): void {
    const desired = !!event.checked;

    this.confirmationService.confirm({
      message: desired
        ? 'Enable site notice on storefront?'
        : 'Switch off site notice? The text and dates will remain saved.',
      header: 'Notice Status',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'pi pi-check mr-2',
      rejectIcon: 'pi pi-times mr-2',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      acceptButtonStyleClass: desired ? 'p-button-success' : 'p-button-secondary',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.saveToggle(desired);
      },
      reject: () => {
        this.enabled = !desired;
      }
    });
  }

  private saveToggle(newEnabled: boolean): void {
    this.saving.set(true);
    this.noticeService
      .update({ enabled: newEnabled })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: state => {
          this.applyState(state);
          this.noticeService.refresh();
          this.messageService.add({
            severity: 'success',
            summary: 'Updated',
            detail: `Site notice is now ${state.enabled ? 'ON' : 'OFF'}.`
          });
        },
        error: err => {
          this.enabled = !newEnabled;
          const detail = this.extractErrorMessage(err, 'Failed to change notice status.');
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
        }
      });
  }

  publish(): void {
    const collapsedMessage = this.message.replace(/\s+/g, ' ').trim();

    if (!collapsedMessage) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'A notice needs a message before it can be switched on'
      });
      return;
    }

    if (collapsedMessage.length > 500) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Message exceeds the 500 character limit.'
      });
      return;
    }

    const startIso = this.dhakaDateToIso(this.startsAt);
    const endIso = this.dhakaDateToIso(this.endsAt);

    if (startIso && endIso) {
      const s = Date.parse(startIso);
      const e = Date.parse(endIso);
      if (e <= s) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'The end time must be after the start time'
        });
        return;
      }
    }

    if (endIso) {
      const e = Date.parse(endIso);
      if (e < Date.now()) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'The end time has already passed'
        });
        return;
      }
    }

    this.saving.set(true);
    const payload = {
      enabled: true,
      message: collapsedMessage,
      tone: 'info' as const,
      starts_at: startIso,
      ends_at: endIso
    };

    this.noticeService
      .update(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: state => {
          this.applyState(state);
          this.resetDraftForm();
          this.noticeService.refresh();
          this.messageService.add({
            severity: 'success',
            summary: 'Published',
            detail: state.state === 'scheduled' ? 'Notice scheduled successfully.' : 'Notice published to storefront.'
          });
        },
        error: err => {
          const detail = this.extractErrorMessage(err, 'Failed to publish notice.');
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
        }
      });
  }

  cancelDraft(): void {
    this.resetDraftForm();
    this.messageService.add({
      severity: 'info',
      summary: 'Cancelled',
      detail: 'Cleared unsaved draft.'
    });
  }

  private resetDraftForm(): void {
    this.message = '';
    this.startsAt = null;
    this.endsAt = null;
  }

  /**
   * Takes a local Date object chosen by the user and serializes it
   * as a Bangladesh wall-clock ISO string with explicit +06:00
   */
  private dhakaDateToIso(d: Date | null): string | null {
    if (!d) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:00+06:00`;
  }

  private extractErrorMessage(err: any, fallback: string): string {
    const errorBody = err?.error;
    if (typeof errorBody?.detail === 'string') {
      return errorBody.detail;
    }
    if (Array.isArray(errorBody?.detail) && errorBody.detail.length > 0) {
      return errorBody.detail[0]?.msg || fallback;
    }
    return err?.message || fallback;
  }
}
