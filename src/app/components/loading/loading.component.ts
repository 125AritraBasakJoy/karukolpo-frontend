import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../core/services';;;
import { ProgressBarModule } from 'primeng/progressbar';

@Component({
    selector: 'app-loading',
    standalone: true,
    imports: [CommonModule, ProgressBarModule],
    templateUrl: './loading.component.html',
    styleUrls: ['./loading.component.scss']
})
export class LoadingComponent {
    constructor(public loadingService: LoadingService) { }
}
