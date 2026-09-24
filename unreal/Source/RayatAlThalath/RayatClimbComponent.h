// مكوّن التسلّق: يُضاف إلى شخصية Game Animation Sample. يكشف الجدار أمام اللاعب
// بثلاثة مسارات تتبّع (صدر، رأس، فوق الرأس)، ويجد الحافة، ويحرّك الشخصية إليها.
// حركة التسلّق نفسها تُعطى لـ Motion Matching عبر تفعيل حالة Climb في الـ Chooser.
#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "RayatClimbComponent.generated.h"

UENUM(BlueprintType) enum class ERayatClimbState : uint8 { Ground, Climbing, Mantling };

UCLASS(ClassGroup=(Rayat), meta=(BlueprintSpawnableComponent))
class RAYATALTHALATH_API URayatClimbComponent : public UActorComponent {
  GENERATED_BODY()
public:
  URayatClimbComponent();
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Climb") float WallProbeDistance = 90.f;   // سم
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Climb") float ClimbSpeed = 320.f;        // سم/ث
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Climb") float MaxLedgeHeight = 1500.f;   // ارتفاع أقصى لبحث الحافة
  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Climb") float MinWallDot = 0.7f;         // مواجهة الجدار
  UPROPERTY(BlueprintReadOnly, Category="Climb") ERayatClimbState State = ERayatClimbState::Ground;
  UPROPERTY(BlueprintReadOnly, Category="Climb") FVector WallNormal = FVector::ZeroVector;
  UPROPERTY(BlueprintReadOnly, Category="Climb") FVector LedgePoint = FVector::ZeroVector;

  /** يُستدعى عند ضغط القفز: إن كان أمامه جدار قابل للتسلّق يبدأ التسلّق ويعيد true. */
  UFUNCTION(BlueprintCallable, Category="Climb") bool TryStartClimb();
  UFUNCTION(BlueprintCallable, Category="Climb") void StopClimb();
  virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
private:
  bool ProbeWall(FHitResult& OutHit) const;
  bool FindLedge(const FHitResult& WallHit, FVector& OutLedge) const;
};
