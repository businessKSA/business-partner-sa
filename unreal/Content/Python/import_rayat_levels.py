"""يستورد مراحل النموذج الأولي إلى Unreal.
داخل المحرّر: Tools → Execute Python Script → هذا الملف، أو من Output Log:
    py "C:/path/RayatAlThalath/Content/Python/import_rayat_levels.py" masmak1902dawn
يُنشئ Actors مؤقتة (مكعّبات) لكل صندوق في المدينة، وTargetPoints لمسارات الحرّاس،
وعلامات للأهداف والمخطوطات. بعدها تُستبدل المكعّبات بأصول Megascans عبر PCG.
"""
import json, os, sys, unreal

LEVEL_ID = sys.argv[1] if len(sys.argv) > 1 else "masmak1902dawn"
DATA = os.path.join(unreal.Paths.project_content_dir(), "Data", "levels.json")
CUBE = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cube.Cube")   # 100 سم
MAT_CLAY = unreal.EditorAssetLibrary.load_asset("/Game/Materials/M_NajdiClay") if unreal.EditorAssetLibrary.does_asset_exist("/Game/Materials/M_NajdiClay") else None

with open(DATA, encoding="utf-8") as f: levels = json.load(f)["levels"]
lv = next((l for l in levels if l["id"] == LEVEL_ID), None)
if not lv: raise SystemExit(f"level {LEVEL_ID} not found; ids: {[l['id'] for l in levels]}")

sub = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
folder = f"Rayat/{lv['id']}"
def V(d): return unreal.Vector(d["x"], d["y"], d["z"])

# المدينة
for i, s in enumerate(lv["solids"]):
    a = sub.spawn_actor_from_class(unreal.StaticMeshActor, V(s["center"]))
    a.static_mesh_component.set_static_mesh(CUBE)
    a.set_actor_scale3d(unreal.Vector(s["extent"]["x"] / 50.0, s["extent"]["y"] / 50.0, s["extent"]["z"] / 50.0))
    a.set_actor_label(f"{s['kind']}_{i:03d}"); a.set_folder_path(f"{folder}/City")
    a.tags = [unreal.Name(s["kind"])] + ([] if s["climbable"] else [unreal.Name("NoClimb")])
    if MAT_CLAY and s["kind"] in ("building", "wall", "tower"): a.static_mesh_component.set_material(0, MAT_CLAY)

# مسارات الحرّاس
for gi, g in enumerate(lv["guards"]):
    for wi, w in enumerate(g["waypoints"]):
        t = sub.spawn_actor_from_class(unreal.TargetPoint, V(w))
        t.set_actor_label(f"Guard{gi:02d}_WP{wi}"); t.set_folder_path(f"{folder}/Guards"); t.tags = [unreal.Name(f"guard{gi}")]

# الأهداف والمخطوطات وبداية اللاعب
for oi, o in enumerate(lv["objectives"]):
    pts = o["items"] if o["type"] == "collect" else [o["position"]]
    for pi, p in enumerate(pts):
        t = sub.spawn_actor_from_class(unreal.TargetPoint, V(p))
        t.set_actor_label(f"Obj{oi}_{o['type']}_{pi}"); t.set_folder_path(f"{folder}/Objectives"); t.tags = [unreal.Name("objective"), unreal.Name(o["type"])]
for m in lv["manuscripts"]:
    t = sub.spawn_actor_from_class(unreal.TargetPoint, V(m["position"])); t.set_actor_label(f"Manuscript_{m['id']}"); t.set_folder_path(f"{folder}/Manuscripts")
ps = sub.spawn_actor_from_class(unreal.PlayerStart, V(lv["start"])); ps.set_folder_path(folder)
unreal.log(f"Rayat: imported {lv['id']} — {len(lv['solids'])} solids, {len(lv['guards'])} guards, {len(lv['objectives'])} objectives")
