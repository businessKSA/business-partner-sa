# مساعدات مشتركة لسكربتات الفريق. تُحمَّل بـ: source "$(dirname "$0")/_lib.sh"
set -euo pipefail
AGENTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$AGENTS_DIR/.." && pwd)"

need() { command -v "$1" >/dev/null 2>&1 || { echo "مطلوب: $1 غير مثبت. راجع agents/README.md" >&2; exit 1; }; }
need ant

# الأسرار المحلية (اختيارية لبعض السكربتات)
[ -f "$AGENTS_DIR/.env" ] && { set -a; . "$AGENTS_DIR/.env"; set +a; }
# المعرّفات المنشأة سابقًا
[ -f "$AGENTS_DIR/ids.env" ] && { set -a; . "$AGENTS_DIR/ids.env"; set +a; }

# يستبدل ${VAR} في ملف YAML بقيم البيئة الحالية (بديل envsubst حتى لا نعتمد على gettext)
render() {
  perl -pe 's/\$\{([A-Z_][A-Z0-9_]*)\}/exists $ENV{$1} ? $ENV{$1} : ""/ge' "$1"
}

save_id() { # save_id KEY VALUE  → يحدّث agents/ids.env
  local f="$AGENTS_DIR/ids.env"; touch "$f"
  if grep -q "^$1=" "$f"; then perl -pi -e "s|^$1=.*|$1=$2|" "$f"; else echo "$1=$2" >> "$f"; fi
  export "$1=$2"
}
