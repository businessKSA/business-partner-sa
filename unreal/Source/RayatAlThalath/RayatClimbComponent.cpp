#include "RayatClimbComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/CapsuleComponent.h"
#include "Engine/World.h"

URayatClimbComponent::URayatClimbComponent() { PrimaryComponentTick.bCanEverTick = true; }

bool URayatClimbComponent::ProbeWall(FHitResult& OutHit) const {
  const ACharacter* C = Cast<ACharacter>(GetOwner()); if (!C) return false;
  const FVector Fwd = C->GetActorForwardVector(); const FVector Base = C->GetActorLocation();
  FCollisionQueryParams P(SCENE_QUERY_STAT(RayatClimb), false, C);
  for (float Z : { 0.f, 60.f, 120.f }) { // صدر، رأس، فوق الرأس
    const FVector S = Base + FVector(0, 0, Z); if (GetWorld()->LineTraceSingleByChannel(OutHit, S, S + Fwd * WallProbeDistance, ECC_Visibility, P)) {
      if (FVector::DotProduct(-OutHit.ImpactNormal, Fwd) >= MinWallDot && FMath::Abs(OutHit.ImpactNormal.Z) < 0.3f) return true; } }
  return false;
}

bool URayatClimbComponent::FindLedge(const FHitResult& WallHit, FVector& OutLedge) const {
  // نصعد على طول الجدار حتى ينقطع التتبّع، ثم نتتبّع لأسفل لإيجاد سطح الحافة.
  const ACharacter* C = Cast<ACharacter>(GetOwner()); if (!C) return false;
  FCollisionQueryParams P(SCENE_QUERY_STAT(RayatLedge), false, C);
  const FVector Into = -WallHit.ImpactNormal; FVector Probe = WallHit.ImpactPoint + WallHit.ImpactNormal * 20.f;
  const float Step = 40.f; FHitResult H;
  for (float Z = 0; Z <= MaxLedgeHeight; Z += Step) {
    const FVector S = Probe + FVector(0, 0, Z);
    if (!GetWorld()->LineTraceSingleByChannel(H, S, S + Into * 60.f, ECC_Visibility, P)) {
      const FVector Top = S + Into * 60.f; if (GetWorld()->LineTraceSingleByChannel(H, Top, Top - FVector(0, 0, Step + 5.f), ECC_Visibility, P)) { OutLedge = H.ImpactPoint; return true; }
      return false; } }
  return false;
}

bool URayatClimbComponent::TryStartClimb() {
  ACharacter* C = Cast<ACharacter>(GetOwner()); if (!C || State != ERayatClimbState::Ground) return false;
  FHitResult Wall; if (!ProbeWall(Wall)) return false;
  if (const AActor* A = Wall.GetActor()) { if (A->ActorHasTag(TEXT("NoClimb"))) return false; }
  FVector Ledge; if (!FindLedge(Wall, Ledge)) return false;
  WallNormal = Wall.ImpactNormal; LedgePoint = Ledge; State = ERayatClimbState::Climbing;
  C->GetCharacterMovement()->SetMovementMode(MOVE_Flying); C->GetCharacterMovement()->Velocity = FVector::ZeroVector;
  return true;
}

void URayatClimbComponent::StopClimb() {
  if (ACharacter* C = Cast<ACharacter>(GetOwner())) C->GetCharacterMovement()->SetMovementMode(MOVE_Falling);
  State = ERayatClimbState::Ground;
}

void URayatClimbComponent::TickComponent(float Dt, ELevelTick Tick, FActorComponentTickFunction* Fn) {
  Super::TickComponent(Dt, Tick, Fn);
  ACharacter* C = Cast<ACharacter>(GetOwner()); if (!C || State == ERayatClimbState::Ground) return;
  const float HalfH = C->GetCapsuleComponent()->GetScaledCapsuleHalfHeight();
  if (State == ERayatClimbState::Climbing) {
    // نلتصق بالجدار ونصعد؛ اتجاه الشخصية يواجه الجدار.
    const FVector Target = FVector(LedgePoint.X, LedgePoint.Y, C->GetActorLocation().Z) + WallNormal * 45.f;
    FVector Loc = C->GetActorLocation(); Loc = FMath::VInterpConstantTo(Loc, FVector(Target.X, Target.Y, Loc.Z), Dt, 200.f); Loc.Z += ClimbSpeed * Dt;
    C->SetActorLocation(Loc, true); C->SetActorRotation((-WallNormal).Rotation());
    if (Loc.Z + HalfH * 0.5f >= LedgePoint.Z) State = ERayatClimbState::Mantling;
  } else { // Mantling: ندفع الشخصية فوق الحافة ونعيدها للمشي
    const FVector Goal = LedgePoint - WallNormal * 60.f + FVector(0, 0, HalfH + 5.f);
    const FVector Loc = FMath::VInterpConstantTo(C->GetActorLocation(), Goal, Dt, 350.f); C->SetActorLocation(Loc, true);
    if (FVector::DistSquared(Loc, Goal) < 100.f) { C->GetCharacterMovement()->SetMovementMode(MOVE_Walking); State = ERayatClimbState::Ground; }
  }
}
