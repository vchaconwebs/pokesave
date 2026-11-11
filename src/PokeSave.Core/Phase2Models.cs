namespace PokeSave.Core;

// Modelos de la Fase 2 (mochila, Pokédex, importar/exportar, deshacer).

/// <summary>Posición en el historial: cuántos cambios se han hecho desde que se abrió.</summary>
public sealed record HistoryInfo(int Position, bool CanUndo, bool CanRedo);

public sealed record BagItem(int Id, string Name, int Count);

/// <summary>Un bolsillo de la mochila. <c>Type</c> es el nombre del enum de PKHeX (Items, KeyItems…).</summary>
public sealed record PouchView(string Type, int Slots, int MaxCount, IReadOnlyList<BagItem> Items, IReadOnlyList<Option> Allowed);

public sealed record BagView(IReadOnlyList<PouchView> Pouches);

public sealed record BagItemEdit(int Id, int Count);

public sealed record PouchEdit(string Type, IReadOnlyList<BagItemEdit> Items);

public sealed record DexEntry(int Species, string Name, bool Seen, bool Caught);

/// <summary>
/// Pokédex del juego. <c>Entries</c> es la Nacional; <c>Regions</c>, las regionales del juego
/// (Teselia, Galar…) con su numeración propia. <c>Editable</c> es false en los juegos cuya
/// Pokédex aún no se sabe editar.
/// </summary>
public sealed record DexView(bool Editable, IReadOnlyList<DexEntry> Entries, IReadOnlyList<DexRegion> Regions);

/// <summary>Una Pokédex regional. <c>Key</c> la traduce la UI (unova, galar, paldea…).</summary>
public sealed record DexRegion(string Key, IReadOnlyList<RegionEntry> Entries);

public sealed record RegionEntry(int Species, int Number);

/// <summary>Cambios en bloque: lista de especies (o vacía = todas) y el estado que se quiere.</summary>
public sealed record DexEdit(IReadOnlyList<int> Species, bool Seen, bool Caught);

/// <summary>Pokémon exportado: archivo .pk* y texto en formato Showdown.</summary>
public sealed record PokemonExport(string FileName, string Showdown);

/// <summary>Un objeto del juego para el buscador: cuántos tienes y, si es MT, qué enseña.</summary>
public sealed record FinderItem(int Id, string Name, string Pouch, int Count, int? Move, string? MoveName, byte? MoveType);

public sealed record ItemFinderView(IReadOnlyList<FinderItem> Items, bool HasFlags);
