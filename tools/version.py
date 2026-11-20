"""Cambia la versión de MatterAI en TODOS lados: const.py, manifest.json y las pantallas (editor y panel),
que la comparan con la de Home Assistant para avisar si falta reiniciarlo.

    python tools/version.py 2.37.0
"""
import io
import re
import sys

ROOT = __file__.rsplit("tools", 1)[0] + "custom_components/matterai/"
FILES = {
    "const.py": (r'^VERSION = "[^"]+"', 'VERSION = "{v}"'),
    "manifest.json": (r'"version": "[^"]+"', '"version": "{v}"'),
    "frontend/matterai-editor.js": (r"const FRONT_VERSION = '[^']+';", "const FRONT_VERSION = '{v}';"),
    "frontend/matterai-panel.js": (r"const FRONT_VERSION = '[^']+';", "const FRONT_VERSION = '{v}';"),
}


def main(v: str) -> None:
    if not re.match(r"^\d+\.\d+\.\d+$", v):
        raise SystemExit("La versión es X.Y.Z")
    for name, (pat, rep) in FILES.items():
        path = ROOT + name
        s = io.open(path, encoding="utf-8", newline="").read()
        s2, n = re.subn(pat, rep.format(v=v), s, count=1, flags=re.M)
        if n != 1:
            raise SystemExit(f"No encontré la versión en {name}")
        io.open(path, "w", encoding="utf-8", newline="").write(s2)
    print(f"Versión {v} en {', '.join(FILES)}")


if __name__ == "__main__":
    main(sys.argv[1])
