import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useAdultoVinculado } from "../../hooks/useAdultoVinculado";
import { EncabezadoPagina } from "../../components/base/EncabezadoPagina";
import { Tarjeta } from "../../components/base/Tarjeta";
import { Boton } from "../../components/base/Boton";
import s from "./CaregiverHomePage.module.css";

// [PROVISORIO] Resuelve la vinculación y da acceso a las tareas. El inicio real del
// cuidador (estado, alertas, presión) se implementa en su propio commit.
export function CaregiverHomePage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const vinculo = useAdultoVinculado(appUser?.uid);

  if (vinculo.tipo === "sinVinculo") return <Navigate to="/link" replace />;

  return (
    <div className={s.pagina}>
      <EncabezadoPagina titulo={`Hola, ${appUser?.name ?? ""}`} />
      {vinculo.tipo === "cargando" && <p>Cargando…</p>}
      {vinculo.tipo === "error" && <p role="alert">No se pudo cargar la información. Revisa tu conexión.</p>}
      {vinculo.tipo === "vinculado" && (
        <>
          <Tarjeta>
            <p>
              Estás vinculado con <strong>{vinculo.nombre}</strong>.
            </p>
          </Tarjeta>
          <Boton bloque onClick={() => navigate("/caregiver/tasks")}>
            Ver tareas de hoy
          </Boton>
          <Boton variante="secundario" bloque className={s.botonSiguiente} onClick={() => navigate("/caregiver/perfil")}>
            Perfil y metas
          </Boton>
        </>
      )}
    </div>
  );
}
