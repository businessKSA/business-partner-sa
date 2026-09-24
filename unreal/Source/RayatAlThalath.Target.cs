using UnrealBuildTool;
public class RayatAlThalathTarget : TargetRules {
  public RayatAlThalathTarget(TargetInfo Target) : base(Target) {
    Type = TargetType.Game; DefaultBuildSettings = BuildSettingsVersion.V5; IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_5;
    ExtraModuleNames.Add("RayatAlThalath");
  }
}
