/** Lo mínimo que necesita el Administrador de Facultad para que el sistema encuentre la DJ real. */
export interface ConsultaDJInput {
  facultad: string;
  nombreDocente: string;
  /** Opcional — si no se manda, se toma la DJ más reciente de ese docente en esa facultad. */
  periodoAcademico?: string;
  /** Texto libre del administrador — la pregunta real sobre la DJ. */
  consulta: string;
}

export interface DJEncontrada {
  id: string;
  docenteNombre: string;
  facultad: string;
  periodoAcademico: string;
  tipo: string;
  estado: string;
  cargoInstitucional: string;
  actividadesDescripcion: string;
}

export interface ConsultaDJResult {
  dj: DJEncontrada;
  prompt: string;
  respuestaModelo: string;
}
