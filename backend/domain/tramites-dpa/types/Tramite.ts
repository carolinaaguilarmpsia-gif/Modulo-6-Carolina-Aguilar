export interface Tramite {
  codigo: string;
  nombre: string;
  descripcion?: string;
  normativa?: string;
  requisitos: string[];
  tiempo: string;
}

export interface DepartamentoTramites {
  departamento: string;
  tramites: Tramite[];
}

export interface TramiteConDepartamento extends Tramite {
  departamento: string;
}

export interface FuenteTramite {
  codigo: string;
  nombre: string;
  departamento: string;
}

export interface TramiteKeywordEntry {
  codigo: string;
  keywords: string[];
}
