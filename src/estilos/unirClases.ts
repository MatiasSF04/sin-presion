/** Une nombres de clase, ignorando los valores falsos: unirClases("a", activo && "b"). */
export function unirClases(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}
