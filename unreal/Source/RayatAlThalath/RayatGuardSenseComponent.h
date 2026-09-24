// حاسّة الحارس: مخروط رؤية + خط نظر + مقياس شُبهة يطابق منطق النموذج الأولي.
// يُضاف إلى Pawn الحارس؛ الذكاء (الدوريات والمطاردة) في Behavior Tree يقرأ Suspicion وbSeesTarget.
#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "RayatGuardSenseComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FRayatAlarmRaised);

UCLASS(ClassGroup=(Rayat), meta=(BlueprintSpawnableComponent))
class RAYATALTHALATH_API URayatGuardSenseComponent : public UActorComponent {
  GENERATED_BODY()
public:
  URayatGuardSenseComponent();
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Sense") float Range = 1200.f;
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Sense") float FovDeg = 72.f;
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Sense") float EyeHeight = 130.f;
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Sense") float RoofSafeHeight = 240.f;  // فوقه لا يُرى اللاعب
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Sense") float GainNear = 1.6f, GainFar = 0.7f, Decay = 0.35f;
  UPROPERTY(BlueprintReadOnly, Category="Sense") float Suspicion = 0.f;
  UPROPERTY(BlueprintReadOnly, Category="Sense") bool bSeesTarget = false;
  UPROPERTY(BlueprintReadOnly, Category="Sense") FVector LastKnown = FVector::ZeroVector;
  UPROPERTY(BlueprintAssignable, Category="Sense") FRayatAlarmRaised OnAlarm;
  virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
private:
  bool CanSee(const AActor* Target, float& OutDist) const;
};
