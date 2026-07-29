# Feature Specification: Panel de configuración de usuario

**Feature Branch**: `013-user-settings`

**Created**: 2026-06-28

**Status**: Draft

**Input**: User description: Convertir el shell vacío `/dashboard/settings` en un panel de
configuración real con cuatro secciones nuevas — Perfil personal, Seguridad, Organización y
Equipo/Miembros — sin tocar las settings ya existentes de WhatsApp/Instagram/Calendario que
solo conviven en el mismo panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar perfil personal y avatar (Priority: P1)

Cualquier miembro (owner o agente) abre Configuración → Perfil, cambia su nombre visible y sube
una foto de avatar. Al guardar, el avatar reemplaza las iniciales en el riel de navegación y en
cualquier lugar donde aparezca el usuario.

**Why this priority**: Es el núcleo de "configuración de usuario", aplica a todo miembro, no
depende de roles ni de envío de correos, y entrega valor visible de inmediato. Es el MVP
independiente más pequeño.

**Independent Test**: Iniciar sesión, ir a Perfil, cambiar el nombre y subir una imagen,
guardar y confirmar que el riel muestra la foto y el nuevo nombre tras recargar.

**Acceptance Scenarios**:

1. **Given** un miembro autenticado en Perfil, **When** edita su nombre y guarda, **Then** el
   nombre se persiste y se refleja en el riel/encabezado sin recargar la app entera.
2. **Given** un miembro en Perfil, **When** selecciona una imagen válida (JPG/PNG/WebP dentro
   del límite de tamaño) y la sube, **Then** la imagen se almacena y el avatar de iniciales se
   reemplaza por la foto.
3. **Given** un miembro en Perfil, **When** ve la sección, **Then** su email y su rol se
   muestran como solo lectura (no editables aquí).
4. **Given** una imagen de tipo o tamaño no permitido, **When** intenta subirla, **Then** se
   muestra un error legible y el avatar previo no cambia.

---

### User Story 2 - Seguridad: cambiar contraseña y cerrar sesión (Priority: P1)

Cualquier miembro abre Configuración → Seguridad, cambia su contraseña (proporcionando la
contraseña actual y la nueva) y dispone de un botón para cerrar sesión que hoy no existe en
ninguna parte de la aplicación.

**Why this priority**: La ausencia de logout es una carencia funcional básica; el cambio de
contraseña es seguridad esencial. Ambos son por-usuario, sin dependencia de rol ni de email.

**Independent Test**: Cambiar la contraseña, cerrar sesión y volver a iniciar sesión con la
nueva contraseña; confirmar que la antigua ya no funciona.

**Acceptance Scenarios**:

1. **Given** un miembro en Seguridad, **When** ingresa su contraseña actual correcta y una
   nueva válida, **Then** la contraseña se actualiza y puede iniciar sesión con la nueva.
2. **Given** un miembro en Seguridad, **When** ingresa una contraseña actual incorrecta,
   **Then** se muestra un error legible y la contraseña no cambia.
3. **Given** un miembro autenticado, **When** pulsa "Cerrar sesión", **Then** la sesión termina
   y es redirigido a la pantalla de inicio de sesión.
4. **Given** una contraseña nueva que no cumple los requisitos mínimos, **When** intenta
   guardar, **Then** se muestra un error de validación legible.

---

### User Story 3 - Datos de la organización (Priority: P2)

El owner abre Configuración → Organización y edita el nombre y el logo de la agencia. Los
agentes no pueden editar esta sección.

**Why this priority**: Personaliza la marca de la agencia; valioso pero secundario frente al
perfil personal y la seguridad. Reusa el mismo patrón de subida de imagen del avatar.

**Independent Test**: Como owner, cambiar el nombre de la agencia y subir un logo, guardar y
confirmar que persiste; como agente, confirmar que no puede mutar la sección.

**Acceptance Scenarios**:

1. **Given** un owner en Organización, **When** edita el nombre de la agencia y guarda,
   **Then** el nuevo nombre se persiste y se muestra donde aparezca el nombre de la org.
2. **Given** un owner en Organización, **When** sube un logo válido, **Then** el logo se
   almacena y se muestra como logo de la organización.
3. **Given** un agente, **When** intenta acceder a la edición de Organización, **Then** la
   sección es de solo lectura o no está disponible, y cualquier intento de mutación es rechazado
   (403).

---

### User Story 4 - Gestión de equipo e invitaciones (Priority: P2)

El owner abre Configuración → Equipo, ve la lista de miembros (nombre, email, rol, fecha de
alta), invita a nuevas personas por correo electrónico, cambia el rol de un miembro
(owner↔agente) y elimina miembros. El invitado recibe un correo con un enlace, lo acepta, se
registra o inicia sesión, y queda incorporado a la organización con el rol asignado.

**Why this priority**: Habilita la colaboración multi-usuario real dentro de una agencia. Es la
parte más compleja (flujo de invitación + correo + aceptación) y por eso va después de las bases
personales, pero sigue siendo de alto valor.

**Independent Test**: Como owner, invitar a un email de prueba, confirmar que se crea la
invitación y se entrega/obtiene el enlace; aceptar el enlace desde otra cuenta y verificar que
el nuevo miembro aparece en la lista con su rol; cambiar su rol y luego eliminarlo.

**Acceptance Scenarios**:

1. **Given** un owner en Equipo, **When** abre la sección, **Then** ve a todos los miembros de
   su organización con nombre, email, rol y fecha de alta — y solo de su organización.
2. **Given** un owner, **When** invita a un email con un rol (owner o agente), **Then** se crea
   una invitación pendiente y se envía un correo con un enlace de aceptación.
3. **Given** un invitado con un enlace válido, **When** lo acepta e inicia/crea su cuenta,
   **Then** pasa a ser miembro de la organización con el rol asignado y aparece en la lista.
4. **Given** un owner, **When** cambia el rol de otro miembro, **Then** el cambio se persiste y
   se refleja en la lista.
5. **Given** un owner, **When** elimina a otro miembro, **Then** ese usuario pierde acceso a la
   organización y desaparece de la lista.
6. **Given** un agente, **When** intenta invitar, cambiar roles o eliminar miembros, **Then**
   la acción es rechazada (403).
7. **Given** el único owner de la organización, **When** intenta degradarse a agente o
   eliminarse a sí mismo, **Then** la acción es bloqueada con un mensaje legible (la organización
   no puede quedarse sin owner).
8. **Given** un owner, **When** invita a un email que ya es miembro o ya tiene invitación
   pendiente, **Then** se muestra un mensaje legible y no se crea un duplicado.
9. **Given** un owner cuyo envío de correo de invitación falla, **When** crea la invitación,
   **Then** la invitación queda creada y se muestra el enlace para copiar y compartir
   manualmente (degradación, no rompe la UI).

---

### Edge Cases

- **Subida de imagen inválida** (tipo no permitido, excede tamaño): se rechaza con error
  legible; el avatar/logo previo se conserva.
- **Aislamiento de tenant**: ningún miembro puede ver ni mutar miembros, invitaciones o datos de
  organización de otra organización; cualquier intento se rechaza.
- **Invitación a email ya miembro o ya invitado**: no se duplica; mensaje legible.
- **Aceptar invitación expirada o ya usada**: se informa que el enlace no es válido.
- **Último owner**: no puede auto-degradarse ni auto-eliminarse; bloqueado.
- **Contraseña actual incorrecta** al cambiar contraseña: error legible, sin cambio.
- **Fallo del servicio de correo**: la invitación persiste y se ofrece enlace copiable.
- **Sesión cerrada / token expirado** mientras se está en Configuración: redirige a login.

## Requirements *(mandatory)*

### Functional Requirements

**Perfil personal (todo miembro)**

- **FR-001**: El sistema MUST permitir a cualquier miembro autenticado editar y persistir su
  nombre visible.
- **FR-002**: El sistema MUST permitir a cualquier miembro subir una imagen de avatar y
  asociarla a su cuenta, reemplazando el avatar de iniciales en la navegación.
- **FR-003**: El sistema MUST mostrar el email y el rol del usuario como información de solo
  lectura en Perfil.
- **FR-004**: El sistema MUST validar el tipo y el tamaño de la imagen de avatar y rechazar las
  no válidas con un mensaje legible, conservando el avatar previo.

**Seguridad (todo miembro)**

- **FR-005**: El sistema MUST permitir a un miembro cambiar su contraseña exigiendo la
  contraseña actual y una nueva que cumpla los requisitos mínimos.
- **FR-006**: El sistema MUST rechazar el cambio de contraseña si la contraseña actual es
  incorrecta, con un mensaje legible y sin alterar la contraseña.
- **FR-007**: El sistema MUST ofrecer una acción de cerrar sesión accesible desde la UI que
  termine la sesión y redirija a la pantalla de inicio de sesión.

**Organización (solo owner muta)**

- **FR-008**: El sistema MUST permitir al owner editar y persistir el nombre de la organización.
- **FR-009**: El sistema MUST permitir al owner subir y persistir el logo de la organización.
- **FR-010**: El sistema MUST impedir que un agente modifique los datos de la organización
  (rechazo 403); el agente, a lo sumo, los ve en solo lectura.

**Equipo / Miembros (solo owner muta)**

- **FR-011**: El sistema MUST listar los miembros de la organización del usuario (nombre, email,
  rol, fecha de alta), restringido a su propia organización.
- **FR-012**: El sistema MUST permitir al owner invitar a una persona por email asignándole un
  rol (owner o agente), creando una invitación pendiente.
- **FR-013**: El sistema MUST enviar un correo de invitación con un enlace de aceptación cuando
  el servicio de correo esté disponible.
- **FR-014**: El sistema MUST permitir a un invitado aceptar la invitación mediante el enlace y,
  tras autenticarse o registrarse, incorporarlo a la organización con el rol asignado.
- **FR-015**: El sistema MUST permitir al owner cambiar el rol de un miembro (owner↔agente) y
  persistir el cambio.
- **FR-016**: El sistema MUST permitir al owner eliminar a un miembro de la organización,
  revocándole el acceso.
- **FR-017**: El sistema MUST impedir que la organización quede sin ningún owner: el único owner
  no puede degradarse ni eliminarse a sí mismo.
- **FR-018**: El sistema MUST impedir que un agente invite, cambie roles o elimine miembros
  (rechazo 403).
- **FR-019**: El sistema MUST evitar invitaciones duplicadas a un email que ya es miembro o ya
  tiene una invitación pendiente, con mensaje legible.
- **FR-020**: Si el envío del correo de invitación falla, el sistema MUST conservar la
  invitación creada y exponer el enlace de aceptación para compartir manualmente (degradación).

**Transversales**

- **FR-021**: Todas las acciones MUST estar restringidas al tenant del usuario; ninguna acción
  puede leer ni mutar datos de otra organización.
- **FR-022**: Las nuevas secciones MUST integrarse en el panel `/dashboard/settings` existente
  sin alterar el comportamiento de las secciones ya existentes (WhatsApp, Instagram,
  Calendario).
- **FR-023**: Los errores del proveedor de identidad/servicios (contraseña incorrecta, email ya
  invitado/miembro, enlace inválido) MUST mostrarse como mensajes legibles, no como errores
  técnicos crudos.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona con cuenta; atributos relevantes aquí: nombre visible, email
  (solo lectura), avatar/imagen, credencial de contraseña.
- **Organización (agencia)**: tenant; atributos editables aquí: nombre y logo.
- **Membresía**: relación usuario↔organización con un rol (owner o agente) y fecha de alta;
  base de la lista de equipo y de los cambios de rol/eliminación.
- **Invitación**: solicitud pendiente para incorporar un email a una organización con un rol y
  un enlace/estado de aceptación; puede estar pendiente, aceptada o expirada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro puede actualizar su nombre y avatar y verlo reflejado en la navegación
  en menos de 1 minuto, sin recargar manualmente toda la aplicación.
- **SC-002**: Un miembro puede cambiar su contraseña y volver a iniciar sesión con la nueva
  contraseña con éxito; la contraseña anterior deja de funcionar el 100% de las veces.
- **SC-003**: Existe una acción de cerrar sesión funcional accesible desde la UI (antes había
  cero formas de cerrar sesión).
- **SC-004**: Un owner puede invitar a una persona y que esa persona quede incorporada como
  miembro con el rol correcto, completando el flujo invitación→aceptación en el primer intento.
- **SC-005**: El 100% de los intentos de un agente por gestionar equipo u organización son
  rechazados; el 100% de los intentos de acceder a miembros/datos de otra organización son
  rechazados.
- **SC-006**: La organización nunca queda sin un owner: todos los intentos del último owner por
  degradarse o eliminarse son bloqueados.
- **SC-007**: Cuando el correo de invitación no se entrega, el owner aún obtiene un enlace de
  invitación utilizable el 100% de las veces (sin pantallas rotas).

## Assumptions

- Se reutiliza el sistema de autenticación e identidad existente (Better Auth con plugin de
  organización, roles owner/agente) y sus tablas de usuario, sesión, organización, membresía e
  invitación; esta feature no introduce un nuevo modelo de identidad.
- Se reutiliza el almacenamiento de objetos S3-compatible existente (R2) y el patrón de subida
  directa prefirmada ya usado para fotos de propiedades (feature 007) para avatar y logo.
- Se reutiliza el servicio de correo existente (`lib/mail`, feature 011) para los correos de
  invitación; el correo es best-effort y su fallo degrada a enlace copiable.
- Se reutilizan los guardas de autorización existentes (`requireMember`/`requireOwner`) y el
  patrón de endpoints `/api` del proyecto.
- El reseteo de contraseña sin sesión ("olvidé mi contraseña"), la verificación de email, la
  facturación, el branding avanzado y la reorganización/unificación visual de las settings
  existentes de WhatsApp/Instagram/Calendario están **fuera de alcance**.
- "Abandonar la organización" por iniciativa propia (un miembro no-owner que se auto-elimina) se
  considera fuera de alcance salvo decisión contraria; la eliminación de miembros la realiza el
  owner.
- Los requisitos mínimos de contraseña son los que ya aplica el sistema de autenticación
  existente en el registro.
- El cierre de la feature incluye un self-test de comportamiento E2E conducido por el equipo de
  desarrollo (camino feliz + caminos infelices listados en Edge Cases), marcando como pendiente
  de verificación humana solo lo no automatizable (p. ej. recepción visual del correo real).
