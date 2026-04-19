import React from "react";

export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "32px",
        fontFamily:
          "Inter, DM Sans, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background:
          "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f5f3ff 100%)",
        color: "#111827",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "20px",
            padding: "32px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <span
            style={{
              display: "inline-block",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "#ede9fe",
              color: "#5b21b6",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            SereniAI
          </span>

          <h1
            style={{
              margin: "0 0 12px 0",
              fontSize: "40px",
              lineHeight: 1.1,
            }}
          >
            Mockup Sandbox funcionando
          </h1>

          <p
            style={{
              margin: "0 0 24px 0",
              fontSize: "18px",
              lineHeight: 1.6,
              color: "#4b5563",
            }}
          >
            El proyecto ya tiene un punto de entrada válido para Vite + React.
            El siguiente paso es conectar acá tus componentes reales y armar el
            MVP.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                Estado actual
              </h2>
              <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.5 }}>
                El build ya no debería fallar por falta de <code>main.tsx</code>.
              </p>
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                Próximo paso
              </h2>
              <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.5 }}>
                Reemplazar este contenido por tu interfaz real.
              </p>
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
                Base limpia
              </h2>
              <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.5 }}>
                Ya queda separada la entrada React en <code>main.tsx</code> y la
                UI en <code>App.tsx</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}