'use client';

import { useEffect, useState } from 'react';
import { apiFetch, readApiError } from '@/lib/api';
import { TenantFrame } from '../tenant-frame';

type PaymentProvider = 'none' | 'pix_manual' | 'asaas' | 'mercadopago' | 'other';
type LateFineType = 'fixed' | 'percent';

type Settings = {
  timezone: string;
  lateInterestEnabled: boolean;
  lateInterestMonthlyRate: string | null;
  lateFineEnabled: boolean;
  lateFineType: LateFineType | null;
  lateFineValue: string | null;
  signatureOtpOnDevice: boolean;
  signatureOtpQr: boolean;
  reminderDaysBeforeDue: number;
  overdueNudgeDays: number;
  protestWarningDays: number;
  collectionResponseHours: number;
  msgDueReminderEnabled: boolean;
  msgDueReminderBody: string;
  msgOverdueEnabled: boolean;
  msgOverdueBody: string;
  msgProtestWarningEnabled: boolean;
  msgProtestWarningBody: string;
  msgPaymentReceivedEnabled: boolean;
  msgPaymentReceivedBody: string;
  paymentProvider: PaymentProvider;
  paymentConfigured: boolean;
  metaPhoneNumberId: string | null;
  metaWabaId: string | null;
  metaConfigured: boolean;
};

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'pix_manual', label: 'Pix manual' },
  { value: 'asaas', label: 'Asaas' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'other', label: 'Outro' },
];

export default function ConfiguracoesPage() {
  return (
    <TenantFrame>{({ setError }) => <SettingsForm setError={setError} />}</TenantFrame>
  );
}

function SettingsForm({ setError }: { setError: (value: string | null) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [paymentApiKey, setPaymentApiKey] = useState('');
  const [paymentWebhookSecret, setPaymentWebhookSecret] = useState('');
  const [clearPaymentSecrets, setClearPaymentSecrets] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaAppSecret, setMetaAppSecret] = useState('');
  const [clearMetaSecrets, setClearMetaSecrets] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await apiFetch('/tenants/current/settings');
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setSettings((await response.json()) as Settings);
    })();
  }, [setError]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) {
      return;
    }
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        timezone: settings.timezone,
        lateInterestEnabled: settings.lateInterestEnabled,
        lateInterestMonthlyRate: settings.lateInterestMonthlyRate,
        lateFineEnabled: settings.lateFineEnabled,
        lateFineType: settings.lateFineType,
        lateFineValue: settings.lateFineValue,
        signatureOtpOnDevice: settings.signatureOtpOnDevice,
        signatureOtpQr: settings.signatureOtpQr,
        reminderDaysBeforeDue: settings.reminderDaysBeforeDue,
        overdueNudgeDays: settings.overdueNudgeDays,
        protestWarningDays: settings.protestWarningDays,
        collectionResponseHours: settings.collectionResponseHours,
        msgDueReminderEnabled: settings.msgDueReminderEnabled,
        msgDueReminderBody: settings.msgDueReminderBody,
        msgOverdueEnabled: settings.msgOverdueEnabled,
        msgOverdueBody: settings.msgOverdueBody,
        msgProtestWarningEnabled: settings.msgProtestWarningEnabled,
        msgProtestWarningBody: settings.msgProtestWarningBody,
        msgPaymentReceivedEnabled: settings.msgPaymentReceivedEnabled,
        msgPaymentReceivedBody: settings.msgPaymentReceivedBody,
        paymentProvider: settings.paymentProvider,
        metaPhoneNumberId: settings.metaPhoneNumberId,
        metaWabaId: settings.metaWabaId,
      };
      if (paymentApiKey) {
        body.paymentApiKey = paymentApiKey;
      }
      if (paymentWebhookSecret) {
        body.paymentWebhookSecret = paymentWebhookSecret;
      }
      if (clearPaymentSecrets) {
        body.clearPaymentSecrets = true;
      }
      if (metaAccessToken) {
        body.metaAccessToken = metaAccessToken;
      }
      if (metaAppSecret) {
        body.metaAppSecret = metaAppSecret;
      }
      if (clearMetaSecrets) {
        body.clearMetaSecrets = true;
      }
      const response = await apiFetch('/tenants/current/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setSettings((await response.json()) as Settings);
      setPaymentApiKey('');
      setPaymentWebhookSecret('');
      setClearPaymentSecrets(false);
      setMetaAccessToken('');
      setMetaAppSecret('');
      setClearMetaSecrets(false);
      setNotice('Configurações salvas.');
    } finally {
      setPending(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-slate-600">Carregando configurações…</p>;
  }

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tudo se altera aqui: prazos, mensagens, encargos e APIs. Chaves nunca voltam a
          aparecer depois de salvas.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Empresa</h2>
        <label className="block text-sm">
          <span className="text-slate-600">Fuso horário</span>
          <input
            value={settings.timezone}
            onChange={(event) =>
              setSettings({ ...settings, timezone: event.target.value })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Prazos de cobrança</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            label="Lembrete (dias antes do vencimento)"
            value={settings.reminderDaysBeforeDue}
            min={0}
            onChange={(value) =>
              setSettings({ ...settings, reminderDaysBeforeDue: value })
            }
          />
          <NumberField
            label="Cobrança após atraso (dias)"
            value={settings.overdueNudgeDays}
            min={0}
            onChange={(value) => setSettings({ ...settings, overdueNudgeDays: value })}
          />
          <NumberField
            label="Aviso de protesto (dias de atraso)"
            value={settings.protestWarningDays}
            min={0}
            onChange={(value) => setSettings({ ...settings, protestWarningDays: value })}
          />
          <NumberField
            label="Tempo de resposta da cobrança (horas)"
            value={settings.collectionResponseHours}
            min={1}
            onChange={(value) =>
              setSettings({ ...settings, collectionResponseHours: value })
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Mensagens</h2>
        <p className="text-sm text-slate-600">
          Use {'{nome}'} e {'{data}'}. O envio automático entra com as parcelas.
        </p>
        <MessageField
          label="Lembrete de vencimento"
          enabled={settings.msgDueReminderEnabled}
          body={settings.msgDueReminderBody}
          onEnabled={(value) =>
            setSettings({ ...settings, msgDueReminderEnabled: value })
          }
          onBody={(value) => setSettings({ ...settings, msgDueReminderBody: value })}
        />
        <MessageField
          label="Parcela em atraso"
          enabled={settings.msgOverdueEnabled}
          body={settings.msgOverdueBody}
          onEnabled={(value) => setSettings({ ...settings, msgOverdueEnabled: value })}
          onBody={(value) => setSettings({ ...settings, msgOverdueBody: value })}
        />
        <MessageField
          label="Aviso de protesto"
          enabled={settings.msgProtestWarningEnabled}
          body={settings.msgProtestWarningBody}
          onEnabled={(value) =>
            setSettings({ ...settings, msgProtestWarningEnabled: value })
          }
          onBody={(value) => setSettings({ ...settings, msgProtestWarningBody: value })}
        />
        <MessageField
          label="Pagamento recebido"
          enabled={settings.msgPaymentReceivedEnabled}
          body={settings.msgPaymentReceivedBody}
          onEnabled={(value) =>
            setSettings({ ...settings, msgPaymentReceivedEnabled: value })
          }
          onBody={(value) => setSettings({ ...settings, msgPaymentReceivedBody: value })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Encargos (opcional)</h2>
        <p className="text-sm text-slate-600">
          Só configuração. O cálculo automático não entra nesta fase.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.lateInterestEnabled}
            onChange={(event) =>
              setSettings({ ...settings, lateInterestEnabled: event.target.checked })
            }
          />
          Juros de mora
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Taxa mensal (ex.: 0.0100 = 1%)</span>
          <input
            value={settings.lateInterestMonthlyRate ?? ''}
            onChange={(event) =>
              setSettings({
                ...settings,
                lateInterestMonthlyRate: event.target.value || null,
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.lateFineEnabled}
            onChange={(event) =>
              setSettings({ ...settings, lateFineEnabled: event.target.checked })
            }
          />
          Multa
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Tipo da multa</span>
          <select
            value={settings.lateFineType ?? ''}
            onChange={(event) =>
              setSettings({
                ...settings,
                lateFineType: (event.target.value || null) as LateFineType | null,
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">Não definida</option>
            <option value="fixed">Valor fixo</option>
            <option value="percent">Percentual</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Valor da multa</span>
          <input
            value={settings.lateFineValue ?? ''}
            onChange={(event) =>
              setSettings({ ...settings, lateFineValue: event.target.value || null })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Assinatura (OTP)</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.signatureOtpOnDevice}
            onChange={(event) =>
              setSettings({ ...settings, signatureOtpOnDevice: event.target.checked })
            }
          />
          OTP no balcão (on-device)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.signatureOtpQr}
            onChange={(event) =>
              setSettings({ ...settings, signatureOtpQr: event.target.checked })
            }
          />
          OTP no QR remoto
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">API de pagamento</h2>
        <p className="text-sm text-slate-600">
          {settings.paymentConfigured ? 'Chave configurada.' : 'Nenhuma chave salva.'}
        </p>
        <label className="block text-sm">
          <span className="text-slate-600">Provedor</span>
          <select
            value={settings.paymentProvider}
            onChange={(event) =>
              setSettings({
                ...settings,
                paymentProvider: event.target.value as PaymentProvider,
              })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            {PROVIDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Chave de API</span>
          <input
            type="password"
            value={paymentApiKey}
            onChange={(event) => setPaymentApiKey(event.target.value)}
            placeholder={settings.paymentConfigured ? '••••••••' : ''}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Segredo de webhook</span>
          <input
            type="password"
            value={paymentWebhookSecret}
            onChange={(event) => setPaymentWebhookSecret(event.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        {settings.paymentConfigured ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clearPaymentSecrets}
              onChange={(event) => setClearPaymentSecrets(event.target.checked)}
            />
            Remover chaves de pagamento salvas
          </label>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">API da Meta (WhatsApp)</h2>
        <p className="text-sm text-slate-600">
          {settings.metaConfigured ? 'Token configurado.' : 'Nenhum token salvo.'}
        </p>
        <label className="block text-sm">
          <span className="text-slate-600">Phone number ID</span>
          <input
            value={settings.metaPhoneNumberId ?? ''}
            onChange={(event) =>
              setSettings({ ...settings, metaPhoneNumberId: event.target.value || null })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">WABA ID</span>
          <input
            value={settings.metaWabaId ?? ''}
            onChange={(event) =>
              setSettings({ ...settings, metaWabaId: event.target.value || null })
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Access token</span>
          <input
            type="password"
            value={metaAccessToken}
            onChange={(event) => setMetaAccessToken(event.target.value)}
            placeholder={settings.metaConfigured ? '••••••••' : ''}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">App secret</span>
          <input
            type="password"
            value={metaAppSecret}
            onChange={(event) => setMetaAppSecret(event.target.value)}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        {settings.metaConfigured ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clearMetaSecrets}
              onChange={(event) => setClearMetaSecrets(event.target.checked)}
            />
            Remover token e app secret da Meta
          </label>
        ) : null}
      </section>

      {notice ? <p className="text-sm text-teal-800">{notice}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
    </form>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </label>
  );
}

function MessageField({
  label,
  enabled,
  body,
  onEnabled,
  onBody,
}: {
  label: string;
  enabled: boolean;
  body: string;
  onEnabled: (value: boolean) => void;
  onBody: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabled(event.target.checked)}
        />
        <span className="font-medium">{label}</span>
      </label>
      <textarea
        value={body}
        onChange={(event) => onBody(event.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
