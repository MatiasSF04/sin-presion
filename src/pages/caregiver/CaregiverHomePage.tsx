import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { obtenerAdultoVinculado } from "../../services/link.service";
import { fetchAppUser } from "../../services/auth.service";
import s from "./CaregiverHomePage.module.css";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "sinVinculo" }
  | { tipo: "vinculado"; nombre: string }
  | { tipo: "error" };

// [PROVISORIO] Solo resuelve la vinculación. El inicio real del cuidador
// (estado, alertas, presión y tareas) se implementa en su propio commit.
export function CaregiverHomePage() {
  const { appUser } = useAuth();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });

  useEffect(() => {
    if (!appUser) return;
    let activo = true;
    (async () => {
      try {
        const elderUid = await obtenerAdultoVinculado(appUser.uid);
        if (!activo) return;
        if (!elderUid) return setEstado({ tipo: "sinVinculo" });
        const adulto = await fetchAppUser(elderUid);
        if (activo) setEstado({ tipo: "vinculado", nombre: adulto.name });
      } catch {
        if (activo) setEstado({ tipo: "error" });
      }
    })();
    return () => {
      activo = false;
    };
  }, [appUser]);

  if (estado.tipo === "sinVinculo") return <Navigate to="/link" replace />;

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo={`Hola, ${appUser?.name ?? ""}`} />
      {estado.tipo === "cargando" && <p>Cargando…</p>}
      {estado.tipo === "error" && <p role="alert">No se pudo cargar la información. Revisa tu conexión.</p>}
      {estado.tipo === "vinculado" && (
        <Tarjeta>
          <p>
            Estás vinculado con <strong>{estado.nombre}</strong>.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
