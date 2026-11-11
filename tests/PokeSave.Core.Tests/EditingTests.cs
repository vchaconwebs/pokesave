using PKHeX.Core;
using PokeSave.Core;

namespace PokeSave.Core.Tests;

/// <summary>Fase 1: edición. Cada cambio se exporta, se vuelve a abrir y se comprueba.</summary>
public class EditingTests
{
    private static readonly SlotRef First = new(SlotRef.Party, 0, 0);

    public static TheoryData<GameVersion> Detectable => new() { GameVersion.W, GameVersion.B2, GameVersion.BD };

    public static TheoryData<GameVersion> AllGenerations => new()
    {
        GameVersion.RD, GameVersion.C, GameVersion.W, GameVersion.X, GameVersion.OR,
        GameVersion.SN, GameVersion.US, GameVersion.SW, GameVersion.BD,
    };

    private static SaveFile MakeBlank(GameVersion version)
    {
        var sav = BlankSaveFile.Get(version, "TESTER", LanguageID.Spanish);
        var pk = sav.BlankPKM;
        pk.Species = (ushort)Species.Pikachu;
        pk.Language = (int)LanguageID.Spanish;
        pk.CurrentLevel = 12;
        pk.OriginalTrainerName = "TESTER";
        pk.Nickname = SpeciesName.GetSpeciesNameGeneration(pk.Species, pk.Language, sav.Generation);
        pk.Move1 = (ushort)Move.Tackle;
        pk.ResetPartyStats();
        sav.SetPartySlotAtIndex(pk, 0);

        var boxed = pk.Clone();
        boxed.Species = (ushort)Species.Bulbasaur;
        boxed.Nickname = SpeciesName.GetSpeciesNameGeneration(boxed.Species, boxed.Language, sav.Generation);
        sav.SetBoxSlotAtIndex(boxed, 0, 3);
        return sav;
    }

    private static SaveSession OpenDetectable(GameVersion version)
    {
        var bytes = MakeBlank(version).Write(BinaryExportSetting.None).ToArray();
        Assert.True(SaveSession.TryOpen(bytes, null, out var session, out var error), error);
        return session!;
    }

    private static SaveSession Reopen(SaveSession session)
    {
        Assert.True(SaveSession.TryOpen(session.Export(), null, out var reopened, out var error), error);
        Assert.True(reopened!.Save.ChecksumsValid);
        return reopened;
    }

    private static PokemonDetail Detail(SaveSession s, SlotRef at) => Assert.IsType<PokemonDetail>(s.GetPokemon(at));

    private static PokemonDetail Edit(SaveSession s, SlotRef at, Func<PokemonEdit, PokemonEdit> change)
    {
        var result = s.SetPokemon(at, change(Detail(s, at).Edit));
        Assert.True(result.Ok, $"error={result.Error}");
        return result.Pokemon!;
    }

    [Theory]
    [MemberData(nameof(Detectable))]
    public void Nivel_y_dinero_sobreviven_a_exportar(GameVersion version)
    {
        // Criterio de aceptación 3 de la especificación.
        var s = OpenDetectable(version);
        Edit(s, First, e => e with { Level = 57 });
        Assert.True(s.SetTrainer(new TrainerEdit("Lucía", 987_654)).Ok);

        var r = Reopen(s);
        var summary = r.GetSummary();
        Assert.Equal(57, summary.Party[0].Level);
        Assert.Equal(987_654u, summary.Trainer.Money);
        Assert.Equal("Lucía", summary.Trainer.Name);
        Assert.Equal(summary.Party[0].HpMax, summary.Party[0].HpCurrent);
    }

    [Theory]
    [MemberData(nameof(Detectable))]
    public void Todos_los_campos_sobreviven_a_exportar(GameVersion version)
    {
        var s = OpenDetectable(version);
        var before = Detail(s, First);
        // La última habilidad (la oculta si existe) es distinta de la primera.
        int otherAbility = before.Abilities.Count - 1;
        int item = s.GetLists().Items.First(i => i.Name.Length > 0).Id;

        Edit(s, First, e => e with
        {
            Species = (int)Species.Raichu,
            Nickname = "Chispa",
            IsNicknamed = true,
            Nature = (int)Nature.Timid,
            AbilityIndex = otherAbility,
            HeldItem = item,
            IsShiny = true,
            Moves = [(int)Move.Thunderbolt, (int)Move.QuickAttack, 0, (int)Move.Surf],
            IVs = [31, 0, 31, 31, 31, 31],
            EVs = [4, 0, 0, 252, 0, 252],
        });

        var after = Detail(Reopen(s), First);
        Assert.Equal((int)Species.Raichu, after.Edit.Species);
        Assert.Equal("Chispa", after.Edit.Nickname);
        Assert.True(after.Edit.IsNicknamed);
        Assert.Equal((int)Nature.Timid, after.Edit.Nature);
        Assert.Equal(otherAbility, after.Edit.AbilityIndex);
        Assert.Equal(item, after.Edit.HeldItem);
        Assert.True(after.Edit.IsShiny);
        // Sin huecos: el movimiento del final sube al hueco vacío.
        Assert.Equal([(int)Move.Thunderbolt, (int)Move.QuickAttack, (int)Move.Surf, 0], after.Edit.Moves);
        Assert.Equal([31, 0, 31, 31, 31, 31], after.Edit.IVs);
        Assert.Equal([4, 0, 0, 252, 0, 252], after.Edit.EVs);
        Assert.Equal("Eléctrico", Assert.Single(after.Info.Types).Name);
    }

    [Theory]
    [MemberData(nameof(Detectable))]
    public void Editar_un_pokemon_de_caja(GameVersion version)
    {
        var s = OpenDetectable(version);
        var at = new SlotRef(SlotRef.BoxKind, 0, 3);
        Edit(s, at, e => e with { Level = 33 });

        var r = Reopen(s);
        var box = Assert.IsType<BoxView>(r.GetBox(0));
        var slot = Assert.Single(box.Slots);
        Assert.Equal(3, slot.Slot);
        Assert.Equal((int)Species.Bulbasaur, slot.Species);
        Assert.Equal(33, slot.Level);
    }

    [Theory]
    [MemberData(nameof(Detectable))]
    public void Quitar_el_mote_vuelve_al_nombre_de_la_especie(GameVersion version)
    {
        var s = OpenDetectable(version);
        Edit(s, First, e => e with { Nickname = "Chispa", IsNicknamed = true });
        var after = Edit(s, First, e => e with { IsNicknamed = false, Nickname = "" });
        Assert.False(after.Edit.IsNicknamed);
        Assert.Equal("Pikachu", after.Info.Nickname);
    }

    [Theory]
    [MemberData(nameof(Detectable))]
    public void Quitar_variocolor(GameVersion version)
    {
        var s = OpenDetectable(version);
        Edit(s, First, e => e with { IsShiny = true });
        Assert.False(Edit(s, First, e => e with { IsShiny = false }).Edit.IsShiny);
    }

    [Theory]
    [MemberData(nameof(AllGenerations))]
    public void Editar_funciona_en_todas_las_generaciones(GameVersion version)
    {
        var s = SaveSession.FromSave(MakeBlank(version));
        var d = Detail(s, First);
        int maxIv = d.Limits.MaxIV;

        var after = Edit(s, First, e => e with
        {
            Level = 40,
            IsShiny = true,
            Moves = [(int)Move.Thunderbolt, (int)Move.Tackle, 0, 0],
            IVs = [maxIv, maxIv, maxIv, maxIv, maxIv, maxIv],
        });

        Assert.Equal(40, after.Edit.Level);
        Assert.True(after.Edit.IsShiny);
        Assert.Equal((int)Move.Thunderbolt, after.Edit.Moves[0]);
        // En Gen 1-2 el variocolor fija los IVs (DVs), así que mandan sobre los pedidos.
        if (s.Save.Generation >= 3)
            Assert.All(after.Edit.IVs, v => Assert.Equal(maxIv, v));
        Assert.Equal(6, after.Stats.Count);
        Assert.True(after.Stats[0] > 0);
        Assert.NotEmpty(s.Export());
    }

    [Theory]
    [MemberData(nameof(AllGenerations))]
    public void Limites_segun_generacion(GameVersion version)
    {
        var s = SaveSession.FromSave(MakeBlank(version));
        var l = Detail(s, First).Limits;
        int gen = s.Save.Generation;

        Assert.Equal(gen >= 3, l.HasNature);
        Assert.Equal(gen >= 3, l.HasAbility);
        Assert.Equal(gen >= 2, l.HasHeldItem);
        Assert.Equal(gen <= 2 ? 15 : 31, l.MaxIV);
        Assert.Equal(gen <= 2, l.SpecialCombined);
    }

    // ---------- Validación: la UI no puede romper la partida ----------

    public static TheoryData<string, Func<PokemonEdit, PokemonEdit>> InvalidEdits => new()
    {
        { "species", e => e with { Species = 0 } },
        { "species", e => e with { Species = 99999 } },
        { "level", e => e with { Level = 0 } },
        { "level", e => e with { Level = 101 } },
        { "moves", e => e with { Moves = [0, 0, 0, 0] } },
        { "moves", e => e with { Moves = [1, 2, 3] } },
        { "moves", e => e with { Moves = [99999, 0, 0, 0] } },
        { "moves-duplicate", e => e with { Moves = [33, 33, 0, 0] } },
        { "ivs", e => e with { IVs = [32, 0, 0, 0, 0, 0] } },
        { "ivs", e => e with { IVs = [-1, 0, 0, 0, 0, 0] } },
        { "evs", e => e with { EVs = [256, 0, 0, 0, 0, 0] } },
        { "evs", e => e with { EVs = [252, 252, 252, 0, 0, 0] } },
        { "nature", e => e with { Nature = 25 } },
        { "ability", e => e with { AbilityIndex = 7 } },
        { "item", e => e with { HeldItem = 99999 } },
        { "nickname", e => e with { IsNicknamed = true, Nickname = "" } },
        { "nickname", e => e with { IsNicknamed = true, Nickname = "UnMoteDemasiadoLargo" } },
    };

    [Theory]
    [MemberData(nameof(InvalidEdits))]
    public void Ediciones_invalidas_se_rechazan_sin_tocar_la_partida(string error, Func<PokemonEdit, PokemonEdit> change)
    {
        var s = OpenDetectable(GameVersion.W);
        var before = s.Export();

        var result = s.SetPokemon(First, change(Detail(s, First).Edit));

        Assert.False(result.Ok);
        Assert.Equal(error, result.Error);
        Assert.Equal(before, s.Export());
    }

    [Fact]
    public void Objeto_que_no_se_puede_llevar_se_rechaza()
    {
        var s = OpenDetectable(GameVersion.BD);
        var holdable = s.GetLists().Items.Select(i => i.Id).ToHashSet();
        int notHoldable = Enumerable.Range(1, s.Save.MaxItemID).First(i => !holdable.Contains(i));
        Assert.Equal("item", s.SetPokemon(First, Detail(s, First).Edit with { HeldItem = notHoldable }).Error);
    }

    [Theory]
    [InlineData(GameVersion.E)]
    [InlineData(GameVersion.Pt)]
    public void Gen_3_y_4_naturaleza_variocolor_y_habilidad_a_la_vez(GameVersion version)
    {
        // En Gen 3/4 los tres dependen del PID. No se puede escribir su partida en blanco,
        // así que se prueba directamente sobre el Pokémon.
        var sav = BlankSaveFile.Get(version, "TESTER", LanguageID.English);
        var s = SaveSession.FromSaveNoExport(sav);
        var pk = sav.BlankPKM;
        pk.Species = (ushort)Species.Gengar;
        pk.CurrentLevel = 30;
        pk.Move1 = (ushort)Move.Lick;

        var edit = new PokemonEdit((int)Species.Gengar, "", false, 30, (int)Nature.Timid, 0, 0, true,
            [(int)Move.Lick, 0, 0, 0], [31, 0, 31, 31, 31, 31], [0, 0, 0, 0, 0, 0]);
        Assert.Null(s.Apply(pk, edit));
        Assert.Equal(Nature.Timid, pk.Nature);
        Assert.True(pk.IsShiny);
        Assert.Equal(1, pk.AbilityNumber);
    }

    [Fact]
    public void Entrenador_invalido_se_rechaza()
    {
        var s = OpenDetectable(GameVersion.W);
        Assert.Equal("trainer-name", s.SetTrainer(new TrainerEdit("", 0)).Error);
        Assert.Equal("trainer-name", s.SetTrainer(new TrainerEdit("NombreLarguisimo", 0)).Error);
        Assert.Equal("money", s.SetTrainer(new TrainerEdit("Ash", 10_000_000)).Error);
    }

    [Fact]
    public void Hueco_vacio_o_fuera_de_rango_no_rompe()
    {
        var s = OpenDetectable(GameVersion.W);
        Assert.Null(s.GetPokemon(new SlotRef(SlotRef.Party, 0, 5)));
        Assert.Null(s.GetPokemon(new SlotRef(SlotRef.BoxKind, 999, 0)));
        Assert.Null(s.GetPokemon(new SlotRef("otro", 0, 0)));
        Assert.Null(s.GetBox(-1));
        Assert.False(s.SetPokemon(new SlotRef(SlotRef.BoxKind, 0, 0), Detail(s, First).Edit).Ok);
    }

    // ---------- Lectura ----------

    [Fact]
    public void Listas_filtradas_al_juego()
    {
        var s = OpenDetectable(GameVersion.W);
        var lists = s.GetLists();
        Assert.Equal(649, lists.Species.Count); // Teselia: hasta Genesect
        Assert.Contains(lists.Moves, m => m.Name == "Placaje");
        Assert.Equal(25, lists.Natures.Count);
        Assert.DoesNotContain(lists.Species, o => o.Id == 0);
    }

    [Fact]
    public void Detalle_trae_legalidad_legible()
    {
        var s = OpenDetectable(GameVersion.W);
        var d = Detail(s, First);
        // El Pokémon de prueba no tiene datos de captura: debe haber avisos en español.
        Assert.NotEmpty(d.Legality);
        Assert.Contains(d.Legality, l => l.Contains("Inválido"));
    }

    [Fact]
    public void Medallas_y_nombres_de_caja()
    {
        var sav = MakeBlank(GameVersion.W);
        ((SAV5)sav).Misc.Badges = 0b0000_0111;
        var summary = SaveSession.FromSave(sav).GetSummary();

        var badges = Assert.IsType<BadgeInfo>(summary.Trainer.Badges);
        Assert.Equal(3, badges.Earned);
        Assert.Equal(8, badges.Total);
        Assert.Equal(summary.BoxCount, summary.BoxNames.Count);
        Assert.All(summary.BoxNames, n => Assert.False(string.IsNullOrWhiteSpace(n)));
    }
}
