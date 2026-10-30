import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ComboService } from '../../../core/services/combo/combo.service';
import { AdminCombo, ComboSuggestion } from '../../../models/combo.model';

@Component({
  selector: 'app-admin-combos',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    ToastModule,
    ConfirmDialogModule
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './combos.component.html',
  styleUrls: ['./combos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombosComponent implements OnInit {
  activeTab = signal<'combos' | 'suggestions'>('combos');
  combos = signal<AdminCombo[]>([]);
  suggestions = signal<ComboSuggestion[]>([]);
  loading = signal<boolean>(false);
  loadingSuggestions = signal<boolean>(false);

  constructor(
    private comboService: ComboService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCombos();
    this.loadSuggestions();
  }

  loadCombos() {
    this.loading.set(true);
    this.comboService.getAdminCombos().subscribe({
      next: (list) => {
        this.combos.set(list || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.detail || 'Failed to load combo offers'
        });
      }
    });
  }

  loadSuggestions() {
    this.loadingSuggestions.set(true);
    this.comboService.getAdminSuggestions().subscribe({
      next: (list) => {
        this.suggestions.set(list || []);
        this.loadingSuggestions.set(false);
      },
      error: () => this.loadingSuggestions.set(false)
    });
  }

  setTab(tab: 'combos' | 'suggestions') {
    this.activeTab.set(tab);
  }

  toggleActive(combo: AdminCombo) {
    const updatedStatus = !combo.is_active;
    this.comboService.updateAdminCombo(combo.id, { is_active: updatedStatus }).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Updated',
          detail: `Combo is now ${updatedStatus ? 'active' : 'inactive'}`
        });
        this.loadCombos();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err?.error?.detail || 'Failed to update combo status'
        });
      }
    });
  }

  deleteCombo(combo: AdminCombo) {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${combo.name}"? If it has past sales, it will be deactivated to preserve historical orders.`,
      header: 'Delete Combo',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.comboService.deleteAdminCombo(combo.id).subscribe({
          next: (res) => {
            if (res.deleted) {
              this.messageService.add({
                severity: 'success',
                summary: 'Deleted',
                detail: 'Combo offer permanently deleted'
              });
            } else if (res.deactivated) {
              this.messageService.add({
                severity: 'info',
                summary: 'Deactivated',
                detail: 'Combo has past sales; it was deactivated to preserve order records.'
              });
            }
            this.loadCombos();
          },
          error: (err) => {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err?.error?.detail || 'Failed to delete combo'
            });
          }
        });
      }
    });
  }

  createFromSuggestion(suggestion: ComboSuggestion) {
    const productIds = suggestion.products.map(p => p.id).join(',');
    this.router.navigate(['/admin/dashboard/combos/add'], {
      queryParams: { prefill: productIds }
    });
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'active': return 'success';
      case 'scheduled': return 'info';
      case 'unavailable': return 'warn';
      case 'expired':
      case 'inactive': return 'secondary';
      default: return 'info';
    }
  }

  getKindLabel(combo: AdminCombo): string {
    if (combo.kind === 'mix_and_match') {
      return `Pick any ${combo.slot_count || ''}`;
    }
    if (combo.items.length === 1 && (combo.items[0]?.quantity || 0) > 1) {
      return 'Multipack';
    }
    return 'Fixed Set';
  }
}
