using System.Text.Json.Serialization;

namespace PokeSave.Core;

/// <summary>Resultado de intentar abrir un archivo de guardado.</summary>
public sealed record LoadResult(bool Ok, string? Error, SaveSummary? Save);

/// <summary>Vista de solo lectura de una partida, lista para mandar a la UI como JSON.</summary>
public sealed record SaveSummary(
    string Game,
    string GameId,
    int Generation,
    string Context,
    TrainerInfo Trainer,
    IReadOnlyList<PokemonInfo> Party,
    int BoxCount,
    int BoxSlotCount,
    int StoredCount,
    DexInfo? Pokedex,
    bool ChecksumsValid,
    int FileSize,
    string Extension);

public sealed record TrainerInfo(
    string Name,
    int Gender,
    string Id,
    string? SecretId,
    uint? Money,
    int MaxMoney,
    string? PlayTime);

public sealed record DexInfo(int Seen, int Caught, int Total);

public sealed record PokemonInfo(
    int Slot,
    int Species,
    string SpeciesName,
    int Form,
    string Nickname,
    bool IsNicknamed,
    int Level,
    bool IsShiny,
    bool IsEgg,
    int Gender,
    string? Nature,
    string? Ability,
    string? HeldItem,
    IReadOnlyList<TypeInfo> Types,
    IReadOnlyList<MoveSlot> Moves,
    int HpCurrent,
    int HpMax,
    bool? Legal);

/// <summary>Tipo elemental. <c>Id</c> sigue el orden de PKHeX (0 Normal … 17 Hada).</summary>
public sealed record TypeInfo(int Id, string Name);

public sealed record MoveSlot(int Id, string Name, TypeInfo Type);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(LoadResult))]
public sealed partial class PokeSaveJson : JsonSerializerContext;
