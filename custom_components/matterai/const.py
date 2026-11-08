"""Constantes de la integración MatterAI."""

DOMAIN = "matterai"
VERSION = "2.27.1"

# Configuración del dashboard (lo que antes era el YAML del panel)
STORAGE_KEY = f"{DOMAIN}.dashboard"
STORAGE_VERSION = 1
# Datos de la casa: usuario de la app, su acceso y el id para el panel central
STORAGE_HOUSE_KEY = f"{DOMAIN}.house"

# Archivos que sirve la integración
STATIC_URL = f"/{DOMAIN}_static"
CARD_FILENAME = "matterai-home-card.js"
PANEL_FILENAME = "matterai-panel.js"
CARD_URL = f"{STATIC_URL}/{CARD_FILENAME}"
LOADER_FILENAME = "matterai-loader.js"  # carga siempre la última versión de la tarjeta y del panel

# Panel sólo para el instalador (administradores)
PANEL_URL_PATH = "matterai"
PANEL_ELEMENT = "matterai-admin-panel"
PANEL_TITLE = "MatterAI"
PANEL_ICON = "mdi:home-lightning-bolt-outline"

# Usuario con el que se conecta la app de los clientes (sin permisos de administrador)
APP_USER_NAME = "App MatterAI"
APP_CLIENT_NAME = "MatterAI App"

# Desde dónde abre la app: Home Assistant tiene que permitirlo (CORS)
APP_ORIGINS = ["https://app.matterai.com.ar", "capacitor://app.matterai.com.ar", "http://localhost:5500"]  # Android/web, iPhone (Capacitor) y pruebas

# Opciones de la configuración
CONF_NAME = "name"
CONF_URL = "url"
CONF_SUPPORT = "support_phone"
CONF_CENTRAL_URL = "central_url"
CONF_CENTRAL_KEY = "central_key"
CONF_VOICE_MODE = "voice_mode"  # off · local (gratis) · auto (gratis + IA si no entiende) · ai
CONF_LOCAL_URL = "local_url"  # dirección dentro de la casa (http://192.168.x.x:8123): la app la usa en el wifi de la casa
CONF_WIFI = "wifi"  # nombres de las redes wifi de la casa, separados por coma
CONF_AI_KEY = "ai_key"  # clave de Anthropic para el control por voz (opcional)

DEFAULT_CENTRAL_URL = "https://panel.matterai.com.ar"
HEARTBEAT_MINUTES = 5

SIGNAL_CONFIG = f"{DOMAIN}_config_updated"
