/**
 * Pruebas automáticas del registro de signos vitales (PF-01, OE3).
 * Framework: Vitest.  Instalar:  npm i -D vitest
 * Agregar a package.json:  "test": "vitest run"
 * Ubicación sugerida: src/services/vitals.service.test.ts
 *
 * AJUSTAR según tu código (marcado con TODO):
 *  - ruta de import de vitals.service y nombres/firma de las funciones
 *  - nombre de la colección y de los campos
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock de Firestore (sin red, sin tocar la base real) -------------------
const addDocMock = vi.fn();
const getDocsMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn((_db: unknown, name: string) => ({ __collection: name })),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  query: vi.fn((...args: unknown[]) => ({ __query: args })),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  Timestamp: { now: vi.fn(() => ({ toMillis: () => Date.now() })), fromDate: vi.fn((d: Date) => d) },
}));
// TODO: si tu servicio importa la instancia de db desde otro archivo, mockéala también:
vi.mock('../firebase', () => ({ db: {}, auth: {} }));

// TODO: ajustar ruta y nombres reales
import { addVitalReading, getVitalTypeConfig } from './vitals.service';

const ELDER = 'uid-adulto-1';

beforeEach(() => {
  addDocMock.mockReset();
  getDocsMock.mockReset();
  addDocMock.mockResolvedValue({ id: 'doc-123' });
});

describe('addVitalReading: registro correcto', () => {
  it('guarda en vitalReadings con elderUid, tipo, valor, fuente y fecha', async () => {
    // TODO: ajustar la firma: (elderUid, type, value, source)
    await addVitalReading(ELDER, 'presion', { sistolica: 120, diastolica: 80, pulso: 70 }, 'manual');

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const [colRef, data] = addDocMock.mock.calls[0];
    expect(colRef).toEqual({ __collection: 'vitalReadings' });
    expect(data).toMatchObject({
      elderUid: ELDER,
      type: 'presion',
      value: { sistolica: 120, diastolica: 80, pulso: 70 },
      source: 'manual',
    });
    expect(data.recordedAt).toBeDefined();
  });

  it.each(['presion', 'temperatura', 'sueno', 'azucar', 'pasos', 'hidratacion'])(
    'acepta el tipo %s', // TODO: usar los ids reales de tus tipos
    async (type) => {
      const cfg = getVitalTypeConfig(type)!;
      expect(cfg).toBeDefined();
      // valores por defecto construidos desde la configuración real: { clave: default }
      const values = Object.fromEntries(cfg.fields.map((f) => [f.key, f.default]));
      await addVitalReading(ELDER, cfg.type, values, 'manual');
      expect(addDocMock).toHaveBeenCalledTimes(1);
      expect(addDocMock.mock.calls[0][1].type).toBe(type);
      expect(addDocMock.mock.calls[0][1].value).toEqual(values);
    },
  );

  it('marca source = "device" cuando el registro viene del BLE', async () => {
    await addVitalReading(ELDER, 'presion', { sistolica: 118, diastolica: 76, pulso: 68 }, 'device');
    expect(addDocMock.mock.calls[0][1].source).toBe('device');
  });
});

describe('addVitalReading: errores', () => {
  it('propaga el error de Firestore (red o permisos) para que la UI lo muestre', async () => {
    addDocMock.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(
      addVitalReading(ELDER, 'presion', { sistolica: 120, diastolica: 80, pulso: 70 }, 'manual'),
    ).rejects.toThrow('permission-denied');
  });

  it('no escribe nada si falta elderUid', async () => {
    // TODO: ajustar si tu servicio valida de otra forma (lanza error, retorna null, etc.)
    await expect(
      addVitalReading('', 'presion', { sistolica: 120, diastolica: 80, pulso: 70 }, 'manual'),
    ).rejects.toThrow();
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

describe('getVitalTypeConfig: configuración por tipo', () => {
  it('entrega campos, rangos y valores por defecto coherentes', () => {
    for (const type of ['presion', 'temperatura', 'sueno', 'azucar', 'pasos', 'hidratacion']) {
      const cfg = getVitalTypeConfig(type)!;
      expect(cfg, `falta configuración de ${type}`).toBeDefined();
      expect(cfg.fields.length).toBeGreaterThan(0);
      for (const f of cfg.fields) {
        expect(f.min).toBeLessThan(f.max);
        expect(f.default).toBeGreaterThanOrEqual(f.min);
        expect(f.default).toBeLessThanOrEqual(f.max);
        expect(f.step).toBeGreaterThan(0);
      }
    }
  });

  it('devuelve undefined para un tipo desconocido', () => {
    expect(getVitalTypeConfig('inexistente')).toBeUndefined();
  });
});

describe('Latencia del registro (apoyo a OE3)', () => {
  it('la capa de servicio responde en menos de 1 s con Firestore simulado', async () => {
    const t0 = performance.now();
    await addVitalReading(ELDER, 'presion', { sistolica: 120, diastolica: 80, pulso: 70 }, 'manual');
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});