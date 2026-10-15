// بنى بيانات المراحل — تطابق unreal/Content/Data/levels.json الذي يُصدّره
// game/tools/export-levels.mjs من النموذج الأولي. تُحمَّل بـ URayatLevelLibrary::LoadLevels.
#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "RayatLevelData.generated.h"

USTRUCT(BlueprintType) struct FRayatSolid {
  GENERATED_BODY()
  UPROPERTY(BlueprintReadOnly) FString Kind;      // building | wall | tower | hay | stall
  UPROPERTY(BlueprintReadOnly) bool bClimbable = true;
  UPROPERTY(BlueprintReadOnly) FVector Center = FVector::ZeroVector;   // سم
  UPROPERTY(BlueprintReadOnly) FVector Extent = FVector::ZeroVector;   // نصف الأبعاد، سم
};
USTRUCT(BlueprintType) struct FRayatGuard {
  GENERATED_BODY()
  UPROPERTY(BlueprintReadOnly) float Range = 1200.f;
  UPROPERTY(BlueprintReadOnly) float FovDeg = 72.f;
  UPROPERTY(BlueprintReadOnly) TArray<FVector> Waypoints;
};
USTRUCT(BlueprintType) struct FRayatObjective {
  GENERATED_BODY()
  UPROPERTY(BlueprintReadOnly) FString Type;      // goto | roof | stealth | collect | hold
  UPROPERTY(BlueprintReadOnly) FText Text;
  UPROPERTY(BlueprintReadOnly) FText Label;
  UPROPERTY(BlueprintReadOnly) float Seconds = 0.f;
  UPROPERTY(BlueprintReadOnly) bool bAlarm = false;
  UPROPERTY(BlueprintReadOnly) FString Effect;
  UPROPERTY(BlueprintReadOnly) FVector Position = FVector::ZeroVector;
  UPROPERTY(BlueprintReadOnly) TArray<FVector> Items;
};
USTRUCT(BlueprintType) struct FRayatManuscript {
  GENERATED_BODY()
  UPROPERTY(BlueprintReadOnly) FString Id;
  UPROPERTY(BlueprintReadOnly) FText Title;
  UPROPERTY(BlueprintReadOnly) FText Fact;
  UPROPERTY(BlueprintReadOnly) FVector Position = FVector::ZeroVector;
};
USTRUCT(BlueprintType) struct FRayatLevel {
  GENERATED_BODY()
  UPROPERTY(BlueprintReadOnly) FString Id;
  UPROPERTY(BlueprintReadOnly) FText Title;
  UPROPERTY(BlueprintReadOnly) FText Era;
  UPROPERTY(BlueprintReadOnly) FString Time;      // day | dusk | dawn | night
  UPROPERTY(BlueprintReadOnly) FString Landmark;  // salwa | palace | masmak | kut
  UPROPERTY(BlueprintReadOnly) FVector Start = FVector::ZeroVector;
  UPROPERTY(BlueprintReadOnly) TArray<FRayatSolid> Solids;
  UPROPERTY(BlueprintReadOnly) TArray<FRayatGuard> Guards;
  UPROPERTY(BlueprintReadOnly) TArray<FRayatObjective> Objectives;
  UPROPERTY(BlueprintReadOnly) TArray<FRayatManuscript> Manuscripts;
};

UCLASS() class RAYATALTHALATH_API URayatLevelLibrary : public UBlueprintFunctionLibrary {
  GENERATED_BODY()
public:
  /** يقرأ Content/Data/levels.json ويعيد المراحل. */
  UFUNCTION(BlueprintCallable, Category="Rayat") static bool LoadLevels(TArray<FRayatLevel>& OutLevels);
};
