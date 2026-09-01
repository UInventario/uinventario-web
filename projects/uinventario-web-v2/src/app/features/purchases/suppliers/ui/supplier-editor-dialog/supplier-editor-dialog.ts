import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Supplier, SupplierInput } from '../../domain/supplier.models';

type ContactForm = FormGroup<{
  name: FormControl<string>;
  email: FormControl<string>;
  phone: FormControl<string>;
  role: FormControl<string>;
  primary: FormControl<boolean>;
}>;

const contactMethodValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const email = String(control.get('email')?.value ?? '').trim();
  const phone = String(control.get('phone')?.value ?? '').trim();
  return email || phone ? null : { contactMethod: true };
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  selector: 'ui-supplier-editor-dialog',
  styleUrl: '../supplier-dialog.scss',
  templateUrl: './supplier-editor-dialog.html',
})
export class SupplierEditorDialog implements OnInit {
  readonly supplier = input<Supplier | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly submitted = output<SupplierInput>();

  private readonly formBuilder = new FormBuilder();
  protected readonly form = this.formBuilder.nonNullable.group({
    legalName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(180)]],
    tradeName: ['', [Validators.minLength(2), Validators.maxLength(180)]],
    taxIdentifier: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    contacts: this.formBuilder.array<ContactForm>([]),
  });

  protected get contacts(): FormArray<ContactForm> {
    return this.form.controls.contacts;
  }

  ngOnInit(): void {
    const supplier = this.supplier();
    this.form.patchValue({
      legalName: supplier?.legalName ?? '',
      tradeName: supplier?.tradeName ?? '',
      taxIdentifier: supplier?.taxIdentifier ?? '',
    });
    for (const contact of supplier?.contacts ?? []) {
      this.addContact(contact);
    }
    if (!this.contacts.length) this.addContact();
  }

  protected addContact(contact?: Supplier['contacts'][number]): void {
    if (this.contacts.length >= 20) return;
    this.contacts.push(
      this.formBuilder.nonNullable.group(
        {
          name: [
            contact?.name ?? '',
            [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
          ],
          email: [contact?.email ?? '', [Validators.email, Validators.maxLength(254)]],
          phone: [contact?.phone ?? '', Validators.maxLength(40)],
          role: [contact?.role ?? '', Validators.maxLength(80)],
          primary: [contact?.primary ?? false],
        },
        { validators: contactMethodValidator },
      ),
    );
  }

  protected removeContact(index: number): void {
    this.contacts.removeAt(index);
  }

  protected makePrimary(index: number): void {
    if (!this.contacts.at(index).get('primary')?.value) return;
    this.contacts.controls.forEach((contact, candidate) => {
      if (candidate !== index) contact.get('primary')?.setValue(false);
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitted.emit({
      legalName: value.legalName.trim(),
      tradeName: value.tradeName.trim() || undefined,
      taxIdentifier: value.taxIdentifier.trim(),
      contacts: value.contacts.map((contact) => ({
        name: String(contact.name).trim(),
        email: String(contact.email).trim().toLowerCase() || undefined,
        phone: String(contact.phone).trim() || undefined,
        role: String(contact.role).trim() || undefined,
        primary: Boolean(contact.primary),
      })),
    });
  }
}
