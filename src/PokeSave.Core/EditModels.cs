using System.Text.Json.Serialization;

namespace PokeSave.Core;

// Modelos de la Fase 1 (edición). Viajan como JSON entre la UI y el motor.

/// <summary>Dónde está un Pokémon: en el equipo (<c>party</c>) o en una caja (<c>box</c>).</summary>
public sealed record SlotRef(string Kind, int Box, int Slot)
{
    public const string Party = "party";
    public const string BoxKind = "box";
    public bool IsParty => Kind == Party;
}

public sealed record Option(int Id, string Name);

/// <summary>Listas para los desplegables, filtradas a lo que existe en el juego cargado.</summary>
public sealed record GameLists(
    IReadOnlyList<Option> Species,
    IReadOnlyList<Option> Moves,
    IReadOnlyList<Option> Items,
    IReadOnlyList<Option> Natures);

public sealed record BadgeInfo(int Earned, int Total, IReadOnlyList<bool> Flags);

public sealed record BoxSlot(int Slot, int Species, string Name, int Level, bool IsShiny, bool IsEgg, bool Legal);

public sealed record BoxView(int Index, string Name, int SlotCount, IReadOnlyList<BoxSlot> Slots);

/// <summary>Campos editables de un Pokémon. IVs/EVs en orden PS, Ata, Def, AtE, DeE, Vel.</summary>
public sealed record PokemonEdit(
    int Species,
    string Nickname,
    bool IsNicknamed,
    int Level,
    int Nature,
    int AbilityIndex,
    int HeldItem,
    bool IsShiny,
    IReadOnlyList<int> Moves,
    [property: JsonPropertyName("ivs")] IReadOnlyList<int> IVs,
    [property: JsonPropertyName("evs")] IReadOnlyList<int> EVs);

/// <summary>Qué se puede editar en esta generación y con qué límites.</summary>
public sealed record EditLimits(
    int MaxLevel,
    [property: JsonPropertyName("maxIv")] int MaxIV,
    [property: JsonPropertyName("maxEv")] int MaxEV,
    [property: JsonPropertyName("maxEvTotal")] int MaxEVTotal,
    int MaxNicknameLength,
    bool HasNature,
    bool HasAbility,
    bool HasHeldItem,
    bool HasShiny,
    bool HpIvDerived,
    bool SpecialCombined);

public sealed record PokemonDetail(
    SlotRef Ref,
    PokemonInfo Info,
    PokemonEdit Edit,
    IReadOnlyList<int> Stats,
    EditLimits Limits,
    IReadOnlyList<Option> Abilities,
    IReadOnlyList<string> Legality);

public sealed record TrainerEdit(string Name, uint Money);

/// <summary>Resultado de una operación de edición. <c>Error</c> es un código para la UI.</summary>
public sealed record EditResult(bool Ok, string? Error, PokemonDetail? Pokemon, SaveSummary? Save);
