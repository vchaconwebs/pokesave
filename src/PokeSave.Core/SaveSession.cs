using PKHeX.Core;

namespace PokeSave.Core;

/// <summary>
/// Envuelve una partida abierta con PKHeX.Core. Es la única puerta de entrada a la lógica
/// de partidas: la capa WASM y los tests hablan con esta clase, nunca con PKHeX directamente.
/// </summary>
public sealed partial class SaveSession
{
    private readonly byte[] _original;

    public SaveFile Save { get; }

    private SaveSession(SaveFile save, byte[] original)
    {
        Save = save;
        _original = original;
    }

    /// <summary>Bytes del archivo tal y como se subió, sin tocar.</summary>
    public ReadOnlySpan<byte> Original => _original;

    public static bool TryOpen(byte[] data, string? fileName, out SaveSession? session, out string? error)
    {
        session = null;
        error = null;

        if (data.Length == 0)
        {
            error = "empty";
            return false;
        }
        // No se filtra por tamaño: las partidas de Switch no tienen un tamaño fijo.
        // PKHeX puede modificar el buffer que recibe: le damos una copia y guardamos el original.
        var original = data.ToArray();
        if (!SaveUtil.TryGetSaveFile(data.ToArray(), out var sav, fileName) || sav is null)
        {
            error = "unknown";
            return false;
        }

        session = new SaveSession(sav, original);
        return true;
    }

    /// <summary>Para tests: envuelve una partida ya construida (p. ej. una partida en blanco).</summary>
    internal static SaveSession FromSave(SaveFile save)
        => new(save, save.Write(BinaryExportSetting.None).ToArray());

    /// <summary>Para tests de Gen 3/4, cuyas partidas en blanco no se pueden escribir.</summary>
    internal static SaveSession FromSaveNoExport(SaveFile save) => new(save, []);

    /// <summary>Exporta la partida con checksums recalculados, en el mismo formato que se cargó.</summary>
    public byte[] Export() => Save.Write(BinaryExportSetting.None).ToArray();

    public SaveSummary GetSummary(string language = "es")
    {
        var sav = Save;
        var strings = GameInfo.GetStrings(language);

        var party = new List<PokemonInfo>(sav.PartyCount);
        for (int i = 0; i < sav.PartyCount; i++)
        {
            var pk = sav.GetPartySlotAtIndex(i);
            if (pk.Species == 0)
                continue;
            party.Add(Describe(pk, i, strings, StorageSlotType.Party));
        }

        int stored = 0;
        if (sav.HasBox)
        {
            foreach (var pk in sav.BoxData)
            {
                if (pk.Species != 0)
                    stored++;
            }
        }

        var trainer = new TrainerInfo(
            Name: sav.OT,
            Gender: sav.Gender,
            Id: sav.DisplayTID.ToString(sav.TrainerIDDisplayFormat == TrainerIDFormat.SixDigit ? "D6" : "D5"),
            SecretId: sav.Generation >= 3 ? sav.DisplaySID.ToString(sav.TrainerIDDisplayFormat == TrainerIDFormat.SixDigit ? "D4" : "D5") : null,
            Money: Safe(() => (uint?)sav.Money),
            Badges: Safe(GetBadges),
            MaxMoney: sav.MaxMoney,
            PlayTime: Safe(() => sav.PlayTimeString));

        DexInfo? dex = sav.HasPokeDex
            ? new DexInfo(sav.SeenCount, sav.CaughtCount, sav.MaxSpeciesID)
            : null;

        return new SaveSummary(
            Game: Get(strings.gamelist, (int)sav.Version) ?? sav.Version.ToString(),
            GameId: sav.Version.ToString(),
            Generation: sav.Generation,
            Context: sav.Context.ToString(),
            Trainer: trainer,
            Party: party,
            BoxCount: sav.HasBox ? sav.BoxCount : 0,
            BoxNames: sav.HasBox ? Enumerable.Range(0, sav.BoxCount).Select(GetBoxName).ToList() : [],
            BoxSlotCount: sav.HasBox ? sav.BoxSlotCount : 0,
            StoredCount: stored,
            Pokedex: dex,
            ChecksumsValid: sav.ChecksumsValid,
            FileSize: _original.Length,
            Extension: sav.Extension);
    }

    private static PokemonInfo Describe(PKM pk, int slot, GameStrings strings, StorageSlotType origin)
    {
        bool? legal = null;
        try
        {
            legal = new LegalityAnalysis(pk, origin).Valid;
        }
        catch
        {
            // El análisis de legalidad nunca debe impedir mostrar la partida.
        }

        var moves = new List<MoveSlot>(4);
        foreach (var move in new[] { pk.Move1, pk.Move2, pk.Move3, pk.Move4 })
        {
            if (move == 0)
                continue;
            int type = Safe(() => (int?)MoveInfo.GetType(move, pk.Context)) ?? 0;
            moves.Add(new MoveSlot(move, Get(strings.movelist, move) ?? $"#{move}", TypeOf(strings, type)));
        }

        var types = new List<TypeInfo>(2);
        var personal = pk.PersonalInfo;
        int type1 = NormalizeType(personal.Type1, pk.Format);
        int type2 = NormalizeType(personal.Type2, pk.Format);
        types.Add(TypeOf(strings, type1));
        if (type2 != type1)
            types.Add(TypeOf(strings, type2));

        return new PokemonInfo(
            Slot: slot,
            Species: pk.Species,
            SpeciesName: Get(strings.specieslist, pk.Species) ?? $"#{pk.Species}",
            Form: pk.Form,
            Nickname: pk.Nickname,
            IsNicknamed: pk.IsNicknamed,
            Level: pk.CurrentLevel,
            IsShiny: pk.IsShiny,
            IsEgg: pk.IsEgg,
            Gender: pk.Gender,
            Nature: pk.Format >= 3 ? Get(strings.natures, (int)pk.Nature) : null,
            Ability: pk.Format >= 3 ? Get(strings.abilitylist, pk.Ability) : null,
            HeldItem: pk.HeldItem > 0 ? Get(strings.itemlist, pk.HeldItem) : null,
            Types: types,
            Moves: moves,
            HpCurrent: pk.Stat_HPCurrent,
            HpMax: pk.Stat_HPMax,
            Legal: legal);
    }

    /// <summary>
    /// En Gen 1 y 2 los datos de especie usan la numeración interna de Game Boy (Fuego = 20,
    /// Eléctrico = 23…). La pasamos a la de Gen 3+ (Fuego = 9, Eléctrico = 12…).
    /// Los movimientos ya vienen normalizados desde PKHeX.
    /// </summary>
    internal static int NormalizeType(int type, int format) => format > 2 ? type : type switch
    {
        <= 5 => type,
        7 or 8 or 9 => type - 1, // Bicho, Fantasma, Acero
        >= 20 and <= 27 => type - 11, // Fuego … Siniestro
        _ => 0,
    };

    private static TypeInfo TypeOf(GameStrings strings, int type)
        => new(type, Get(strings.types, type) ?? $"#{type}");

    /// <summary>
    /// Lee un dato que puede no existir en la partida (bloques que faltan o corruptos).
    /// Un dato ilegible no debe impedir abrir la partida: se muestra como no disponible.
    /// </summary>
    private static T? Safe<T>(Func<T?> read)
    {
        try
        {
            return read();
        }
        catch
        {
            return default;
        }
    }

    private static string? Get(IReadOnlyList<string> list, int index)
        => (uint)index < (uint)list.Count && !string.IsNullOrWhiteSpace(list[index]) ? list[index] : null;
}
