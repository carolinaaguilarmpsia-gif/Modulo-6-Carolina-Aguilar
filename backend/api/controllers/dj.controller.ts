import type { Response } from 'express';
import { DeclaracionJuradaService } from '../../domain/declaracion-jurada/services/DeclaracionJuradaService.js';
import { ComandoDJ } from '../../domain/declaracion-jurada/types/ComandoDJ.js';
import { EstadoDJ } from '../../domain/declaracion-jurada/types/EstadoDJ.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { CreateDjSchema, TransicionDjSchema, UpdateDjCamposSchema } from '../validators/dj.validator.js';
import type { z } from 'zod';

export class DjController {
  constructor(private readonly service: DeclaracionJuradaService) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const estado = req.query.estado as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;

    const result = await this.service.listar(
      { userId: req.user.userId, rol: req.user.rol, facultadId: req.user.facultadId },
      { estado, page }
    );

    res.json({
      items: result.items.map((d) => this.toSummary(d)),
      total: result.total,
      correlationId: req.correlationId,
    });
  };

  create = async (
    req: AuthenticatedRequest & { validatedBody: z.infer<typeof CreateDjSchema> },
    res: Response
  ): Promise<void> => {
    const body = req.validatedBody;
    const dj = await this.service.crear({
      docenteId: req.user.userId,
      facultadId: req.user.facultadId,
      docenteVinculacionActiva: req.user.vinculacionActiva,
      tipo: body.tipo,
      periodoAcademico: body.periodoAcademico,
      camposFormulario: body.camposFormulario,
    });

    res.status(201).json({
      id: dj.id,
      estado: dj.estado,
      correlationId: req.correlationId,
    });
  };

  getById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { dj, historial } = await this.service.obtenerDetalle(req.params.id, {
      userId: req.user.userId,
      rol: req.user.rol,
      facultadId: req.user.facultadId,
    });

    res.json({
      ...this.toDetail(dj),
      historial: historial.map((h) => ({
        id: h.id,
        estadoAnterior: h.estadoAnterior,
        estadoNuevo: h.estadoNuevo,
        actorId: h.actorId,
        observaciones: h.observaciones,
        timestamp: h.timestamp.toISOString(),
      })),
      correlationId: req.correlationId,
    });
  };

  updateCampos = async (
    req: AuthenticatedRequest & { validatedBody: z.infer<typeof UpdateDjCamposSchema> },
    res: Response
  ): Promise<void> => {
    const dj = await this.service.actualizarCampos(req.params.id, req.validatedBody.camposFormulario, {
      userId: req.user.userId,
      rol: req.user.rol,
      facultadId: req.user.facultadId,
    });

    res.json({ ...this.toDetail(dj), correlationId: req.correlationId });
  };

  transicionarEstado = async (
    req: AuthenticatedRequest & { validatedBody: z.infer<typeof TransicionDjSchema> },
    res: Response
  ): Promise<void> => {
    const body = req.validatedBody;
    const result = await this.service.transicionarEstado({
      djId: req.params.id,
      comando: body.comando as ComandoDJ,
      actorId: req.user.userId,
      actorRol: req.user.rol,
      actorFacultadId: req.user.facultadId,
      observaciones: body.observaciones,
    });

    res.json({
      id: result.djId,
      estadoAnterior: result.estadoAnterior,
      estadoNuevo: result.estadoNuevo,
      historialId: result.historialId,
      notificacionEncolada: result.notificacionEncolada,
      correlationId: req.correlationId,
    });
  };

  private toSummary(dj: {
    id: string;
    tipo: string;
    periodoAcademico: string;
    estado: EstadoDJ;
    updatedAt: Date;
  }) {
    return {
      id: dj.id,
      tipo: dj.tipo,
      periodoAcademico: dj.periodoAcademico,
      estado: dj.estado,
      updatedAt: dj.updatedAt.toISOString(),
    };
  }

  private toDetail(dj: {
    id: string;
    docenteId: string;
    facultadId: string;
    tipo: string;
    periodoAcademico: string;
    estado: EstadoDJ;
    camposFormulario: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: dj.id,
      docenteId: dj.docenteId,
      facultadId: dj.facultadId,
      tipo: dj.tipo,
      periodoAcademico: dj.periodoAcademico,
      estado: dj.estado,
      camposFormulario: dj.camposFormulario,
      createdAt: dj.createdAt.toISOString(),
      updatedAt: dj.updatedAt.toISOString(),
    };
  }
}
