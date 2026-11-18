/* =========================================================
   Inspección Visual PWA — JavaScript Vanilla
   Sin async/await: toda la asincronía usa .then/.catch/.finally
   ========================================================= */

/* ---------- Referencias al DOM ---------- */
const visorVideo = document.getElementById('visor-camara');
const mensajeEstado = document.getElementById('mensaje-estado');
const btnInstalar = document.getElementById('btn-instalar');
const btnPreparar = document.getElementById('btn-preparar-camara');
const avisoPermiso = document.getElementById('aviso-permiso');
const avisoLente = document.getElementById('aviso-lente');
const btnConfirmar = document.getElementById('btn-confirmar-permiso');
const btnCancelar = document.getElementById('btn-cancelar-permiso');
const btnAlternar = document.getElementById('btn-alternar-camara');
const btnApagar = document.getElementById('btn-apagar-camara');

function actualizarMensajeEstado(texto) {
  mensajeEstado.textContent = texto;
}

/* =========================================================
   FASE 1 — Instalabilidad
   ========================================================= */

/* ---------- Registro del Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((registro) => {
        console.log('Service Worker activo. Ámbito:', registro.scope);
      })
      .catch((error) => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
}

/* ---------- Fragmento B: evento de instalación (Android/Chrome) ---------- */
let eventoInstalacionDiferido = null;

window.addEventListener('beforeinstallprompt', (event) => {
  // Evita que el mini-banner automático aparezca antes de tiempo
  event.preventDefault();
  eventoInstalacionDiferido = event;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;

  eventoInstalacionDiferido.prompt();

  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        btnInstalar.hidden = true;
      }
    })
    .catch((error) => {
      console.error('Error en el flujo de instalación:', error);
    })
    .finally(() => {
      // El evento solo puede usarse una vez
      eventoInstalacionDiferido = null;
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  eventoInstalacionDiferido = null;
});

/* ---------- Notas técnicas iOS: detección de plataforma y modo instalado ---------- */
function verificarEntornoIOS() {
  const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const estaInstalada = window.navigator.standalone === true ||
                        window.matchMedia('(display-mode: standalone)').matches;

  // Si está en iPhone y aún la ve desde el navegador, mostrar instrucciones manuales
  if (esIOS && !estaInstalada) {
    const guiaIOS = document.getElementById('instrucciones-ios');
    if (guiaIOS) guiaIOS.hidden = false;
  }
}
verificarEntornoIOS();

/* =========================================================
   FASE 2 — Pre-permiso y control de cámara
   ========================================================= */

let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal

function nombreLente(modo) {
  return modo === 'environment' ? 'trasera' : 'frontal';
}

function actualizarBotonesCamara(camaraEncendida) {
  btnAlternar.disabled = !camaraEncendida;
  btnApagar.disabled = !camaraEncendida;
}

/* ---------- Fragmento C: liberar hardware ---------- */
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

/* ---------- Fragmento D: encendido con Promesas y diagnóstico ---------- */
function iniciarCamara(modo) {
  // Obligatorio (sobre todo en iOS): liberar el sensor antes de pedir otro flujo
  detenerCamaraActiva();
  visorVideo.srcObject = null;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Este navegador no soporta acceso a la cámara (se requiere HTTPS).');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  actualizarMensajeEstado('Solicitando acceso a la cámara...');

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      actualizarBotonesCamara(true);
      actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
      // Algunos navegadores requieren play() explícito; se ignora si ya está reproduciendo
      const reproduccion = visorVideo.play();
      if (reproduccion && reproduccion.catch) reproduccion.catch(() => {});
    })
    .catch((error) => {
      actualizarBotonesCamara(false);
      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else if (error.name === 'NotReadableError') {
        actualizarMensajeEstado('La cámara está siendo usada por otra aplicación o no pudo liberarse. Intenta de nuevo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

/* ---------- Fragmento E: flujo de consentimiento previo ---------- */

// Paso 1: el usuario pulsa "Solicitar Acceso a Cámara" -> aviso explicativo
btnPreparar.addEventListener('click', () => {
  avisoLente.textContent = nombreLente(modoCamaraActual);
  avisoPermiso.hidden = false;
});

// Paso 2: el usuario lee el motivo y confirma -> recién ahora se pide el permiso nativo
btnConfirmar.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

// El usuario puede declinar sin que el navegador registre un bloqueo
btnCancelar.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('Acceso a cámara pospuesto. No se solicitó ningún permiso.');
});

/* ---------- Desafío 2: alternar lentes y apagar ---------- */
btnAlternar.addEventListener('click', () => {
  modoCamaraActual = (modoCamaraActual === 'environment') ? 'user' : 'environment';
  iniciarCamara(modoCamaraActual);
});

btnApagar.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarBotonesCamara(false);
  actualizarMensajeEstado('Cámara apagada.');
});

// Liberar la cámara si la app pasa a segundo plano o se cierra
window.addEventListener('pagehide', detenerCamaraActiva);
