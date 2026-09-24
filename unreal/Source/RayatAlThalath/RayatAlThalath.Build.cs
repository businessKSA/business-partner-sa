using UnrealBuildTool;
public class RayatAlThalath : ModuleRules {
  public RayatAlThalath(ReadOnlyTargetRules Target) : base(Target) {
    PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
    PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore", "AIModule", "NavigationSystem", "Json", "JsonUtilities" });
  }
}
