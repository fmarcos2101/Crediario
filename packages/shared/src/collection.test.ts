import { describe, expect, it } from 'vitest';
import { planCollection, renderCollectionTemplate } from './collection';

describe('planCollection', () => {
  const base = {
    remainingPositive: true,
    cancelled: false,
    dueDate: '2026-04-10',
    reminderDaysBeforeDue: 3,
    overdueNudgeDays: 1,
    protestWarningDays: 15,
    sentKinds: [] as const,
  };

  it('lembra na janela e não cobra atraso no mesmo dia', () => {
    expect(planCollection({ ...base, today: '2026-04-07', sentKinds: [] })).toEqual([
      'due_reminder',
    ]);
    expect(planCollection({ ...base, today: '2026-04-10', sentKinds: [] })).toEqual([
      'due_reminder',
    ]);
    expect(planCollection({ ...base, today: '2026-04-06', sentKinds: [] })).toEqual([]);
  });

  it('atraso e protesto respeitam os prazos e não repetem', () => {
    expect(planCollection({ ...base, today: '2026-04-11', sentKinds: [] })).toEqual([
      'overdue',
    ]);
    expect(planCollection({ ...base, today: '2026-04-25', sentKinds: [] })).toEqual([
      'overdue',
      'protest_warning',
    ]);
    expect(
      planCollection({
        ...base,
        today: '2026-04-25',
        sentKinds: ['overdue', 'protest_warning'],
      }),
    ).toEqual([]);
  });

  it('não planeja parcela paga ou cancelada', () => {
    expect(
      planCollection({ ...base, today: '2026-04-25', remainingPositive: false }),
    ).toEqual([]);
    expect(planCollection({ ...base, today: '2026-04-25', cancelled: true })).toEqual([]);
  });
});

describe('renderCollectionTemplate', () => {
  it('substitui placeholders', () => {
    expect(
      renderCollectionTemplate('Olá {nome}, vence em {data} ({valor}).', {
        nome: 'Maria',
        data: '10/04/2026',
        valor: 'R$ 10,00',
      }),
    ).toBe('Olá Maria, vence em 10/04/2026 (R$ 10,00).');
  });
});
