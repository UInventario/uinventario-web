import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiError } from '../../../../../core/api/api-error';
import { AuthorizationService } from '../../../../../core/authorization/authorization.service';
import { downloadFile } from '../../../application/csv-export';
import { ReportPaginationComponent } from '../../../ui/report-pagination/report-pagination';
import {
  auditQueryFrom,
  auditQueryParams,
  validAuditPeriod,
  validUuid,
} from '../../application/audit-query';
import { ControlFacade } from '../../application/control.facade';
import { AuditEvent, AuditPage, AuditQuery } from '../../domain/control.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, ReactiveFormsModule, ReportPaginationComponent],
  selector: 'ui-audit-page',
  styleUrls: ['../../../ui/report-view.scss', './audit-page.scss'],
  templateUrl: './audit-page.html',
})
export class AuditPageComponent implements OnInit {
  private readonly facade = inject(ControlFacade);
  private readonly authorization = inject(AuthorizationService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly canExport = this.authorization.has('AUDIT_EXPORT');
  protected readonly filters = this.formBuilder.nonNullable.group({
    q: '',
    action: '',
    entityType: '',
    actorId: '',
    dateFrom: '',
    dateTo: '',
  });
  protected readonly query = signal<AuditQuery>({ page: 1, pageSize: 25 });
  protected readonly result = signal<AuditPage | null>(null);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly downloading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const query = auditQueryFrom(params);
      this.query.set(query);
      this.filters.setValue(
        {
          q: query.q ?? '',
          action: query.action ?? '',
          entityType: query.entityType ?? '',
          actorId: query.actorId ?? '',
          dateFrom: query.dateFrom ?? '',
          dateTo: query.dateTo ?? '',
        },
        { emitEvent: false },
      );
      this.load(query);
    });
  }

  protected apply(): void {
    const value = this.filters.getRawValue();
    const query: AuditQuery = {
      q: clean(value.q),
      action: clean(value.action),
      entityType: clean(value.entityType),
      actorId: clean(value.actorId),
      dateFrom: value.dateFrom || undefined,
      dateTo: value.dateTo || undefined,
      page: 1,
      pageSize: 25,
    };
    if (!validUuid(query.actorId)) {
      this.error.set('El identificador del actor debe ser un UUID válido.');
      return;
    }
    if (!validAuditPeriod(query)) {
      this.error.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.error.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: auditQueryParams(query),
    });
  }

  protected reset(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected filterActor(event: AuditEvent): void {
    const query = { ...this.query(), actorId: event.actor.id, page: 1 };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: auditQueryParams(query),
    });
  }

  protected goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: auditQueryParams({ ...this.query(), page }),
    });
  }

  protected toggleDetails(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  protected json(value: Readonly<Record<string, unknown>> | null): string {
    return value ? JSON.stringify(value, null, 2) : 'Sin datos';
  }

  protected exportAudit(): void {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.error.set(null);
    this.facade
      .exportAudit(this.query())
      .pipe(finalize(() => this.downloading.set(false)))
      .subscribe({
        next: (file) => {
          downloadFile(file.content, file.filename);
          this.notice.set('Archivo de auditoría preparado.');
        },
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private load(query: AuditQuery): void {
    this.loading.set(true);
    this.error.set(null);
    this.notice.set(null);
    this.facade
      .auditEvents(query)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => this.error.set(this.message(error)),
      });
  }

  private message(error: unknown): string {
    return error instanceof ApiError ? error.message : 'No fue posible consultar la auditoría.';
  }
}

function clean(value: string): string | undefined {
  return value.trim() || undefined;
}
