using PKHeX.Core;

namespace PokeSave.Core;

/// <summary>
/// Edición (Fase 1). Todo lo que llega de la UI se valida aquí antes de tocar la partida:
/// la UI puede equivocarse o ser manipulada, la partida del usuario no.
/// </summary>
public sealed partial class SaveSession
{
    private const int StatCount = 6;

    // ---------- Lectura ----------

    public GameLists GetLists(string language = "es")
    {
        var source = new FilteredGameDataSource(Save, new GameDataSource(GameInfo.GetStrings(language)));
        return new GameLists(
            Species: ToOptions(source.Species, skipZero: true),
            Moves: ToOptions(source.Moves, skipZero: true),
            Items: HoldableItems(source.Items),
            Natures: Save.Generation >= 3 ? ToOptions(source.Natures, skipZero: false) : []);
    }

    public BoxView? GetBox(int box, string language = "es")
    {
        var sav = Save;
        if (!sav.HasBox || (uint)box >= (uint)sav.BoxCount)
            return null;

        var strings = GameInfo.GetStrings(language);
        var slots = new List<BoxSlot>(sav.BoxSlotCount);
        for (int i = 0; i < sav.BoxSlotCount; i++)
        {
            var pk = sav.GetBoxSlotAtIndex(box, i);
            if (pk.Species == 0 || pk.Species > sav.MaxSpeciesID)
                continue;
            var name = pk.IsEgg ? "" : (pk.Nickname is { Length: > 0 } n ? n : Get(strings.specieslist, pk.Species) ?? "");
            slots.Add(new BoxSlot(i, pk.Species, name, pk.CurrentLevel, pk.IsShiny, pk.IsEgg, IsLegal(pk, StorageSlotType.Box) ?? true));
        }
        return new BoxView(box, GetBoxName(box), sav.BoxSlotCount, slots);
    }

    public PokemonDetail? GetPokemon(SlotRef at, string language = "es")
    {
        var pk = Read(at);
        return pk is null ? null : Detail(at, pk, language);
    }

    // ---------- Escritura ----------

    public EditResult SetPokemon(SlotRef at, PokemonEdit edit, string language = "es")
    {
        var pk = Read(at);
        if (pk is null)
            return new EditResult(false, "slot", null, null);

        var error = Apply(pk, edit);
        if (error is not null)
            return new EditResult(false, error, null, null);

        Write(at, pk);
        var fresh = Read(at)!;
        return new EditResult(true, null, Detail(at, fresh, language), GetSummary(language));
    }

    /// <summary>
    /// Aplica los cambios a una copia y devuelve cómo quedaría (stats, habilidades de la nueva
    /// especie, legalidad) sin tocar la partida. La UI lo usa mientras se edita.
    /// </summary>
    public EditResult PreviewPokemon(SlotRef at, PokemonEdit edit, string language = "es")
    {
        var pk = Read(at);
        if (pk is null)
            return new EditResult(false, "slot", null, null);
        var error = Apply(pk, edit);
        return error is null
            ? new EditResult(true, null, Detail(at, pk, language), null)
            : new EditResult(false, error, null, null);
    }

    public EditResult SetTrainer(TrainerEdit edit, string language = "es")
    {
        var sav = Save;
        var name = (edit.Name ?? "").Trim();
        if (name.Length == 0 || name.Length > sav.MaxStringLengthTrainer)
            return new EditResult(false, "trainer-name", null, null);
        if (edit.Money > (uint)sav.MaxMoney)
            return new EditResult(false, "money", null, null);

        sav.OT = name;
        try
        {
            sav.Money = edit.Money;
        }
        catch
        {
            // Partidas sin bloque de dinero legible: se deja como estaba.
            return new EditResult(false, "money", null, null);
        }
        return new EditResult(true, null, null, GetSummary(language));
    }

    // ---------- Internos ----------

    private PKM? Read(SlotRef at)
    {
        var sav = Save;
        PKM pk;
        if (at.IsParty)
        {
            if ((uint)at.Slot >= (uint)sav.PartyCount)
                return null;
            pk = sav.GetPartySlotAtIndex(at.Slot);
        }
        else if (at.Kind == SlotRef.BoxKind && sav.HasBox && (uint)at.Box < (uint)sav.BoxCount && (uint)at.Slot < (uint)sav.BoxSlotCount)
        {
            pk = sav.GetBoxSlotAtIndex(at.Box, at.Slot);
        }
        else
        {
            return null;
        }
        return pk.Species == 0 ? null : pk;
    }

    private void Write(SlotRef at, PKM pk)
    {
        if (at.IsParty)
            Save.SetPartySlotAtIndex(pk, at.Slot);
        else
            Save.SetBoxSlotAtIndex(pk, at.Box, at.Slot);
    }

    internal EditLimits LimitsFor(PKM pk)
    {
        var sav = Save;
        int format = pk.Format;
        return new EditLimits(
            MaxLevel: 100,
            MaxIV: sav.MaxIV,
            MaxEV: sav.MaxEV,
            MaxEVTotal: format >= 3 ? 510 : sav.MaxEV * StatCount,
            MaxNicknameLength: sav.MaxStringLengthNickname,
            HasNature: format >= 3,
            HasAbility: format >= 3,
            HasHeldItem: format >= 2,
            HasShiny: true,
            HpIvDerived: format <= 2,
            SpecialCombined: format <= 2);
    }

    /// <summary>Valida y aplica los cambios. Devuelve un código de error o null.</summary>
    internal string? Apply(PKM pk, PokemonEdit e)
    {
        var sav = Save;
        var limits = LimitsFor(pk);

        // --- Validación (antes de tocar nada) ---
        if (e.Species < 1 || e.Species > sav.MaxSpeciesID || !sav.Personal.IsSpeciesInGame((ushort)e.Species))
            return "species";
        if (e.Level < 1 || e.Level > limits.MaxLevel)
            return "level";
        if (e.Moves is not { Count: 4 } || e.Moves.Any(m => m < 0 || m > sav.MaxMoveID) || e.Moves.All(m => m == 0))
            return "moves";
        var nonEmpty = e.Moves.Where(m => m != 0).ToList();
        if (nonEmpty.Distinct().Count() != nonEmpty.Count)
            return "moves-duplicate";
        if (e.IVs is not { Count: StatCount } || e.IVs.Any(v => v < 0 || v > limits.MaxIV))
            return "ivs";
        if (e.EVs is not { Count: StatCount } || e.EVs.Any(v => v < 0 || v > limits.MaxEV) || e.EVs.Sum() > limits.MaxEVTotal)
            return "evs";
        if (limits.HasNature && (e.Nature < 0 || e.Nature > 24))
            return "nature";
        if (limits.HasHeldItem && (e.HeldItem < 0 || e.HeldItem > sav.MaxItemID || !IsHoldable(e.HeldItem)))
            return "item";
        var nickname = (e.Nickname ?? "").Trim();
        if (e.IsNicknamed && (nickname.Length == 0 || nickname.Length > limits.MaxNicknameLength))
            return "nickname";

        // --- Especie (primero: cambia habilidades, tipos y stats base) ---
        bool speciesChanged = pk.Species != e.Species;
        if (speciesChanged)
        {
            pk.Species = (ushort)e.Species;
            pk.Form = 0;
            pk.Gender = pk.GetSaneGender();
        }

        // Al cambiar de especie, una habilidad que no exista en la nueva vuelve a la primera.
        int abilityIndex = e.AbilityIndex;
        if (speciesChanged && limits.HasAbility && (abilityIndex < 0 || abilityIndex >= pk.PersonalInfo.AbilityCount))
            abilityIndex = 0;
        if (limits.HasAbility && (abilityIndex < 0 || abilityIndex >= pk.PersonalInfo.AbilityCount))
            return "ability";
        e = e with { AbilityIndex = abilityIndex };

        // --- Nivel (fija la experiencia) ---
        pk.CurrentLevel = (byte)e.Level;

        // --- Objeto ---
        if (limits.HasHeldItem)
            pk.HeldItem = e.HeldItem;

        // --- Movimientos: sin huecos y con los PP al máximo ---
        var moves = nonEmpty.Select(m => (ushort)m).Concat(Enumerable.Repeat((ushort)0, 4)).Take(4).ToArray();
        pk.SetMoves(moves);
        pk.HealPP();

        // --- IVs y EVs (UI: PS, Ata, Def, AtE, DeE, Vel) ---
        SetStats(pk, e.IVs, isIV: true, limits);
        SetStats(pk, e.EVs, isIV: false, limits);

        // --- Naturaleza, variocolor y habilidad ---
        // En Gen 3-5 los tres dependen del PID: cambiar uno puede deshacer otro. Se aplican
        // en bucle hasta que los tres coinciden. En Gen 1-2 el variocolor depende de los IVs,
        // así que va después de ellos y manda sobre ellos.
        if (!ApplyPidTraits(pk, e, limits))
            return "combination";

        // --- Mote ---
        if (e.IsNicknamed)
        {
            CommonEdits.SetNickname(pk, nickname);
        }
        else if (pk.IsNicknamed || speciesChanged)
        {
            CommonEdits.ClearNickname(pk);
        }

        if (pk.IsEgg)
            pk.Nickname = SpeciesName.GetEggName(pk.Language, pk.Format);

        pk.ResetPartyStats();
        pk.RefreshChecksum();
        return null;
    }

    private static bool ApplyPidTraits(PKM pk, PokemonEdit e, EditLimits limits)
    {
        if (pk.Format is 3 or 4)
            return SearchPid34(pk, e);

        for (int attempt = 0; attempt < 64; attempt++)
        {
            if (limits.HasNature && (int)pk.Nature != e.Nature)
            {
                // Desde Gen 5 la naturaleza se guarda aparte del PID: se asigna sin más.
                // En Gen 3/4 sale del PID y CommonEdits genera uno nuevo que la cumpla.
                if (pk.Format >= 5)
                    pk.Nature = (Nature)e.Nature;
                else
                    CommonEdits.SetNature(pk, (Nature)e.Nature);
            }
            if (pk.IsShiny != e.IsShiny)
                CommonEdits.SetIsShiny(pk, e.IsShiny);
            if (limits.HasAbility && AbilitySlot(pk) != e.AbilityIndex)
                CommonEdits.SetAbilityIndex(pk, e.AbilityIndex);

            bool natureOk = !limits.HasNature || (int)pk.Nature == e.Nature;
            bool abilityOk = !limits.HasAbility || AbilitySlot(pk) == e.AbilityIndex;
            if (natureOk && abilityOk && pk.IsShiny == e.IsShiny)
                return true;
        }
        return false;
    }

    /// <summary>
    /// Gen 3/4: naturaleza (PID % 25), habilidad (bit 0), sexo (byte bajo) y variocolor
    /// salen todos del mismo PID. Corregirlos de uno en uno puede dar vueltas sin fin, así
    /// que se busca directamente un PID que cumpla los cuatro, conservando el sexo.
    /// </summary>
    private static bool SearchPid34(PKM pk, PokemonEdit e)
    {
        uint current = pk.PID;
        bool sameAsNow = (int)(current % 25) == e.Nature
            && (int)(current & 1) == e.AbilityIndex
            && pk.IsShiny == e.IsShiny;
        if (sameAsNow)
            return true;

        byte ratio = pk.PersonalInfo.Gender;
        bool genderMatters = ratio is not (0 or 254 or 255);
        bool female = pk.Gender == 1;
        uint trainer = (uint)(pk.TID16 ^ pk.SID16);
        var rng = Random.Shared;

        for (int attempt = 0; attempt < 1_000_000; attempt++)
        {
            uint low = (uint)rng.Next(0x10000);
            uint high = e.IsShiny
                ? (trainer ^ low ^ (uint)rng.Next(8)) & 0xFFFF
                : (uint)rng.Next(0x10000);
            uint pid = (high << 16) | low;

            if ((pid % 25) != (uint)e.Nature || (pid & 1) != (uint)e.AbilityIndex)
                continue;
            if (genderMatters && ((pid & 0xFF) < ratio) != female)
                continue;
            bool shiny = (trainer ^ high ^ low) < 8;
            if (shiny != e.IsShiny)
                continue;

            pk.PID = pid;
            pk.RefreshAbility(e.AbilityIndex);
            return (int)pk.Nature == e.Nature && pk.IsShiny == e.IsShiny;
        }
        return false;
    }

    /// <summary>Hueco de habilidad 0/1/2 (oculta), o -1 si el Pokémon no tiene ninguno fijado.</summary>
    private static int AbilitySlot(PKM pk) => pk.AbilityNumber switch { 1 => 0, 2 => 1, 4 => 2, _ => -1 };

    private static void SetStats(PKM pk, IReadOnlyList<int> values, bool isIV, EditLimits limits)
    {
        // Orden de la UI → propiedades de PKHeX.
        if (isIV)
        {
            if (!limits.HpIvDerived)
                pk.IV_HP = values[0];
            pk.IV_ATK = values[1];
            pk.IV_DEF = values[2];
            pk.IV_SPA = values[3];
            pk.IV_SPD = limits.SpecialCombined ? values[3] : values[4];
            pk.IV_SPE = values[5];
        }
        else
        {
            pk.EV_HP = values[0];
            pk.EV_ATK = values[1];
            pk.EV_DEF = values[2];
            pk.EV_SPA = values[3];
            pk.EV_SPD = limits.SpecialCombined ? values[3] : values[4];
            pk.EV_SPE = values[5];
        }
    }

    private PokemonDetail Detail(SlotRef at, PKM pk, string language)
    {
        var strings = GameInfo.GetStrings(language);
        var origin = at.IsParty ? StorageSlotType.Party : StorageSlotType.Box;
        var info = Describe(pk, at.Slot, strings, origin);
        var limits = LimitsFor(pk);

        var stats = pk.Clone();
        stats.ResetPartyStats();

        var abilities = new List<Option>();
        if (limits.HasAbility)
        {
            var personal = pk.PersonalInfo;
            for (int i = 0; i < personal.AbilityCount; i++)
            {
                int id = personal.GetAbilityAtIndex(i);
                abilities.Add(new Option(i, Get(strings.abilitylist, id) ?? $"#{id}"));
            }
        }

        var edit = new PokemonEdit(
            Species: pk.Species,
            Nickname: pk.IsNicknamed ? pk.Nickname : "",
            IsNicknamed: pk.IsNicknamed && pk.Nickname.Length > 0,
            Level: pk.CurrentLevel,
            Nature: limits.HasNature ? (int)pk.Nature : 0,
            AbilityIndex: limits.HasAbility ? Math.Max(0, AbilitySlot(pk)) : 0,
            HeldItem: limits.HasHeldItem ? pk.HeldItem : 0,
            IsShiny: pk.IsShiny,
            Moves: [pk.Move1, pk.Move2, pk.Move3, pk.Move4],
            IVs: [pk.IV_HP, pk.IV_ATK, pk.IV_DEF, pk.IV_SPA, pk.IV_SPD, pk.IV_SPE],
            EVs: [pk.EV_HP, pk.EV_ATK, pk.EV_DEF, pk.EV_SPA, pk.EV_SPD, pk.EV_SPE]);

        return new PokemonDetail(
            Ref: at,
            Info: info,
            Edit: edit,
            Stats: [stats.Stat_HPMax, stats.Stat_ATK, stats.Stat_DEF, stats.Stat_SPA, stats.Stat_SPD, stats.Stat_SPE],
            Limits: limits,
            Abilities: abilities,
            Legality: LegalityLines(pk, origin, language));
    }

    private static IReadOnlyList<string> LegalityLines(PKM pk, StorageSlotType origin, string language)
    {
        try
        {
            var la = new LegalityAnalysis(pk, origin);
            if (la.Valid)
                return [];
            return la.Report(language, false)
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct()
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    private static bool? IsLegal(PKM pk, StorageSlotType origin)
    {
        try
        {
            return new LegalityAnalysis(pk, origin).Valid;
        }
        catch
        {
            return null;
        }
    }

    internal string GetBoxName(int box)
    {
        if (Save is IBoxDetailNameRead named)
        {
            var name = Safe(() => named.GetBoxName(box));
            if (!string.IsNullOrWhiteSpace(name))
                return name;
        }
        return $"{box + 1}";
    }

    internal BadgeInfo? GetBadges()
    {
        var sav = Save;
        (int flags, int total)? raw = sav switch
        {
            SAV1 s => (s.Badges, 8),
            SAV2 s => (s.Badges, 16),
            SAV3E s => (s.Badges, 8),
            SAV3FRLG s => (s.Badges, 8),
            SAV3RS s => (s.Badges, 8),
            SAV4HGSS s => (s.Badges16, 16),
            SAV4DP s => (s.Badges, 8),
            SAV4Pt s => (s.Badges, 8),
            SAV5 s => (s.Misc.Badges, 8),
            SAV6XY s => (s.Badges, 8),
            SAV6AO s => (s.Badges, 8),
            SAV8SWSH s => (s.Badges, 8),
            SAV8BS s => ((1 << s.MyStatus.BadgeCount) - 1, 8),
            _ => null,
        };
        if (raw is not { } r)
            return null;
        var list = Enumerable.Range(0, r.total).Select(i => (r.flags & (1 << i)) != 0).ToList();
        return new BadgeInfo(list.Count(b => b), r.total, list);
    }

    private List<Option> HoldableItems(IReadOnlyList<ComboItem> items)
    {
        if (Save.Generation < 2)
            return [];
        var holdable = new HashSet<ushort>(Save.HeldItems.ToArray());
        return items.Where(c => c.Value != 0 && holdable.Contains((ushort)c.Value)).Select(c => new Option(c.Value, c.Text)).ToList();
    }

    private bool IsHoldable(int item)
    {
        if (item == 0)
            return true;
        foreach (var held in Save.HeldItems)
        {
            if (held == item)
                return true;
        }
        return false;
    }

    private static List<Option> ToOptions(IReadOnlyList<ComboItem> items, bool skipZero)
        => items
            .Where(c => !(skipZero && c.Value == 0))
            .Select(c => new Option(c.Value, c.Text))
            .ToList();
}
