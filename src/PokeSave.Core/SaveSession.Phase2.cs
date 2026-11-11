using PKHeX.Core;

namespace PokeSave.Core;

/// <summary>
/// Fase 2: deshacer/rehacer, mochila, Pokédex e importar/exportar Pokémon (.pk* y Showdown).
/// </summary>
public sealed partial class SaveSession
{
    // ---------- Historial ----------

    private readonly List<SaveFile> _undo = [];
    private readonly List<SaveFile> _redo = [];

    /// <summary>
    /// Cuántas copias de la partida se guardan para deshacer. Se limita por memoria: una
    /// partida de Escarlata/Púrpura ocupa ~4 MB y el navegador tiene memoria limitada.
    /// </summary>
    private int MaxHistory => Math.Clamp(64 * 1024 * 1024 / Math.Max(1, Save.Data.Length), 5, 30);

    public HistoryInfo History => new(_undo.Count, _undo.Count > 0, _redo.Count > 0);

    /// <summary>Guarda una copia antes de modificar. Llamar justo antes de escribir, tras validar.</summary>
    private void Checkpoint()
    {
        _undo.Add(Save.Clone());
        if (_undo.Count > MaxHistory)
            _undo.RemoveAt(0);
        _redo.Clear();
    }

    public bool Undo()
    {
        if (_undo.Count == 0)
            return false;
        _redo.Add(Save);
        Save = _undo[^1];
        _undo.RemoveAt(_undo.Count - 1);
        return true;
    }

    public bool Redo()
    {
        if (_redo.Count == 0)
            return false;
        _undo.Add(Save);
        Save = _redo[^1];
        _redo.RemoveAt(_redo.Count - 1);
        return true;
    }

    // ---------- Mochila ----------

    public BagView GetBag(string language = "es")
    {
        var strings = GameInfo.GetStrings(language);
        var bag = Save.Inventory;
        var pouches = new List<PouchView>();
        foreach (var pouch in bag.Pouches)
        {
            if (pouch.Type is InventoryType.None or InventoryType.FreeSpace)
                continue;
            var items = pouch.Items
                .Where(i => i.Index != 0 && i.Count > 0)
                .Select(i => new BagItem(i.Index, Get(strings.itemlist, i.Index) ?? $"#{i.Index}", i.Count))
                .ToList();
            var allowed = new List<Option>();
            foreach (var id in pouch.GetAllItems())
            {
                if (id != 0 && Get(strings.itemlist, id) is { } name)
                    allowed.Add(new Option(id, name));
            }
            allowed.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.CurrentCultureIgnoreCase));
            pouches.Add(new PouchView(pouch.Type.ToString(), pouch.Items.Length, bag.GetMaxCount(pouch.Type, 0), items, allowed));
        }
        return new BagView(pouches);
    }

    /// <summary>Sustituye el contenido de un bolsillo. Devuelve un código de error o null.</summary>
    public EditResult SetPouch(PouchEdit edit, string language = "es")
    {
        if (!Enum.TryParse<InventoryType>(edit.Type, out var type))
            return new EditResult(false, "pouch", null, null);
        var bag = Save.Inventory;
        var pouch = bag.Pouches.FirstOrDefault(p => p.Type == type);
        if (pouch is null || edit.Items is null)
            return new EditResult(false, "pouch", null, null);

        var allowed = new HashSet<ushort>(pouch.GetAllItems().ToArray());
        var items = edit.Items.Where(i => i.Count > 0).ToList();
        if (items.Count > pouch.Items.Length)
            return new EditResult(false, "pouch-full", null, null);
        if (items.Select(i => i.Id).Distinct().Count() != items.Count)
            return new EditResult(false, "bag-duplicate", null, null);
        foreach (var item in items)
        {
            if (item.Id <= 0 || !allowed.Contains((ushort)item.Id))
                return new EditResult(false, "bag-item", null, null);
            if (item.Count > bag.GetMaxCount(type, item.Id))
                return new EditResult(false, "bag-count", null, null);
        }

        Checkpoint();
        pouch.RemoveAll();
        foreach (var item in items)
            pouch.GiveItem(bag, (ushort)item.Id, item.Count);
        bag.CopyTo(Save);
        return new EditResult(true, null, null, GetSummary(language));
    }

    // ---------- Pokédex ----------

    private bool DexEditable => Save.HasPokeDex && (Save is SAV5 || Save.Generation <= 6);

    public DexView GetDex(string language = "es")
    {
        var strings = GameInfo.GetStrings(language);
        var sav = Save;
        var entries = new List<DexEntry>(sav.MaxSpeciesID);
        if (sav.HasPokeDex)
        {
            for (ushort s = 1; s <= sav.MaxSpeciesID; s++)
            {
                if (!sav.Personal.IsSpeciesInGame(s))
                    continue;
                entries.Add(new DexEntry(s, Get(strings.specieslist, s) ?? $"#{s}", Safe(() => (bool?)sav.GetSeen(s)) ?? false, Safe(() => (bool?)sav.GetCaught(s)) ?? false));
            }
        }
        return new DexView(DexEditable, entries);
    }

    /// <summary>
    /// Marca especies como vistas/capturadas. Capturado implica visto. Una lista vacía
    /// aplica el cambio a todas las especies del juego.
    /// </summary>
    public EditResult SetDex(DexEdit edit, string language = "es")
    {
        if (!DexEditable)
            return new EditResult(false, "dex-unsupported", null, null);
        var sav = Save;
        var species = (edit.Species is { Count: > 0 } list ? list : Enumerable.Range(1, sav.MaxSpeciesID).ToList())
            .Where(s => s >= 1 && s <= sav.MaxSpeciesID && sav.Personal.IsSpeciesInGame((ushort)s))
            .Distinct()
            .ToList();
        if (species.Count == 0)
            return new EditResult(false, "species", null, null);

        bool seen = edit.Seen || edit.Caught;
        Checkpoint();
        foreach (var s in species)
            SetDexFlags((ushort)s, seen, edit.Caught);
        return new EditResult(true, null, null, GetSummary(language));
    }

    private void SetDexFlags(ushort species, bool seen, bool caught)
    {
        if (Save is SAV5 s5)
        {
            // Gen 5 guarda "visto" por sexo y variocolor y aparte lo que muestra la Pokédex.
            var z = s5.Zukan;
            byte gender = s5.Personal[species].Gender switch { 255 => 2, 254 => 1, _ => 0 };
            if (seen)
            {
                z.SetSeen(species, gender, false, true);
                z.SetDisplayed(species, gender, false, true);
            }
            else
            {
                z.ClearSeen(species);
                z.ClearDisplayed(species);
            }
            z.SetCaught(species, caught);
            return;
        }
        if (!caught)
            Save.SetCaught(species, false);
        Save.SetSeen(species, seen);
        if (caught)
            Save.SetCaught(species, true);
    }

    // ---------- Exportar un Pokémon ----------

    public (byte[] Data, PokemonExport Info)? ExportPokemon(SlotRef at, string language = "es")
    {
        var pk = Read(at);
        if (pk is null)
            return null;
        var buffer = new byte[Math.Max(pk.SIZE_PARTY, pk.SIZE_STORED)];
        int length = pk.WriteDecryptedDataStored(buffer);
        var strings = GameInfo.GetStrings(language);
        var name = pk.IsEgg ? "Huevo" : Get(strings.specieslist, pk.Species) ?? $"{pk.Species}";
        var file = $"{pk.Species:0000} - {SafeFileName(name)}.{pk.Extension}";
        return (buffer.AsSpan(0, length).ToArray(), new PokemonExport(file, ShowdownParsing.GetShowdownText(pk)));
    }

    private static string SafeFileName(string name)
        => string.Concat(name.Select(c => Path.GetInvalidFileNameChars().Contains(c) || c is ':' or '?' or '*' ? '_' : c));

    // ---------- Importar un Pokémon ----------

    /// <summary>
    /// Importa un archivo .pk* en un hueco (de caja, o del equipo hasta llenar 6).
    /// Si el archivo es del mismo formato que la partida se carga tal cual; si es de otra
    /// generación se convierte con PKHeX (como al transferirlo).
    /// </summary>
    public EditResult ImportPokemonFile(SlotRef at, byte[] data, string fileName, string language = "es")
    {
        if (!CanPlace(at))
            return new EditResult(false, "slot", null, null);
        var sav = Save;

        PKM? pk = null;
        var ext = Path.GetExtension(fileName ?? "").TrimStart('.').ToLowerInvariant();
        bool sameFormat = sav.PKMExtensions.Contains(ext) && (data.Length == sav.SIZE_STORED || data.Length == sav.SIZE_PARTY);
        try
        {
            pk = sameFormat ? sav.GetDecryptedPKM(data.ToArray()) : EntityFormat.GetFromBytes(data.ToArray(), sav.Context);
        }
        catch
        {
            pk = null;
        }
        if (pk is null || pk.Species == 0)
            return new EditResult(false, "pk-format", null, null);

        if (pk.GetType() != sav.PKMType)
        {
            var converted = EntityConverter.ConvertToType(pk, sav.PKMType, out _);
            if (converted is null)
                return new EditResult(false, "pk-convert", null, null);
            pk = converted;
        }
        return Place(at, pk, language);
    }

    /// <summary>Crea un Pokémon a partir de un texto en formato Showdown (en cualquier idioma).</summary>
    public EditResult ImportShowdown(SlotRef at, string text, string language = "es")
    {
        if (!CanPlace(at))
            return new EditResult(false, "slot", null, null);
        if (string.IsNullOrWhiteSpace(text) || !ShowdownParsing.TryParseAnyLanguage(text, out var set) || set is null || set.Species == 0)
            return new EditResult(false, "showdown", null, null);

        var sav = Save;
        // Comprobar antes de aplicar: PKHeX recorta los valores fuera de rango (una especie
        // de Gen 9 en Blanco acabaría convertida en Genesect sin avisar).
        if (set.Species > sav.MaxSpeciesID || !sav.Personal.IsSpeciesInGame(set.Species))
            return new EditResult(false, "pk-species", null, null);
        if (set.Moves.Any(m => m > sav.MaxMoveID))
            return new EditResult(false, "pk-moves", null, null);

        var pk = sav.BlankPKM;
        pk.Language = sav.Language is > 0 ? sav.Language : (int)LanguageID.English;
        pk.OriginalTrainerName = sav.OT;
        pk.OriginalTrainerGender = sav.Gender;
        pk.ID32 = sav.ID32;
        pk.Version = sav.Version;
        if (pk.Format >= 3)
            pk.PID = Util.Rand32();
        try
        {
            pk.ApplySetDetails(set);
        }
        catch
        {
            return new EditResult(false, "showdown", null, null);
        }
        if (string.IsNullOrEmpty(set.Nickname))
            CommonEdits.ClearNickname(pk);
        pk.HealPP();
        pk.ResetPartyStats();
        return Place(at, pk, language);
    }

    private bool CanPlace(SlotRef at)
    {
        var sav = Save;
        if (at.IsParty)
            return at.Slot >= 0 && at.Slot < 6 && (at.Slot < sav.PartyCount || sav.PartyCount < 6);
        return at.Kind == SlotRef.BoxKind && sav.HasBox && (uint)at.Box < (uint)sav.BoxCount && (uint)at.Slot < (uint)sav.BoxSlotCount;
    }

    private EditResult Place(SlotRef at, PKM pk, string language)
    {
        var sav = Save;
        if (pk.Species > sav.MaxSpeciesID || !sav.Personal.IsSpeciesInGame(pk.Species))
            return new EditResult(false, "pk-species", null, null);
        if (pk.Move1 > sav.MaxMoveID || pk.Move2 > sav.MaxMoveID || pk.Move3 > sav.MaxMoveID || pk.Move4 > sav.MaxMoveID)
            return new EditResult(false, "pk-moves", null, null);
        if (pk.HeldItem > sav.MaxItemID)
            pk.HeldItem = 0;

        // En el equipo se añade al final: no puede quedar un hueco en medio.
        var target = at.IsParty ? at with { Slot = Math.Min(at.Slot, sav.PartyCount) } : at;
        Checkpoint();
        Write(target, pk);
        var fresh = Read(target);
        return new EditResult(true, null, fresh is null ? null : Detail(target, fresh, language), GetSummary(language));
    }
}
