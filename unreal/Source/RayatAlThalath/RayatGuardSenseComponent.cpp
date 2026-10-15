#include "RayatGuardSenseComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

URayatGuardSenseComponent::URayatGuardSenseComponent() { PrimaryComponentTick.bCanEverTick = true; }

bool URayatGuardSenseComponent::CanSee(const AActor* T, float& OutDist) const {
  const AActor* O = GetOwner(); if (!O || !T) return false;
  if (T->ActorHasTag(TEXT("Hidden"))) return false;                       // مختبئ في القش
  const FVector Eye = O->GetActorLocation() + FVector(0, 0, EyeHeight); const FVector TP = T->GetActorLocation();
  if (TP.Z > O->GetActorLocation().Z + RoofSafeHeight) return false;      // فوق الأسطح
  const FVector D = TP - Eye; OutDist = D.Size2D(); if (OutDist > Range) return false;
  const float Cos = FVector::DotProduct(O->GetActorForwardVector(), D.GetSafeNormal2D());
  if (Cos < FMath::Cos(FMath::DegreesToRadians(FovDeg * 0.5f)) && OutDist > 180.f) return false;
  FHitResult H; FCollisionQueryParams P(SCENE_QUERY_STAT(RayatSight), true, O); P.AddIgnoredActor(T);
  return !GetWorld()->LineTraceSingleByChannel(H, Eye, TP + FVector(0, 0, 100.f), ECC_Visibility, P);
}

void URayatGuardSenseComponent::TickComponent(float Dt, ELevelTick Tick, FActorComponentTickFunction* Fn) {
  Super::TickComponent(Dt, Tick, Fn);
  const APawn* Player = UGameplayStatics::GetPlayerPawn(this, 0); float Dist = 0.f;
  const bool Was = Suspicion >= 1.f; bSeesTarget = CanSee(Player, Dist);
  if (bSeesTarget) { Suspicion += Dt * (Dist < 400.f ? GainNear : GainFar); LastKnown = Player->GetActorLocation(); }
  else Suspicion -= Dt * Decay;
  Suspicion = FMath::Clamp(Suspicion, 0.f, 1.f);
  if (!Was && Suspicion >= 1.f) OnAlarm.Broadcast();
}
