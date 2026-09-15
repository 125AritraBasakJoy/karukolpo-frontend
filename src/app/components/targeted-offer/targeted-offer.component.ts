import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OffersService, Offer } from '../../core/services/offers/offers.service';

@Component({
  selector: 'app-targeted-offer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './targeted-offer.component.html',
  styleUrls: ['./targeted-offer.component.scss']
})
export class TargetedOfferComponent implements OnInit, OnDestroy {
  offer = signal<Offer | null>(null);
  countdown = signal<string>('');
  isExpired = signal<boolean>(false);
  isDismissed = signal<boolean>(false);

  private timer: any = null;

  constructor(
    private offersService: OffersService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Check if dismissed in this session
    if (sessionStorage.getItem('offer_dismissed')) {
      return;
    }

    this.offersService.getOffer().subscribe(offer => {
      if (!offer) return;

      // Verify the discount end time is actually in the future
      const endsAt = new Date(offer.ends_at).getTime();
      const now = Date.now();
      if (isNaN(endsAt) || endsAt <= now) {
        return;
      }

      this.offer.set(offer);
      this.updateCountdown(endsAt);

      this.timer = setInterval(() => {
        this.updateCountdown(endsAt);
      }, 1000);
    });
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dismiss(): void {
    this.isDismissed.set(true);
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem('offer_dismissed', 'true');
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private updateCountdown(endsAt: number): void {
    const diff = endsAt - Date.now();
    if (diff <= 0) {
      this.isExpired.set(true);
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      this.countdown.set(`${days}d ${remHours}h ${pad(minutes)}m`);
    } else {
      this.countdown.set(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    }
  }
}
