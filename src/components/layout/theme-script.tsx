// Script inline que corre ANTES del primer paint para fijar `data-theme`
// según localStorage o, si no hay preferencia guardada, el sistema.
// Evita el flash de tema incorrecto (FOUC). Se inyecta en el <head>.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
