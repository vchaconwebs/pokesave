using PKHeX.Core;

namespace PokeSave.Core;

/// <summary>
/// Envuelve una partida abierta con PKHeX.Core. Es la única puerta de entrada a la lógica
/// de partidas: la capa WASM y los tests hablan con esta clase, nunca con PKHeX directamente.
/// </summary>
public sealed class SaveSession
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

        var moves = new List<string>(4);
        foreach (var move in new[] { pk.Move1, pk.Move2, pk.Move3, pk.Move4 })
        {
            if (move != 0)
                moves.Add(Get(strings.movelist, move) ?? $"#{move}");
        }

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
            Moves: moves,
            HpCurrent: pk.Stat_HPCurrent,
            HpMax: pk.Stat_HPMax,
            Legal: legal);
    }

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
