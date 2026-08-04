import { Rol } from '../../administracion/types/Rol.js';
import { DomainError } from '../../shared/errors/DomainError.js';
import { ComandoDJ } from '../types/ComandoDJ.js';
import { EstadoDJ } from '../types/EstadoDJ.js';
import { DJStateMachine } from './DJStateMachine.js';

describe('DJStateMachine', () => {
  it('MUST allow ENVIAR from BORRADOR when vinculacion_activa (RB-01)', () => {
    const r = DJStateMachine.resolveTransition({
      estadoActual: EstadoDJ.BORRADOR,
      comando: ComandoDJ.ENVIAR,
      actorRol: Rol.DOCENTE,
      djFacultadId: 'fac-1',
      docenteVinculacionActiva: true,
    });
    expect(r.estadoNuevo).toBe(EstadoDJ.EN_REVISION_FACULTAD);
  });

  it('MUST reject ENVIAR if vinculacion_activa = false (RB-01)', () => {
    try {
      DJStateMachine.resolveTransition({
        estadoActual: EstadoDJ.BORRADOR,
        comando: ComandoDJ.ENVIAR,
        actorRol: Rol.DOCENTE,
        djFacultadId: 'fac-1',
        docenteVinculacionActiva: false,
      });
      fail('expected INACTIVE_BINDING');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INACTIVE_BINDING');
    }
  });

  it('MUST reject transition from terminal APROBADA (RB-03 / terminal)', () => {
    try {
      DJStateMachine.resolveTransition({
        estadoActual: EstadoDJ.APROBADA,
        comando: ComandoDJ.ENVIAR,
        actorRol: Rol.DOCENTE,
        djFacultadId: 'fac-1',
        docenteVinculacionActiva: true,
      });
      fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('FORBIDDEN_TRANSITION');
    }
  });

  it('MUST reject field edit in EN_REVISION_FACULTAD (RB-03)', () => {
    try {
      DJStateMachine.assertCamposEditables(EstadoDJ.EN_REVISION_FACULTAD);
      fail('expected FORBIDDEN_TRANSITION');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('FORBIDDEN_TRANSITION');
    }
  });
});
