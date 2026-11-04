"""Configuración de las pruebas."""

import asyncio
import sys

import pytest_socket

pytest_plugins = "pytest_homeassistant_custom_component"

# En Windows, el bucle de asyncio necesita un socket interno (socketpair) para arrancar.
# El complemento de HA bloquea todos los sockets: acá se deja pasar sólo eso (no hay red real).
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    pytest_socket.disable_socket = lambda *args, **kwargs: None
    pytest_socket.socket_allow_hosts = lambda *args, **kwargs: None


if sys.platform == "win32":
    import pytest

    @pytest.fixture(scope="session")
    def event_loop_policy():
        """aiodns (usado por el cliente web de HA) necesita SelectorEventLoop en Windows."""
        return asyncio.WindowsSelectorEventLoopPolicy()

    # y el cliente web de las pruebas usa el resolvedor de DNS común (aiodns no anda con ese bucle en Windows)
    import aiohttp
    import aiohttp.connector
    import aiohttp.resolver

    aiohttp.resolver.DefaultResolver = aiohttp.resolver.ThreadedResolver
    aiohttp.connector.DefaultResolver = aiohttp.resolver.ThreadedResolver
    aiohttp.resolver.AsyncResolver = aiohttp.resolver.ThreadedResolver
    aiohttp.AsyncResolver = aiohttp.resolver.ThreadedResolver


if sys.platform == "win32":
    # pymicro-vad / pyspeex-noise (voz de HA) no se compilan en Windows; mobile_app los importa de rebote.
    # En Linux (CI) están instalados de verdad: esto sólo deja correr las pruebas en una PC con Windows.
    import types

    for _mod in ("pymicro_vad", "pyspeex_noise"):
        try:
            __import__(_mod)
        except ImportError:
            _stub = types.ModuleType(_mod)
            _stub.MicroVad = _stub.AudioProcessor = object
            sys.modules[_mod] = _stub
