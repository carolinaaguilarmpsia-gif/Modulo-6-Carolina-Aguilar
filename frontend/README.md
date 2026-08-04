# SGAI Frontend — Declaraciones Juradas (FSD-UC-002) + Autenticación (FSD-UC-001)

## Demo full-stack (recomendado)

Terminal 1 — API (puerto 3001):

```bash
cd backend && npm install && npm run dev
```

Terminal 2 — UI:

```bash
cd frontend && npm install && npm run dev
```

Abrir: http://localhost:5173/ — redirige a `/login` si no hay sesión.

### Cuentas de demostración

Password para todas: `Demo1234!`

| Email | Rol |
|---|---|
| `docente@universidad.edu.bo` | Docente |
| `admin.facultad@universidad.edu.bo` | Admin. Facultad |
| `dpa@universidad.edu.bo` | Técnico DPA |
| `admin.sistema@universidad.edu.bo` | Admin. Sistema |

### Flujo completo a probar

1. Login como **Docente** → "Nueva DJ" → guardar borrador → detalle.
2. **Enviar a Facultad** → estado `EN_REVISION_FACULTAD`.
3. Cerrar sesión, login como **Admin. Facultad** → Aprobar / Devolver / Escalar DPA.
4. Cerrar sesión, login como **Técnico DPA** si escaló → Aprobar o Rechazar.
5. Ver **historial RB-06** en cada detalle.
6. RB-07: en el login, 5 intentos con password incorrecta → 6º intento bloqueado 15 min aunque la password sea correcta.

### RB-01

Logueado como Docente, marcar «Simular sin vinculación activa» en la barra gris → crear DJ falla con 403.

## Rutas

| Ruta | Pantalla |
|------|----------|
| `/login` | Login |
| `/declaraciones-juradas` | Listado (protegida — requiere sesión) |
| `/declaraciones-juradas/nueva` | Crear DJ (solo rol Docente) |
| `/declaraciones-juradas/:id` | Detalle + acciones + historial |

## Stack

React 18 · Vite 5 · TypeScript strict · Tailwind 3 · Zod · React Router

Proxy: `/api` → `http://localhost:3001` (ver `vite.config.ts`)

## Notas de arquitectura

- Sesión (JWT) en memoria — no persiste al refrescar la página (`docs/SKILLS/auth-rbac-guard.md`, MUST NOT localStorage).
- `dj.routes.ts` en el backend todavía usa `demoAuthMiddleware` (no JWT real); el frontend deriva ese header del rol ya autenticado. Ver `docs/design/DD-UC-002.md` §2/§4.
