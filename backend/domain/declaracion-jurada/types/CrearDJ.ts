import type { Rol } from '../../administracion/types/Rol.js';

export interface CrearDJCommand {
  docenteId: string;
  facultadId: string;
  docenteVinculacionActiva: boolean;
  tipo: string;
  periodoAcademico: string;
  camposFormulario: Record<string, unknown>;
}

export interface ActorContext {
  userId: string;
  rol: Rol;
  facultadId?: string;
}

export interface ListarDJQuery {
  estado?: string;
  page?: number;
  pageSize?: number;
}
