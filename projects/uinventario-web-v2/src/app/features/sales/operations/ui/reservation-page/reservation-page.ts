import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { SalesOperationsFacade } from '../../application/sales-operations.facade';
import { salesOperationError } from '../../application/operations-error';
import { OperationOptions } from '../../domain/operations.models';
import {
  CreateReservationInput,
  ProductReservation,
  ReservationStatus,
} from '../../domain/reservation.models';
import { ReservationEditorDialog } from '../reservation-editor-dialog/reservation-editor-dialog';
import { ReservationReleaseDialog } from '../reservation-release-dialog/reservation-release-dialog';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReservationEditorDialog, ReservationReleaseDialog],
  selector: 'ui-reservation-page',
  styleUrls: ['../operations-page.scss'],
  templateUrl: './reservation-page.html',
})
export class ReservationPageComponent implements OnInit {
  private readonly facade = inject(SalesOperationsFacade);
  protected readonly options = signal<OperationOptions | null>(null);
  protected readonly reservations = signal<readonly ProductReservation[]>([]);
  protected readonly filter = signal<ReservationStatus | ''>('');
  protected readonly editorOpen = signal(false);
  protected readonly releasing = signal<ProductReservation | null>(null);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    forkJoin({ options: this.facade.options(), reservations: this.facade.reservations() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ options, reservations }) => {
          this.options.set(options);
          this.reservations.set(reservations);
        },
        error: (error: unknown) =>
          this.error.set(salesOperationError(error, 'No fue posible cargar las reservas.')),
      });
  }

  protected visible(): readonly ProductReservation[] {
    return this.filter()
      ? this.reservations().filter(({ status }) => status === this.filter())
      : this.reservations();
  }

  protected create(input: CreateReservationInput): void {
    this.run(
      this.facade.createReservation(input),
      (reservation) => {
        this.editorOpen.set(false);
        this.notice.set(`Reserva ${reservation.reservationNumber} creada.`);
      },
      'No fue posible crear la reserva.',
    );
  }

  protected release(reason: string): void {
    const reservation = this.releasing();
    if (!reservation) return;
    this.run(
      this.facade.releaseReservation(reservation.id, reason),
      () => {
        this.releasing.set(null);
        this.notice.set(`Reserva ${reservation.reservationNumber} liberada.`);
      },
      'No fue posible liberar la reserva.',
    );
  }

  protected expireDue(): void {
    this.run(
      this.facade.expireReservations(),
      (expired) => this.notice.set(`${expired.length} reserva(s) vencidas conciliadas.`),
      'No fue posible conciliar las reservas vencidas.',
    );
  }

  protected statusLabel(status: ReservationStatus): string {
    return { ACTIVE: 'Activa', RELEASED: 'Liberada', EXPIRED: 'Vencida', CONSUMED: 'Consumida' }[
      status
    ];
  }

  private run<T>(
    request: import('rxjs').Observable<T>,
    success: (value: T) => void,
    fallback: string,
  ): void {
    if (this.acting()) return;
    this.acting.set(true);
    this.error.set(null);
    this.notice.set(null);
    request.pipe(finalize(() => this.acting.set(false))).subscribe({
      next: (value) => {
        success(value);
        this.refresh();
      },
      error: (error: unknown) => this.error.set(salesOperationError(error, fallback)),
    });
  }

  private refresh(): void {
    this.facade
      .reservations()
      .subscribe({ next: (reservations) => this.reservations.set(reservations) });
  }
}
