import { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FACULTADES_UMSS,
  TIPOS_DJ,
  createDjFormSchema,
  formValuesToPayload,
  generarCodigoReferencia,
  type CreateDjFormValues,
} from '../../../schemas/createDjSchema';
import { createDeclaracionJurada } from '../../../services/declaracionesJuradasApi';
import { ApiError, type EstadoDJ } from '../../../types/api';
import { FormAlert, FormField, textInputClass } from './FormAlert';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

interface SuccessState {
  id: string;
  estado: EstadoDJ;
}

const INITIAL_VALUES: CreateDjFormValues = {
  tipo: 'LABORAL',
  periodoAcademico: '2026-I',
  cargoInstitucional: '',
  dependencia: FACULTADES_UMSS[0],
  actividadesDescripcion: '',
  referenciaDocumental: generarCodigoReferencia('LABORAL', '2026-I'),
  declaracionVeracidad: true,
};

/**
 * Formulario nueva DJ — wireframe_dj_nueva.png / FSD-UC-002 / PRD Journey 1
 * @see docs/fsd/FSD_vFinal.md §10.1, §8
 * @see RB-01 INACTIVE_BINDING · RB-03 inmutabilidad (solo creación aquí)
 */
export function NewDJForm() {
  const navigate = useNavigate();
  const formId = useId();
  const [values, setValues] = useState<CreateDjFormValues>(INITIAL_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CreateDjFormValues, string>>>(
    {}
  );
  const [status, setStatus] = useState<FormStatus>('idle');
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [apiError, setApiError] = useState<{ title: string; detail?: string; code?: string } | null>(
    null
  );

  // El código de referencia es autogenerado: se recalcula si cambia el tipo o el período,
  // el docente nunca lo escribe a mano.
  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      referenciaDocumental: generarCodigoReferencia(prev.tipo, prev.periodoAcademico),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.tipo, values.periodoAcademico]);

  const setField = useCallback(
    <K extends keyof CreateDjFormValues>(key: K, value: CreateDjFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setApiError(null);
    },
    []
  );

  const handleApiFailure = useCallback((err: unknown) => {
    if (!(err instanceof ApiError)) {
      setApiError({
        title: 'Error inesperado',
        detail: 'No se pudo completar la operación. Intente nuevamente.',
      });
      setStatus('error');
      return;
    }

    const apiErr = err;

    switch (apiErr.status) {
      case 401:
        setApiError({
          title: 'Sesión expirada',
          detail:
            apiErr.body.message ??
            'Su sesión ha expirado por inactividad. Por favor, inicie sesión nuevamente.',
          code: apiErr.body.error,
        });
        break;
      case 403:
        if (apiErr.body.error === 'INACTIVE_BINDING') {
          setApiError({
            title: 'Vinculación inactiva',
            detail:
              apiErr.body.message ??
              'El docente no tiene vinculación activa con la institución. No puede generar declaraciones juradas.',
            code: 'INACTIVE_BINDING',
          });
        } else {
          setApiError({
            title: 'Acción no permitida',
            detail:
              apiErr.body.message ??
              'La declaración jurada no puede modificarse en su estado actual.',
            code: apiErr.body.error,
          });
        }
        break;
      case 422:
        setApiError({
          title: 'Revise los datos ingresados',
          detail: apiErr.body.message ?? 'Algunos campos no cumplen las validaciones del sistema.',
          code: 'VALIDATION_ERROR',
        });
        if (apiErr.body.details) {
          const mapped: Partial<Record<keyof CreateDjFormValues, string>> = {};
          for (const [key, msgs] of Object.entries(apiErr.body.details)) {
            const first = msgs[0];
            if (first) {
              mapped[key as keyof CreateDjFormValues] = first;
            }
          }
          setFieldErrors((prev) => ({ ...prev, ...mapped }));
        }
        break;
      default:
        setApiError({
          title: 'Error del servidor',
          detail: apiErr.body.correlationId
            ? `Referencia: ${apiErr.body.correlationId}`
            : 'Contacte a la Unidad de TI si el problema persiste.',
          code: apiErr.body.error,
        });
    }
    setStatus('error');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setApiError(null);
    setFieldErrors({});

    const parsed = createDjFormSchema.safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<keyof CreateDjFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as keyof CreateDjFormValues;
        if (!errors[path]) errors[path] = issue.message;
      }
      setFieldErrors(errors);
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const payload = formValuesToPayload(parsed.data);
      const result = await createDeclaracionJurada(payload);
      setSuccess({ id: result.id, estado: result.estado });
      setStatus('success');
      setTimeout(() => navigate(`/declaraciones-juradas/${result.id}`), 1500);
    } catch (err) {
      handleApiFailure(err);
    }
  };

  const isLoading = status === 'loading';
  const isDisabled = isLoading || success !== null;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 border-b border-slate-200 pb-4">
        <p className="text-sm font-medium text-institucional-600">FSD-UC-002 · Declaraciones Juradas</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Nueva Declaración Jurada</h1>
        <p className="mt-2 text-sm text-slate-600">
          Journey docente — seleccione tipo y período, complete los campos y guarde como borrador.
        </p>
      </header>

      {success ? (
        <FormAlert variant="success" title="Declaración jurada creada correctamente" id="dj-success">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>ID de seguimiento:</strong>{' '}
              <code className="rounded bg-emerald-100 px-1 text-xs">{success.id}</code>
            </li>
            <li>
              <strong>Estado actual:</strong> {success.estado}
            </li>
          </ul>
          <p className="mt-2 text-sm">Redirigiendo al detalle del trámite…</p>
        </FormAlert>
      ) : null}

      {apiError ? (
        <div className="mb-4">
          <FormAlert
            variant={apiError.code === 'INACTIVE_BINDING' ? 'warning' : 'error'}
            title={apiError.title}
          >
            <p>{apiError.detail}</p>
            {apiError.code === 'INACTIVE_BINDING' ? (
              <p className="mt-2 text-sm">
                Contacte a Personal Académico o a la Unidad de TI para regularizar su vinculación
                (RB-01).
              </p>
            ) : null}
          </FormAlert>
        </div>
      ) : null}

      <form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isLoading}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <fieldset disabled={isDisabled} className="space-y-6">
          <legend className="sr-only">Datos de la declaración jurada</legend>

          {/* Journey § Creación — tipo y período */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="tipo"
              label="Tipo de declaración jurada"
              required
              error={fieldErrors.tipo}
            >
              <select
                id="tipo"
                value={values.tipo}
                onChange={(e) => setField('tipo', e.target.value as CreateDjFormValues['tipo'])}
                className={textInputClass(!!fieldErrors.tipo)}
              >
                {TIPOS_DJ.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              id="periodoAcademico"
              label="Período académico"
              required
              hint="Formato CEUB: 2026-I o 2026-II"
              error={fieldErrors.periodoAcademico}
            >
              <input
                id="periodoAcademico"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="2026-I"
                value={values.periodoAcademico}
                onChange={(e) => setField('periodoAcademico', e.target.value)}
                className={textInputClass(!!fieldErrors.periodoAcademico)}
              />
            </FormField>
          </div>

          <FormField
            id="cargoInstitucional"
            label="Cargo institucional"
            required
            error={fieldErrors.cargoInstitucional}
          >
            <input
              id="cargoInstitucional"
              type="text"
              value={values.cargoInstitucional}
              onChange={(e) => setField('cargoInstitucional', e.target.value)}
              className={textInputClass(!!fieldErrors.cargoInstitucional)}
              placeholder="Ej. Docente Titular — Facultad de Ingeniería"
            />
          </FormField>

          <FormField
            id="dependencia"
            label="Dependencia / Facultad"
            required
            hint="Facultades de la Universidad Mayor de San Simón (UMSS)"
            error={fieldErrors.dependencia}
          >
            <select
              id="dependencia"
              value={values.dependencia}
              onChange={(e) => setField('dependencia', e.target.value as CreateDjFormValues['dependencia'])}
              className={textInputClass(!!fieldErrors.dependencia)}
            >
              {FACULTADES_UMSS.map((facultad) => (
                <option key={facultad} value={facultad}>
                  {facultad}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="actividadesDescripcion"
            label="Descripción de actividades"
            required
            hint="Mínimo 20 caracteres — no incluya datos financieros sensibles en este campo."
            error={fieldErrors.actividadesDescripcion}
          >
            <textarea
              id="actividadesDescripcion"
              rows={5}
              value={values.actividadesDescripcion}
              onChange={(e) => setField('actividadesDescripcion', e.target.value)}
              className={textInputClass(!!fieldErrors.actividadesDescripcion)}
            />
          </FormField>

          <FormField
            id="referenciaDocumental"
            label="Código de referencia"
            hint="Generado automáticamente a partir del tipo y el período académico"
            error={fieldErrors.referenciaDocumental}
          >
            <input
              id="referenciaDocumental"
              type="text"
              value={values.referenciaDocumental ?? ''}
              readOnly
              disabled
              className={`${textInputClass(!!fieldErrors.referenciaDocumental)} cursor-not-allowed bg-slate-100 font-mono text-slate-600`}
            />
          </FormField>

          <FormField
            id="declaracionVeracidad"
            label="Declaración bajo fe"
            required
            error={fieldErrors.declaracionVeracidad}
          >
            <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <input
                id="declaracionVeracidad"
                type="checkbox"
                checked={values.declaracionVeracidad}
                onChange={(e) => setField('declaracionVeracidad', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-institucional-600 focus:ring-institucional-600"
              />
              <label htmlFor="declaracionVeracidad" className="text-sm text-slate-700">
                Declaro bajo fe que la información consignada es verídica y completa, conforme a la
                normativa CEUB vigente.
              </label>
            </div>
          </FormField>
        </fieldset>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-institucional-600" role="status">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-institucional-600 border-t-transparent"
                aria-hidden="true"
              />
              Guardando declaración jurada…
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Al guardar se creará la DJ en estado <strong>BORRADOR</strong>.
            </p>
          )}

          <button
            type="submit"
            disabled={isDisabled}
            className="inline-flex items-center justify-center rounded-md bg-institucional-700 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-institucional-800 focus:outline-none focus:ring-2 focus:ring-institucional-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando…' : 'Guardar como borrador'}
          </button>
        </div>
      </form>
    </div>
  );
}
