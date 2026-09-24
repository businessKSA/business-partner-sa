#include "RayatLevelData.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

static FVector ReadVec(const TSharedPtr<FJsonObject>& O) {
  if (!O.IsValid()) return FVector::ZeroVector;
  return FVector(O->GetNumberField(TEXT("x")), O->GetNumberField(TEXT("y")), O->GetNumberField(TEXT("z")));
}

bool URayatLevelLibrary::LoadLevels(TArray<FRayatLevel>& OutLevels) {
  OutLevels.Reset();
  const FString Path = FPaths::Combine(FPaths::ProjectContentDir(), TEXT("Data/levels.json"));
  FString Raw; if (!FFileHelper::LoadFileToString(Raw, *Path)) { UE_LOG(LogTemp, Error, TEXT("Rayat: levels.json not found at %s"), *Path); return false; }
  TSharedPtr<FJsonObject> Root; const auto Reader = TJsonReaderFactory<>::Create(Raw);
  if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return false;
  for (const auto& LV : Root->GetArrayField(TEXT("levels"))) {
    const auto L = LV->AsObject(); FRayatLevel Level;
    Level.Id = L->GetStringField(TEXT("id")); Level.Title = FText::FromString(L->GetStringField(TEXT("title")));
    Level.Era = FText::FromString(L->GetStringField(TEXT("era"))); Level.Time = L->GetStringField(TEXT("time")); Level.Landmark = L->GetStringField(TEXT("landmark"));
    Level.Start = ReadVec(L->GetObjectField(TEXT("start")));
    for (const auto& S : L->GetArrayField(TEXT("solids"))) { const auto O = S->AsObject(); FRayatSolid Solid; Solid.Kind = O->GetStringField(TEXT("kind")); Solid.bClimbable = O->GetBoolField(TEXT("climbable")); Solid.Center = ReadVec(O->GetObjectField(TEXT("center"))); Solid.Extent = ReadVec(O->GetObjectField(TEXT("extent"))); Level.Solids.Add(Solid); }
    for (const auto& G : L->GetArrayField(TEXT("guards"))) { const auto O = G->AsObject(); FRayatGuard Guard; Guard.Range = O->GetNumberField(TEXT("range")); Guard.FovDeg = O->GetNumberField(TEXT("fovDeg")); for (const auto& W : O->GetArrayField(TEXT("waypoints"))) Guard.Waypoints.Add(ReadVec(W->AsObject())); Level.Guards.Add(Guard); }
    for (const auto& Ob : L->GetArrayField(TEXT("objectives"))) { const auto O = Ob->AsObject(); FRayatObjective Obj; Obj.Type = O->GetStringField(TEXT("type")); Obj.Text = FText::FromString(O->GetStringField(TEXT("text")));
      FString Lbl; if (O->TryGetStringField(TEXT("label"), Lbl)) Obj.Label = FText::FromString(Lbl); double Sec = 0; if (O->TryGetNumberField(TEXT("seconds"), Sec)) Obj.Seconds = Sec; Obj.bAlarm = O->GetBoolField(TEXT("alarm")); O->TryGetStringField(TEXT("effect"), Obj.Effect);
      const TSharedPtr<FJsonObject>* Pos; if (O->TryGetObjectField(TEXT("position"), Pos)) Obj.Position = ReadVec(*Pos);
      const TArray<TSharedPtr<FJsonValue>>* Items; if (O->TryGetArrayField(TEXT("items"), Items)) for (const auto& It : *Items) Obj.Items.Add(ReadVec(It->AsObject()));
      Level.Objectives.Add(Obj); }
    for (const auto& M : L->GetArrayField(TEXT("manuscripts"))) { const auto O = M->AsObject(); FRayatManuscript Ms; Ms.Id = O->GetStringField(TEXT("id")); Ms.Title = FText::FromString(O->GetStringField(TEXT("title"))); Ms.Fact = FText::FromString(O->GetStringField(TEXT("fact"))); Ms.Position = ReadVec(O->GetObjectField(TEXT("position"))); Level.Manuscripts.Add(Ms); }
    OutLevels.Add(Level);
  }
  return OutLevels.Num() > 0;
}
