import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommerceOptions, CommerceScope, CommerceWebhookEvent } from '../../domain/commerce.models';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-commerce-credential-dialogs',
  styleUrl: './commerce-credential-dialogs.scss',
  templateUrl: './commerce-credential-dialogs.html',
})
export class CommerceCredentialDialogs {
  readonly editorOpen = input.required<boolean>();
  readonly oneTimeKey = input.required<string | null>();
  readonly revealKey = input.required<boolean>();
  readonly acting = input.required<boolean>();
  readonly form = input.required<FormGroup>();
  readonly options = input.required<CommerceOptions>();
  readonly scopes = input.required<readonly CommerceScope[]>();
  readonly events = input.required<readonly CommerceWebhookEvent[]>();

  readonly editorClosed = output<void>();
  readonly createRequested = output<void>();
  readonly scopeChanged = output<{ scope: CommerceScope; checked: boolean }>();
  readonly eventChanged = output<{ event: CommerceWebhookEvent; checked: boolean }>();
  readonly revealRequested = output<void>();
  readonly copyRequested = output<void>();
  readonly keyClosed = output<void>();

  protected hasScope(scope: CommerceScope): boolean {
    return (this.form().get('scopes')?.value as readonly CommerceScope[]).includes(scope);
  }

  protected hasEvent(event: CommerceWebhookEvent): boolean {
    return (this.form().get('webhookEvents')?.value as readonly CommerceWebhookEvent[]).includes(
      event,
    );
  }
}
