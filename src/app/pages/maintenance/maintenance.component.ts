import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { MaintenanceService } from '../../core/services/maintenance/maintenance.service';

@Component({
    selector: 'app-maintenance',
    standalone: true,
    imports: [CommonModule, ButtonModule],
    templateUrl: './maintenance.component.html',
    styleUrls: ['./maintenance.component.scss']
})
export class MaintenanceComponent implements OnInit, OnDestroy {
    private maintenanceService = inject(MaintenanceService);
    private router = inject(Router);
    private subscription: Subscription | null = null;

    get status() {
        return this.maintenanceService.status();
    }

    ngOnInit() {
        // If maintenance ends (admin turns it off), return to the site automatically
        this.subscription = toObservable(this.maintenanceService.status).subscribe(status => {
            if (!status.enabled && this.router.url === '/maintenance') {
                this.router.navigate(['/']);
            }
        });
    }

    ngOnDestroy() {
        this.subscription?.unsubscribe();
    }
}
