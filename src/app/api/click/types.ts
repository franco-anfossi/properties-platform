// Contrato HTTP de POST /api/click.

export interface ClickRequestBody {
  externalId: string; // id de la publicación clickeada
  url: string; // URL original del portal a la que apunta el resultado
  sessionId?: string | null; // recorrido al que pertenece el click (viene del /api/search)
}
