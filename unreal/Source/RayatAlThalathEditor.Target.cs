using UnrealBuildTool;
public class RayatAlThalathEditorTarget : TargetRules {
  public RayatAlThalathEditorTarget(TargetInfo Target) : base(Target) {
    Type = TargetType.Editor; DefaultBuildSettings = BuildSettingsVersion.V5; IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
    ExtraModuleNames.Add("RayatAlThalath");
  }
}
