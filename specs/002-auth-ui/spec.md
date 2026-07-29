# Feature Specification: UI de autenticación (registro e inicio de sesión)

**Feature Branch**: `002-auth-ui`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "UI de autenticación de Inmox (US1, P1): pantallas públicas de registro e inicio de sesión que hoy faltan y bloquean todo el uso de la app. El backend de auth ya existe (Better Auth self-hosted, email+contraseña, plugin organization, roles owner/agent). Alcance: registro self-serve del dueño de agencia (email + contraseña + nombre de agencia → crea usuario, crea organización, deja al usuario como owner con organización activa, redirige al dashboard), login real, manejo de errores visibles, marca correcta 'Inmox', y redirección coherente entre páginas públicas y dashboard. La invitación de agentes (rol agent) NO entra en esta feature (US3)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro del dueño de agencia (Priority: P1)

Una persona que quiere usar Inmox para su agencia inmobiliaria llega a la app sin
cuenta. Abre la pantalla de registro, introduce su correo, una contraseña y el
nombre de su agencia, y al confirmar queda dentro del panel de la aplicación con
su agencia ya creada y él como dueño, listo para empezar a configurar WhatsApp y
gestionar propiedades.

**Why this priority**: Sin registro no existe ninguna cuenta ni agencia en el
sistema; es la puerta de entrada absoluta. Hoy esta pantalla no existe y bloquea
el 100% del uso del producto. Es el primer eslabón de US1 (comunicación WhatsApp),
ya que el onboarding de WhatsApp exige ser dueño de una agencia con sesión activa.

**Independent Test**: Se puede probar de forma aislada visitando la ruta de
registro, completando el formulario con datos válidos y verificando que la sesión
queda iniciada, la agencia creada, el usuario marcado como dueño y la navegación
llega al panel principal.

**Acceptance Scenarios**:

1. **Given** un visitante anónimo en la pantalla de registro, **When** envía un
   correo nuevo, una contraseña válida y un nombre de agencia, **Then** el sistema
   crea su cuenta, crea la agencia, lo deja como dueño con la agencia como activa, y
   lo lleva al panel principal (bandeja).
2. **Given** un visitante que intenta registrarse con un correo ya existente,
   **When** envía el formulario, **Then** ve un mensaje claro de que ese correo ya
   está registrado y permanece en la pantalla sin perder lo escrito (salvo la
   contraseña).
3. **Given** un visitante que deja campos vacíos o una contraseña demasiado corta,
   **When** intenta enviar, **Then** ve mensajes de validación por campo y el envío
   no procede.
4. **Given** un usuario que ya tiene sesión iniciada, **When** navega a la pantalla
   de registro, **Then** es redirigido automáticamente al panel principal.

---

### User Story 2 - Inicio de sesión (Priority: P1)

Un dueño de agencia que ya tiene cuenta vuelve a la app. Abre la pantalla de inicio
de sesión, introduce su correo y contraseña, y al confirmar entra directamente al
panel de su agencia con su agencia seleccionada como activa.

**Why this priority**: Es el acceso recurrente al producto. Sin login funcional, un
usuario registrado no puede volver a entrar tras cerrar sesión o cambiar de
dispositivo. Comparte criticidad con el registro (ambos P1) porque juntos forman el
mínimo viable de acceso.

**Independent Test**: Con una cuenta ya existente, se visita la ruta de inicio de
sesión, se introducen credenciales correctas y se verifica que la navegación llega
al panel con la agencia activa correctamente resuelta.

**Acceptance Scenarios**:

1. **Given** un dueño con cuenta existente en la pantalla de inicio de sesión,
   **When** introduce credenciales correctas, **Then** inicia sesión, su agencia
   queda como activa y es llevado al panel principal.
2. **Given** un usuario que introduce una contraseña incorrecta o un correo
   inexistente, **When** envía el formulario, **Then** ve un mensaje genérico de
   credenciales inválidas (sin revelar si el correo existe) y permanece en la
   pantalla.
3. **Given** un usuario que ya tiene sesión iniciada, **When** navega a la pantalla
   de inicio de sesión, **Then** es redirigido automáticamente al panel principal.
4. **Given** un usuario sin sesión, **When** intenta abrir directamente una ruta del
   panel, **Then** es redirigido a la pantalla de inicio de sesión.

---

### Edge Cases

- **Correo con formato inválido**: el formulario lo rechaza antes de enviar, con
  mensaje por campo.
- **Contraseña por debajo del mínimo**: se rechaza con indicación del requisito.
- **Doble envío / clic repetido**: el botón se deshabilita mientras la operación
  está en curso para evitar crear cuentas duplicadas o sesiones inconsistentes.
- **Fallo del servicio de autenticación o de red**: se muestra un error legible y
  reintentar es posible; no se deja al usuario en una pantalla en blanco ni con un
  error técnico crudo.
- **Usuario autenticado pero sin agencia activa resuelta**: el sistema resuelve y
  activa su agencia antes de mostrar el panel; si no tiene ninguna, no debe quedar
  atrapado en un estado sin salida (ver Assumptions).
- **Nombre de agencia duplicado entre tenants distintos**: dos agencias pueden
  tener el mismo nombre visible; no es un identificador único de cara al usuario.
- **Cierre de sesión**: tras cerrar sesión, el acceso a rutas del panel vuelve a
  redirigir a inicio de sesión.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer una pantalla pública de registro accesible sin
  sesión, con campos para correo, contraseña y nombre de la agencia.
- **FR-002**: El sistema MUST validar los datos de registro antes de procesarlos
  (correo con formato válido, contraseña que cumple el mínimo de seguridad, nombre de
  agencia no vacío) y MUST mostrar mensajes de error por campo cuando no se cumplan.
- **FR-003**: Al registrarse con datos válidos, el sistema MUST crear la cuenta del
  usuario, crear su agencia, asignar al usuario el rol de dueño de esa agencia y
  dejar esa agencia como la activa de su sesión.
- **FR-004**: Tras un registro exitoso, el sistema MUST iniciar la sesión del usuario
  y llevarlo al panel principal sin pedirle iniciar sesión de nuevo.
- **FR-005**: El sistema MUST impedir el registro con un correo ya existente y MUST
  comunicarlo con un mensaje claro, sin exponer datos de la cuenta existente.
- **FR-006**: El sistema MUST ofrecer una pantalla pública de inicio de sesión
  accesible sin sesión, con campos para correo y contraseña.
- **FR-007**: Al iniciar sesión con credenciales correctas, el sistema MUST
  establecer la sesión, resolver y activar la agencia del usuario y llevarlo al panel
  principal.
- **FR-008**: Ante credenciales incorrectas, el sistema MUST mostrar un mensaje
  genérico de error que NO revele si el correo existe en el sistema.
- **FR-009**: El sistema MUST redirigir a un usuario ya autenticado que visite las
  pantallas de registro o de inicio de sesión hacia el panel principal.
- **FR-010**: El sistema MUST redirigir a un usuario sin sesión que intente acceder a
  cualquier ruta del panel hacia la pantalla de inicio de sesión.
- **FR-011**: El sistema MUST garantizar que, al entrar al panel, la agencia activa
  del usuario quede correctamente seleccionada, de modo que las comprobaciones de
  pertenencia y de rol (miembro / dueño) operen sobre la agencia correcta.
- **FR-012**: Las pantallas de autenticación MUST presentar la marca correcta del
  producto ("Inmox") y seguir la identidad visual del proyecto (tipografía y paleta
  definidas en los tokens de diseño, modo claro).
- **FR-013**: El sistema MUST evitar envíos duplicados deshabilitando la acción de
  envío mientras una operación de registro o inicio de sesión está en curso.
- **FR-014**: El sistema MUST NUNCA exponer secretos ni datos sensibles (tokens,
  contraseñas en claro) en mensajes de error, respuestas o registros, conforme al
  Principio I de la constitución.
- **FR-015**: La invitación y el alta de usuarios con rol agente quedan FUERA del
  alcance de esta feature (corresponden a US3); aquí solo el dueño se registra de
  forma autónoma.

### Key Entities *(include if feature involves data)*

- **Usuario**: persona con credenciales (correo y contraseña) que accede al sistema.
  Ya modelado por el backend de autenticación existente; esta feature no redefine su
  estructura, solo la consume.
- **Agencia (organización / tenant)**: unidad multi-tenant que agrupa usuarios,
  propiedades y conversaciones. En esta feature se crea durante el registro y se
  asocia al dueño. El identificador de agencia es el parámetro de tenant de primer
  nivel (Principio III).
- **Membresía**: relación entre un usuario y una agencia con un rol (dueño / agente).
  El registro crea la membresía del dueño. El rol determina los permisos en el panel.
- **Agencia activa de la sesión**: la agencia sobre la que opera la sesión actual;
  debe quedar establecida para que las comprobaciones de pertenencia y rol funcionen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un visitante nuevo puede completar el registro (cuenta + agencia) y
  llegar al panel principal en menos de 2 minutos, sin pasos manuales adicionales ni
  intervención de soporte.
- **SC-002**: Un usuario con cuenta existente puede iniciar sesión y llegar al panel
  con su agencia activa en 3 pasos o menos (abrir pantalla, introducir credenciales,
  confirmar).
- **SC-003**: El 100% de los intentos de registro con correo duplicado, campos
  vacíos o contraseña inválida producen un mensaje de error comprensible y no crean
  cuentas inconsistentes.
- **SC-004**: El 100% de los intentos de acceso al panel sin sesión terminan en la
  pantalla de inicio de sesión, y el 100% de los accesos a las pantallas de
  autenticación con sesión activa terminan en el panel.
- **SC-005**: Tras registrarse o iniciar sesión, el usuario llega al panel con su
  rol y agencia correctamente resueltos, pudiendo acceder a las acciones reservadas
  al dueño (verificable porque el onboarding de WhatsApp deja de devolver "no
  autorizado / sin organización activa").
- **SC-006**: Ningún mensaje de error de las pantallas de autenticación revela si un
  correo concreto existe en el sistema ni expone información técnica interna.

## Assumptions

- **El backend de autenticación ya existe y se reutiliza**: autenticación por
  correo y contraseña, gestión de organizaciones (tenants) y de roles dueño/agente
  ya están implementados. Esta feature aporta únicamente la capa de interfaz y el
  flujo de usuario que faltan; no crea ni modifica el modelo de datos.
- **Registro self-serve solo para el dueño**: cualquier persona puede registrarse y,
  al hacerlo, se convierte en dueño de una agencia recién creada. Una persona crea
  una agencia por registro. El alta de agentes adicionales es por invitación y queda
  fuera (US3).
- **Una agencia activa por sesión**: en v1 el usuario opera sobre una sola agencia;
  al autenticarse se resuelve y activa su agencia. El soporte para que un usuario
  pertenezca a varias agencias y conmute entre ellas está fuera de alcance.
- **Sin recuperación de contraseña en esta feature**: el restablecimiento de
  contraseña olvidada no entra en el alcance; se asume manejo posterior.
- **Sin verificación de correo en esta feature**: no se exige confirmar el correo por
  enlace para empezar a usar la app en v1; se asume manejo posterior si el negocio lo
  requiere.
- **Idioma**: las pantallas se presentan en español, coherente con el resto del
  producto.
- **El panel principal de destino es la bandeja de conversaciones** (ruta de inbox),
  por ser el corazón operativo de US1.
