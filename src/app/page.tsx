import Link from "next/link";
import { SessionRedirect } from "@/components/public/session-redirect";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inmox — CRM Inmobiliario Multi-Tenant con WhatsApp e IA",
  description:
    "Plataforma multi-tenant de gestión inmobiliaria, automatización por WhatsApp Cloud API, Instagram, Google Calendar y Agente de IA.",
};

export default function HomePage() {
  return (
    <>
      {/* Redirige a /inbox si ya hay sesión activa */}
      <SessionRedirect />

      <div
        id="landing-root"
        style={{
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          backgroundColor: "#060709",
          color: "#F8FAFC",
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* Effect Glow Backgrounds */}
        <div
          style={{
            position: "fixed",
            top: "-300px",
            left: "-200px",
            width: "900px",
            height: "900px",
            background:
              "radial-gradient(ellipse, rgba(13, 148, 136, 0.14) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            position: "fixed",
            top: "-200px",
            right: "-300px",
            width: "800px",
            height: "800px",
            background:
              "radial-gradient(ellipse, rgba(0, 229, 255, 0.08) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* HERO SECTION */}
        <section
          id="hero-section"
          style={{
            position: "relative",
            minHeight: "100vh",
            backgroundColor: "#000000",
            color: "#FFFFFF",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, #060709 100%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 10,
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "0 1.5rem",
            }}
          >
            {/* Header Sticky Navbar */}
            <header
              id="main-header"
              style={{
                width: "100%",
                maxWidth: "1200px",
                margin: "1.25rem auto 0",
                position: "sticky",
                top: "1.25rem",
                zIndex: 50,
              }}
            >
              <div
                className="liquid-glass"
                style={{
                  borderRadius: "16px",
                  padding: "0.75rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  id="brand-logo-link"
                  href="/"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    textDecoration: "none",
                    color: "#FFFFFF",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #0d9488 0%, #00e5ff 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      color: "#000000",
                      fontSize: "1.1rem",
                    }}
                  >
                    I
                  </div>
                  <span
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      color: "#FFFFFF",
                    }}
                  >
                    Inmox
                  </span>
                </Link>

                <div
                  className="hide-on-mobile"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <a
                    href="#features"
                    style={{
                      color: "#E2E8F0",
                      textDecoration: "none",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      transition: "color 0.2s",
                    }}
                  >
                    Módulos
                  </a>
                  <a
                    href="#pricing"
                    style={{
                      color: "#E2E8F0",
                      textDecoration: "none",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      transition: "color 0.2s",
                    }}
                  >
                    Planes
                  </a>
                  <a
                    href="#faq"
                    style={{
                      color: "#E2E8F0",
                      textDecoration: "none",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      transition: "color 0.2s",
                    }}
                  >
                    FAQ
                  </a>
                  <a
                    href="#empresa"
                    style={{
                      color: "#E2E8F0",
                      textDecoration: "none",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      transition: "color 0.2s",
                    }}
                  >
                    Empresa & Redes
                  </a>
                  <a
                    href="#contacto"
                    style={{
                      color: "#E2E8F0",
                      textDecoration: "none",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      transition: "color 0.2s",
                    }}
                  >
                    Contacto
                  </a>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Link
                    id="login-header-btn"
                    className="glossy-pill-btn"
                    href="/login"
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                      padding: "0.55rem 1.35rem",
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Iniciar Sesión
                  </Link>
                </div>
              </div>
            </header>

            {/* Hero Main Content */}
            <main
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "4rem 1rem",
                maxWidth: "920px",
                margin: "0 auto",
              }}
            >
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Hero Badge */}
                <div
                  className="liquid-glass"
                  style={{
                    border: "1px solid rgba(0, 229, 255, 0.3)",
                    color: "#00E5FF",
                    borderRadius: "9999px",
                    padding: "0.5rem 1.25rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    marginBottom: "1.75rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: "#00E5FF",
                      boxShadow: "0 0 10px #00E5FF",
                      display: "inline-block",
                    }}
                  />
                  WhatsApp Cloud API + Agente IA + Google Calendar
                </div>

                {/* Hero Title */}
                <h1
                  style={{
                    fontSize: "clamp(2.5rem, 5.5vw, 4.25rem)",
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: "-0.04em",
                    color: "#FFFFFF",
                    marginBottom: "1.5rem",
                  }}
                >
                  Gestión Inmobiliaria Integral con Inteligencia Artificial.
                </h1>

                {/* Hero Subtitle */}
                <p
                  style={{
                    fontSize: "clamp(1rem, 2vw, 1.2rem)",
                    color: "#CBD5E1",
                    maxWidth: "680px",
                    lineHeight: 1.6,
                    marginBottom: "2.25rem",
                  }}
                >
                  Bandeja unificada de WhatsApp, cualificación automática de clientes,
                  fichas interactivas, pipeline Kanban y agendamiento de visitas 24/7.
                </p>

                {/* Hero CTA Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: "1.25rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Link
                    id="hero-start-btn"
                    className="glossy-blue-btn"
                    href="/register"
                    style={{
                      padding: "0.9rem 2.25rem",
                      fontSize: "0.95rem",
                      borderRadius: "12px",
                      textDecoration: "none",
                    }}
                  >
                    Probar Gratis Ahora
                  </Link>
                  <a
                    id="hero-explore-btn"
                    href="#features"
                    className="liquid-glass"
                    style={{
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#FFFFFF",
                      padding: "0.9rem 2.25rem",
                      borderRadius: "12px",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      textDecoration: "none",
                    }}
                  >
                    Explorar Módulos
                  </a>
                </div>
              </div>
            </main>

            {/* Hero Footer Banner */}
            <footer style={{ width: "100%", padding: "0 1rem 3.5rem", display: "flex", justifyContent: "center" }}>
              <div className="liquid-glass" style={{ border: "1px solid rgba(255, 255, 255, 0.2)", padding: "0.75rem 2rem", borderRadius: "16px" }}>
                <p style={{ fontSize: "clamp(0.9rem, 2vw, 1.25rem)", fontWeight: 300, color: "#F1F5F9", margin: 0, textAlign: "center" }}>
                  WhatsApp Cloud API · Google Calendar · Instagram API · Agente de IA
                </p>
              </div>
            </footer>
          </div>
        </section>

        {/* FEATURES / MÓDULOS SECTION */}
        <section
          id="features"
          style={{
            padding: "5rem 1.5rem",
            maxWidth: "1200px",
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <h2
              style={{
                fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)",
                fontWeight: 900,
                color: "#F8FAFC",
                letterSpacing: "-0.03em",
                marginBottom: "0.75rem",
              }}
            >
              Todo lo que tu Agencia Inmobiliaria necesita en un solo lugar
            </h2>
            <p style={{ fontSize: "1rem", color: "#94A3B8", maxWidth: "600px", margin: "0 auto" }}>
              Diseñado para optimizar la operación de agencias inmobiliarias y asesores independientes.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "1.5rem",
              alignItems: "stretch",
            }}
          >
            {/* Feature 1 */}
            <div className="glass-card-dark" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "18px",
                  background: "linear-gradient(180deg, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0.05) 100%)",
                  border: "1px solid rgba(13, 148, 136, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 8px 20px rgba(13, 148, 136, 0.15)",
                }}
              >
                💬
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                WhatsApp Cloud API & Inbox
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Bandeja unificada multi-agente, envío de fichas interactivas con botones, plantillas aprobadas por Meta y auto-alta de prospectos.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="glass-card-dark" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "18px",
                  background: "linear-gradient(180deg, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0.05) 100%)",
                  border: "1px solid rgba(13, 148, 136, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 8px 20px rgba(13, 148, 136, 0.15)",
                }}
              >
                🤖
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Agente de IA & Matching
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Cualificación inteligente de compradores e inquilinos, matching bidireccional cliente ↔ propiedad y transferencia fluida a asesores.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card-dark" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "18px",
                  background: "linear-gradient(180deg, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0.05) 100%)",
                  border: "1px solid rgba(13, 148, 136, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 8px 20px rgba(13, 148, 136, 0.15)",
                }}
              >
                🏡
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Inventario de Propiedades
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Catálogo real de renta y venta, galería de fotos R2 con subida prefirmada, estatus rápido, archivado reversible y match inverso.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass-card-dark" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "18px",
                  background: "linear-gradient(180deg, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0.05) 100%)",
                  border: "1px solid rgba(13, 148, 136, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 8px 20px rgba(13, 148, 136, 0.15)",
                }}
              >
                📊
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Pipeline de Ventas (Kanban)
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Etapas configurables por agencia, arrastrar y soltar tarjetas con @dnd-kit, asignación de asesores y reglas de avance continuo.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass-card-dark" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "18px",
                  background: "linear-gradient(180deg, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0.05) 100%)",
                  border: "1px solid rgba(13, 148, 136, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 8px 20px rgba(13, 148, 136, 0.15)",
                }}
              >
                📅
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Agendamiento & Google Calendar
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Google Calendar OAuth por asesor, cálculo de slots disponibles en tiempo real, confirmaciones y recordatorios por email.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="glass-card-dark" style={{ padding: "2rem", textAlign: "center", display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "18px",
                  background: "linear-gradient(180deg, rgba(13, 148, 136, 0.25) 0%, rgba(13, 148, 136, 0.05) 100%)",
                  border: "1px solid rgba(13, 148, 136, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  margin: "0 auto 1.25rem",
                  boxShadow: "0 8px 20px rgba(13, 148, 136, 0.15)",
                }}
              >
                📸
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Integración con Instagram
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Publicación directa de propiedades, moderación automática de comentarios y atención por Mensajes Directos (DM) en ventana de 24h.
              </p>
            </div>
          </div>
        </section>

        {/* PRICING SECTION */}
        <section id="pricing" style={{ padding: "5rem 1.5rem", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", fontWeight: 900, color: "#F8FAFC", letterSpacing: "-0.03em", marginBottom: "0.75rem" }}>
              Planes Transparentes para tu Agencia
            </h2>
            <p style={{ fontSize: "1rem", color: "#94A3B8", marginBottom: "3rem" }}>
              Sin contratos forzosos. Cancela o cambia de plan en cualquier momento.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1.5rem", alignItems: "stretch" }}>
              {/* Free */}
              <div className="glass-card-dark" style={{ padding: "2rem", position: "relative", display: "flex", flexDirection: "column", height: "100%", textAlign: "left" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", textAlign: "center" }}>
                  Free
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#F8FAFC", marginBottom: "0.25rem", textAlign: "center" }}>
                  $0<span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748B" }}> /mes</span>
                </div>
                <ul style={{ listStyle: "none", padding: "1.5rem 0", margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Hasta 25 clientes</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>1 Asesor colaborador</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>WhatsApp Cloud API (100 msgs/mes)</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Soporte comunitario</span></li>
                </ul>
                <Link id="plan-free-btn" className="glossy-pill-btn" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.88rem", marginTop: "auto", textDecoration: "none" }} href="/register">
                  Empezar Gratis
                </Link>
              </div>

              {/* Starter */}
              <div className="glass-card-dark" style={{ padding: "2rem", position: "relative", display: "flex", flexDirection: "column", height: "100%", textAlign: "left" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", textAlign: "center" }}>
                  Starter
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#F8FAFC", marginBottom: "0.25rem", textAlign: "center" }}>
                  $49<span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748B" }}> /mes</span>
                </div>
                <ul style={{ listStyle: "none", padding: "1.5rem 0", margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Hasta 300 clientes</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>3 Asesores incluidos</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>WhatsApp Cloud API ilimitado</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Pipeline Kanban de ventas</span></li>
                </ul>
                <Link id="plan-starter-btn" className="glossy-pill-btn" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.88rem", marginTop: "auto", textDecoration: "none" }} href="/register">
                  Comenzar Prueba
                </Link>
              </div>

              {/* Pro (Featured) */}
              <div
                className="glass-card-dark"
                style={{
                  padding: "2rem",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  textAlign: "left",
                  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(255, 255, 255, 0.2), 0 0 40px rgba(13, 148, 136, 0.25)",
                  border: "1px solid rgba(13, 148, 136, 0.5)",
                }}
              >
                <div className="glass-badge glass-badge-info" style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", padding: "0.3rem 1rem" }}>
                  MÁS POPULAR
                </div>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#60A5FA", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", textAlign: "center" }}>
                  Pro
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#F8FAFC", marginBottom: "0.25rem", textAlign: "center" }}>
                  $99<span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748B" }}> /mes</span>
                </div>
                <ul style={{ listStyle: "none", padding: "1.5rem 0", margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Hasta 1,500 clientes</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Hasta 10 Asesores colaboradores</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Agente IA & Matching Inteligente</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Google Calendar & Visitas</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Integración con Instagram DM</span></li>
                </ul>
                <Link id="plan-pro-btn" className="glossy-blue-btn" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.88rem", marginTop: "auto", textDecoration: "none" }} href="/register">
                  Comenzar Prueba Pro
                </Link>
              </div>

              {/* Enterprise */}
              <div className="glass-card-dark" style={{ padding: "2rem", position: "relative", display: "flex", flexDirection: "column", height: "100%", textAlign: "left" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", textAlign: "center" }}>
                  Enterprise
                </div>
                <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#F8FAFC", marginBottom: "0.25rem", textAlign: "center" }}>
                  $199<span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748B" }}> /mes</span>
                </div>
                <ul style={{ listStyle: "none", padding: "1.5rem 0", margin: 0, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Clientes e inmuebles ilimitados</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Asesores ilimitados</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Infraestructura Cloud dedicada</span></li>
                  <li style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.88rem", color: "#CBD5E1" }}><span style={{ color: "#00E5FF", fontWeight: 700 }}>✓</span><span>Soporte técnico prioritario 24/7</span></li>
                </ul>
                <Link id="plan-enterprise-btn" className="glossy-pill-btn" style={{ display: "block", textAlign: "center", padding: "0.75rem", fontSize: "0.88rem", marginTop: "auto", textDecoration: "none" }} href="/register">
                  Contactar Ventas
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" style={{ padding: "5rem 1.5rem", maxWidth: "900px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", fontWeight: 900, color: "#F8FAFC", letterSpacing: "-0.03em", marginBottom: "0.75rem" }}>
              Preguntas Frecuentes
            </h2>
            <p style={{ fontSize: "1rem", color: "#94A3B8" }}>Resuelve tus dudas sobre las capacidades y funcionamiento de Inmox</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="glass-card-dark" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                ¿Cómo funciona el Agente de IA y el Matching de propiedades?
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                El agente de IA cualifica al cliente detectando sus necesidades (presupuesto, ubicación, recámaras, renta o venta) y ejecuta un algoritmo de scoring en tiempo real para recomendar de forma precisa las propiedades de tu inventario.
              </p>
            </div>

            <div className="glass-card-dark" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                ¿Requiero aprobación de Meta para usar WhatsApp Cloud API?
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Inmox incluye la integración oficial mediante Embedded Signup. Cada agencia conecta su propio número oficial de WhatsApp en menos de 5 minutos sin compartir contraseñas.
              </p>
            </div>

            <div className="glass-card-dark" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                ¿Mis datos y los de mis clientes están aislados de otras agencias?
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Sí, implementamos una arquitectura Multi-Tenant estricta. Toda consulta, archivo e historial de chat está aislado por organization_id con cifrado AES-256-GCM en reposo.
              </p>
            </div>

            <div className="glass-card-dark" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                ¿Puedo conectar el Google Calendar de cada asesor de mi equipo?
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6 }}>
                Sí, cada asesor puede conectar su propia cuenta de Google Calendar. El motor calcula las horas hábiles y los huecos libres restando los eventos ocupados para agendar visitas sin solapamientos.
              </p>
            </div>
          </div>
        </section>

        {/* EMPRESA SECTION */}
        <section id="empresa" style={{ padding: "5rem 1.5rem 2rem", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "3rem" }}>
              <div className="glass-badge glass-badge-info" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 1rem", fontSize: "0.78rem", marginBottom: "1rem" }}>
                🏢 Datos Corporativos & Redes Oficiales
              </div>
              <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.75rem" }}>
                TELECOMUNICACIONES OPORTUNAS INTELIGENTES S.R.L.
              </h2>
              <p style={{ color: "#94A3B8", fontSize: "0.95rem", maxWidth: "650px", margin: "0 auto" }}>
                Desarrolladores de soluciones tecnológicas de vanguardia e infraestructura SaaS. Conoce nuestra información oficial y canales directos.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
              {/* Card 1 */}
              <div className="glass-card-dark" style={{ padding: "1.75rem", borderRadius: "20px" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🏛️</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                  Razón Social & NIT
                </h3>
                <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "1rem" }}>
                  <strong style={{ color: "#F8FAFC" }}>TELECOMUNICACIONES OPORTUNAS INTELIGENTES S.R.L.</strong>
                </p>
                <div className="glass-input-dark" style={{ padding: "0.6rem 0.85rem", borderRadius: "12px", fontSize: "0.82rem", color: "#38BDF8", fontWeight: 700 }}>
                  NIT: 305020028
                </div>
              </div>

              {/* Card 2 */}
              <div className="glass-card-dark" style={{ padding: "1.75rem", borderRadius: "20px" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📍</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                  Oficina Principal
                </h3>
                <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "1rem" }}>
                  Av. Juan Pablo II Nº 30, Edificio San Juan de Dios, Piso 2, Oficina 22 (Zona Villa Tunari).<br />
                  <strong style={{ color: "#F8FAFC" }}>El Alto, Bolivia</strong>
                </p>
                <div className="glass-input-dark" style={{ padding: "0.6rem 0.85rem", borderRadius: "12px", fontSize: "0.82rem", color: "#34D399", fontWeight: 700 }}>
                  📞 Teléfono: +591 69926886
                </div>
              </div>

              {/* Card 3 */}
              <div className="glass-card-dark" style={{ padding: "1.75rem", borderRadius: "20px" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🌐</div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                  Redes Sociales Oficiales
                </h3>
                <p style={{ fontSize: "0.88rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "1rem" }}>
                  Conéctate con nosotros en nuestras plataformas para novedades y soporte:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <a
                    href="https://www.facebook.com/toielaltointernet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-input-dark"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "12px",
                      fontSize: "0.82rem",
                      color: "#60A5FA",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Facebook (@toielaltointernet)
                  </a>
                  <a
                    href="https://www.tiktok.com/@toi.internet?_t=ZM-8sjbOZErT9B&_r=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-input-dark"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "12px",
                      fontSize: "0.82rem",
                      color: "#F472B6",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.31 1.56-1.3 2.56.02.97.55 1.89 1.39 2.37.9.52 2.06.52 2.94-.01.88-.53 1.38-1.53 1.39-2.55.03-3.64.01-7.29.02-10.93z" />
                    </svg>
                    TikTok (@toi.internet)
                  </a>
                  <a
                    href="https://wa.me/59169926886"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-input-dark"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "12px",
                      fontSize: "0.82rem",
                      color: "#4ADE80",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                    </svg>
                    WhatsApp directo (+591 69926886)
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACTO SECTION (#contacto) */}
        <section id="contacto" style={{ padding: "3rem 1.5rem 5rem", position: "relative", zIndex: 1 }}>
          <div
            style={{
              maxWidth: "1000px",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "3rem",
            }}
          >
            {/* Card 1: Mantente Actualizado */}
            <div className="glass-card-dark" style={{ padding: "2rem" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Mantente Actualizado
              </h2>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", marginBottom: "1.5rem", lineHeight: 1.5 }}>
                Recibe novedades sobre nuevas funcionalidades, mejoras de la plataforma y tips de gestión para tu agencia inmobiliaria.
              </p>
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: "0.75rem" }}>
                <input
                  id="newsletter-email-input"
                  type="email"
                  placeholder="tu@email.com"
                  className="glass-input-dark"
                  style={{ flex: 1, padding: "0.75rem 1rem" }}
                  required
                />
                <button
                  id="newsletter-submit-btn"
                  type="submit"
                  className="glossy-blue-btn"
                  style={{ padding: "0.75rem 1.5rem", whiteSpace: "nowrap", borderRadius: "12px", border: "none", cursor: "pointer" }}
                >
                  Suscribir
                </button>
              </form>
            </div>

            {/* Card 2: Contacto Directo */}
            <div className="glass-card-dark" style={{ padding: "2rem" }}>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F8FAFC", marginBottom: "0.5rem" }}>
                Contacto Directo
              </h2>
              <p style={{ fontSize: "0.88rem", color: "#94A3B8", marginBottom: "1.5rem", lineHeight: 1.5 }}>
                ¿Tienes dudas específicas sobre Inmox? Nuestro equipo técnico y comercial responde en menos de 24 horas.
              </p>
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <input
                  id="contact-name-input"
                  type="text"
                  placeholder="Tu nombre"
                  className="glass-input-dark"
                  style={{ padding: "0.75rem 1rem" }}
                  required
                />
                <input
                  id="contact-email-input"
                  type="email"
                  placeholder="tu@email.com"
                  className="glass-input-dark"
                  style={{ padding: "0.75rem 1rem" }}
                  required
                />
                <textarea
                  id="contact-message-input"
                  placeholder="Tu mensaje..."
                  className="glass-input-dark"
                  style={{ padding: "0.75rem 1rem", minHeight: "80px", resize: "vertical" }}
                  required
                />
                <button
                  id="contact-submit-btn"
                  type="submit"
                  className="glossy-blue-btn"
                  style={{ padding: "0.75rem 1.5rem", width: "100%", justifyContent: "center", borderRadius: "12px", border: "none", cursor: "pointer" }}
                >
                  Enviar Mensaje
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            padding: "4rem 1.5rem 2rem",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            zIndex: 1,
            backgroundColor: "#040507",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "2.5rem",
                marginBottom: "3rem",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #0d9488 0%, #00e5ff 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      color: "#000000",
                      fontSize: "1rem",
                    }}
                  >
                    I
                  </div>
                  <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC" }}>Inmox</span>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "1rem" }}>
                  Desarrollado para TELECOMUNICACIONES OPORTUNAS INTELIGENTES S.R.L. Plataforma integral de CRM inmobiliario multi-tenant y automatización por WhatsApp Cloud API.
                </p>
                <div style={{ fontSize: "0.78rem", color: "#64748B" }}>NIT: 305020028</div>
              </div>

              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Navegación
                </h4>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <li><a href="#features" style={{ fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>Módulos & Funcionalidades</a></li>
                  <li><a href="#pricing" style={{ fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>Planes & Precios</a></li>
                  <li><a href="#faq" style={{ fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>Preguntas Frecuentes</a></li>
                  <li><a href="#empresa" style={{ fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>Datos Corporativos</a></li>
                  <li><Link href="/login" style={{ fontSize: "0.85rem", color: "#00E5FF", textDecoration: "none", fontWeight: 700 }}>Iniciar Sesión</Link></li>
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Contacto & Ubicación
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#94A3B8", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                  📍 Av. Juan Pablo II Nº 30, Edif. San Juan de Dios, Piso 2, Of. 22 (Zona Villa Tunari)
                </p>
                <p style={{ fontSize: "0.85rem", color: "#94A3B8", marginBottom: "0.5rem" }}>📍 El Alto, Bolivia</p>
                <p style={{ fontSize: "0.85rem", color: "#34D399", fontWeight: 600 }}>📞 Teléfono: +591 69926886</p>
              </div>

              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F8FAFC", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Redes Sociales
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <a href="https://www.facebook.com/toielaltointernet" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>
                    <svg width="18" height="18" fill="#1877F2" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                    <span>Facebook Oficial</span>
                  </a>
                  <a href="https://www.tiktok.com/@toi.internet?_t=ZM-8sjbOZErT9B&_r=1" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>
                    <svg width="18" height="18" fill="#EE1D52" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.31 1.56-1.3 2.56.02.97.55 1.89 1.39 2.37.9.52 2.06.52 2.94-.01.88-.53 1.38-1.53 1.39-2.55.03-3.64.01-7.29.02-10.93z" /></svg>
                    <span>TikTok Oficial</span>
                  </a>
                  <a href="https://wa.me/59169926886" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.85rem", color: "#94A3B8", textDecoration: "none" }}>
                    <svg width="18" height="18" fill="#25D366" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" /></svg>
                    <span>WhatsApp Soporte</span>
                  </a>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <span style={{ fontSize: "0.82rem", color: "#64748B" }}>© 2026 TELECOMUNICACIONES OPORTUNAS INTELIGENTES S.R.L. Todos los derechos reservados.</span>
              <div style={{ display: "flex", gap: "1.5rem" }}>
                <Link href="/terminos" style={{ fontSize: "0.82rem", color: "#94A3B8", textDecoration: "none" }}>Términos</Link>
                <Link href="/privacidad" style={{ fontSize: "0.82rem", color: "#94A3B8", textDecoration: "none" }}>Privacidad</Link>
                <Link href="/eliminacion-de-datos" style={{ fontSize: "0.82rem", color: "#94A3B8", textDecoration: "none" }}>Eliminación de Datos</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
